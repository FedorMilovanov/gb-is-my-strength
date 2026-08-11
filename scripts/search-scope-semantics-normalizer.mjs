#!/usr/bin/env node
// Permanent fail-closed normalizer for Search scope semantics and shared overlay ownership.
// It accepts only the canonical legacy or normalized shapes; mixed/unknown states are errors.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEARCH_PATH = path.join(ROOT, 'js/search.js');
const WRITE = process.argv.includes('--write');
const SELF_TEST = process.argv.includes('--self-test');

const LEGACY_MARKUP = '<div class="cp-scope-chips" role="tablist"><button class="cp-scope-chip active" data-scope="all" role="tab" aria-selected="true"><span class="cp-scope-icon">'+"'"+'+v+'+"'"+'</span><span>Все</span></button><button class="cp-scope-chip" data-scope="articles" role="tab" aria-selected="false"><span class="cp-scope-icon">'+"'"+'+u+'+"'"+'</span><span>Статьи</span></button><button class="cp-scope-chip" data-scope="scripture" role="tab" aria-selected="false"><span class="cp-scope-icon">'+"'"+'+f+'+"'"+'</span><span>Ссылки</span></button><button class="cp-scope-chip" data-scope="authors" role="tab" aria-selected="false"><span class="cp-scope-icon">'+"'"+'+w+'+"'"+'</span><span>Авторы</span></button></div>';
const NORMALIZED_MARKUP = '<div class="cp-scope-chips" role="group" aria-label="Область поиска"><button type="button" class="cp-scope-chip active" data-scope="all" aria-pressed="true"><span class="cp-scope-icon">'+"'"+'+v+'+"'"+'</span><span>Все</span></button><button type="button" class="cp-scope-chip" data-scope="articles" aria-pressed="false"><span class="cp-scope-icon">'+"'"+'+u+'+"'"+'</span><span>Статьи</span></button><button type="button" class="cp-scope-chip" data-scope="scripture" aria-pressed="false"><span class="cp-scope-icon">'+"'"+'+f+'+"'"+'</span><span>Ссылки</span></button><button type="button" class="cp-scope-chip" data-scope="authors" aria-pressed="false"><span class="cp-scope-icon">'+"'"+'+w+'+"'"+'</span><span>Авторы</span></button></div>';
const LEGACY_STATE = 'e.setAttribute("aria-selected",t?"true":"false")';
const NORMALIZED_STATE = 'e.setAttribute("aria-pressed",t?"true":"false")';

const OVERLAY_OWNER = 'search:command-palette';
const LEGACY_ANCHOR = 'K="gb-cp-history";function z()';
const LEGACY_OPEN_OWNER = 'window.SiteUtils&&"function"==typeof window.SiteUtils.lockScroll?window.SiteUtils.lockScroll("command-palette"):document.documentElement.classList.add("cp-scroll-lock")';
const LEGACY_CLOSE_OWNER = 'document.documentElement.classList.remove("cp-scroll-lock"),window.SiteUtils&&"function"==typeof window.SiteUtils.unlockScroll&&window.SiteUtils.unlockScroll("command-palette")';
const NORMALIZED_OPEN_OWNER = '__gbOpenSearchOverlay("open")';
const NORMALIZED_CLOSE_OWNER = '__gbCloseSearchOverlay("close")';
const OVERLAY_HELPERS = 'var __gbSearchOverlay=null;function __gbSearchOverlayRuntime(){return window.OverlayRuntime||window.SiteUtils&&window.SiteUtils.OverlayRuntime||null}function __gbSearchInertTargets(){return Array.prototype.filter.call(document.body.children,function(e){return e!==k})}function __gbEnsureSearchOverlay(){var e=__gbSearchOverlayRuntime();return __gbSearchOverlay||!e||"function"!=typeof e.register?__gbSearchOverlay:(__gbSearchOverlay=e.register("'+OVERLAY_OWNER+'",{element:k,focusTarget:function(){return E},onRequestClose:function(){return re(),!0},closeOnEscape:!0,trapFocus:!1,restoreFocus:!1,lockScroll:!0}),__gbSearchOverlay)}function __gbOpenSearchOverlay(e){var t=__gbEnsureSearchOverlay();if(t){t.open({opener:D,inertTargets:__gbSearchInertTargets(),reason:e||"open"});return}if(window.SiteUtils&&"function"==typeof window.SiteUtils.lockScroll){window.SiteUtils.lockScroll("command-palette")}else{document.documentElement.classList.add("cp-scroll-lock")}}function __gbCloseSearchOverlay(e){document.documentElement.classList.remove("cp-scroll-lock");var t=__gbSearchOverlay;if(t&&"function"==typeof t.isOpen&&t.isOpen()){t.close(e||"close",{restoreFocus:!1});return}if(window.SiteUtils&&"function"==typeof window.SiteUtils.unlockScroll){window.SiteUtils.unlockScroll("command-palette")}}';
const NORMALIZED_ANCHOR = 'K="gb-cp-history";'+OVERLAY_HELPERS+'function z()';

const CANONICAL_SUBHTML = 'e.subHtml&&e.subHtml.trim()?e.subHtml:e.sub?F(e.sub):""';
const CORRUPTED_SUBHTML = 'e.subHtml&&e.subHtml.trim()?e.sub?F(e.sub):"":e.sub?F(e.sub):""';

function count(source, needle) {
  return source.split(needle).length - 1;
}

function compile(source, label) {
  try {
    new vm.Script(source, { filename: label });
  } catch (error) {
    throw new Error(`${label} is not valid JavaScript: ${error.message}`);
  }
}

