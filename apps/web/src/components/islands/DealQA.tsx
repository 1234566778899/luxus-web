import { useEffect, useState } from 'react';
import { FOLDER_META, formatRelative } from '@luxus/shared';
import type { DocumentFolder } from '@luxus/shared';
import { browserClient } from '../../lib/supabase';
import { apiFetch, ApiError } from '../../lib/api';

interface Message {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
}

interface Thread {
  id: string;
  subject: string;
  folder: DocumentFolder | null;
  created_by: string;
  is_resolved: boolean;
  last_message_at: string;
  message_count: number;
  qa_messages?: Message[];
}

interface Props {
  dealId: string;
  userId: string;
  counterpartName: string;
  threads: Thread[];
  roomOpen: boolean;
}

/**
 * Q&A del Deal Room.
 *
 * Se suscribe al canal de realtime del deal para que la contraparte vea las
 * respuestas sin recargar. Las escrituras van por la API, que valida que el
 * Deal Room siga abierto y notifica al otro lado.
 */
export default function DealQA({ dealId, userId, counterpartName, threads: initial, roomOpen }: Props) {
  const [threads, setThreads] = useState<Thread[]>(initial);
  const [openThread, setOpenThread] = useState<string | null>(initial[0]?.id ?? null);
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = browserClient();
    const channel = supabase
      .channel(`qa:${dealId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'qa_messages', filter: `deal_id=eq.${dealId}` },
        (payload) => {
          const message = payload.new as Message & { thread_id: string };
          setThreads((prev) =>
            prev.map((thread) =>
              thread.id === message.thread_id
                ? {
                    ...thread,
                    message_count: thread.message_count + 1,
                    last_message_at: message.created_at,
                    qa_messages: [
                      ...(thread.qa_messages ?? []).filter((m) => m.id !== message.id),
                      message,
                    ],
                  }
                : thread,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [dealId]);

  async function createThread(subject: string, body: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ thread: Thread }>('/v1/qa/threads', {
        method: 'POST',
        body: { deal_id: dealId, subject, body },
      });
      setThreads((prev) => [
        {
          ...result.thread,
          message_count: 1,
          qa_messages: [
            { id: 'local', author_id: userId, body, created_at: new Date().toISOString() },
          ],
        },
        ...prev,
      ]);
      setOpenThread(result.thread.id);
      setComposing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo abrir el hilo.');
    } finally {
      setBusy(false);
    }
  }

  async function reply(threadId: string, body: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/v1/qa/messages', {
        method: 'POST',
        body: { thread_id: threadId, body },
      });
      // El evento de realtime añade el mensaje; si tarda, se verá al recargar.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar la respuesta.');
    } finally {
      setBusy(false);
    }
  }

  if (!roomOpen) {
    return (
      <div className="border border-stone bg-white p-8">
        <p className="text-[14px] leading-relaxed text-ink-muted">
          El apartado de preguntas se habilita cuando el Deal Room está abierto.
        </p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-4 border-l-2 border-red-700 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {error}
        </p>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <p className="text-[13.5px] text-ink-muted">
          {threads.length} {threads.length === 1 ? 'hilo' : 'hilos'} con {counterpartName}
        </p>
        {!composing && (
          <button type="button" onClick={() => setComposing(true)} className="btn-outline px-6 py-2.5">
            Nueva pregunta
          </button>
        )}
      </div>

      {composing && (
        <form
          className="mb-5 border border-ink bg-white p-6"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void createThread(String(form.get('subject') ?? ''), String(form.get('body') ?? ''));
          }}
        >
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="qa-subject">Asunto</label>
              <input
                id="qa-subject" name="subject" required minLength={5} maxLength={200}
                className="field" placeholder="Normalización de EBITDA 2025"
              />
            </div>
            <div>
              <label className="label" htmlFor="qa-body">Pregunta</label>
              <textarea
                id="qa-body" name="body" required minLength={10} maxLength={4000}
                rows={4} className="field resize-none"
              />
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button type="submit" disabled={busy} className="btn-primary px-6 py-2.5">
              {busy ? 'Enviando…' : 'Publicar'}
            </button>
            <button type="button" onClick={() => setComposing(false)} className="btn-ghost px-6 py-2.5">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {threads.length === 0 && !composing ? (
        <div className="border border-stone bg-white p-10 text-center">
          <p className="font-display text-[21px]">Sin preguntas todavía</p>
          <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-ink-muted">
            Use este espacio para pedir aclaraciones o documentación adicional.
            Todo queda registrado dentro del Deal Room.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {threads.map((thread) => {
            const isOpen = openThread === thread.id;
            const messages = [...(thread.qa_messages ?? [])].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            );

            return (
              <li key={thread.id} className="border border-stone bg-white">
                <button
                  type="button"
                  onClick={() => setOpenThread(isOpen ? null : thread.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-start justify-between gap-4 p-5 text-left transition-colors hover:bg-ivory"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] leading-snug">{thread.subject}</p>
                    <p className="mt-1.5 text-[12px] text-ink-muted">
                      {thread.folder && `${FOLDER_META[thread.folder].label} · `}
                      {thread.message_count} {thread.message_count === 1 ? 'mensaje' : 'mensajes'} ·{' '}
                      {formatRelative(thread.last_message_at)}
                      {thread.is_resolved && ' · resuelto'}
                    </p>
                  </div>
                  <span aria-hidden="true" className="shrink-0 text-ink-muted">{isOpen ? '−' : '+'}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-stone bg-ivory p-5">
                    <ol className="space-y-4">
                      {messages.map((message) => {
                        const mine = message.author_id === userId;
                        return (
                          <li key={message.id} className={mine ? 'pl-8 sm:pl-16' : 'pr-8 sm:pr-16'}>
                            <div
                              className={`border p-4 ${
                                mine ? 'border-ink bg-white' : 'border-stone bg-white'
                              }`}
                            >
                              <p className="text-[11px] uppercase tracking-luxus text-ink-muted">
                                {mine ? 'Usted' : counterpartName} · {formatRelative(message.created_at)}
                              </p>
                              <p className="mt-2.5 whitespace-pre-wrap text-[14px] leading-relaxed">
                                {message.body}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ol>

                    <form
                      className="mt-5"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = event.currentTarget;
                        const data = new FormData(form);
                        void reply(thread.id, String(data.get('body') ?? ''));
                        form.reset();
                      }}
                    >
                      <label className="sr-only" htmlFor={`reply-${thread.id}`}>Responder</label>
                      <textarea
                        id={`reply-${thread.id}`} name="body" required minLength={2} maxLength={4000}
                        rows={3} className="field resize-none" placeholder="Escriba su respuesta…"
                      />
                      <button type="submit" disabled={busy} className="btn-primary mt-3 px-6 py-2.5">
                        {busy ? 'Enviando…' : 'Responder'}
                      </button>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
