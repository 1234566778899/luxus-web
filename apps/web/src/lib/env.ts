/**
 * Variables públicas. Solo entran aquí las que pueden viajar al navegador:
 * la URL del proyecto y la clave *publishable*. La service_role vive
 * exclusivamente en el proceso de la API.
 */
const env = import.meta.env;

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `[luxus:web] Falta la variable ${name}. Copie apps/web/.env.example a apps/web/.env.`,
    );
  }
  return value;
}

export const PUBLIC_SUPABASE_URL = required(
  'PUBLIC_SUPABASE_URL',
  env.PUBLIC_SUPABASE_URL as string | undefined,
);

export const PUBLIC_SUPABASE_PUBLISHABLE_KEY = required(
  'PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  env.PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined,
);

/**
 * Sin slash final: `apiFetch` arma cada llamada como `${API_URL}${path}` con
 * `path` empezando siempre en `/`. Si la variable de entorno se configuró
 * con un `/` de sobra (fácil de arrastrar al copiar la URL de Railway), la
 * concatenación queda con doble slash y la API la devuelve como 404 — el
 * router no la normaliza a la ruta real.
 */
function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export const API_URL = stripTrailingSlash(
  (env.PUBLIC_API_URL as string | undefined) ?? 'http://localhost:4000',
);

export const SITE_URL = stripTrailingSlash(
  (env.PUBLIC_SITE_URL as string | undefined) ?? 'http://localhost:4321',
);

/**
 * Clave de Google Maps (Static Maps + Embed API). Opcional: si falta, los
 * mapas caen a un marcador de posición en vez de romper la página. Restrinja
 * esta clave por referrer HTTP en Google Cloud Console — se expone en el
 * navegador por diseño, igual que cualquier clave de Maps embebido.
 */
export const PUBLIC_GOOGLE_MAPS_API_KEY =
  (env.PUBLIC_GOOGLE_MAPS_API_KEY as string | undefined) ?? '';

export const supabaseConfig = {
  url: PUBLIC_SUPABASE_URL,
  publishableKey: PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};
