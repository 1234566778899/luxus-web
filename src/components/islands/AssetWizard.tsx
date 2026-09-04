import { useMemo, useState } from 'react';
import {
  CATEGORY_META, CATEGORY_ORDER, PERU_PRIME_LOCATIONS, VISIBILITY_DESCRIPTIONS,
  VISIBILITY_LABELS, specFieldsFor,
} from '@luxus/shared';
import type { AssetCategory, AssetVisibility, ListingTier, SpecField } from '@luxus/shared';
import { browserClient } from '../../lib/supabase';
import { apiFetch, ApiError } from '../../lib/api';

interface Props {
  brokerId: string | null;
  /** Cuando llega, el wizard edita en lugar de crear. */
  existing?: {
    id: string;
    category: AssetCategory;
    title: string;
    headline: string | null;
    description_public: string;
    district: string | null;
    province: string | null;
    region: string | null;
    price_min: number | null;
    price_max: number | null;
    price_on_request: boolean;
    visibility: AssetVisibility;
    tier: ListingTier;
    specs: Record<string, unknown>;
    private_details: {
      price_exact: number | null;
      address_exact: string | null;
      description_private: string | null;
      registry_reference: string | null;
      valuation_amount: number | null;
      valuation_firm: string | null;
    } | null;
    media: { id: string; storage_path: string; bucket: string; is_public: boolean }[];
  } | null;
}

const STEPS = ['Categoría', 'Ficha pública', 'Especificaciones', 'Datos reservados', 'Fotografía'];

interface MediaItem {
  id?: string;
  bucket: string;
  storage_path: string;
  is_public: boolean;
  preview: string;
}

/**
 * Wizard de publicación.
 *
 * Las especificaciones se generan desde `CATEGORY_SPECS`, la misma definición
 * que usan el Asset Passport y la validación del endpoint: cambiar un campo en
 * el paquete compartido lo cambia en los tres sitios a la vez.
 *
 * El paso «Datos reservados» escribe en `asset_private_details`, tabla separada
 * a la que un visitante público no llega ni por error de código.
 */
