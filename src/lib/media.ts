import type { AssetCategory, AssetMediaRow } from '@luxus/shared';
import { PUBLIC_SUPABASE_URL } from './env';
import { curatedImage, isPlaceholderUrl } from './placeholderImages';

/**
 * Contexto del activo para sustituir los placeholders de picsum por una foto
 * acorde a la categoría. Si se omite, la URL se devuelve tal cual.
 */
export interface MediaContext {
  category: AssetCategory;
  seed: string;
}

function resolvePath(media: Pick<AssetMediaRow, 'bucket' | 'storage_path'>): string {
  if (media.storage_path.startsWith('http')) return media.storage_path;
  return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${media.bucket}/${media.storage_path}`;
}

/**
 * Resuelve la URL de una imagen de catálogo.
 *
 * El seed usa placeholders remotos, así que `storage_path` puede ser una URL
 * absoluta o una ruta dentro del bucket. Solo se resuelven aquí los buckets
 * públicos: la media reservada se pide firmada a la API. Con `context`, las
 * URLs de picsum se cambian por una foto real de la categoría.
 */
export function mediaUrl(
  media: Pick<AssetMediaRow, 'bucket' | 'storage_path'> & { sort_order?: number },
  context?: MediaContext,
): string {
  const url = resolvePath(media);
  if (context && isPlaceholderUrl(url)) {
    return curatedImage(context.category, context.seed, media.sort_order ?? 0);
  }
  return url;
}

export function coverUrl(
  media: (Pick<AssetMediaRow, 'bucket' | 'storage_path' | 'is_public'> & { sort_order?: number })[] | null | undefined,
  context?: MediaContext,
): string {
  const first = (media ?? []).find((m) => m.is_public);
  if (first) return mediaUrl(first, context);
  if (context) return curatedImage(context.category, context.seed, 0);
  return 'https://picsum.photos/seed/luxus/1600/1200';
}

export function publicGallery(
  media: AssetMediaRow[] | null | undefined,
): AssetMediaRow[] {
  return (media ?? [])
    .filter((m) => m.is_public)
    .sort((a, b) => a.sort_order - b.sort_order);
}
