import { useCallback, useEffect, useState } from 'react';

export interface GalleryImage {
  id: string;
  url: string;
  alt: string;
  caption?: string | null;
}

interface Props {
  images: GalleryImage[];
  title: string;
  /**
   * view-transition-name para la imagen principal: la empareja con la
   * portada de la ficha para que "viaje" al navegar al detalle.
   */
  heroTransitionName?: string;
}

/**
 * Galería inmersiva: mosaico + visor a pantalla completa con teclado.
 * Solo recibe imágenes públicas; la media reservada la sirve la API firmada.
 */
export default function AssetGallery({ images, title, heroTransitionName }: Props) {
  const [index, setIndex] = useState<number | null>(null);
  const open = index !== null;

  const close = useCallback(() => setIndex(null), []);
  const next = useCallback(
    () => setIndex((i) => (i === null ? null : (i + 1) % images.length)),
    [images.length],
  );
  const prev = useCallback(
    () => setIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length)),
    [images.length],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') next();
      if (event.key === 'ArrowLeft') prev();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close, next, prev]);

  if (images.length === 0) return null;

  const [hero, ...rest] = images;

  return (
    <>
      <div className="grid gap-2 lg:grid-cols-3">
        <button
          type="button"
          onClick={() => setIndex(0)}
          className="group relative col-span-2 aspect-[3/2] overflow-hidden bg-stone focus-visible:ring-2 focus-visible:ring-gold"
          aria-label={`Abrir galería de ${title}`}
        >
          <img
            src={hero!.url}
            alt={hero!.alt}
            fetchPriority="high"
            decoding="async"
            style={heroTransitionName ? { viewTransitionName: heroTransitionName } : undefined}
            className="h-full w-full object-cover transition-transform duration-[900ms] ease-luxus group-hover:scale-[1.03]"
          />
          <span className="absolute bottom-4 right-4 inline-flex items-center gap-2 bg-white/95 px-3.5 py-2 text-[10px] uppercase tracking-luxus text-ink shadow-sm backdrop-blur-sm">
            <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <rect x="1.5" y="1.5" width="5.5" height="5.5" />
              <rect x="9" y="1.5" width="5.5" height="5.5" />
              <rect x="1.5" y="9" width="5.5" height="5.5" />
              <rect x="9" y="9" width="5.5" height="5.5" />
            </svg>
            Ver las {images.length} fotografías
          </span>
        </button>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          {rest.slice(0, 2).map((image, i) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setIndex(i + 1)}
              className="group relative aspect-[3/2] overflow-hidden bg-stone focus-visible:ring-2 focus-visible:ring-gold lg:aspect-auto"
              aria-label={`Ver fotografía ${i + 2}`}
            >
              <img
                src={image.url}
                alt={image.alt}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-[900ms] ease-luxus group-hover:scale-[1.03]"
              />
              {i === 1 && images.length > 3 && (
                <span className="absolute inset-0 flex items-center justify-center bg-ink/[55%] text-[12px] uppercase tracking-luxus text-white">
                  +{images.length - 3} más
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Galería de ${title}`}
          className="fixed inset-0 z-[90] flex flex-col bg-ink-deep/[97%] backdrop-blur"
        >
          <div className="flex items-center justify-between px-5 py-4 text-white/70">
            <p className="text-[11px] uppercase tracking-luxus">
              {index! + 1} / {images.length}
            </p>
            <button
              type="button"
              onClick={close}
              className="p-2 text-[11px] uppercase tracking-luxus hover:text-white"
              autoFocus
            >
              Cerrar ✕
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center px-4 pb-4">
            <button
              type="button"
              onClick={prev}
              aria-label="Fotografía anterior"
              className="absolute left-2 z-10 p-4 text-white/60 hover:text-white sm:left-6"
            >
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                <path d="M15 4 L7 12 L15 20" strokeLinecap="square" />
              </svg>
            </button>

            <figure className="max-h-full max-w-6xl">
              <img
                src={images[index!]!.url}
                alt={images[index!]!.alt}
                className="max-h-[78vh] w-auto object-contain"
              />
              {images[index!]!.caption && (
                <figcaption className="mt-4 text-center text-[13px] text-white/60">
                  {images[index!]!.caption}
                </figcaption>
              )}
            </figure>

            <button
              type="button"
              onClick={next}
              aria-label="Fotografía siguiente"
              className="absolute right-2 z-10 p-4 text-white/60 hover:text-white sm:right-6"
            >
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                <path d="M9 4 L17 12 L9 20" strokeLinecap="square" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
