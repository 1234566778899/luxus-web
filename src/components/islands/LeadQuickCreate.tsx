import { useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';

interface Staff {
  id: string;
  full_name: string | null;
  email: string;
}

interface Props {
  defaultKind: 'seller_pipeline' | 'buyer_enquiry';
  staff: Staff[];
}

const CATEGORIES = ['real-estate', 'companies', 'vehicles', 'yachts', 'aircraft'] as const;

export default function LeadQuickCreate({ defaultKind, staff }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);

    try {
      await apiFetch('/v1/crm/leads', {
        method: 'POST',
        body: {
          kind: String(form.get('kind')),
          name: String(form.get('name') ?? ''),
          email: String(form.get('email') ?? '') || undefined,
          phone: String(form.get('phone') ?? '') || undefined,
          company: String(form.get('company') ?? '') || undefined,
          category: String(form.get('category') ?? '') || undefined,
          estimated_value: form.get('estimated_value') ? Number(form.get('estimated_value')) : undefined,
          source: String(form.get('source') ?? '') || undefined,
          message: String(form.get('message') ?? '') || undefined,
          assigned_to: String(form.get('assigned_to') ?? '') || undefined,
        },
      });
      window.location.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el lead.');
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        Nuevo lead
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-ink-deep/60 p-6 backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
    >
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-stone bg-white p-8"
      >
        <h2 className="font-display text-[24px]">Nuevo lead</h2>

        <div className="mt-6 space-y-5">
          <div>
            <label className="label" htmlFor="l-kind">Tipo</label>
            <select id="l-kind" name="kind" className="field" defaultValue={defaultKind}>
              <option value="seller_pipeline">Captación de vendedor</option>
              <option value="buyer_enquiry">Consulta de comprador</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="l-name">Nombre</label>
            <input id="l-name" name="name" required minLength={2} maxLength={200} className="field" />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="l-email">Correo</label>
              <input id="l-email" name="email" type="email" className="field" />
            </div>
            <div>
              <label className="label" htmlFor="l-phone">Teléfono</label>
              <input id="l-phone" name="phone" className="field" />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="l-company">Empresa</label>
              <input id="l-company" name="company" className="field" />
            </div>
            <div>
              <label className="label" htmlFor="l-category">Categoría</label>
              <select id="l-category" name="category" className="field" defaultValue="">
                <option value="">—</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="l-value">Valor estimado (USD)</label>
              <input id="l-value" name="estimated_value" type="number" min={0} step={1000} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="l-source">Origen</label>
              <input id="l-source" name="source" placeholder="referral, outbound…" className="field" />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="l-assigned">Asignar a</label>
            <select id="l-assigned" name="assigned_to" className="field" defaultValue="">
              <option value="">Sin asignar</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name ?? s.email}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="l-message">Nota inicial</label>
            <textarea id="l-message" name="message" rows={3} maxLength={4000} className="field resize-none" />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 border-l-2 border-red-700 bg-red-50 px-4 py-3 text-[13px] text-red-800">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button type="submit" disabled={busy} className="btn-primary px-6 py-2.5">
            {busy ? 'Creando…' : 'Crear lead'}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost px-6 py-2.5">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
