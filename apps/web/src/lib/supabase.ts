import type { AstroCookies } from 'astro';
import {
  createLuxusAnonClient, createLuxusBrowserClient, createLuxusServerClient,
  type LuxusClient,
} from '@luxus/shared';
import { supabaseConfig } from './env';

/**
 * Cliente de servidor ligado a las cookies de la petición.
 *
 * Todo lo que lea pasa por RLS: si el visitante es anónimo, solo alcanza el
 * Nivel I por construcción, no por disciplina del código de la página.
 *
 * Supabase fragmenta la sesión en varias cookies (`sb-…-auth-token.0`, `.1`),
 * así que hay que leerlas todas de la cabecera entrante, no una a una.
 */
export function serverClient(request: Request, cookies: AstroCookies): LuxusClient {
  return createLuxusServerClient(supabaseConfig, {
    getAll: () => parseCookieHeader(request.headers.get('cookie')),
    setAll: (records) => {
      for (const { name, value, options } of records) {
        cookies.set(name, value, {
          ...options,
          path: options?.path ?? '/',
          httpOnly: options?.httpOnly ?? true,
          sameSite: (options?.sameSite as 'lax' | 'strict' | 'none' | undefined) ?? 'lax',
          secure: options?.secure ?? import.meta.env.PROD,
        });
      }
    },
  });
}

export function parseCookieHeader(header: string | null): { name: string; value: string }[] {
  if (!header) return [];
  return header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf('=');
      const name = index === -1 ? part : part.slice(0, index);
      const value = index === -1 ? '' : decodeURIComponent(part.slice(index + 1));
      return { name, value };
    });
}

/** Cliente sin sesión para render público (Nivel I). */
export function anonClient(): LuxusClient {
  return createLuxusAnonClient(supabaseConfig);
}

/** Cliente de navegador, compartido por todas las islas de React. */
let browser: LuxusClient | null = null;
export function browserClient(): LuxusClient {
  browser ??= createLuxusBrowserClient(supabaseConfig);
  return browser;
}
