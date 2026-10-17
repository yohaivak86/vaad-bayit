// Tailwind is only a utility layer on top of the Lumen design system (src/lumen.css): every colour
// below resolves to a Lumen token, so a utility like `text-slate-500` or `bg-blue-600` still follows
// the one interactive colour, the neutrals and the dark theme. Hues that used to be decorative
// (violet, amber, teal...) collapse to neutrals; only status colours stay coloured.

// A colour that supports Tailwind's opacity modifier (`bg-blue-600/40`) on top of a CSS variable.
const tok = (name) => ({ opacityValue }) =>
  opacityValue === undefined || Number(opacityValue) === 1
    ? `var(--${name})`
    : `color-mix(in srgb, var(--${name}) ${Math.round(Number(opacityValue) * 100)}%, transparent)`;

const scale = (map) => map;

// neutral text/surfaces
const neutral = scale({
  50: tok('bg-grouped'),
  100: tok('fill-quiet'),
  200: tok('separator'),
  300: tok('separator'),
  400: tok('label-secondary'),
  500: tok('label-secondary'),
  600: tok('label-secondary'),
  700: tok('label'),
  800: tok('label'),
  900: tok('label'),
});

// one status / interactive hue: soft tint for 50-200, the solid colour for the rest
const hue = (name, tint) =>
  scale({
    50: tok(tint),
    100: tok(tint),
    200: tok(tint),
    300: tok(name),
    400: tok(name),
    500: tok(name),
    600: tok(name),
    700: tok(name),
    800: tok(name),
    900: tok(name),
  });

const accent = hue('accent', 'accent-tint');
const danger = hue('danger', 'danger-tint');
const success = hue('success', 'success-tint');
const warning = hue('warning', 'warning-tint');

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // Lumen supplies the base styles; index.css adds a small reset instead of Tailwind's preflight
  // (which would flatten Lumen's headings).
  corePlugins: { preflight: false },
  theme: {
    extend: {
      fontFamily: { sans: ['var(--font-sans)'] },
      colors: {
        white: tok('surface'),
        slate: neutral,
        gray: neutral,
        zinc: neutral,
        stone: neutral,
        blue: accent,
        indigo: accent,
        sky: accent,
        cyan: accent,
        red: danger,
        rose: danger,
        pink: danger,
        emerald: success,
        green: success,
        lime: success,
        teal: success,
        amber: warning,
        yellow: warning,
        orange: warning,
        violet: neutral,
        purple: neutral,
        fuchsia: neutral,
      },
      borderRadius: {
        lg: 'var(--radius-sm)',
        xl: 'var(--radius-md)',
        '2xl': 'var(--radius-lg)',
        '3xl': 'var(--radius-lg)',
      },
      boxShadow: {
        lg: 'var(--shadow-card)',
        xl: 'var(--shadow-card)',
        '2xl': 'var(--shadow-card)',
      },
    },
  },
  plugins: [],
};
