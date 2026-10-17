// Tailwind is the utility layer; the colourful theme itself lives in src/index.css (on top of the Lumen
// structure in src/lumen.css). Standard Tailwind colours are used as-is.

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // index.css adds a small reset instead of Tailwind's preflight (which would flatten Lumen's headings).
  corePlugins: { preflight: false },
  theme: {
    extend: {
      fontFamily: { sans: ['var(--font-sans)'] },
    },
  },
  plugins: [],
};
