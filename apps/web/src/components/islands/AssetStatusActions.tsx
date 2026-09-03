import { useState } from 'react';
import type { AssetStatus } from '@luxus/shared';
import { apiFetch, ApiError } from '../../lib/api';

interface Props {
  assetId: string;
  slug: string;
  status: AssetStatus;
  hasPendingFee: boolean;
}

export default function AssetStatusActions({ assetId, slug, status, hasPendingFee }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(status);

  async function submitForReview() {
    setBusy('submit');
    setError(null);
    try {
      await apiFetch(`/v1/assets/${assetId}/submit`, { method: 'POST' });
      setCurrent('pending_review');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar a verificación.');
    } finally {
      setBusy(null);
    }
  }

  async function payListingFee() {
    setBusy('fee');
    setError(null);
    try {
      const { url } = await apiFetch<{ url: string }>('/v1/billing/listing-fee', {
        method: 'POST',
        body: { asset_id: assetId },
      });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar el pago.');
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <a href={`/dashboard/seller/assets/${assetId}`} className="btn-ghost w-full px-4 py-2.5">
        Editar
      </a>

      {(current === 'draft' || current === 'changes_requested') && (
        <button
          type="button"
          onClick={submitForReview}
          disabled={busy !== null}
          className="btn-primary w-full px-4 py-2.5"
        >
          {busy === 'submit' ? 'Enviando…' : 'Enviar a verificación'}
        </button>
      )}

      {current === 'pending_review' && (
        <p className="border border-gold bg-ivory px-4 py-3 text-[12px] leading-relaxed text-ink-muted">
          En cola de verificación. Le avisaremos por correo con la decisión.
        </p>
      )}

      {current === 'published' && (
        <>
          <a href={`/asset/${slug}`} className="btn-ghost w-full px-4 py-2.5">
            Ver ficha pública
          </a>
          <a href={`/dashboard/seller/assets/${assetId}#documents`} className="btn-ghost w-full px-4 py-2.5">
            Documentación
          </a>
        </>
      )}

      {hasPendingFee && (
        <button
          type="button"
          onClick={payListingFee}
          disabled={busy !== null}
          className="btn-gold w-full px-4 py-2.5"
        >
          {busy === 'fee' ? 'Redirigiendo…' : 'Pagar publicación'}
        </button>
      )}

      {error && (
        <p role="alert" className="text-[12px] leading-relaxed text-red-800">{error}</p>
      )}
    </div>
  );
}
