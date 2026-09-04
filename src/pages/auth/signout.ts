import type { APIRoute } from 'astro';

export const prerender = false;

/** Cierra la sesión y limpia las cookies del navegador. */
export const POST: APIRoute = async ({ locals, redirect }) => {
  await locals.supabase.auth.signOut();
  return redirect('/', 302);
};

export const GET: APIRoute = async (context) => POST(context);
