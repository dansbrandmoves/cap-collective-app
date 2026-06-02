/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // hover: styles apply only on devices that actually support hover (mouse/trackpad),
  // so taps on iPad/touch don't leave buttons stuck in their hover state.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.2s ease-out',
      },
      colors: {
        surface: {
          950: 'var(--surface-950)',
          900: 'var(--surface-900)',
          800: 'var(--surface-800)',
          700: 'var(--surface-700)',
          600: 'var(--surface-600)',
        },
        // Arro/erro brand teal — calm, muted sea-green. Replaces the old violet accent
        // app-wide (buttons, tabs, rings, badges, availability). See project_arro_theme.
        accent: {
          DEFAULT: '#5e9c8c',
          hover: '#4f8d7c',
          muted: '#2f4f48',
        },
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      borderRadius: {
        'sheet': '20px',
      },
      boxShadow: {
        'ring-sm': '0 0 0 1px rgb(255 255 255 / 0.05)',
        'ring-md': '0 0 0 1px rgb(255 255 255 / 0.08)',
        'lift': '0 8px 24px -8px rgb(0 0 0 / 0.5), 0 0 0 1px rgb(255 255 255 / 0.06)',
        'sheet': '0 -12px 40px -8px rgb(0 0 0 / 0.6)',
      },
      transitionTimingFunction: {
        'ios': 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
    },
  },
  plugins: [],
}
