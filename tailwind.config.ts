import type { Config } from 'tailwindcss';

/** Every colour resolves through a CSS variable so the rule-set toggle re-skins the app. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        'surface-2': token('surface-2'),
        border: token('border'),
        text: token('text'),
        muted: token('text-muted'),
        accent: token('accent'),
        'accent-text': token('accent-text'),
        'accent-2': token('accent-2'),
        'accent-2-text': token('accent-2-text'),
        ok: token('ok'),
        warn: token('warn'),
        danger: token('danger'),
      },
      ringColor: { DEFAULT: token('ring') },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
