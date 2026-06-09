import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

@Injectable()
export class RedisRateLimitService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly prefix = 'ratelimit:';

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

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
