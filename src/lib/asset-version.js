// Asset version helper — central source of truth for cache-busted assets
// Replaces hardcoded ?v=xxx in 36+ Astro PageHead components (PC-003)
// Run `node scripts/cache-bust.js` to update VERSIONS below after CSS/JS changes

export const ASSET_VERSIONS = {
  'css/command-palette.css': 'afe33045',
  'css/floating-cluster.css': '91f72196',
  'css/home.css': '15b094aa',
  'css/mobile-hotfix.css': '997b959e',
  'css/nagornaya-mobile-toc.css': 'c4a4a7fd',
  'css/site.css': '787f1928',
  'fonts/fonts.css': '864cc57a',
  'js/bookmark-engine.js': '38a0b0ff',
  'js/enhancements.js': 'b3b77aa6',
  'js/floating-cluster-controller.js': '6e5c5f18',
  'js/glossary.js': '91b65962',
  'js/highlights.js': 'eca2588c',
  'js/nagornaya-mobile-toc.js': '866d4238',
  'js/scroll-perf.js': '454d6f7b',
  'js/search.js': '41634d58',
  'js/site-utils.js': '897afa55',
  'js/site.js': '04d99087',
  'js/sw-register.js': '318502c5',
  'nagornaya/tw.min.css': '2670414e',
};

export function assetUrl(path) {
  const clean = String(path).replace(/^\//, '');
  const v = ASSET_VERSIONS[clean];
  return v ? `/${clean}?v=${v}` : `/${clean}`;
}
