#!/usr/bin/env node
'use strict';

/*
 * premium-controls-rollout-audit.js  (PC-006)
 *
 * Enforces the PremiumControls route-archetype rollout contract so the controls
 * roll out as a typed system, not "yet another widget". Prevents two regression
 * classes that already bit this project:
 *
 *   1. DEAD CONTROLS (PC-002): a page renders visible gb-ember / gb-save /
 *      [data-fc-action] but they are NOT inside a [data-fc-root] or
 *      [data-fc-controls] scope, so floating-cluster-controller.js never wires
 *      them (init guards require .closest('[data-fc-root],[data-fc-controls]')).
 *
 *   2. CONTROLS WHERE FORBIDDEN: app/landing/catalog routes should NOT receive
 *      article PremiumControls by default. If they suddenly grow gb-ember/gb-save,
 *      that's an accidental rollout and must be caught.
 *
 * This audit runs against the BUILT dist/ HTML (the real assembled DOM), so it
 * cannot be fooled by controls whose [data-fc-root] comes from a parent component
 * (the source-level component scan gives false positives — dist does not).
 *
 * Usage:
 *   node scripts/premium-controls-rollout-audit.js            # expects dist/ to exist
 *   node scripts/premium-controls-rollout-audit.js --build    # build production-like dist first
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const assert = require('node:assert/strict');
const { parse } = require('parse5');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

if (process.argv.includes('--build')) {
  console.log('Building production-like dist…');
  execSync('npm run strangler:build:production-like', { cwd: ROOT, stdio: 'inherit' });
}

if (!fs.existsSync(DIST)) {
  console.error('❌ dist/ does not exist. Run with --build or `npm run strangler:build:production-like` first.');
  process.exit(2);
}

// ── Route archetypes (from PremiumControls rollout plan) ─────────────────────
const pcRollout = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/premium-controls-rollout.json'), 'utf8'));

function isForbiddenRoute(route) {
  for (const rule of pcRollout.forbiddenArchetypes) {
    if (rule.allow && rule.allow.includes('/' + route + '/')) continue;
    const pat = rule.routePattern;
    if (pat === '/' && route === '') return true;
    if (pat.endsWith('/*') && route.startsWith(pat.slice(1, -2))) return true;
    if (pat === '/' + route + '/') return true;
  }
  return false;
}
const checks = [];
const ok   = (name, d='') => checks.push({ ok:true,  name, detail:d });
const bad  = (name, d='') => checks.push({ ok:false, name, detail:d });

function walk(dir, out=[]) {
  for (const e of fs.readdirSync(dir, { withFileTypes:true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'index.html') out.push(p);
  }
  return out;
}

const routeOf = (file) =>
  path.relative(DIST, path.dirname(file)).split(path.sep).join('/');

// Audit rendered controls, not JavaScript/CSS selector literals. Home and other
// app shells legitimately mention [data-fc-action] inside inline event-delegation
// code; those strings are not DOM controls and must not trigger rollout policy.
function markupOnly(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, '');
}


// Journal's opt-in Play uses the canonical reader-tts capture owner, not
// FloatingCluster. A route name alone never exempts a control. Only the exact
// fail-hidden SSR adapter shape, on the two admitted routes, is recognized.
// The real Journal browser gate separately proves lazy runtime and behavior.
const JOURNAL_NARRATION_ROUTES = new Set([
  'journal/dossiers/g3', 'journal/dossiers/g3/history',
]);
const attr = (node, key) => node.attrs?.find(a => a.name === key)?.value;
const hasAttr = (node, key) => attr(node, key) !== undefined;
const named = node => Boolean(attr(node, 'aria-label')?.trim());
function descendants(node) {
  return [node, ...(node.childNodes || []).flatMap(descendants)];
}
function within(node, parent) {
  for (let n = node.parentNode; n; n = n.parentNode) if (n === parent) return true;
  return false;
}
// Native disabled fieldsets and inert subtrees can block otherwise enabled
// controls. The canonical adapter does not use either as an interaction scope.
function blockedNarrationControl(node) {
  for (let n = node; n; n = n.parentNode) {
    if (hasAttr(n, 'inert') || (n.tagName === 'fieldset' && hasAttr(n, 'disabled'))) return true;
  }
  return false;
}
function journalNarrationShape(route, markup) {
  // Avoid parsing unrelated pages; markupOnly has removed script/style/template
  // content. A marker in a comment does not count as an actual element.
  if (!markup.includes('data-journal-narration')) return 'none';
  const nodes = descendants(parse(markup)).filter(n => n.tagName);
  const slots = nodes.filter(n => hasAttr(n, 'data-journal-narration'));
  if (!slots.length) return 'none';
  if (!JOURNAL_NARRATION_ROUTES.has(route) || slots.length !== 1) return 'invalid';
  const slot = slots[0];
  const ranges = nodes.filter(n => hasAttr(n, 'data-reader-range'));
  const fc = nodes.filter(n => hasAttr(n, 'data-fc-action'));
  const scopes = nodes.filter(n => hasAttr(n, 'data-fc-root') || hasAttr(n, 'data-fc-controls'));
  const otherControls = nodes.some(n => (attr(n, 'class') || '').split(/\s+/).some(k => k === 'gb-ember' || k === 'gb-save'));
  if (ranges.length !== 1 || ranges[0].tagName !== 'main' ||
      attr(ranges[0], 'id') !== 'main-content' || !within(slot, ranges[0]) ||
      !hasAttr(slot, 'hidden') || !hasAttr(slot, 'data-pagefind-ignore') ||
      attr(slot, 'data-tts-policy') !== 'exclude' ||
      scopes.length || otherControls || fc.length !== 1) return 'invalid';
  const play = fc[0];
  const local = nodes.filter(n => within(n, slot));
  const groups = local.filter(n => attr(n, 'role') === 'group');
  const rates = local.filter(n => hasAttr(n, 'data-jn-rate'));
  const stops = local.filter(n => hasAttr(n, 'data-jn-stop'));
  const statuses = local.filter(n => hasAttr(n, 'data-jn-status'));
  if (groups.length !== 1 || !named(groups[0]) ||
      rates.length !== 1 || stops.length !== 1 || statuses.length !== 1) return 'invalid';
  const group = groups[0], rate = rates[0], stop = stops[0], status = statuses[0];
  const interactive = local.filter(n => ['button', 'select', 'input', 'textarea', 'a'].includes(n.tagName));
  if (interactive.length !== 3 || ![play, rate, stop, status].every(n => within(n, group)) ||
      [play, rate, stop].some(blockedNarrationControl) ||
      play.tagName !== 'button' || attr(play, 'type') !== 'button' ||
      attr(play, 'data-fc-action') !== 'play' || !named(play) ||
      attr(play, 'aria-pressed') !== 'false' || hasAttr(play, 'disabled') ||
      hasAttr(play, 'aria-haspopup') || hasAttr(play, 'aria-expanded') ||
      rate.tagName !== 'select' || !named(rate) || hasAttr(rate, 'disabled') ||
      stop.tagName !== 'button' || attr(stop, 'type') !== 'button' ||
      !named(stop) || !hasAttr(stop, 'disabled') || attr(status, 'role') !== 'status') return 'invalid';
  return 'valid';
}

function assertJournalNarrationClassifier() {
  const route = 'journal/dossiers/g3/history';
  const slot = '<div data-journal-narration hidden data-pagefind-ignore data-tts-policy="exclude"><div role="group" aria-label="Narration"><button type="button" data-fc-action="play" aria-label="Play" aria-pressed="false"></button><select data-jn-rate aria-label="Rate"><option value="1">1</option></select><button type="button" data-jn-stop aria-label="Stop" disabled></button><span data-jn-status role="status"></span></div></div>';
  const wrap = body => '<main id="main-content" data-reader-range>' + body + '</main>';
  const valid = wrap(slot);
  for (const r of JOURNAL_NARRATION_ROUTES) assert.equal(journalNarrationShape(r, valid), 'valid');
  assert.equal(journalNarrationShape('journal', valid), 'invalid');
  assert.equal(journalNarrationShape('articles/example', valid), 'invalid');
  assert.equal(journalNarrationShape(route, wrap('<!-- data-journal-narration -->')), 'none');
  assert.equal(journalNarrationShape(route, markupOnly('<script>const s="data-journal-narration"</script>')), 'none');
  for (const [label, input] of [
    ['duplicate adapter', wrap(slot + slot)],
    ['outside article', wrap('') + slot],
    ['duplicate reader range', valid + wrap('')],
    ['exposed before binding', valid.replace(' hidden', '')],
    ['missing speech exclusion', valid.replace(' data-tts-policy="exclude"', '')],
    ['other action', valid.replace('data-fc-action="play"', 'data-fc-action="share"')],
    ['extra action outside slot', valid + '<button data-fc-action="play"></button>'],
    ['mixed save control', valid + '<button class="gb-save"></button>'],
    ['mixed floating scope', valid + '<div data-fc-root></div>'],
    ['unnamed play', valid.replace(' aria-label="Play"', '')],
    ['wrong initial pressed', valid.replace('aria-pressed="false"', 'aria-pressed="true"')],
    ['fake popup state', valid.replace('aria-pressed="false"', 'aria-pressed="false" aria-expanded="false"')],
    ['stop exposed as enabled', valid.replace(' disabled', '')],
    ['disabled ancestor fieldset', valid.replace('<div role="group"', '<fieldset disabled role="group"').replace('</span></div>', '</span></fieldset>')],
    ['inert ancestor group', valid.replace('<div role="group"', '<div inert role="group"')],
    ['missing rate', valid.replace(/<select[\s\S]*?<\/select>/, '')],
    ['non-native rate', valid.replace('<select', '<div').replace('</select>', '</div>')],
    ['extra interactive control', valid.replace('</select>', '</select><button>extra</button>')],
    ['missing status', valid.replace(' role="status"', '')],
  ]) {
    assert.notEqual(input, valid, label + ': fixture mutation must be real');
    assert.equal(journalNarrationShape(route, input), 'invalid', label);
  }
}
assertJournalNarrationClassifier();
ok('Journal narration ownership classifier: admitted shape and negative controls pass');

const files = walk(DIST);

const CONTROL_RE = /\b(gb-ember|gb-save)\b|data-fc-action=/;
const SCOPE_RE   = /data-fc-root|data-fc-controls=/;

const selectorLiteralFixture = '<script>document.querySelector(\'[data-fc-action="search"]\')</script>';
if (CONTROL_RE.test(markupOnly(selectorLiteralFixture))) {
  bad('script selector literals are misclassified as controls', 'markupOnly() must exclude inline script contents');
} else {
  ok('script selector literals do not count as rendered PremiumControls');
}

let pagesWithControls = 0;
const journalNarrationPages = new Set();

for (const f of files) {
  const route = routeOf(f);
  const html = fs.readFileSync(f, 'utf8');
  const markup = markupOnly(html);
  const journalShape = journalNarrationShape(route, markup);
  if (journalShape === 'invalid') {
    bad(`invalid Journal narration adapter: /${route}/`, 'only the admitted fail-hidden single Play adapter is allowed; mixed or malformed controls are not exempt');
  }
  if (journalShape === 'valid') {
    journalNarrationPages.add(route);
    ok(`/${route}/ canonical standalone narration shape (browser behavior checked by Journal QA)`);
    continue;
  }
  const hasControls = CONTROL_RE.test(markup);
  if (!hasControls) continue;
  pagesWithControls++;

  const forbidden = isForbiddenRoute(route);

  if (forbidden) {
    bad(`forbidden route has article controls: /${route}/`,
        'app/landing/catalog routes must not carry gb-ember/gb-save by default');
    continue;
  }

  // ALLOWED route: every control must be inside a scope. Cheap structural proof:
  // the page must contain at least one [data-fc-root]/[data-fc-controls], AND the
  // controller must be loaded.
  const hasScope = SCOPE_RE.test(markup);
  const controllerLoaded = /floating-cluster-controller\.js/.test(html);

  if (!hasScope) {
    bad(`dead controls (no fc scope): /${route}/`,
        'gb-ember/gb-save present but no [data-fc-root]/[data-fc-controls] → controller cannot wire them (PC-002 class)');
  } else if (!controllerLoaded) {
    bad(`controls present but controller not loaded: /${route}/`,
        'floating-cluster-controller.js missing → controls dead');
  } else {
    ok(`/${route}/ controls scoped + controller loaded`);
  }
}

ok(`scanned ${files.length} dist pages; ${pagesWithControls} carry PremiumControls; ${journalNarrationPages.size} admitted standalone Journal narration adapters`);

// ── PC-004 invariant: no double CSS delivery of the floating-cluster styles ──
// A page must not receive the SAME PremiumControls CSS twice — i.e. it must not
// both <link> /css/floating-cluster.css AND load the Astro-bundled
// /_astro/FloatingCluster*.css. Component-rendered pages use the bundle;
// link-only pages use the external file. Never both.
let doubleDelivery = 0;
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  const hasLink   = /<link[^>]+href="[^"]*\/css\/floating-cluster\.css/.test(html);
  const hasBundle = /<link[^>]+href="[^"]*\/_astro\/FloatingCluster\._[^"]*\.css/.test(html);
  if (hasLink && hasBundle) {
    doubleDelivery++;
    bad(`double CSS delivery: /${routeOf(f)}/`,
        'page loads BOTH /css/floating-cluster.css AND the _astro/FloatingCluster bundle (PC-004)');
  }
}
if (!doubleDelivery) ok('no double floating-cluster CSS delivery (PC-004 invariant holds)');

// ── PC-005 & PC-007 state-of-the-art PremiumControls assertions ──────────────
const controllerPath = path.join(ROOT, 'js/floating-cluster-controller.js');
if (fs.existsSync(controllerPath)) {
  const cCode = fs.readFileSync(controllerPath, 'utf8');
  if (cCode.includes('gb:audio:rate') && cCode.includes('gb:tts-rate-change')) {
    ok('floating-cluster-controller.js canonical storage & events OK (PC-005)');
  } else {
    bad('floating-cluster-controller.js missing canonical rate or events', 'must contain gb:audio:rate and gb:tts-rate-change');
  }
} else {
  bad('floating-cluster-controller.js missing', 'core PremiumControls runtime missing');
}

const cssPath = path.join(ROOT, 'css/floating-cluster.css');
if (fs.existsSync(cssPath)) {
  const cssCode = fs.readFileSync(cssPath, 'utf8');
  if (cssCode.includes('.gb-floater--hermeneutics') && cssCode.includes('gb-ember-expand') && cssCode.includes('gb-roman') && cssCode.includes('gb-series-mark--label')) {
    ok('floating-cluster.css canonical rules OK (POS-01, speed morph, gb-roman, label marks)');
  } else {
    bad('floating-cluster.css missing canonical rules', 'must contain .gb-floater--hermeneutics, gb-ember-expand, gb-roman, gb-series-mark--label');
  }
  if (/\[data-gill-v16\]\s*(background|border-color|color)\s+\./.test(cssCode)) {
    bad('floating-cluster.css malformed transition fragment', 'transition values must not be prefixed with [data-gill-v16]');
  } else {
    ok('floating-cluster.css transition syntax OK');
  }
  if (/\[data-gill-v16\][^{\n]*,\s*(?:html\.dark\s+)?\.(?:toc|gb-|gbs)/.test(cssCode) || /html\.dark\s+\[data-gill-v16\][^{\n]*,\s*html\.dark\s+\.(?:toc|gb-|gbs)/.test(cssCode)) {
    bad('floating-cluster.css Gill selector scope leak', 'every selector arm in Gill rules must repeat [data-gill-v16]');
  } else {
    ok('floating-cluster.css Gill selector scoping OK');
  }
} else {
  bad('floating-cluster.css missing', 'core PremiumControls styles missing');
}

const RAW_GILL_ROMAN_RE = /class="(?:gbs-rail-card__num|toc-item__num|toc-part-item__num|gbs2-kinetic)"[^>]*>[IVX]+</;

for (const f of files) {
  const route = routeOf(f);
  const html = fs.readFileSync(f, 'utf8');
  const markup = markupOnly(html);
  const isAstro = html.includes('data-astro-cid-') || html.includes('data-pc-anchor') || html.includes('FloatingCluster');
  if (!journalNarrationPages.has(route) && CONTROL_RE.test(markup)) {
    if (html.includes('aria-haspopup') && html.includes('aria-expanded')) {
      ok(`/${route}/ ARIA / accessibility parity OK`);
    } else {
      if (isAstro) bad(`/${route}/ missing ARIA attributes on controls`, 'controls must carry aria-haspopup and aria-expanded');
      else console.log(`⚠️ /${route}/ (legacy root copy): missing ARIA attributes on controls (will be fixed upon Astro promotion)`);
    }
  }
  if (route.startsWith('articles/dzhon-gill-')) {
    if (html.includes('data-gill-v16')) {
      ok(`/${route}/ v16 marker present`);
    } else {
      bad(`/${route}/ missing data-gill-v16`, 'Gill chrome must stay on v16 marker contract');
    }

    if (html.includes('gb-roman')) {
      ok(`/${route}/ RomanNumeral integration OK (PC-007)`);
    } else {
      if (isAstro) bad(`/${route}/ missing gb-roman class`, 'Gill routes must use RomanNumeral component, no hardcoded raw numbers');
      else console.log(`⚠️ /${route}/ (legacy root copy): missing gb-roman class (will be fixed upon Astro promotion)`);
    }

    if (RAW_GILL_ROMAN_RE.test(html)) {
      bad(`/${route}/ raw Gill numerals remain`, 'Gill chrome must not render raw numerals in rail / TOC / kinetic markers');
    } else {
      ok(`/${route}/ no raw Gill numeral nodes in chrome`);
    }

    if (html.includes('gb-series-mark--label')) {
      ok(`/${route}/ label series-mark integration OK (PC-008)`);
    } else if (isAstro) {
      bad(`/${route}/ missing label series-mark`, 'Intro and spravochnik must render gb-series-mark--label badges');
    }

    for (const forbidden of ['Часть 1 из 5', 'Часть 0']) {
      if (html.includes(forbidden)) {
        bad(`/${route}/ forbidden series wording "${forbidden}"`, 'Introduction is a label (Введение), never a numbered part');
      }
    }
    if (!html.includes('Часть 1 из 5') && !html.includes('Часть 0')) {
      ok(`/${route}/ no forbidden numbered-intro wording`);
    }

    // PC-CURRENT-06: Gill mobile V3 bar — static HTML checks
    if (html.includes('mobile-bottom-bar')) {
      if (html.includes('mobPartTocBtn')) {
        ok(`/${route}/ #mobPartTocBtn present (PC-CURRENT-06)`);
      } else if (isAstro) {
        bad(`/${route}/ missing #mobPartTocBtn`, 'Gill V3 mobile bar must have explicit Part TOC button (PC-CURRENT-06)');
      }
      if (html.includes('data-gill-mobile-bar')) {
        ok(`/${route}/ data-gill-mobile-bar attr present`);
      } else if (isAstro) {
        bad(`/${route}/ missing data-gill-mobile-bar attr`, 'Gill V3 mobile bar must carry data-gill-mobile-bar');
      }
    }
    // aria-hidden on overlays (AT contract)
    if (html.includes('id="seriesTocOverlay"')) {
      if (/id="seriesTocOverlay"[^>]*aria-hidden="true"/.test(html) || /aria-hidden="true"[^>]*id="seriesTocOverlay"/.test(html)) {
        ok(`/${route}/ #seriesTocOverlay has aria-hidden=true by default`);
      } else if (isAstro) {
        bad(`/${route}/ #seriesTocOverlay missing aria-hidden=true`, 'overlay must be hidden from AT when closed');
      }
    }
    if (html.includes('id="partTocOverlay"')) {
      if (/id="partTocOverlay"[^>]*aria-hidden="true"/.test(html) || /aria-hidden="true"[^>]*id="partTocOverlay"/.test(html)) {
        ok(`/${route}/ #partTocOverlay has aria-hidden=true by default`);
      } else if (isAstro) {
        bad(`/${route}/ #partTocOverlay missing aria-hidden=true`, 'overlay must be hidden from AT when closed');
      }
    }

    if (route.includes('dzhon-gill-istoricheskiy-kontekst')) {
      const railNow = html.match(/Сейчас читаете[\s\S]{0,160}?<h2[^>]*>([\s\S]*?)<\/h2>/);
      if (railNow) {
        const title = railNow[1].replace(/<[^>]+>/g, '').trim();
        if (title === 'Исторический контекст') {
          ok(`/${route}/ rail "Сейчас читаете" shows article title, not series title (PC-010)`);
        } else {
          bad(`/${route}/ rail "Сейчас читаете" title regression`, `expected "Исторический контекст", got "${title}"`);
        }
      } else if (isAstro) {
        bad(`/${route}/ rail "Сейчас читаете" heading missing`, 'introduction rail must carry a current-article h2');
      }
    }
  }
}

const failures = checks.filter(c => !c.ok);
for (const c of checks) {
  console.log(`${c.ok ? '✅' : '❌'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
}
console.log(`\nPremiumControls rollout audit: ${checks.length - failures.length}/${checks.length} passed`);
if (failures.length) {
  console.log('\n❌ PremiumControls rollout contract violated.');
  process.exit(1);
}
console.log('\n✅ PremiumControls rollout contract OK.');
