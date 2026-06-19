/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Luxury glassmorphism palette
        skc: {
          black: '#050505',
          dark: '#0f0f0f',
          white: '#ffffff',
          gold: '#e4c777',
          'gold-light': '#f0d88a',
          'gold-dark': '#c4a755',
          glass: 'rgba(255, 255, 255, 0.08)',
          'glass-border': 'rgba(255, 255, 255, 0.12)',
          'glass-hover': 'rgba(255, 255, 255, 0.14)',
        },
      },
      fontFamily: {
        display: ['"SF Pro Display"', '"Inter"', 'sans-serif'],
        mono: ['"SF Mono"', '"JetBrains Mono"', 'monospace'],
      },
      backdropBlur: {
        glass: '24px',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        pulseGold: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(228, 199, 119, 0.2)' },
          '100%': { boxShadow: '0 0 40px rgba(228, 199, 119, 0.4)' },
        },
      },
    },
  },
  plugins: [],
};