// Read the rendered list and follow its buttons, without injecting reference data.
import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const base = process.env.READER_URL || 'http://127.0.0.1:19076',
  route =
    process.env.ARTICLE ||
    '/articles/dzhon-gill-chast-2-uchenyi/#part-controversy';
try {
  const p = await b.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  p.setDefaultTimeout(6500);
  async function open() {
    await p.goto('about:blank');
    await p.goto(new URL(route, base).href);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(450);
    await p.locator('#mobPartTocBtn').tap();
    await p.locator('#gbrMarginaliaTab').tap();
    await p
      .locator('.gbr-marginalia-group-head')
      .filter({ hasText: 'Писание' })
      .tap();
  }
  await open();
  const inventory = await p.evaluate(() => {
    const projection = window.SCRIPTURE_DATA || {},
      sources = window.SCRIPTURE_SOURCE_BY_REF || {},
      norm = (s) =>
        s
          .replace(/[\u00a0\u202f]/g, ' ')
          .replace(/[\u2012-\u2015]/g, '-')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
    return {
      projectionKeys: Object.keys(projection).length,
      scope: document.querySelector('.gbr-scripture-entries')
        .previousElementSibling.textContent,
      entries: [...document.querySelectorAll('.gbr-scripture-entry')].map(
        (e) => {
          const label = e.querySelector('summary').textContent,
            key = Object.keys(projection).find((k) => norm(k) === norm(label)),
            verse = e.querySelector('.gbr-scripture-text')?.textContent,
            credit = e.querySelector('.gbr-scripture-source')?.textContent;
          return {
            label,
            count: e.querySelectorAll('button').length,
            hasText: !!verse,
            matched: verse === projection[key] && credit === sources[key],
            fallback: !!e.querySelector('.gbr-scripture-unavailable'),
          };
        },
      ),
    };
  });
  console.log(JSON.stringify({ route, ...inventory }));
  assert.ok(inventory.entries.length);
  assert.ok(
    inventory.entries.every((e) => e.matched && e.hasText !== e.fallback),
  );
  const sample = [
    ...new Set(
      [
        inventory.entries[0],
        inventory.entries.find((e) => e.hasText),
        inventory.entries.find((e) => e.fallback),
        inventory.entries.find((e) => e.count > 1),
      ].filter(Boolean),
    ),
  ];
  for (const entry of sample) {
    const ids = new Set();
    for (let idx = 0; idx < entry.count; idx++) {
      await open();
      const row = p
        .locator('.gbr-scripture-entry')
        .filter({ has: p.getByText(entry.label, { exact: true }) });
      await row.locator('summary').tap();
      await row.locator('button').nth(idx).tap();
      await p.waitForTimeout(1000);
      const early = await p.evaluate(() =>
        Math.round(document.activeElement.getBoundingClientRect().top),
      );
      await p.waitForTimeout(1450);
      const landed = await p.evaluate(() => {
        const e = document.activeElement,
          cl = e.cloneNode(true);
        cl.querySelectorAll(
          '.gtip,.btip,.fn-marker,[hidden],[inert],[aria-hidden=true]',
        ).forEach((n) => n.remove());
        return {
          id: e.id,
          tag: e.tagName,
          text: cl.textContent.replace(/\s+/g, ' ').trim().slice(0, 1800),
          displayed: e.checkVisibility(),
          top: Math.round(e.getBoundingClientRect().top),
          sheet: document
            .querySelector('#partTocOverlay')
            .classList.contains('is-open'),
        };
      });
      const ok =
        landed.displayed &&
        !landed.sheet &&
        landed.top >= 0 &&
        landed.top < 844 &&
        landed.text.includes(entry.label) &&
        !ids.has(landed.id);
      console.log(
        JSON.stringify({ label: entry.label, idx, early, ...landed, ok }),
      );
      ids.add(landed.id);
      if (!ok) process.exitCode = 1;
    }
  }
} finally {
  await b.close();
}
