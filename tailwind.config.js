/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        bg: '#14161A',
        accent: '#7B5CFF',
        'accent-hover': '#8F76FF',
        text: '#F5F6F8',
        'text-muted': '#7E848E',
        'text-secondary': '#A1A6B0',
      },
    },
  },
  plugins: [],
};
