import { useState } from 'react';
import { formatDateTime } from '@luxus/shared';
import { browserClient } from '../../lib/supabase';
import { apiFetch, ApiError } from '../../lib/api';

interface Session {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  device_label: string | null;
  created_at: string;
  last_seen_at: string;
}

interface Preferences {
  email_deal_activity: boolean;
  email_qa: boolean;
  email_offers: boolean;
  email_kyc: boolean;
  email_billing: boolean;
  email_new_listings: boolean;
  email_expiry_alerts: boolean;
  in_app_enabled: boolean;
  digest_frequency: 'instant' | 'daily' | 'weekly' | 'off';
}

interface Props {
  profile: { full_name: string | null; phone: string | null; city: string | null; country: string | null; mfa_enrolled: boolean };
  preferences: Preferences | null;
  sessions: Session[];
}

const PREF_LABELS: { key: keyof Preferences; label: string; description: string }[] = [
  { key: 'email_deal_activity', label: 'Actividad de Deal Room', description: 'Solicitudes, aprobaciones y cambios de etapa.' },
  { key: 'email_qa', label: 'Preguntas y respuestas', description: 'Nuevos mensajes en los hilos de Q&A.' },
  { key: 'email_offers', label: 'Ofertas y LOI', description: 'Ofertas recibidas, respuestas y cartas de intención.' },
  { key: 'email_expiry_alerts', label: 'Vencimiento de accesos', description: 'Aviso antes de que caduque un permiso documental.' },
  { key: 'email_kyc', label: 'Verificación', description: 'Resultado del proceso de KYC y screening.' },
  { key: 'email_billing', label: 'Facturación', description: 'Recibos, renovaciones e incidencias de pago.' },
  { key: 'email_new_listings', label: 'Nuevos activos', description: 'Incorporaciones que encajan con su perfil.' },
];

