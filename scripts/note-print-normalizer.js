#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WRITE = process.argv.includes('--write');
const REGISTRY = path.join(ROOT, 'scripts', 'lib', 'note-registry.mjs');
const CONTRACT = path.join(ROOT, 'scripts', 'note-registry-contract-test.mjs');

const CSS_V1 = '@media print{.gb-note-endnotes{position:static!important;width:auto!important;height:auto!important;margin:2rem 0!important;overflow:visible!important;clip:auto!important}.fn-marker>.tooltip{display:none!important}.gb-note-endnotes__back{display:none!important}}';
const CSS_V2 = '@media print{.gb-note-endnotes{display:block!important;position:static!important;width:auto!important;height:auto!important;max-height:none!important;margin:2rem 0 0!important;padding:0!important;overflow:visible!important;clip:auto!important;visibility:visible!important;opacity:1!important;break-before:auto!important;page-break-before:auto!important;break-after:auto!important;page-break-after:auto!important}.gb-note-endnotes h2{display:block!important;break-after:avoid-page!important;page-break-after:avoid!important}.gb-note-endnotes ol{display:block!important;margin:.75rem 0 0!important;padding-left:1.5rem!important;list-style:decimal!important;overflow:visible!important}.gb-note-endnotes li{display:list-item!important;position:static!important;width:auto!important;height:auto!important;max-height:none!important;overflow:visible!important;clip:auto!important;visibility:visible!important;opacity:1!important;break-inside:avoid-page!important;page-break-inside:avoid!important}.fn-marker>.tooltip{display:none!important}.gb-note-endnotes__back{display:none!important}}';
const CSS_V3 = '@media print{.gb-note-endnotes{display:block!important;position:static!important;width:auto!important;height:auto!important;max-height:none!important;margin:2rem 0 0!important;padding:0!important;overflow:visible!important;clip:auto!important;clip-path:none!important;visibility:visible!important;opacity:1!important;content-visibility:visible!important;contain:none!important;transform:none!important;color:#111!important;font-size:10pt!important;line-height:1.45!important;break-before:auto!important;page-break-before:auto!important;break-after:auto!important;page-break-after:auto!important}.gb-note-endnotes,.gb-note-endnotes *{visibility:visible!important;opacity:1!important;content-visibility:visible!important;clip:auto!important;clip-path:none!important;transform:none!important;color:#111!important}.gb-note-endnotes h2{display:block!important;font-size:18pt!important;line-height:1.2!important;break-after:avoid-page!important;page-break-after:avoid!important}.gb-note-endnotes ol{display:block!important;margin:.75rem 0 0!important;padding-left:1.5rem!important;list-style:decimal!important;overflow:visible!important;font-size:10pt!important;line-height:1.45!important}.gb-note-endnotes li{display:list-item!important;position:static!important;width:auto!important;height:auto!important;max-height:none!important;margin:0 0 .55rem!important;padding:0!important;overflow:visible!important;clip:auto!important;white-space:normal!important;font-size:10pt!important;line-height:1.45!important;break-inside:auto!important;page-break-inside:auto!important}.gb-note-endnotes__content{display:inline!important;position:static!important;width:auto!important;height:auto!important;overflow:visible!important;white-space:normal!important}.fn-marker>.tooltip{display:none!important}.gb-note-endnotes__back{display:none!important}}';
const PRINT_OWNER_V1 = '@media print{html body #main-content>section.gb-note-endnotes[data-note-registry-endnotes][data-pagefind-body],html body main>section.gb-note-endnotes[data-note-registry-endnotes][data-pagefind-body]{display:block!important;position:static!important;float:none!important;inset:auto!important;inline-size:auto!important;block-size:auto!important;width:auto!important;height:auto!important;min-width:0!important;max-width:none!important;min-height:0!important;max-height:none!important;margin:2rem 0 0!important;padding:0!important;overflow:visible!important;clip:auto!important;clip-path:none!important;visibility:visible!important;opacity:1!important;content-visibility:visible!important;contain:none!important;transform:none!important}}';
const PRINT_OWNER_V2 = '@media print{html body #main-content>section.gb-note-endnotes[data-note-registry-endnotes][data-pagefind-body],html body main>section.gb-note-endnotes[data-note-registry-endnotes][data-pagefind-body]{display:block!important;position:static!important;float:none!important;inset:auto!important;inline-size:auto!important;block-size:auto!important;width:auto!important;height:auto!important;min-width:0!important;max-width:none!important;min-height:0!important;max-height:none!important;margin:2rem 0 0!important;padding:0!important;overflow:visible!important;clip:auto!important;clip-path:none!important;visibility:visible!important;opacity:1!important;content-visibility:visible!important;contain:none!important;transform:none!important}html body #main-content>section.gb-note-endnotes[data-note-registry-endnotes][data-pagefind-body] *,html body main>section.gb-note-endnotes[data-note-registry-endnotes][data-pagefind-body] *{visibility:visible!important;opacity:1!important;content-visibility:visible!important;clip:auto!important;clip-path:none!important;transform:none!important;color:#111!important}html body #main-content>section.gb-note-endnotes[data-note-registry-endnotes][data-pagefind-body]>h2,html body main>section.gb-note-endnotes[data-note-registry-endnotes][data-pagefind-body]>h2{display:block!important;position:static!important;width:auto!important;height:auto!important;margin:0!important;overflow:visible!important;font-size:18pt!important;line-height:1.2!important;break-after:avoid-page!important;page-break-after:avoid!important}html body #main-content>section.gb-note-endnotes[data-note-registry-endnotes][data-pagefind-body]>ol,html body main>section.gb-note-endnotes[data-note-registry-endnotes][data-pagefind-body]>ol{display:block!important;position:static!important;width:auto!important;height:auto!important;margin:.75rem 0 0!important;padding-left:1.5rem!important;overflow:visible!important;list-style:decimal!important;font-size:10pt!important;line-height:1.45!important}html body #main-content>section.gb-note-endnotes[data-note-registry-endnotes][data-pagefind-body]>ol>li,html body main>section.gb-note-endnotes[data-note-registry-endnotes][data-pagefind-body]>ol>li{display:list-item!important;position:static!important;float:none!important;width:auto!important;height:auto!important;min-height:0!important;max-height:none!important;margin:0 0 .55rem!important;padding:0!important;overflow:visible!important;white-space:normal!important;font-size:10pt!important;line-height:1.45!important;break-inside:auto!important;page-break-inside:auto!important}html body #main-content>section.gb-note-endnotes[data-note-registry-endnotes][data-pagefind-body] .gb-note-endnotes__ordinal,html body main>section.gb-note-endnotes[data-note-registry-endnotes][data-pagefind-body] .gb-note-endnotes__ordinal,html body #main-content>section.gb-note-endnotes[data-note-registry-endnotes][data-pagefind-body] .gb-note-endnotes__content,html body main>section.gb-note-endnotes[data-note-registry-endnotes][data-pagefind-body] .gb-note-endnotes__content{display:inline!important;position:static!important;width:auto!important;height:auto!important;overflow:visible!important;white-space:normal!important}html body #main-content>section.gb-note-endnotes[data-note-registry-endnotes][data-pagefind-body] .gb-note-endnotes__back,html body main>section.gb-note-endnotes[data-note-registry-endnotes][data-pagefind-body] .gb-note-endnotes__back{display:none!important}}';
const PRINT_TERMINAL_MARKER = '>ol>li{display:list-item!important;position:static!important;float:none!important;';
const ITEMS_V1 = 'const items = notes.map((note) => `      <li id="${note.endnoteId}" data-note-id="${note.id}" data-note-ordinal="${note.ordinal}"><span class="gb-note-endnotes__ordinal" aria-hidden="true">${note.ordinal}.</span> ${note.html} <a class="gb-note-endnotes__back" href="#${note.refId}" aria-label="Вернуться к отметке ${note.ordinal}">↩</a></li>`).join(\'\\n\');';
const ITEMS_V2 = 'const items = notes.map((note) => `      <li id="${note.endnoteId}" data-note-id="${note.id}" data-note-ordinal="${note.ordinal}"><span class="gb-note-endnotes__ordinal" aria-hidden="true">${note.ordinal}.</span> <span class="gb-note-endnotes__content">${escapeHtml(note.text)}</span> <a class="gb-note-endnotes__back" href="#${note.refId}" aria-label="Вернуться к отметке ${note.ordinal}">↩</a></li>`).join(\'\\n\');';
const BEFORE_EMPTY_GUARD = 'function buildEndnotes(route, notes) {\n  const routeSlug = stableRouteSlug(route);';
const AFTER_EMPTY_GUARD = "function buildEndnotes(route, notes) {\n  if (!notes.length) return '';\n  const routeSlug = stableRouteSlug(route);";
const BEFORE_CONTRACT = "execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'site-tooltip-touch-normalizer.js')], { stdio: 'inherit' });";
const AFTER_CONTRACT = `${BEFORE_CONTRACT}\nexecFileSync(process.execPath, [path.join(ROOT, 'scripts', 'note-print-normalizer.js')], { stdio: 'inherit' });`;
const STYLE_CLOSE = '\n</style>';

