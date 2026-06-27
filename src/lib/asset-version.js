// Asset version helper — central source of truth for cache-busted assets
// Replaces hardcoded ?v=xxx in 36+ Astro PageHead components (PC-003)
// Run `node scripts/cache-bust.js` to update VERSIONS below after CSS/JS changes

export const ASSET_VERSIONS = {
  'css/command-palette.css': 'afe33045',
  'css/floating-cluster.css': 'ade5c5ae',
  'css/home.css': 'f5b561ee',
  'css/mobile-hotfix.css': 'c1f7664e',
  'css/nagornaya-mobile-toc.css': 'c4a4a7fd',
  'css/site.css': 'b880b524',
  'fonts/fonts.css': '4504f3cb',
  'js/bookmark-engine.js': 'c5e0bf10',
  'js/enhancements.js': 'b3b77aa6',
  'js/floating-cluster-controller.js': '2ea97d46',
  'js/glossary.js': '2100cf4f',
  'js/highlights.js': 'a1706b06',
  'js/nagornaya-mobile-toc.js': '866d4238',
  'js/scroll-perf.js': '454d6f7b',
  'js/search.js': 'c9d65577',
  'js/site-utils.js': '897afa55',
  'js/site.js': '158b6e05',
  'js/sw-register.js': '318502c5',
  'nagornaya/tw.min.css': '2670414e',
};

export function assetUrl(path) {
  const clean = String(path).replace(/^\//, '');
  const v = ASSET_VERSIONS[clean];
  return v ? `/${clean}?v=${v}` : `/${clean}`;
}
