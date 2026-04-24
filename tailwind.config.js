/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        hand: ['Caveat', 'Bradley Hand', 'Comic Sans MS', 'cursive'],
      },
      colors: {
        desk: {
          DEFAULT: '#1c1a18',
          light: '#2b2622',
        },
        paper: {
          DEFAULT: '#fbfaf4',
          50: '#ffffff',
          100: '#fbfaf4',
          200: '#f3f0e5',
          300: '#e8e4d4',
        },
        ink: {
          DEFAULT: '#1e3a6e',
          dark: '#0f1a3a',
          light: '#3a5290',
          faded: '#6a7a9c',
          red: '#b91c1c',
          green: '#166534',
        },
        rule: '#222222',
      },
      boxShadow: {
        paper: '0 2px 6px rgba(0,0,0,0.25), 0 12px 30px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
};
