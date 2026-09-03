import { useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';

interface ChecklistItem {
  id: string;
  item_key: string;
  label: string;
  authority: string | null;
  required: boolean;
  status: 'pending' | 'received' | 'verified' | 'rejected' | 'not_applicable';
  notes: string | null;
}

interface Props {
  assetId: string;
  assetTitle: string;
  checklist: ChecklistItem[];
}

const STATUS_OPTIONS: { value: ChecklistItem['status']; label: string }[] = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'received', label: 'Recibido' },
  { value: 'verified', label: 'Verificado' },
  { value: 'rejected', label: 'Rechazado' },
  { value: 'not_applicable', label: 'No aplica' },
];

/**
 * Checklist de verificación + decisión de publicación.
 *
 * El checklist se envía completo junto con la decisión: la API actualiza cada
 * ítem y, si se publica, cotiza el listing fee y marca los cuatro flags de
 * verificación que se muestran en la ficha pública.
 */
export default function AssetVerificationReview({ assetId, assetTitle, checklist: initial }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>(initial);
  const [flags, setFlags] = useState({
    ownership_verified: true,
    registry_reviewed: true,
    documentation_reviewed: true,
    valuation_available: false,
  });
  const [reason, setReason] = useState('');
  const [feeCents, setFeeCents] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function updateItem(itemKey: string, patch: Partial<ChecklistItem>) {
    setItems((prev) => prev.map((i) => (i.item_key === itemKey ? { ...i, ...patch } : i)));
  }

  const requiredPending = items.filter((i) => i.required && i.status !== 'verified' && i.status !== 'not_applicable');

  async function decide(decision: 'publish' | 'request_changes' | 'reject') {
    if (decision !== 'publish' && !reason.trim()) {
      setError('Indique el motivo que verá el vendedor.');
      return;
    }
    setBusy(decision);
    setError(null);

    try {
      await apiFetch('/v1/admin/assets/verify', {
        method: 'POST',
        body: {
          asset_id: assetId,
          decision,
          checklist: items.map((i) => ({ item_key: i.item_key, status: i.status, notes: i.notes || undefined })),
          ...flags,
          reason: reason || undefined,
          listing_fee_cents: feeCents ? Number(feeCents) : undefined,
        },
      });
      setDone(decision);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la decisión.');
    } finally {
      setBusy(null);
    }
  }

  if (done) {
    return (
      <div className="border border-stone bg-ivory p-6">
        <p className="text-[14px] text-ink-muted">
          {done === 'publish' ? `«${assetTitle}» fue publicado.`
            : done === 'request_changes' ? 'Se solicitaron cambios al vendedor.'
            : 'La publicación fue rechazada.'}
        </p>
      </div>
    );
  }

  return (
    <div className="border border-stone bg-white">
      <div className="border-b border-stone p-6">
        <h3 className="text-eyebrow uppercase tracking-luxus text-ink-muted">
          Checklist de verificación
        </h3>
        <ul className="mt-4 divide-y divide-stone">
          {items.map((item) => (
            <li key={item.item_key} className="flex flex-wrap items-start justify-between gap-4 py-3.5">
              <div className="min-w-0">
                <p className="text-[13.5px]">
                  {item.label}
                  {item.required && <span className="ml-1 text-gold-dark">*</span>}
                </p>
                {item.authority && (
                  <p className="mt-0.5 text-[11px] uppercase tracking-luxus text-ink-muted/70">
                    {item.authority}
                  </p>
                )}
              </div>
              <select
                value={item.status}
                onChange={(e) => updateItem(item.item_key, { status: e.target.value as ChecklistItem['status'] })}
                aria-label={`Estado de ${item.label}`}
                className="shrink-0 border border-stone-dark bg-white px-3 py-1.5 text-[12px]"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </li>
          ))}
        </ul>

        {requiredPending.length > 0 && (
          <p className="mt-4 border-l-2 border-gold bg-ivory px-4 py-3 text-[12.5px] text-ink-muted">
            {requiredPending.length} requisito(s) obligatorio(s) sin verificar. Puede publicar
            igualmente, pero quedará constancia en el motivo.
          </p>
        )}
      </div>

      <div className="border-b border-stone bg-ivory p-6">
        <h3 className="text-eyebrow uppercase tracking-luxus text-ink-muted">
          Bloque de verificación (ficha pública)
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {([
            ['ownership_verified', 'Ownership verified'],
            ['registry_reviewed', 'Registry reviewed'],
            ['documentation_reviewed', 'Documentation reviewed'],
            ['valuation_available', 'Valuation available'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2.5 text-[13.5px]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-ink"
                checked={flags[key]}
                onChange={(e) => setFlags({ ...flags, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>

        <div className="mt-5">
          <label className="label" htmlFor={`fee-${assetId}`}>
            Tarifa de publicación (USD, opcional — deja la banda por defecto si se omite)
          </label>
          <input
            id={`fee-${assetId}`}
            type="number"
            min={0}
            step={100}
            className="field"
            placeholder="Ej.: 1500"
            value={feeCents ? Number(feeCents) / 100 : ''}
            onChange={(e) => setFeeCents(e.target.value ? String(Number(e.target.value) * 100) : '')}
          />
        </div>
      </div>

      <div className="p-6">
        <label className="label" htmlFor={`reason-${assetId}`}>
          Motivo para el vendedor (obligatorio salvo al publicar)
        </label>
        <textarea
          id={`reason-${assetId}`}
          rows={3}
          className="field resize-none"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej.: falta certificado de gravámenes vigente."
        />

        {error && (
          <p role="alert" className="mt-3 border-l-2 border-red-700 bg-red-50 px-4 py-3 text-[13px] text-red-800">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => decide('publish')} disabled={busy !== null} className="btn-primary px-6 py-2.5">
            {busy === 'publish' ? 'Publicando…' : 'Publicar'}
          </button>
          <button type="button" onClick={() => decide('request_changes')} disabled={busy !== null} className="btn-outline px-6 py-2.5">
            {busy === 'request_changes' ? 'Enviando…' : 'Solicitar cambios'}
          </button>
          <button
            type="button"
            onClick={() => decide('reject')}
            disabled={busy !== null}
            className="btn-ghost px-6 py-2.5 hover:border-red-600 hover:text-red-700"
          >
            {busy === 'reject' ? 'Rechazando…' : 'Rechazar'}
          </button>
        </div>
      </div>
    </div>
  );
}
