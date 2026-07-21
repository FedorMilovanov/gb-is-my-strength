// Asset version helper — central source of truth for cache-busted assets
// Replaces hardcoded ?v=xxx in 36+ Astro PageHead components (PC-003)
// Run `node scripts/cache-bust.js` to update VERSIONS below after CSS/JS changes

export const ASSET_VERSIONS = {
  'css/command-palette.css': 'afe33045',
  'css/enhancements-runtime.css': '97a3e924',
  'css/floating-cluster.css': '896f0c4d',
  'css/highlights-runtime.css': '9f42844a',
  'css/home.css': 'a1933595',
  'css/mobile-hotfix.css': 'a6a3187a',
  'css/nagornaya-mobile-toc.css': '282d8fe8',
  'css/reader-preferences.css': '91cbec46',
  'css/series-samizdat.css': '2c4a9f29',
  'css/site.css': '7b0067c7',
  'css/sw-toast.css': 'efbe868b',
  'fonts/fonts.css': '864cc57a',
  'js/bookmark-engine.js': 'fdfb2ed7',
  'js/enhancements.js': 'cbbdb283',
  'js/floating-cluster-controller.js': '761a8deb',
  'js/glossary.js': 'ae46a35b',
  'js/highlights.js': 'd5d42a60',
  'js/nagornaya-bar-extras.js': '3c7e0bdd',
  'js/nagornaya-mobile-toc.js': '649d9217',
  'js/reader-preferences-head.js': 'df036af0',
  'js/reader-preferences.js': 'f860ca77',
  'js/scroll-perf.js': '454d6f7b',
  'js/search.js': 'b0fd43b8',
  'js/site-utils.js': '5ed472a0',
  'js/site.js': '9195064f',
  'js/sw-register.js': '7a8bd1e7',
  'nagornaya/tw.min.css': '2670414e',
};

export function assetUrl(path) {
  const clean = String(path).replace(/^\//, '');
  const v = ASSET_VERSIONS[clean];
  return v ? `/${clean}?v=${v}` : `/${clean}`;
}
