import { useState } from 'react';
import { CLOSING_CHECKLIST_TEMPLATE, formatUsd } from '@luxus/shared';
import { apiFetch, ApiError } from '../../lib/api';

interface ChecklistItem {
  key: string;
  label: string;
  status: 'pending' | 'in_progress' | 'done' | 'not_applicable';
  owner: 'buyer' | 'seller' | 'both';
  note?: string;
}

interface Props {
  dealId: string;
  checklist: ChecklistItem[] | null;
  notes: string | null;
  finalAmount: number | null;
  successFeePct: number | null;
  successFeeAmount: number | null;
  canEdit: boolean;
}

const STATUS_LABEL: Record<ChecklistItem['status'], string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  done: 'Completado',
  not_applicable: 'No aplica',
};

const OWNER_LABEL: Record<ChecklistItem['owner'], string> = {
  buyer: 'Comprador',
  seller: 'Vendedor',
  both: 'Ambas partes',
};

/**
 * Checklist de cierre.
 *
 * La plataforma solo registra el estado: el escrow, la fiducia y el movimiento
 * de fondos son externos. El success fee se guarda como dato para facturación
 * manual, nunca se cobra desde aquí.
 */
export default function DealClosing({
  dealId, checklist, notes, finalAmount, successFeePct, successFeeAmount, canEdit,
}: Props) {
  const [items, setItems] = useState<ChecklistItem[]>(
    checklist && checklist.length > 0
      ? checklist
      : CLOSING_CHECKLIST_TEMPLATE.map((t) => ({
          key: t.key,
          label: t.label,
          status: 'pending' as const,
          owner: t.owner as ChecklistItem['owner'],
        })),
  );
  const [amount, setAmount] = useState(finalAmount?.toString() ?? '');
  const [feePct, setFeePct] = useState(successFeePct?.toString() ?? '');
  const [closingNotes, setClosingNotes] = useState(notes ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = items.filter((i) => i.status === 'done').length;
  const applicable = items.filter((i) => i.status !== 'not_applicable').length;

  const computedFee =
    amount && feePct ? (Number(amount) * Number(feePct)) / 100 : successFeeAmount;

  function updateItem(key: string, status: ChecklistItem['status']) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, status } : i)));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/v1/deals/closing', {
        method: 'POST',
        body: {
          deal_id: dealId,
          items,
          closing_notes: closingNotes || undefined,
          final_amount: amount ? Number(amount) : undefined,
          success_fee_pct: feePct ? Number(feePct) : undefined,
        },
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el checklist.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-stone bg-white">
      <div className="border-b border-stone p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-[14px]">
            <strong>{done}</strong> de {applicable} pasos completados
          </p>
          <div className="h-1.5 w-full max-w-xs bg-stone sm:w-48">
            <div
              className="h-full bg-ink transition-all duration-500"
              style={{ width: `${applicable === 0 ? 0 : (done / applicable) * 100}%` }}
              role="progressbar"
              aria-valuenow={done}
              aria-valuemin={0}
              aria-valuemax={applicable}
              aria-label="Progreso del cierre"
            />
          </div>
        </div>
      </div>

      <ul className="divide-y divide-stone">
        {items.map((item) => (
          <li key={item.key} className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <p className="text-[14px]">{item.label}</p>
              <p className="mt-1 text-[12px] text-ink-muted">
                Responsable: {OWNER_LABEL[item.owner]}
                {item.note ? ` · ${item.note}` : ''}
              </p>
            </div>

            {canEdit ? (
              <select
                value={item.status}
                onChange={(e) => updateItem(item.key, e.target.value as ChecklistItem['status'])}
                aria-label={`Estado de ${item.label}`}
                className="shrink-0 border border-stone-dark bg-white px-3 py-1.5 text-[12px]"
              >
                {(Object.keys(STATUS_LABEL) as ChecklistItem['status'][]).map((status) => (
                  <option key={status} value={status}>{STATUS_LABEL[status]}</option>
                ))}
              </select>
            ) : (
              <span
                className={`badge shrink-0 ${
                  item.status === 'done' ? 'border-ink bg-ink text-white'
                    : item.status === 'in_progress' ? 'border-gold text-gold-dark'
                    : 'border-stone-dark text-ink-muted'
                }`}
              >
                {STATUS_LABEL[item.status]}
              </span>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="border-t border-stone bg-ivory p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="closing-amount">Importe final acordado (USD)</label>
              <input
                id="closing-amount" type="number" min={0} step={1000} className="field"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setSaved(false); }}
              />
            </div>
            <div>
              <label className="label" htmlFor="closing-fee">Success fee pactado (%)</label>
              <input
                id="closing-fee" type="number" min={0} max={20} step={0.25} className="field"
                value={feePct}
                onChange={(e) => { setFeePct(e.target.value); setSaved(false); }}
              />
            </div>
          </div>

          <div className="mt-5">
            <label className="label" htmlFor="closing-notes">Notas del cierre</label>
            <textarea
              id="closing-notes" rows={3} maxLength={3000} className="field resize-none"
              value={closingNotes}
              onChange={(e) => { setClosingNotes(e.target.value); setSaved(false); }}
            />
          </div>

          {computedFee !== null && computedFee > 0 && (
            <p className="mt-5 border-l-2 border-gold bg-white px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
              Success fee registrado: <strong className="text-ink">{formatUsd(computedFee)}</strong>.
              Se factura de forma independiente fuera de la plataforma; LUXUS no
              lo cobra a través del sistema de pagos.
            </p>
          )}

          {error && <p role="alert" className="mt-4 text-[13px] text-red-800">{error}</p>}

          <div className="mt-6 flex items-center gap-4">
            <button type="button" onClick={save} disabled={busy} className="btn-primary px-6 py-2.5">
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
            {saved && <p className="text-[13px] text-ink-muted">Cambios guardados.</p>}
          </div>
        </div>
      )}

      <div className="border-t border-stone p-6">
        <p className="text-[12px] leading-relaxed text-ink-muted">
          El escrow y la transferencia de fondos se realizan a través de una
          entidad fiduciaria externa designada por las partes. La plataforma solo
          registra el estado del proceso.
        </p>
      </div>
    </div>
  );
}
