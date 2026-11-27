// Asset version helper — central source of truth for cache-busted assets
// Replaces hardcoded ?v=xxx in 36+ Astro PageHead components (PC-003)
// Run `node scripts/cache-bust.js` to update VERSIONS below after CSS/JS changes

export const ASSET_VERSIONS = {
  'css/command-palette.css': '3b88813f',
  'css/enhancements-runtime.css': 'd195a91d',
  'css/floating-cluster.css': 'c1edf6a9',
  'css/highlights-runtime.css': '634b5ba8',
  'css/home.css': '4a2fa9a3',
  'css/mobile-hotfix.css': '9cfd6aee',
  'css/nagornaya-mobile-toc.css': '623e0845',
  'css/reader-preferences.css': '9f01260b',
  'css/series-manuscript.css': '77915032',
  'css/series-samizdat.css': '6d9658bd',
  'css/site.css': 'b4a4208c',
  'css/sw-toast.css': '2e540077',
  'css/tts-download-notice.css': 'a72ba924',
  'fonts/fonts.css': '14332eea',
  'js/bookmark-engine.js': 'e7d193e0',
  'js/enhancements.js': '07ee6d29',
  'js/floating-cluster-controller.js': 'bd9587e5',
  'js/glossary.js': '8c2537f0',
  'js/highlights.js': 'b44eb1fc',
  'js/nagornaya-bar-extras.js': '0d09c638',
  'js/nagornaya-mobile-toc.js': 'b4714592',
  'js/reader-library-dock.js': '215fecef',
  'js/reader-library-navigation.js': 'a60b5452',
  'js/reader-library-presenter.js': '3df72e8a',
  'js/reader-library-ranges.js': '9d01527f',
  'js/reader-library-record-transactions.js': 'ecb28bb6',
  'js/reader-library-research-core.js': 'cf9c70ad',
  'js/reader-library-selection.js': 'b301d44f',
  'js/reader-library-storage.js': 'c6707892',
  'js/reader-library-v3.js': 'ec2d1d76',
  'js/reader-preferences-head.js': '23265a5f',
  'js/reader-preferences.js': 'f7880f37',
  'js/reader-state.js': '99cb3413',
  'js/scroll-perf.js': '454d6f7b',
  'js/search.js': '342fd8ee',
  'js/site-utils.js': '1d1c72c3',
  'js/site.js': 'a505847b',
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
