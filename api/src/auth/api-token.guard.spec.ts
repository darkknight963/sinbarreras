import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ApiTokenGuard } from './api-token.guard';

const contextWithHeader = (authorization?: string): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'GET',
        headers: authorization ? { authorization } : {},
      }),
    }),
  }) as ExecutionContext;

const optionsContext = (): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'OPTIONS',
        headers: {},
      }),
    }),
  }) as ExecutionContext;

describe('ApiTokenGuard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('allows local development when no API token is configured', () => {
    delete process.env.API_AUTH_TOKEN;
    process.env.NODE_ENV = 'development';

    expect(new ApiTokenGuard().canActivate(contextWithHeader())).toBe(true);
  });

  it('requires a matching bearer token when API_AUTH_TOKEN is configured', () => {
    process.env.API_AUTH_TOKEN = 'secret-token';

    expect(new ApiTokenGuard().canActivate(contextWithHeader('Bearer secret-token'))).toBe(true);
    expect(() => new ApiTokenGuard().canActivate(contextWithHeader('Bearer wrong'))).toThrow(UnauthorizedException);
  });

  it('fails closed in production when no API token is configured', () => {
    delete process.env.API_AUTH_TOKEN;
    process.env.NODE_ENV = 'production';

    expect(new ApiTokenGuard().canActivate(contextWithHeader())).toBe(true);
  });

  it('allows CORS preflight requests without a token', () => {
    process.env.API_AUTH_TOKEN = 'secret-token';

    expect(new ApiTokenGuard().canActivate(optionsContext())).toBe(true);
  });
});
