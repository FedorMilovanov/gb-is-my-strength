import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://gospod-bog.ru',
  trailingSlash: 'always',
  output: 'static',
  integrations: [
    react(),
    mdx(),
    sitemap(),
    tailwind({ applyBaseStyles: false }) // Astro- Tailwind Policy: No global preflight
  ],
});
