#!/usr/bin/env node
/**
 * Visual QA Agent — REAL bug finder using headless Chromium.
 * Every reported bug is backed by a screenshot in shots/.
 */
'use strict';

const fs = require('fs');
const path = require('path');

process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH ||
  path.join(process.env.HOME || process.cwd(), '.cache', 'ms-playwright');

const { chromium } = require('playwright');

const SHOTS = path.join(__dirname, '..', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const URLS = [
  '/',
  '/about/',
  '/articles/',
  '/articles/20-antisovetov-pastoru/',
  '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',
  '/articles/kod-da-vinchi/',
  '/articles/krajne-li-isporcheno-serdce/',
  '/nagornaya/',
  '/nagornaya/seriya/',
  '/nagornaya/chast-1/',
  '/nagornaya/chast-2/',
  '/nagornaya/chast-3/',
  '/nagornaya/chast-4/',
  '/nagornaya/chast-5/',
  '/pastor-series/',
  '/404.html',
];
const BASE = (process.env.AUDIT_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');

const VIEWPORTS = [
  { name: 'mobile',  width: 375,  height: 812 },
  { name: 'desktop', width: 1440, height: 900 },
];

const bugs = [];
const stats = { pages: 0, screenshots: 0, consoleErrors: 0, networkErrors: 0 };

function sanitize(s) {
  return s.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'root';
}

async function auditPage(browser, urlPath, vp) {
  const url = BASE + urlPath;
  const tag = `${sanitize(urlPath)}__${vp.name}`;
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    bypassCSP: true,
    userAgent:
      'Mozilla/5.0 (compatible; VisualAuditBot/1.0; +https://arena.ai/)',
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const networkErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // filter noise
      if (
        /favicon|net::ERR_FAILED.*\.ico|Failed to load resource:.*404.*\.ico/i.test(text)
      ) return;
      consoleErrors.push(text);
    }
  });
  page.on('pageerror', (err) => consoleErrors.push('PAGE_ERROR: ' + err.message));
  page.on('response', (resp) => {
    const s = resp.status();
    if (s >= 400 && s !== 304) {
      const u = resp.url();
      if (/favicon\.ico|apple-touch-icon/.test(u)) return;
      networkErrors.push(`${s} ${u}`);
    }
  });

  try {
    const resp = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    if (!resp || !resp.ok()) {
      bugs.push({
        severity: 'HIGH',
        page: urlPath,
        viewport: vp.name,
        kind: 'page-status',
        detail: `Response ${resp ? resp.status() : 'null'} for ${url}`,
      });
    }
    // wait for fonts/lazy content
    await page.waitForTimeout(2000);

    // ── CHECKS ───────────────────────────────────────────
    const findings = await page.evaluate(() => {
      const out = {
        hOverflow: null,
        brokenImgs: [],
        badText: [],
        ambientPhrases: 0,
        fcControlsH: null,
        bioCoverMissing: false,
        invisibleText: [],
        emptyHeadings: [],
        ariaIssues: [],
        bigImgs: [],
        offscreenLinks: [],
      };

      // horizontal overflow
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      if (docW - winW > 2) {
        // find the offending elements
        const offenders = [];
        document.querySelectorAll('body *').forEach((el) => {
          if (offenders.length >= 5) return;
          const r = el.getBoundingClientRect();
          if (r.right > winW + 2 && r.width < winW + 200 && r.width > 10) {
            const cs = getComputedStyle(el);
            if (cs.position === 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return;
            offenders.push({
              tag: el.tagName.toLowerCase(),
              id: el.id || '',
              cls: (el.className && el.className.toString && el.className.toString().slice(0, 80)) || '',
              right: Math.round(r.right),
              width: Math.round(r.width),
            });
          }
        });
        out.hOverflow = { docW, winW, offenders };
      }

      // broken images (loaded === false or naturalWidth === 0 once complete)
      document.querySelectorAll('img').forEach((img) => {
        if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) {
          out.brokenImgs.push({
            src: img.currentSrc || img.src,
            alt: img.alt || '',
          });
        }
        // catastrophically oversized
        if (img.naturalWidth > 3000 && img.getBoundingClientRect().width < 800) {
          out.bigImgs.push({
            src: (img.currentSrc || img.src).slice(0, 120),
            natural: img.naturalWidth,
            rendered: Math.round(img.getBoundingClientRect().width),
          });
        }
      });

      // bad text "undefined" / "NaN" / "[object Object]" in visible text
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const t = n.nodeValue;
        if (!t || t.trim().length < 3) continue;
        if (/\b(undefined|NaN|\[object Object\])\b/.test(t)) {
          const p = n.parentElement;
          if (!p) continue;
          const cs = getComputedStyle(p);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          out.badText.push({
            tag: p.tagName.toLowerCase(),
            sample: t.trim().slice(0, 120),
          });
          if (out.badText.length >= 5) break;
        }
      }

      // invisible text: same color as background, opacity 0, etc.
      function rgbToArr(s) {
        const m = s.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        return m[1].split(',').map((x) => parseFloat(x));
      }
      const SEEN = new WeakSet();
      document.querySelectorAll('h1,h2,h3,h4,p,a,li,span,button').forEach((el) => {
        if (out.invisibleText.length >= 5) return;
        if (SEEN.has(el)) return;
        SEEN.add(el);
        const txt = (el.innerText || '').trim();
        if (!txt || txt.length < 4) return;
        if (el.closest('[aria-hidden="true"]')) return;
        if (el.classList.contains('article-topnav-title') && !el.closest('.article-topnav.title-visible')) return;
        const r = el.getBoundingClientRect();
        if (r.width < 5 || r.height < 5) return;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        if (parseFloat(cs.opacity) === 0) {
          const cls = (el.className || '').toString();
          if (/\b(h-)?reveal\b/.test(cls) && (r.top > window.innerHeight || r.bottom < 0)) return;
          out.invisibleText.push({ tag: el.tagName.toLowerCase(), cls: cls.slice(0,60), why: 'opacity:0', txt: txt.slice(0,60) });
          return;
        }
        const c = rgbToArr(cs.color);
        // walk up to find effective bg; skip image/gradient-backed heroes because
        // this lightweight audit cannot model background images or pseudo overlays.
        let bg = null;
        let hasPaintedBackdrop = false;
        let cur = el;
        while (cur && cur !== document.documentElement) {
          const curStyle = getComputedStyle(cur);
          if (curStyle.backgroundImage && curStyle.backgroundImage !== 'none') {
            hasPaintedBackdrop = true;
            break;
          }
          const b = rgbToArr(curStyle.backgroundColor);
          if (b && (b[3] === undefined || b[3] > 0.5)) { bg = b; break; }
          cur = cur.parentElement;
        }
        if (hasPaintedBackdrop || !c || !bg) return;
        const dr = Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2]);
        if (dr < 30) {
          out.invisibleText.push({ tag: el.tagName.toLowerCase(), cls: (el.className||'').toString().slice(0,60), why: 'low-contrast', color: cs.color, bg: 'rgb('+bg.slice(0,3).join(',')+')', txt: txt.slice(0,60) });
        }
      });

      // empty headings
      document.querySelectorAll('h1,h2,h3').forEach((h) => {
        if (out.emptyHeadings.length >= 5) return;
        if (!(h.innerText || '').trim()) {
          const cs = getComputedStyle(h);
          if (cs.display === 'none') return;
          out.emptyHeadings.push({ tag: h.tagName.toLowerCase(), id: h.id || '' });
        }
      });

      // aria issues: links with no accessible name
      document.querySelectorAll('a').forEach((a) => {
        if (out.ariaIssues.length >= 5) return;
        const cs = getComputedStyle(a);
        const r = a.getBoundingClientRect();
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return;
        if (r.width < 2 || r.height < 2) return;
        const name = (a.innerText || a.getAttribute('aria-label') || a.getAttribute('title') || '').trim();
        if (!name) {
          const hasImg = a.querySelector('img[alt]');
          const hasSvg = a.querySelector('svg');
          if (!hasImg && !hasSvg) {
            out.ariaIssues.push({ href: (a.getAttribute('href')||'').slice(0,80), why: 'visible link has no accessible name' });
          }
        }
      });


      // ── REGRESSION GUARDS ─────────────────────────────
      // 1. Ambient phrases (home page only)
      const phrases = document.querySelectorAll('.h-phrase');
      out.ambientPhrases = phrases.length;
      
      // 2. FC controls height (must be compact pill, < 100px)
      const fc = document.getElementById('gbFloatingControls');
      if (fc) out.fcControlsH = Math.round(fc.getBoundingClientRect().height);
      
      // 3. bio-cover on gill chast-1 (only check if on that page)
      if (location.pathname.includes('dzhon-gill-chast-1')) {
        out.bioCoverMissing = !document.querySelector('.bio-cover');
      }

      return out;
    });

    // record findings
    if (findings.hOverflow) {
      bugs.push({
        severity: 'HIGH',
        page: urlPath,
        viewport: vp.name,
        kind: 'horizontal-overflow',
        detail: `docW=${findings.hOverflow.docW} > winW=${findings.hOverflow.winW}; offenders=${JSON.stringify(findings.hOverflow.offenders)}`,
      });
    }
    findings.brokenImgs.forEach((b) =>
      bugs.push({ severity: 'HIGH', page: urlPath, viewport: vp.name, kind: 'broken-image', detail: `src=${b.src} alt="${b.alt}"` })
    );
    findings.badText.forEach((b) =>
      bugs.push({ severity: 'HIGH', page: urlPath, viewport: vp.name, kind: 'bad-text', detail: `${b.tag}: ${b.sample}` })
    );
    // Regression guard bugs
    if (urlPath === '/' && findings.ambientPhrases === 0) {
      bugs.push({ severity: 'CRITICAL', page: urlPath, viewport: vp.name, kind: 'ambient-phrases-missing',
        detail: 'Home page ambient phrases (names of God) count = 0 — guard failed!' });
    }
    if (findings.fcControlsH !== null && findings.fcControlsH > 110) {
      bugs.push({ severity: 'HIGH', page: urlPath, viewport: vp.name, kind: 'fc-controls-too-tall',
        detail: `Floating controls height=${findings.fcControlsH}px, expected ≤ 110px (compact pill)` });
    }
    if (findings.bioCoverMissing) {
      bugs.push({ severity: 'HIGH', page: urlPath, viewport: vp.name, kind: 'bio-cover-missing',
        detail: 'bio-cover 16:9 block missing from Gill chast-1 article' });
    }
    findings.invisibleText.forEach((b) =>
      bugs.push({ severity: 'MEDIUM', page: urlPath, viewport: vp.name, kind: 'invisible-text', detail: JSON.stringify(b) })
    );
    findings.emptyHeadings.forEach((b) =>
      bugs.push({ severity: 'LOW', page: urlPath, viewport: vp.name, kind: 'empty-heading', detail: JSON.stringify(b) })
    );
    findings.ariaIssues.forEach((b) =>
      bugs.push({ severity: 'MEDIUM', page: urlPath, viewport: vp.name, kind: 'link-no-name', detail: JSON.stringify(b) })
    );
    findings.bigImgs.forEach((b) =>
      bugs.push({ severity: 'LOW', page: urlPath, viewport: vp.name, kind: 'oversized-image', detail: JSON.stringify(b) })
    );
    consoleErrors.forEach((e) => {
      stats.consoleErrors++;
      bugs.push({ severity: 'MEDIUM', page: urlPath, viewport: vp.name, kind: 'console-error', detail: e.slice(0, 240) });
    });
    networkErrors.forEach((e) => {
      stats.networkErrors++;
      bugs.push({ severity: 'MEDIUM', page: urlPath, viewport: vp.name, kind: 'network-error', detail: e.slice(0, 240) });
    });

    // screenshots: top, middle, bottom
    // Use CDP clipped screenshots instead of page.screenshot({ fullPage:false }).
    // Headless Chromium can return a blank viewport on long mobile documents after
    // programmatic scroll; clipping the document at the actual scrollY is reliable.
    const cdp = await ctx.newCDPSession(page);
    const positions = [0, 0.5, 1];
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      await page.evaluate((p) => {
        document.documentElement.style.scrollBehavior = 'auto';
        document.body.style.scrollBehavior = 'auto';
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const target = Math.max(0, max * p);
        window.scrollTo({ left: 0, top: target, behavior: 'instant' });
      }, pos);
      await page.waitForFunction((p) => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const target = Math.max(0, max * p);
        return Math.abs(window.scrollY - target) < 4;
      }, pos, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(250);
      const y = await page.evaluate(() => window.scrollY);
      const file = path.join(SHOTS, `${tag}__${i === 0 ? 'top' : i === 1 ? 'mid' : 'bot'}.png`);
      const shot = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: { x: 0, y, width: vp.width, height: vp.height, scale: 1 }
      });
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
      stats.screenshots++;
    }
  } catch (e) {
    console.error('AUDIT PAGE ERROR:', e);
    bugs.push({
      severity: 'HIGH',
      page: urlPath,
      viewport: vp.name,
      kind: 'crash',
      detail: e.message.slice(0, 300),
    });
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
    stats.pages++;
  }
}

