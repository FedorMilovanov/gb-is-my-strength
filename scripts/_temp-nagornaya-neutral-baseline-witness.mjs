#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'https://gospod-bog.ru';
const out = process.env.EVIDENCE_DIR || 'reports/nagornaya-neutral-comparison';
const targets = [
  { path: '/nagornaya/chast-4/', slug: 'part-4-green', heading: 'Ipsissima Verba' },
  { path: '/nagornaya/chast-4/', slug: 'part-4-thomas', heading: 'Современные угрозы' },
  { path: '/nagornaya/chast-5/', slug: 'part-5-pastoral', heading: 'Пасторский баланс' },
];
const viewports = [
  { width: 390, height: 844, name: '390' },
  { width: 1440, height: 900, name: '1440' },
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const target of targets) {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const response = await page.goto(`${base}${target.path}?neutral-baseline=6c4106ae`, { waitUntil: 'networkidle' });
      if (!response?.ok()) throw new Error(`${target.path}: HTTP ${response?.status()}`);
      const heading = page.locator('h2').filter({ hasText: target.heading }).first();
      await heading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await page.screenshot({
        path: join(out, `before-${target.slug}-${viewport.name}.jpg`),
        type: 'jpeg',
        quality: 82,
      });
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log('Nagornaya neutral comparison baseline witness captured');
// synchronization trigger: event-safe Shared Files Guard proof job
