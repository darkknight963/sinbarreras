import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_ROUTE_KEY } from './auth.constants';
import { AuthService } from './auth.service';

const normalizeRole = (role?: string) => {
  if (role === 'superadmin') return 'superadmin';
  if (role === 'guest') return 'guest';
  return 'admin';
};

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(
    private readonly reflector?: Reflector,
    private readonly authService?: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      headers: Record<string, string | string[] | undefined>;
      authMode?: 'service' | 'session';
      user?: {
        id: string;
        email?: string;
        fullName?: string | null;
        role?: string;
        companyName?: string | null;
        billingStatus?: string | null;
        billingPlan?: string | null;
      };
      authSessionToken?: string;
    }>();
    const isPublic = this.reflector?.getAllAndOverride<boolean>(AUTH_ROUTE_KEY, [context.getHandler(), context.getClass()]) ?? false;

    if (request.method === 'OPTIONS') {
      return true;
    }

    const configuredToken = process.env.API_AUTH_TOKEN?.trim();
    const rawAuthorization = request.headers.authorization;
    const authorization = Array.isArray(rawAuthorization) ? rawAuthorization[0] : rawAuthorization;
    const normalizedAuthorization = typeof authorization === 'string' ? authorization.replace(/^Bearer\s+/i, '').trim() : '';

    if (configuredToken && authorization === `Bearer ${configuredToken}`) {
      request.authMode = 'service';
    } else if (normalizedAuthorization) {
      try {
        const session = await this.authService?.validateSessionToken(normalizedAuthorization);
        if (session) {
          request.authMode = 'session';
          request.user = {
            id: session.user.id,
            email: session.user.email,
            fullName: session.user.fullName,
            role: normalizeRole(session.user.role),
            companyName: session.user.companyName,
            billingStatus: session.user.billingStatus,
            billingPlan: session.user.billingPlan,
          };
          request.authSessionToken = normalizedAuthorization;
        }
      } catch (err) {
        // Ignorar errores de token invalido si es publico, sino lanzar
        if (!isPublic) {
          throw new UnauthorizedException('Token invalido');
        }
      }
    }

    if (request.authMode || isPublic) {
      return true;
    }

    if (!configuredToken && process.env.NODE_ENV !== 'production') {
      return true;
    }

    throw new UnauthorizedException('Valid session or API bearer token required');
  }
}
