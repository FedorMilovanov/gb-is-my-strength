'use strict';

// The native Astro head consumes this presentation plan at its tail, after
// native styles. Route membership and asset bytes are owned by W157a's contract.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const PREFIX = '/reader-desktop/';
const MEDIA = '(min-width:1121px)';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const assetUrl = asset => `${PREFIX}${asset.name}?v=${asset.sha256}`;

function createDesktopDelivery(contract) {
  const routes = new Set(contract.routes);
  const assets = [...contract.styles, ...contract.scripts];
  // Do not accept another manifest or a second route-admission rule here.
  if (contract.styles.length !== 6 || contract.scripts.length !== 6 ||
      new Set(assets.map(asset => asset.name)).size !== assets.length ||
      assets.some(asset => !/^reader_[a-z0-9_]+\.(css|js)$/.test(asset.name) ||
        !/^[a-f0-9]{64}$/.test(asset.sha256))) {
    throw new Error('Invalid canonical desktop delivery contract');
  }
  const links = contract.styles.map(asset => ({ href: assetUrl(asset), media: MEDIA }));
  const code = `(function(){
  'use strict';
  if (window.__gbReaderDesktopDelivery) return;
  window.__gbReaderDesktopDelivery = true;
  var links = document.querySelectorAll('link[data-gb-reader-desktop-css]');
  function nativeStyles() { links.forEach(function(link){ link.media = 'not all'; }); }
  var comparison = new URLSearchParams(window.location.search).getAll('reader-pilot');
  if (comparison.length === 1 && comparison[0] === '0') { nativeStyles(); return; }
  var desktop = window.matchMedia('${MEDIA}');
  desktop.addEventListener('change', function(){ window.location.reload(); });
  if (!desktop.matches) return;
  function mount() {
    if (!desktop.matches) return;
    var state = window.ReaderState;
    if (!state || typeof state.subscribe !== 'function' || typeof state.getSnapshot !== 'function') {
      nativeStyles();
      console.error('Reader desktop: canonical ReaderState unavailable');
      return;
    }
    ${JSON.stringify(contract.scripts.map(assetUrl))}.forEach(function(url){
      var script = document.createElement('script');
      script.src = url;
      script.async = false;
      document.body.appendChild(script);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();`;
  const bootstrap = { code, sha256: sha256(code) };
  return {
    // A non-reading route emits neither styles nor bootstrap, even with ?reader-pilot=1.
    headFor(route) { return routes.has(route) ? { links, bootstrap } : null; },
    // The public build copies ONLY the admitted, verified asset bytes, not research/.
    materializeAssets(distDir, sourceDir) {
      const verified = assets.map(asset => {
        const bytes = fs.readFileSync(path.join(sourceDir, asset.name));
        if (bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256) {
          throw new Error(`Desktop delivery asset drift: ${asset.name}`);
        }
        return { asset, bytes };
      });
      const target = path.join(distDir, PREFIX.slice(1));
      fs.mkdirSync(target, { recursive: true });
      for (const { asset, bytes } of verified) fs.writeFileSync(path.join(target, asset.name), bytes);
      return verified.map(({ asset }) => assetUrl(asset));
    },
  };
}

module.exports = { createDesktopDelivery, PREFIX, MEDIA };
