import { API_URL } from './env';

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Access token de Supabase. En el navegador se resuelve solo. */
  token?: string | null;
  signal?: AbortSignal;
}

/**
 * Cliente de la API Fastify.
 *
 * Todo lo que exige comprobaciones que Supabase no puede hacer por sí solo
 * (marca de agua, verificación NDA + permiso, firma electrónica, pagos)
 * pasa por aquí. Las lecturas de catálogo van directas a Supabase con RLS.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };

  const token = options.token ?? (await resolveBrowserToken());
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const error = (payload as { error?: ApiErrorShape })?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'request_failed',
      error?.message ?? 'No se pudo completar la operación.',
      error?.details,
    );
  }

  return payload as T;
}

async function resolveBrowserToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const { browserClient } = await import('./supabase');
  const { data } = await browserClient().auth.getSession();
  return data.session?.access_token ?? null;
}
