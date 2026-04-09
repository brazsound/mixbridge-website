/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#060609',
        accent: '#0a84ff',
        'accent-hover': '#0070e8',
        text: '#f5f5f7',
        'text-muted': 'rgba(245, 245, 247, 0.44)',
        'text-secondary': 'rgba(245, 245, 247, 0.72)',
      },
    },
  },
  plugins: [],
};
