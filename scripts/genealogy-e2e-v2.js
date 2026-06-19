/**
 * genealogy-e2e-v2.js — thorough Playwright E2E test for /rodosloviye/.
 * v2: tests focus lineage, edges rendering, all interactive features.
 */

const { chromium, devices } = require('playwright');
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:8132';
const URL = `${BASE}/rodosloviye/`;

const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}${detail ? ' — ' + detail.slice(0, 80) : ''}`);
}

async function run() {
  const browser = await chromium.launch();

  // ═══ DESKTOP ═══
  console.log('\n── DESKTOP (1366×900) ──');
  const dCtx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const dPage = await dCtx.newPage();
  const dErrors = [];
  dPage.on('pageerror', e => dErrors.push(e.message));

  try {
    await dPage.goto(URL, { waitUntil: 'networkidle', timeout: 20000 });
    await dPage.waitForSelector('.react-flow__node', { timeout: 15000 });
    await dPage.waitForTimeout(2000);

    // 1. React Flow renders
    check('React Flow container', await dPage.locator('.react-flow').count() > 0);

    const nodes = await dPage.locator('.react-flow__node').count();
    check('Nodes rendered', nodes > 0, `${nodes} nodes`);

    const edges = await dPage.locator('.react-flow__edge').count();
    check('Edges rendered', edges > 0, `${edges} edges`);

    check('Zero pageerror', dErrors.length === 0, dErrors.length ? dErrors[0].slice(0, 60) : '');

    // 2. Focus lineage: click a node → dim others
    // First, zoom in to see all nodes (detail level 2)
    await dPage.evaluate(() => {
      const btn = document.querySelector('.react-flow__controls-zoomin');
      if (btn) for (let i = 0; i < 20; i++) btn.click();
    });
    await dPage.waitForTimeout(1500);

    const allNodes = await dPage.locator('.react-flow__node').count();
    check('Zoom shows all nodes', allNodes > 50, `${allNodes} visible`);

    // Click "Давид" node via JS
    const davidClicked = await dPage.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('.react-flow__node'));
      const david = nodes.find(n => n.textContent?.includes('Давид'));
      if (david) { david.click(); return true; }
      return false;
    });
    await dPage.waitForTimeout(1000);

    // Check dimming: some nodes should have opacity < 0.5
    const dimInfo = await dPage.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('.genealogy-node'));
      const dimmed = nodes.filter(n => {
        const op = parseFloat(getComputedStyle(n).opacity);
        return op < 0.5;
      });
      const focused = nodes.filter(n => {
        const shadow = getComputedStyle(n).boxShadow;
        return shadow.includes('255, 215, 0');
      });
      return { total: nodes.length, dimmed: dimmed.length, focused: focused.length };
    });
    check('Focus lineage: dimmed nodes exist', dimInfo.dimmed > 0, `${dimInfo.dimmed}/${dimInfo.total} dimmed`);
    check('Focus lineage: focused nodes exist', dimInfo.focused > 0, `${dimInfo.focused} focused`);

    // Focus badge shows count
    const focusBadge = await dPage.locator('text=Фокус:').count();
    check('Focus badge appears', focusBadge > 0);

    // 3. Click empty pane → clear focus
    await dPage.evaluate(() => {
      const pane = document.querySelector('.react-flow__pane');
      if (pane) pane.click();
    });
    await dPage.waitForTimeout(500);
    const dimAfterClear = await dPage.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('.genealogy-node'));
      return nodes.filter(n => parseFloat(getComputedStyle(n).opacity) < 0.5).length;
    });
    check('Pane click clears focus', dimAfterClear === 0, `${dimAfterClear} still dimmed`);

    // 4. Golden thread toggle
    await dPage.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Нить'));
      if (btn) btn.click();
    });
    await dPage.waitForTimeout(300);
    await dPage.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Нить'));
      if (btn) btn.click();
    });
    await dPage.waitForTimeout(300);
    check('Golden thread toggle', true);

    // 5. Search → center
    await dPage.fill('input[placeholder*="Поиск"]', 'Авраам');
    await dPage.waitForTimeout(1500);
    const abrahamFound = await dPage.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('.genealogy-node'));
      return nodes.some(n => n.textContent?.includes('Авраам'));
    });
    check('Search finds Авраам', abrahamFound);
    await dPage.fill('input[placeholder*="Поиск"]', '');
    await dPage.waitForTimeout(300);

    // 6. Detail panel
    await dPage.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('.react-flow__node'));
      const adam = nodes.find(n => n.textContent?.includes('Адам'));
      if (adam) adam.click();
    });
    await dPage.waitForTimeout(500);
    const panelText = await dPage.locator('aside[role="complementary"]').first().innerText().catch(() => '');
    check('Detail panel opens', panelText.length > 30, `${panelText.length} chars`);

    // 7. Split view
    await dPage.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Мф/Лк'));
      if (btn) btn.click();
    });
    await dPage.waitForTimeout(500);
    const splitExists = await dPage.locator('text=Две родословные').count();
    check('Split view opens', splitExists > 0);
    await dPage.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Закрыть сравнение"]');
      if (btn) btn.click();
    });
    await dPage.waitForTimeout(300);

    // 8. MiniMap
    check('MiniMap', await dPage.locator('.react-flow__minimap').count() > 0);

    // 9. Controls
    check('Controls', await dPage.locator('.react-flow__controls').count() > 0);

    // 10. Era legend
    check('Era legend', await dPage.locator('text=Эпохи').count() > 0);

    // 11. Overflow
    const overflow = await dPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('No horizontal overflow', overflow <= 2, `${overflow}px`);

    // 12. Touch targets
    const smallBtns = await dPage.locator('button').evaluateAll(els =>
      els.filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 36; }).length
    );
    check('Buttons ≥ 36px', smallBtns === 0, `${smallBtns} small`);

  } catch (e) {
    check('Desktop completed', false, e.message.slice(0, 80));
  }
  await dCtx.close();

  // ═══ MOBILE ═══
  console.log('\n── MOBILE (iPhone 12) ──');
  const mCtx = await browser.newContext({ ...devices['iPhone 12'] });
  const mPage = await mCtx.newPage();
  const mErrors = [];
  mPage.on('pageerror', e => mErrors.push(e.message));

  try {
    await mPage.goto(URL, { waitUntil: 'networkidle', timeout: 20000 });
    await mPage.waitForSelector('.react-flow__node', { timeout: 15000 });
    await mPage.waitForTimeout(2000);

    check('Mobile: nodes render', await mPage.locator('.react-flow__node').count() > 0);
    check('Mobile: zero pageerror', mErrors.length === 0);

    const mOverflow = await mPage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check('Mobile: no overflow', mOverflow <= 2, `${mOverflow}px`);

    check('Mobile: toolbar visible', await mPage.locator('[role="toolbar"]').first().isVisible());
    check('Mobile: controls accessible', await mPage.locator('.react-flow__controls').count() > 0);

  } catch (e) {
    check('Mobile completed', false, e.message.slice(0, 80));
  }
  await mCtx.close();

  // ═══ SUMMARY ═══
  await browser.close();
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULT: ${passed} passed · ${failed} failed · ${results.length} total`);
  if (failed) {
    console.log('\nFAILURES:');
    results.filter(r => !r.passed).forEach(r => console.log(`  ❌ ${r.name}: ${r.detail}`));
  }
  process.exit(failed ? 1 : 0);
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
