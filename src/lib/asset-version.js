// Asset version helper — central source of truth for cache-busted assets
// Replaces hardcoded ?v=xxx in 36+ Astro PageHead components (PC-003)
// Run `node scripts/cache-bust.js` to update VERSIONS below after CSS/JS changes

export const ASSET_VERSIONS = {
  'css/command-palette.css': '3b88813f',
  'css/enhancements-runtime.css': 'd195a91d',
  'css/floating-cluster.css': '32f9c258',
  'css/highlights-runtime.css': '56e14002',
  'css/home.css': '4a2fa9a3',
  'css/mobile-hotfix.css': '9cfd6aee',
  'css/nagornaya-mobile-toc.css': 'bded2f86',
  'css/reader-preferences.css': 'f424e5ed',
  'css/series-manuscript.css': '77915032',
  'css/series-samizdat.css': '6d9658bd',
  'css/site.css': 'd93eb6c6',
  'css/sw-toast.css': '2e540077',
  'css/tts-download-notice.css': 'a72ba924',
  'fonts/fonts.css': '864cc57a',
  'js/bookmark-engine.js': 'e7d193e0',
  'js/enhancements.js': '15476429',
  'js/floating-cluster-controller.js': '35b029c8',
  'js/glossary.js': 'c7f8b6e9',
  'js/highlights.js': '3c7d5b5d',
  'js/nagornaya-bar-extras.js': '3c7e0bdd',
  'js/nagornaya-mobile-toc.js': 'a0b23b1c',
  'js/reader-library-dock.js': '315d5992',
  'js/reader-library-presenter.js': 'cef6e2a5',
  'js/reader-library-v3.js': 'e036d5a6',
  'js/reader-preferences-head.js': '3ddf9706',
  'js/reader-preferences.js': '28c2ed61',
  'js/reader-state.js': 'b3deb501',
  'js/scroll-perf.js': '454d6f7b',
  'js/search.js': '75df3eab',
  'js/site-utils.js': 'e80f1dfb',
  'js/site.js': '9fa8818a',
  'js/sw-register.js': '921dd6a2',
  'js/vosk-custom-terms.json': 'ca9a51cc',
  'js/vosk-stress-lookup.js': '2c33f2e9',
  'js/vosk-stress-marker.bin': '3ae166fc',
  'js/vosk-tts-core.js': '431034cc',
  'js/vosk-tts-engine.js': '8a878744',
  'js/vosk-tts-worker.js': 'd5850c06',
  'nagornaya/tw.min.css': 'bee34e73',
};

export function assetUrl(path) {
  const clean = String(path).replace(/^\//, '');
  const v = ASSET_VERSIONS[clean];
  return v ? `/${clean}?v=${v}` : `/${clean}`;
}
