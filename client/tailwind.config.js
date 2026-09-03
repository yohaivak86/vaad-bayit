/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Assistant', 'Rubik', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
