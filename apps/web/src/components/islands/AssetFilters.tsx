import { useEffect, useMemo, useState } from 'react';
import { PERU_REGIONS, PRICE_BANDS, VISIBILITY_LABELS } from '@luxus/shared';

interface Props {
  category: string;
  total: number;
  initial: {
    q?: string;
    region?: string;
    visibility?: string;
    priceMin?: string;
    priceMax?: string;
    sort?: string;
  };
}

const SORTS = [
  { value: 'featured', label: 'Selección del equipo' },
  { value: 'recent', label: 'Más recientes' },
  { value: 'price_desc', label: 'Mayor precio' },
  { value: 'price_asc', label: 'Menor precio' },
] as const;

/**
 * Filtros de colección.
 *
 * Escribe en la URL y recarga: la lista la sigue resolviendo el servidor con
 * RLS, así que ningún filtro del cliente puede ampliar lo que se ve. Aquí solo
 * se decide *qué se pide*, nunca *qué se puede ver*.
 */
export default function AssetFilters({ category, total, initial }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(initial.q ?? '');
  const [region, setRegion] = useState(initial.region ?? '');
  const [visibility, setVisibility] = useState(initial.visibility ?? '');
  const [band, setBand] = useState(() => {
    const match = PRICE_BANDS.find(
      (b) =>
        String(b.min) === (initial.priceMin ?? '') &&
        String(b.max ?? '') === (initial.priceMax ?? ''),
    );
    return match?.key ?? '';
  });
  const [sort, setSort] = useState(initial.sort ?? 'featured');

  const activeCount = useMemo(
    () => [q, region, visibility, band].filter(Boolean).length,
    [q, region, visibility, band],
  );

  // El orden se aplica al instante; el resto espera a "Aplicar" para no
  // recargar en cada pulsación.
  useEffect(() => {
    if (sort === (initial.sort ?? 'featured')) return;
    apply({ sortOverride: sort });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  function apply({ sortOverride }: { sortOverride?: string } = {}) {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (region) params.set('region', region);
    if (visibility) params.set('visibility', visibility);
    const selected = PRICE_BANDS.find((b) => b.key === band);
    if (selected) {
      params.set('priceMin', String(selected.min));
      if (selected.max !== null) params.set('priceMax', String(selected.max));
    }
    const nextSort = sortOverride ?? sort;
    if (nextSort && nextSort !== 'featured') params.set('sort', nextSort);

    const query = params.toString();
    window.location.href = `/collection/${category}${query ? `?${query}` : ''}`;
  }

  function reset() {
    window.location.href = `/collection/${category}`;
  }

  return (
    <div className="border-y border-stone bg-white">
      <div className="container-page">
        <div className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="filter-panel"
              className="inline-flex items-center gap-2.5 text-[11px] uppercase tracking-luxus text-ink hover:text-gold-dark"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                <path d="M1 3h14M4 8h8M6.5 13h3" strokeLinecap="square" />
              </svg>
              Filtros
              {activeCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center bg-ink px-1 text-[10px] text-white">
                  {activeCount}
                </span>
              )}
            </button>

            <p className="text-[12px] text-ink-muted" role="status" aria-live="polite">
              {total} {total === 1 ? 'activo' : 'activos'}
            </p>
          </div>

          <label className="flex items-center gap-3 text-[11px] uppercase tracking-luxus text-ink-muted">
            <span className="hidden sm:inline">Ordenar</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="border-0 border-b border-stone-dark bg-transparent py-1 pr-6 text-[11px] uppercase tracking-luxus text-ink focus:border-ink focus:outline-none focus:ring-0"
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        {open && (
          <div id="filter-panel" className="animate-fade-in border-t border-stone py-8">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="label" htmlFor="filter-q">Buscar</label>
                <input
                  id="filter-q"
                  type="search"
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && apply()}
                  placeholder="Título del activo"
                  className="field"
                />
              </div>

              <div>
                <label className="label" htmlFor="filter-region">Región</label>
                <select
                  id="filter-region"
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                  className="field"
                >
                  <option value="">Todo el Perú</option>
                  {PERU_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="filter-price">Rango de precio</label>
                <select
                  id="filter-price"
                  value={band}
                  onChange={(event) => setBand(event.target.value)}
                  className="field"
                >
                  <option value="">Cualquier rango</option>
                  {PRICE_BANDS.map((b) => (
                    <option key={b.key} value={b.key}>{b.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="filter-visibility">Estado</label>
                <select
                  id="filter-visibility"
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value)}
                  className="field"
                >
                  <option value="">Todos</option>
                  {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => apply()} className="btn-primary px-8 py-3">
                Aplicar
              </button>
              {activeCount > 0 && (
                <button type="button" onClick={reset} className="btn-ghost px-6 py-3">
                  Limpiar
                </button>
              )}
              <p className="ml-auto max-w-md text-[12px] leading-relaxed text-ink-muted">
                El filtro de precio opera sobre el rango público. El importe
                exacto se comparte con miembros verificados.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
