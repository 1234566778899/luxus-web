import { useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';

type Profile = 'buyer' | 'family_office' | 'seller' | 'broker';

const PROFILES: { value: Profile; label: string; description: string }[] = [
  {
    value: 'buyer',
    label: 'Comprador privado',
    description: 'Adquisición para patrimonio propio o familiar.',
  },
  {
    value: 'family_office',
    label: 'Family office',
    description: 'Mandato de inversión en nombre de una o varias familias.',
  },
  {
    value: 'seller',
    label: 'Propietario / vendedor',
    description: 'Desea presentar un activo para su evaluación.',
  },
  {
    value: 'broker',
    label: 'Bróker o asesor',
    description: 'Representa mandatos de terceros con exclusividad.',
  },
];

const BUDGETS = [
  'USD 500K – 1M',
  'USD 1M – 3M',
  'USD 3M – 10M',
  'USD 10M – 30M',
  'Más de USD 30M',
  'Prefiero no indicarlo',
];

/**
 * Formulario de admisión.
 *
 * Tres pasos deliberados: el perfil condiciona qué se pregunta después, y el
 * paso final exige el consentimiento expreso de la Ley 29733. No promete
 * acceso inmediato: cada solicitud la revisa el equipo.
 */
export default function PrivateAccessForm() {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSellSide = profile === 'seller' || profile === 'broker';

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    const form = new FormData(event.currentTarget);
    setSending(true);
    setError(null);

    try {
      await apiFetch('/v1/private-access', {
        method: 'POST',
        body: {
          applicant_profile: profile,
          full_name: String(form.get('full_name') ?? ''),
          email: String(form.get('email') ?? ''),
          phone: String(form.get('phone') ?? '') || undefined,
          company: String(form.get('company') ?? '') || undefined,
          country: String(form.get('country') ?? 'PE'),
          city: String(form.get('city') ?? '') || undefined,
          interest: form.getAll('interest').join(', ') || undefined,
          budget_range: String(form.get('budget_range') ?? '') || undefined,
          message: String(form.get('message') ?? '') || undefined,
          acceptPrivacy: form.get('acceptPrivacy') === 'on',
          website: String(form.get('website') ?? ''),
        },
      });
      setSent(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No pudimos registrar su solicitud. Inténtelo de nuevo en unos minutos.',
      );
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="border border-ink bg-white px-8 py-16 text-center sm:px-16">
        <div className="mx-auto flex h-16 w-16 items-center justify-center border border-gold">
          <svg className="h-7 w-7 text-gold-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
            <path d="M4 12.5 L9.5 18 L20 6.5" strokeLinecap="square" />
          </svg>
        </div>

        <h2 className="mt-8 font-display text-[32px] leading-tight">Solicitud recibida</h2>

        <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-ink-muted">
          Su solicitud entró en revisión. Evaluamos cada admisión de forma
          individual y respondemos por correo. Si es aprobada, recibirá una
          invitación personal para establecer su contraseña.
        </p>

        <div className="mx-auto mt-10 max-w-md border-t border-stone pt-8 text-left">
          <p className="text-eyebrow uppercase tracking-luxus text-ink-muted">Qué sucede después</p>
          <ol className="mt-4 space-y-3 text-[13.5px] leading-relaxed text-ink-muted">
            <li>1 · Revisión de la solicitud por el equipo de LUXUS.</li>
            <li>2 · Invitación personal y alta con verificación en dos pasos.</li>
            <li>3 · Verificación de identidad y declaración de origen de fondos.</li>
            <li>4 · Acceso Nivel II y solicitud de Deal Rooms.</li>
          </ol>
        </div>

        <a href="/" className="btn-outline mt-10">Volver al inicio</a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="border border-stone bg-white" noValidate>
      {/* Indicador de pasos */}
      <ol className="flex divide-x divide-stone border-b border-stone" aria-label="Progreso">
        {['Perfil', 'Datos', 'Confirmación'].map((label, index) => (
          <li
            key={label}
            aria-current={step === index ? 'step' : undefined}
            className={`flex-1 px-5 py-4 text-[11px] uppercase tracking-luxus ${
              step === index ? 'bg-ink text-white' : step > index ? 'text-ink' : 'text-ink-muted/60'
            }`}
          >
            <span className="mr-2 opacity-60">{String(index + 1).padStart(2, '0')}</span>
            {label}
          </li>
        ))}
      </ol>

      <div className="p-8 sm:p-12">
        {/* Honeypot */}
        <input
          type="text" name="website" tabIndex={-1} autoComplete="off"
          aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 opacity-0"
        />

        {/* Paso 1 — perfil */}
        <fieldset className={step === 0 ? '' : 'hidden'}>
          <legend className="font-display text-[26px]">¿Cómo se presenta?</legend>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
            El perfil determina qué información necesitamos y qué acceso se evalúa.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {PROFILES.map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer border p-6 transition-colors ${
                  profile === option.value
                    ? 'border-ink bg-ivory'
                    : 'border-stone hover:border-stone-dark'
                }`}
              >
                <input
                  type="radio"
                  name="applicant_profile"
                  value={option.value}
                  checked={profile === option.value}
                  onChange={() => setProfile(option.value)}
                  className="sr-only"
                />
                <span className="block font-display text-[19px] text-ink">{option.label}</span>
                <span className="mt-2 block text-[13px] leading-relaxed text-ink-muted">
                  {option.description}
                </span>
              </label>
            ))}
          </div>

          <button
            type="button"
            disabled={!profile}
            onClick={() => setStep(1)}
            className="btn-primary mt-10"
          >
            Continuar
          </button>
        </fieldset>

        {/* Paso 2 — datos */}
        <fieldset className={step === 1 ? '' : 'hidden'}>
          <legend className="font-display text-[26px]">Sus datos</legend>

          <div className="mt-8 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="pa-name">Nombre completo *</label>
                <input id="pa-name" name="full_name" required minLength={3} maxLength={160} className="field" autoComplete="name" />
              </div>
              <div>
                <label className="label" htmlFor="pa-email">Correo electrónico *</label>
                <input id="pa-email" name="email" type="email" required className="field" autoComplete="email" />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="pa-phone">Teléfono</label>
                <input id="pa-phone" name="phone" type="tel" className="field" autoComplete="tel" />
              </div>
              <div>
                <label className="label" htmlFor="pa-company">
                  {isSellSide ? 'Empresa *' : 'Empresa o family office'}
                </label>
                <input
                  id="pa-company" name="company" maxLength={200}
                  required={isSellSide} className="field" autoComplete="organization"
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="pa-country">País de residencia</label>
                <input id="pa-country" name="country" defaultValue="PE" maxLength={80} className="field" autoComplete="country-name" />
              </div>
              <div>
                <label className="label" htmlFor="pa-city">Ciudad</label>
                <input id="pa-city" name="city" maxLength={120} className="field" autoComplete="address-level2" />
              </div>
            </div>

            <div>
              <span className="label">Categorías de interés</span>
              <div className="flex flex-wrap gap-2">
                {[
                  ['real-estate', 'Inmuebles'],
                  ['companies', 'Empresas'],
                  ['vehicles', 'Vehículos'],
                  ['yachts', 'Yates'],
                  ['aircraft', 'Aeronaves'],
                ].map(([value, label]) => (
                  <label
                    key={value}
                    className="cursor-pointer border border-stone px-4 py-2 text-[12px] uppercase tracking-luxus text-ink-muted transition-colors has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white"
                  >
                    <input type="checkbox" name="interest" value={label} className="sr-only" />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {!isSellSide && (
              <div>
                <label className="label" htmlFor="pa-budget">Rango de inversión previsto</label>
                <select id="pa-budget" name="budget_range" className="field" defaultValue="">
                  <option value="">Seleccione un rango</option>
                  {BUDGETS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="label" htmlFor="pa-message">
                {isSellSide ? 'Describa el activo que desea presentar' : 'Mensaje'}
              </label>
              <textarea
                id="pa-message" name="message" rows={4} maxLength={2000} className="field resize-none"
                placeholder={
                  isSellSide
                    ? 'Tipo de activo, ubicación aproximada, situación registral y expectativa de valor.'
                    : 'Cuéntenos qué busca y en qué plazo.'
                }
              />
            </div>
          </div>

          <div className="mt-10 flex gap-3">
            <button type="button" onClick={() => setStep(0)} className="btn-ghost">Atrás</button>
            <button type="button" onClick={() => setStep(2)} className="btn-primary">Continuar</button>
          </div>
        </fieldset>

        {/* Paso 3 — confirmación */}
        <fieldset className={step === 2 ? '' : 'hidden'}>
          <legend className="font-display text-[26px]">Confirmación</legend>

          <div className="mt-8 space-y-6 border border-stone bg-ivory p-6 text-[13.5px] leading-relaxed text-ink-muted">
            <p>
              LUXUS PERÚ opera por invitación. Su solicitud será evaluada por el
              equipo y la decisión se comunica por correo. La admisión no es
              automática ni garantizada.
            </p>
            <p>
              Al ser admitido deberá completar un proceso de verificación de
              identidad y declarar el origen de sus fondos y patrimonio, conforme
              a las obligaciones de prevención de lavado de activos aplicables.
            </p>
          </div>

          <label className="mt-8 flex items-start gap-3 text-[13.5px] leading-relaxed text-ink-muted">
            <input type="checkbox" name="acceptPrivacy" required className="mt-1 h-4 w-4 shrink-0 accent-ink" />
            <span>
              Autorizo el tratamiento de mis datos personales conforme a la
              Ley 29733, Ley de Protección de Datos Personales, y a la{' '}
              <a href="/legal/privacy" className="link-underline text-ink" target="_blank" rel="noopener">
                política de privacidad
              </a>{' '}
              de LUXUS PERÚ S.A.C. *
            </span>
          </label>

          {error && (
            <p role="alert" className="mt-6 border-l-2 border-red-700 bg-red-50 px-4 py-3 text-[13px] text-red-800">
              {error}
            </p>
          )}

          <div className="mt-10 flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="btn-ghost">Atrás</button>
            <button type="submit" disabled={sending} className="btn-primary">
              {sending ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </div>
        </fieldset>
      </div>
    </form>
  );
}
