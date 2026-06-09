import { BadRequestException, ConflictException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { randomBytes, randomUUID, pbkdf2Sync, timingSafeEqual, createHash, createHmac } from 'crypto';
import { User } from './entities/user.entity';
import { Session } from './entities/session.entity';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { RequestRateLimitService } from '../security/request-rate-limit.service';

const PASSWORD_ITERATIONS = 120000;
const PASSWORD_KEY_LENGTH = 32;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

type OAuthProvider = 'google' | 'microsoft';

type OAuthProviderProfile = {
  email: string | null;
  fullName: string | null;
  emailVerified?: boolean;
};

type OAuthProviderConfig = {
  enabled: boolean;
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationUrl: string;
  tokenUrl: string;
  scope: string;
  userInfoUrl: string;
  extraParams?: Record<string, string>;
};

type OAuthStatePayload = {
  provider: OAuthProvider;
  nonce: string;
  issuedAt: number;
};

type AppRole = 'free' | 'admin' | 'superadmin' | 'guest';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private readonly configService: ConfigService,
    private readonly rateLimitService: RequestRateLimitService,
  ) {}

  private normalizeRole(role: string | null | undefined): AppRole {
    if (role === 'superadmin') return 'superadmin';
    if (role === 'admin') return 'admin';
    if (role === 'guest') return 'guest';
    return 'free';
  }

  async onModuleInit() {
    const configuredAdminEmail = this.configService.get<string>('ADMIN_EMAIL')?.trim().toLowerCase();
    const configuredAdminPassword = this.configService.get<string>('ADMIN_PASSWORD')?.trim();
    const masterAdminEmail = configuredAdminEmail || 'administrador@gzakgroup.com';

    if (configuredAdminPassword) {
      const legacyAdminEmails = masterAdminEmail === 'administrador@gzakgroup.com'
        ? ['administrador@sinbarreras.com']
        : ['administrador@sinbarreras.com', 'administrador@gzakgroup.com'];
      await this.ensureAdminUser(masterAdminEmail, configuredAdminPassword, legacyAdminEmails);
      return;
    }

    if (process.env.NODE_ENV === 'production') {
      return;
    }

    await this.ensureAdminUser('administrador@gzakgroup.com', '12345678', ['administrador@sinbarreras.com', 'demo@sinbarreras.local']);
  }

  private async ensureAdminUser(email: string, password: string, legacyEmails: string[] = []) {
    const existingMaster = await this.userRepository.findOne({ where: { email } });
    const legacyUsers = await Promise.all(
      legacyEmails.map(async (legacyEmail) => this.userRepository.findOne({ where: { email: legacyEmail } })),
    );
    const legacyUser = legacyUsers.find((user): user is User => Boolean(user));
    const masterUser = existingMaster || legacyUser || this.userRepository.create();

    Object.assign(masterUser, {
      email,
      passwordHash: this.hashPassword(password),
      fullName: 'Administrador',
      companyName: 'Sin Barreras',
      role: 'superadmin',
      isActive: true,
      billingStatus: 'active',
      billingPlan: 'annual',
      billingProvider: 'culqi',
      billingCurrency: 'PEN',
      billingPeriodEnd: new Date('2099-12-31T23:59:59.000Z'),
      billingCustomerId: 'master-account',
      billingSubscriptionId: 'enterprise-master',
    });

    await this.userRepository.save(masterUser);
  }

  getOAuthProviders() {
    return {
      google: {
        name: 'Google',
        enabled: this.getOAuthConfig('google').enabled,
      },
      microsoft: {
        name: 'Microsoft',
        enabled: this.getOAuthConfig('microsoft').enabled,
      },
    };
  }

  buildOAuthStartUrl(provider: OAuthProvider) {
    const config = this.getOAuthConfig(provider);
    if (!config.enabled) {
      throw new BadRequestException(`${config.name} no esta configurado`);
    }

    const state = this.signOAuthState(provider);
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scope,
      state,
      prompt: 'select_account',
      ...config.extraParams,
    });

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  async completeOAuthLogin(provider: OAuthProvider, code: string, state: string) {
    this.verifyOAuthState(provider, state);
    const config = this.getOAuthConfig(provider);
    if (!config.enabled) {
      throw new BadRequestException(`${config.name} no esta configurado`);
    }

    const tokenData = await this.exchangeOAuthCode(config, code);
    const profile = await this.fetchOAuthProfile(config, tokenData.access_token);
    const email = profile.email?.toLowerCase().trim() || '';

    if (!email) {
      throw new UnauthorizedException('No se pudo obtener el correo de la cuenta');
    }

    if (provider === 'google' && profile.emailVerified === false) {
      throw new UnauthorizedException('La cuenta de Google no esta verificada');
    }

    let user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      user = this.userRepository.create({
        email,
        passwordHash: this.hashPassword(randomBytes(32).toString('hex')),
        fullName: profile.fullName?.trim() || null,
        companyName: null,
        role: 'free',
        isActive: true,
        billingStatus: 'inactive',
        billingPlan: null,
        billingProvider: 'culqi',
        billingCurrency: null,
        billingPeriodEnd: null,
        billingCustomerId: null,
        billingSubscriptionId: null,
      });
      user = await this.userRepository.save(user);
    } else {
      if (!user.isActive) {
        throw new UnauthorizedException('La cuenta esta desactivada');
      }

      const nextFullName = user.fullName?.trim() ? user.fullName : profile.fullName?.trim() || null;
      if (nextFullName !== user.fullName) {
        user.fullName = nextFullName;
        user = await this.userRepository.save(user);
      }
    }

    const session = await this.createSession(user);
    return this.buildSessionResponse(user, session.token);
  }

  hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
    const derived = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, 'sha256').toString('hex');
    return `${salt}:${derived}`;
  }

  private verifyPassword(password: string, passwordHash: string) {
    const [salt, stored] = passwordHash.split(':');
    if (!salt || !stored) return false;
    const derived = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, 'sha256').toString('hex');
    const storedBuffer = Buffer.from(stored, 'hex');
    const derivedBuffer = Buffer.from(derived, 'hex');
    return storedBuffer.length === derivedBuffer.length && timingSafeEqual(storedBuffer, derivedBuffer);
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private getSessionTtlDays() {
    return this.configService.get<number>('SESSION_TTL_DAYS', 30);
  }

  async register(dto: RegisterDto, request?: { ip?: string }) {
    const identifier = this.buildBruteForceIdentifier(dto.email.toLowerCase(), request);
    const lockout = await this.rateLimitService.recordFailedAttempt(identifier, 5, 10 * 60 * 1000);
    if (lockout.blocked) {
      throw new UnauthorizedException({
        message: 'Demasiados intentos de registro fallidos. Intenta mas tarde.',
        retryAfterMs: lockout.retryAfterMs,
      });
    }

    const existing = await this.userRepository.findOne({ where: { email: dto.email.toLowerCase() } });
    if (existing) {
      throw new ConflictException('Ya existe una cuenta con ese correo');
    }

    const user = this.userRepository.create({
      email: dto.email.toLowerCase(),
      passwordHash: this.hashPassword(dto.password),
      fullName: dto.fullName?.trim() || null,
      companyName: dto.companyName?.trim() || null,
      role: 'free',
      isActive: true,
      billingStatus: 'inactive',
      billingPlan: null,
      billingProvider: 'culqi',
      billingCurrency: null,
      billingPeriodEnd: null,
      billingCustomerId: null,
      billingSubscriptionId: null,
    });

    const savedUser = await this.userRepository.save(user);
    await this.rateLimitService.resetAttempts(this.buildBruteForceIdentifier(dto.email.toLowerCase(), request));
    const session = await this.createSession(savedUser);
    return this.buildSessionResponse(savedUser, session.token);
  }

  async login(dto: LoginDto, request?: { ip?: string }) {
    const identifier = this.buildBruteForceIdentifier(dto.email.toLowerCase(), request);
    const lockout = await this.rateLimitService.isBlocked(identifier);
    if (lockout) {
      const remaining = await this.rateLimitService.getBlockRemaining(identifier);
      throw new UnauthorizedException({
        message: 'Cuenta bloqueada temporalmente por multiples intentos fallidos. Intenta mas tarde.',
        retryAfterMs: remaining,
      });
    }

    const user = await this.userRepository.findOne({ where: { email: dto.email.toLowerCase() } });
    if (!user || !user.isActive || !this.verifyPassword(dto.password, user.passwordHash)) {
      const failed = await this.rateLimitService.recordFailedAttempt(identifier, 5, 10 * 60 * 1000);
      throw new UnauthorizedException({
        message: 'Credenciales invalidas',
        remainingAttempts: failed.remainingAttempts,
        retryAfterMs: failed.retryAfterMs,
      });
    }

    await this.rateLimitService.resetAttempts(identifier);

    const session = await this.createSession(user);
    return this.buildSessionResponse(user, session.token);
  }

  async createGuestSession(request?: { ip?: string }) {
    const identifier = this.buildGuestIdentifier(request);
    const lockout = await this.rateLimitService.isBlocked(identifier);
    if (lockout) {
      const remaining = await this.rateLimitService.getBlockRemaining(identifier);
      throw new UnauthorizedException({
        message: 'Demasiadas sesiones de invitado. Intenta mas tarde.',
        retryAfterMs: remaining,
      });
    }

    const failed = await this.rateLimitService.recordFailedAttempt(identifier, 10, 60 * 60 * 1000);
    if (failed.blocked) {
      throw new UnauthorizedException({
        message: 'Demasiadas sesiones de invitado. Intenta mas tarde.',
        retryAfterMs: failed.retryAfterMs,
      });
    }
    const email = `guest-${randomUUID()}@guest.sinbarreras.local`;
    const guestUser = this.userRepository.create({
      email,
      passwordHash: this.hashPassword(randomBytes(24).toString('hex')),
      fullName: 'Invitado',
      companyName: 'Sin Barreras',
      role: 'guest',
      isActive: true,
      billingStatus: 'inactive',
      billingPlan: null,
      billingProvider: 'culqi',
      billingCurrency: null,
      billingPeriodEnd: null,
      billingCustomerId: null,
      billingSubscriptionId: null,
    });

    const savedUser = await this.userRepository.save(guestUser);
    const session = await this.createSession(savedUser);
    return this.buildSessionResponse(savedUser, session.token);
  }

  async me(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Sesion invalida');
    if (this.normalizeRole(user.role) !== user.role) {
      user.role = this.normalizeRole(user.role);
      await this.userRepository.save(user);
    }
    return this.serializeUser(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sesion invalida');
    }

    if (!this.verifyPassword(dto.currentPassword, user.passwordHash)) {
      throw new UnauthorizedException('La contrasena actual no es valida');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('La nueva contrasena debe ser distinta a la actual');
    }

    user.passwordHash = this.hashPassword(dto.newPassword);
    await this.userRepository.save(user);

    return { ok: true };
  }

  async validateSessionToken(token: string) {
    const tokenHash = this.hashToken(token);
    const session = await this.sessionRepository.findOne({
      where: {
        tokenHash,
      },
      relations: { user: true },
    });

    if (!session || session.expiresAt.getTime() <= Date.now() || !session.user.isActive) {
      return null;
    }

    return session;
  }

  async revokeSession(token: string) {
    const tokenHash = this.hashToken(token);
    await this.sessionRepository.delete({ tokenHash });
  }

  buildFrontendSessionRedirect(token: string, provider: OAuthProvider) {
    const frontendUrl = new URL(this.getFrontendUrl());
    frontendUrl.hash = new URLSearchParams({
      session_token: token,
      provider,
    }).toString();
    return frontendUrl.toString();
  }

  buildFrontendOAuthErrorRedirect(provider: OAuthProvider, message: string) {
    const frontendUrl = new URL(this.getFrontendUrl());
    frontendUrl.hash = new URLSearchParams({
      oauth_error: message,
      provider,
    }).toString();
    return frontendUrl.toString();
  }

  private async createSession(user: User) {
    const token = randomBytes(32).toString('hex');
    const ttlDays = this.getSessionTtlDays();
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    const session = this.sessionRepository.create({
      tokenHash: this.hashToken(token),
      expiresAt,
      user,
    });

    const savedSession = await this.sessionRepository.save(session);
    return { session: savedSession, token };
  }

  private serializeUser(user: User) {
    const role = this.normalizeRole(user.role);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      companyName: user.companyName,
      role,
      createdAt: user.createdAt,
      billingStatus: user.billingStatus,
      billingPlan: user.billingPlan,
      billingProvider: user.billingProvider,
      billingCurrency: user.billingCurrency,
      billingPeriodEnd: user.billingPeriodEnd ? user.billingPeriodEnd.toISOString() : null,
      billingCustomerId: user.billingCustomerId,
      billingSubscriptionId: user.billingSubscriptionId,
    };
  }

  private buildSessionResponse(user: User, token: string) {
    return {
      token,
      user: this.serializeUser(user),
    };
  }

  private getOAuthConfig(provider: OAuthProvider): OAuthProviderConfig {
    if (provider === 'google') {
      const clientId = this.configService.get<string>('GOOGLE_OAUTH_CLIENT_ID')?.trim() || '';
      const clientSecret = this.configService.get<string>('GOOGLE_OAUTH_CLIENT_SECRET')?.trim() || '';
      const redirectUri = this.configService.get<string>('GOOGLE_OAUTH_REDIRECT_URI')?.trim() || '';
      return {
        enabled: Boolean(clientId && clientSecret && redirectUri),
        name: 'Google',
        clientId,
        clientSecret,
        redirectUri,
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scope: 'openid email profile',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        extraParams: {
          access_type: 'offline',
          include_granted_scopes: 'true',
          prompt: 'select_account',
        },
      };
    }

    const clientId = this.configService.get<string>('MICROSOFT_OAUTH_CLIENT_ID')?.trim() || '';
    const clientSecret = this.configService.get<string>('MICROSOFT_OAUTH_CLIENT_SECRET')?.trim() || '';
    const redirectUri = this.configService.get<string>('MICROSOFT_OAUTH_REDIRECT_URI')?.trim() || '';
    const tenantId = this.configService.get<string>('MICROSOFT_OAUTH_TENANT_ID')?.trim() || 'common';
    return {
      enabled: Boolean(clientId && clientSecret && redirectUri),
      name: 'Microsoft',
      clientId,
      clientSecret,
      redirectUri,
      authorizationUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
      tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      scope: 'openid email profile offline_access User.Read',
      userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    };
  }

  private signOAuthState(provider: OAuthProvider) {
    const payload: OAuthStatePayload = {
      provider,
      nonce: randomBytes(16).toString('hex'),
      issuedAt: Date.now(),
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const secret = this.getOAuthStateSecret();
    const signature = createHmac('sha256', secret).update(encodedPayload).digest('hex');
    return `${encodedPayload}.${signature}`;
  }

  private verifyOAuthState(provider: OAuthProvider, state: string) {
    const [encodedPayload, signature] = state.split('.');
    if (!encodedPayload || !signature) {
      throw new UnauthorizedException('Estado OAuth invalido');
    }

    const secret = this.getOAuthStateSecret();
    const expectedSignature = createHmac('sha256', secret).update(encodedPayload).digest('hex');
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
      throw new UnauthorizedException('Estado OAuth invalido');
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as OAuthStatePayload;
    if (payload.provider !== provider) {
      throw new UnauthorizedException('Proveedor OAuth invalido');
    }

    if (Date.now() - payload.issuedAt > OAUTH_STATE_TTL_MS) {
      throw new UnauthorizedException('La autorizacion expiro');
    }
  }

  private async exchangeOAuthCode(config: OAuthProviderConfig, code: string) {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    });

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      throw new UnauthorizedException('No se pudo completar el inicio de sesion social');
    }

    return (await response.json()) as { access_token: string };
  }

  private async fetchOAuthProfile(config: OAuthProviderConfig, accessToken: string): Promise<OAuthProviderProfile> {
    const response = await fetch(config.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new UnauthorizedException('No se pudo leer el perfil social');
    }

    const profile = await response.json();

    if (config.userInfoUrl.includes('googleapis')) {
      return {
        email: typeof profile.email === 'string' ? profile.email : null,
        fullName: typeof profile.name === 'string' ? profile.name : null,
        emailVerified: profile.email_verified === true,
      };
    }

    return {
      email:
        (typeof profile.mail === 'string' && profile.mail.trim()) ||
        (typeof profile.userPrincipalName === 'string' && profile.userPrincipalName.trim()) ||
        (Array.isArray(profile.otherMails) && typeof profile.otherMails[0] === 'string' ? profile.otherMails[0].trim() : null) ||
        null,
      fullName: typeof profile.displayName === 'string' ? profile.displayName : null,
    };
  }

  private getOAuthStateSecret() {
    return (
      this.configService.get<string>('OAUTH_STATE_SECRET')?.trim() ||
      this.configService.get<string>('API_AUTH_TOKEN')?.trim() ||
      process.env.OAUTH_STATE_SECRET?.trim() ||
      process.env.API_AUTH_TOKEN?.trim() ||
      'sin-barreras-oauth-state-dev'
    );
  }

  private getFrontendUrl() {
    return this.configService.get<string>('FRONTEND_URL')?.trim() || process.env.FRONTEND_URL?.trim() || 'http://localhost:5173';
  }

  private buildBruteForceIdentifier(email: string, request?: { ip?: string }): string {
    const ip = request?.ip || 'unknown';
    return `email:${createHash('sha256').update(email.toLowerCase().trim()).digest('hex')}:ip:${ip}`;
  }

  private buildGuestIdentifier(request?: { ip?: string }): string {
    const ip = request?.ip || 'unknown';
    return `guest:ip:${ip}`;
  }
}
