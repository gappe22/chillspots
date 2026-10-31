import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { ApiError } from '@/shared/types';

const explicitOrigin = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
function apiOrigin() {
  if (explicitOrigin) return explicitOrigin;
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && ['8081', '8083', '19006'].includes(window.location.port)) return `${window.location.protocol}//${window.location.hostname}:3001`;
    return '';
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:3001`;
}
let token: string | null = null;
export function setApiToken(value: string | null) { token = value; }
export class RequestError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); }
}

export async function api<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${apiOrigin()}/api${path}`, {
      method, credentials: 'include', signal: controller.signal,
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = response.status === 204 ? undefined : await response.json();
    if (!response.ok) {
      const detail = (data as ApiError)?.error;
      throw new RequestError(detail?.message ?? 'Non è stato possibile completare la richiesta.', response.status, detail?.code ?? 'REQUEST_FAILED');
    }
    return data as T;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError('Connessione non disponibile. Riprova tra poco.', 0, 'NETWORK_ERROR');
  } finally { clearTimeout(timer); }
}
