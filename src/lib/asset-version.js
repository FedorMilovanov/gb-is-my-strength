// Asset version helper — central source of truth for cache-busted assets
// Replaces hardcoded ?v=xxx in 36+ Astro PageHead components (PC-003)
// Run `node scripts/cache-bust.js` to update VERSIONS below after CSS/JS changes

export const ASSET_VERSIONS = {
  'css/command-palette.css': '3b88813f',
  'css/enhancements-runtime.css': 'd195a91d',
  'css/floating-cluster.css': 'a82d053d',
  'css/highlights-runtime.css': '9f42844a',
  'css/home.css': 'a88bfa00',
  'css/mobile-hotfix.css': '9cfd6aee',
  'css/nagornaya-mobile-toc.css': '83750b6a',
  'css/reader-preferences.css': 'cffee152',
  'css/series-manuscript.css': 'bd1cd86d',
  'css/series-samizdat.css': '7c8ba23f',
  'css/site.css': 'f6ee3488',
  'css/sw-toast.css': '2e540077',
  'css/tts-download-notice.css': 'b9ef192f',
  'fonts/fonts.css': '864cc57a',
  'js/bookmark-engine.js': 'e2ccecf3',
  'js/enhancements.js': '15476429',
  'js/floating-cluster-controller.js': '6d0f336a',
  'js/glossary.js': 'c7f8b6e9',
  'js/highlights.js': 'febe48a8',
  'js/nagornaya-bar-extras.js': '3c7e0bdd',
  'js/nagornaya-mobile-toc.js': 'a0b23b1c',
  'js/reader-preferences-head.js': 'd8b8050c',
  'js/reader-preferences.js': '266587ba',
  'js/reader-state.js': 'b3deb501',
  'js/scroll-perf.js': '454d6f7b',
  'js/search.js': '75df3eab',
  'js/site-utils.js': '32faf133',
  'js/site.js': '9fa8818a',
  'js/sw-register.js': '921dd6a2',
  'js/vosk-custom-terms.json': 'ca9a51cc',
  'js/vosk-stress-marker.bin': '3ae166fc',
  'js/vosk-tts-engine.js': '0cf5da9e',
  'js/vosk-tts-worker.js': '35da9eb0',
  'nagornaya/tw.min.css': 'bee34e73',
};

export function assetUrl(path) {
  const clean = String(path).replace(/^\//, '');
  const v = ASSET_VERSIONS[clean];
  return v ? `/${clean}?v=${v}` : `/${clean}`;
}
