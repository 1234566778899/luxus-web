import { useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';

interface Props {
  assetId: string;
}

interface PrivateMedia {
  id: string;
  url: string | null;
  alt_text: string | null;
  caption: string | null;
}

/**
 * Material reservado (Nivel II).
 *
 * Las URL las firma la API con vigencia corta, y solo después de comprobar
 * contra RLS que quien pide tiene derecho al activo. Nada de esto se
 * pre-renderiza en el HTML.
 */
export default function PrivateMediaPanel({ assetId }: Props) {
  const [items, setItems] = useState<PrivateMedia[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ media: PrivateMedia[] }>(
        `/v1/assets/${assetId}/private-media`,
      );
      setItems(data.media);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el material reservado.');
    } finally {
      setLoading(false);
    }
  }

  if (items) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {items.length === 0 && (
          <p className="text-[14px] text-ink-muted">
            Este activo aún no tiene material reservado cargado.
          </p>
        )}
        {items.map((item) => (
          <figure key={item.id} className="overflow-hidden bg-stone">
            {item.url && (
              <img
                src={item.url}
                alt={item.alt_text ?? 'Material reservado'}
                loading="lazy"
                className="aspect-[3/2] w-full object-cover"
              />
            )}
            {item.caption && (
              <figcaption className="px-3 py-2 text-[12px] text-ink-muted">{item.caption}</figcaption>
            )}
          </figure>
        ))}
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={load} disabled={loading} className="btn-outline">
        {loading ? 'Cargando…' : 'Ver material reservado'}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-red-800">{error}</p>
      )}
      <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
        Los enlaces se firman en el momento y caducan en cinco minutos.
      </p>
    </div>
  );
}
