/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0F',
        surface: '#12121A',
        border: '#1E1E2E',
        primary: '#84CC16',
        'score-green': '#00D4AA',
        'score-yellow': '#FFB800',
        'score-red': '#FF4757',
        'text-primary': '#F0F0FF',
        'text-muted': '#6B6B8A',
      },
      fontFamily: {
        mono: ['"DM Mono"', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