export default function AssetWizard({ brokerId, existing }: Props) {
  const editing = Boolean(existing);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(existing?.id ?? null);

  const [category, setCategory] = useState<AssetCategory>(existing?.category ?? 'real-estate');
  const [core, setCore] = useState({
    title: existing?.title ?? '',
    headline: existing?.headline ?? '',
    description_public: existing?.description_public ?? '',
    district: existing?.district ?? '',
    province: existing?.province ?? '',
    region: existing?.region ?? '',
    price_min: existing?.price_min?.toString() ?? '',
    price_max: existing?.price_max?.toString() ?? '',
    price_on_request: existing?.price_on_request ?? false,
    visibility: (existing?.visibility ?? 'verified') as AssetVisibility,
    tier: (existing?.tier ?? 'private') as ListingTier,
  });
  const [specs, setSpecs] = useState<Record<string, unknown>>(existing?.specs ?? {});
  const [priv, setPriv] = useState({
    price_exact: existing?.private_details?.price_exact?.toString() ?? '',
    address_exact: existing?.private_details?.address_exact ?? '',
    description_private: existing?.private_details?.description_private ?? '',
    registry_reference: existing?.private_details?.registry_reference ?? '',
    valuation_amount: existing?.private_details?.valuation_amount?.toString() ?? '',
    valuation_firm: existing?.private_details?.valuation_firm ?? '',
  });
  const [media, setMedia] = useState<MediaItem[]>(
    (existing?.media ?? []).map((m) => ({
      id: m.id,
      bucket: m.bucket,
      storage_path: m.storage_path,
      is_public: m.is_public,
      preview: m.storage_path.startsWith('http')
        ? m.storage_path
        : `${import.meta.env.PUBLIC_SUPABASE_URL}/storage/v1/object/public/${m.bucket}/${m.storage_path}`,
    })),
  );
  const [uploading, setUploading] = useState(false);

  const fields = useMemo(() => specFieldsFor(category), [category]);
  const groups = useMemo(() => {
    return fields.reduce<Record<string, SpecField[]>>((acc, field) => {
      (acc[field.group] ??= []).push(field);
      return acc;
    }, {});
  }, [fields]);

  const publicCount = media.filter((m) => m.is_public).length;

  function setSpec(key: string, value: unknown) {
    setSpecs((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): boolean {
    setError(null);

    if (step === 1) {
      if (core.title.trim().length < 8) {
        setError('El título debe tener al menos 8 caracteres.');
        return false;
      }
      if (core.description_public.trim().length < 40) {
        setError('La descripción pública debe tener al menos 40 caracteres.');
        return false;
      }
      if (!core.price_on_request && !core.price_min) {
        setError('Indique un rango de precio o marque «precio a consultar».');
        return false;
      }
      if (core.price_min && core.price_max && Number(core.price_min) > Number(core.price_max)) {
        setError('El máximo del rango no puede ser menor que el mínimo.');
        return false;
      }
    }

    if (step === 2) {
      const missing = fields.filter(
        (f) => f.required && (specs[f.key] === undefined || specs[f.key] === '' || specs[f.key] === null),
      );
      if (missing.length > 0) {
        setError(`Faltan campos obligatorios: ${missing.map((m) => m.label).join(', ')}.`);
        return false;
      }
    }

    return true;
  }

  /** Guarda ficha pública + specs + datos reservados en una sola llamada. */
  async function persist(): Promise<string | null> {
    const payload = {
      category,
      title: core.title.trim(),
      headline: core.headline.trim() || undefined,
      description_public: core.description_public.trim(),
      district: core.district || undefined,
      province: core.province || undefined,
      region: core.region || undefined,
      country: 'PE',
      price_min: core.price_min ? Number(core.price_min) : undefined,
      price_max: core.price_max ? Number(core.price_max) : undefined,
      price_on_request: core.price_on_request,
      visibility: core.visibility,
      tier: core.tier,
      broker_id: brokerId ?? undefined,
      specs,
      private_details: {
        price_exact: priv.price_exact ? Number(priv.price_exact) : undefined,
        address_exact: priv.address_exact || undefined,
        description_private: priv.description_private || undefined,
        registry_reference: priv.registry_reference || undefined,
        valuation_amount: priv.valuation_amount ? Number(priv.valuation_amount) : undefined,
        valuation_firm: priv.valuation_firm || undefined,
      },
    };

    if (assetId) {
      await apiFetch(`/v1/assets/${assetId}`, { method: 'PATCH', body: payload });
      return assetId;
    }

    const result = await apiFetch<{ asset: { id: string } }>('/v1/assets', {
      method: 'POST',
      body: payload,
    });
    setAssetId(result.asset.id);
    return result.asset.id;
  }

  async function saveAndContinue() {
    if (!validate()) return;

    // Antes del paso de fotografía hay que tener id de activo: las imágenes se
    // suben a una carpeta nombrada por ese id.
    if (step === 2 && !assetId) {
      setSaving(true);
      try {
        await persist();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo guardar el activo.');
        setSaving(false);
        return;
      }
      setSaving(false);
    }

    setStep(step + 1);
  }

  async function uploadImage(file: File, isPublic: boolean) {
    let id = assetId;
    if (!id) {
      setSaving(true);
      try {
        id = await persist();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Guarde el activo antes de subir fotografías.');
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    if (!id) return;

    setUploading(true);
    setError(null);

    try {
      const { bucket, path, token } = await apiFetch<{
        bucket: string; path: string; token: string;
      }>(`/v1/assets/${id}/media/upload-url`, {
        method: 'POST',
        body: { file_name: file.name, is_public: isPublic },
      });

      const { error: uploadError } = await browserClient()
        .storage.from(bucket)
        .uploadToSignedUrl(path, token, file);

      if (uploadError) throw new Error(uploadError.message);

      await apiFetch(`/v1/assets/${id}/media`, {
        method: 'POST',
        body: {
          bucket,
          storage_path: path,
          is_public: isPublic,
          sort_order: media.length,
          alt_text: core.title,
        },
      });

      setMedia((prev) => [
        ...prev,
        {
          bucket,
          storage_path: path,
          is_public: isPublic,
          preview: URL.createObjectURL(file),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la fotografía.');
    } finally {
      setUploading(false);
    }
  }

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      await persist();
      window.location.href = '/dashboard/seller/assets';
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el activo.');
      setSaving(false);
    }
  }

  return (
    <div className="border border-stone bg-white">
      <ol className="flex divide-x divide-stone overflow-x-auto border-b border-stone no-scrollbar" aria-label="Progreso">
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={step === index ? 'step' : undefined}
            className={`flex-1 whitespace-nowrap px-4 py-3.5 text-[10px] uppercase tracking-luxus ${
              step === index ? 'bg-ink text-white' : step > index ? 'text-ink' : 'text-ink-muted/60'
            }`}
          >
            <span className="mr-1.5 opacity-60">{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <div className="p-8 lg:p-10">
        {/* 1 · Categoría */}
        {step === 0 && (
          <fieldset>
            <legend className="font-display text-[24px]">Categoría del activo</legend>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
              Determina las especificaciones que se pedirán y la documentación
              que revisará el equipo de verificación.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {CATEGORY_ORDER.map((value) => (
                <label
                  key={value}
                  className={`cursor-pointer border p-6 transition-colors ${
                    category === value ? 'border-ink bg-ivory' : 'border-stone hover:border-stone-dark'
                  } ${editing && category !== value ? 'pointer-events-none opacity-40' : ''}`}
                >
                  <input
                    type="radio" name="category" value={value} checked={category === value}
                    disabled={editing}
                    onChange={() => { setCategory(value); setSpecs({}); }}
                    className="sr-only"
                  />
                  <span className="block font-display text-[19px]">{CATEGORY_META[value].label}</span>
                  <span className="mt-2 block text-[13px] leading-relaxed text-ink-muted">
                    {CATEGORY_META[value].tagline}
                  </span>
                </label>
              ))}
            </div>

            {editing && (
              <p className="mt-5 text-[12.5px] text-ink-muted">
                La categoría no puede cambiarse una vez creado el activo.
              </p>
            )}
          </fieldset>
        )}

        {/* 2 · Ficha pública */}
        {step === 1 && (
          <fieldset>
            <legend className="font-display text-[24px]">Ficha pública</legend>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
              Esto es lo único que verá un visitante anónimo. No incluya la
              dirección exacta ni el precio cerrado: eso va en el paso siguiente.
            </p>

            <div className="mt-8 space-y-5">
              <div>
                <label className="label" htmlFor="w-title">Título</label>
                <input
                  id="w-title" className="field" maxLength={160} value={core.title}
                  onChange={(e) => setCore({ ...core, title: e.target.value })}
                  placeholder="Penthouse sobre el Malecón de la Reserva"
                />
              </div>

              <div>
                <label className="label" htmlFor="w-headline">Subtítulo</label>
                <input
                  id="w-headline" className="field" maxLength={200} value={core.headline}
                  onChange={(e) => setCore({ ...core, headline: e.target.value })}
                  placeholder="Dos plantas con terraza panorámica sobre la bahía"
                />
              </div>

              <div>
                <label className="label" htmlFor="w-desc">Descripción pública</label>
                <textarea
                  id="w-desc" rows={7} className="field resize-none" maxLength={6000}
                  value={core.description_public}
                  onChange={(e) => setCore({ ...core, description_public: e.target.value })}
                  placeholder="Describa el activo, su estado y lo que lo hace excepcional. Sin dirección ni precio exacto."
                />
                <p className="mt-1.5 text-[12px] text-ink-muted">
                  {core.description_public.length} caracteres · mínimo 40
                </p>
              </div>

              <div>
                <label className="label" htmlFor="w-location">Ubicación aproximada</label>
                <select
                  id="w-location"
                  className="field"
                  value={core.district}
                  onChange={(e) => {
                    const found = PERU_PRIME_LOCATIONS.find((l) => l.district === e.target.value);
                    setCore({
                      ...core,
                      district: e.target.value,
                      province: found?.province ?? '',
                      region: found?.region ?? '',
                    });
                  }}
                >
                  <option value="">Seleccione un distrito</option>
                  {PERU_PRIME_LOCATIONS.map((location) => (
                    <option key={location.district} value={location.district}>
                      {location.district}, {location.region}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[12px] text-ink-muted">
                  Solo se muestra el distrito y la región. Nunca la dirección.
                </p>
              </div>

              <div className="border border-stone bg-ivory p-6">
                <p className="text-eyebrow uppercase tracking-luxus text-ink-muted">Rango público de precio</p>

                <label className="mt-4 flex items-center gap-3 text-[14px]">
                  <input
                    type="checkbox" className="h-4 w-4 accent-ink"
                    checked={core.price_on_request}
                    onChange={(e) => setCore({ ...core, price_on_request: e.target.checked })}
                  />
                  Precio a consultar
                </label>

                {!core.price_on_request && (
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="w-pmin">Desde (USD)</label>
                      <input
                        id="w-pmin" type="number" min={0} step={10000} className="field"
                        value={core.price_min}
                        onChange={(e) => setCore({ ...core, price_min: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="w-pmax">Hasta (USD)</label>
                      <input
                        id="w-pmax" type="number" min={0} step={10000} className="field"
                        value={core.price_max}
                        onChange={(e) => setCore({ ...core, price_max: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="w-vis">Visibilidad</label>
                  <select
                    id="w-vis" className="field" value={core.visibility}
                    onChange={(e) => setCore({ ...core, visibility: e.target.value as AssetVisibility })}
                  >
                    {(Object.keys(VISIBILITY_LABELS) as AssetVisibility[]).map((value) => (
                      <option key={value} value={value}>{VISIBILITY_LABELS[value]}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
                    {VISIBILITY_DESCRIPTIONS[core.visibility]}
                  </p>
                </div>

                <div>
                  <label className="label" htmlFor="w-tier">Nivel de publicación</label>
                  <select
                    id="w-tier" className="field" value={core.tier}
                    onChange={(e) => setCore({ ...core, tier: e.target.value as ListingTier })}
                  >
                    <option value="private">Private</option>
                    <option value="signature">Signature</option>
                  </select>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
                    La tarifa se cotiza al aprobarse la publicación.
                  </p>
                </div>
              </div>
            </div>
          </fieldset>
        )}

        {/* 3 · Specs */}
        {step === 2 && (
          <fieldset>
            <legend className="font-display text-[24px]">
              Especificaciones · {CATEGORY_META[category].label}
            </legend>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
              Estos datos componen el «Asset Passport» de la ficha pública.
            </p>

            <div className="mt-8 space-y-9">
              {Object.entries(groups).map(([group, groupFields]) => (
                <div key={group}>
                  <h3 className="text-eyebrow uppercase tracking-luxus text-ink-muted">{group}</h3>
                  <div className="mt-4 grid gap-5 sm:grid-cols-2">
                    {groupFields.map((field) => (
                      <div key={field.key} className={field.type === 'tags' ? 'sm:col-span-2' : ''}>
                        <label className="label" htmlFor={`spec-${field.key}`}>
                          {field.label}
                          {field.unit && <span className="ml-1 normal-case tracking-normal opacity-60">({field.unit})</span>}
                          {field.required && <span className="ml-1 text-gold-dark">*</span>}
                        </label>

                        {field.type === 'boolean' ? (
                          <label className="flex items-center gap-3 py-2 text-[14px]">
                            <input
                              id={`spec-${field.key}`} type="checkbox" className="h-4 w-4 accent-ink"
                              checked={Boolean(specs[field.key])}
                              onChange={(e) => setSpec(field.key, e.target.checked)}
                            />
                            Sí
                          </label>
                        ) : field.type === 'select' ? (
                          <select
                            id={`spec-${field.key}`} className="field"
                            value={String(specs[field.key] ?? '')}
                            onChange={(e) => setSpec(field.key, e.target.value)}
                          >
                            <option value="">Seleccione</option>
                            {field.options?.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        ) : field.type === 'tags' ? (
                          <input
                            id={`spec-${field.key}`} className="field"
                            value={Array.isArray(specs[field.key]) ? (specs[field.key] as string[]).join(', ') : ''}
                            onChange={(e) =>
                              setSpec(
                                field.key,
                                e.target.value.split(',').map((v) => v.trim()).filter(Boolean),
                              )
                            }
                            placeholder="Separe con comas"
                          />
                        ) : (
                          <input
                            id={`spec-${field.key}`}
                            type={field.type === 'number' ? 'number' : 'text'}
                            step={field.type === 'number' ? 'any' : undefined}
                            className="field"
                            value={String(specs[field.key] ?? '')}
                            onChange={(e) =>
                              setSpec(
                                field.key,
                                field.type === 'number'
                                  ? e.target.value === '' ? undefined : Number(e.target.value)
                                  : e.target.value,
                              )
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        )}

        {/* 4 · Datos reservados */}
        {step === 3 && (
          <fieldset>
            <legend className="font-display text-[24px]">Datos reservados</legend>
            <div className="mt-3 border-l-2 border-gold bg-ivory px-5 py-4">
              <p className="text-[13.5px] leading-relaxed text-ink-muted">
                Esta información vive en una tabla separada y solo es legible
                para miembros con verificación aprobada que tengan un Deal Room
                abierto sobre el activo. Un visitante público no puede alcanzarla.
              </p>
            </div>

            <div className="mt-8 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="w-exact">Precio exacto (USD)</label>
                  <input
                    id="w-exact" type="number" min={0} step={1000} className="field"
                    value={priv.price_exact}
                    onChange={(e) => setPriv({ ...priv, price_exact: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="w-val">Valorización (USD)</label>
                  <input
                    id="w-val" type="number" min={0} step={1000} className="field"
                    value={priv.valuation_amount}
                    onChange={(e) => setPriv({ ...priv, valuation_amount: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="w-addr">Dirección exacta</label>
                <input
                  id="w-addr" className="field" maxLength={400} value={priv.address_exact}
                  onChange={(e) => setPriv({ ...priv, address_exact: e.target.value })}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="w-reg">Referencia registral</label>
                  <input
                    id="w-reg" className="field" maxLength={200} value={priv.registry_reference}
                    onChange={(e) => setPriv({ ...priv, registry_reference: e.target.value })}
                    placeholder="Partida N.º … — SUNARP"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="w-firm">Firma tasadora</label>
                  <input
                    id="w-firm" className="field" maxLength={160} value={priv.valuation_firm}
                    onChange={(e) => setPriv({ ...priv, valuation_firm: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="w-note">Nota para compradores verificados</label>
                <textarea
                  id="w-note" rows={4} className="field resize-none" maxLength={8000}
                  value={priv.description_private}
                  onChange={(e) => setPriv({ ...priv, description_private: e.target.value })}
                  placeholder="Motivación de la venta, flexibilidad en el precio, plazos preferidos."
                />
              </div>
            </div>
          </fieldset>
        )}

        {/* 5 · Fotografía */}
        {step === 4 && (
          <fieldset>
            <legend className="font-display text-[24px]">Fotografía</legend>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
              Mínimo tres fotografías públicas para poder enviar a verificación.
              El material reservado solo lo verán miembros verificados.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <label className={`btn-primary cursor-pointer ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
                {uploading ? 'Subiendo…' : 'Añadir fotografía pública'}
                <input
                  type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadImage(file, true);
                  }}
                />
              </label>

              <label className={`btn-ghost cursor-pointer ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
                Añadir material reservado
                <input
                  type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadImage(file, false);
                  }}
                />
              </label>
            </div>

            <p className="mt-4 text-[13px] text-ink-muted">
              {publicCount} {publicCount === 1 ? 'fotografía pública' : 'fotografías públicas'} ·{' '}
              {media.length - publicCount} reservadas
            </p>

            {media.length > 0 && (
              <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {media.map((item, index) => (
                  <li key={item.storage_path} className="relative">
                    <img
                      src={item.preview}
                      alt={`Fotografía ${index + 1}`}
                      className="aspect-[4/3] w-full border border-stone object-cover"
                    />
                    <span
                      className={`absolute left-2 top-2 px-2 py-1 text-[9px] uppercase tracking-luxus ${
                        item.is_public ? 'bg-white/95 text-ink' : 'bg-ink/90 text-white'
                      }`}
                    >
                      {item.is_public ? 'Pública' : 'Reservada'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        )}

        {error && (
          <p role="alert" className="mt-7 border-l-2 border-red-700 bg-red-50 px-4 py-3 text-[13px] text-red-800">
            {error}
          </p>
        )}

        <div className="mt-10 flex items-center gap-3">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className="btn-ghost">Atrás</button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={saveAndContinue} disabled={saving} className="btn-primary">
              {saving ? 'Guardando…' : 'Continuar'}
            </button>
          ) : (
            <button type="button" onClick={finish} disabled={saving} className="btn-primary">
              {saving ? 'Guardando…' : 'Guardar activo'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
