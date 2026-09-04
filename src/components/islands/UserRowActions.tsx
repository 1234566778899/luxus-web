import { useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';

interface Props {
  userId: string;
  currentUserId: string;
  role: string;
  isSuspended: boolean;
}

const ROLES = [
  { value: 'buyer', label: 'Comprador' },
  { value: 'seller', label: 'Vendedor' },
  { value: 'broker', label: 'Bróker' },
  { value: 'admin', label: 'Admin' },
];

export default function UserRowActions({ userId, currentUserId, role: initialRole, isSuspended: initialSuspended }: Props) {
  const [role, setRole] = useState(initialRole);
  const [suspended, setSuspended] = useState(initialSuspended);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasonPrompt, setReasonPrompt] = useState(false);
  const [reason, setReason] = useState('');

  const isSelf = userId === currentUserId;

  async function updateRole(next: string) {
    if (isSelf && next !== 'admin') {
      setError('No puede quitarse a sí mismo el rol de administrador.');
      return;
    }
    const previous = role;
    setRole(next);
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/v1/admin/users', { method: 'PATCH', body: { user_id: userId, role: next } });
    } catch (err) {
      setRole(previous);
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el rol.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleSuspend() {
    if (!suspended) {
      setReasonPrompt(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/v1/admin/users', { method: 'PATCH', body: { user_id: userId, is_suspended: false } });
      setSuspended(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo reactivar la cuenta.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmSuspend() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/v1/admin/users', {
        method: 'PATCH',
        body: { user_id: userId, is_suspended: true, suspended_reason: reason || undefined },
      });
      setSuspended(true);
      setReasonPrompt(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo suspender la cuenta.');
    } finally {
      setBusy(false);
    }
  }

  if (reasonPrompt) {
    return (
      <div className="flex flex-col items-end gap-2">
        <input
          type="text"
          placeholder="Motivo de la suspensión"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-56 border border-stone-dark px-2.5 py-1.5 text-[12px]"
        />
        <div className="flex gap-2">
          <button type="button" onClick={confirmSuspend} disabled={busy} className="btn-ghost px-3 py-1.5 text-[10px] hover:border-red-600 hover:text-red-700">
            Confirmar
          </button>
          <button type="button" onClick={() => setReasonPrompt(false)} className="btn-ghost px-3 py-1.5 text-[10px]">
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <select
          value={role}
          disabled={busy || isSelf}
          onChange={(e) => updateRole(e.target.value)}
          className="border border-stone-dark bg-white px-2.5 py-1.5 text-[12px] disabled:opacity-50"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={toggleSuspend}
          disabled={busy || isSelf}
          className={`px-3 py-1.5 text-[10px] uppercase tracking-luxus border ${
            suspended ? 'border-stone-dark text-ink-muted' : 'border-red-300 text-red-700 hover:bg-red-50'
          } disabled:opacity-50`}
        >
          {suspended ? 'Reactivar' : 'Suspender'}
        </button>
      </div>
      {error && <p role="alert" className="max-w-56 text-right text-[11px] text-red-800">{error}</p>}
    </div>
  );
}
