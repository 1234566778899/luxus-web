import { useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';

/**
 * Hoja de reclamación virtual (Libro de Reclamaciones, D.S. N.º 011-2011-PCM
 * y modificatorias). Un solo paso: a diferencia de la admisión, este canal es
 * una obligación legal, no un filtro — cualquiera debe poder usarlo sin
 * fricción.
 */
export default function ComplaintBookForm() {
  const [kind, setKind] = useState<'reclamo' | 'queja'>('reclamo');
  const [isMinor, setIsMinor] = useState(false);
  const [sending, setSending] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSending(true);
    setError(null);

    try {
      const amountRaw = String(form.get('amount') ?? '').trim();
      const { reference } = await apiFetch<{ ok: true; reference: string }>('/v1/complaint-book', {
        method: 'POST',
        body: {
          kind,
          full_name: String(form.get('full_name') ?? ''),
          document_type: String(form.get('document_type') ?? 'DNI'),
          document_number: String(form.get('document_number') ?? ''),
          email: String(form.get('email') ?? ''),
          phone: String(form.get('phone') ?? '') || undefined,
          address: String(form.get('address') ?? '') || undefined,
          is_minor: isMinor,
          guardian_name: isMinor ? String(form.get('guardian_name') ?? '') : undefined,
          product_or_service: String(form.get('product_or_service') ?? ''),
          amount: amountRaw ? Number(amountRaw) : undefined,
          detail: String(form.get('detail') ?? ''),
          requested_action: String(form.get('requested_action') ?? '') || undefined,
          website: String(form.get('website') ?? ''),
        },
      });
      setReference(reference);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No pudimos registrar su reclamo. Inténtelo de nuevo en unos minutos.',
      );
    } finally {
      setSending(false);
    }
  }

  if (reference) {
    return (
      <div className="border border-ink bg-white px-8 py-16 text-center sm:px-16">
        <div className="mx-auto flex h-16 w-16 items-center justify-center border border-gold">
          <svg className="h-7 w-7 text-gold-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
            <path d="M4 12.5 L9.5 18 L20 6.5" strokeLinecap="square" />
          </svg>
        </div>

        <p className="mt-8 text-eyebrow uppercase tracking-luxus text-ink-muted">Número de registro</p>
        <h2 className="mt-3 font-display text-[36px] leading-tight">{reference}</h2>

        <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-ink-muted">
          Hemos enviado la constancia a su correo. Le responderemos en un
          plazo no mayor a 30 días calendario, conforme a la normativa de
          protección al consumidor.
        </p>

        <a href="/" className="btn-outline mt-10">Volver al inicio</a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="border border-stone bg-white p-8 sm:p-12" noValidate>
      {/* Honeypot */}
      <input
        type="text" name="website" tabIndex={-1} autoComplete="off"
        aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <div>
        <span className="label">Tipo de registro *</span>
        <div className="flex flex-wrap gap-2">
          {[
            ['reclamo', 'Reclamo', 'Disconformidad relacionada con el bien o servicio.'],
            ['queja', 'Queja', 'Disconformidad no relacionada con el bien o servicio, o malestar en la atención.'],
          ].map(([value, label, hint]) => (
            <label
              key={value}
              className={`cursor-pointer border p-4 text-left transition-colors sm:w-[calc(50%-0.25rem)] ${
                kind === value ? 'border-ink bg-ivory' : 'border-stone hover:border-stone-dark'
              }`}
            >
              <input
                type="radio" name="kind" value={value}
                checked={kind === value}
                onChange={() => setKind(value as 'reclamo' | 'queja')}
                className="sr-only"
              />
              <span className="block text-[13px] font-medium uppercase tracking-luxus text-ink">{label}</span>
              <span className="mt-1 block text-[12.5px] leading-relaxed text-ink-muted">{hint}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-8 space-y-5">
        <p className="text-eyebrow uppercase tracking-luxus text-ink-muted">Datos del consumidor</p>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="cb-name">Nombre completo *</label>
            <input id="cb-name" name="full_name" required minLength={3} maxLength={160} className="field" autoComplete="name" />
          </div>
          <div>
            <label className="label" htmlFor="cb-email">Correo electrónico *</label>
            <input id="cb-email" name="email" type="email" required className="field" autoComplete="email" />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-[140px_1fr_1fr]">
          <div>
            <label className="label" htmlFor="cb-doctype">Documento *</label>
            <select id="cb-doctype" name="document_type" defaultValue="DNI" className="field">
              <option value="DNI">DNI</option>
              <option value="CE">C.E.</option>
              <option value="PASSPORT">Pasaporte</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="cb-docnumber">N.º de documento *</label>
            <input id="cb-docnumber" name="document_number" required minLength={6} maxLength={20} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="cb-phone">Teléfono</label>
            <input id="cb-phone" name="phone" type="tel" className="field" autoComplete="tel" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="cb-address">Domicilio</label>
          <input id="cb-address" name="address" maxLength={240} className="field" autoComplete="street-address" />
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-ink-muted">
          <input
            type="checkbox" checked={isMinor}
            onChange={(e) => setIsMinor(e.target.checked)}
            className="mt-0.5 h-4 w-4 border-stone-dark"
          />
          El reclamante es menor de edad
        </label>

        {isMinor && (
          <div>
            <label className="label" htmlFor="cb-guardian">Nombre del padre, madre o apoderado *</label>
            <input id="cb-guardian" name="guardian_name" required minLength={3} maxLength={160} className="field" />
          </div>
        )}
      </div>

      <div className="mt-10 space-y-5">
        <p className="text-eyebrow uppercase tracking-luxus text-ink-muted">Detalle del bien o servicio</p>

        <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
          <div>
            <label className="label" htmlFor="cb-product">Bien o servicio contratado *</label>
            <input id="cb-product" name="product_or_service" required minLength={3} maxLength={200} className="field" placeholder="Ej.: Enquire Privately — Penthouse Malecón de la Reserva" />
          </div>
          <div>
            <label className="label" htmlFor="cb-amount">Monto reclamado (USD)</label>
            <input id="cb-amount" name="amount" type="number" min={0} step="0.01" className="field" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="cb-detail">Detalle del {kind} *</label>
          <textarea id="cb-detail" name="detail" required minLength={20} maxLength={4000} rows={5} className="field resize-none" />
        </div>

        <div>
          <label className="label" htmlFor="cb-request">Pedido del consumidor</label>
          <textarea id="cb-request" name="requested_action" maxLength={1000} rows={2} className="field resize-none" />
        </div>
      </div>

      {error && <p role="alert" className="mt-6 text-[13px] text-red-800">{error}</p>}

      <button type="submit" disabled={sending} className="btn-primary mt-10">
        {sending ? 'Enviando…' : `Registrar ${kind}`}
      </button>

      <p className="mt-4 text-[12px] leading-relaxed text-ink-muted">
        Sus datos se tratan conforme a nuestra{' '}
        <a href="/legal/privacy" className="link-underline">política de privacidad</a>{' '}
        y la Ley N.º 29733.
      </p>
    </form>
  );
}
