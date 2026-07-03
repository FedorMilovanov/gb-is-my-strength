// Asset version helper — central source of truth for cache-busted assets
// Replaces hardcoded ?v=xxx in 36+ Astro PageHead components (PC-003)
// Run `node scripts/cache-bust.js` to update VERSIONS below after CSS/JS changes

export const ASSET_VERSIONS = {
  'css/command-palette.css': 'afe33045',
  'css/enhancements-runtime.css': '40f4c45f',
  'css/floating-cluster.css': '46d51653',
  'css/highlights-runtime.css': '4e0cd377',
  'css/home.css': '15b094aa',
  'css/mobile-hotfix.css': '997b959e',
  'css/nagornaya-mobile-toc.css': '361db0b3',
  'css/site.css': '0ab84ed3',
  'css/sw-toast.css': 'efbe868b',
  'fonts/fonts.css': '864cc57a',
  'js/bookmark-engine.js': 'fdfb2ed7',
  'js/enhancements.js': 'fe6c9787',
  'js/floating-cluster-controller.js': '1bbd3c54',
  'js/glossary.js': '91b65962',
  'js/highlights.js': 'c972d20e',
  'js/nagornaya-mobile-toc.js': '866d4238',
  'js/scroll-perf.js': '454d6f7b',
  'js/search.js': '79b224c3',
  'js/site-utils.js': '897afa55',
  'js/site.js': '77687914',
  'js/sw-register.js': '7a8bd1e7',
  'nagornaya/tw.min.css': '2670414e',
};

export function assetUrl(path) {
  const clean = String(path).replace(/^\//, '');
  const v = ASSET_VERSIONS[clean];
  return v ? `/${clean}?v=${v}` : `/${clean}`;
}
