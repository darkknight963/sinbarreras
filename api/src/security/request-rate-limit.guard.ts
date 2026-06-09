import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { RATE_LIMIT_METADATA_KEY, RateLimitOptions } from './rate-limit.decorator';
import { RequestRateLimitService } from './request-rate-limit.service';

@Injectable()
export class RequestRateLimitGuard implements CanActivate {
  private static readonly defaults = {
    scan: { limit: 20, windowMs: 15 * 60 * 1000 },
    project: { limit: 60, windowMs: 60 * 60 * 1000 },
    report: { limit: 120, windowMs: 15 * 60 * 1000 },
    complaint: { limit: 5, windowMs: 60 * 60 * 1000 },
  } as const;

  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RequestRateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const metadata = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!metadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const defaults = RequestRateLimitGuard.defaults[metadata.scope];
    const limit = metadata.limit ?? defaults.limit;
    const windowMs = metadata.windowMs ?? defaults.windowMs;
    const key = this.rateLimitService.buildScopeKey(metadata.scope, request);
    const result = this.rateLimitService.consume(key, limit, windowMs);

    response.setHeader('X-RateLimit-Limit', String(result.limit));
    response.setHeader('X-RateLimit-Remaining', String(result.remaining));
    response.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

    if (!result.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
      response.setHeader('Retry-After', String(retryAfterSeconds));
      throw new HttpException(
        {
          message: 'Rate limit exceeded',
          retryAfterSeconds,
          scope: metadata.scope,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
