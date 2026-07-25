#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

const controllerPath = 'js/floating-cluster-controller.js';
const enginePath = 'js/vosk-tts-engine.js';
const lifecyclePath = 'scripts/tts-engine-lifecycle-browser-test.js';
const contractPath = 'scripts/tts-engine-status-contract-test.js';

let controller = fs.readFileSync(controllerPath, 'utf8');
controller = replaceOnce(
  controller,
  "    requestAnimationFrame(function () { el.classList.add('is-visible'); });",
  "    // The first status must be paintable in the current rendering opportunity.\n    // WebKit may defer requestAnimationFrame while the page is settling; queuing\n    // visibility there lets later states overwrite the still-hidden browser notice.\n    el.classList.add('is-visible');",
  'controller synchronous first reveal'
);
fs.writeFileSync(controllerPath, controller, 'utf8');

let engine = fs.readFileSync(enginePath, 'utf8');
engine = replaceOnce(
  engine,
  "    requestAnimationFrame(function () { el.classList.add('is-visible'); });",
  "    // Do not gate status visibility on requestAnimationFrame. WebKit can defer\n    // that callback long enough for browser/preparing to be replaced by loading.\n    el.classList.add('is-visible');",
  'engine synchronous first reveal'
);
fs.writeFileSync(enginePath, engine, 'utf8');

let lifecycle = fs.readFileSync(lifecyclePath, 'utf8');
const lifecycleAnchor = "\n(async () => {\n  const { server, origin } = await startServer();";
const lifecycleInsertion = `
async function delayedRafFirstPaint(browserType, origin, name) {
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  page.__origin = origin;
  try {
    await reset(page);
    await page.evaluate(() => {
      window.__queuedTtsRaf = [];
      window.requestAnimationFrame = (callback) => {
        window.__queuedTtsRaf.push(callback);
        return window.__queuedTtsRaf.length;
      };
    });
    await page.addScriptTag({ content: ENGINE });
    const snap = await page.evaluate(() => {
      const notice = window.VoskTTSEngine.showStatus('browser');
      return {
        visible: notice.classList.contains('is-visible'),
        state: notice.getAttribute('data-state'),
        queuedRaf: window.__queuedTtsRaf.length,
      };
    });
    assert.equal(snap.state, 'browser');
    assert.equal(snap.visible, true, name + ': browser status must be visible before any RAF callback');
    assert.equal(snap.queuedRaf, 0, name + ': first status visibility must not enqueue RAF');
  } finally {
    await browser.close();
  }
}

(async () => {
  const { server, origin } = await startServer();`;
if (!lifecycle.includes('async function delayedRafFirstPaint(')) {
  lifecycle = replaceOnce(lifecycle, lifecycleAnchor, '\n' + lifecycleInsertion, 'lifecycle first-paint fixture insertion');
}
lifecycle = replaceOnce(
  lifecycle,
  "    await cachedFailure(chromium, origin, 'chromium');",
  "    await delayedRafFirstPaint(chromium, origin, 'chromium');\n    await delayedRafFirstPaint(webkit, origin, 'webkit');\n    await cachedFailure(chromium, origin, 'chromium');",
  'lifecycle first-paint invocation'
);
lifecycle = lifecycle.replace(
  "TTS engine lifecycle browser contract: PASS (Chromium + WebKit, cached error + ready/switch).",
  "TTS engine lifecycle browser contract: PASS (Chromium + WebKit, synchronous first paint + cached error + ready/switch)."
);
fs.writeFileSync(lifecyclePath, lifecycle, 'utf8');

let contract = fs.readFileSync(contractPath, 'utf8');
const checksAnchor = "    ['system voice disclosed', controller, /showVoskStatus\\('browser'\\)/],";
const checksInsertion = `${checksAnchor}
    ['controller first status reveal is synchronous', controller, /showFallbackTtsStatus[\\s\\S]{0,1800}el\\.classList\\.add\\('is-visible'\\);[\\s\\S]{0,260}return el;/],
    ['engine first status reveal is synchronous', engine, /setNoticeAction\\(el, actionMode, actionLabel, actionAria\\);\\s*el\\.classList\\.add\\('is-visible'\\);\\s*dispatchEngineStatus/],`;
if (!contract.includes('controller first status reveal is synchronous')) {
  contract = replaceOnce(contract, checksAnchor, checksInsertion, 'source synchronous reveal checks');
}
const oldRafGuardAnchor = "  if (/s\\.src\\s*=\\s*'\\/js\\/vosk-tts-engine\\.js'/.test(controller)) problems.push('unversioned lazy engine URL remains');";
const oldRafGuardInsertion = `${oldRafGuardAnchor}
  const deferredReveal = /requestAnimationFrame\\(function \\(\\) \\{ el\\.classList\\.add\\('is-visible'\\); \\}\\);/;
  if (deferredReveal.test(controller)) problems.push('controller first status reveal still depends on RAF');
  if (deferredReveal.test(engine)) problems.push('engine first status reveal still depends on RAF');`;
if (!contract.includes('controller first status reveal still depends on RAF')) {
  contract = replaceOnce(contract, oldRafGuardAnchor, oldRafGuardInsertion, 'source deferred reveal guard');
}
const mutationAnchor = "  ['browser status preservation removed', engine, controller.replace('preserveBrowserStatus: true', 'preserveBrowserStatus: false'), css, workflow, cacheAssets],";
const mutationInsertion = `${mutationAnchor}
  ['controller synchronous reveal deferred', engine, controller.replace("el.classList.add('is-visible');", "requestAnimationFrame(function () { el.classList.add('is-visible'); });"), css, workflow, cacheAssets],
  ['engine synchronous reveal deferred', engine.replace("el.classList.add('is-visible');", "requestAnimationFrame(function () { el.classList.add('is-visible'); });"), controller, css, workflow, cacheAssets],`;
if (!contract.includes('controller synchronous reveal deferred')) {
  contract = replaceOnce(contract, mutationAnchor, mutationInsertion, 'source reveal mutations');
}
fs.writeFileSync(contractPath, contract, 'utf8');

execFileSync(process.execPath, ['scripts/cache-bust.js', '--write'], { stdio: 'inherit' });
for (const file of [controllerPath, enginePath, lifecyclePath, contractPath]) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}
execFileSync(process.execPath, [contractPath], { stdio: 'inherit' });
console.log('TTS WebKit first-paint product changes materialized.');
