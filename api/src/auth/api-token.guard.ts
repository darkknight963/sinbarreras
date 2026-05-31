import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ApiTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ method?: string; headers: Record<string, string | string[] | undefined> }>();

    if (request.method === 'OPTIONS') {
      return true;
    }

    const configuredToken = process.env.API_AUTH_TOKEN?.trim();

    if (!configuredToken) {
      return true;
    }

    const rawAuthorization = request.headers.authorization;
    const authorization = Array.isArray(rawAuthorization) ? rawAuthorization[0] : rawAuthorization;
    const expected = `Bearer ${configuredToken}`;

    if (authorization !== expected) {
      throw new UnauthorizedException('Valid API bearer token required');
    }

    return true;
  }
}
