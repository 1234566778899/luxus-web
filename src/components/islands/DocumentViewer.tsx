import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';

interface Props {
  documentId: string;
  fileName: string;
  version: number;
  canDownload: boolean;
  onClose: () => void;
}

interface AccessResponse {
  url: string;
  expiresIn: number;
  expiresAt: string;
  watermarked: boolean;
  fileName: string;
  version: number;
  mimeType: string;
}

/**
 * Visor de PDF embebido.
 *
 * La URL la firma el backend tras comprobar KYC, NDA y permiso vigente, dura
 * cinco minutos y apunta a una copia con marca de agua personal. Cuando el
 * enlace caduca, el visor lo dice y ofrece pedir uno nuevo: eso vuelve a
 * pasar por todas las comprobaciones y deja otra entrada en el audit log.
 */
export default function DocumentViewer({
  documentId, fileName, version, canDownload, onClose,
}: Props) {
  const [access, setAccess] = useState<AccessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);

  async function requestAccess(intent: 'view' | 'download') {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ intent });
      if (version) params.set('version', String(version));
      const data = await apiFetch<AccessResponse>(
        `/v1/documents/${documentId}/access?${params.toString()}`,
      );

      if (intent === 'download') {
        window.open(data.url, '_blank', 'noopener');
        setLoading(false);
        return;
      }

      setAccess(data);
      setSecondsLeft(data.expiresIn);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo abrir el documento.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void requestAccess('view');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, version]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const expired = access !== null && secondsLeft === 0;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Documento ${fileName}`}
      className="fixed inset-0 z-[95] flex flex-col bg-ink-deep/[96%] backdrop-blur"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-3.5">
        <div className="min-w-0">
          <p className="truncate text-[14px] text-white">{fileName}</p>
          <p className="mt-0.5 text-[11px] uppercase tracking-luxus text-white/[45%]">
            Versión {version} · Confidencial
          </p>
        </div>

        <div className="flex items-center gap-4">
          {access && !expired && (
            <p className="text-[11px] uppercase tracking-luxus text-white/50" aria-live="polite">
              Enlace válido {minutes}:{seconds}
            </p>
          )}

          {canDownload && (
            <button
              type="button"
              onClick={() => requestAccess('download')}
              className="text-[11px] uppercase tracking-luxus text-white/70 hover:text-white"
            >
              Descargar
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="text-[11px] uppercase tracking-luxus text-white/70 hover:text-white"
          >
            Cerrar ✕
          </button>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden">
        {loading && (
          <p className="absolute inset-0 flex items-center justify-center text-[13px] text-white/50">
            Preparando documento con marca de agua…
          </p>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-md border border-white/[15%] bg-ink p-8 text-center">
              <p className="font-display text-[22px] text-white">No se puede abrir</p>
              <p className="mt-4 text-[14px] leading-relaxed text-white/60">{error}</p>
              <button type="button" onClick={onClose} className="btn-light mt-7">Cerrar</button>
            </div>
          </div>
        )}

        {expired && !error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink-deep/90 p-6">
            <div className="max-w-md border border-white/[15%] bg-ink p-8 text-center">
              <p className="font-display text-[22px] text-white">El enlace ha caducado</p>
              <p className="mt-4 text-[14px] leading-relaxed text-white/60">
                Los enlaces a documentación duran cinco minutos. Puede solicitar
                uno nuevo; el acceso quedará registrado de nuevo en la auditoría.
              </p>
              <button
                type="button"
                onClick={() => requestAccess('view')}
                className="btn-light mt-7"
              >
                Renovar enlace
              </button>
            </div>
          </div>
        )}

        {access && !error && (
          <iframe
            src={access.url}
            title={fileName}
            className="h-full w-full border-0 bg-white"
          />
        )}
      </div>

      <footer className="border-t border-white/10 px-5 py-3">
        <p className="text-[11px] leading-relaxed text-white/40">
          Este documento incorpora una marca de agua con su correo y la fecha de
          acceso. Cada visualización y descarga queda registrada en el log de
          auditoría, visible para el vendedor.
        </p>
      </footer>
    </div>
  );
}
