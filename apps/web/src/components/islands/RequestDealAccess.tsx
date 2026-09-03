import { useState } from 'react';
import { DEAL_STAGE_META } from '@luxus/shared';
import type { DealStage } from '@luxus/shared';
import { apiFetch, ApiError } from '../../lib/api';

interface Props {
  assetId: string;
  assetTitle: string;
  existingDeal: { id: string; stage: string } | null;
  kycApproved: boolean;
}

/**
 * Solicitud de acceso al Deal Room.
 *
 * El botón no concede nada: abre una solicitud que pasa por validación de KYC
 * y por la aprobación del vendedor. El estado que se muestra es el real del
 * deal, leído del servidor.
 */
export default function RequestDealAccess({
  assetId, assetTitle, existingDeal, kycApproved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deal, setDeal] = useState(existingDeal);

  if (deal) {
    const meta = DEAL_STAGE_META[deal.stage as DealStage];
    return (
      <a href={`/deal/${deal.id}`} className="btn-outline w-full flex-col gap-1 py-4">
        <span>Ir al Deal Room</span>
        <span className="text-[10px] normal-case tracking-normal opacity-70">
          {meta?.label ?? deal.stage}
        </span>
      </a>
    );
  }

  if (!kycApproved) {
    return (
      <a href="/onboarding/kyc" className="btn-outline w-full">
        Verificar identidad para solicitar
      </a>
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);

    try {
      const result = await apiFetch<{ deal_id: string; stage: string }>('/v1/deals', {
        method: 'POST',
        body: {
          asset_id: assetId,
          request_message: String(form.get('message') ?? ''),
          intended_use: String(form.get('intended_use') ?? '') || undefined,
          financing_type: String(form.get('financing_type') ?? 'cash'),
          proof_of_funds: form.get('proof_of_funds') === 'on',
        },
      });
      setDeal({ id: result.deal_id, stage: result.stage });
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar la solicitud.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-outline w-full">
        Solicitar Deal Room
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[95] flex items-end justify-center bg-ink-deep/70 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="deal-request-title"
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto bg-white p-8 sm:p-10"
          >
            <p className="eyebrow">Solicitud de acceso</p>
            <h2 id="deal-request-title" className="mt-3 font-display text-[26px] leading-snug">
              {assetTitle}
            </h2>
            <p className="mt-4 text-[13.5px] leading-relaxed text-ink-muted">
              El vendedor revisará su solicitud. Si la aprueba, se emitirá un
              acuerdo de confidencialidad; el Deal Room se abre tras la firma.
            </p>

            <form onSubmit={submit} className="mt-8 space-y-5">
              <div>
                <label className="label" htmlFor="deal-message">Motivo de la solicitud</label>
                <textarea
                  id="deal-message" name="message" required minLength={20} maxLength={2000}
                  rows={4} className="field resize-none"
                  placeholder="Describa su interés, el horizonte de la operación y si actúa por cuenta propia."
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="deal-use">Uso previsto</label>
                  <input id="deal-use" name="intended_use" maxLength={300} className="field" />
                </div>
                <div>
                  <label className="label" htmlFor="deal-financing">Financiación</label>
                  <select id="deal-financing" name="financing_type" className="field" defaultValue="cash">
                    <option value="cash">Recursos propios</option>
                    <option value="financed">Financiada</option>
                    <option value="mixed">Mixta</option>
                  </select>
                </div>
              </div>

              <label className="flex items-start gap-3 text-[13px] leading-relaxed text-ink-muted">
                <input type="checkbox" name="proof_of_funds" className="mt-1 h-4 w-4 accent-ink" />
                Puedo acreditar disponibilidad de fondos si el vendedor lo solicita.
              </label>

              {error && (
                <p role="alert" className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-[13px] text-red-800">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <button type="submit" disabled={busy} className="btn-primary flex-1">
                  {busy ? 'Enviando…' : 'Enviar solicitud'}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
