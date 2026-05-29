const isDev = import.meta.env.DEV;

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  (isDev ? 'http://localhost:3000' : '/api');

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL?.trim() ||
  (isDev ? 'http://localhost:3000' : window.location.origin);

export const SOCKET_PATH =
  import.meta.env.VITE_SOCKET_PATH?.trim() || '/socket.io';

export const API_FALLBACK_BASE_URL =
  import.meta.env.VITE_API_FALLBACK_BASE_URL?.trim() || 'http://localhost:3000';
