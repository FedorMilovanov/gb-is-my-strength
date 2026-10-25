// Asset version helper — central source of truth for cache-busted assets
// Replaces hardcoded ?v=xxx in 36+ Astro PageHead components (PC-003)
// Run `node scripts/cache-bust.js` to update VERSIONS below after CSS/JS changes

export const ASSET_VERSIONS = {
  'css/command-palette.css': '3b88813f',
  'css/enhancements-runtime.css': 'd195a91d',
  'css/floating-cluster.css': '89332585',
  'css/highlights-runtime.css': '9f42844a',
  'css/home.css': 'd6905ff8',
  'css/mobile-hotfix.css': 'ef31d1e1',
  'css/nagornaya-mobile-toc.css': '83750b6a',
  'css/reader-preferences.css': 'b740c21f',
  'css/series-manuscript.css': 'bd1cd86d',
  'css/series-samizdat.css': '7c8ba23f',
  'css/site.css': '24bd221a',
  'css/sw-toast.css': '2e540077',
  'css/tts-download-notice.css': 'b9ef192f',
  'fonts/fonts.css': '864cc57a',
  'js/bookmark-engine.js': 'e2ccecf3',
  'js/enhancements.js': '15476429',
  'js/floating-cluster-controller.js': 'e0f8d2f0',
  'js/glossary.js': 'c7f8b6e9',
  'js/highlights.js': 'c223155c',
  'js/nagornaya-bar-extras.js': '3c7e0bdd',
  'js/nagornaya-mobile-toc.js': 'dca61a7a',
  'js/reader-preferences-head.js': '194541e8',
  'js/reader-preferences.js': 'e26f05a8',
  'js/reader-state.js': 'b3deb501',
  'js/scroll-perf.js': '454d6f7b',
  'js/search.js': '3cb89ca7',
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
