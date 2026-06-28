// Asset version helper — central source of truth for cache-busted assets
// Replaces hardcoded ?v=xxx in 36+ Astro PageHead components (PC-003)
// Run `node scripts/cache-bust.js` to update VERSIONS below after CSS/JS changes

export const ASSET_VERSIONS = {
  'css/command-palette.css': 'afe33045',
  'css/floating-cluster.css': 'afd6be08',
  'css/home.css': 'f5b561ee',
  'css/mobile-hotfix.css': '997b959e',
  'css/nagornaya-mobile-toc.css': 'c4a4a7fd',
  'css/site.css': 'b87bab28',
  'fonts/fonts.css': '4504f3cb',
  'js/bookmark-engine.js': 'c5e0bf10',
  'js/enhancements.js': 'b3b77aa6',
  'js/floating-cluster-controller.js': 'b54ff925',
  'js/glossary.js': '91b65962',
  'js/highlights.js': 'a1706b06',
  'js/nagornaya-mobile-toc.js': '866d4238',
  'js/scroll-perf.js': '454d6f7b',
  'js/search.js': 'c9d65577',
  'js/site-utils.js': '897afa55',
  'js/site.js': '359d6005',
  'js/sw-register.js': '318502c5',
  'nagornaya/tw.min.css': '2670414e',
};

export function assetUrl(path) {
  const clean = String(path).replace(/^\//, '');
  const v = ASSET_VERSIONS[clean];
  return v ? `/${clean}?v=${v}` : `/${clean}`;
}
