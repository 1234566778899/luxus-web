import { useState } from 'react';
import { browserClient } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';

interface Props {
  next: string;
}

type Phase = 'credentials' | 'mfa' | 'enrolling';

/**
 * Si `next` es el destino genérico por defecto (el visitante llegó a
 * /auth/login sin un enlace profundo previo), un admin va a su propio panel
 * en vez del dashboard de comprador/vendedor. Un `next` explícito (por
 * ejemplo, rebotado desde una página protegida) siempre se respeta tal cual.
 */
async function resolveDestination(next: string): Promise<string> {
  if (next !== '/dashboard') return next;
  const { data } = await browserClient().auth.getUser();
  if (!data.user) return next;
  const { data: profile } = await browserClient()
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();
  return profile?.role === 'admin' ? '/admin' : next;
}

/**
 * Login con MFA (TOTP).
 *
 * Supabase concede la sesión con `aal1` tras la contraseña; el segundo factor
 * la eleva a `aal2`. Si el usuario tiene un factor verificado, aquí no se
 * continúa hasta completarlo — la sesión existe, pero la zona privada
 * comprueba el nivel antes de dar acceso a información reservada.
 */
export default function LoginForm({ next }: Props) {
  const [phase, setPhase] = useState<Phase>('credentials');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [enrollQr, setEnrollQr] = useState<{ qr: string; secret: string } | null>(null);

  // `browserClient()` construye un cliente que solo puede vivir en el
  // navegador (lee/escribe la sesión vía `document.cookie`). Astro
  // server-renderiza el HTML inicial de esta isla antes de hidratarla, así
  // que llamarlo aquí arriba —fuera de un manejador— lo ejecutaría también
  // en el servidor y rompía la página con "Internal server error". Se llama
  // dentro de cada función en su lugar; el propio `browserClient()` cachea
  // la instancia, así que repetir la llamada no tiene costo real.
  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);

    const supabase = browserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: String(form.get('email') ?? '').trim().toLowerCase(),
      password: String(form.get('password') ?? ''),
    });

    if (signInError) {
      setBusy(false);
      setError(
        signInError.message.includes('Invalid login')
          ? 'Credenciales no válidas.'
          : signInError.message,
      );
      return;
    }

    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = factors?.totp?.find((f) => f.status === 'verified');

    if (verified) {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: verified.id });

      setBusy(false);

      if (challengeError || !challenge) {
        setError('No se pudo iniciar la verificación en dos pasos.');
        return;
      }

      setFactorId(verified.id);
      setChallengeId(challenge.id);
      setPhase('mfa');
      return;
    }

    // Sin segundo factor: la plataforma lo exige, así que se inscribe ahora.
    const { data: enroll, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'LUXUS PERÚ',
    });

    setBusy(false);

    if (enrollError || !enroll) {
      setError('No se pudo iniciar la inscripción del segundo factor.');
      return;
    }

    setFactorId(enroll.id);
    setEnrollQr({ qr: enroll.totp.qr_code, secret: enroll.totp.secret });
    setPhase('enrolling');
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId) return;

    const form = new FormData(event.currentTarget);
    const code = String(form.get('code') ?? '').trim();
    setBusy(true);
    setError(null);

    const supabase = browserClient();
    let currentChallenge = challengeId;
    if (!currentChallenge) {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError || !challenge) {
        setBusy(false);
        setError('No se pudo generar el desafío de verificación.');
        return;
      }
      currentChallenge = challenge.id;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: currentChallenge,
      code,
    });

    if (verifyError) {
      setBusy(false);
      setChallengeId(null);
      setError('El código no es válido o ha expirado. Inténtelo de nuevo.');
      return;
    }

    // Registra la sesión para poder cerrarla en remoto desde el perfil.
    await apiFetch('/v1/me/sessions/heartbeat', {
      method: 'POST',
      body: { device_label: navigator.platform || undefined },
    }).catch(() => {});

    window.location.href = await resolveDestination(next);
  }

  if (phase === 'enrolling' && enrollQr) {
    return (
      <div>
        <div className="border border-gold bg-ivory p-5">
          <p className="text-[13px] leading-relaxed text-ink-muted">
            La verificación en dos pasos es obligatoria. Escanee este código con
            su aplicación de autenticación y confirme con el código generado.
          </p>
        </div>

        <div className="mt-7 flex justify-center border border-stone bg-white p-6">
          <img src={enrollQr.qr} alt="Código QR para la aplicación de autenticación" className="h-44 w-44" />
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-[12px] uppercase tracking-luxus text-ink-muted">
            No puedo escanear el código
          </summary>
          <p className="mt-3 select-all break-all border border-stone bg-ivory px-4 py-3 font-mono text-[13px]">
            {enrollQr.secret}
          </p>
        </details>

        <form onSubmit={verifyCode} className="mt-8 space-y-5">
          <div>
            <label className="label" htmlFor="enroll-code">Código de verificación</label>
            <input
              id="enroll-code" name="code" inputMode="numeric" pattern="[0-9]{6}"
              maxLength={6} required autoFocus autoComplete="one-time-code"
              className="field text-center font-mono text-[22px] tracking-[0.5em]"
              placeholder="000000"
            />
          </div>

          {error && (
            <p role="alert" className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-[13px] text-red-800">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Verificando…' : 'Activar y continuar'}
          </button>
        </form>
      </div>
    );
  }

  if (phase === 'mfa') {
    return (
      <form onSubmit={verifyCode} className="space-y-5">
        <div>
          <label className="label" htmlFor="mfa-code">Código de verificación</label>
          <input
            id="mfa-code" name="code" inputMode="numeric" pattern="[0-9]{6}"
            maxLength={6} required autoFocus autoComplete="one-time-code"
            className="field text-center font-mono text-[22px] tracking-[0.5em]"
            placeholder="000000"
          />
          <p className="mt-2.5 text-[12px] text-ink-muted">
            Introduzca el código de seis dígitos de su aplicación de autenticación.
          </p>
        </div>

        {error && (
          <p role="alert" className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-[13px] text-red-800">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? 'Verificando…' : 'Verificar'}
        </button>

        <button
          type="button"
          onClick={async () => {
            await browserClient().auth.signOut();
            setPhase('credentials');
            setError(null);
          }}
          className="w-full text-[12px] uppercase tracking-luxus text-ink-muted hover:text-ink"
        >
          Usar otra cuenta
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={signIn} className="space-y-5">
      <div>
        <label className="label" htmlFor="login-email">Correo electrónico</label>
        <input
          id="login-email" name="email" type="email" required autoFocus
          autoComplete="email" className="field"
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label className="label" htmlFor="login-password">Contraseña</label>
          <a href="/auth/forgot" className="mb-2 text-[11px] uppercase tracking-luxus text-ink-muted hover:text-ink">
            ¿Olvidó su contraseña?
          </a>
        </div>
        <input
          id="login-password" name="password" type="password" required
          autoComplete="current-password" className="field"
        />
      </div>

      {error && (
        <p role="alert" className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? 'Accediendo…' : 'Acceder'}
      </button>

      <p className="pt-2 text-center text-[13px] text-ink-muted">
        ¿Aún no es miembro?{' '}
        <a href="/private-access" className="link-underline text-ink">Solicite acceso privado</a>
      </p>
    </form>
  );
}
