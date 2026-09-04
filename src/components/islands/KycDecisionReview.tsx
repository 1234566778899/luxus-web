import { useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';

interface Props {
  caseId: string;
  userId: string;
}

/**
 * Decisión manual sobre un expediente KYC en cola.
 *
 * Aprobar dispara el screening (PEP / sanciones / adverse media) del lado del
 * servidor: el resultado se guarda en el perfil, y de venir «blocked» la
 * aprobación se revierte a rechazo automáticamente.
 */
export default function KycDecisionReview({ caseId }: Props) {
  const [mode, setMode] = useState<'idle' | 'approve' | 'reject'>('idle');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; screening: string | null } | null>(null);

  async function decide(decision: 'approved' | 'rejected') {
    if (decision === 'rejected' && !reason.trim()) {
      setError('Indique el motivo del rechazo.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ status: string; screening: string | null }>(
        '/v1/admin/kyc/decision',
        {
          method: 'POST',
          body: {
            case_id: caseId,
            decision,
            reviewer_notes: notes || undefined,
            rejection_reason: decision === 'rejected' ? reason : undefined,
          },
        },
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la decisión.');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="border border-stone bg-ivory p-5">
        <p className="text-[13.5px] text-ink-muted">
          Expediente {result.status === 'approved' ? 'aprobado' : 'rechazado'}.
          {result.screening && (
            <span>
              {' '}Screening: <strong className="text-ink">{
                result.screening === 'clear' ? 'sin coincidencias'
                  : result.screening === 'flagged' ? 'con coincidencias (revisar)'
                  : 'bloqueado'
              }</strong>.
            </span>
          )}
        </p>
      </div>
    );
  }

  if (mode === 'approve') {
    return (
      <div className="border border-gold bg-ivory p-5">
        <label className="label" htmlFor={`k-notes-${caseId}`}>Notas internas (opcional)</label>
        <textarea
          id={`k-notes-${caseId}`}
          rows={2}
          className="field resize-none"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
          Al aprobar se ejecuta el screening PEP / sanciones / adverse media.
          Si el resultado bloquea al usuario, la aprobación se convierte
          automáticamente en rechazo.
        </p>
        {error && <p role="alert" className="mt-3 text-[13px] text-red-800">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => decide('approved')} disabled={busy} className="btn-primary px-5 py-2.5">
            {busy ? 'Procesando…' : 'Aprobar y ejecutar screening'}
          </button>
          <button type="button" onClick={() => setMode('idle')} className="btn-ghost px-5 py-2.5">Atrás</button>
        </div>
      </div>
    );
  }

  if (mode === 'reject') {
    return (
      <div className="border border-stone bg-ivory p-5">
        <label className="label" htmlFor={`k-reason-${caseId}`}>Motivo del rechazo</label>
        <textarea
          id={`k-reason-${caseId}`}
          rows={2}
          required
          className="field resize-none"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {error && <p role="alert" className="mt-3 text-[13px] text-red-800">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => decide('rejected')} disabled={busy} className="btn-primary px-5 py-2.5">
            {busy ? 'Procesando…' : 'Confirmar rechazo'}
          </button>
          <button type="button" onClick={() => setMode('idle')} className="btn-ghost px-5 py-2.5">Atrás</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => setMode('approve')} className="btn-primary px-5 py-2.5">Aprobar</button>
      <button type="button" onClick={() => setMode('reject')} className="btn-ghost px-5 py-2.5">Rechazar</button>
    </div>
  );
}
