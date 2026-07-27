// Asset version helper — central source of truth for cache-busted assets
// Replaces hardcoded ?v=xxx in 36+ Astro PageHead components (PC-003)
// Run `node scripts/cache-bust.js` to update VERSIONS below after CSS/JS changes

export const ASSET_VERSIONS = {
  'css/command-palette.css': 'afe33045',
  'css/enhancements-runtime.css': '97a3e924',
  'css/floating-cluster.css': 'd26d83c2',
  'css/highlights-runtime.css': '9f42844a',
  'css/home.css': 'a4c21e0e',
  'css/mobile-hotfix.css': 'a6a3187a',
  'css/nagornaya-mobile-toc.css': '282d8fe8',
  'css/reader-preferences.css': '2b0b76ce',
  'css/series-manuscript.css': '11475bd7',
  'css/series-samizdat.css': '2c4a9f29',
  'css/site.css': '6c30f93f',
  'css/sw-toast.css': 'efbe868b',
  'css/tts-download-notice.css': '475abd4b',
  'fonts/fonts.css': '864cc57a',
  'js/bookmark-engine.js': 'fba4e559',
  'js/enhancements.js': 'cbbdb283',
  'js/floating-cluster-controller.js': '2b92a1a5',
  'js/glossary.js': '81fc28c2',
  'js/highlights.js': '25484760',
  'js/nagornaya-bar-extras.js': '3c7e0bdd',
  'js/nagornaya-mobile-toc.js': '649d9217',
  'js/reader-preferences-head.js': '2db7a79e',
  'js/reader-preferences.js': '63b588b5',
  'js/reader-state.js': 'b3deb501',
  'js/scroll-perf.js': '454d6f7b',
  'js/search.js': 'b0fd43b8',
  'js/site-utils.js': '30ed46cf',
  'js/site.js': '38b94307',
  'js/sw-register.js': '7a8bd1e7',
  'js/vosk-tts-engine.js': '216b15fb',
  'nagornaya/tw.min.css': '2670414e',
};

export function assetUrl(path) {
  const clean = String(path).replace(/^\//, '');
  const v = ASSET_VERSIONS[clean];
  return v ? `/${clean}?v=${v}` : `/${clean}`;
}
