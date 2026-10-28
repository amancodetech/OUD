import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-cairo)', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-cairo)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Warm stone/oud-tinted neutrals replacing cold blue-slate & gray
        slate: {
          50: '#FAF6F0',
          100: '#F4ECE1',
          200: '#E6D7C3',
          300: '#D4BFA6',
          400: '#A68A71',
          500: '#7D634E',
          600: '#5C4433',
          700: '#432E21',
          800: '#2E1C14',
          900: '#24110D',
          950: '#170907',
        },
        gray: {
          50: '#FAF6F0',
          100: '#F4ECE1',
          200: '#E6D7C3',
          300: '#D5C0A7',
          400: '#9E846C',
          500: '#755C48',
          600: '#574030',
          700: '#3E2A1D',
          800: '#291911',
          900: '#1F100B',
          950: '#140906',
        },
        // Royal Crimson & Burgundy Red (الأحمر العنابي الملكي)
        crimson: {
          50: '#FDF2F2',
          100: '#FBE4E4',
          200: '#F7CACA',
          300: '#F0A3A3',
          400: '#E26D6D',
          500: '#CE3E3E',
          600: '#B0252A',
          700: '#8B1E24',
          800: '#6E171C',
          900: '#4A1014',
          950: '#2B090C',
        },
        // Aged Agarwood / Oud Wood (خشب العود المعتّق)
        oud: {
          50: '#FBF7F2',
          100: '#F5EDE2',
          200: '#EAD8C3',
          300: '#DBBD9C',
          400: '#C6996E',
          500: '#B07B4E',
          600: '#94603B',
          700: '#784A2F',
          800: '#5C3A21',
          900: '#3D2414',
          950: '#241309',
        },
        // Dehn Al-Oud Amber Gold (دهن العود الكهرماني والذهبي)
        dehn: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
          950: '#451A03',
        },
      },
    },
  },
  plugins: [],
};
export default config;
