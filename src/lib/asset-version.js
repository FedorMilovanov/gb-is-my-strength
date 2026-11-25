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
  'css/site.css': '719dd656',
  'css/sw-toast.css': '2e540077',
  'css/tts-download-notice.css': 'a72ba924',
  'fonts/fonts.css': '14332eea',
  'js/bookmark-engine.js': 'e7d193e0',
  'js/enhancements.js': '15476429',
  'js/floating-cluster-controller.js': 'ae574042',
  'js/glossary.js': '8c2537f0',
  'js/highlights.js': '4834c431',
  'js/nagornaya-bar-extras.js': '3c7e0bdd',
  'js/nagornaya-mobile-toc.js': 'a0b23b1c',
  'js/reader-library-dock.js': 'f730766c',
  'js/reader-library-presenter.js': 'df7edaea',
  'js/reader-library-ranges.js': '9d01527f',
  'js/reader-library-record-transactions.js': 'ecb28bb6',
  'js/reader-library-research-core.js': '4f56696b',
  'js/reader-library-selection.js': 'b301d44f',
  'js/reader-library-storage.js': 'c6707892',
  'js/reader-library-v3.js': '54f97aa3',
  'js/reader-preferences-head.js': '23265a5f',
  'js/reader-preferences.js': 'f7880f37',
  'js/reader-state.js': '99cb3413',
  'js/scroll-perf.js': '454d6f7b',
  'js/search.js': '342fd8ee',
  'js/site-utils.js': '1d1c72c3',
  'js/site.js': '90db3daa',
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
