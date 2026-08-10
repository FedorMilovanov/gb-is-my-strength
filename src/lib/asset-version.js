// Asset version helper — central source of truth for cache-busted assets
// Replaces hardcoded ?v=xxx in 36+ Astro PageHead components (PC-003)
// Run `node scripts/cache-bust.js` to update VERSIONS below after CSS/JS changes

export const ASSET_VERSIONS = {
  'css/command-palette.css': '3b88813f',
  'css/enhancements-runtime.css': '97a3e924',
  'css/floating-cluster.css': '85a1bfb6',
  'css/highlights-runtime.css': '9f42844a',
  'css/home.css': 'a4c21e0e',
  'css/mobile-hotfix.css': 'a6a3187a',
  'css/nagornaya-mobile-toc.css': '30051b58',
  'css/reader-preferences.css': '2b0b76ce',
  'css/series-manuscript.css': '11475bd7',
  'css/series-samizdat.css': '2c4a9f29',
  'css/site.css': 'd1015157',
  'css/sw-toast.css': 'efbe868b',
  'css/tts-download-notice.css': 'b9ef192f',
  'fonts/fonts.css': '864cc57a',
  'js/bookmark-engine.js': 'fba4e559',
  'js/enhancements.js': '1b5392b1',
  'js/floating-cluster-controller.js': '7b33c8e6',
  'js/glossary.js': 'c7f8b6e9',
  'js/highlights.js': '25484760',
  'js/nagornaya-bar-extras.js': '3c7e0bdd',
  'js/nagornaya-mobile-toc.js': '649d9217',
  'js/reader-preferences-head.js': '2db7a79e',
  'js/reader-preferences.js': '63b588b5',
  'js/reader-state.js': 'b3deb501',
  'js/scroll-perf.js': '454d6f7b',
  'js/search.js': '027c3f4f',
  'js/site-utils.js': '661c6cc1',
  'js/site.js': 'c6b5ccf7',
  'js/sw-register.js': '3fbabcf1',
  'js/vosk-tts-engine.js': 'f9b4905f',
  'js/vosk-tts-worker.js': '2ea9ada3',
  'nagornaya/tw.min.css': '2670414e',
};

export function assetUrl(path) {
  const clean = String(path).replace(/^\//, '');
  const v = ASSET_VERSIONS[clean];
  return v ? `/${clean}?v=${v}` : `/${clean}`;
}