import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import sitemapPolicy from './scripts/astro-sitemap-policy.cjs';

export default defineConfig({
  site: 'https://gospod-bog.ru',
  trailingSlash: 'always',
  output: 'static',
  integrations: [
    mdx(),
    sitemap({
      filter: sitemapPolicy.shouldIncludeSitemapUrl, // same policy as the other sitemap and search surfaces
    }),
    react(),
  ],
});
