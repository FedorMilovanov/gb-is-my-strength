// Asset version helper — central source of truth for cache-busted assets
// Replaces hardcoded ?v=xxx in 36+ Astro PageHead components (PC-003)
// Run `node scripts/cache-bust.js` to update VERSIONS below after CSS/JS changes

export const ASSET_VERSIONS = {
  'css/command-palette.css': '3b88813f',
  'css/enhancements-runtime.css': 'd195a91d',
  'css/floating-cluster.css': '0ca3939e',
  'css/highlights-runtime.css': '571b8df5',
  'css/home.css': '4a2fa9a3',
  'css/mobile-hotfix.css': '9cfd6aee',
  'css/nagornaya-mobile-toc.css': '623e0845',
  'css/reader-preferences.css': '9f01260b',
  'css/series-manuscript.css': '77915032',
  'css/series-samizdat.css': '6d9658bd',
  'css/site.css': 'c2364e81',
  'css/sw-toast.css': '2e540077',
  'css/tts-download-notice.css': 'a72ba924',
  'fonts/fonts.css': '864cc57a',
  'js/bookmark-engine.js': 'e7d193e0',
  'js/enhancements.js': '15476429',
  'js/floating-cluster-controller.js': '51ff3f23',
  'js/glossary.js': 'c7f8b6e9',
  'js/highlights.js': '779e1ce2',
  'js/nagornaya-bar-extras.js': '3c7e0bdd',
  'js/nagornaya-mobile-toc.js': 'a0b23b1c',
  'js/reader-library-dock.js': '706a54b0',
  'js/reader-library-presenter.js': '95532247',
  'js/reader-library-storage.js': 'bb6b34c9',
  'js/reader-library-v3.js': '7b71e298',
  'js/reader-preferences-head.js': 'bd4355e3',
  'js/reader-preferences.js': 'f7880f37',
  'js/reader-state.js': 'af589b59',
  'js/scroll-perf.js': '454d6f7b',
  'js/search.js': '75df3eab',
  'js/site-utils.js': '06d1f307',
  'js/site.js': '9fa8818a',
  'js/sw-register.js': '921dd6a2',
  'js/vosk-custom-terms.json': 'ca9a51cc',
  'js/vosk-stress-lookup.js': '2c33f2e9',
  'js/vosk-stress-marker.bin': '3ae166fc',
  'js/vosk-tts-core.js': '431034cc',
  'js/vosk-tts-engine.js': '8a878744',
  'js/vosk-tts-worker.js': 'd5850c06',
  'nagornaya/tw.min.css': 'bee34e73',
};

export function assetUrl(path) {
  const clean = String(path).replace(/^\//, '');
  const v = ASSET_VERSIONS[clean];
  return v ? `/${clean}?v=${v}` : `/${clean}`;
}
