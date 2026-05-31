import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { Request } from 'express';
import type { RateLimitScope } from './rate-limit.decorator';

interface BucketState {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

@Injectable()
export class RequestRateLimitService {
  private readonly buckets = new Map<string, BucketState>();
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor() {
    this.cleanupTimer = setInterval(() => this.pruneExpiredBuckets(), 5 * 60 * 1000);
    this.cleanupTimer.unref?.();
  }

  consume(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const current = this.buckets.get(key);

    if (!current || current.resetAt <= now) {
      const resetAt = now + windowMs;
      const next: BucketState = { count: 1, resetAt };
      this.buckets.set(key, next);
      return {
        allowed: true,
        limit,
        remaining: Math.max(0, limit - 1),
        resetAt,
      };
    }

    current.count += 1;
    this.buckets.set(key, current);

    return {
      allowed: current.count <= limit,
      limit,
      remaining: Math.max(0, limit - current.count),
      resetAt: current.resetAt,
    };
  }

  private pruneExpiredBuckets(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
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
}
