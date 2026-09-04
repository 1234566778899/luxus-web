import { useState } from 'react';
import { formatDate } from '@luxus/shared';
import { apiFetch, ApiError } from '../../lib/api';

interface Props {
  dealId: string;
  nda: {
    id: string;
    status: string;
    signed_at: string | null;
    signed_sha256: string | null;
    sent_at: string | null;
    expires_at: string | null;
    template_version: string;
  } | null;
  side: 'buyer' | 'seller' | 'broker' | 'admin';
  stage: string;
}

/**
 * Acuerdo de confidencialidad del deal.
 *
 * En este entorno el proveedor de firma es simulado, así que el botón de firma
 * cierra el ciclo localmente. Con un proveedor real, el comprador se redirige
 * al sobre de firma y el webhook actualiza el estado.
 */
export default function NdaPanel({ dealId, nda, side, stage }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  const isBuyer = side === 'buyer';
  const isSellerSide = side === 'seller' || side === 'admin' || side === 'broker';

  async function openDocument() {
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ url: string | null }>(`/v1/deals/${dealId}/nda`);
      if (data.url) {
        setUrl(data.url);
        window.open(data.url, '_blank', 'noopener');
      } else {
        setError('El documento aún no está disponible.');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo abrir el documento.');
    } finally {
      setBusy(false);
    }
  }

  async function issue() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/v1/deals/${dealId}/nda/issue`, { method: 'POST' });
      window.location.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo emitir el NDA.');
      setBusy(false);
    }
  }

  async function sign() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/v1/deals/${dealId}/nda/sign`, { method: 'POST' });
      window.location.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la firma.');
      setBusy(false);
    }
  }

  if (!nda) {
    return (
      <div className="border border-stone bg-white p-7">
        <p className="text-eyebrow uppercase tracking-luxus text-ink-muted">Confidencialidad</p>
        <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">
          Aún no se ha emitido el acuerdo de confidencialidad.
        </p>
        {/* El endpoint de decisión del vendedor ya deja el deal en
            `nda_pending` antes de que exista el NDA (el registro se crea
            recién aquí) — comprobar solo `seller_review` dejaba este
            botón sin mostrarse nunca tras una aprobación normal. Debe
            coincidir con los estados que el propio endpoint de emisión
            acepta (`nda.ts`: `seller_review` o `nda_pending`). */}
        {isSellerSide && (stage === 'seller_review' || stage === 'nda_pending') && (
          <button type="button" onClick={issue} disabled={busy} className="btn-primary mt-6 w-full px-4 py-2.5">
            {busy ? 'Emitiendo…' : 'Emitir NDA'}
          </button>
        )}
        {error && <p role="alert" className="mt-4 text-[13px] text-red-800">{error}</p>}
      </div>
    );
  }

  const signed = nda.status === 'signed';

  return (
    <div className={`border p-7 ${signed ? 'border-stone bg-white' : 'border-gold bg-white'}`}>
      <p className="text-eyebrow uppercase tracking-luxus text-ink-muted">
        Acuerdo de confidencialidad
      </p>

      <p className="mt-3 font-display text-[20px]">
        {signed ? 'Firmado' : nda.status === 'sent' ? 'Pendiente de firma' : nda.status}
      </p>

      <dl className="mt-5 space-y-2.5 text-[13px]">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Plantilla</dt>
          <dd>{nda.template_version}</dd>
        </div>
        {nda.sent_at && (
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Emitido</dt>
            <dd>{formatDate(nda.sent_at)}</dd>
          </div>
        )}
        {nda.signed_at && (
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Firmado</dt>
            <dd>{formatDate(nda.signed_at)}</dd>
          </div>
        )}
        {nda.expires_at && (
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Vigencia</dt>
            <dd>{formatDate(nda.expires_at)}</dd>
          </div>
        )}
      </dl>

      {nda.signed_sha256 && (
        <div className="mt-4 border-t border-stone pt-4">
          <p className="text-[11px] uppercase tracking-luxus text-ink-muted">Huella del documento</p>
          <p className="mt-1.5 break-all font-mono text-[10.5px] text-ink-muted">
            {nda.signed_sha256}
          </p>
        </div>
      )}

      <div className="mt-6 space-y-2">
        <button type="button" onClick={openDocument} disabled={busy} className="btn-ghost w-full px-4 py-2.5">
          {busy && !url ? 'Abriendo…' : signed ? 'Ver documento firmado' : 'Leer el acuerdo'}
        </button>

        {isBuyer && !signed && (
          <button type="button" onClick={sign} disabled={busy} className="btn-primary w-full px-4 py-2.5">
            {busy ? 'Procesando…' : 'Firmar acuerdo'}
          </button>
        )}
      </div>

      {error && <p role="alert" className="mt-4 text-[13px] text-red-800">{error}</p>}

      {!signed && (
        <p className="mt-5 text-[12px] leading-relaxed text-ink-muted">
          El Deal Room permanece cerrado hasta la firma. En este entorno el
          proveedor de firma es simulado y el documento carece de efectos legales.
        </p>
      )}
    </div>
  );
}
