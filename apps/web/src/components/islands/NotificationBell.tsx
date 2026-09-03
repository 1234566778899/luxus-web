import { useEffect, useRef, useState } from 'react';
import type { NotificationRow } from '@luxus/shared';
import { formatRelative } from '@luxus/shared';
import { browserClient } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';

/**
 * Centro de notificaciones.
 *
 * Carga el histórico por la API y luego se suscribe al canal de realtime de
 * Supabase: las notificaciones nuevas entran sin recargar ni hacer polling.
 */
export default function NotificationBell() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await apiFetch<{ notifications: NotificationRow[]; unread: number }>(
          '/v1/me/notifications?limit=15',
        );
        if (!active) return;
        setItems(data.notifications);
        setUnread(data.unread);
      } catch {
        // Sin sesión válida el timbre simplemente no muestra nada.
      }
    }

    void load();

    const supabase = browserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user || !active) return;
      channel = supabase
        .channel(`notifications:${data.user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${data.user.id}`,
          },
          (payload) => {
            const row = payload.new as NotificationRow;
            setItems((prev) => [row, ...prev].slice(0, 15));
            setUnread((n) => n + 1);
          },
        )
        .subscribe();
    });

    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function markAllRead() {
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    await apiFetch('/v1/me/notifications/read', { method: 'POST', body: { all: true } }).catch(() => {});
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : 'Notificaciones'}
        className="relative p-2 opacity-70 transition-opacity hover:opacity-100"
      >
        <svg className="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
          <path d="M10 2.5a5 5 0 0 0-5 5v3l-1.5 3h13L15 10.5v-3a5 5 0 0 0-5-5Z" strokeLinejoin="round" />
          <path d="M8 16.5a2 2 0 0 0 4 0" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-gold px-1 text-[9px] font-medium text-ink">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 w-[min(24rem,calc(100vw-2rem))] border border-stone bg-white text-ink shadow-xl">
          <div className="flex items-center justify-between border-b border-stone px-5 py-3.5">
            <p className="text-[11px] uppercase tracking-luxus">Notificaciones</p>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="text-[11px] text-ink-muted hover:text-ink">
                Marcar todas
              </button>
            )}
          </div>

          <ul className="max-h-[26rem] overflow-y-auto">
            {items.length === 0 && (
              <li className="px-5 py-10 text-center text-[13px] text-ink-muted">
                No tiene notificaciones.
              </li>
            )}
            {items.map((item) => (
              <li key={item.id} className={item.read_at ? '' : 'bg-ivory'}>
                <a href={item.link ?? '/dashboard'} className="block border-b border-stone/70 px-5 py-4 hover:bg-ivory">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        item.severity === 'warning' ? 'bg-gold'
                          : item.severity === 'critical' ? 'bg-red-600'
                          : item.severity === 'success' ? 'bg-emerald-600'
                          : 'bg-ink/30'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-[13.5px] leading-snug text-ink">{item.title}</p>
                      {item.body && (
                        <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink-muted">
                          {item.body}
                        </p>
                      )}
                      <p className="mt-1.5 text-[11px] text-ink-muted/70">
                        {formatRelative(item.created_at)}
                      </p>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>

          <a href="/dashboard/settings#notifications" className="block border-t border-stone px-5 py-3 text-center text-[11px] uppercase tracking-luxus text-ink-muted hover:text-ink">
            Preferencias
          </a>
        </div>
      )}
    </div>
  );
}
