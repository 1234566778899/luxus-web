import type { AssetMediaRow } from '@luxus/shared';
import { PUBLIC_SUPABASE_URL } from './env';

/**
 * Resuelve la URL de una imagen de catálogo.
 *
 * El seed usa placeholders remotos, así que `storage_path` puede ser una URL
 * absoluta o una ruta dentro del bucket. Solo se resuelven aquí los buckets
 * públicos: la media reservada se pide firmada a la API.
 */
export function mediaUrl(media: Pick<AssetMediaRow, 'bucket' | 'storage_path'>): string {
  if (media.storage_path.startsWith('http')) return media.storage_path;
  return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${media.bucket}/${media.storage_path}`;
}

export function coverUrl(
  media: Pick<AssetMediaRow, 'bucket' | 'storage_path' | 'is_public'>[] | null | undefined,
  fallbackSeed = 'luxus',
): string {
  const first = (media ?? []).find((m) => m.is_public);
  if (first) return mediaUrl(first);
  return `https://picsum.photos/seed/${encodeURIComponent(fallbackSeed)}/1600/1200`;
}

export function publicGallery(
  media: AssetMediaRow[] | null | undefined,
): AssetMediaRow[] {
  return (media ?? [])
    .filter((m) => m.is_public)
    .sort((a, b) => a.sort_order - b.sort_order);
}
