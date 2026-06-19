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
        // Lightweight game-tile art — transform/opacity only (GPU-friendly).
        reel: { '0%': { transform: 'translateY(0)' }, '100%': { transform: 'translateY(-50%)' } },
        coin3d: { '0%': { transform: 'rotateY(0deg)' }, '100%': { transform: 'rotateY(360deg)' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-5px)' } },
        ball: {
          '0%,100%': { transform: 'translate(-26px,6px)' },
          '50%': { transform: 'translate(26px,-6px)' },
        },
        // Casino interactions — reel spin, celebration, jackpot glow.
        pop: {
          '0%': { opacity: '0', transform: 'scale(0.7)' },
          '60%': { transform: 'scale(1.06)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        // A card dealt onto the table — slides down from the dealer with a flick.
        deal: {
          '0%': { opacity: '0', transform: 'translateY(-26px) rotate(-8deg) scale(0.92)' },
          '100%': { opacity: '1', transform: 'translateY(0) rotate(0) scale(1)' },
        },
        'reel-spin': { '0%': { transform: 'translateY(0)' }, '100%': { transform: 'translateY(-66.6667%)' } },
        // Seamless reel scroll: strip is 3 identical copies, so -33.3333% = one copy.
        'reel-roll': { '0%': { transform: 'translateY(0)' }, '100%': { transform: 'translateY(-33.3333%)' } },
        glow: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(201,162,75,0)', borderColor: 'rgba(201,162,75,0.3)' },
          '50%': { boxShadow: '0 0 24px 5px rgba(201,162,75,0.5)', borderColor: 'rgba(201,162,75,0.9)' },
        },
        confetti: {
          '0%': { transform: 'translateY(-12px) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(360px) rotate(620deg)', opacity: '0' },
        },
        'jackpot-flash': {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(1.04)' },
        },
        shake: {
          '10%,90%': { transform: 'translateX(-1px)' },
          '30%,70%': { transform: 'translateX(2px)' },
          '50%': { transform: 'translateX(-2px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s cubic-bezier(0.22,0.61,0.36,1)',
        sheen: 'sheen 6s linear infinite',
        livedot: 'livedot 1.4s ease-in-out infinite',
        'spin-slow': 'spin 7s linear infinite',
        reel: 'reel 2.4s linear infinite',
        coin3d: 'coin3d 2.4s linear infinite',
        floaty: 'floaty 3.4s ease-in-out infinite',
        ball: 'ball 3s ease-in-out infinite',
        pop: 'pop 0.4s cubic-bezier(0.22,0.61,0.36,1)',
        deal: 'deal 0.32s cubic-bezier(0.22,0.61,0.36,1) both',
        'reel-spin': 'reel-spin 0.22s linear infinite',
        'reel-roll': 'reel-roll 0.45s linear infinite',
        glow: 'glow 1.8s ease-in-out infinite',
        'jackpot-flash': 'jackpot-flash 0.7s ease-in-out infinite',
        shake: 'shake 0.5s ease-in-out',
      },
    },
  },
  plugins: [],
};