function count(source, needle) {
  return source.split(needle).length - 1;
}

function residualBeforeCount(source, before, after) {
  return count(source.split(after).join(''), before);
}

function normalize(file, before, after, label) {
  const source = fs.readFileSync(file, 'utf8');
  const afterCount = count(source, after);
  const residualCount = residualBeforeCount(source, before, after);
  if (afterCount === 1 && residualCount === 0) return false;
  if (afterCount !== 0 || residualCount !== 1) {
    throw new Error(`${label} normalizer refused input: residualBefore=${residualCount}, after=${afterCount}`);
  }
  if (!WRITE) throw new Error(`${label} is stale; rerun with --write`);
  const next = source.replace(before, after);
  const nextAfterCount = count(next, after);
  const nextResidualCount = residualBeforeCount(next, before, after);
  if (nextAfterCount !== 1 || nextResidualCount !== 0) {
    throw new Error(`${label} target verification failed: residualBefore=${nextResidualCount}, after=${nextAfterCount}`);
  }
  fs.writeFileSync(file, next, 'utf8');
  return true;
}

function normalizePrintCss() {
  const source = fs.readFileSync(REGISTRY, 'utf8');
  const terminalCount = count(source, PRINT_TERMINAL_MARKER);
  const ownerV1Count = count(source, PRINT_OWNER_V1);
  const ownerV2Count = count(source, PRINT_OWNER_V2);
  const legacyCounts = [CSS_V1, CSS_V2, CSS_V3].map((css) => count(source, css));

  if (terminalCount === 1 && ownerV2Count === 1 && ownerV1Count === 0) {
    if (legacyCounts[0] !== 0 || legacyCounts[1] !== 0) {
      throw new Error('NoteRegistry print CSS contains terminal owner and obsolete v1/v2 states');
    }
    return false;
  }
  if (terminalCount !== 0 || ownerV2Count !== 0) {
    throw new Error(`NoteRegistry print CSS has a mixed terminal state: terminal=${terminalCount}, ownerV2=${ownerV2Count}`);
  }
  if (!WRITE) throw new Error('NoteRegistry print CSS is stale; rerun with --write');

  let next = source;
  if (ownerV1Count === 1) {
    next = next.replace(PRINT_OWNER_V1, PRINT_OWNER_V2);
  } else {
    if (ownerV1Count !== 0 || legacyCounts.reduce((sum, value) => sum + value, 0) !== 1) {
      throw new Error(`NoteRegistry print CSS normalizer refused input: ownerV1=${ownerV1Count}, legacy=${legacyCounts.join('/')}`);
    }
    if (legacyCounts[0] === 1) next = next.replace(CSS_V1, CSS_V3);
    else if (legacyCounts[1] === 1) next = next.replace(CSS_V2, CSS_V3);
    const closeCount = count(next, STYLE_CLOSE);
    if (closeCount !== 1) throw new Error(`NoteRegistry print owner insertion refused style boundary: ${closeCount}`);
    next = next.replace(STYLE_CLOSE, `\n${PRINT_OWNER_V2}${STYLE_CLOSE}`);
  }

  if (count(next, PRINT_TERMINAL_MARKER) !== 1 || count(next, PRINT_OWNER_V2) !== 1 || count(next, PRINT_OWNER_V1) !== 0) {
    throw new Error('NoteRegistry print descendant owner terminal verification failed');
  }
  fs.writeFileSync(REGISTRY, next, 'utf8');
  return true;
}

const changed = [
  normalizePrintCss(),
  normalize(REGISTRY, ITEMS_V1, ITEMS_V2, 'NoteRegistry print text projection'),
  normalize(REGISTRY, BEFORE_EMPTY_GUARD, AFTER_EMPTY_GUARD, 'NoteRegistry empty-endnotes guard'),
  normalize(CONTRACT, BEFORE_CONTRACT, AFTER_CONTRACT, 'NoteRegistry print source contract'),
].some(Boolean);

console.log(changed
  ? '✅ NoteRegistry print projection normalized'
  : '✅ NoteRegistry print projection contract already normalized');
