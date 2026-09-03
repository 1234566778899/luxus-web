import { useEffect, useState } from 'react';
import { resetPasswordSchema } from '@luxus/shared';
import { browserClient } from '../../lib/supabase';

/**
 * Establece la contraseña. Sirve tanto para el restablecimiento como para el
 * primer acceso tras aceptar una invitación: en ambos casos Supabase deja una
 * sesión de recuperación activa en el enlace.
 */
export default function ResetPasswordForm({ invite = false }: { invite?: boolean }) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = browserClient();
    // El SDK procesa el fragmento de la URL y emite el evento correspondiente.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        setReady(true);
      }
    });
    void supabase.auth.getSession().then(({ data: session }) => {
      if (session.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = resetPasswordSchema.safeParse({
      password: String(form.get('password') ?? ''),
      confirmPassword: String(form.get('confirmPassword') ?? ''),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'La contraseña no cumple los requisitos.');
      return;
    }

    setBusy(true);
    setError(null);

    const { error: updateError } = await browserClient().auth.updateUser({
      password: parsed.data.password,
    });

    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    // Tras fijar la contraseña, el login exige el segundo factor.
    window.location.href = invite ? '/auth/login?welcome=1' : '/auth/login?reset=1';
  }

  if (!ready) {
    return (
      <div className="border border-stone bg-ivory p-8">
        <p className="text-[14px] leading-relaxed text-ink-muted">
          Validando el enlace… Si esta pantalla persiste, el enlace puede haber
          caducado. Solicite uno nuevo desde{' '}
          <a href="/auth/forgot" className="link-underline text-ink">recuperar acceso</a>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="label" htmlFor="reset-password">Nueva contraseña</label>
        <input
          id="reset-password" name="password" type="password" required autoFocus
          autoComplete="new-password" minLength={12} className="field"
        />
        <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
          Mínimo 12 caracteres, con mayúscula, minúscula y número.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="reset-confirm">Repita la contraseña</label>
        <input
          id="reset-confirm" name="confirmPassword" type="password" required
          autoComplete="new-password" minLength={12} className="field"
        />
      </div>

      {error && (
        <p role="alert" className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? 'Guardando…' : invite ? 'Activar cuenta' : 'Guardar contraseña'}
      </button>
    </form>
  );
}
