/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        bg: '#0a0a0f',
        accent: '#6e56cf',
        'accent-hover': '#7c66dc',
        text: '#ededef',
        'text-muted': 'rgba(237, 237, 239, 0.38)',
        'text-secondary': 'rgba(237, 237, 239, 0.65)',
      },
    },
  },
  plugins: [],
};
