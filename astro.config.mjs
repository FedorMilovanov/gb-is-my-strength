import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import { unified } from '@astrojs/markdown-remark';

export default defineConfig({
  site: 'https://gospod-bog.ru',
  trailingSlash: 'always',
  output: 'static',

  // Phase 1: preserve Astro 6 inline-whitespace semantics while all
  // text, MDX and visual contracts validate the Astro 7 compiler.
  compressHTML: true,

  // Phase 1: retain the proven unified Markdown pipeline. Sätteri is
  // evaluated later in a separate content-parity migration.
  markdown: {
    processor: unified(),
  },

  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/izbrannoe'), // personal/localStorage page — noindex, not for search engines
    }),
    react(),
  ],
});
