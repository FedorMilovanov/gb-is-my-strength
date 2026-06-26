// Asset version helper — central source of truth for cache-busted assets
// Replaces hardcoded ?v=xxx in 36+ Astro PageHead components (PC-003)
// Run `node scripts/cache-bust.js` to update VERSIONS below after CSS/JS changes

export const ASSET_VERSIONS = {
  'css/site.css': 'b880b524',
  'css/command-palette.css': 'afe33045',
  'css/mobile-hotfix.css': 'c1f7664e',
  'css/floating-cluster.css': '0142f39e',
  'css/premium-controls.css': 'pc-v21',
  'js/site.js': '158b6e05',
  'js/floating-cluster-controller.js': 'f2299253',
};

export function assetUrl(path) {
  const clean = String(path).replace(/^\//, '');
  const v = ASSET_VERSIONS[clean];
  return v ? `/${clean}?v=${v}` : `/${clean}`;
}
