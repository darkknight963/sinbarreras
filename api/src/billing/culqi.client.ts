import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as forge from 'node-forge';

type CulqiRequestInit = RequestInit & { body?: string };

// Endpoints que requieren body encriptado con RSA Backend Key
const RSA_REQUIRED_PATHS = ['/customers', '/cards', '/subscriptions', '/plans'];

@Injectable()
export class CulqiClient {
  private readonly baseUrl: string;
  private readonly secretKey: string;
  private readonly publicKey: string;
  private readonly rsaPublicKey: string;
  private readonly rsaKeyId: string;

  constructor(configService: ConfigService) {
    this.baseUrl = this.normalizeBaseUrl(
      configService.get<string>('CULQI_API_BASE_URL', 'https://api.culqi.com/v2'),
    );
    this.secretKey = configService.get<string>('CULQI_SECRET_KEY', '').trim();
    this.publicKey = configService.get<string>('CULQI_PUBLIC_KEY', '').trim();
    this.rsaPublicKey = configService.get<string>('CULQI_RSA_PUBLIC_KEY', '').trim();
    this.rsaKeyId = configService.get<string>('CULQI_RSA_KEY_ID', '').trim();
  }

  getPublicKey() {
    return this.publicKey;
  }

  async createCustomer(payload: Record<string, unknown>) {
    return this.request('/customers', { method: 'POST', body: JSON.stringify(payload) });
  }

  async findCustomerByEmail(email: string): Promise<{ id: string } | null> {
    try {
      const data = await this.request(`/customers?email=${encodeURIComponent(email)}`, { method: 'GET' });
      const items: Array<{ id: string }> = data?.data ?? data?.items ?? [];
      return items.length > 0 ? items[0] : null;
    } catch {
      return null;
    }
  }

  async createCard(payload: Record<string, unknown>) {
    return this.request('/cards', { method: 'POST', body: JSON.stringify(payload) });
  }

  async createSubscription(payload: Record<string, unknown>) {
    return this.request('/subscriptions', { method: 'POST', body: JSON.stringify(payload) });
  }

  async getPlan(planId: string) {
    return this.request(`/plans/${planId}`, { method: 'GET' });
  }

  async cancelSubscription(subscriptionId: string) {
    return this.request(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
  }

  private encryptWithRsa(plaintext: string): string {
    const publicKey = forge.pki.publicKeyFromPem(this.rsaPublicKey);
    const encrypted = publicKey.encrypt(plaintext, 'RSA-OAEP', {
      md: forge.md.sha256.create(),
      mgf1: { md: forge.md.sha256.create() },
    });
    return forge.util.encode64(encrypted);
  }

  private needsRsa(path: string, method: string): boolean {
    if (!this.rsaPublicKey || !this.rsaKeyId) return false;
    if (method === 'GET' || method === 'DELETE') return false;
    return RSA_REQUIRED_PATHS.some((p) => path.startsWith(p));
  }

  private async request(path: string, init: CulqiRequestInit) {
    if (!this.secretKey) {
      throw new Error('Falta configurar CULQI_SECRET_KEY');
    }

    const method = init.method || 'GET';
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${this.secretKey}`);

    let body = init.body;

    if (body && this.needsRsa(path, method)) {
      try {
        const encrypted = this.encryptWithRsa(body);
        body = JSON.stringify({ encrypted_data: encrypted });
        headers.set('Content-Type', 'application/json');
        headers.set('x-culqi-rsa-id', this.rsaKeyId);
      } catch (err) {
        console.warn('[CulqiClient] RSA encryption failed, sending plain:', err);
        headers.set('Content-Type', 'application/json');
      }
    } else {
      headers.set('Content-Type', 'application/json');
    }

    const requestUrl = `${this.baseUrl}${path}`;
    console.log(`[CulqiClient] ${method} ${requestUrl}`, init.body ? JSON.parse(init.body) : '');

    const response = await fetch(requestUrl, { ...init, body, headers });

    if (response.status === 204) {
      return null;
    }

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.error(`[CulqiClient] ERROR ${response.status} ${requestUrl}`, JSON.stringify(data));
      const message = typeof data?.merchant_message === 'string'
        ? data.merchant_message
        : typeof data?.user_message === 'string'
          ? data.user_message
          : `Culqi request failed with HTTP ${response.status}`;
      throw new Error(`${message} [${method} ${path} -> ${requestUrl}]`);
    }

    return data;
  }

  private normalizeBaseUrl(value: string | undefined) {
    const normalized = (value || 'https://api.culqi.com/v2').trim().replace(/\/+$/, '');
    return normalized || 'https://api.culqi.com/v2';
  }
}
