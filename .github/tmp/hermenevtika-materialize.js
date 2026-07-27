'use strict';

const fs = require('fs');
const assert = require('assert');

const SOURCE = 'src/components/article-pilots/hermenevtika/HermenevtikaBody.astro';
const STATIC_AUDIT = 'scripts/article-native-contract-audit.js';
const BROWSER_AUDIT = 'scripts/interactive-audit.js';
const EXPECTED = ['40', '72', '75', '82', '83', '107'];
const FORBIDDEN = /<(?:button|a)\b|\bdata-ref\s*=|\btabindex\s*=|\brole\s*=\s*["']button["']|\bclass\s*=\s*["'][^"']*\bbref\b/i;

function replaceOnce(source, needle, replacement, label) {
  const count = source.split(needle).length - 1;
  assert.strictEqual(count, 1, `${label}: expected one anchor, got ${count}`);
  return source.replace(needle, replacement);
}

function matchingSpanClose(html, openStart) {
  const tags = /<\/?span\b[^>]*>/gi;
  tags.lastIndex = openStart;
  let depth = 0;
  for (let match; (match = tags.exec(html));) {
    if (/^<\/span/i.test(match[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) return { start: match.index, end: tags.lastIndex };
  }
  return null;
}

function collectFootnotes(html) {
  const result = [];
  const markers = /<span\b(?=[^>]*\bclass="[^"]*\bfn-marker\b[^"]*")[^>]*>/gi;
  for (let marker; (marker = markers.exec(html));) {
    const markerClose = matchingSpanClose(html, marker.index);
    assert(markerClose, `unclosed fn-marker at ${marker.index}`);
    const markerInner = html.slice(markers.lastIndex, markerClose.start);
    const tooltip = /<span\b(?=[^>]*\bclass="[^"]*\btooltip\b[^"]*")[^>]*>/i.exec(markerInner);
    if (!tooltip) {
      markers.lastIndex = markerClose.end;
      continue;
    }
    const tooltipOpenStart = markers.lastIndex + tooltip.index;
    const tooltipOpenEnd = tooltipOpenStart + tooltip[0].length;
    const tooltipClose = matchingSpanClose(html, tooltipOpenStart);
    assert(tooltipClose && tooltipClose.end <= markerClose.end, `unclosed tooltip at ${tooltipOpenStart}`);
    const direct = html.slice(markers.lastIndex, tooltipOpenStart).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const number = direct.match(/^\d+$/)?.[0] || '';
    result.push({
      number,
      contentStart: tooltipOpenEnd,
      contentEnd: tooltipClose.start,
      content: html.slice(tooltipOpenEnd, tooltipClose.start),
    });
    markers.lastIndex = markerClose.end;
  }
  return result;
}

function unwrapInteractive(content) {
  let output = content;
  output = output.replace(/<button\b[^>]*>([\s\S]*?)<\/button>/gi, '$1');
  output = output.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');
  output = output.replace(/\s+(?:data-ref|tabindex)\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
  output = output.replace(/\s+role\s*=\s*(?:"button"|'button')/gi, '');
  output = output.replace(/\s+class\s*=\s*(["'])([^"']*)\1/gi, (whole, quote, classes) => {
    const kept = classes.split(/\s+/).filter(Boolean).filter((name) => name !== 'bref');
    return kept.length ? ` class=${quote}${kept.join(' ')}${quote}` : '';
  });
  return output;
}

let source = fs.readFileSync(SOURCE, 'utf8');
const beforeFootnotes = collectFootnotes(source);
const affected = beforeFootnotes.filter((item) => FORBIDDEN.test(item.content));
assert.deepStrictEqual(
  affected.map((item) => item.number).sort((a, b) => Number(a) - Number(b)),
  EXPECTED.slice().sort((a, b) => Number(a) - Number(b)),
);
const beforeOrdinary = (source.match(/<button\b(?=[^>]*\bclass="[^"]*\bbref\b[^"]*")(?=[^>]*\bdata-ref=)[^>]*>/gi) || []).length;
assert(beforeOrdinary > 20, `expected ordinary Scripture controls before repair, got ${beforeOrdinary}`);

for (const item of affected.slice().sort((a, b) => b.contentStart - a.contentStart)) {
  const replacement = unwrapInteractive(item.content);
  assert(!FORBIDDEN.test(replacement), `footnote ${item.number}: interactive descendant survived transform`);
  source = source.slice(0, item.contentStart) + replacement + source.slice(item.contentEnd);
}

const afterFootnotes = collectFootnotes(source);
const afterAffected = afterFootnotes.filter((item) => FORBIDDEN.test(item.content));
assert.strictEqual(afterAffected.length, 0, `interactive footnotes remain: ${afterAffected.map((item) => item.number).join(', ')}`);
for (const number of EXPECTED) assert(afterFootnotes.some((item) => item.number === number), `footnote ${number} disappeared`);
const afterOrdinary = (source.match(/<button\b(?=[^>]*\bclass="[^"]*\bbref\b[^"]*")(?=[^>]*\bdata-ref=)[^>]*>/gi) || []).length;
assert(afterOrdinary > 20 && afterOrdinary < beforeOrdinary, `ordinary Scripture control floor changed unexpectedly: ${beforeOrdinary} -> ${afterOrdinary}`);
fs.writeFileSync(SOURCE, source);

let staticAudit = fs.readFileSync(STATIC_AUDIT, 'utf8');
staticAudit = replaceOnce(
  staticAudit,
  "const RETIRED_PREVIEW_REL = 'dev/article-mdx-pilot/index.html';\n",
  "const RETIRED_PREVIEW_REL = 'dev/article-mdx-pilot/index.html';\nconst HERMENEUTIKA_ROUTE = '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';\nconst HERMENEUTIKA_SOURCE_REL = 'src/components/article-pilots/hermenevtika/HermenevtikaBody.astro';\nconst HERMENEUTIKA_STATIC_FOOTNOTES = ['40', '72', '75', '82', '83', '107'];\n",
  'article audit constants',
);
const helperAnchor = "function bodyHtml(html) {\n  return html.match(/<body\\b[^>]*>([\\s\\S]*?)<\\/body>/i)?.[1] || html;\n}\n";
const helperCode = `${helperAnchor}
function matchingSpanClose(html, openStart) {
  const tags = /<\/?span\b[^>]*>/gi;
  tags.lastIndex = openStart;
  let depth = 0;
  for (let match; (match = tags.exec(html));) {
    if (/^<\/span/i.test(match[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) return { start: match.index, end: tags.lastIndex };
  }
  return null;
}

function footnoteTooltips(html) {
  const result = [];
  const markers = /<span\b(?=[^>]*\bclass=["'][^"']*\bfn-marker\b[^"']*["'])[^>]*>/gi;
  for (let marker; (marker = markers.exec(html));) {
    const markerClose = matchingSpanClose(html, marker.index);
    if (!markerClose) break;
    const markerInner = html.slice(markers.lastIndex, markerClose.start);
    const tooltip = /<span\b(?=[^>]*\bclass=["'][^"']*\btooltip\b[^"']*["'])[^>]*>/i.exec(markerInner);
    if (!tooltip) { markers.lastIndex = markerClose.end; continue; }
    const tooltipOpenStart = markers.lastIndex + tooltip.index;
    const tooltipOpenEnd = tooltipOpenStart + tooltip[0].length;
    const tooltipClose = matchingSpanClose(html, tooltipOpenStart);
    if (!tooltipClose || tooltipClose.end > markerClose.end) break;
    const direct = html.slice(markers.lastIndex, tooltipOpenStart).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    result.push({
      number: direct.match(/^\d+$/)?.[0] || '',
      content: html.slice(tooltipOpenEnd, tooltipClose.start),
    });
    markers.lastIndex = markerClose.end;
  }
  return result;
}

function assertHermenevtikaFootnotes(label, html) {
  const tooltips = footnoteTooltips(html);
  const byNumber = new Set(tooltips.map((item) => item.number));
  for (const number of HERMENEUTIKA_STATIC_FOOTNOTES) {
    if (!byNumber.has(number)) bad(`${label}: footnote ${number} missing from native contract`);
  }
  const forbidden = /<(?:button|a)\b|\bdata-ref\s*=|\btabindex\s*=|\brole\s*=\s*["']button["']|\bclass\s*=\s*["'][^"']*\bbref\b/i;
  const interactive = tooltips.filter((item) => forbidden.test(item.content)).map((item) => item.number || '(unnumbered)');
  if (interactive.length) bad(`${label}: interactive descendants inside footnotes ${interactive.join(', ')}`);
  else ok(`${label}: footnote tooltip descendants are static`);
  const ordinaryScripture = (html.match(/<button\b(?=[^>]*\bclass=["'][^"']*\bbref\b[^"']*["'])(?=[^>]*\bdata-ref=)[^>]*>/gi) || []).length;
  if (ordinaryScripture < 20) bad(`${label}: ordinary Scripture controls unexpectedly missing (${ordinaryScripture})`);
  else ok(`${label}: ordinary Scripture controls remain active (${ordinaryScripture})`);
}

function auditHermenevtikaSource() {
  const sourcePath = path.join(ROOT, HERMENEUTIKA_SOURCE_REL);
  if (!fs.existsSync(sourcePath)) { bad(`Hermenevtika source missing: ${HERMENEUTIKA_SOURCE_REL}`); return; }
  assertHermenevtikaFootnotes('hermenevtika source', fs.readFileSync(sourcePath, 'utf8'));
}
`;
staticAudit = replaceOnce(staticAudit, helperAnchor, helperCode, 'article audit helpers');
staticAudit = replaceOnce(
  staticAudit,
  "  const html = fs.readFileSync(distPath, 'utf8');\n",
  "  const html = fs.readFileSync(distPath, 'utf8');\n  if (route === HERMENEUTIKA_ROUTE) assertHermenevtikaFootnotes('hermenevtika dist', html);\n",
  'article dist assertion',
);
staticAudit = replaceOnce(
  staticAudit,
  "  console.log('Legacy HTML and MDX references are migration evidence, not current production truth.');\n\n  runBuild();\n",
  "  console.log('Legacy HTML and MDX references are migration evidence, not current production truth.');\n\n  auditHermenevtikaSource();\n  runBuild();\n",
  'article source assertion call',
);
fs.writeFileSync(STATIC_AUDIT, staticAudit);

let browserAudit = fs.readFileSync(BROWSER_AUDIT, 'utf8');
browserAudit = replaceOnce(
  browserAudit,
  "const MEDIA_URLS = [\n  '/articles/dzhon-gill-chast-1-chelovek/',\n  '/articles/krajne-li-isporcheno-serdce/',\n];\n",
  "const MEDIA_URLS = [\n  '/articles/dzhon-gill-chast-1-chelovek/',\n  '/articles/krajne-li-isporcheno-serdce/',\n];\nconst HERMENEUTIKA_URL = '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';\nconst HERMENEUTIKA_STATIC_FOOTNOTES = ['40', '72', '75', '82', '83', '107'];\n",
  'interactive audit constants',
);
browserAudit = replaceOnce(
  browserAudit,
  "const stats = { pages: 0, series: 0, quizzes: 0, glossary: 0, theme: 0, search: 0, media: 0 };",
  "const stats = { pages: 0, series: 0, quizzes: 0, glossary: 0, footnotes: 0, theme: 0, search: 0, media: 0 };",
  'interactive audit stats',
);
const browserAnchor = "async function visibleThemeHandle(page) {\n";
const browserHelper = `async function checkHermenevtikaFootnotes(browser) {
  const desktop = await openPage(browser, HERMENEUTIKA_URL, { width: 1280, height: 850 });
  const staticState = await desktop.evaluate((expected) => {
    function numberOf(marker) {
      return Array.from(marker.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent || '').join('').replace(/\s+/g, '').trim();
    }
    const markers = Array.from(document.querySelectorAll('.fn-marker'));
    const found = {};
    for (const marker of markers) {
      const number = numberOf(marker);
      if (!expected.includes(number)) continue;
      marker.dataset.auditFootnote = number;
      const tip = marker.querySelector('.tooltip');
      found[number] = {
        tooltip: !!tip,
        nestedInteractive: tip ? tip.querySelectorAll('button, a, [tabindex], [role="button"], .bref, [data-ref]').length : -1,
      };
    }
    return {
      found,
      nestedInteractive: document.querySelectorAll('.fn-marker .tooltip button, .fn-marker .tooltip a, .fn-marker .tooltip [tabindex], .fn-marker .tooltip [role="button"], .fn-marker .tooltip .bref, .fn-marker .tooltip [data-ref]').length,
      ordinaryScripture: document.querySelectorAll('article .bref[data-ref]').length,
    };
  }, HERMENEUTIKA_STATIC_FOOTNOTES);
  for (const number of HERMENEUTIKA_STATIC_FOOTNOTES) {
    if (!staticState.found[number]?.tooltip || staticState.found[number]?.nestedInteractive !== 0) push('hermenevtika-static-footnote-contract', HERMENEUTIKA_URL, { number, state: staticState.found[number] || null });
  }
  if (staticState.nestedInteractive !== 0) push('hermenevtika-nested-footnote-interactive', HERMENEUTIKA_URL, staticState);
  if (staticState.ordinaryScripture < 20) push('hermenevtika-ordinary-scripture-missing', HERMENEUTIKA_URL, staticState);

  const hoverMarker = desktop.locator('[data-audit-footnote="40"]');
  await hoverMarker.scrollIntoViewIfNeeded();
  await hoverMarker.hover({ force: true });
  await desktop.waitForTimeout(250);
  let openState = await desktop.evaluate(() => ({
    markerOpen: document.querySelector('[data-audit-footnote="40"]')?.getAttribute('aria-expanded') === 'true',
    tipOpen: !!document.querySelector('.gb-floating-tip.is-open'),
  }));
  if (!openState.markerOpen || !openState.tipOpen) push('hermenevtika-footnote-hover-open-failed', HERMENEUTIKA_URL, openState);
  if (openState.tipOpen) {
    await desktop.locator('.gb-floating-tip.is-open').hover({ force: true });
    await desktop.waitForTimeout(180);
    openState = await desktop.evaluate(() => ({
      markerOpen: document.querySelector('[data-audit-footnote="40"]')?.getAttribute('aria-expanded') === 'true',
      tipOpen: !!document.querySelector('.gb-floating-tip.is-open'),
    }));
    if (!openState.markerOpen || !openState.tipOpen) push('hermenevtika-footnote-hover-content-closed-parent', HERMENEUTIKA_URL, openState);
  }
  await desktop.keyboard.press('Escape');
  await desktop.locator('[data-audit-footnote="72"]').focus();
  await desktop.waitForTimeout(220);
  const keyboardState = await desktop.evaluate(() => ({
    markerOpen: document.querySelector('[data-audit-footnote="72"]')?.getAttribute('aria-expanded') === 'true',
    tipOpen: !!document.querySelector('.gb-floating-tip.is-open'),
    nestedFocusable: document.querySelectorAll('.gb-floating-tip.is-open button, .gb-floating-tip.is-open a, .gb-floating-tip.is-open [tabindex], .gb-floating-tip.is-open [role="button"]').length,
  }));
  if (!keyboardState.markerOpen || !keyboardState.tipOpen || keyboardState.nestedFocusable !== 0) push('hermenevtika-footnote-keyboard-contract', HERMENEUTIKA_URL, keyboardState);
  await desktop.keyboard.press('Escape');

  const ordinary = desktop.locator('article .bref[data-ref]').first();
  await ordinary.scrollIntoViewIfNeeded();
  await ordinary.click({ force: true });
  await desktop.waitForTimeout(220);
  const ordinaryState = await desktop.evaluate(() => ({
    tipOpen: !!document.querySelector('.gb-floating-tip.is-open'),
    expandedScripture: !!document.querySelector('article .bref[data-ref][aria-expanded="true"]'),
  }));
  if (!ordinaryState.tipOpen || !ordinaryState.expandedScripture) push('hermenevtika-ordinary-scripture-tooltip-broken', HERMENEUTIKA_URL, ordinaryState);
  await desktop.keyboard.press('Escape');
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const resp = await mobile.goto(BASE + HERMENEUTIKA_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await mobile.waitForTimeout(900);
  stats.pages++;
  if (!resp || !resp.ok()) push('hermenevtika-mobile-status', HERMENEUTIKA_URL, resp ? resp.status() : 'null response');
  await mobile.evaluate((expected) => {
    for (const marker of document.querySelectorAll('.fn-marker')) {
      const number = Array.from(marker.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent || '').join('').replace(/\s+/g, '').trim();
      if (expected.includes(number)) marker.dataset.auditFootnote = number;
    }
  }, HERMENEUTIKA_STATIC_FOOTNOTES);
  const mobileMarker = mobile.locator('[data-audit-footnote="75"]');
  await mobileMarker.scrollIntoViewIfNeeded();
  await mobileMarker.tap();
  await mobile.waitForTimeout(300);
  const mobileState = await mobile.evaluate(() => ({
    markerOpen: document.querySelector('[data-audit-footnote="75"]')?.getAttribute('aria-expanded') === 'true',
    tipOpen: !!document.querySelector('.gb-floating-tip.is-open'),
    nestedInteractive: document.querySelectorAll('.gb-floating-tip.is-open button, .gb-floating-tip.is-open a, .gb-floating-tip.is-open [tabindex], .gb-floating-tip.is-open [role="button"], .gb-floating-tip.is-open .bref, .gb-floating-tip.is-open [data-ref]').length,
    scrollLocked: document.documentElement.dataset.scrollLocked === '1' || document.body.style.position === 'fixed' || document.documentElement.style.overflow === 'hidden',
  }));
  if (!mobileState.markerOpen || !mobileState.tipOpen || mobileState.nestedInteractive !== 0 || !mobileState.scrollLocked) push('hermenevtika-mobile-footnote-sheet-contract', HERMENEUTIKA_URL, mobileState);
  await mobile.keyboard.press('Escape');
  await mobile.waitForTimeout(250);
  const mobileClosed = await mobile.evaluate(() => ({
    tipOpen: !!document.querySelector('.gb-floating-tip.is-open'),
    scrollLocked: document.documentElement.dataset.scrollLocked === '1' || document.body.style.position === 'fixed' || document.documentElement.style.overflow === 'hidden',
  }));
  if (mobileClosed.tipOpen || mobileClosed.scrollLocked) push('hermenevtika-mobile-footnote-sheet-did-not-close', HERMENEUTIKA_URL, mobileClosed);
  await mobile.close();
  stats.footnotes++;
}

${browserAnchor}`;
browserAudit = replaceOnce(browserAudit, browserAnchor, browserHelper, 'interactive footnote test');
browserAudit = replaceOnce(
  browserAudit,
  "    await checkGlossary(browser);\n    await checkMobileTheme(browser);\n",
  "    await checkGlossary(browser);\n    await checkHermenevtikaFootnotes(browser);\n    await checkMobileTheme(browser);\n",
  'interactive footnote call',
);
browserAudit = replaceOnce(
  browserAudit,
  "  console.log(`Pages: ${stats.pages} · series: ${stats.series} · quizzes: ${stats.quizzes} · glossary: ${stats.glossary} · theme: ${stats.theme} · search: ${stats.search} · media: ${stats.media}`);",
  "  console.log(`Pages: ${stats.pages} · series: ${stats.series} · quizzes: ${stats.quizzes} · glossary: ${stats.glossary} · footnotes: ${stats.footnotes} · theme: ${stats.theme} · search: ${stats.search} · media: ${stats.media}`);",
  'interactive summary',
);
fs.writeFileSync(BROWSER_AUDIT, browserAudit);

console.log(`Materialized ${affected.length} static footnotes; ordinary Scripture controls ${beforeOrdinary} -> ${afterOrdinary}.`);
