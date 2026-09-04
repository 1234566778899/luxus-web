// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel/serverless';

const site = process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';

export default defineConfig({
  site,
  // SSR: la zona privada depende de la sesión y del nivel de acceso, así que
  // no puede prerenderizarse. Las páginas públicas marcan `prerender = true`
  // individualmente cuando procede.
  output: 'server',
  // Despliegue en Vercel (funciones serverless con runtime Node, no edge: el
  // proyecto ya hace fetch a Supabase en cada request, así que edge no
  // aporta demasiado, y evita cualquier incompatibilidad con APIs de Node).
  adapter: vercel(),

  // El sitemap lo genera src/pages/sitemap.xml.ts: al ser SSR puro necesita
  // consultar la base de datos para enumerar activos y reportes publicados,
  // algo que la integración estática no puede hacer.
  integrations: [react(), tailwind({ applyBaseStyles: false })],

  server: { port: 4321 },

  image: {
    // Fotografía de catálogo servida desde Supabase Storage y placeholders.
    domains: ['picsum.photos', 'fastly.picsum.photos'],
    remotePatterns: [{ protocol: 'https' }],
  },
});
