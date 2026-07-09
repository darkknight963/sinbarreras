import { API_BASE_URL, API_FALLBACK_BASE_URL, isLocalRuntimeHost } from '../config';

// Base URL mutable: en desarrollo local, si el proxy /api no responde se cae
// al fallback directo (localhost:3000). Vive aquí como estado de módulo para
// que todos los consumidores compartan la misma decisión.
let runtimeApiBaseUrl = API_BASE_URL;

export const apiUrl = (path: string) => `${runtimeApiBaseUrl}${path}`;

// La sesión viaja en una cookie httpOnly establecida por el servidor.
// El navegador la envía automáticamente con credentials: 'include' — el frontend
// nunca lee ni escribe el token directamente.
const withAuthHeaders = (headers?: HeadersInit): HeadersInit => new Headers(headers);

export const fetchWithFallback = async (path: string, init?: RequestInit) => {
  const requestInit: RequestInit = {
    ...init,
    headers: withAuthHeaders(init?.headers),
    credentials: 'include', // envía la cookie httpOnly sb_session automáticamente
  };
  const first = await fetch(apiUrl(path), requestInit);

  if (
    first.status === 404 &&
    runtimeApiBaseUrl === '/api' &&
    isLocalRuntimeHost(window.location.hostname)
  ) {
    runtimeApiBaseUrl = API_FALLBACK_BASE_URL;
    return fetch(apiUrl(path), requestInit);
  }

  return first;
};

export const readApiErrorMessage = async (res: Response) => {
  const fallback = `HTTP ${res.status}`;

  try {
    const body = await res.clone().json();
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    return message || body?.error || body?.detail || fallback;
  } catch {
    const text = await res.text();
    return text || fallback;
  }
};

export const normalizeApiErrorDetail = (message: string) => {
  const trimmed = message.trim();
  if (!trimmed) return '';

  try {
    const body = JSON.parse(trimmed) as {
      message?: string | string[];
      error?: string;
      detail?: string;
      remainingAttempts?: number;
      retryAfterMs?: number;
    };
    const primaryMessage = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    const detail = primaryMessage || body?.error || body?.detail || trimmed;
    const metadata: string[] = [];

    if (typeof body?.remainingAttempts === 'number') {
      metadata.push(`Intentos restantes: ${body.remainingAttempts}.`);
    }

    if (typeof body?.retryAfterMs === 'number' && body.retryAfterMs > 0) {
      const retryAfterMinutes = Math.ceil(body.retryAfterMs / 60000);
      metadata.push(`Reintenta en ${retryAfterMinutes} min.`);
    }

    return [detail, ...metadata].join(' ').trim();
  } catch {
    return trimmed;
  }
};

export const readApiJson = async <T,>(res: Response): Promise<T | null> => {
  const text = await res.text();
  if (!text.trim()) return null;
  return JSON.parse(text) as T;
};
