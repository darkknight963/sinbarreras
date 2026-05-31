/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary colors - Institutional Peruvian blue
        primary: {
          900: '#002C76', // Institutional blue, brand primary
          50: '#f0f4ff',  // Very light blue for hover states
        },
        // Secondary colors - Green for success/approval
        secondary: {
          600: '#059669', // Green for success/approval
          50: '#d1fae5',  // Light green for badges
        },
        gob: {
          blue: '#002C76', // oficial Gob.pe blue
          red: '#D3141A',  // oficial Gob.pe red
          dark: '#1D2939',
        },
        // Semantic color tokens for severity and status indicators
        error: {
          900: '#991b1b', // dark red for high severity
          100: '#fee2e2', // light red for error backgrounds
        },
        warning: {
          900: '#9a3412', // dark orange for medium severity
          100: '#ffedd5', // light orange for warning backgrounds
        },
        info: {
          900: '#854d0e', // dark yellow for low severity
          100: '#fef9c3', // light yellow for info backgrounds
        },
        success: {
          900: '#065f46', // dark green for approved status
          100: '#d1fae5', // light green for success backgrounds
        },
        // Neutral color tokens for text and backgrounds
        neutral: {
          900: '#1f2937', // dark text
          700: '#374151', // medium text
          600: '#4b5563', // secondary text
          500: '#64748b', // tertiary text
          200: '#e8ecf1', // subtle borders
          100: '#f3f4f6', // light backgrounds
          50: '#f8fafc',  // very light backgrounds
        },
        white: '#ffffff', // pure white
      },
      // Typography tokens: font families, sizes, and weights
      fontFamily: {
        // Primary font family: Inter with system fallbacks
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'sans-serif'],
        // Monospace fonts for code blocks and HTML evidence
        mono: ['IBM Plex Mono', 'JetBrains Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Font size scale for typography hierarchy
        // Extra small
        'xs': ['0.66rem', { lineHeight: '1rem' }],
        // Small
        'sm': ['0.72rem', { lineHeight: '1rem' }],
        // Small-medium
        'base': ['0.8rem', { lineHeight: '1.5rem' }],
        // Medium
        'md': ['0.85rem', { lineHeight: '1.5rem' }],
        // Medium-large
        'lg': ['0.875rem', { lineHeight: '1.5rem' }],
        // Large
        'xl': ['1rem', { lineHeight: '1.5rem' }],
        // Extra large
        '2xl': ['1.125rem', { lineHeight: '1.75rem' }],
        // 2x extra large
        '3xl': ['1.16rem', { lineHeight: '1.75rem' }],
        // 3x extra large
        '4xl': ['1.25rem', { lineHeight: '2rem' }],
        // 4x extra large
        '5xl': ['1.35rem', { lineHeight: '2rem' }],
        // 5x extra large
        '6xl': ['1.75rem', { lineHeight: '2.25rem' }],
        // 6x extra large
        '7xl': ['3rem', { lineHeight: '1' }],
      },
      fontWeight: {
        // Font weight scale for typography hierarchy
        'normal': 400,
        'medium': 500,
        'semibold': 600,
        'bold': 700,
        'extrabold': 800,
        'black': 900,
      },
    },
  },
  plugins: [],
}
