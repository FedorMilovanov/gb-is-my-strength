#!/usr/bin/env node
/** Pure synthetic test-driver controls, not actual native/visual acceptance. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { nativeBackOptions } from './articles-native-back-acceptance.mjs';
import { assessNativeBack, nativeBackFixture, validateNativeBackMatrix, NATIVE_BACK_OBSERVATION_MS, NATIVE_BACK_SCROLL_TOLERANCE_PX } from './lib/articles-native-back.mjs';
const state = { url: 'https://candidate.invalid/articles/#materials', y: 27506, documentHeight: 29492, fonts: 'loaded', timeOrigin: 100, historyLength: 3, active: { id: 'last', href: '/series/' } };
function witness(change = {}) {
  const after = { ...structuredClone(state), timeOrigin: 200, ...change };
  return { before: structuredClone(state), after, samples: Array.from({ length: 40 }, (_, i) => ({ elapsedMs: i * 100 + 50, ...structuredClone(after) })), observedForMs: 4000 };
}
test('exact native URL/scroll observed for the full window passes, without promising future/browser guarantees', () => {
  const r = assessNativeBack(witness()); assert.equal(r.status, 'PASS_OBSERVED_SCROLL'); assert.equal(r.documentReloaded, true); assert.equal(r.focusRestored, true);
  assert.equal(NATIVE_BACK_OBSERVATION_MS, 4000); assert.equal(NATIVE_BACK_SCROLL_TOLERANCE_PX, 1);
});
test('one pixel remains the strict scroll boundary; two pixels cannot be waived', () => {
  assert.equal(assessNativeBack(witness({ y: state.y - 1 })).scrollRestored, true);
  assert.equal(assessNativeBack(witness({ y: state.y - 2 })).status, 'FAIL_NATIVE_SCROLL');
});
test('history.length999 cannot turn the actual27506→969 failure into PASS', () => {
  const w = witness({ y: 969, active: { id: 'materials', href: null }, hash: '#materials', historyLength: 999 }); w.before.historyLength = 999;
  const r = assessNativeBack(w); assert.equal(r.status, 'FAIL_NATIVE_SCROLL'); assert.equal(r.focusStatus, 'FRAGMENT_TARGET_NOT_PREVIOUS_LINK');
});
test('a correctly restored early frame followed by a native fragment animation still FAILs', () => {
  const w = witness({ y: 969 }); w.samples[0].y = state.y; w.samples[1].y = state.y;
  assert.equal(assessNativeBack(w).status, 'FAIL_NATIVE_SCROLL');
  assert.throws(() => assessNativeBack({ ...w, observedForMs: 300 }), /at least4000ms/);
});
test('a correct scroll with reset focus is recorded as scroll-only, never exact focus restoration', () => {
  const r = assessNativeBack(witness({ active: { tag: 'BODY', id: '', href: null } }));
  assert.equal(r.status, 'PASS_OBSERVED_SCROLL'); assert.equal(r.focusRestored, false); assert.equal(r.focusStatus, 'NOT_RESTORED');
});
test('a duplicate href at another fixture ID does not prove exact link focus', () => {
  assert.equal(assessNativeBack(witness({ active: { id: 'first', href: '/series/' } })).focusRestored, false);
});
test('same scroll on the wrong URL is not native return', () => assert.equal(assessNativeBack(witness({ url: 'https://candidate.invalid/other/' })).status, 'FAIL_NATIVE_SCROLL'));
test('moving geometry/loading fonts stay inconclusive instead of a sampled false PASS', () => {
  const w = witness(); w.samples.at(-2).y -= 10; assert.equal(assessNativeBack(w).status, 'INCONCLUSIVE_UNSETTLED');
  assert.equal(assessNativeBack(witness({ fonts: 'loading' })).status, 'INCONCLUSIVE_UNSETTLED');
});
test('missing facts or too-short evidence fail closed', () => {
  for (const change of [{ y: NaN }, { y: -1 }, { documentHeight: 0 }, { timeOrigin: undefined }]) assert.throws(() => assessNativeBack(witness(change)));
  assert.throws(() => assessNativeBack({ ...witness(), samples: [] }));
});
test('stale, compressed or invented timing samples cannot certify a4000ms native observation', () => {
  const stale = witness(); stale.samples = stale.samples.slice(0, 5); assert.throws(() => assessNativeBack(stale), /stale/);
  const duplicate = witness(); duplicate.samples.at(-1).elapsedMs = duplicate.samples.at(-2).elapsedMs; assert.throws(() => assessNativeBack(duplicate), /timestamps/);
  const compressed = witness(); compressed.samples = compressed.samples.slice(-5).map((s, i) => ({ ...s, elapsedMs: 3900 + i }));
  assert.equal(assessNativeBack(compressed).status, 'INCONCLUSIVE_UNSETTLED');
  assert.equal(assessNativeBack(witness({ active: { id: 'unrelated', href: null }, hash: '#materials' })).focusStatus, 'NOT_RESTORED');
});
test('minimal control is script-free, bounded, and cannot admit a CSS/code injection', () => {
  const html = nativeBackFixture({ rows: 2, behavior: 'smooth' }); assert.doesNotMatch(html, /<script\b/i);
  assert.equal((html.match(/data-native-back-fixture/g) || []).length, 2); assert.match(html, /ТЕСТ, НЕ ПУБЛИКАЦИЯ/);
  for (const rows of [0, 501, 1.5]) assert.throws(() => nativeBackFixture({ rows, behavior: 'auto' }));
  assert.throws(() => nativeBackFixture({ rows: 2, behavior: 'auto}</style><script>' }));
});
const candidate = { name: 'actual-c4', role: 'target', origin: 'https://candidate.invalid', sourceSha: 'a'.repeat(40), artifactRoot: '/exact/dist', provenance: '/exact/receipt.json' };
test('matrix stores only temporary endpoints and exact build identity, never a feed/publication registry', () => {
  assert.equal(validateNativeBackMatrix({ candidates: [candidate] }).candidates.length, 1);
  for (const change of [{ publicationDate: '2026-01-01' }, { expectedPass: true }, { sourceSha: 'main' }, { role: undefined }, { name: '../escape' }, { name: 'neutral-smooth' }, { origin: 'https://user:secret@candidate.invalid' }, { origin: 'https://candidate.invalid/articles/' }]) assert.throws(() => validateNativeBackMatrix({ candidates: [{ ...candidate, ...change }] }));
  assert.throws(() => validateNativeBackMatrix({ candidates: [candidate, candidate] }));
  assert.throws(() => validateNativeBackMatrix({ candidates: [{ ...candidate, role: 'comparison' }] }));
  assert.throws(() => validateNativeBackMatrix({ candidates: [candidate], published: true }));
});
test('CLI permits only explicit suites/widths, never a relaxed threshold or invented browser state', () => {
  const args = ['--matrix=/endpoints.json', '--out=reports/g3-editorial-wave/new'];
  assert.equal(nativeBackOptions(args).suite, 'matrix'); assert.deepEqual(nativeBackOptions(args).widths, [390, 1440]);
  assert.equal(nativeBackOptions(args).bfcache, 'default'); assert.equal(nativeBackOptions([...args, '--bfcache=permitted']).bfcache, 'permitted');
  for (const extra of [['--widths=390,390'], ['--widths=999'], ['--suite=unknown'], ['--bfcache=guaranteed'], ['--scroll-tolerance=999'], ['--suite=target-keyboard', '--css-rehearsal']]) assert.throws(() => nativeBackOptions([...args, ...extra]));
});
test('the native driver does not intercept requests, fake reduced motion, or inject a Back repair', () => {
  const source = fs.readFileSync(new URL('articles-native-back-acceptance.mjs', import.meta.url), 'utf8');
  for (const forbidden of [/\.route\(/, /reducedMotion\s*:/, /\.addInitScript\(/, /\.addStyleTag\(/, /\.scrollTo\(/]) assert.doesNotMatch(source, forbidden);
  const afterBack = source.slice(source.indexOf('await page.goBack(')); assert.doesNotMatch(afterBack, /\.focus\(/);
  assert.match(source, /javaScriptEnabled: false/); assert.match(source, /while \(Date\.now\(\) - startBack < NATIVE_BACK_OBSERVATION_MS\)/);
});
