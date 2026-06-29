import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

type CulqiRequestInit = RequestInit & { body?: string };

// Endpoints que requieren body encriptado con RSA Backend Key en CulqiOnline.
// La RSA Key del panel tiene habilitados: cards, plans, subscriptions, customers.
// Customers y cards funcionan sin RSA, pero plans y subscriptions la EXIGEN.
const RSA_REQUIRED_PATHS = ['/plans', '/subscriptions', '/cards', '/customers'];

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
    const rawRsaKey = configService.get<string>('CULQI_RSA_PUBLIC_KEY', '') || '';
    this.rsaPublicKey = this.normalizeRsaKey(rawRsaKey);
    this.rsaKeyId = configService.get<string>('CULQI_RSA_KEY_ID', '').trim();
    // Diagnóstico de arranque: verificar que el PEM llegue bien formado.
    console.log('[CulqiClient] init RSA key:', {
      rawLen: rawRsaKey.length,
      rawFirst20: rawRsaKey.slice(0, 20),
      normalizedLines: this.rsaPublicKey.split('\n').length,
      normalizedHeader: this.rsaPublicKey.split('\n')[0],
      normalizedFooter: this.rsaPublicKey.split('\n').at(-1),
    });
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
    // Replica exacta del SDK oficial culqi-php (openssl), usando el módulo
    // crypto nativo de Node (también openssl) en vez de node-forge, para
    // garantizar compatibilidad de padding RSA-OAEP+SHA256 con Culqi:
    // 1. AES-256-GCM con key de 32 bytes y IV de 16 bytes.
    // 2. encrypted_data = base64(ciphertext || authTag). GCM REQUIERE el tag
    //    para desencriptar, así que se anexa al final del ciphertext (formato
    //    estándar openssl); Culqi lo separa al desencriptar.
    // 3. AES key e IV se encriptan por separado con RSA-OAEP (hash y MGF1 SHA256).
    // 4. Body: { encrypted_data, encrypted_key, encrypted_iv } (todo base64).
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const dataWithTag = Buffer.concat([ciphertext, authTag]);

    const oaepOptions = {
      key: this.rsaPublicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    } as const;
    const encryptedKey = crypto.publicEncrypt(oaepOptions, aesKey);
    const encryptedIv = crypto.publicEncrypt(oaepOptions, iv);

    console.log('[CulqiClient] RSA debug:', {
      rsaKeyHeader: this.rsaPublicKey.split('\n')[0],
      rsaKeyLines: this.rsaPublicKey.split('\n').length,
      rsaKeyFooter: this.rsaPublicKey.split('\n').at(-1),
      rsaKeyId: this.rsaKeyId,
      encDataBytes: dataWithTag.length,
      encKeyBytes: encryptedKey.length,
      encIvBytes: encryptedIv.length,
    });

    return JSON.stringify({
      encrypted_data: dataWithTag.toString('base64'),
      encrypted_key: encryptedKey.toString('base64'),
      encrypted_iv: encryptedIv.toString('base64'),
    });
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
        body = this.encryptWithRsa(body);
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

  // Reconstruye el PEM desde cero extrayendo el contenido base64 puro.
  // Tolera: comillas envolventes, \n literales, CRLF, espacios extra.
  // Garantiza que crypto.publicEncrypt reciba un PEM bien formado sin importar
  // cómo Railway almacene la variable de entorno.
  private normalizeRsaKey(raw: string): string {
    let key = raw.trim();
    // Quitar comillas envolventes (Railway a veces las incluye).
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
      key = key.slice(1, -1);
    }
    // Expandir \n literales y normalizar CRLF.
    key = key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();

    // Extraer el bloque base64 puro y reconstruir el PEM.
    // Esto protege contra cualquier variante de formato que Railway entregue.
    const b64 = key
      .replace(/-----BEGIN PUBLIC KEY-----/, '')
      .replace(/-----END PUBLIC KEY-----/, '')
      .replace(/\s+/g, '');

    if (!b64) return key;

    // Partir en líneas de 64 chars (formato PEM estándar).
    const lines = b64.match(/.{1,64}/g) ?? [];
    return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
  }
}
