import { useState } from 'react';
import { apiFetch } from '../../lib/api';

interface Props {
  assetId: string;
  initial: boolean;
  authenticated: boolean;
}

export default function WatchlistButton({ assetId, initial, authenticated }: Props) {
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!authenticated) {
      window.location.href = `/auth/login?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    setBusy(true);
    try {
      if (saved) {
        await apiFetch(`/v1/me/watchlist/${assetId}`, { method: 'DELETE' });
        setSaved(false);
      } else {
        await apiFetch('/v1/me/watchlist', { method: 'POST', body: { asset_id: assetId } });
        setSaved(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      className="btn-ghost gap-2.5"
    >
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 20 20"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.4"
        aria-hidden="true"
      >
        <path d="M5 2.5h10v15l-5-4-5 4z" strokeLinejoin="round" />
      </svg>
      {saved ? 'En seguimiento' : 'Seguir activo'}
    </button>
  );
}
