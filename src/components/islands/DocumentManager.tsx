import { useEffect, useState } from 'react';
import { DOCUMENT_FOLDERS, FOLDER_META, formatBytes, formatDate } from '@luxus/shared';
import type { DocumentFolder } from '@luxus/shared';
import { browserClient } from '../../lib/supabase';
import { apiFetch, ApiError } from '../../lib/api';

interface Props {
  assetId: string;
}

interface DocVersion {
  id: string;
  version: number;
  file_name: string;
  mime_type: string;
  size_bytes: number | null;
  sha256: string | null;
  change_note: string | null;
  created_at: string;
}

interface Doc {
  id: string;
  folder: DocumentFolder;
  name: string;
  description: string | null;
  version_count: number;
  current_version_id: string | null;
  document_versions?: DocVersion[];
}

/**
 * Árbol documental del vendedor.
 *
 * Subida en dos tiempos: la API firma una URL, el navegador sube directo al
 * bucket privado y luego se registra la versión. El binario no atraviesa el
 * servidor de render y el hash se calcula del lado del servidor.
 */
export default function DocumentManager({ assetId }: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openFolder, setOpenFolder] = useState<DocumentFolder | null>('corporate');
  const [creating, setCreating] = useState<DocumentFolder | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);

  async function load() {
    setLoading(true);
    const supabase = browserClient();
    const { data, error: queryError } = await supabase
      .from('documents')
      .select('id, folder, name, description, version_count, current_version_id, document_versions (id, version, file_name, mime_type, size_bytes, sha256, change_note, created_at)')
      .eq('asset_id', assetId)
      .is('deleted_at', null)
      .order('folder')
      .order('name');

    if (queryError) setError(queryError.message);
    setDocs((data ?? []) as unknown as Doc[]);
    setLoading(false);
  }

  async function createDocument(folder: DocumentFolder, name: string, description: string) {
    setError(null);
    try {
      await apiFetch('/v1/documents', {
        method: 'POST',
        body: { asset_id: assetId, folder, name, description: description || undefined },
      });
      setCreating(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el documento.');
    }
  }

  async function uploadVersion(documentId: string, file: File, changeNote: string) {
    setUploadingFor(documentId);
    setError(null);

    try {
      const { bucket, path, token } = await apiFetch<{
        bucket: string; path: string; token: string;
      }>('/v1/documents/upload-url', {
        method: 'POST',
        body: { asset_id: assetId, document_id: documentId, file_name: file.name },
      });

      const { error: uploadError } = await browserClient()
        .storage.from(bucket)
        .uploadToSignedUrl(path, token, file);

      if (uploadError) throw new Error(uploadError.message);

      await apiFetch('/v1/documents/versions', {
        method: 'POST',
        body: {
          document_id: documentId,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type || 'application/pdf',
          size_bytes: file.size,
          change_note: changeNote || undefined,
        },
      });

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la versión.');
    } finally {
      setUploadingFor(null);
    }
  }

  async function restoreVersion(documentId: string, version: number) {
    setError(null);
    try {
      await apiFetch('/v1/documents/restore', {
        method: 'POST',
        body: { document_id: documentId, version },
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo restaurar la versión.');
    }
  }

  async function removeDocument(documentId: string) {
    setError(null);
    try {
      await apiFetch(`/v1/documents/${documentId}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el documento.');
    }
  }

  if (loading) {
    return (
      <div className="border border-stone bg-white p-8 text-[14px] text-ink-muted">
        Cargando documentación…
      </div>
    );
  }

  return (
    <div className="border border-stone bg-white">
      {error && (
        <p role="alert" className="border-b border-red-200 bg-red-50 px-6 py-3 text-[13px] text-red-800">
          {error}
        </p>
      )}

      <ul className="divide-y divide-stone">
        {DOCUMENT_FOLDERS.map((folder) => {
          const folderDocs = docs.filter((d) => d.folder === folder);
          const open = openFolder === folder;

          return (
            <li key={folder}>
              <button
                type="button"
                onClick={() => setOpenFolder(open ? null : folder)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-ivory"
              >
                <div>
                  <span className="text-[15px]">{FOLDER_META[folder].label}</span>
                  <span className="ml-3 text-[12px] text-ink-muted">
                    {folderDocs.length} {folderDocs.length === 1 ? 'documento' : 'documentos'}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-ink-muted">
                    {FOLDER_META[folder].description}
                  </span>
                </div>
                <span aria-hidden="true" className="shrink-0 text-ink-muted">{open ? '−' : '+'}</span>
              </button>

              {open && (
                <div className="border-t border-stone bg-ivory px-6 py-5">
                  {folderDocs.length === 0 && creating !== folder && (
                    <p className="text-[13.5px] text-ink-muted">Sin documentos en esta carpeta.</p>
                  )}

                  {folderDocs.length > 0 && (
                    <ul className="space-y-3">
                      {folderDocs.map((doc) => {
                        const versions = [...(doc.document_versions ?? [])].sort(
                          (a, b) => b.version - a.version,
                        );
                        const current = versions[0];
                        const showHistory = historyFor === doc.id;

                        return (
                          <li key={doc.id} className="border border-stone bg-white p-5">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <p className="text-[14.5px]">{doc.name}</p>
                                {doc.description && (
                                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                                    {doc.description}
                                  </p>
                                )}
                                {current ? (
                                  <p className="mt-2 text-[12px] text-ink-muted">
                                    v{current.version} · {formatBytes(current.size_bytes)} ·{' '}
                                    {formatDate(current.created_at)}
                                  </p>
                                ) : (
                                  <p className="mt-2 text-[12px] text-gold-dark">Sin archivo cargado</p>
                                )}
                              </div>

                              <div className="flex shrink-0 flex-wrap gap-2">
                                <label className={`btn-ghost cursor-pointer px-4 py-2 text-[10px] ${uploadingFor === doc.id ? 'pointer-events-none opacity-50' : ''}`}>
                                  {uploadingFor === doc.id ? 'Subiendo…' : current ? 'Nueva versión' : 'Cargar'}
                                  <input
                                    type="file"
                                    className="sr-only"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      const note = current
                                        ? window.prompt('Nota de cambio (opcional)') ?? ''
                                        : '';
                                      void uploadVersion(doc.id, file, note);
                                    }}
                                  />
                                </label>

                                {versions.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setHistoryFor(showHistory ? null : doc.id)}
                                    className="btn-ghost px-4 py-2 text-[10px]"
                                  >
                                    {versions.length} versiones
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => removeDocument(doc.id)}
                                  className="btn-ghost px-4 py-2 text-[10px] hover:border-red-600 hover:text-red-700"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </div>

                            {showHistory && (
                              <ol className="mt-5 divide-y divide-stone border-t border-stone">
                                {versions.map((version) => (
                                  <li key={version.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                                    <div className="min-w-0">
                                      <p className="text-[13px]">
                                        v{version.version}
                                        {version.id === doc.current_version_id && (
                                          <span className="ml-2 text-[10px] uppercase tracking-luxus text-gold-dark">
                                            Vigente
                                          </span>
                                        )}
                                      </p>
                                      <p className="mt-0.5 text-[12px] text-ink-muted">
                                        {formatDate(version.created_at)} · {formatBytes(version.size_bytes)}
                                        {version.change_note ? ` · ${version.change_note}` : ''}
                                      </p>
                                      {version.sha256 && (
                                        <p className="mt-0.5 break-all font-mono text-[10px] text-ink-muted/60">
                                          {version.sha256.slice(0, 24)}…
                                        </p>
                                      )}
                                    </div>

                                    {version.id !== doc.current_version_id && (
                                      <button
                                        type="button"
                                        onClick={() => restoreVersion(doc.id, version.version)}
                                        className="btn-ghost shrink-0 px-4 py-1.5 text-[10px]"
                                      >
                                        Restaurar
                                      </button>
                                    )}
                                  </li>
                                ))}
                              </ol>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {creating === folder ? (
                    <form
                      className="mt-4 border border-stone bg-white p-5"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        void createDocument(
                          folder,
                          String(form.get('name') ?? ''),
                          String(form.get('description') ?? ''),
                        );
                      }}
                    >
                      <div className="space-y-4">
                        <div>
                          <label className="label" htmlFor={`name-${folder}`}>Nombre del documento</label>
                          <input
                            id={`name-${folder}`} name="name" required minLength={3} maxLength={255}
                            className="field" placeholder="Copia literal de partida registral.pdf"
                          />
                        </div>
                        <div>
                          <label className="label" htmlFor={`desc-${folder}`}>Descripción</label>
                          <input id={`desc-${folder}`} name="description" maxLength={1000} className="field" />
                        </div>
                      </div>
                      <div className="mt-5 flex gap-3">
                        <button type="submit" className="btn-primary px-6 py-2.5">Crear</button>
                        <button type="button" onClick={() => setCreating(null)} className="btn-ghost px-6 py-2.5">
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCreating(folder)}
                      className="btn-ghost mt-4 px-5 py-2.5"
                    >
                      Añadir documento
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
