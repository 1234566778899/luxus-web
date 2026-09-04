/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta alineada al lenguaje visual de un marketplace de lujo de
        // referencia: blanco dominante, tipografía casi negra, un único
        // acento en verde azulado profundo para CTAs y enlaces. Los nombres
        // de los tokens (ink/gold/ivory/stone) se conservan por compatibilidad
        // con el resto del código — solo cambia el valor que representan.
        ink: {
          DEFAULT: '#181818',
          deep: '#0A0A0A',
          soft: '#333333',
          muted: '#6B6B6B',
        },
        // "gold" ahora es el acento verde azulado (antes dorado). El nombre
        // del token se mantiene para no reescribir cada componente.
        gold: {
          DEFAULT: '#0F6E6E',
          light: '#15908A',
          dark: '#0B5555',
        },
        ivory: '#FAFAFA',
        stone: {
          DEFAULT: '#E5E5E5',
          dark: '#D4D4D4',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'Times New Roman', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      letterSpacing: {
        luxus: '0.16em',
        wider2: '0.24em',
      },
      fontSize: {
        eyebrow: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.14em' }],
      },
      maxWidth: {
        page: '86rem',
        prose2: '46rem',
      },
      aspectRatio: {
        card: '4 / 3',
        hero: '16 / 9',
        portrait: '3 / 4',
      },
      transitionTimingFunction: {
        luxus: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        'fade-up': 'fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.5s ease both',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
