/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Sora', 'DM Sans', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'Consolas', 'monospace'],
      },
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#1E40AF',
          700: '#1E40AF',
          800: '#1E3A8A',
          900: '#172554',
        },
        accent: {
          50: '#fffdf0',
          100: '#fff8d4',
          200: '#fce68a',
          300: '#f5d44a',
          400: '#D4A017',
          500: '#b8860b',
          600: '#8b6914',
        },
        gob: {
          blue: '#1E40AF',
          red: '#D3141A',
          dark: '#0F172A',
        },
        error: {
          900: '#991b1b',
          100: '#fee2e2',
        },
        warning: {
          900: '#9a3412',
          100: '#ffedd5',
        },
        info: {
          900: '#854d0e',
          100: '#fef9c3',
        },
        success: {
          900: '#065f46',
          100: '#d1fae5',
        },
        neutral: {
          900: '#0F172A',
          700: '#334155',
          600: '#475569',
          500: '#64748b',
          200: '#e2e8f0',
          100: '#f1f5f9',
          50: '#F8FAFC',
        },
        white: '#ffffff',
      },
      fontSize: {
        'xs': ['0.7rem', { lineHeight: '1rem' }],
        'sm': ['0.75rem', { lineHeight: '1.1rem' }],
        'base': ['0.8125rem', { lineHeight: '1.4rem' }],
        'md': ['0.875rem', { lineHeight: '1.5rem' }],
        'lg': ['0.9375rem', { lineHeight: '1.5rem' }],
        'xl': ['1.0625rem', { lineHeight: '1.5rem' }],
        '2xl': ['1.25rem', { lineHeight: '1.6rem' }],
        '3xl': ['1.5rem', { lineHeight: '1.7rem' }],
        '4xl': ['1.75rem', { lineHeight: '1.8rem' }],
        '5xl': ['2rem', { lineHeight: '2rem' }],
        '6xl': ['2.5rem', { lineHeight: '2.25rem' }],
        '7xl': ['3rem', { lineHeight: '1' }],
      },
      fontWeight: {
        'normal': 400,
        'medium': 500,
        'semibold': 600,
        'bold': 700,
        'extrabold': 800,
        'black': 900,
      },
      borderRadius: {
        'sm': '6px',
        'md': '10px',
        'lg': '14px',
        'xl': '18px',
        '2xl': '24px',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(15, 23, 42, 0.06)',
        'card': '0 4px 16px rgba(15, 23, 42, 0.08)',
        'elevated': '0 8px 24px rgba(15, 23, 42, 0.12)',
        'modal': '0 20px 50px rgba(0, 0, 0, 0.2)',
        'glow': '0 0 20px rgba(29, 78, 216, 0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'spin-slow': 'spin 1.5s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
