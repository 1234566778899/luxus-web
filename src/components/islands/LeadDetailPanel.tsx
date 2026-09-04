import { useState } from 'react';
import { formatDateTime } from '@luxus/shared';
import { apiFetch, ApiError } from '../../lib/api';

interface Staff {
  id: string;
  full_name: string | null;
  email: string;
}

interface Note {
  id: string;
  body: string;
  created_at: string;
  author: { full_name: string | null } | null;
}

interface Props {
  leadId: string;
  stage: string;
  assignedTo: string | null;
  nextAction: string | null;
  nextActionAt: string | null;
  notes: Note[];
  staff: Staff[];
}

const STAGES = ['contacted', 'interested', 'documentation', 'approved', 'listed', 'lost'] as const;
const STAGE_LABEL: Record<string, string> = {
  contacted: 'Contactado', interested: 'Interesado', documentation: 'Documentación',
  approved: 'Aprobado', listed: 'Listado', lost: 'Perdido',
};

export default function LeadDetailPanel({
  leadId, stage: initialStage, assignedTo: initialAssigned, nextAction: initialAction,
  nextActionAt: initialActionAt, notes: initialNotes, staff,
}: Props) {
  const [stage, setStage] = useState(initialStage);
  const [assignedTo, setAssignedTo] = useState(initialAssigned ?? '');
  const [nextAction, setNextAction] = useState(initialAction ?? '');
  const [nextActionAt, setNextActionAt] = useState(initialActionAt ? initialActionAt.slice(0, 10) : '');
  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function saveFields() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await apiFetch(`/v1/crm/leads/${leadId}`, {
        method: 'PATCH',
        body: {
          stage,
          assigned_to: assignedTo || undefined,
          next_action: nextAction || undefined,
          next_action_at: nextActionAt ? new Date(nextActionAt).toISOString() : undefined,
        },
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }

  async function addNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get('body') ?? '').trim();
    if (!body) return;

    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ note: { id: string; body: string; created_at: string } }>(
        '/v1/crm/notes',
        { method: 'POST', body: { lead_id: leadId, body } },
      );
      setNotes((prev) => [{ ...result.note, author: null }, ...prev]);
      form.reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo publicar la nota.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <div className="border border-stone bg-white p-6">
          <h3 className="text-eyebrow uppercase tracking-luxus text-ink-muted">Seguimiento</h3>

          <div className="mt-4 space-y-4">
            <div>
              <label className="label" htmlFor="ld-stage">Etapa</label>
              <select id="ld-stage" className="field" value={stage} onChange={(e) => setStage(e.target.value)}>
                {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="ld-assigned">Asignado a</label>
              <select id="ld-assigned" className="field" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                <option value="">Sin asignar</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name ?? s.email}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="ld-action">Próxima acción</label>
              <input id="ld-action" className="field" maxLength={300} value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
            </div>

            <div>
              <label className="label" htmlFor="ld-date">Fecha</label>
              <input id="ld-date" type="date" className="field" value={nextActionAt} onChange={(e) => setNextActionAt(e.target.value)} />
            </div>
          </div>

          {error && <p role="alert" className="mt-4 text-[13px] text-red-800">{error}</p>}

          <button type="button" onClick={saveFields} disabled={busy} className="btn-primary mt-5 w-full px-4 py-2.5">
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
          {saved && <p className="mt-2 text-center text-[12px] text-ink-muted">Guardado.</p>}
        </div>
      </div>

      <div className="lg:col-span-7">
        <div className="border border-stone bg-white p-6">
          <h3 className="text-eyebrow uppercase tracking-luxus text-ink-muted">Notas</h3>

          <form onSubmit={addNote} className="mt-4">
            <textarea
              name="body" rows={3} maxLength={3000} className="field resize-none"
              placeholder="Añadir una nota de seguimiento…"
            />
            <button type="submit" disabled={busy} className="btn-outline mt-3 px-5 py-2">
              Publicar nota
            </button>
          </form>

          <ol className="mt-6 space-y-4 border-t border-stone pt-6">
            {notes.length === 0 && (
              <li className="text-[13px] text-ink-muted">Sin notas todavía.</li>
            )}
            {notes.map((note) => (
              <li key={note.id} className="border-l-2 border-stone-dark pl-4">
                <p className="text-[13.5px] leading-relaxed text-ink">{note.body}</p>
                <p className="mt-1.5 text-[11px] uppercase tracking-luxus text-ink-muted/70">
                  {note.author?.full_name ?? 'Equipo'} · {formatDateTime(note.created_at)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
