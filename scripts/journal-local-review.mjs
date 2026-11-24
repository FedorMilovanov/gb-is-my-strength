#!/usr/bin/env node
/**
 * Local-only manuscript review. No src/pages file, route profile, sitemap,
 * search entry or production import is created. The history component retains
 * its independent PROD fail-closed guard. Never use this tool as a build/deploy.
 * Run with the repository-supported Node: node scripts/journal-local-review.mjs
 */
import { dev } from 'astro';
import { fileURLToPath } from 'node:url';

if (process.env.NODE_ENV === 'production' || process.argv.length > 2) {
  throw new Error('Journal manuscript review is development-only; build/deploy arguments are forbidden');
}
const port = Number(process.env.JOURNAL_REVIEW_PORT || 4321);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local review port');

const server = await dev({
  root: new URL('../', import.meta.url),
  devToolbar: { enabled: false },
  server: { host: '0.0.0.0', port, allowedHosts: ['.e2b.app'] },
  integrations: [{
    name: 'journal-local-manuscript-review',
    hooks: {
      'astro:config:setup': ({ command, injectRoute }) => {
        if (command !== 'dev') throw new Error('G3 history PUBLICATION_HOLD: local review cannot build');
        injectRoute({
          pattern: '/_review/g3-history/',
          entrypoint: fileURLToPath(new URL('./fixtures/g3-history-review.astro', import.meta.url)),
          prerender: false,
        });
      },
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((req, res, next) => {
          // Review server is not a publication surface, including its public-
          // route mirrors. Browser preview proxies must not cache/index it.
          res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
          res.setHeader('Cache-Control', 'no-store');
          next();
        });
      },
    },
  }],
});
console.log(`Local Journal review: http://localhost:${port}/journal/`);
console.log(`Unpublished manuscript: http://localhost:${port}/_review/g3-history/ (PUBLICATION_HOLD)`);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => { await server.stop(); process.exit(0); });
}
