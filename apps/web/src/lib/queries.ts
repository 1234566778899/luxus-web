import type { LuxusClient, AssetCategory, AssetMediaRow, AssetRow, ArticleRow } from '@luxus/shared';
import type { AssetFilter } from '@luxus/shared';

export type AssetWithMedia = AssetRow & { asset_media?: AssetMediaRow[] };

const CARD_COLUMNS = `
  id, slug, reference_code, category, title, headline, description_public,
  district, province, region, country,
  price_currency, price_min, price_max, price_on_request,
  visibility, status, tier, specs,
  ownership_verified, registry_reviewed, documentation_reviewed, valuation_available,
  is_featured, featured_rank, view_count, published_at, created_at, updated_at,
  owner_id, broker_id, enquiry_count, verification_notes, verified_at, verified_by,
  sold_at, archived_at
`;

/**
 * Todas estas consultas se ejecutan bajo RLS. Un visitante anónimo solo ve
 * activos publicados con visibilidad `verified` o `private`; los `off_market`
 * aparecen únicamente si el cliente lleva la sesión de un miembro verificado.
 * No hay que filtrar por nivel en el código de la página: la base ya lo hace.
 */
export async function fetchFeaturedAssets(
  client: LuxusClient,
  limit = 6,
): Promise<AssetWithMedia[]> {
  const { data } = await client
    .from('assets')
    .select(`${CARD_COLUMNS}, asset_media (id, bucket, storage_path, is_public, sort_order, alt_text)`)
    .eq('status', 'published')
    .eq('is_featured', true)
    .order('featured_rank', { ascending: true, nullsFirst: false })
    .limit(limit);

  return (data ?? []) as unknown as AssetWithMedia[];
}

export async function fetchLatestAssets(
  client: LuxusClient,
  limit = 8,
): Promise<AssetWithMedia[]> {
  const { data } = await client
    .from('assets')
    .select(`${CARD_COLUMNS}, asset_media (id, bucket, storage_path, is_public, sort_order, alt_text)`)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as unknown as AssetWithMedia[];
}

export async function fetchAssetsByCategory(
  client: LuxusClient,
  category: AssetCategory,
  limit = 4,
): Promise<AssetWithMedia[]> {
  const { data } = await client
    .from('assets')
    .select(`${CARD_COLUMNS}, asset_media (id, bucket, storage_path, is_public, sort_order, alt_text)`)
    .eq('status', 'published')
    .eq('category', category)
    .order('featured_rank', { ascending: true, nullsFirst: false })
    .order('published_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as unknown as AssetWithMedia[];
}

export interface CollectionResult {
  assets: AssetWithMedia[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function fetchCollection(
  client: LuxusClient,
  filter: AssetFilter,
): Promise<CollectionResult> {
  const from = (filter.page - 1) * filter.pageSize;
  const to = from + filter.pageSize - 1;

  let query = client
    .from('assets')
    .select(
      `${CARD_COLUMNS}, asset_media (id, bucket, storage_path, is_public, sort_order, alt_text)`,
      { count: 'exact' },
    )
    .eq('status', 'published')
    .range(from, to);

  if (filter.category) query = query.eq('category', filter.category);
  if (filter.region) query = query.eq('region', filter.region);
  if (filter.district) query = query.eq('district', filter.district);
  if (filter.visibility) query = query.eq('visibility', filter.visibility);
  if (filter.q) query = query.ilike('title', `%${filter.q}%`);

  // El filtro de precio trabaja sobre el RANGO público, nunca sobre el exacto.
  if (filter.priceMin !== undefined) {
    query = query.or(`price_max.gte.${filter.priceMin},price_max.is.null`);
  }
  if (filter.priceMax !== undefined) {
    query = query.or(`price_min.lte.${filter.priceMax},price_min.is.null`);
  }

  switch (filter.sort) {
    case 'price_asc':
      query = query.order('price_min', { ascending: true, nullsFirst: false });
      break;
    case 'price_desc':
      query = query.order('price_max', { ascending: false, nullsFirst: false });
      break;
    case 'recent':
      query = query.order('published_at', { ascending: false });
      break;
    default:
      query = query
        .order('is_featured', { ascending: false })
        .order('featured_rank', { ascending: true, nullsFirst: false })
        .order('published_at', { ascending: false });
  }

  const { data, count } = await query;
  const total = count ?? 0;

  return {
    assets: (data ?? []) as unknown as AssetWithMedia[],
    total,
    page: filter.page,
    pageSize: filter.pageSize,
    pageCount: Math.max(1, Math.ceil(total / filter.pageSize)),
  };
}

export interface AssetDetailResult {
  asset: AssetWithMedia;
  broker: {
    id: string; slug: string; company_name: string;
    logo_path: string | null; is_verified: boolean; bio: string | null;
  } | null;
  /** Null cuando el visitante no alcanza el Nivel II: RLS lo decide. */
  privateDetails: {
    price_exact: number | null;
    address_exact: string | null;
    latitude: number | null;
    longitude: number | null;
    description_private: string | null;
    valuation_amount: number | null;
    valuation_firm: string | null;
    valuation_date: string | null;
    registry_reference: string | null;
  } | null;
  related: AssetWithMedia[];
}

export async function fetchAssetBySlug(
  client: LuxusClient,
  slug: string,
): Promise<AssetDetailResult | null> {
  const { data: asset } = await client
    .from('assets')
    .select(`${CARD_COLUMNS}, asset_media (id, bucket, storage_path, is_public, sort_order, alt_text, caption, kind)`)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (!asset) return null;
  const typed = asset as unknown as AssetWithMedia;

  const [brokerResult, privateResult, relatedResult] = await Promise.all([
    typed.broker_id
      ? client
          .from('brokers')
          .select('id, slug, company_name, logo_path, is_verified, bio')
          .eq('id', typed.broker_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Si el visitante no tiene Nivel II sobre este activo, RLS devuelve vacío.
    client
      .from('asset_private_details')
      .select(
        'price_exact, address_exact, latitude, longitude, description_private, valuation_amount, valuation_firm, valuation_date, registry_reference',
      )
      .eq('asset_id', typed.id)
      .maybeSingle(),
    client
      .from('assets')
      .select(`${CARD_COLUMNS}, asset_media (id, bucket, storage_path, is_public, sort_order, alt_text)`)
      .eq('status', 'published')
      .eq('category', typed.category)
      .neq('id', typed.id)
      .limit(3),
  ]);

  return {
    asset: typed,
    broker: (brokerResult.data ?? null) as AssetDetailResult['broker'],
    privateDetails: (privateResult.data ?? null) as AssetDetailResult['privateDetails'],
    related: (relatedResult.data ?? []) as unknown as AssetWithMedia[],
  };
}

export async function fetchPublishedArticles(
  client: LuxusClient,
  limit = 12,
): Promise<ArticleRow[]> {
  const { data } = await client
    .from('articles')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as ArticleRow[];
}

export async function fetchArticleBySlug(
  client: LuxusClient,
  slug: string,
): Promise<ArticleRow | null> {
  const { data } = await client
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  return (data ?? null) as ArticleRow | null;
}

export async function fetchCategoryCounts(
  client: LuxusClient,
): Promise<Record<string, number>> {
  const { data } = await client
    .from('assets')
    .select('category')
    .eq('status', 'published');

  return (data ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.category] = (acc[row.category] ?? 0) + 1;
    return acc;
  }, {});
}