export default function AccountSettings({ profile, preferences, sessions: initialSessions }: Props) {
  const [form, setForm] = useState({
    full_name: profile.full_name ?? '',
    phone: profile.phone ?? '',
    city: profile.city ?? '',
    country: profile.country ?? 'PE',
  });
  const [prefs, setPrefs] = useState<Preferences>(
    preferences ?? {
      email_deal_activity: true, email_qa: true, email_offers: true, email_kyc: true,
      email_billing: true, email_new_listings: true, email_expiry_alerts: true,
      in_app_enabled: true, digest_frequency: 'instant',
    },
  );
  const [sessions, setSessions] = useState(initialSessions);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch('/v1/me', {
        method: 'PATCH',
        body: {
          full_name: form.full_name || undefined,
          phone: form.phone || undefined,
          city: form.city || undefined,
          country: form.country || undefined,
        },
      });
      setMessage('Datos actualizados.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron guardar los cambios.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePrefs() {
    setSavingPrefs(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch('/v1/me/notification-preferences', { method: 'PATCH', body: prefs });
      setMessage('Preferencias guardadas.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron guardar las preferencias.');
    } finally {
      setSavingPrefs(false);
    }
  }

  /**
   * Cierre de sesión remoto: revoca todas las sesiones del usuario, incluida
   * la actual. Es la respuesta correcta ante un dispositivo perdido.
   */
  async function revokeAll() {
    setRevoking(true);
    setError(null);
    try {
      await apiFetch('/v1/me/sessions/revoke-all', { method: 'POST' });
      setSessions([]);
      await browserClient().auth.signOut();
      window.location.href = '/auth/login?revoked=1';
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cerrar las sesiones.');
      setRevoking(false);
    }
  }

  return (
    <div className="space-y-12">
      {(message || error) && (
        <p
          role="status"
          className={`border-l-2 px-5 py-3.5 text-[13.5px] ${
            error ? 'border-red-700 bg-red-50 text-red-800' : 'border-gold bg-white text-ink'
          }`}
        >
          {error ?? message}
        </p>
      )}

      {/* Datos personales */}
      <section aria-labelledby="profile-title">
        <h2 id="profile-title" className="font-display text-[24px]">Datos personales</h2>

        <form onSubmit={saveProfile} className="mt-5 border border-stone bg-white p-7">
          <div className="space-y-5">
            <div>
              <label className="label" htmlFor="s-name">Nombre completo</label>
              <input
                id="s-name" className="field" maxLength={160} value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="s-phone">Teléfono</label>
                <input
                  id="s-phone" type="tel" className="field" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="s-city">Ciudad</label>
                <input
                  id="s-city" className="field" value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="s-country">País</label>
                <input
                  id="s-country" className="field" value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </div>
            </div>
          </div>

          <button type="submit" disabled={savingProfile} className="btn-primary mt-6 px-6 py-2.5">
            {savingProfile ? 'Guardando…' : 'Guardar'}
          </button>

          <p className="mt-5 text-[12px] leading-relaxed text-ink-muted">
            El nombre legal utilizado en la verificación de identidad no se
            modifica desde aquí: forma parte de su expediente de cumplimiento.
          </p>
        </form>
      </section>

      {/* Seguridad */}
      <section aria-labelledby="security-title">
        <h2 id="security-title" className="font-display text-[24px]">Seguridad</h2>

        <div className="mt-5 border border-stone bg-white p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[15px]">Verificación en dos pasos</p>
              <p className="mt-1 text-[13px] text-ink-muted">
                {profile.mfa_enrolled
                  ? 'Activa. Se solicita en cada acceso.'
                  : 'Se activa en su próximo inicio de sesión.'}
              </p>
            </div>
            <span className={`badge ${profile.mfa_enrolled ? 'border-ink bg-ink text-white' : 'border-gold text-gold-dark'}`}>
              {profile.mfa_enrolled ? 'Activa' : 'Pendiente'}
            </span>
          </div>

          <div className="mt-7 border-t border-stone pt-7">
            <p className="text-[15px]">Sesiones activas</p>

            {sessions.length === 0 ? (
              <p className="mt-3 text-[13px] text-ink-muted">Sin sesiones registradas.</p>
            ) : (
              <ul className="mt-4 divide-y divide-stone border-y border-stone">
                {sessions.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px]">
                        {item.device_label ?? item.user_agent?.slice(0, 60) ?? 'Dispositivo desconocido'}
                      </p>
                      <p className="mt-0.5 text-[12px] text-ink-muted">
                        {item.ip_address ?? 'IP desconocida'} · última actividad{' '}
                        {formatDateTime(item.last_seen_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={revokeAll}
              disabled={revoking}
              className="btn-ghost mt-5 px-6 py-2.5 hover:border-red-600 hover:text-red-700"
            >
              {revoking ? 'Cerrando…' : 'Cerrar todas las sesiones'}
            </button>

            <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
              Cierra la sesión en todos los dispositivos, incluido este. Deberá
              volver a acceder con su segundo factor.
            </p>
          </div>
        </div>
      </section>

      {/* Notificaciones */}
      <section id="notifications" aria-labelledby="notif-title">
        <h2 id="notif-title" className="font-display text-[24px]">Notificaciones</h2>

        <div className="mt-5 border border-stone bg-white">
          <ul className="divide-y divide-stone">
            {PREF_LABELS.map((pref) => (
              <li key={pref.key} className="flex items-start justify-between gap-5 p-5">
                <div className="min-w-0">
                  <p className="text-[14.5px]">{pref.label}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                    {pref.description}
                  </p>
                </div>
                <label className="shrink-0">
                  <span className="sr-only">Activar {pref.label}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-ink"
                    checked={Boolean(prefs[pref.key])}
                    onChange={(e) => setPrefs({ ...prefs, [pref.key]: e.target.checked })}
                  />
                </label>
              </li>
            ))}

            <li className="flex items-start justify-between gap-5 p-5">
              <div>
                <p className="text-[14.5px]">Frecuencia de resumen</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                  Agrupa los correos no urgentes.
                </p>
              </div>
              <select
                aria-label="Frecuencia de resumen"
                className="shrink-0 border border-stone-dark bg-white px-3 py-2 text-[13px]"
                value={prefs.digest_frequency}
                onChange={(e) =>
                  setPrefs({ ...prefs, digest_frequency: e.target.value as Preferences['digest_frequency'] })
                }
              >
                <option value="instant">Inmediato</option>
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
                <option value="off">Desactivado</option>
              </select>
            </li>
          </ul>

          <div className="border-t border-stone p-5">
            <button type="button" onClick={savePrefs} disabled={savingPrefs} className="btn-primary px-6 py-2.5">
              {savingPrefs ? 'Guardando…' : 'Guardar preferencias'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
