/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        chameleon: {
          DEFAULT: '#22c55e',
          glow: '#4ade80',
          dark: '#166534',
        },
        ink: {
          DEFAULT: '#0b1215',
          soft: '#111c22',
          card: '#182428',
          border: '#243239',
        },
        red: { deck: '#ef4444' },
        orange: { deck: '#f59e0b' },
        green: { deck: '#22c55e' },
      },
    },
  },
  plugins: [],
};
