const isDev = import.meta.env.DEV;
const runtimeHostname = typeof window === 'undefined' ? '' : window.location.hostname;

export const isLocalRuntimeHost = (hostname: string) =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '0.0.0.0' ||
  hostname === '::1' ||
  hostname === '[::1]';

export const API_FALLBACK_BASE_URL =
  import.meta.env.VITE_API_FALLBACK_BASE_URL?.trim() || 'http://localhost:3000';

export const resolveApiBaseUrl = (
  configuredApiBaseUrl: string | undefined,
  isDevelopment: boolean,
  hostname: string,
) => {
  const configured = configuredApiBaseUrl?.trim();
  const localRuntime = isDevelopment || isLocalRuntimeHost(hostname);

  if (configured && !(localRuntime && configured === '/api')) {
    return configured;
  }

  return localRuntime ? API_FALLBACK_BASE_URL : '/api';
};

export const API_BASE_URL = resolveApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
  isDev,
  runtimeHostname,
);

// SOCKET_URL must point directly to the API server (Railway), never to the Vercel frontend.
// Vercel cannot proxy WebSocket upgrades. Set VITE_SOCKET_URL in Vercel env vars.
export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL?.trim() ||
  (isDev || isLocalRuntimeHost(runtimeHostname)
    ? API_FALLBACK_BASE_URL
    : 'https://sinbarreras-production.up.railway.app');

export const SOCKET_PATH =
  import.meta.env.VITE_SOCKET_PATH?.trim() || '/socket.io';

export const CHROME_EXTENSION_ID =
  import.meta.env.VITE_EXTENSION_ID?.trim() || 'bipiiijphpkdbodephdbahlkdcnopjao';
