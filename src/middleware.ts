import { defineMiddleware } from 'astro:middleware';
import type { ProfileRow } from '@luxus/shared';
import { serverClient } from './lib/supabase';

/** Prefijos que nunca deben indexarse ni cachearse. */
const PRIVATE_PREFIXES = ['/dashboard', '/admin', '/deal', '/onboarding', '/auth'];

/**
 * Supabase parte la sesión en cookies `sb-<ref>-auth-token` (o `.0`/`.1` si
 * el JWT no cabe en una sola). Si ninguna está presente, el visitante es
 * anónimo con certeza: no hay token que validar, así que no hace falta
 * llamar a Supabase Auth para saberlo.
 */
function hasAuthCookie(request: Request): boolean {
  const header = request.headers.get('cookie');
  return !!header && /(?:^|;\s*)sb-[^=;]*-auth-token/.test(header);
}

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = serverClient(context.request, context.cookies);
  context.locals.supabase = supabase;
  context.locals.session = null;

  // getUser() valida el token contra Supabase Auth (una llamada de red) y
  // getSession() se limita a leer la cookie, así que no sirve para decidir
  // permisos en servidor. Pero en la enorme mayoría de las visitas públicas
  // no hay ninguna cookie de sesión: nos ahorramos esa llamada de red en
  // cada navegación cuando ya sabemos que no puede haber usuario logueado.
  const userData = hasAuthCookie(context.request)
    ? (await supabase.auth.getUser()).data
    : { user: null };

  if (userData.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (profile) {
      const { data: sessionData } = await supabase.auth.getSession();
      context.locals.session = {
        userId: userData.user.id,
        email: profile.email,
        profile: profile as ProfileRow,
        accessToken: sessionData.session?.access_token ?? '',
      };
    }
  }

  const response = await next();

  const isPrivate = PRIVATE_PREFIXES.some((p) => context.url.pathname.startsWith(p));
  if (isPrivate) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  }

  // Cabeceras de seguridad para todo el sitio.
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  );

  return response;
});
