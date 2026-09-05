/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          soft: 'rgb(var(--ink-soft) / <alpha-value>)',
          faint: 'rgb(var(--ink-faint) / <alpha-value>)',
        },
        paper: 'rgb(var(--paper) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        solid: {
          DEFAULT: 'rgb(var(--solid) / <alpha-value>)',
          soft: 'rgb(var(--solid-soft) / <alpha-value>)',
        },
        mark: {
          DEFAULT: 'rgb(var(--mark) / <alpha-value>)',
          bright: 'rgb(var(--mark-bright) / <alpha-value>)',
          faint: 'rgb(var(--mark-faint) / <alpha-value>)',
        },
        edge: 'rgb(var(--edge) / <alpha-value>)',
      },
      fontFamily: {
        type: ['"Special Elite"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};