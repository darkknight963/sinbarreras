import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_METADATA_KEY = 'rate_limit_metadata';

export type RateLimitScope = 'scan' | 'project' | 'report';

export interface RateLimitOptions {
  scope: RateLimitScope;
  limit: number;
  windowMs: number;
}

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_METADATA_KEY, options);
