import { useState } from 'react';
import { PERMISSION_EXPIRY_OPTIONS } from '@luxus/shared';
import { apiFetch, ApiError } from '../../lib/api';

interface Props {
  dealId: string;
  buyerVerified: boolean;
  assetTitle: string;
}

/**
 * Aprobar o denegar una solicitud de Deal Room.
 *
 * Aprobar no abre nada por sí solo: emite el NDA. El Deal Room solo se abre
 * cuando el comprador lo firma, y los permisos por documento se conceden
 * después, uno a uno, desde el propio Deal Room.
 */
export default function DealDecision({ dealId, buyerVerified, assetTitle }: Props) {
  const [mode, setMode] = useState<'idle' | 'approve' | 'decline'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'approved' | 'declined' | null>(null);
  const [accessDays, setAccessDays] = useState(90);
  const [reason, setReason] = useState('');

  if (done) {
    return (
      <div className="border border-stone bg-ivory p-5">
        <p className="text-[14px]">
          {done === 'approved'
            ? 'Acceso concedido. El comprador ha recibido el NDA para firma.'
            : 'Solicitud denegada. Se notificó al comprador.'}
        </p>
        {done === 'approved' && (
          <a href={`/deal/${dealId}`} className="btn-outline mt-4 w-full px-4 py-2.5">
            Abrir Deal Room
          </a>
        )}
      </div>
    );
  }

  async function decide(decision: 'approve' | 'decline') {
    setBusy(true);
    setError(null);

    try {
      await apiFetch('/v1/deals/decision', {
        method: 'POST',
        body: {
          deal_id: dealId,
          decision,
          decline_reason: decision === 'decline' ? reason : undefined,
          access_days: accessDays,
        },
      });

      if (decision === 'approve') {
        // Emitir el NDA es parte inseparable de aprobar: si falla, el vendedor
        // debe saberlo aquí y no descubrirlo en el Deal Room.
        await apiFetch(`/v1/deals/${dealId}/nda/issue`, { method: 'POST' });
      }

      setDone(decision === 'approve' ? 'approved' : 'declined');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la decisión.');
    } finally {
      setBusy(false);
    }
  }

  if (!buyerVerified) {
    return (
      <div className="border border-gold bg-ivory p-5">
        <p className="text-[13px] leading-relaxed text-ink-muted">
          El solicitante aún no ha superado la verificación de identidad. La
          solicitud quedará en espera hasta que LUXUS la apruebe; entonces podrá
          decidir.
        </p>
      </div>
    );
  }

  if (mode === 'approve') {
    return (
      <div className="border border-stone bg-ivory p-5">
        <p className="text-[13.5px] leading-relaxed text-ink-muted">
          Al aprobar se emitirá el acuerdo de confidencialidad de «{assetTitle}».
          El Deal Room se abrirá cuando el comprador lo firme.
        </p>

        <div className="mt-5">
          <label className="label" htmlFor={`days-${dealId}`}>Vigencia del acceso</label>
          <select
            id={`days-${dealId}`}
            className="field"
            value={accessDays}
            onChange={(e) => setAccessDays(Number(e.target.value))}
          >
            {PERMISSION_EXPIRY_OPTIONS.map((option) => (
              <option key={option.days} value={option.days}>{option.label}</option>
            ))}
          </select>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
            Al cumplirse, el Deal Room se cierra automáticamente. Podrá
            prorrogarlo en cualquier momento.
          </p>
        </div>

        {error && <p role="alert" className="mt-4 text-[13px] text-red-800">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => decide('approve')} disabled={busy} className="btn-primary flex-1 px-4 py-2.5">
            {busy ? 'Procesando…' : 'Confirmar'}
          </button>
          <button type="button" onClick={() => setMode('idle')} className="btn-ghost px-4 py-2.5">
            Atrás
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'decline') {
    return (
      <div className="border border-stone bg-ivory p-5">
        <label className="label" htmlFor={`reason-${dealId}`}>Motivo para el comprador</label>
        <textarea
          id={`reason-${dealId}`}
          rows={3}
          maxLength={1000}
          className="field resize-none"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Se comunicará al solicitante."
        />

        {error && <p role="alert" className="mt-3 text-[13px] text-red-800">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => decide('decline')}
            disabled={busy || reason.trim().length < 5}
            className="btn-primary flex-1 px-4 py-2.5"
          >
            {busy ? 'Procesando…' : 'Denegar'}
          </button>
          <button type="button" onClick={() => setMode('idle')} className="btn-ghost px-4 py-2.5">
            Atrás
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setMode('approve')} className="btn-primary w-full px-4 py-2.5">
        Conceder acceso
      </button>
      <button type="button" onClick={() => setMode('decline')} className="btn-ghost w-full px-4 py-2.5">
        Denegar
      </button>
    </div>
  );
}
