import type { APIContext, AstroGlobal } from 'astro';
import type { ProfileRow, UserRole } from '@luxus/shared';

type Ctx = AstroGlobal | APIContext;

export interface SessionContext {
  userId: string;
  email: string;
  profile: ProfileRow;
  accessToken: string;
}

/**
 * Exige sesión. Devuelve un `Response` de redirección cuando no la hay, para
 * que la página pueda hacer `if (guard instanceof Response) return guard;`.
 */
export function requireSession(
  context: Ctx,
): SessionContext | Response {
  const session = context.locals.session;
  if (!session) {
    const redirectTo = encodeURIComponent(context.url.pathname + context.url.search);
    return context.redirect(`/auth/login?next=${redirectTo}`, 302);
  }
  if (session.profile.is_suspended) {
    return context.redirect('/auth/suspended', 302);
  }
  return session;
}

export function requireRole(context: Ctx, ...roles: UserRole[]): SessionContext | Response {
  const session = requireSession(context);
  if (session instanceof Response) return session;
  if (!roles.includes(session.profile.role)) {
    return context.redirect('/dashboard?error=forbidden', 302);
  }
  return session;
}

/** Nivel II: exige KYC aprobado. Redirige al wizard si falta. */
export function requireVerified(context: Ctx): SessionContext | Response {
  const session = requireSession(context);
  if (session instanceof Response) return session;
  if (session.profile.role === 'admin') return session;
  if (session.profile.kyc_status !== 'approved') {
    return context.redirect('/onboarding/kyc?required=1', 302);
  }
  return session;
}

export function isAdmin(session: SessionContext | null): boolean {
  return session?.profile.role === 'admin';
}

export function canSell(session: SessionContext | null): boolean {
  return session ? ['seller', 'broker', 'admin'].includes(session.profile.role) : false;
}
