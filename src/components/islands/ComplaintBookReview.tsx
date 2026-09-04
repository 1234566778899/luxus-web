import { useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';

interface Props {
  entryId: string;
}

/**
 * Respuesta a una entrada del Libro de Reclamaciones. "En revisión" solo
 * cambia el estado; "Responder" exige el texto y dispara el correo al
 * reclamante — es la constancia de respuesta que exige la norma.
 */
export default function ComplaintBookReview({ entryId }: Props) {
  const [mode, setMode] = useState<'idle' | 'respond'>('idle');
  const [responseText, setResponseText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'in_review' | 'responded' | 'closed' | null>(null);

  async function setStatus(status: 'in_review' | 'responded' | 'closed', response_text?: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/v1/admin/complaint-book/respond', {
        method: 'POST',
        body: { entry_id: entryId, status, response_text },
      });
      setDone(status);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la acción.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const label = { in_review: 'En revisión.', responded: 'Respuesta enviada.', closed: 'Cerrado.' }[done];
    return (
      <p className="border border-stone bg-ivory px-4 py-3 text-[13px] text-ink-muted">{label}</p>
    );
  }

  if (mode === 'respond') {
    return (
      <div className="border border-gold bg-ivory p-5">
        <label className="label" htmlFor={`response-${entryId}`}>Respuesta al consumidor</label>
        <textarea
          id={`response-${entryId}`}
          rows={4}
          className="field resize-none"
          value={responseText}
          onChange={(e) => setResponseText(e.target.value)}
          minLength={10}
        />

        {error && <p role="alert" className="mt-3 text-[13px] text-red-800">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setStatus('responded', responseText)}
            disabled={busy || responseText.trim().length < 10}
            className="btn-primary px-5 py-2.5"
          >
            {busy ? 'Enviando…' : 'Enviar respuesta'}
          </button>
          <button type="button" onClick={() => setMode('idle')} className="btn-ghost px-5 py-2.5">Atrás</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => setStatus('in_review')} disabled={busy} className="btn-ghost px-5 py-2.5">
        Marcar en revisión
      </button>
      <button type="button" onClick={() => setMode('respond')} className="btn-primary px-5 py-2.5">
        Responder
      </button>
      <button type="button" onClick={() => setStatus('closed')} disabled={busy} className="btn-ghost px-5 py-2.5">
        Cerrar sin respuesta
      </button>
      {error && <p role="alert" className="mt-1 w-full text-[13px] text-red-800">{error}</p>}
    </div>
  );
}