(async () => {
  console.log(`Launching browser for ${URLS.length} pages × ${VIEWPORTS.length} viewports`);
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  for (const u of URLS) {
    for (const vp of VIEWPORTS) {
      process.stdout.write(`  ${vp.name.padEnd(7)} ${u} ... `);
      const t0 = Date.now();
      await auditPage(browser, u, vp);
      console.log(`${Date.now() - t0}ms`);
    }
  }

  await browser.close();

  // Suppress false-positives: any check that fires on >60% of (page,viewport) combos
  const totalCombos = URLS.length * VIEWPORTS.length;
  const byKind = {};
  bugs.forEach((b) => {
    byKind[b.kind] = (byKind[b.kind] || 0) + 1;
  });
  const suppressed = {};
  Object.entries(byKind).forEach(([k, n]) => {
    if (n / totalCombos > 0.6) suppressed[k] = n;
  });
  const filtered = bugs.filter((b) => !suppressed[b.kind]);

  const report = {
    generatedAt: new Date().toISOString(),
    stats,
    totals: { rawBugs: bugs.length, filteredBugs: filtered.length, suppressedKinds: suppressed },
    bugs: filtered.sort((a, b) => {
      const sev = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return sev[a.severity] - sev[b.severity] || a.page.localeCompare(b.page);
    }),
  };

  fs.writeFileSync(
    path.join(__dirname, '..', 'visual-audit-report.json'),
    JSON.stringify(report, null, 2)
  );
  console.log('\n========================================');
  console.log('VISUAL AUDIT COMPLETE');
  console.log('========================================');
  console.log('Pages audited:    ', stats.pages);
  console.log('Screenshots:      ', stats.screenshots);
  console.log('Console errors:   ', stats.consoleErrors);
  console.log('Network errors:   ', stats.networkErrors);
  console.log('Raw bugs:         ', bugs.length);
  console.log('After suppression:', filtered.length);
  console.log('Suppressed kinds: ', JSON.stringify(suppressed));
  console.log('Report:           visual-audit-report.json');
  console.log('Screenshots dir:  shots/');
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
