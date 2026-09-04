import { useState } from 'react';
import {
  NET_WORTH_BANDS, kycFundsSchema, kycIdentitySchema,
} from '@luxus/shared';
import type { KycStatus } from '@luxus/shared';
import { browserClient } from '../../lib/supabase';
import { apiFetch, ApiError } from '../../lib/api';

interface Props {
  status: KycStatus;
  existing: {
    legal_name?: string | null;
    document_type?: string | null;
    document_number?: string | null;
    nationality?: string | null;
    birth_date?: string | null;
    tax_residence?: string | null;
    occupation?: string | null;
  } | null;
  fullName: string;
}

const DOC_SLOTS = [
  { type: 'identity_front', label: 'Documento de identidad — anverso', required: true },
  { type: 'identity_back', label: 'Documento de identidad — reverso', required: false },
  { type: 'proof_of_address', label: 'Comprobante de domicilio', required: false },
  { type: 'source_of_funds', label: 'Respaldo del origen de fondos', required: true },
  { type: 'source_of_wealth', label: 'Respaldo del origen del patrimonio', required: false },
] as const;

interface UploadedDoc {
  doc_type: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
}

const STEPS = ['Identidad', 'Exposición política', 'Origen de fondos', 'Documentos', 'Declaración'];

/**
 * Wizard de verificación.
 *
 * Los archivos se suben directamente al bucket privado con una URL firmada que
 * emite la API: el binario nunca pasa por el servidor de Astro, y la política
 * de Storage solo admite rutas bajo la carpeta del propio usuario.
 */
