/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  corePlugins: {
    preflight: false, // DO NOT break legacy CSS!
  },
  theme: {
    extend: {
      colors: {
        'gb-gold': '#e8c879',
        'gb-bg': '#070a10',
        'gb-txt': '#e9e4d6',
        'gb-txt-dim': '#9aa2ae',
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', 'sans-serif'],
        serif: ['Georgia', '"Times New Roman"', 'serif'],
      }
    },
  },
  plugins: [],
}
