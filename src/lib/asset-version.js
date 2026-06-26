// Asset version helper — central source of truth for cache-busted assets
// Replaces hardcoded ?v=xxx in 36+ Astro PageHead components (PC-003)
// Run `node scripts/cache-bust.js` to update VERSIONS below after CSS/JS changes

export const ASSET_VERSIONS = {
  'css/site.css': 'b880b524',
  'css/command-palette.css': 'afe33045',
  'css/mobile-hotfix.css': 'c1f7664e',
  'css/floating-cluster.css': 'f4bddc5b',
  'css/premium-controls.css': 'v1',
  'js/site.js': '133dfac1',
  'js/floating-cluster-controller.js': 'pc3-20260626',
  'js/premium-controls-controller.js': 'pc3-20260626',
};

export function assetUrl(path) {
  const clean = String(path).replace(/^\//, '');
  const v = ASSET_VERSIONS[clean];
  return v ? `/${clean}?v=${v}` : `/${clean}`;
}
