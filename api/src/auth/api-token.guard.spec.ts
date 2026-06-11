import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
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

  it('allows local development when no API token is configured', async () => {
    delete process.env.API_AUTH_TOKEN;
    process.env.NODE_ENV = 'development';

    await expect(new ApiTokenGuard().canActivate(contextWithHeader())).resolves.toBe(true);
  });

  it('requires a matching bearer token when API_AUTH_TOKEN is configured', async () => {
    process.env.API_AUTH_TOKEN = 'secret-token';

    await expect(new ApiTokenGuard().canActivate(contextWithHeader('Bearer secret-token'))).resolves.toBe(true);
    await expect(new ApiTokenGuard().canActivate(contextWithHeader('Bearer wrong'))).rejects.toThrow(UnauthorizedException);
  });

  it('fails closed in production when no API token is configured', async () => {
    delete process.env.API_AUTH_TOKEN;
    process.env.NODE_ENV = 'production';

    await expect(new ApiTokenGuard().canActivate(contextWithHeader())).rejects.toThrow(UnauthorizedException);
  });

  it('allows CORS preflight requests without a token', async () => {
    process.env.API_AUTH_TOKEN = 'secret-token';

    await expect(new ApiTokenGuard().canActivate(optionsContext())).resolves.toBe(true);
  });

  it('preserves the free role from an authenticated session', async () => {
    delete process.env.API_AUTH_TOKEN;
    process.env.NODE_ENV = 'production';
    const request: any = {
      method: 'GET',
      headers: { authorization: 'Bearer session-token' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
    const reflector = {
      getAllAndOverride: jest.fn(() => false),
    } as any;
    const authService = {
      validateSessionToken: jest.fn(async () => ({
        user: {
          id: 'user-free',
          email: 'free@example.com',
          role: 'free',
          billingStatus: 'inactive',
          billingPlan: null,
        },
      })),
    } as any;

    await expect(new ApiTokenGuard(reflector, authService).canActivate(context)).resolves.toBe(true);
    expect(request.user.role).toBe('free');
  });
});
