import type { AssetCategory } from '@luxus/shared';

/**
 * Fotografías de catálogo por categoría (Unsplash, libres de uso). Sustituyen
 * en el navegador a los placeholders aleatorios de picsum que genera el seed
 * —una foto de yate para un yate, no un animal al azar— hasta que se suban
 * imágenes reales. En cuanto `asset_media.storage_path` deje de apuntar a
 * picsum, este módulo no interviene: la URL real pasa intacta.
 *
 * Cada id se verificó visualmente: temática correcta y sin recorte extraño.
 */
const UNSPLASH_IDS: Record<AssetCategory, readonly string[]> = {
  'real-estate': [
    'photo-1613490493576-7fde63acd811',
    'photo-1512917774080-9991f1c4c750',
    'photo-1600596542815-ffad4c1539a9',
    'photo-1600585154340-be6161a56a0c',
    'photo-1600047509807-ba8f99d2cdde',
    'photo-1580587771525-78b9dba3b914',
    'photo-1568605114967-8130f3a36994',
  ],
  companies: [
    'photo-1486406146926-c627a92ad1ab',
    'photo-1497366216548-37526070297c',
    'photo-1497366811353-6870744d04b2',
    'photo-1524758631624-e2822e304c36',
    'photo-1497215728101-856f4ea42174',
    'photo-1531973576160-7125cd663d86',
    'photo-1479839672679-a46483c0e7c8',
  ],
  vehicles: [
    'photo-1503376780353-7e6692767b70',
    'photo-1544636331-e26879cd4d9b',
    'photo-1580273916550-e323be2ae537',
    'photo-1552519507-da3b142c6e3d',
    'photo-1502877338535-766e1452684a',
    'photo-1494976388531-d1058494cdd8',
    'photo-1583121274602-3e2820c69888',
    'photo-1503736334956-4c8f8e92946d',
    'photo-1542362567-b07e54358753',
    'photo-1553440569-bcc63803a83d',
  ],
  yachts: [
    'photo-1567899378494-47b22a2ae96a',
    'photo-1540946485063-a40da27545f8',
    'photo-1605281317010-fe5ffe798166',
    'photo-1569263979104-865ab7cd8d13',
    'photo-1593351415075-3bac9f45c877',
  ],
  aircraft: [
    'photo-1540962351504-03099e0a754b',
    'photo-1474302770737-173ee21bab63',
    'photo-1436491865332-7a61a109cc05',
    'photo-1464037866556-6812c9d1c72e',
    'photo-1556388158-158ea5ccacbd',
    'photo-1521727857535-28d2047314ac',
    'photo-1569629743817-70d8db6c323b',
    'photo-1517479149777-5f3b1511d5ad',
  ],
};

/** Reconoce las URLs de relleno que aún vienen del seed. */
export function isPlaceholderUrl(url: string): boolean {
  return url.includes('picsum.photos');
}

/** Hash entero estable (FNV-1a) para elegir siempre la misma foto por semilla. */
function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/**
 * Devuelve una foto acorde a la categoría, elegida de forma determinista por
 * `seed` (+ `index` para variar entre las fotos de un mismo activo).
 */
export function curatedImage(
  category: AssetCategory,
  seed: string,
  index = 0,
  width = 1600,
): string {
  const pool = UNSPLASH_IDS[category] ?? UNSPLASH_IDS['real-estate'];
  const id = pool[(hashString(seed) + index) % pool.length]!;
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=70`;
}

/** Portada decorativa estable de una categoría (heros de colección, mosaicos). */
export function curatedCategoryImage(category: AssetCategory, width = 2000): string {
  return curatedImage(category, `collection-${category}`, 0, width);
}
