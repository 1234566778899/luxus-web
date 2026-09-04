import { useState } from 'react';
import { browserClient } from '../../lib/supabase';

export default function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);

    await browserClient().auth.resetPasswordForEmail(
      String(form.get('email') ?? '').trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/auth/reset` },
    );

    // Se responde igual exista o no la cuenta: no confirmamos qué correos
    // están registrados en la plataforma.
    setBusy(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="border border-stone bg-ivory p-8">
        <p className="font-display text-[22px]">Revise su correo</p>
        <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">
          Si la dirección corresponde a una cuenta activa, recibirá un enlace
          para establecer una contraseña nueva. El enlace caduca en una hora.
        </p>
        <a href="/auth/login" className="btn-outline mt-8 w-full">Volver al acceso</a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="label" htmlFor="forgot-email">Correo electrónico</label>
        <input id="forgot-email" name="email" type="email" required autoFocus autoComplete="email" className="field" />
      </div>

      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? 'Enviando…' : 'Enviar enlace'}
      </button>

      <a href="/auth/login" className="block pt-2 text-center text-[12px] uppercase tracking-luxus text-ink-muted hover:text-ink">
        Volver
      </a>
    </form>
  );
}
