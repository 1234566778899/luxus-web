/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

import type { LuxusClient, ProfileRow } from '@luxus/shared';

declare global {
  namespace App {
    interface Locals {
      /** Cliente Supabase ligado a las cookies de la petición (sujeto a RLS). */
      supabase: LuxusClient;
      /** Sesión resuelta por el middleware; null para visitantes anónimos. */
      session: {
        userId: string;
        email: string;
        profile: ProfileRow;
        accessToken: string;
      } | null;
    }
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
  readonly PUBLIC_API_URL: string;
  readonly PUBLIC_SITE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
