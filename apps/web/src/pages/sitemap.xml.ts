import type { APIRoute } from 'astro';
import { CATEGORY_ORDER } from '@luxus/shared';
import { SITE_URL } from '../lib/env';

export const prerender = false;

interface Entry {
  loc: string;
  lastmod?: string;
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: number;
}

/**
 * Sitemap generado en cada petición.
 *
 * Solo entra el Nivel I: portada, colecciones, fichas de activos publicados,
 * reportes públicos de Intelligence y perfiles de brókers verificados. La zona
 * privada nunca aparece — y como estas consultas pasan por RLS con el cliente
 * anónimo, un activo off-market no puede colarse aunque cambie la lógica.
 */
export const GET: APIRoute = async ({ locals }) => {
  const supabase = locals.supabase;

  const [assets, articles, brokers] = await Promise.all([
    supabase
      .from('assets')
      .select('slug, updated_at')
      .eq('status', 'published')
      .in('visibility', ['verified', 'private'])
      .order('published_at', { ascending: false })
      .limit(5000),
    supabase
      .from('articles')
      .select('slug, updated_at')
      .eq('status', 'published')
      .eq('is_members_only', false)
      .limit(1000),
    supabase.from('brokers').select('slug, updated_at').eq('is_verified', true).limit(1000),
  ]);

  const entries: Entry[] = [
    { loc: '/', changefreq: 'daily', priority: 1.0 },
    { loc: '/private-access', changefreq: 'monthly', priority: 0.9 },
    { loc: '/membership', changefreq: 'monthly', priority: 0.8 },
    { loc: '/sell', changefreq: 'monthly', priority: 0.8 },
    { loc: '/how-it-works', changefreq: 'monthly', priority: 0.7 },
    { loc: '/intelligence', changefreq: 'weekly', priority: 0.8 },
    { loc: '/contact', changefreq: 'yearly', priority: 0.5 },
    { loc: '/legal/terms', changefreq: 'yearly', priority: 0.3 },
    { loc: '/legal/privacy', changefreq: 'yearly', priority: 0.3 },
    { loc: '/legal/cookies', changefreq: 'yearly', priority: 0.3 },
    ...CATEGORY_ORDER.map((category) => ({
      loc: `/collection/${category}`,
      changefreq: 'daily' as const,
      priority: 0.9,
    })),
    ...(assets.data ?? []).map((asset) => ({
      loc: `/asset/${asset.slug}`,
      lastmod: asset.updated_at,
      changefreq: 'weekly' as const,
      priority: 0.8,
    })),
    ...(articles.data ?? []).map((article) => ({
      loc: `/intelligence/${article.slug}`,
      lastmod: article.updated_at,
      changefreq: 'monthly' as const,
      priority: 0.6,
    })),
    ...(brokers.data ?? []).map((broker) => ({
      loc: `/broker/${broker.slug}`,
      lastmod: broker.updated_at,
      changefreq: 'monthly' as const,
      priority: 0.5,
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `  <url>
    <loc>${SITE_URL}${entry.loc}</loc>${
      entry.lastmod ? `\n    <lastmod>${new Date(entry.lastmod).toISOString().slice(0, 10)}</lastmod>` : ''
    }
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority.toFixed(1)}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800',
    },
  });
};
