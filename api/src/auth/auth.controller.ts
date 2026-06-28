import { Body, Controller, Delete, Get, Patch, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';
import { RateLimit } from '../security/rate-limit.decorator';

const SESSION_COOKIE = 'sb_session';
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

// El token de sesión viaja exclusivamente en una cookie httpOnly para que JavaScript
// del cliente no pueda leerlo ni en caso de XSS. SameSite=Lax cubre CSRF en la mayoría
// de flujos y además permite que las redirecciones OAuth cross-origin entreguen la cookie.
function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @RateLimit({ scope: 'auth', limit: 10, windowMs: 10 * 60 * 1000 })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    if (result.token) setSessionCookie(res, result.token);
    // No devolver el token en el body — viaja solo en cookie httpOnly.
    const { token: _token, ...safeResult } = result;
    return safeResult;
  }

  @Public()
  @RateLimit({ scope: 'auth', limit: 10, windowMs: 10 * 60 * 1000 })
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto, request);
    if (result.token) setSessionCookie(res, result.token);
    const { token: _token, ...safeResult } = result;
    return safeResult;
  }

  // Endpoint de recuperación: resetea brute-force y re-aplica el hash de la contraseña.
  // Protegido por la ADMIN_PASSWORD del env (no requiere sesión activa).
  @Public()
  @RateLimit({ scope: 'auth', limit: 5, windowMs: 60 * 60 * 1000 })
  @Post('admin/reset')
  async adminReset(
    @Body() body: { password: string },
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    return this.authService.resetAdminBruteForce(body.password, ip);
  }

  @Public()
  @RateLimit({ scope: 'auth', limit: 5, windowMs: 10 * 60 * 1000 })
  @Post('guest')
  async guest(@Req() request: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.createGuestSession(request);
    if (result.token) setSessionCookie(res, result.token);
    const { token: _token, ...safeResult } = result;
    return safeResult;
  }

  @Public()
  @Get('providers')
  providers() {
    return this.authService.getOAuthProviders();
  }

  @Public()
  @RateLimit({ scope: 'auth', limit: 20, windowMs: 10 * 60 * 1000 })
  @Get('google')
  redirectGoogle(@Res() res: Response) {
    return res.redirect(302, this.authService.buildOAuthStartUrl('google'));
  }

  @Public()
  @RateLimit({ scope: 'auth', limit: 20, windowMs: 10 * 60 * 1000 })
  @Get('microsoft')
  redirectMicrosoft(@Res() res: Response) {
    return res.redirect(302, this.authService.buildOAuthStartUrl('microsoft'));
  }

  @Public()
  @RateLimit({ scope: 'auth', limit: 20, windowMs: 10 * 60 * 1000 })
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    return this.handleOAuthCallback(res, 'google', code, state);
  }

  @Public()
  @RateLimit({ scope: 'auth', limit: 20, windowMs: 10 * 60 * 1000 })
  @Get('microsoft/callback')
  async microsoftCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    return this.handleOAuthCallback(res, 'microsoft', code, state);
  }

  // Emite un bearer token de corta duración (2h) para que la extensión de Chrome pueda
  // autenticarse al enviar resultados. La extensión no puede acceder a cookies httpOnly.
  @Post('extension-token')
  async extensionToken(
    @CurrentUser() user: { id: string } | null,
    @Req() _req: Request,
  ) {
    if (!user) throw new UnauthorizedException('Sesión inválida');
    const token = await this.authService.createExtensionToken(user.id);
    return { token };
  }

  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    if (!user) {
      throw new UnauthorizedException('Sesión inválida');
    }
    return this.authService.me(user.id);
  }

  @Patch('me/password')
  async changePassword(
    @CurrentUser() user: { id: string } | null,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request & { authSessionToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!user) {
      throw new UnauthorizedException('Sesión inválida');
    }
    const result = await this.authService.changePassword(user.id, dto, request.authSessionToken);
    // Si se generó un nuevo token (rotación de sesión tras cambio de password), renovar cookie.
    if (result.newToken) {
      setSessionCookie(res, result.newToken);
      const { newToken: _nt, ...safe } = result;
      return safe;
    }
    return result;
  }

  @Delete('logout')
  async logout(
    @Req() request: Request & { authSessionToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = request.authSessionToken;
    if (token) {
      await this.authService.revokeSession(token);
    }
    clearSessionCookie(res);
    return { ok: true };
  }

  private async handleOAuthCallback(
    res: Response,
    provider: 'google' | 'microsoft',
    code: string,
    state: string,
  ) {
    try {
      const session = await this.authService.completeOAuthLogin(provider, code, state);
      // Setear cookie httpOnly antes de redirigir al frontend.
      // Ya no se pasa el token en el hash de la URL.
      setSessionCookie(res, session.token);
      return res.redirect(302, this.authService.buildFrontendOAuthSuccessRedirect(provider));
    } catch (error) {
      const isExpected = error instanceof Error && (
        error.message.includes('expiro') ||
        error.message.includes('invalido') ||
        error.message.includes('utilizado') ||
        error.message.includes('configurado')
      );
      const message = isExpected && error instanceof Error
        ? error.message
        : 'Error al iniciar sesión. Por favor inténtalo de nuevo.';
      return res.redirect(302, this.authService.buildFrontendOAuthErrorRedirect(provider, message));
    }
  }
}
