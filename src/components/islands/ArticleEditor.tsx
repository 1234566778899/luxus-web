import { useState } from 'react';
import { slugify } from '@luxus/shared';
import { apiFetch, ApiError } from '../../lib/api';

interface Props {
  existing?: {
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    excerpt: string | null;
    body_md: string;
    category: string | null;
    tags: string[];
    status: string;
    is_members_only: boolean;
    seo: { title?: string; description?: string; og_image?: string } | null;
  } | null;
}

const CATEGORIES = ['Market Report', 'Regulation', 'Sector', 'Wealth'] as const;

/**
 * Editor de artículos de Intelligence.
 *
 * Sin motor WYSIWYG deliberadamente: el cuerpo es Markdown plano, el mismo
 * formato que ya usa el seed y que `marked` renderiza en el sitio público.
 */
export default function ArticleEditor({ existing }: Props) {
  const editing = Boolean(existing);
  const [form, setForm] = useState({
    slug: existing?.slug ?? '',
    title: existing?.title ?? '',
    subtitle: existing?.subtitle ?? '',
    excerpt: existing?.excerpt ?? '',
    body_md: existing?.body_md ?? '',
    category: existing?.category ?? '',
    tags: (existing?.tags ?? []).join(', '),
    status: existing?.status ?? 'draft',
    is_members_only: existing?.is_members_only ?? false,
    seo_title: existing?.seo?.title ?? '',
    seo_description: existing?.seo?.description ?? '',
  });
  const [slugTouched, setSlugTouched] = useState(editing);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  function setTitle(title: string) {
    setForm((prev) => ({
      ...prev,
      title,
      slug: slugTouched ? prev.slug : slugify(title),
    }));
  }

  async function save(status?: string) {
    const targetStatus = status ?? form.status;
    setSaving(targetStatus);
    setError(null);

    const payload = {
      slug: form.slug || slugify(form.title),
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || undefined,
      excerpt: form.excerpt.trim() || undefined,
      body_md: form.body_md,
      category: form.category || undefined,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      status: targetStatus,
      is_members_only: form.is_members_only,
      seo: {
        title: form.seo_title.trim() || undefined,
        description: form.seo_description.trim() || undefined,
      },
    };

    try {
      if (editing) {
        await apiFetch(`/v1/admin/articles/${existing!.id}`, { method: 'PATCH', body: payload });
      } else {
        const result = await apiFetch<{ article: { id: string } }>('/v1/admin/articles', {
          method: 'POST',
          body: payload,
        });
        window.location.href = `/admin/intelligence/${result.article.id}`;
        return;
      }
      setForm((prev) => ({ ...prev, status: targetStatus }));
      setSavedAt(new Date());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el artículo.');
    } finally {
      setSaving(null);
    }
  }

  async function archive() {
    if (!editing) return;
    if (!window.confirm('¿Archivar este artículo? Dejará de ser visible en el sitio público.')) return;
    setSaving('archive');
    setError(null);
    try {
      await apiFetch(`/v1/admin/articles/${existing!.id}`, { method: 'DELETE' });
      window.location.href = '/admin/intelligence';
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo archivar el artículo.');
      setSaving(null);
    }
  }

  const wordCount = form.body_md.split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.round(wordCount / 220));

  return (
    <div className="grid gap-8 xl:grid-cols-12">
      <div className="xl:col-span-8">
        <div className="border border-stone bg-white p-8">
          <div className="space-y-5">
            <div>
              <label className="label" htmlFor="a-title">Título</label>
              <input
                id="a-title" className="field" maxLength={200} value={form.title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="label" htmlFor="a-slug">Slug</label>
              <input
                id="a-slug" className="field font-mono text-[13px]" maxLength={120} value={form.slug}
                onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: e.target.value }); }}
              />
            </div>

            <div>
              <label className="label" htmlFor="a-subtitle">Subtítulo</label>
              <input
                id="a-subtitle" className="field" maxLength={300} value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              />
            </div>

            <div>
              <label className="label" htmlFor="a-excerpt">Extracto (portada e Intelligence)</label>
              <textarea
                id="a-excerpt" rows={2} maxLength={600} className="field resize-none" value={form.excerpt}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <label className="label" htmlFor="a-body">Cuerpo (Markdown)</label>
                <span className="mb-2 text-[11px] text-ink-muted">
                  {wordCount} palabras · ~{readingTime} min de lectura
                </span>
              </div>
              <textarea
                id="a-body" rows={22} className="field resize-y font-mono text-[13px] leading-relaxed"
                value={form.body_md}
                onChange={(e) => setForm({ ...form, body_md: e.target.value })}
                placeholder={'## Encabezado\n\nPárrafo en markdown estándar (negrita, listas, tablas, enlaces).'}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="xl:col-span-4">
        <div className="space-y-6 xl:sticky xl:top-24">
          <div className="border border-stone bg-white p-6">
            <h3 className="text-eyebrow uppercase tracking-luxus text-ink-muted">Publicación</h3>

            <div className="mt-4 space-y-4">
              <div>
                <label className="label" htmlFor="a-category">Categoría</label>
                <select
                  id="a-category" className="field" value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="">Sin categoría</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="a-tags">Etiquetas (separadas por comas)</label>
                <input
                  id="a-tags" className="field" value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                />
              </div>

              <label className="flex items-center gap-2.5 text-[13.5px]">
                <input
                  type="checkbox" className="h-4 w-4 accent-ink" checked={form.is_members_only}
                  onChange={(e) => setForm({ ...form, is_members_only: e.target.checked })}
                />
                Reservado a miembros verificados
              </label>

              <p className="text-[12px] text-ink-muted">
                Estado actual: <strong className="text-ink">{form.status}</strong>
              </p>
            </div>

            {error && (
              <p role="alert" className="mt-4 border-l-2 border-red-700 bg-red-50 px-4 py-3 text-[13px] text-red-800">
                {error}
              </p>
            )}

            <div className="mt-6 space-y-2">
              <button type="button" onClick={() => save('draft')} disabled={saving !== null} className="btn-ghost w-full px-4 py-2.5">
                {saving === 'draft' ? 'Guardando…' : 'Guardar borrador'}
              </button>
              <button type="button" onClick={() => save('published')} disabled={saving !== null} className="btn-primary w-full px-4 py-2.5">
                {saving === 'published' ? 'Publicando…' : 'Publicar'}
              </button>
              {editing && (
                <button
                  type="button" onClick={archive} disabled={saving !== null}
                  className="btn-ghost w-full px-4 py-2.5 hover:border-red-600 hover:text-red-700"
                >
                  {saving === 'archive' ? 'Archivando…' : 'Archivar'}
                </button>
              )}
            </div>

            {savedAt && (
              <p className="mt-3 text-center text-[12px] text-ink-muted">
                Guardado {savedAt.toLocaleTimeString('es-PE')}
              </p>
            )}

            {editing && (
              <a
                href={`/intelligence/${existing!.slug}`} target="_blank" rel="noopener"
                className="link-underline mt-4 block text-center text-[11px] uppercase tracking-luxus"
              >
                Ver en el sitio ↗
              </a>
            )}
          </div>

          <div className="border border-stone bg-white p-6">
            <h3 className="text-eyebrow uppercase tracking-luxus text-ink-muted">SEO</h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="label" htmlFor="a-seo-title">Título SEO</label>
                <input
                  id="a-seo-title" className="field" maxLength={200} value={form.seo_title}
                  onChange={(e) => setForm({ ...form, seo_title: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="a-seo-desc">Descripción SEO</label>
                <textarea
                  id="a-seo-desc" rows={3} maxLength={400} className="field resize-none" value={form.seo_description}
                  onChange={(e) => setForm({ ...form, seo_description: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
