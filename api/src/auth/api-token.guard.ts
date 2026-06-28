import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_ROUTE_KEY } from './auth.constants';
import { AuthService } from './auth.service';

const SESSION_COOKIE = 'sb_session';

const normalizeRole = (role?: string) => {
  if (role === 'superadmin') return 'superadmin';
  if (role === 'admin') return 'admin';
  if (role === 'guest') return 'guest';
  return 'free';
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
      cookies?: Record<string, string>;
      authMode?: 'service' | 'session';
      authScope?: string | null;
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

    // Orden de preferencia:
    // 1. Service token (API_AUTH_TOKEN) — para integraciones M2M
    // 2. httpOnly cookie sb_session — para el frontend web
    // 3. Bearer token en header Authorization — para la extensión de Chrome y clientes API
    if (configuredToken && authorization === `Bearer ${configuredToken}`) {
      request.authMode = 'service';
    } else {
      const cookieToken = request.cookies?.[SESSION_COOKIE]?.trim() || '';
      const sessionToken = cookieToken || normalizedAuthorization;

      if (sessionToken) {
        try {
          const session = await this.authService?.validateSessionToken(sessionToken);
          if (session) {
            request.authMode = 'session';
            request.authScope = session.scope ?? null;
            request.user = {
              id: session.user.id,
              email: session.user.email,
              fullName: session.user.fullName,
              role: normalizeRole(session.user.role),
              companyName: session.user.companyName,
              billingStatus: session.user.billingStatus,
              billingPlan: session.user.billingPlan,
            };
            request.authSessionToken = sessionToken;

            // Los tokens de extensión solo pueden usarse para enviar resultados de escaneo.
            // Cualquier otro endpoint recibe 401 para evitar que actúen como sesión completa.
            if (session.scope === 'extension') {
              const path: string = (request as any).path || (request as any).url || '';
              const allowed = path.includes('/scans/') && path.includes('/extension-result');
              if (!allowed && !isPublic) {
                throw new UnauthorizedException('Este token solo es válido para enviar resultados de la extensión');
              }
            }
          }
        } catch (err) {
          if (!isPublic) {
            throw new UnauthorizedException('Token invalido');
          }
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
