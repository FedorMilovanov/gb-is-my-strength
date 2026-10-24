// Asset version helper — central source of truth for cache-busted assets
// Replaces hardcoded ?v=xxx in 36+ Astro PageHead components (PC-003)
// Run `node scripts/cache-bust.js` to update VERSIONS below after CSS/JS changes

export const ASSET_VERSIONS = {
  'css/command-palette.css': '3b88813f',
  'css/enhancements-runtime.css': 'd195a91d',
  'css/floating-cluster.css': '89332585',
  'css/highlights-runtime.css': '9f42844a',
  'css/home.css': 'ee5bb66d',
  'css/mobile-hotfix.css': '087ca4ee',
  'css/nagornaya-mobile-toc.css': '3806ac1a',
  'css/reader-preferences.css': 'b740c21f',
  'css/series-manuscript.css': 'a16a829e',
  'css/series-samizdat.css': '7c8ba23f',
  'css/site.css': 'f830106e',
  'css/sw-toast.css': '2e540077',
  'css/tts-download-notice.css': 'b9ef192f',
  'fonts/fonts.css': '864cc57a',
  'js/bookmark-engine.js': 'e2ccecf3',
  'js/enhancements.js': '15476429',
  'js/floating-cluster-controller.js': '721bbd15',
  'js/glossary.js': 'c7f8b6e9',
  'js/highlights.js': 'c223155c',
  'js/nagornaya-bar-extras.js': '3c7e0bdd',
  'js/nagornaya-mobile-toc.js': 'dca61a7a',
  'js/reader-preferences-head.js': '194541e8',
  'js/reader-preferences.js': 'e26f05a8',
  'js/reader-state.js': 'b3deb501',
  'js/scroll-perf.js': '454d6f7b',
  'js/search.js': '106d65f6',
  'js/site-utils.js': '2f156a6d',
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
