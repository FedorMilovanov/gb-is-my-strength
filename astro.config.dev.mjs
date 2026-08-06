// Dev-only Astro config used by the Arena live preview. It extends the real
// astro.config.mjs (so the built site is unaffected) and only relaxes the Vite
// dev-server host allowlist so the proxied preview host can load. Not shipped.
import { defineConfig } from 'astro/config';
import base from './astro.config.mjs';

export default defineConfig({
  ...base,
  server: {
    host: true,
    port: 4321,
    allowedHosts: true,
  },
});
