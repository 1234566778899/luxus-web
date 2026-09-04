import { useState } from 'react';
import { API_URL } from '../../lib/env';
import { browserClient } from '../../lib/supabase';

interface Props {
  /** Query actual de la página (acción, fechas…), sin `format` ni `page`. */
  queryString: string;
}

/**
 * Descarga el CSV de auditoría.
 *
 * El endpoint exige el token de sesión en la cabecera Authorization, así que
 * un enlace simple no sirve: se pide como blob autenticado y se entrega con
 * un enlace de descarga efímero.
 */
export default function AuditExportButton({ queryString }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const { data } = await browserClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Sesión no válida.');

      const params = new URLSearchParams(queryString);
      params.set('format', 'csv');
      params.set('pageSize', '500');

      const response = await fetch(`${API_URL}/v1/admin/audit?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('No se pudo generar el archivo.');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `luxus-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={download} disabled={busy} className="btn-outline px-6 py-2.5">
        {busy ? 'Generando…' : 'Exportar CSV'}
      </button>
      {error && <p role="alert" className="mt-2 text-[12px] text-red-800">{error}</p>}
    </div>
  );
}
