import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type CulqiRequestInit = RequestInit & { body?: string };

@Injectable()
export class CulqiClient {
  private readonly baseUrl: string;
  private readonly secretKey: string;
  private readonly publicKey: string;

  constructor(configService: ConfigService) {
    this.baseUrl = configService.get<string>('CULQI_API_BASE_URL', 'https://api.culqi.com/v2');
    this.secretKey = configService.get<string>('CULQI_SECRET_KEY', '').trim();
    this.publicKey = configService.get<string>('CULQI_PUBLIC_KEY', '').trim();
  }

  getPublicKey() {
    return this.publicKey;
  }

  async createCustomer(payload: Record<string, unknown>) {
    return this.request('/customers', { method: 'POST', body: JSON.stringify(payload) });
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

  private async request(path: string, init: CulqiRequestInit) {
    if (!this.secretKey) {
      throw new Error('Falta configurar CULQI_SECRET_KEY');
    }

    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${this.secretKey}`);
    headers.set('Content-Type', 'application/json');

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (response.status === 204) {
      return null;
    }

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = typeof data?.merchant_message === 'string'
        ? data.merchant_message
        : typeof data?.user_message === 'string'
          ? data.user_message
          : `Culqi request failed with HTTP ${response.status}`;
      throw new Error(message);
    }

    return data;
  }
}
