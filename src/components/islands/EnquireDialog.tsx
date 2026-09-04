import { useEffect, useRef, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';

interface Props {
  assetId: string;
  assetTitle: string;
  reference: string;
  variant?: 'primary' | 'outline' | 'light';
  label?: string;
  prefill?: { name?: string; email?: string } | null;
}

type State = 'idle' | 'sending' | 'sent' | 'error';

/**
 * «Enquire Privately».
 *
 * No es un formulario de contacto de e-commerce: la consulta entra en el CRM
 * como lead del comprador y notifica al vendedor. No revela ningún dato de
 * Nivel II ni promete respuesta automática.
 */
export default function EnquireDialog({
  assetId, assetTitle, reference, variant = 'primary', label = 'Enquire Privately', prefill,
}: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState('sending');
    setError(null);

    try {
      await apiFetch('/v1/enquiries', {
        method: 'POST',
        body: {
          asset_id: assetId,
          name: String(form.get('name') ?? ''),
          email: String(form.get('email') ?? ''),
          phone: String(form.get('phone') ?? '') || undefined,
          company: String(form.get('company') ?? '') || undefined,
          message: String(form.get('message') ?? ''),
          website: String(form.get('website') ?? ''),
        },
      });
      setState('sent');
    } catch (err) {
      setState('error');
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar la consulta.');
    }
  }

  const buttonClass =
    variant === 'outline' ? 'btn-outline' : variant === 'light' ? 'btn-light' : 'btn-primary';

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass}>
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[95] flex items-end justify-center bg-ink-deep/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="enquire-title"
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto bg-white p-8 shadow-2xl sm:p-10"
          >
            {state === 'sent' ? (
              <div className="py-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center border border-gold">
                  <svg className="h-6 w-6 text-gold-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
                    <path d="M4 12.5 L9.5 18 L20 6.5" strokeLinecap="square" />
                  </svg>
                </div>
                <h2 className="mt-7 font-display text-[27px]">Consulta recibida</h2>
                <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">
                  Un asesor de LUXUS revisará su solicitud y le contactará de
                  forma privada. El precio de referencia y la ubicación exacta
                  se comparten únicamente con miembros verificados.
                </p>
                <button type="button" onClick={() => setOpen(false)} className="btn-outline mt-8">
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="eyebrow">Consulta privada · {reference}</p>
                    <h2 id="enquire-title" className="mt-3 font-display text-[26px] leading-snug">
                      {assetTitle}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Cerrar"
                    className="-mr-2 -mt-2 p-2 text-ink-muted hover:text-ink"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
                  {/* Honeypot: invisible para personas, irresistible para bots. */}
                  <input
                    type="text" name="website" tabIndex={-1} autoComplete="off"
                    aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 opacity-0"
                  />

                  <div>
                    <label className="label" htmlFor="enquire-name">Nombre completo</label>
                    <input
                      id="enquire-name" name="name" required minLength={2} maxLength={160}
                      defaultValue={prefill?.name ?? ''} className="field" autoComplete="name"
                    />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="enquire-email">Correo</label>
                      <input
                        id="enquire-email" name="email" type="email" required
                        defaultValue={prefill?.email ?? ''} className="field" autoComplete="email"
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="enquire-phone">Teléfono</label>
                      <input id="enquire-phone" name="phone" type="tel" className="field" autoComplete="tel" />
                    </div>
                  </div>

                  <div>
                    <label className="label" htmlFor="enquire-company">Empresa o family office</label>
                    <input id="enquire-company" name="company" className="field" autoComplete="organization" />
                  </div>

                  <div>
                    <label className="label" htmlFor="enquire-message">Mensaje</label>
                    <textarea
                      id="enquire-message" name="message" required minLength={10} maxLength={2000}
                      rows={4} className="field resize-none"
                      placeholder="Indique su interés, plazos previstos y si opera por cuenta propia o de un tercero."
                    />
                  </div>

                  {error && (
                    <p role="alert" className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-[13px] text-red-800">
                      {error}
                    </p>
                  )}

                  <button type="submit" disabled={state === 'sending'} className="btn-primary w-full">
                    {state === 'sending' ? 'Enviando…' : 'Enviar consulta'}
                  </button>

                  <p className="text-[11px] leading-relaxed text-ink-muted">
                    Al enviar acepta el tratamiento de sus datos conforme a la
                    Ley 29733 y nuestra{' '}
                    <a href="/legal/privacy" className="link-underline">política de privacidad</a>.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
