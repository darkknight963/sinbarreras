import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('includes billing state in the serialized me response', async () => {
    const userRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'cliente@demo.pe',
        passwordHash: 'salt:hash',
        fullName: 'Cliente Demo',
        companyName: 'Demo SAC',
        role: 'admin',
        isActive: true,
        createdAt: new Date('2026-05-31T12:00:00.000Z'),
        billingStatus: 'active',
        billingPlan: 'monthly',
        billingProvider: 'culqi',
        billingCurrency: 'PEN',
        billingPeriodEnd: new Date('2026-06-30T12:00:00.000Z'),
        billingCustomerId: 'cus_test_123',
        billingSubscriptionId: 'sxn_test_123',
      }),
    } as any;

    const service = new AuthService(userRepository, { findOne: jest.fn(), save: jest.fn(), delete: jest.fn() } as any, {
      get: jest.fn().mockImplementation((key: string, fallback?: number) => (key === 'SESSION_TTL_DAYS' ? 30 : fallback)),
    } as any, { isBlocked: jest.fn().mockResolvedValue(false), recordFailedAttempt: jest.fn(), resetAttempts: jest.fn(), getBlockRemaining: jest.fn() } as any);

    const result = await service.me('user-1');
    expect(result).toMatchObject({
      id: 'user-1',
      email: 'cliente@demo.pe',
      billingStatus: 'active',
      billingPlan: 'monthly',
      billingProvider: 'culqi',
      billingCurrency: 'PEN',
    });
    // Los IDs internos del proveedor de pagos no se exponen al cliente.
    expect(result).not.toHaveProperty('billingCustomerId');
    expect(result).not.toHaveProperty('billingSubscriptionId');
  });

  it('reports OAuth provider availability from configuration', () => {
    const service = new AuthService({} as any, {} as any, {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          GOOGLE_OAUTH_CLIENT_ID: 'google-client',
          GOOGLE_OAUTH_CLIENT_SECRET: 'google-secret',
          GOOGLE_OAUTH_REDIRECT_URI: 'https://api.example.com/auth/google/callback',
          MICROSOFT_OAUTH_CLIENT_ID: 'microsoft-client',
          MICROSOFT_OAUTH_CLIENT_SECRET: 'microsoft-secret',
          MICROSOFT_OAUTH_TENANT_ID: 'common',
          MICROSOFT_OAUTH_REDIRECT_URI: 'https://api.example.com/auth/microsoft/callback',
          FRONTEND_URL: 'https://app.example.com',
        };
        return values[key] ?? fallback;
      }),
    } as any, { isBlocked: jest.fn(), recordFailedAttempt: jest.fn(), resetAttempts: jest.fn(), getBlockRemaining: jest.fn() } as any);

    expect(service.getOAuthProviders()).toEqual({
      google: {
        enabled: true,
        name: 'Google',
      },
      microsoft: {
        enabled: true,
        name: 'Microsoft',
      },
    });
  });

  it('changes the password after validating the current password', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const userRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'cliente@demo.pe',
        passwordHash: 'salt:hash',
        fullName: 'Cliente Demo',
        companyName: 'Demo SAC',
        role: 'admin',
        isActive: true,
        createdAt: new Date('2026-05-31T12:00:00.000Z'),
        billingStatus: 'active',
        billingPlan: 'monthly',
        billingProvider: 'culqi',
        billingCurrency: 'PEN',
        billingPeriodEnd: new Date('2026-06-30T12:00:00.000Z'),
        billingCustomerId: 'cus_test_123',
        billingSubscriptionId: 'sxn_test_123',
      }),
      save,
    } as any;

    const service = new AuthService(userRepository, { findOne: jest.fn(), save: jest.fn(), delete: jest.fn() } as any, {
      get: jest.fn().mockImplementation((key: string, fallback?: number) => (key === 'SESSION_TTL_DAYS' ? 30 : fallback)),
    } as any, { isBlocked: jest.fn().mockResolvedValue(false), recordFailedAttempt: jest.fn(), resetAttempts: jest.fn(), getBlockRemaining: jest.fn() } as any);

    const verifySpy = jest.spyOn(service as any, 'verifyPassword').mockReturnValue(true);
    const hashSpy = jest.spyOn(service as any, 'hashPassword').mockReturnValue('new-salt:new-hash');

    await expect(
      service.changePassword('user-1', {
        currentPassword: 'CurrentPass123!',
        newPassword: 'NewPass123!',
      }),
    ).resolves.toEqual({ ok: true });

    expect(verifySpy).toHaveBeenCalledWith('CurrentPass123!', 'salt:hash');
    expect(hashSpy).toHaveBeenCalledWith('NewPass123!');
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ passwordHash: 'new-salt:new-hash' }));
  });
});
