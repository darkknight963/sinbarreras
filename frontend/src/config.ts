const isDev = import.meta.env.DEV;
const runtimeHostname = typeof window === 'undefined' ? '' : window.location.hostname;
const runtimeOrigin = typeof window === 'undefined' ? '' : window.location.origin;

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

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL?.trim() ||
  (isDev || isLocalRuntimeHost(runtimeHostname) ? API_FALLBACK_BASE_URL : runtimeOrigin);

export const SOCKET_PATH =
  import.meta.env.VITE_SOCKET_PATH?.trim() || '/socket.io';

export const CULQI_PUBLIC_KEY =
  import.meta.env.VITE_CULQI_PUBLIC_KEY?.trim() || '';
