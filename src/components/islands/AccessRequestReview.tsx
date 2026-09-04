import { useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';

interface Props {
  requestId: string;
  applicantProfile: string;
}

/**
 * Decisión sobre una solicitud de Private Access.
 *
 * Aprobar emite la invitación de GoTrue en el acto (el registro abierto está
 * deshabilitado): esta es la única puerta de entrada a la plataforma.
 */
export default function AccessRequestReview({ requestId, applicantProfile }: Props) {
  const [mode, setMode] = useState<'idle' | 'approve' | 'reject'>('idle');
  const [role, setRole] = useState(applicantProfile === 'seller' || applicantProfile === 'broker' ? applicantProfile : 'buyer');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null);

  async function decide(decision: 'approve' | 'reject') {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/v1/admin/access-requests/review', {
        method: 'POST',
        body: { request_id: requestId, decision, role, review_notes: notes || undefined },
      });
      setDone(decision === 'approve' ? 'approved' : 'rejected');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la decisión.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="border border-stone bg-ivory px-4 py-3 text-[13px] text-ink-muted">
        {done === 'approved' ? 'Invitación enviada.' : 'Solicitud rechazada.'}
      </p>
    );
  }

  if (mode === 'approve') {
    return (
      <div className="border border-gold bg-ivory p-5">
        <label className="label" htmlFor={`role-${requestId}`}>Rol a asignar</label>
        <select
          id={`role-${requestId}`}
          className="field"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="buyer">Comprador</option>
          <option value="seller">Vendedor</option>
          <option value="broker">Bróker</option>
        </select>

        <label className="label mt-4" htmlFor={`notes-${requestId}`}>Notas internas (opcional)</label>
        <textarea
          id={`notes-${requestId}`}
          rows={2}
          className="field resize-none"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {error && <p role="alert" className="mt-3 text-[13px] text-red-800">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => decide('approve')} disabled={busy} className="btn-primary px-5 py-2.5">
            {busy ? 'Enviando…' : 'Confirmar e invitar'}
          </button>
          <button type="button" onClick={() => setMode('idle')} className="btn-ghost px-5 py-2.5">Atrás</button>
        </div>
      </div>
    );
  }

  if (mode === 'reject') {
    return (
      <div className="border border-stone bg-ivory p-5">
        <label className="label" htmlFor={`rnotes-${requestId}`}>Motivo (opcional, uso interno)</label>
        <textarea
          id={`rnotes-${requestId}`}
          rows={2}
          className="field resize-none"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {error && <p role="alert" className="mt-3 text-[13px] text-red-800">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => decide('reject')} disabled={busy} className="btn-primary px-5 py-2.5">
            {busy ? 'Enviando…' : 'Confirmar rechazo'}
          </button>
          <button type="button" onClick={() => setMode('idle')} className="btn-ghost px-5 py-2.5">Atrás</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => setMode('approve')} className="btn-primary px-5 py-2.5">
        Aprobar
      </button>
      <button type="button" onClick={() => setMode('reject')} className="btn-ghost px-5 py-2.5">
        Rechazar
      </button>
    </div>
  );
}
