import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: { role?: string };
    }>();

    if (request.user?.role === 'superadmin') {
      return true;
    }

    throw new ForbiddenException('Se requiere perfil superadministrador');
  }
}
