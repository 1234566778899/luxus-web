import { useState } from 'react';
import { apiFetch } from '../../lib/api';

interface Props {
  assetId: string;
}

/**
 * Corazón de "guardar" superpuesto en la card, al estilo de un marketplace de
 * lujo: un gesto rápido sin abrir la ficha. No conoce el estado inicial
 * (evitaría una consulta por card en cada grid) — se limita a alternar de
 * forma optimista y a persistir en segundo plano.
 */
export default function SaveHeart({ assetId }: Props) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;

    const next = !saved;
    setSaved(next);
    setBusy(true);

    try {
      if (next) {
        await apiFetch('/v1/me/watchlist', { method: 'POST', body: { asset_id: assetId } });
      } else {
        await apiFetch(`/v1/me/watchlist/${assetId}`, { method: 'DELETE' });
      }
    } catch {
      // Sin sesión u otro fallo: redirige a login en vez de fingir que se guardó.
      setSaved(!next);
      window.location.href = `/auth/login?next=${encodeURIComponent(window.location.pathname)}`;
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? 'Quitar de seguimiento' : 'Guardar en seguimiento'}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-ink shadow-sm backdrop-blur-sm transition-transform hover:scale-105"
    >
      <svg
        className="h-[15px] w-[15px]"
        viewBox="0 0 20 20"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M10 17.2s-6.8-4.1-8.6-8C.3 6.3 1.6 3 4.7 2.6c1.8-.2 3.5.7 4.3 2.2.8-1.5 2.5-2.4 4.3-2.2 3.1.4 4.4 3.7 3.3 6.6-1.8 3.9-8.6 8-8.6 8Z" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
