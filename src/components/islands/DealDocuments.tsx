import { useState } from 'react';
import { FOLDER_META, PERMISSION_EXPIRY_OPTIONS, formatBytes, formatDate } from '@luxus/shared';
import type { DocumentFolder } from '@luxus/shared';
import DocumentViewer from './DocumentViewer';
import { apiFetch, ApiError } from '../../lib/api';

interface DocNode {
  document: { id: string; name: string; description: string | null; folder: DocumentFolder };
  currentVersion: { id: string; version: number; file_name: string; size_bytes: number | null; created_at: string } | null;
  versions: { id: string; version: number; created_at: string }[];
  permission: { id: string; level: 'view' | 'download'; expires_at: string | null; revoked_at: string | null } | null;
  canView: boolean;
  canDownload: boolean;
  expiresAt: string | null;
}

interface FolderNode {
  folder: DocumentFolder;
  label: string;
  description: string;
  documents: DocNode[];
  accessibleCount: number;
  totalCount: number;
}

interface Props {
  dealId: string;
  buyerId: string;
  tree: FolderNode[];
  /** El vendedor gestiona permisos; el comprador solo consulta. */
  isSellerSide: boolean;
  roomOpen: boolean;
}

export default function DealDocuments({ dealId, buyerId, tree, isSellerSide, roomOpen }: Props) {
  const [open, setOpen] = useState<DocumentFolder | null>(tree.find((f) => f.documents.length > 0)?.folder ?? null);
  const [viewing, setViewing] = useState<{ id: string; name: string; version: number; canDownload: boolean } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [granting, setGranting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<'view' | 'download'>('view');
  const [expiryDays, setExpiryDays] = useState(30);

  function toggleSelect(documentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(documentId)) next.delete(documentId);
      else next.add(documentId);
      return next;
    });
  }

  async function grant() {
    if (selected.size === 0) return;
    setGranting(true);
    setError(null);
    try {
      await apiFetch('/v1/permissions/grant', {
        method: 'POST',
        body: {
          deal_id: dealId,
          user_id: buyerId,
          document_ids: [...selected],
          level,
          expires_in_days: expiryDays,
        },
      });
      window.location.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron conceder los permisos.');
      setGranting(false);
    }
  }

  async function revoke(permissionId: string) {
    setError(null);
    try {
      await apiFetch('/v1/permissions/revoke', {
        method: 'POST',
        body: { permission_id: permissionId, reason: 'Revocado por el vendedor' },
      });
      window.location.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo revocar el permiso.');
    }
  }

  const totalAccessible = tree.reduce((sum, f) => sum + f.accessibleCount, 0);

  return (
    <>
      {error && (
        <p role="alert" className="mb-4 border-l-2 border-red-700 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {error}
        </p>
      )}

      {/* Barra de concesión (solo vendedor) */}
      {isSellerSide && selected.size > 0 && (
        <div className="sticky top-20 z-20 mb-4 flex flex-wrap items-center gap-4 border border-ink bg-white p-5 shadow-lg">
          <p className="text-[13.5px]">
            <strong>{selected.size}</strong> {selected.size === 1 ? 'documento' : 'documentos'} seleccionados
          </p>

          <label className="flex items-center gap-2 text-[12px] uppercase tracking-luxus text-ink-muted">
            Nivel
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as 'view' | 'download')}
              className="border border-stone-dark bg-white px-3 py-1.5 text-[12px] normal-case tracking-normal"
            >
              <option value="view">Solo lectura</option>
              <option value="download">Permitir descarga</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-[12px] uppercase tracking-luxus text-ink-muted">
            Vence
            <select
              value={expiryDays}
              onChange={(e) => setExpiryDays(Number(e.target.value))}
              className="border border-stone-dark bg-white px-3 py-1.5 text-[12px] normal-case tracking-normal"
            >
              {PERMISSION_EXPIRY_OPTIONS.map((option) => (
                <option key={option.days} value={option.days}>{option.label}</option>
              ))}
            </select>
          </label>

          <div className="ml-auto flex gap-2">
            <button type="button" onClick={grant} disabled={granting} className="btn-primary px-6 py-2.5">
              {granting ? 'Concediendo…' : 'Conceder acceso'}
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="btn-ghost px-5 py-2.5">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!isSellerSide && (
        <p className="mb-5 text-[13.5px] leading-relaxed text-ink-muted">
          Tiene acceso a {totalAccessible} {totalAccessible === 1 ? 'documento' : 'documentos'}.
          Los documentos sin permiso no se muestran. Solicite ampliación al
          vendedor desde el apartado de preguntas.
        </p>
      )}

      <div className="border border-stone bg-white">
        <ul className="divide-y divide-stone">
          {tree.map((folder) => {
            const isOpen = open === folder.folder;
            const hidden = folder.totalCount - folder.accessibleCount;

            return (
              <li key={folder.folder}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : folder.folder)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-ivory"
                >
                  <div>
                    <span className="text-[15px]">{FOLDER_META[folder.folder].label}</span>
                    <span className="ml-3 text-[12px] text-ink-muted">
                      {folder.accessibleCount}
                      {isSellerSide && hidden > 0 && ` de ${folder.totalCount}`}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-ink-muted">
                      {FOLDER_META[folder.folder].description}
                    </span>
                  </div>
                  <span aria-hidden="true" className="shrink-0 text-ink-muted">{isOpen ? '−' : '+'}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-stone bg-ivory px-6 py-5">
                    {folder.documents.length === 0 ? (
                      <p className="text-[13.5px] text-ink-muted">
                        {isSellerSide
                          ? 'Sin documentos en esta carpeta.'
                          : 'No tiene acceso a documentos de esta carpeta.'}
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {folder.documents.map((node) => {
                          const expired =
                            node.expiresAt !== null && new Date(node.expiresAt).getTime() < Date.now();
                          const daysLeft = node.expiresAt
                            ? Math.ceil((new Date(node.expiresAt).getTime() - Date.now()) / 86_400_000)
                            : null;

                          return (
                            <li key={node.document.id} className="border border-stone bg-white p-5">
                              <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="flex min-w-0 flex-1 items-start gap-4">
                                  {isSellerSide && (
                                    <input
                                      type="checkbox"
                                      aria-label={`Seleccionar ${node.document.name}`}
                                      checked={selected.has(node.document.id)}
                                      onChange={() => toggleSelect(node.document.id)}
                                      className="mt-1 h-4 w-4 shrink-0 accent-ink"
                                    />
                                  )}

                                  <div className="min-w-0">
                                    <p className="text-[14.5px]">{node.document.name}</p>
                                    {node.document.description && (
                                      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                                        {node.document.description}
                                      </p>
                                    )}

                                    <p className="mt-2 text-[12px] text-ink-muted">
                                      {node.currentVersion
                                        ? `v${node.currentVersion.version} · ${formatBytes(node.currentVersion.size_bytes)} · ${formatDate(node.currentVersion.created_at)}`
                                        : 'Sin archivo cargado'}
                                    </p>

                                    <div className="mt-2.5 flex flex-wrap gap-2">
                                      {node.permission && (
                                        <span className="badge border-stone-dark text-[9px] text-ink-muted">
                                          {node.permission.level === 'download' ? 'Descarga' : 'Solo lectura'}
                                        </span>
                                      )}
                                      {node.expiresAt && !expired && (
                                        <span
                                          className={`badge text-[9px] ${
                                            daysLeft !== null && 7 >= daysLeft
                                              ? 'border-gold text-gold-dark'
                                              : 'border-stone-dark text-ink-muted'
                                          }`}
                                        >
                                          Vence {formatDate(node.expiresAt)}
                                        </span>
                                      )}
                                      {expired && (
                                        <span className="badge border-red-400 text-[9px] text-red-700">
                                          Vencido
                                        </span>
                                      )}
                                      {!node.permission && isSellerSide && (
                                        <span className="badge border-stone-dark text-[9px] text-ink-muted">
                                          Sin conceder
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex shrink-0 flex-wrap gap-2">
                                  {node.canView && node.currentVersion && roomOpen && !expired && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setViewing({
                                          id: node.document.id,
                                          name: node.currentVersion!.file_name,
                                          version: node.currentVersion!.version,
                                          canDownload: node.canDownload,
                                        })
                                      }
                                      className="btn-ghost px-4 py-2 text-[10px]"
                                    >
                                      Abrir
                                    </button>
                                  )}

                                  {isSellerSide && node.permission && !node.permission.revoked_at && (
                                    <button
                                      type="button"
                                      onClick={() => revoke(node.permission!.id)}
                                      className="btn-ghost px-4 py-2 text-[10px] hover:border-red-600 hover:text-red-700"
                                    >
                                      Revocar
                                    </button>
                                  )}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {viewing && (
        <DocumentViewer
          documentId={viewing.id}
          fileName={viewing.name}
          version={viewing.version}
          canDownload={viewing.canDownload}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}
