import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

describe('AdminGuard', () => {
  const buildContext = (role?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user: role ? { role } : undefined,
        }),
      }),
    }) as ExecutionContext;

  it('allows superadmin users', () => {
    const guard = new AdminGuard();

    expect(guard.canActivate(buildContext('superadmin'))).toBe(true);
  });

  it('rejects admin users', () => {
    const guard = new AdminGuard();

    expect(() => guard.canActivate(buildContext('admin'))).toThrow(ForbiddenException);
  });

  it('rejects requests without role', () => {
    const guard = new AdminGuard();

    expect(() => guard.canActivate(buildContext())).toThrow(ForbiddenException);
  });
});
