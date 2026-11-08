// Asset version helper — central source of truth for cache-busted assets
// Replaces hardcoded ?v=xxx in 36+ Astro PageHead components (PC-003)
// Run `node scripts/cache-bust.js` to update VERSIONS below after CSS/JS changes

export const ASSET_VERSIONS = {
  'css/command-palette.css': '3b88813f',
  'css/enhancements-runtime.css': 'd195a91d',
  'css/floating-cluster.css': '1c5cdc0f',
  'css/highlights-runtime.css': '8aae232c',
  'css/home.css': 'a88bfa00',
  'css/mobile-hotfix.css': '9cfd6aee',
  'css/nagornaya-mobile-toc.css': '4fdfd43b',
  'css/reader-preferences.css': 'b22c42bb',
  'css/series-manuscript.css': '77915032',
  'css/series-samizdat.css': 'f12011c0',
  'css/site.css': '8a85071a',
  'css/sw-toast.css': '2e540077',
  'css/tts-download-notice.css': 'b9ef192f',
  'fonts/fonts.css': '864cc57a',
  'js/bookmark-engine.js': 'e2ccecf3',
  'js/enhancements.js': '15476429',
  'js/floating-cluster-controller.js': '8a827b5d',
  'js/glossary.js': 'c7f8b6e9',
  'js/highlights.js': 'e528a7ec',
  'js/nagornaya-bar-extras.js': '3c7e0bdd',
  'js/nagornaya-mobile-toc.js': 'a0b23b1c',
  'js/reader-library-dock.js': '315d5992',
  'js/reader-library-presenter.js': 'cef6e2a5',
  'js/reader-library-v3.js': 'e036d5a6',
  'js/reader-preferences-head.js': '82cc6611',
  'js/reader-preferences.js': '422b1c6a',
  'js/reader-state.js': 'b3deb501',
  'js/scroll-perf.js': '454d6f7b',
  'js/search.js': '75df3eab',
  'js/site-utils.js': 'e80f1dfb',
  'js/site.js': '9fa8818a',
  'js/sw-register.js': '921dd6a2',
  'js/vosk-custom-terms.json': 'ca9a51cc',
  'js/vosk-stress-lookup.js': '2c33f2e9',
  'js/vosk-stress-marker.bin': '3ae166fc',
  'js/vosk-tts-core.js': '431034cc',
  'js/vosk-tts-engine.js': '1fdd3fb5',
  'js/vosk-tts-worker.js': 'd5850c06',
  'nagornaya/tw.min.css': 'bee34e73',
};

export function assetUrl(path) {
  const clean = String(path).replace(/^\//, '');
  const v = ASSET_VERSIONS[clean];
  return v ? `/${clean}?v=${v}` : `/${clean}`;
}