function inspect(source) {
  return {
    legacyMarkup: count(source, LEGACY_MARKUP),
    normalizedMarkup: count(source, NORMALIZED_MARKUP),
    legacyState: count(source, LEGACY_STATE),
    normalizedState: count(source, NORMALIZED_STATE),
    legacyAnchor: count(source, LEGACY_ANCHOR),
    normalizedAnchor: count(source, NORMALIZED_ANCHOR),
    legacyOpenOwner: count(source, LEGACY_OPEN_OWNER),
    normalizedOpenOwner: count(source, NORMALIZED_OPEN_OWNER),
    legacyCloseOwner: count(source, LEGACY_CLOSE_OWNER),
    normalizedCloseOwner: count(source, NORMALIZED_CLOSE_OWNER),
    overlayOwner: count(source, OVERLAY_OWNER),
    canonicalSubHtml: count(source, CANONICAL_SUBHTML),
    corruptedSubHtml: count(source, CORRUPTED_SUBHTML),
  };
}

function isLegacyScope(state) {
  return state.legacyMarkup === 1 && state.normalizedMarkup === 0 && state.legacyState === 2 && state.normalizedState === 0;
}

function isNormalizedScope(state) {
  return state.legacyMarkup === 0 && state.normalizedMarkup === 1 && state.legacyState === 0 && state.normalizedState === 2;
}

function isLegacyOverlay(state) {
  return state.legacyAnchor === 1 && state.normalizedAnchor === 0 && state.legacyOpenOwner === 1 && state.normalizedOpenOwner === 0 && state.legacyCloseOwner === 1 && state.normalizedCloseOwner === 0 && state.overlayOwner === 0;
}

function isNormalizedOverlay(state) {
  return state.legacyAnchor === 0 && state.normalizedAnchor === 1 && state.legacyOpenOwner === 0 && state.normalizedOpenOwner === 1 && state.legacyCloseOwner === 0 && state.normalizedCloseOwner === 1 && state.overlayOwner === 1;
}

function assertRenderingAuthority(state) {
  if (state.corruptedSubHtml !== 0 || state.canonicalSubHtml !== 1) {
    throw new Error(`search result rendering authority drift: canonical=${state.canonicalSubHtml}, corrupted=${state.corruptedSubHtml}`);
  }
}

function transform(source) {
  const before = inspect(source);
  assertRenderingAuthority(before);
  if (!isLegacyScope(before) && !isNormalizedScope(before)) {
    throw new Error(`search scope authority drift: ${JSON.stringify(before)}`);
  }
  if (!isLegacyOverlay(before) && !isNormalizedOverlay(before)) {
    throw new Error(`search overlay authority drift: ${JSON.stringify(before)}`);
  }

  let output = source;
  let changed = false;

  if (isLegacyScope(before)) {
    output = output
      .replace(LEGACY_MARKUP, NORMALIZED_MARKUP)
      .replaceAll(LEGACY_STATE, NORMALIZED_STATE);
    changed = true;
  }

  const afterScope = inspect(output);
  if (isLegacyOverlay(afterScope)) {
    output = output
      .replace(LEGACY_ANCHOR, NORMALIZED_ANCHOR)
      .replace(LEGACY_OPEN_OWNER, NORMALIZED_OPEN_OWNER)
      .replace(LEGACY_CLOSE_OWNER, NORMALIZED_CLOSE_OWNER);
    changed = true;
  }

  const after = inspect(output);
  assertRenderingAuthority(after);
  if (!isNormalizedScope(after)) {
    throw new Error(`search scope normalization postcondition failed: ${JSON.stringify(after)}`);
  }
  if (!isNormalizedOverlay(after)) {
    throw new Error(`search overlay normalization postcondition failed: ${JSON.stringify(after)}`);
  }
  compile(output, 'js/search.js.normalized');
  return { source: output, changed, before, after };
}

function selfTest() {
  const current = fs.readFileSync(SEARCH_PATH, 'utf8');
  const normalized = transform(current).source;
  const legacy = normalized
    .replace(NORMALIZED_MARKUP, LEGACY_MARKUP)
    .replaceAll(NORMALIZED_STATE, LEGACY_STATE)
    .replace(NORMALIZED_OPEN_OWNER, LEGACY_OPEN_OWNER)
    .replace(NORMALIZED_CLOSE_OWNER, LEGACY_CLOSE_OWNER)
    .replace(NORMALIZED_ANCHOR, LEGACY_ANCHOR);
  const legacyState = inspect(legacy);
  if (!isLegacyScope(legacyState) || !isLegacyOverlay(legacyState)) {
    throw new Error(`self-test could not reconstruct canonical legacy state: ${JSON.stringify(legacyState)}`);
  }
  const first = transform(legacy);
  if (!first.changed || first.source !== normalized) throw new Error('self-test normalization failed');
  const second = transform(first.source);
  if (second.changed || second.source !== normalized) throw new Error('self-test idempotence failed');
  console.log('SEARCH SCOPE + OVERLAY NORMALIZER SELF-TEST: PASS');
}

if (SELF_TEST) {
  selfTest();
  process.exit(0);
}

const source = fs.readFileSync(SEARCH_PATH, 'utf8');
const result = transform(source);
if (result.changed) {
  if (!WRITE) {
    console.error('SEARCH SCOPE + OVERLAY NORMALIZER: DRIFT — run with --write');
    process.exit(1);
  }
  fs.writeFileSync(SEARCH_PATH, result.source);
  console.log('SEARCH SCOPE + OVERLAY NORMALIZER: WROTE canonical Search ownership');
} else {
  console.log('SEARCH SCOPE + OVERLAY NORMALIZER: PASS');
}
