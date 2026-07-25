import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const files = {
  css: 'css/tts-download-notice.css',
  engine: 'js/vosk-tts-engine.js',
  controller: 'js/floating-cluster-controller.js',
  cacheAssets: 'scripts/cache-bust-assets.js',
  contract: 'scripts/tts-engine-status-contract-test.js',
  browserTest: 'scripts/tts-download-notice-browser-test.js',
};

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, value) { fs.writeFileSync(file, value); }
function replaceOnce(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(oldText, newText);
}

let css = read(files.css);
css = replaceOnce(
  css,
  '  left:50%;',
  '  left:50vw;',
  'viewport-relative notice centering',
);
write(files.css, css);

const cssRevision = crypto.createHash('md5').update(css).digest('hex').slice(0, 8);

let engine = read(files.engine);
const engineCssUrlPattern = /var DOWNLOAD_NOTICE_CSS_URL = '\/css\/tts-download-notice\.css\?v=[a-f0-9]{8}';/g;
const engineCssUrlMatches = engine.match(engineCssUrlPattern) || [];
if (engineCssUrlMatches.length !== 1) {
  throw new Error(`engine notice CSS URL: expected exactly one match, found ${engineCssUrlMatches.length}`);
}
engine = engine.replace(
  engineCssUrlPattern,
  `var DOWNLOAD_NOTICE_CSS_URL = '/css/tts-download-notice.css?v=${cssRevision}';`,
);
write(files.engine, engine);

const engineRevision = crypto.createHash('md5').update(engine).digest('hex').slice(0, 8);

let controller = read(files.controller);
const controllerCssUrlPattern = /var TTS_NOTICE_CSS_SRC = '\/css\/tts-download-notice\.css\?v=[a-f0-9]{8}';/g;
const controllerCssUrlMatches = controller.match(controllerCssUrlPattern) || [];
if (controllerCssUrlMatches.length !== 1) {
  throw new Error(`controller notice CSS URL: expected exactly one match, found ${controllerCssUrlMatches.length}`);
}
controller = controller.replace(
  controllerCssUrlPattern,
  `var TTS_NOTICE_CSS_SRC = '/css/tts-download-notice.css?v=${cssRevision}';`,
);
const controllerEngineUrlPattern = /var VOSK_ENGINE_SRC = '\/js\/vosk-tts-engine\.js\?v=[a-f0-9]{8}';/g;
const controllerEngineUrlMatches = controller.match(controllerEngineUrlPattern) || [];
if (controllerEngineUrlMatches.length !== 1) {
  throw new Error(`controller engine URL: expected exactly one match, found ${controllerEngineUrlMatches.length}`);
}
controller = controller.replace(
  controllerEngineUrlPattern,
  `var VOSK_ENGINE_SRC = '/js/vosk-tts-engine.js?v=${engineRevision}';`,
);
write(files.controller, controller);

let cacheAssets = read(files.cacheAssets);
cacheAssets = replaceOnce(
  cacheAssets,
  "  'css/site.css',\n",
  "  'css/site.css',\n  'css/tts-download-notice.css',\n",
  'cache-bust TTS notice asset registration',
);
write(files.cacheAssets, cacheAssets);

let contract = read(files.contract);
contract = replaceOnce(
  contract,
  "const assert = require('node:assert/strict');\n",
  "const assert = require('node:assert/strict');\nconst crypto = require('node:crypto');\n",
  'contract crypto import',
);
contract = replaceOnce(
  contract,
  "    ['versioned notice CSS URL', controller, /TTS_NOTICE_CSS_SRC\\s*=\\s*'\\/css\\/tts-download-notice\\.css\\?v=[a-f0-9]{8}'/],\n",
  "    ['versioned notice CSS URL', controller, /TTS_NOTICE_CSS_SRC\\s*=\\s*'\\/css\\/tts-download-notice\\.css\\?v=[a-f0-9]{8}'/],\n    ['viewport-relative notice centering', css, /\\.gb-tts-download-notice\\{[\\s\\S]{0,180}left:50vw;/],\n",
  'contract viewport-centering check',
);
contract = replaceOnce(
  contract,
  "  for (const [label, source, pattern] of checks) {\n    if (!pattern.test(source)) problems.push(label);\n  }\n",
  "  for (const [label, source, pattern] of checks) {\n    if (!pattern.test(source)) problems.push(label);\n  }\n  const actualCssRevision = crypto.createHash('md5').update(css).digest('hex').slice(0, 8);\n  const controllerCssRevision = (controller.match(/TTS_NOTICE_CSS_SRC\\s*=\\s*'\\/css\\/tts-download-notice\\.css\\?v=([a-f0-9]{8})'/) || [])[1];\n  if (controllerCssRevision !== actualCssRevision) problems.push('notice CSS revision drift');\n",
  'contract exact CSS revision check',
);
contract = replaceOnce(
  contract,
  "  [engine, controller.replace('preserveBrowserStatus: true', 'preserveBrowserStatus: false'), css, workflow],\n",
  "  [engine, controller.replace('preserveBrowserStatus: true', 'preserveBrowserStatus: false'), css, workflow],\n  [engine, controller, css.replace('left:50vw', 'left:50%'), workflow],\n",
  'contract viewport-centering mutation',
);
write(files.contract, contract);

