import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://gospod-bog.ru',
  trailingSlash: 'always',
  output: 'static',
  integrations: [react(), mdx(), sitemap()],
});
