/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: {
          950: '#0c0c0e',
          900: '#141416',
          800: '#1c1c20',
          700: '#26262c',
          600: '#313138',
        },
        accent: {
          DEFAULT: '#f59e0b',
          hover: '#d97706',
          muted: '#92400e',
        },
      },
    },
  },
  plugins: [],
}
