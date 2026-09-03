import { useState } from 'react';
import { formatDate, formatUsd } from '@luxus/shared';
import { apiFetch, ApiError } from '../../lib/api';

interface Offer {
  id: string;
  author_id: string;
  round: number;
  amount: number;
  currency: string;
  payment_structure: string | null;
  deposit_amount: number | null;
  conditions: string | null;
  dd_period_days: number | null;
  exclusivity_days: number | null;
  valid_until: string | null;
  status: string;
  response_note: string | null;
  created_at: string;
}

interface Props {
  dealId: string;
  userId: string;
  offers: Offer[];
  side: 'buyer' | 'seller' | 'broker' | 'admin';
  roomOpen: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  submitted: 'En estudio',
  countered: 'Contraofertada',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  withdrawn: 'Retirada',
  expired: 'Vencida',
};

export default function DealOffers({ dealId, userId, offers: initial, side, roomOpen }: Props) {
  const [offers] = useState(initial);
  const [composing, setComposing] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const live = offers.find((o) => o.status === 'submitted');
  const canRespond = live !== undefined && live.author_id !== userId;
  const isSellerSide = side === 'seller' || side === 'admin';
  const accepted = offers.find((o) => o.status === 'accepted');

  async function submitOffer(form: FormData) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/v1/offers', {
        method: 'POST',
        body: {
          deal_id: dealId,
          amount: Number(form.get('amount')),
          currency: 'USD',
          payment_structure: String(form.get('payment_structure') ?? 'cash'),
          deposit_amount: form.get('deposit_amount') ? Number(form.get('deposit_amount')) : undefined,
          conditions: String(form.get('conditions') ?? '') || undefined,
          dd_period_days: form.get('dd_period_days') ? Number(form.get('dd_period_days')) : undefined,
          exclusivity_days: form.get('exclusivity_days') ? Number(form.get('exclusivity_days')) : undefined,
          valid_until: form.get('valid_until')
            ? new Date(String(form.get('valid_until'))).toISOString()
            : undefined,
        },
      });
      window.location.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la oferta.');
      setBusy(false);
    }
  }

  async function respond(offerId: string, action: 'accept' | 'reject' | 'counter', form?: FormData) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/v1/offers/respond', {
        method: 'POST',
        body: {
          offer_id: offerId,
          action,
          response_note: form ? String(form.get('note') ?? '') || undefined : undefined,
          counter:
            action === 'counter' && form
              ? {
                  amount: Number(form.get('counter_amount')),
                  currency: 'USD',
                  payment_structure: String(form.get('counter_structure') ?? 'cash'),
                  conditions: String(form.get('counter_conditions') ?? '') || undefined,
                  dd_period_days: form.get('counter_dd') ? Number(form.get('counter_dd')) : undefined,
                  exclusivity_days: form.get('counter_excl')
                    ? Number(form.get('counter_excl'))
                    : undefined,
                }
              : undefined,
        },
      });
      window.location.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la respuesta.');
      setBusy(false);
    }
  }

  async function generateLoi(offerId: string, form: FormData) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/v1/loi', {
        method: 'POST',
        body: {
          offer_id: offerId,
          terms: {
            purchase_price: Number(form.get('price')),
            currency: 'USD',
            structure: String(form.get('structure') ?? ''),
            deposit_amount: form.get('deposit') ? Number(form.get('deposit')) : undefined,
            dd_period_days: Number(form.get('dd') ?? 30),
            exclusivity_days: Number(form.get('excl') ?? 45),
            conditions_precedent: String(form.get('conditions') ?? '')
              .split('\n')
              .map((c) => c.trim())
              .filter(Boolean),
            expiry_days: 30,
          },
        },
      });
      window.location.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo generar la LOI.');
      setBusy(false);
    }
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-4 border-l-2 border-red-700 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {error}
        </p>
      )}

      {roomOpen && !composing && !live && (
        <button type="button" onClick={() => setComposing(true)} className="btn-outline mb-5 px-6 py-2.5">
          {side === 'buyer' ? 'Presentar oferta' : 'Proponer términos'}
        </button>
      )}

      {composing && (
        <form
          className="mb-6 border border-ink bg-white p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submitOffer(new FormData(event.currentTarget));
          }}
        >
          <h3 className="font-display text-[21px]">Nueva oferta</h3>

          <div className="mt-6 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="o-amount">Importe (USD)</label>
                <input id="o-amount" name="amount" type="number" min={1} step={1000} required className="field" />
              </div>
              <div>
                <label className="label" htmlFor="o-deposit">Depósito / arras (USD)</label>
                <input id="o-deposit" name="deposit_amount" type="number" min={0} step={1000} className="field" />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="o-structure">Estructura</label>
                <select id="o-structure" name="payment_structure" className="field" defaultValue="cash">
                  <option value="cash">Contado</option>
                  <option value="escrow">Con escrow</option>
                  <option value="earn-out">Con earn-out</option>
                  <option value="financed">Financiada</option>
                  <option value="mixed">Mixta</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="o-dd">Due diligence (días)</label>
                <input id="o-dd" name="dd_period_days" type="number" min={0} max={365} className="field" defaultValue={45} />
              </div>
              <div>
                <label className="label" htmlFor="o-excl">Exclusividad (días)</label>
                <input id="o-excl" name="exclusivity_days" type="number" min={0} max={365} className="field" defaultValue={60} />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="o-valid">Vigencia de la oferta</label>
              <input id="o-valid" name="valid_until" type="date" className="field" />
            </div>

            <div>
              <label className="label" htmlFor="o-cond">Condiciones</label>
              <textarea
                id="o-cond" name="conditions" rows={4} maxLength={4000} className="field resize-none"
                placeholder="Condiciones precedentes, garantías solicitadas, permanencia del vendedor…"
              />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button type="submit" disabled={busy} className="btn-primary px-6 py-2.5">
              {busy ? 'Enviando…' : 'Presentar oferta'}
            </button>
            <button type="button" onClick={() => setComposing(false)} className="btn-ghost px-6 py-2.5">
              Cancelar
            </button>
          </div>

          <p className="mt-5 text-[12px] leading-relaxed text-ink-muted">
            La oferta es una manifestación de interés dentro de la plataforma. No
            constituye contrato ni obliga a las partes hasta la firma de la
            documentación definitiva.
          </p>
        </form>
      )}

      {offers.length === 0 ? (
        <div className="border border-stone bg-white p-10 text-center">
          <p className="font-display text-[21px]">Sin ofertas</p>
          <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-ink-muted">
            Cuando se presente una oferta formal aparecerá aquí, con su historial
            completo de contraofertas.
          </p>
        </div>
      ) : (
        <ol className="space-y-3">
          {offers.map((offer) => {
            const mine = offer.author_id === userId;
            const isLive = offer.status === 'submitted';

            return (
              <li key={offer.id} className="border border-stone bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-luxus text-ink-muted">
                      Ronda {offer.round} · {mine ? 'Su oferta' : 'De la contraparte'} ·{' '}
                      {formatDate(offer.created_at)}
                    </p>
                    <p className="mt-2 font-display text-[30px] leading-none">
                      {formatUsd(offer.amount)}
                    </p>
                  </div>

                  <span
                    className={`badge ${
                      offer.status === 'accepted' ? 'border-ink bg-ink text-white'
                        : isLive ? 'border-gold text-gold-dark'
                        : 'border-stone-dark text-ink-muted'
                    }`}
                  >
                    {STATUS_LABEL[offer.status] ?? offer.status}
                  </span>
                </div>

                <dl className="mt-5 grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2">
                  {offer.payment_structure && (
                    <div className="flex justify-between gap-4 border-b border-stone py-2">
                      <dt className="text-ink-muted">Estructura</dt>
                      <dd>{offer.payment_structure}</dd>
                    </div>
                  )}
                  {offer.deposit_amount && (
                    <div className="flex justify-between gap-4 border-b border-stone py-2">
                      <dt className="text-ink-muted">Depósito</dt>
                      <dd>{formatUsd(offer.deposit_amount)}</dd>
                    </div>
                  )}
                  {offer.dd_period_days !== null && (
                    <div className="flex justify-between gap-4 border-b border-stone py-2">
                      <dt className="text-ink-muted">Due diligence</dt>
                      <dd>{offer.dd_period_days} días</dd>
                    </div>
                  )}
                  {offer.exclusivity_days !== null && (
                    <div className="flex justify-between gap-4 border-b border-stone py-2">
                      <dt className="text-ink-muted">Exclusividad</dt>
                      <dd>{offer.exclusivity_days} días</dd>
                    </div>
                  )}
                  {offer.valid_until && (
                    <div className="flex justify-between gap-4 border-b border-stone py-2">
                      <dt className="text-ink-muted">Vigente hasta</dt>
                      <dd>{formatDate(offer.valid_until)}</dd>
                    </div>
                  )}
                </dl>

                {offer.conditions && (
                  <p className="mt-4 whitespace-pre-wrap border-l-2 border-stone-dark pl-4 text-[13.5px] leading-relaxed text-ink-muted">
                    {offer.conditions}
                  </p>
                )}

                {offer.response_note && (
                  <p className="mt-4 border-l-2 border-gold bg-ivory px-4 py-3 text-[13.5px] leading-relaxed">
                    <span className="mb-1 block text-[11px] uppercase tracking-luxus text-ink-muted">
                      Respuesta
                    </span>
                    {offer.response_note}
                  </p>
                )}

                {isLive && canRespond && roomOpen && respondingTo !== offer.id && (
                  <div className="mt-6 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => respond(offer.id, 'accept')}
                      disabled={busy}
                      className="btn-primary px-6 py-2.5"
                    >
                      Aceptar
                    </button>
                    <button
                      type="button"
                      onClick={() => setRespondingTo(offer.id)}
                      className="btn-outline px-6 py-2.5"
                    >
                      Contraofertar
                    </button>
                    <button
                      type="button"
                      onClick={() => respond(offer.id, 'reject')}
                      disabled={busy}
                      className="btn-ghost px-6 py-2.5"
                    >
                      Rechazar
                    </button>
                  </div>
                )}

                {respondingTo === offer.id && (
                  <form
                    className="mt-6 border-t border-stone pt-6"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void respond(offer.id, 'counter', new FormData(event.currentTarget));
                    }}
                  >
                    <h4 className="font-display text-[19px]">Contraoferta</h4>
                    <div className="mt-5 space-y-5">
                      <div className="grid gap-5 sm:grid-cols-3">
                        <div>
                          <label className="label" htmlFor={`c-amount-${offer.id}`}>Importe (USD)</label>
                          <input
                            id={`c-amount-${offer.id}`} name="counter_amount" type="number"
                            min={1} step={1000} required className="field"
                            defaultValue={offer.amount}
                          />
                        </div>
                        <div>
                          <label className="label" htmlFor={`c-dd-${offer.id}`}>DD (días)</label>
                          <input
                            id={`c-dd-${offer.id}`} name="counter_dd" type="number" min={0} max={365}
                            className="field" defaultValue={offer.dd_period_days ?? 30}
                          />
                        </div>
                        <div>
                          <label className="label" htmlFor={`c-excl-${offer.id}`}>Exclusividad</label>
                          <input
                            id={`c-excl-${offer.id}`} name="counter_excl" type="number" min={0} max={365}
                            className="field" defaultValue={offer.exclusivity_days ?? 45}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="label" htmlFor={`c-cond-${offer.id}`}>Condiciones</label>
                        <textarea
                          id={`c-cond-${offer.id}`} name="counter_conditions" rows={3}
                          className="field resize-none" maxLength={4000}
                        />
                      </div>

                      <div>
                        <label className="label" htmlFor={`c-note-${offer.id}`}>Nota para la contraparte</label>
                        <input id={`c-note-${offer.id}`} name="note" maxLength={2000} className="field" />
                      </div>

                      <input type="hidden" name="counter_structure" value={offer.payment_structure ?? 'cash'} />
                    </div>

                    <div className="mt-5 flex gap-3">
                      <button type="submit" disabled={busy} className="btn-primary px-6 py-2.5">
                        {busy ? 'Enviando…' : 'Enviar contraoferta'}
                      </button>
                      <button type="button" onClick={() => setRespondingTo(null)} className="btn-ghost px-6 py-2.5">
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* Generación de LOI sobre la oferta aceptada */}
      {accepted && isSellerSide && (
        <details className="mt-6 border border-gold bg-white p-6">
          <summary className="cursor-pointer font-display text-[20px]">
            Generar carta de intención
          </summary>

          <form
            className="mt-6"
            onSubmit={(event) => {
              event.preventDefault();
              void generateLoi(accepted.id, new FormData(event.currentTarget));
            }}
          >
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="loi-price">Precio acordado (USD)</label>
                  <input
                    id="loi-price" name="price" type="number" min={1} step={1000} required
                    className="field" defaultValue={accepted.amount}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="loi-deposit">Depósito (USD)</label>
                  <input
                    id="loi-deposit" name="deposit" type="number" min={0} step={1000}
                    className="field" defaultValue={accepted.deposit_amount ?? undefined}
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="loi-structure">Estructura de pago</label>
                <input
                  id="loi-structure" name="structure" required maxLength={500} className="field"
                  defaultValue={accepted.payment_structure ?? 'Contado contra entrega vía escrow externo'}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="loi-dd">Due diligence (días)</label>
                  <input
                    id="loi-dd" name="dd" type="number" min={0} max={365} className="field"
                    defaultValue={accepted.dd_period_days ?? 30}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="loi-excl">Exclusividad (días)</label>
                  <input
                    id="loi-excl" name="excl" type="number" min={0} max={365} className="field"
                    defaultValue={accepted.exclusivity_days ?? 45}
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="loi-cond">Condiciones precedentes</label>
                <textarea
                  id="loi-cond" name="conditions" rows={4} className="field resize-none"
                  placeholder="Una por línea"
                />
              </div>
            </div>

            <button type="submit" disabled={busy} className="btn-primary mt-6 px-6 py-2.5">
              {busy ? 'Generando…' : 'Generar y enviar a firma'}
            </button>

            <p className="mt-5 text-[12px] leading-relaxed text-ink-muted">
              La LOI se genera desde plantilla y se envía al flujo de firma
              electrónica. Debe revisarse con los asesores legales de cada parte
              antes de firmarse.
            </p>
          </form>
        </details>
      )}
    </div>
  );
}
