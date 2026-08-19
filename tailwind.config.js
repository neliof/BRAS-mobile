/** @type {import('tailwindcss').Config} */

// As cores não são valores fixos: são variáveis que o ThemeProvider define em
// runtime (`vars()` do NativeWind). O formato `rgb(var(--x) / <alpha-value>)` é
// o que mantém os modificadores de opacidade a funcionar — `bg-brand/20`,
// `text-fg/60`, `border-fg/20` — com qualquer tema ativo.
const themed = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        canvas: themed('canvas'),
        fg: themed('fg'),
        brand: themed('brand'),
        'on-brand': themed('on-brand'),
        danger: themed('danger'),
      },
    },
  },
  plugins: [],
};
