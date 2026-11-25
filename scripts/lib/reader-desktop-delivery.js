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
  const links = contract.styles.map(asset => ({ href: assetUrl(asset), media: 'not all' }));
  const code = `(function(){
  'use strict';
  if (window.__gbReaderDesktopDelivery) return;
  window.__gbReaderDesktopDelivery = true;
  var links = document.querySelectorAll('link[data-gb-reader-desktop-css]');
  function nativeStyles() { links.forEach(function(link){ link.media = 'not all'; }); }
  var comparison = new URLSearchParams(window.location.search).getAll('reader-pilot');
  if (comparison.length === 1 && comparison[0] === '0') { nativeStyles(); return; }
  var desktop = window.matchMedia('${MEDIA}');
  // A width-only media change is not evidence of a screen resize: physical
  // print can change that query before beforeprint or restore it after
  // afterprint. Require a screen resize witness and matching live viewport.
  var printMedia = window.matchMedia('print');
  var screenMedia = window.matchMedia('screen');
  var screenDesktop = desktop.matches;
  var printActive = printMedia.matches;
  var resizeWitness = false;
  var reconcileFrame = 0;
  function inPrint() {
    return printActive || printMedia.matches || !screenMedia.matches ||
      document.documentElement.hasAttribute('data-gb-print-prepared');
  }
  function usableScreenViewport() {
    // Chromium can expose a transient 1x1 capture viewport (also zero during
    // teardown). No reader layout is usable there; do not reload the document.
    return window.innerWidth > 1 && window.innerHeight > 1;
  }
  function forgetResize() {
    resizeWitness = false;
    if (reconcileFrame) cancelAnimationFrame(reconcileFrame);
    reconcileFrame = 0;
  }
  function reconcileScreen() {
    if (!resizeWitness) return;
    if (reconcileFrame) cancelAnimationFrame(reconcileFrame);
    reconcileFrame = requestAnimationFrame(function(){
      reconcileFrame = 0;
      if (inPrint() || !usableScreenViewport()) { forgetResize(); return; }
      var viewportDesktop = window.innerWidth >= 1121;
      // A transient media/viewport mismatch is not a screen crossing.
      if (desktop.matches !== viewportDesktop) return;
      resizeWitness = false;
      if (viewportDesktop !== screenDesktop) window.location.reload();
    });
  }
  window.addEventListener('beforeprint',function(){ printActive = true; forgetResize(); });
  window.addEventListener('afterprint',function(){ printActive = false; forgetResize(); });
  printMedia.addEventListener('change',function(event){ if (event.matches) forgetResize(); });
  window.addEventListener('resize',function(){
    if (inPrint() || !usableScreenViewport()) { forgetResize(); return; }
    resizeWitness = true;
    reconcileScreen();
  });
  desktop.addEventListener('change',reconcileScreen);
  if (!desktop.matches) return;
  // The original links are inert until every required CSS resource is ready.
  // A failed script may already have reparented controls: only a fresh Classic
  // document is a safe rollback, not an attempt to undo another runtime's DOM.
  var stopped = false, started = false, cssReady = false, domReady = document.readyState !== 'loading';
  var deadline = setTimeout(function(){ fallback('mount timeout'); }, 12000);
  var poll;
  function fallback(reason) {
    if (stopped) return;
    stopped = true;
    clearTimeout(deadline);
    clearTimeout(poll);
    nativeStyles();
    console.error('Reader desktop: '+reason+'; restoring Classic');
    var next = new URL(window.location.href);
    next.searchParams.set('reader-pilot','0');
    window.location.replace(next.href);
  }
  function assetError(event) {
    if (event.filename && new URL(event.filename,window.location.href).pathname.startsWith('${PREFIX}')) {
      fallback('runtime error: '+event.filename);
    }
  }
  window.addEventListener('error',assetError);
  function ready() {
    if (stopped) return;
    if (document.body.classList.contains('np-w57-ready') &&
        window.__NP_UNIVERSAL_PREVIEW__?.ready && window.__NP_W57_ANNOTATIONS__?.ready) {
      stopped = true;
      clearTimeout(deadline);
      window.removeEventListener('error',assetError);
      return;
    }
    poll = setTimeout(ready,50);
  }
  var scripts = ${JSON.stringify(contract.scripts.map(assetUrl))};
  function load(index) {
    if (stopped) return;
    if (index === scripts.length) { ready(); return; }
    var script = document.createElement('script');
    script.src = scripts[index];
    script.async = false;
    script.onload = function(){ load(index+1); };
    script.onerror = function(){ fallback('required script failed: '+scripts[index]); };
    document.body.appendChild(script);
  }
  function mount() {
    if (stopped || started || !desktop.matches || !cssReady || !domReady) return;
    started = true;
    var state = window.ReaderState;
    if (!state || typeof state.subscribe !== 'function' || typeof state.getSnapshot !== 'function') {
      fallback('canonical ReaderState unavailable');
      return;
    }
    load(0);
  }
  function stylesReady() {
    if (stopped || cssReady) return;
    if (Array.from(links).every(function(link){ return !!link.sheet; })) {
      cssReady = true;
      links.forEach(function(link){ link.media = '${MEDIA}'; });
      mount();
    }
  }
  if (links.length !== ${contract.styles.length}) { fallback('required styles missing'); return; }
  links.forEach(function(link){
    link.addEventListener('load',stylesReady,{once:true});
    link.addEventListener('error',function(){ fallback('required stylesheet failed: '+link.href); },{once:true});
  });
  if (!domReady) document.addEventListener('DOMContentLoaded',function(){ domReady = true; mount(); },{once:true});
  stylesReady();
})();`;
  const bootstrap = { code, sha256: sha256(code) };
  bootstrap.href = `${PREFIX}bootstrap.js?v=${bootstrap.sha256}`;
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
      fs.writeFileSync(path.join(target, 'bootstrap.js'), bootstrap.code, 'utf8');
      return verified.map(({ asset }) => assetUrl(asset));
    },
  };
}

module.exports = { createDesktopDelivery, PREFIX, MEDIA };
