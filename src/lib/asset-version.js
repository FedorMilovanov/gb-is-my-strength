// Asset version helper — central source of truth for cache-busted assets
// Replaces hardcoded ?v=xxx in 36+ Astro PageHead components (PC-003)
// Run `node scripts/cache-bust.js` to update VERSIONS below after CSS/JS changes

export const ASSET_VERSIONS = {
  'css/command-palette.css': '3b88813f',
  'css/enhancements-runtime.css': 'd195a91d',
  'css/floating-cluster.css': '0457785a',
  'css/highlights-runtime.css': '7d6f17ca',
  'css/home.css': '4a2fa9a3',
  'css/mobile-hotfix.css': '9cfd6aee',
  'css/nagornaya-mobile-toc.css': '623e0845',
  'css/reader-preferences.css': '9f01260b',
  'css/series-manuscript.css': '77915032',
  'css/series-samizdat.css': '6d9658bd',
  'css/site.css': '6455310d',
  'css/sw-toast.css': '2e540077',
  'css/tts-download-notice.css': 'a72ba924',
  'fonts/fonts.css': '14332eea',
  'js/bookmark-engine.js': 'e7d193e0',
  'js/enhancements.js': '15476429',
  'js/floating-cluster-controller.js': '8a5870b1',
  'js/glossary.js': 'c7f8b6e9',
  'js/highlights.js': '8dfe082a',
  'js/nagornaya-bar-extras.js': '3c7e0bdd',
  'js/nagornaya-mobile-toc.js': 'a0b23b1c',
  'js/reader-library-dock.js': 'adffc6aa',
  'js/reader-library-presenter.js': 'e0eb7d74',
  'js/reader-library-record-transactions.js': 'ecb28bb6',
  'js/reader-library-selection.js': '1778ffcd',
  'js/reader-library-storage.js': '74af6e6a',
  'js/reader-library-v3.js': 'd6fdb5cb',
  'js/reader-preferences-head.js': 'ac352cfd',
  'js/reader-preferences.js': 'f7880f37',
  'js/reader-state.js': 'af589b59',
  'js/scroll-perf.js': '454d6f7b',
  'js/search.js': '342fd8ee',
  'js/site-utils.js': '06d1f307',
  'js/site.js': '9fa8818a',
  'js/sw-register.js': '921dd6a2',
  'js/vosk-custom-terms.json': 'bf5ae0e3',
  'js/vosk-stress-lookup.js': '2c33f2e9',
  'js/vosk-stress-marker.bin': '3ae166fc',
  'js/vosk-tts-core.js': '431034cc',
  'js/vosk-tts-engine.js': '2f4a99f4',
  'js/vosk-tts-worker.js': '4acb3d42',
  'nagornaya/tw.min.css': 'bee34e73',
};

export function assetUrl(path) {
  const clean = String(path).replace(/^\//, '');
  const v = ASSET_VERSIONS[clean];
  return v ? `/${clean}?v=${v}` : `/${clean}`;
}
