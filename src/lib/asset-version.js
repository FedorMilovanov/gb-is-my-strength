// Asset version helper — central source of truth for cache-busted assets
// Replaces hardcoded ?v=xxx in 36+ Astro PageHead components (PC-003)
// Run `node scripts/cache-bust.js` to update VERSIONS below after CSS/JS changes

export const ASSET_VERSIONS = {
  'css/command-palette.css': '3b88813f',
  'css/enhancements-runtime.css': 'd195a91d',
  'css/floating-cluster.css': 'f06bb3b5',
  'css/highlights-runtime.css': '9f42844a',
  'css/home.css': 'a88bfa00',
  'css/mobile-hotfix.css': '9cfd6aee',
  'css/nagornaya-mobile-toc.css': '83750b6a',
  'css/reader-preferences.css': '2e779e2f',
  'css/series-manuscript.css': 'bd1cd86d',
  'css/series-samizdat.css': '7c8ba23f',
  'css/site.css': 'b7dbbd4e',
  'css/sw-toast.css': '2e540077',
  'css/tts-download-notice.css': 'b9ef192f',
  'fonts/fonts.css': '864cc57a',
  'js/bookmark-engine.js': 'e2ccecf3',
  'js/enhancements.js': '15476429',
  'js/floating-cluster-controller.js': 'de5c7437',
  'js/glossary.js': 'c7f8b6e9',
  'js/highlights.js': 'c223155c',
  'js/nagornaya-bar-extras.js': '3c7e0bdd',
  'js/nagornaya-mobile-toc.js': 'a0b23b1c',
  'js/reader-preferences-head.js': '77c85821',
  'js/reader-preferences.js': '266587ba',
  'js/reader-state.js': 'b3deb501',
  'js/scroll-perf.js': '454d6f7b',
  'js/search.js': '75df3eab',
  'js/site-utils.js': '37abca25',
  'js/site.js': '9fa8818a',
  'js/sw-register.js': '921dd6a2',
  'js/vosk-tts-engine.js': 'd1c35564',
  'js/vosk-tts-worker.js': 'ccc621c4',
  'nagornaya/tw.min.css': 'bee34e73',
};

export function assetUrl(path) {
  const clean = String(path).replace(/^\//, '');
  const v = ASSET_VERSIONS[clean];
  return v ? `/${clean}?v=${v}` : `/${clean}`;
}
