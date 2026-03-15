/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FDF6EE',
        'cream-dark': '#F5E8D4',
        amber: '#B86C2F',
        'amber-dark': '#854F0B',
        'amber-light': '#FAEEDA',
        terracotta: '#993C1D',
        sage: '#5C7A4E',
        'sage-light': '#EAF3DE',
        muted: '#9C7A5C',
        'muted-light': '#E2CEBC',
        dark: '#2A180A',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        xl: '14px',
        '2xl': '20px',
        '3xl': '28px',
      },
    },
  },
  plugins: [],
};
