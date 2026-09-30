/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        terracotta: '#C76B4A',
        'terracotta-dark': '#A25238',
      },
    },
  },
  plugins: [],
};