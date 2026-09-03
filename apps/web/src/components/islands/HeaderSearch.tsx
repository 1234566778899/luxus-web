import { useEffect, useMemo, useRef, useState } from 'react';
import { PERU_PRIME_LOCATIONS } from '@luxus/shared';
import type { AssetCategory } from '@luxus/shared';

interface Props {
  category: AssetCategory;
  /** Prellenado desde el distrito o el texto libre ya aplicado en la URL. */
  initialValue?: string;
  light?: boolean;
}

/**
 * Buscador embebido en el encabezado, al estilo del que un marketplace de
 * lujo de referencia muestra al entrar a una categoría: sustituye la
 * navegación por un campo de texto que sugiere ubicaciones mientras se
 * escribe y cae a búsqueda libre por título si no hay coincidencia.
 *
 * Sin autocompletado externo: el universo de distritos es la misma lista
 * curada (`PERU_PRIME_LOCATIONS`) que ya usa el wizard de publicación, así
 * que una sugerencia elegida aquí siempre corresponde a un valor real de
 * `assets.district`.
 */
export default function HeaderSearch({ category, initialValue = '', light = false }: Props) {
  const [query, setQuery] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const term = query.trim().toLowerCase();
    const pool = term
      ? PERU_PRIME_LOCATIONS.filter(
          (l) =>
            l.district.toLowerCase().includes(term) ||
            l.region.toLowerCase().includes(term) ||
            l.province.toLowerCase().includes(term),
        )
      : PERU_PRIME_LOCATIONS;
    return pool.slice(0, 6);
  }, [query]);

  const exactMatch = suggestions.find((l) => l.district.toLowerCase() === query.trim().toLowerCase());

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  function goToDistrict(district: string) {
    window.location.href = `/collection/${category}?district=${encodeURIComponent(district)}`;
  }

  function goToFreeText(text: string) {
    window.location.href = `/collection/${category}?q=${encodeURIComponent(text)}`;
  }

  function submit() {
    const term = query.trim();
    if (!term) return;
    if (exactMatch) goToDistrict(exactMatch.district);
    else goToFreeText(term);
  }

  // Tratamiento tipo píldora, sin borde: en reposo es un relleno gris muy
  // suave (translúcido sobre foto cuando el header es `light`, sólido sobre
  // fondo blanco), y al enfocarse pasa a blanco sólido con una sombra suave
  // en vez de un borde — el mismo lenguaje visual de un marketplace de lujo
  // de referencia. El estado "activo" lo decide React (no CSS puro) porque
  // debe imponerse igual esté el header transparente o ya sólido por scroll;
  // solo el reposo (`light` + `group-data-[scrolled=true]/header:`) sigue
  // dependiendo del listener de scroll fuera de React.
  const active = open;
  const shellClass = active
    ? 'rounded-t-2xl bg-white text-ink shadow-[0_16px_40px_-12px_rgba(10,10,10,0.28)]'
    : light
      ? 'rounded-full bg-white/[15%] text-white group-data-[scrolled=true]/header:bg-stone/70 group-data-[scrolled=true]/header:text-ink'
      : 'rounded-full bg-stone/70 text-ink';
  const iconClass = active
    ? 'text-ink-muted'
    : light
      ? 'text-white/70 group-data-[scrolled=true]/header:text-ink-muted'
      : 'text-ink-muted';
  const placeholderClass = active
    ? 'placeholder:text-ink-muted/60'
    : light
      ? 'placeholder:text-white/60 group-data-[scrolled=true]/header:placeholder:text-ink-muted/60'
      : 'placeholder:text-ink-muted/60';
  const clearClass = active
    ? 'text-ink-muted hover:text-ink'
    : light
      ? 'text-white/60 hover:text-white group-data-[scrolled=true]/header:text-ink-muted group-data-[scrolled=true]/header:hover:text-ink'
      : 'text-ink-muted hover:text-ink';
  const textClass = active ? 'text-ink' : light ? 'text-white group-data-[scrolled=true]/header:text-ink' : 'text-ink';

  return (
    <div ref={rootRef} className="relative w-full max-w-md">
      <div className={`flex items-center gap-2.5 px-4 py-3 transition-colors duration-200 ${shellClass}`}>
        <svg
          className={`h-4 w-4 shrink-0 transition-colors duration-200 ${iconClass}`}
          viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"
        >
          <circle cx="7" cy="7" r="5" />
          <path d="M11 11 L14.5 14.5" strokeLinecap="round" />
        </svg>

        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Distrito, región o palabra clave"
          aria-label="Buscar activos"
          className={`w-full border-0 bg-transparent p-0 text-[13.5px] transition-colors duration-200 focus:outline-none focus:ring-0 ${textClass} ${placeholderClass}`}
        />

        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            aria-label="Vaciar búsqueda"
            className={`shrink-0 transition-colors duration-200 ${clearClass}`}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <path d="M4 4 L12 12 M12 4 L4 12" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 rounded-b-2xl bg-white text-ink shadow-[0_16px_40px_-12px_rgba(10,10,10,0.28)]">
          <p className="px-4 pt-3.5 text-[10px] uppercase tracking-luxus text-ink-muted">
            {query.trim() ? 'Sugerencias' : 'Distritos frecuentes'}
          </p>
          <ul className="mt-1.5 max-h-80 overflow-y-auto py-1.5">
            {suggestions.map((loc) => (
              <li key={loc.district}>
                <button
                  type="button"
                  onClick={() => goToDistrict(loc.district)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13.5px] transition-colors hover:bg-ivory"
                >
                  <svg className="h-3.5 w-3.5 shrink-0 text-gold-dark" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                    <path d="M8 14.5S3 10 3 6.5a5 5 0 0 1 10 0C13 10 8 14.5 8 14.5Z" strokeLinejoin="round" />
                    <circle cx="8" cy="6.5" r="1.8" />
                  </svg>
                  <span>{loc.district}</span>
                  <span className="ml-auto text-[11px] text-ink-muted">{loc.region}</span>
                </button>
              </li>
            ))}
            {suggestions.length === 0 && (
              <li className="px-4 py-3 text-[13px] text-ink-muted">Sin coincidencias entre los distritos.</li>
            )}

            {query.trim() && !exactMatch && (
              <li className="border-t border-stone">
                <button
                  type="button"
                  onClick={() => goToFreeText(query.trim())}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13.5px] transition-colors hover:bg-ivory"
                >
                  <svg className="h-3.5 w-3.5 shrink-0 text-ink-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                    <circle cx="7" cy="7" r="5" />
                    <path d="M11 11 L14.5 14.5" strokeLinecap="round" />
                  </svg>
                  <span>Buscar «{query.trim()}»</span>
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
