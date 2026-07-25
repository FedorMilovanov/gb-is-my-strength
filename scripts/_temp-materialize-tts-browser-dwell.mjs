import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const files = {
  controller: 'js/floating-cluster-controller.js',
  contract: 'scripts/tts-engine-status-contract-test.js',
  routeTest: 'scripts/tts-status-route-browser-test.js',
};

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, value) { fs.writeFileSync(file, value); }
function replaceOnce(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(oldText, newText);
}

let controller = read(files.controller);
controller = replaceOnce(
  controller,
  `    _registeredListeners = [];
  };`,
  `    _registeredListeners = [];
    if (_voskWarmupStartTimer) {
      clearTimeout(_voskWarmupStartTimer);
      _voskWarmupStartTimer = null;
    }
  };`,
  'controller cleanup timer'
);
controller = replaceOnce(
  controller,
  `  var _voskWarmupPromise = null;

  function warmVoskInBackground(options) {`,
  `  var _voskWarmupPromise = null;
  var _voskWarmupStartTimer = null;
  var VOSK_BROWSER_STATUS_DWELL_MS = 900;

  // Web Speech begins immediately, but the reader must actually see that the
  // system voice is active before background Vosk preparation replaces the
  // status card. One scheduled timer also deduplicates rapid repeated clicks.
  function scheduleVoskWarmupAfterBrowserStatus() {
    if (_voskWarmupPromise || _voskWarmupStartTimer) return;
    _voskWarmupStartTimer = setTimeout(function () {
      _voskWarmupStartTimer = null;
      warmVoskInBackground();
    }, VOSK_BROWSER_STATUS_DWELL_MS);
  }

  function warmVoskInBackground(options) {`,
  'controller scheduler insertion'
);
controller = replaceOnce(
  controller,
  `    var manual = options.manual === true;
    var retry = options.retry === true;
    var blockReason = voskWarmupBlockReason();`,
  `    var manual = options.manual === true;
    var retry = options.retry === true;
    if ((manual || retry) && _voskWarmupStartTimer) {
      clearTimeout(_voskWarmupStartTimer);
      _voskWarmupStartTimer = null;
    }
    var blockReason = voskWarmupBlockReason();`,
  'controller manual timer cancellation'
);
controller = replaceOnce(
  controller,
  `    if ('speechSynthesis' in window) {
      showVoskStatus('browser');
      warmVoskInBackground();
      return Promise.resolve('webspeech');
    }`,
  `    if ('speechSynthesis' in window) {
      showVoskStatus('browser');
      scheduleVoskWarmupAfterBrowserStatus();
      return Promise.resolve('webspeech');
    }`,
  'controller browser scheduling'
);
write(files.controller, controller);

let contract = read(files.contract);
contract = replaceOnce(
  contract,
  `    ['system voice disclosed', controller, /showVoskStatus\\('browser'\\)/],`,
  `    ['system voice disclosed', controller, /showVoskStatus\\('browser'\\)/],
    ['perceptible browser status dwell', controller, /VOSK_BROWSER_STATUS_DWELL_MS\\s*=\\s*(?:[7-9]\\d{2}|1\\d{3})/],
    ['browser status schedules one warm-up', controller, /function scheduleVoskWarmupAfterBrowserStatus\\(\\)[\\s\\S]*_voskWarmupStartTimer[\\s\\S]*showVoskStatus\\('browser'\\);\\s*scheduleVoskWarmupAfterBrowserStatus\\(\\);\\s*return Promise\\.resolve\\('webspeech'\\)/],`,
  'source contract checks'
);
contract = replaceOnce(
  contract,
  `  [engine, controller.replace(/gb:vosk-retry-request/g, 'gb:vosk-retry-missing'), css, workflow],`,
  `  [engine, controller.replace(/gb:vosk-retry-request/g, 'gb:vosk-retry-missing'), css, workflow],
  [engine, controller.replace('scheduleVoskWarmupAfterBrowserStatus();', 'warmVoskInBackground();'), css, workflow],`,
  'source contract adversarial mutation'
);
write(files.contract, contract);

let routeTest = read(files.routeTest);
routeTest = replaceOnce(
  routeTest,
  `    await clickPlay(page);
    await page.waitForSelector('.gb-tts-download-notice[data-state="loading"].is-visible');
    const snapshot = await settledNoticeSnapshot(page);`,
  `    await clickPlay(page);
    await page.waitForSelector('.gb-tts-download-notice[data-state="browser"].is-visible');
    const browserSnapshot = await settledNoticeSnapshot(page);
    assert.equal(browserSnapshot.title, 'Сейчас системный голос');
    assert.match(browserSnapshot.meta, /Улучшенный голос проверяется/);
    assert.equal(await page.evaluate(() => window.__modelFetchCount), 0, 'Vosk model fetch started before the browser status was perceptible');
    await page.waitForSelector('.gb-tts-download-notice[data-state="loading"].is-visible', { timeout: 10000 });
    const snapshot = await settledNoticeSnapshot(page);`,
  'route browser dwell assertion'
);
write(files.routeTest, routeTest);

for (const file of Object.values(files)) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
execFileSync(process.execPath, [files.contract], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js', '--write'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js'], { stdio: 'inherit' });

console.log(JSON.stringify({
  changedProductFiles: Object.values(files),
  browserStatusDwellMs: 900,
  revisionProjection: 'cache-bust --write',
}, null, 2));
