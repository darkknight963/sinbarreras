import { Body, Controller, Delete, Get, Patch, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';
import { RateLimit } from '../security/rate-limit.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @RateLimit({ scope: 'auth', limit: 10, windowMs: 10 * 60 * 1000 })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @RateLimit({ scope: 'auth', limit: 10, windowMs: 10 * 60 * 1000 })
  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, request);
  }

  @Public()
  @RateLimit({ scope: 'auth', limit: 5, windowMs: 10 * 60 * 1000 })
  @Post('guest')
  guest(@Req() request: Request) {
    return this.authService.createGuestSession(request);
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

  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    if (!user) {
      throw new UnauthorizedException('Sesión inválida');
    }
    return this.authService.me(user.id);
  }

  @Patch('me/password')
  changePassword(@CurrentUser() user: { id: string } | null, @Body() dto: ChangePasswordDto) {
    if (!user) {
      throw new UnauthorizedException('Sesión inválida');
    }

    return this.authService.changePassword(user.id, dto);
  }

  @Delete('logout')
  async logout(@Req() request: Request & { authSessionToken?: string }) {
    const authorization = request.headers.authorization;
    const raw = Array.isArray(authorization) ? authorization[0] : authorization;
    const token = typeof raw === 'string' ? raw.replace(/^Bearer\s+/i, '').trim() : '';
    if (token) {
      await this.authService.revokeSession(token);
    }
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
      return res.redirect(302, this.authService.buildFrontendSessionRedirect(session.token, provider));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al iniciar sesión';
      return res.redirect(302, this.authService.buildFrontendOAuthErrorRedirect(provider, message));
    }
  }
}