let browserTest = read(files.browserTest);
browserTest = replaceOnce(
  browserTest,
  "  await page.goto(page.__origin, { waitUntil: 'domcontentloaded' });\n  await page.evaluate(async (darkMode) => {\n",
  "  await page.goto(page.__origin, { waitUntil: 'domcontentloaded' });\n  if (page.__expandedContainingBlock) {\n    await page.evaluate(() => {\n      document.documentElement.style.overflowX = 'clip';\n      document.body.style.position = 'fixed';\n      document.body.style.inset = '0 auto auto 0';\n      document.body.style.margin = '0';\n      document.body.style.width = '553px';\n      document.body.style.height = '568px';\n      document.body.style.overflow = 'hidden';\n      document.body.style.transform = 'translateZ(0)';\n    });\n  }\n  await page.evaluate(async (darkMode) => {\n",
  'browser fixture expanded containing block',
);
browserTest = replaceOnce(
  browserTest,
  "      width: rect.width,\n      viewport: window.innerWidth,\n",
  "      left: rect.left,\n      right: rect.right,\n      width: rect.width,\n      viewport: window.innerWidth,\n",
  'browser snapshot notice edges',
);
browserTest = replaceOnce(
  browserTest,
  "  assert.equal(snapshot.ariaLive, 'polite');\n  assert.ok(snapshot.width <= expectedWidth, `notice width ${snapshot.width} exceeds ${expectedWidth}`);\n",
  "  assert.equal(snapshot.ariaLive, 'polite');\n  assert.ok(snapshot.left >= -1, `notice left edge ${snapshot.left} is clipped`);\n  assert.ok(snapshot.right <= snapshot.viewport + 1, `notice right edge ${snapshot.right} exceeds viewport ${snapshot.viewport}`);\n  assert.ok(snapshot.width <= expectedWidth, `notice width ${snapshot.width} exceeds ${expectedWidth}`);\n",
  'browser notice edge assertions',
);
browserTest = replaceOnce(
  browserTest,
  "async function runMobileDark(browser, origin) {\n",
  "async function runMobileViewportContainingBlock(browser, origin) {\n  const page = await browser.newPage({\n    viewport: { width: 320, height: 568 },\n    isMobile: true,\n    hasTouch: true,\n  });\n  page.__origin = origin;\n  page.__expandedContainingBlock = true;\n  await installFixture(page, false);\n  const snapshot = await verifyCard(page, 300.5);\n  assert.equal(snapshot.scrollWidth, 320, `fixture root width is ${snapshot.scrollWidth}, expected 320`);\n  assert.ok(snapshot.left >= 9, `viewport-centred notice left edge is ${snapshot.left}`);\n  assert.ok(snapshot.right <= 311, `viewport-centred notice right edge is ${snapshot.right}`);\n  await page.screenshot({ path: path.join(REPORTS, 'tts-download-notice-mobile-viewport-containing-block.png') });\n  await page.locator('.gb-tts-download-notice__action').click();\n  await page.waitForFunction(() => window.__modelFetchAborted === true);\n  await page.close();\n}\n\nasync function runMobileDark(browser, origin) {\n",
  'browser expanded-containing-block scenario',
);
browserTest = replaceOnce(
  browserTest,
  "    await runDesktop(browser, origin);\n    await runMobileDark(browser, origin);\n    console.log('TTS download notice browser contract: PASS (desktop + mobile dark, pointer + keyboard cancellation).');\n",
  "    await runDesktop(browser, origin);\n    await runMobileViewportContainingBlock(browser, origin);\n    await runMobileDark(browser, origin);\n    console.log('TTS download notice browser contract: PASS (desktop + 320px expanded containing block + mobile dark, pointer + keyboard cancellation).');\n",
  'browser scenario invocation',
);
write(files.browserTest, browserTest);

for (const file of [files.engine, files.controller, files.cacheAssets, files.contract, files.browserTest]) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}
execFileSync(process.execPath, [files.contract], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js', '--write'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js'], { stdio: 'inherit' });

console.log(JSON.stringify({
  changedProductFiles: Object.values(files),
  noticeCssRevision: cssRevision,
  engineRevision,
  centering: 'left:50vw',
  regressionViewport: 320,
  expandedContainingBlockWidth: 553,
  rootOverflow: 0,
}, null, 2));
