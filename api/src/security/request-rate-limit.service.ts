import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import type { Request } from 'express';
import type { RateLimitOptions } from './rate-limit.decorator';
import Redis from 'ioredis';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export interface BruteForceResult {
  blocked: boolean;
  remainingAttempts: number;
  retryAfterMs: number;
}

type RateLimitScope = RateLimitOptions['scope'];

@Injectable()
export class RequestRateLimitService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly prefix = 'ratelimit:';
  private readonly bruteForcePrefix = 'auth:bruteforce:';

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL') || this.configService.get<string>('BULL_REDIS_URL');
    const password = this.configService.get<string>('REDIS_PASSWORD') || this.configService.get<string>('REDISPASSWORD');

    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        password: password || undefined,
        maxRetriesPerRequest: null,
      });
    } else {
      this.redis = new Redis({
        host: this.configService.get<string>('REDIS_HOST') || this.configService.get<string>('REDISHOST') || 'localhost',
        port: Number(this.configService.get<string>('REDIS_PORT') || this.configService.get<string>('REDISPORT') || 6379),
        password: password || undefined,
        maxRetriesPerRequest: null,
      });
    }
  }

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const redisKey = `${this.prefix}${key}`;

    const multi = this.redis.multi();
    multi.incr(redisKey);
    multi.pttl(redisKey);
    const raw = await multi.exec();
    const count = Number(raw?.[0]?.[1] ?? 1);
    const currentTtl = Number(raw?.[1]?.[1] ?? -1);

    let resetAt: number;
    if (currentTtl === -1 || currentTtl === -2) {
      resetAt = now + windowMs;
      await this.redis.pexpire(redisKey, windowMs);
    } else {
      resetAt = now + currentTtl;
    }

    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    };
  }

  buildCallerKey(request: Request): string {
    const configuredToken = process.env.API_AUTH_TOKEN?.trim();
    const authorization = request.headers.authorization;
    const token = Array.isArray(authorization) ? authorization[0] : authorization;
    const normalizedToken = token?.trim();

    if (configuredToken && normalizedToken) {
      return `token:${createHash('sha256').update(normalizedToken).digest('hex')}`;
    }

    const forwardedFor = request.headers['x-forwarded-for'];
    const forwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const forwardedIp = forwarded?.split(',')[0]?.trim();
    const ip = forwardedIp || request.ip || request.socket?.remoteAddress || 'anonymous';
    return `ip:${ip}`;
  }

  buildScopeKey(scope: RateLimitScope, request: Request): string {
    const callerKey = this.buildCallerKey(request);

    if (scope === 'auth') {
      return `${callerKey}:auth`;
    }

    if (scope === 'scan') {
      const projectId = this.extractProjectId(request);
      return `${callerKey}:scan:${projectId ?? 'unknown-project'}`;
    }

    if (scope === 'project') {
      const projectId = this.extractProjectId(request);
      return `${callerKey}:project:${projectId ?? 'create'}`;
    }

    const scanId = this.extractScanId(request);
    return `${callerKey}:report:${scanId ?? 'unknown-scan'}`;
  }

  private extractProjectId(request: Request): string | undefined {
    const body = request.body as Record<string, unknown> | undefined;
    const params = request.params as Record<string, string | undefined> | undefined;
    const projectId = body?.projectId ?? params?.projectId ?? params?.id;
    return typeof projectId === 'string' && projectId.trim() ? projectId.trim() : undefined;
  }

  private extractScanId(request: Request): string | undefined {
    const params = request.params as Record<string, string | undefined> | undefined;
    const scanId = params?.scanId ?? params?.id;
    return typeof scanId === 'string' && scanId.trim() ? scanId.trim() : undefined;
  }

  async recordFailedAttempt(identifier: string, maxAttempts: number, windowMs: number): Promise<BruteForceResult> {
    const key = `${this.bruteForcePrefix}${identifier}`;
    const now = Date.now();

    const multi = this.redis.multi();
    multi.incr(key);
    multi.pttl(key);
    const raw = await multi.exec();
    const count = Number(raw?.[0]?.[1] ?? 1);
    const currentTtl = Number(raw?.[1]?.[1] ?? -1);

    if ((currentTtl === -1 || currentTtl === -2) && count === 1) {
      await this.redis.pexpire(key, windowMs);
    }

    const retryAfterMs = currentTtl <= 0 ? windowMs : currentTtl;

    return {
      blocked: count > maxAttempts,
      remainingAttempts: Math.max(0, maxAttempts - count),
      retryAfterMs,
    };
  }

  async isBlocked(identifier: string): Promise<boolean> {
    const key = `${this.bruteForcePrefix}${identifier}`;
    const count = parseInt((await this.redis.get(key)) || '0', 10);
    const limit = parseInt((await this.redis.get(`${key}:limit`)) || '5', 10);
    return count > limit;
  }

  async getBlockRemaining(identifier: string): Promise<number> {
    const key = `${this.bruteForcePrefix}${identifier}`;
    const ttl = await this.redis.pttl(key);
    return ttl > 0 ? ttl : 0;
  }

  async resetAttempts(identifier: string): Promise<void> {
    const key = `${this.bruteForcePrefix}${identifier}`;
    await this.redis.del(key, `${key}:limit`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
