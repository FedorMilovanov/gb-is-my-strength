import { fileURLToPath } from 'node:url';
import contractModule from './lib/reader-desktop-contract.js';
import projectorModule from './lib/reader-desktop-dist.js';

// One production build owner. No HTTP server, route middleware or alternate
// registry is involved in publishing the approved W57 presentation.
export default function readerDesktop() {
  return {
    name: 'gb-reader-desktop',
    hooks: {
      'astro:build:done': ({dir, logger}) => {
        const result = projectorModule.projectDesktopDist({
          distDir: fileURLToPath(dir),
          sourceDir: fileURLToPath(new URL('../research/reader-w57-pilot/assets/', import.meta.url)),
          contract: contractModule.buildDesktopReaderContract(),
        });
        logger.info('Published '+result.routes+' Reader heads and '+result.assets+' verified assets');
      },
    },
  };
}