export default function KycWizard({ status, existing, fullName }: Props) {
  const [step, setStep] = useState(0);
  const [identity, setIdentity] = useState({
    legal_name: existing?.legal_name ?? fullName ?? '',
    document_type: existing?.document_type ?? 'DNI',
    document_number: existing?.document_number ?? '',
    nationality: existing?.nationality ?? 'Peruana',
    birth_date: existing?.birth_date ?? '',
    tax_residence: existing?.tax_residence ?? 'PE',
    occupation: existing?.occupation ?? '',
  });
  const [isPep, setIsPep] = useState(false);
  const [pepDetails, setPepDetails] = useState('');
  const [funds, setFunds] = useState({
    source_of_funds: '',
    source_of_wealth: '',
    estimated_net_worth_band: '5-25M' as (typeof NET_WORTH_BANDS)[number],
  });
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  if (status === 'approved' && !result) {
    return (
      <div className="border border-ink bg-white p-10">
        <p className="text-eyebrow uppercase tracking-luxus text-gold-dark">Verificación completa</p>
        <h2 className="mt-4 font-display text-[28px]">Su identidad está verificada</h2>
        <p className="mt-4 text-[14.5px] leading-relaxed text-ink-muted">
          Tiene acceso a la información de Nivel II: precio de referencia,
          ubicación real, valorización y material reservado. Ya puede solicitar
          acceso a Deal Rooms.
        </p>
        <a href="/dashboard" className="btn-primary mt-8">Ir a mi panel</a>
      </div>
    );
  }

  if (result || status === 'submitted' || status === 'in_review') {
    const state = result ?? status;
    return (
      <div className="border border-stone bg-white p-10">
        <p className="text-eyebrow uppercase tracking-luxus text-gold-dark">
          {state === 'approved' ? 'Aprobada' : state === 'rejected' ? 'No completada' : 'En revisión'}
        </p>
        <h2 className="mt-4 font-display text-[28px]">
          {state === 'approved'
            ? 'Verificación aprobada'
            : state === 'rejected'
              ? 'No pudimos completar su verificación'
              : 'Su expediente está en revisión'}
        </h2>
        <p className="mt-4 text-[14.5px] leading-relaxed text-ink-muted">
          {state === 'approved'
            ? 'Ya tiene acceso a la información de Nivel II.'
            : state === 'rejected'
              ? 'Nuestro equipo se pondrá en contacto para indicarle qué documentación falta.'
              : 'El equipo de cumplimiento revisará su expediente manualmente. Le informaremos por correo en cuanto haya una decisión.'}
        </p>
        <a href="/dashboard" className="btn-outline mt-8">Volver al panel</a>
      </div>
    );
  }

  async function uploadFile(docType: string, file: File) {
    setUploading(docType);
    setError(null);

    try {
      const { path, token } = await apiFetch<{ path: string; token: string }>(
        '/v1/kyc/upload-url',
        {
          method: 'POST',
          body: { doc_type: docType, file_name: file.name, mime_type: file.type },
        },
      );

      const { error: uploadError } = await browserClient()
        .storage.from('kyc-documents')
        .uploadToSignedUrl(path, token, file);

      if (uploadError) throw new Error(uploadError.message);

      setDocs((prev) => [
        ...prev.filter((d) => d.doc_type !== docType),
        {
          doc_type: docType,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el archivo.');
    } finally {
      setUploading(null);
    }
  }

  function validateStep(): boolean {
    setError(null);

    if (step === 0) {
      const parsed = kycIdentitySchema.safeParse(identity);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Revise los datos de identidad.');
        return false;
      }
    }
    if (step === 1 && isPep && pepDetails.trim().length < 10) {
      setError('Describa el cargo, la entidad y el periodo.');
      return false;
    }
    if (step === 2) {
      const parsed = kycFundsSchema.safeParse({ ...funds, funds_declaration: {} });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Complete la declaración de origen de fondos.');
        return false;
      }
    }
    if (step === 3) {
      const missing = DOC_SLOTS.filter(
        (slot) => slot.required && !docs.some((d) => d.doc_type === slot.type),
      );
      if (missing.length > 0) {
        setError(`Faltan documentos obligatorios: ${missing.map((m) => m.label).join(', ')}.`);
        return false;
      }
    }
    return true;
  }

  async function submit() {
    if (!validateStep()) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch<{ status: string }>('/v1/kyc/submit', {
        method: 'POST',
        body: {
          identity,
          pep: { is_pep: isPep, pep_details: isPep ? pepDetails : undefined },
          funds: { ...funds, funds_declaration: {} },
          documents: docs,
          declarationAccepted: true,
        },
      });
      setResult(response.status);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar el expediente.');
    } finally {
      setSubmitting(false);
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
        {/* 1 · Identidad */}
        {step === 0 && (
          <fieldset>
            <legend className="font-display text-[24px]">Identidad</legend>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
              Los datos deben coincidir exactamente con su documento oficial.
            </p>

            <div className="mt-8 space-y-5">
              <div>
                <label className="label" htmlFor="k-name">Nombre legal completo</label>
                <input
                  id="k-name" className="field" value={identity.legal_name}
                  onChange={(e) => setIdentity({ ...identity, legal_name: e.target.value })}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="k-doctype">Tipo</label>
                  <select
                    id="k-doctype" className="field" value={identity.document_type}
                    onChange={(e) => setIdentity({ ...identity, document_type: e.target.value })}
                  >
                    <option value="DNI">DNI</option>
                    <option value="CE">Carné de extranjería</option>
                    <option value="PASSPORT">Pasaporte</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="k-docnum">Número de documento</label>
                  <input
                    id="k-docnum" className="field" value={identity.document_number}
                    onChange={(e) => setIdentity({ ...identity, document_number: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="k-nat">Nacionalidad</label>
                  <input
                    id="k-nat" className="field" value={identity.nationality}
                    onChange={(e) => setIdentity({ ...identity, nationality: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="k-birth">Fecha de nacimiento</label>
                  <input
                    id="k-birth" type="date" className="field" value={identity.birth_date}
                    onChange={(e) => setIdentity({ ...identity, birth_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="k-tax">Residencia fiscal</label>
                  <input
                    id="k-tax" className="field" value={identity.tax_residence}
                    onChange={(e) => setIdentity({ ...identity, tax_residence: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="k-occ">Ocupación o actividad</label>
                  <input
                    id="k-occ" className="field" value={identity.occupation}
                    onChange={(e) => setIdentity({ ...identity, occupation: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </fieldset>
        )}

        {/* 2 · PEP */}
        {step === 1 && (
          <fieldset>
            <legend className="font-display text-[24px]">Exposición política</legend>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
              Es persona expuesta políticamente quien desempeña o ha desempeñado
              funciones públicas destacadas, así como sus familiares directos y
              colaboradores cercanos. Declararlo no impide la admisión: activa
              una revisión reforzada.
            </p>

            <div className="mt-8 space-y-3">
              {[
                { value: false, label: 'No soy persona expuesta políticamente' },
                { value: true, label: 'Sí, soy PEP o tengo vínculo directo con una' },
              ].map((option) => (
                <label
                  key={String(option.value)}
                  className={`flex cursor-pointer items-start gap-3 border p-5 ${
                    isPep === option.value ? 'border-ink bg-ivory' : 'border-stone'
                  }`}
                >
                  <input
                    type="radio" name="pep" checked={isPep === option.value}
                    onChange={() => setIsPep(option.value)} className="mt-1 h-4 w-4 accent-ink"
                  />
                  <span className="text-[14.5px]">{option.label}</span>
                </label>
              ))}
            </div>

            {isPep && (
              <div className="mt-6">
                <label className="label" htmlFor="k-pep">Detalle del cargo, entidad y periodo</label>
                <textarea
                  id="k-pep" rows={4} className="field resize-none" value={pepDetails}
                  onChange={(e) => setPepDetails(e.target.value)}
                />
              </div>
            )}
          </fieldset>
        )}

        {/* 3 · Fondos */}
        {step === 2 && (
          <fieldset>
            <legend className="font-display text-[24px]">Origen de fondos y patrimonio</legend>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
              Exigido por la normativa de prevención del lavado de activos. Sea
              concreto: la vaguedad retrasa la aprobación.
            </p>

            <div className="mt-8 space-y-5">
              <div>
                <label className="label" htmlFor="k-funds">Origen de los fondos de la operación</label>
                <textarea
                  id="k-funds" rows={4} className="field resize-none"
                  placeholder="Ej.: venta de participación en sociedad X en 2023, rentas inmobiliarias y dividendos."
                  value={funds.source_of_funds}
                  onChange={(e) => setFunds({ ...funds, source_of_funds: e.target.value })}
                />
                <p className="mt-1.5 text-[12px] text-ink-muted">Mínimo 30 caracteres.</p>
              </div>

              <div>
                <label className="label" htmlFor="k-wealth">Origen del patrimonio</label>
                <textarea
                  id="k-wealth" rows={4} className="field resize-none"
                  placeholder="Ej.: patrimonio familiar construido en agroindustria desde 1988."
                  value={funds.source_of_wealth}
                  onChange={(e) => setFunds({ ...funds, source_of_wealth: e.target.value })}
                />
              </div>

              <div>
                <label className="label" htmlFor="k-band">Patrimonio neto estimado</label>
                <select
                  id="k-band" className="field" value={funds.estimated_net_worth_band}
                  onChange={(e) =>
                    setFunds({
                      ...funds,
                      estimated_net_worth_band: e.target.value as typeof funds.estimated_net_worth_band,
                    })
                  }
                >
                  <option value="1-5M">USD 1M – 5M</option>
                  <option value="5-25M">USD 5M – 25M</option>
                  <option value="25-100M">USD 25M – 100M</option>
                  <option value="100M+">Más de USD 100M</option>
                </select>
              </div>
            </div>
          </fieldset>
        )}

        {/* 4 · Documentos */}
        {step === 3 && (
          <fieldset>
            <legend className="font-display text-[24px]">Documentación</legend>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
              Los archivos se cifran y almacenan en un repositorio privado. Solo
              el equipo de cumplimiento puede consultarlos.
            </p>

            <ul className="mt-8 space-y-3">
              {DOC_SLOTS.map((slot) => {
                const uploaded = docs.find((d) => d.doc_type === slot.type);
                return (
                  <li key={slot.type} className="flex flex-wrap items-center justify-between gap-4 border border-stone p-5">
                    <div className="min-w-0">
                      <p className="text-[14px]">
                        {slot.label}
                        {slot.required && <span className="ml-1 text-gold-dark">*</span>}
                      </p>
                      {uploaded && (
                        <p className="mt-1 truncate text-[12px] text-ink-muted">
                          {uploaded.file_name} · {(uploaded.size_bytes / 1024).toFixed(0)} KB
                        </p>
                      )}
                    </div>

                    <label className={`btn-ghost shrink-0 cursor-pointer px-5 py-2.5 ${uploaded ? 'border-ink text-ink' : ''}`}>
                      {uploading === slot.type ? 'Subiendo…' : uploaded ? 'Reemplazar' : 'Cargar'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="sr-only"
                        disabled={uploading !== null}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadFile(slot.type, file);
                        }}
                      />
                    </label>
                  </li>
                );
              })}
            </ul>

            <p className="mt-5 text-[12px] leading-relaxed text-ink-muted">
              Formatos aceptados: JPG, PNG, WEBP o PDF. Máximo 15 MB por archivo.
            </p>
          </fieldset>
        )}

        {/* 5 · Declaración */}
        {step === 4 && (
          <fieldset>
            <legend className="font-display text-[24px]">Declaración</legend>

            <div className="mt-8 space-y-4 border border-stone bg-ivory p-6 text-[13.5px] leading-relaxed text-ink-muted">
              <p>
                Declaro que la información y documentación proporcionadas son
                veraces, completas y actuales, y que los fondos destinados a
                cualquier operación provienen de actividades lícitas.
              </p>
              <p>
                Autorizo a LUXUS PERÚ S.A.C. a verificar mi identidad a través de
                proveedores especializados y a consultar mi nombre en listas de
                personas expuestas políticamente, sanciones internacionales y
                medios adversos, conforme a la Ley 29733.
              </p>
              <p>
                Me comprometo a comunicar cualquier cambio relevante en la
                información declarada.
              </p>
            </div>

            <div className="mt-8 border border-stone p-6">
              <h3 className="text-eyebrow uppercase tracking-luxus text-ink-muted">Resumen</h3>
              <dl className="mt-4 space-y-2.5 text-[13.5px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Nombre legal</dt>
                  <dd className="text-right">{identity.legal_name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Documento</dt>
                  <dd>{identity.document_type} · {identity.document_number}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">PEP</dt>
                  <dd>{isPep ? 'Sí' : 'No'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Patrimonio estimado</dt>
                  <dd>{funds.estimated_net_worth_band}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Documentos cargados</dt>
                  <dd>{docs.length}</dd>
                </div>
              </dl>
            </div>
          </fieldset>
        )}

        {error && (
          <p role="alert" className="mt-7 border-l-2 border-red-700 bg-red-50 px-4 py-3 text-[13px] text-red-800">
            {error}
          </p>
        )}

        <div className="mt-10 flex items-center gap-3">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className="btn-ghost">
              Atrás
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => validateStep() && setStep(step + 1)}
              className="btn-primary"
            >
              Continuar
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={submitting} className="btn-primary">
              {submitting ? 'Enviando…' : 'Firmar y enviar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
