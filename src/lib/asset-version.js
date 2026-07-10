// Asset version helper — central source of truth for cache-busted assets
// Replaces hardcoded ?v=xxx in 36+ Astro PageHead components (PC-003)
// Run `node scripts/cache-bust.js` to update VERSIONS below after CSS/JS changes

export const ASSET_VERSIONS = {
  'css/command-palette.css': 'afe33045',
  'css/enhancements-runtime.css': '97a3e924',
  'css/floating-cluster.css': '8346a662',
  'css/highlights-runtime.css': '7a736acc',
  'css/home.css': 'a1933595',
  'css/mobile-hotfix.css': '997b959e',
  'css/nagornaya-mobile-toc.css': '361db0b3',
  'css/site.css': 'cac8aeeb',
  'css/sw-toast.css': 'efbe868b',
  'fonts/fonts.css': '864cc57a',
  'js/bookmark-engine.js': 'fdfb2ed7',
  'js/enhancements.js': 'cbbdb283',
  'js/floating-cluster-controller.js': 'c3ba1d0d',
  'js/glossary.js': 'ae46a35b',
  'js/highlights.js': '80effd6c',
  'js/nagornaya-mobile-toc.js': '649d9217',
  'js/scroll-perf.js': '454d6f7b',
  'js/search.js': 'b0fd43b8',
  'js/site-utils.js': '897afa55',
  'js/site.js': '3da91cd0',
  'js/sw-register.js': '7a8bd1e7',
  'nagornaya/tw.min.css': '2670414e',
};

export function assetUrl(path) {
  const clean = String(path).replace(/^\//, '');
  const v = ASSET_VERSIONS[clean];
  return v ? `/${clean}?v=${v}` : `/${clean}`;
}
