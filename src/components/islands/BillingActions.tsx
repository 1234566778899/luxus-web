import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';

interface Props {
  planCode?: string;
  planName?: string;
  isCurrent?: boolean;
  hasSubscription?: boolean;
  /** Llega ?plan=… desde la página de membresías: arranca el checkout solo. */
  autoStart?: boolean;
}

export default function BillingActions({
  planCode, planName, isCurrent, hasSubscription, autoStart,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    if (!planCode) return;
    setBusy(true);
    setError(null);
    try {
      const { url } = await apiFetch<{ url: string }>('/v1/billing/checkout', {
        method: 'POST',
        body: { plan_code: planCode },
      });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar el pago.');
      setBusy(false);
    }
  }

  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await apiFetch<{ url: string }>('/v1/billing/portal', {
        method: 'POST',
        body: {},
      });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo abrir el portal de facturación.');
      setBusy(false);
    }
  }

  useEffect(() => {
    if (autoStart && planCode && !isCurrent) void checkout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  if (hasSubscription && !planCode) {
    return (
      <div className="shrink-0">
        <button type="button" onClick={openPortal} disabled={busy} className="btn-outline px-6 py-2.5">
          {busy ? 'Abriendo…' : 'Gestionar suscripción'}
        </button>
        {error && <p role="alert" className="mt-3 max-w-xs text-[12px] text-red-800">{error}</p>}
      </div>
    );
  }

  if (isCurrent) {
    return (
      <button type="button" onClick={openPortal} disabled={busy} className="btn-ghost w-full px-4 py-2.5">
        {busy ? 'Abriendo…' : 'Gestionar'}
      </button>
    );
  }

  return (
    <div>
      <button type="button" onClick={checkout} disabled={busy} className="btn-outline w-full px-4 py-2.5">
        {busy ? 'Redirigiendo…' : `Contratar ${planName ?? ''}`.trim()}
      </button>
      {error && <p role="alert" className="mt-3 text-[12px] leading-relaxed text-red-800">{error}</p>}
    </div>
  );
}
