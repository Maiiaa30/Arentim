/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Aretim — dark, gold, warm. Existing token names are remapped to the
        // new palette so the whole app shifts cohesively (see design handoff).
        bg: '#0a0907', // near-black warm page
        surface: '#100e09', // cards, fixtures
        'surface-raised': '#13110a', // avatar inner disc, raised
        hero: '#16120b', // hero/bet-slip panel base
        border: 'rgba(201,162,75,0.16)', // hairline
        'border-strong': 'rgba(201,162,75,0.3)', // modal / bet-slip border
        text: '#f3edde', // headings / primary
        body: '#e7e0d0', // body text
        muted: '#b7ad95', // secondary
        'muted-2': '#9d927a', // tertiary labels/meta
        faint: '#6b6149', // disabled / divider text
        gold: '#C9A24B', // primary accent
        'gold-deep': '#B68A2E',
        'gold-light': '#f3dca0', // sheen / highlight
        accent: '#B68A2E', // legacy "accent" → gold deep (no more violet)
        positive: '#7bbf95', // win
        'positive-felt': '#1f8a5b',
        negative: '#c06b6b', // loss
        'chip-ruby': '#b0303a',
        'chip-navy': '#2b4a8b',
      },
      // Restrained radii everywhere (3–4px); pills stay full, avatars 50%.
      borderRadius: {
        none: '0',
        sm: '3px',
        DEFAULT: '4px',
        md: '4px',
        lg: '4px',
        xl: '4px',
        '2xl': '4px',
        '3xl': '6px',
        full: '9999px',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 14px 44px rgba(40,33,20,0.4)', // warm card hover
        modal: '0 40px 90px rgba(40,33,20,0.5)',
      },
      transitionTimingFunction: {
        aretim: 'cubic-bezier(0.22,0.61,0.36,1)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        sheen: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        livedot: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s cubic-bezier(0.22,0.61,0.36,1)',
        sheen: 'sheen 6s linear infinite',
        livedot: 'livedot 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
