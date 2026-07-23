#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const file = path.resolve(__dirname, 'tooltip-marker-browser-test.js');
const write = process.argv.includes('--write');
const source = fs.readFileSync(file, 'utf8');
const before = `    await page.click('#numbered');
    const numberedOpen = await page.evaluate(() => ({
      expanded: document.querySelector('#numbered').getAttribute('aria-expanded'),
      hasDove: Boolean(document.querySelector('#numbered .fn-dove-icon')),
      visibleNumber: Array.from(document.querySelector('#numbered').childNodes).find((node) => node.nodeType === Node.TEXT_NODE)?.textContent.trim()
    }));
    assert.equal(numberedOpen.expanded, 'true', 'numbered source must still open through a real click');`;
const after = `    const target = await page.evaluate(() => {
      const anchor = document.querySelector('#numbered');
      const rect = anchor.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    await page.mouse.move(target.x, target.y);
    await page.waitForTimeout(80);
    const hit = await page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      const anchor = document.querySelector('#numbered');
      const tip = document.querySelector('body > .tooltip.gb-floating-tip.is-open, body > .gtip.gb-floating-tip.is-open');
      return {
        reachesAnchor: Boolean(element && (element === anchor || anchor.contains(element))),
        hitId: element?.id || '',
        hitClass: typeof element?.className === 'string' ? element.className : '',
        tipPointerEvents: tip ? getComputedStyle(tip).pointerEvents : 'absent'
      };
    }, target);
    console.log(\`desktop hit target before click: \${JSON.stringify(hit)}\`);
    assert.equal(hit.tipPointerEvents, 'none', 'hover-open floating surface must remain pointer transparent');
    assert.equal(hit.reachesAnchor, true, \`elementFromPoint must reach #numbered, got \${hit.hitId || hit.hitClass || 'unknown'}\`);
    await page.mouse.down();
    await page.mouse.up();
    const numberedOpen = await page.evaluate(() => ({
      expanded: document.querySelector('#numbered').getAttribute('aria-expanded'),
      hasDove: Boolean(document.querySelector('#numbered .fn-dove-icon')),
      visibleNumber: Array.from(document.querySelector('#numbered').childNodes).find((node) => node.nodeType === Node.TEXT_NODE)?.textContent.trim()
    }));
    assert.equal(numberedOpen.expanded, 'true', 'numbered source must still open through a real browser click');`;

if (source.includes(after)) {
  console.log('Tooltip hit-test fixture is already canonical.');
  process.exit(0);
}
if (!source.includes(before)) throw new Error('Expected locator.click fixture block not found.');
if (!write) {
  console.error('Tooltip hit-test fixture requires normalization.');
  process.exit(1);
}
fs.writeFileSync(file, source.replace(before, after));
console.log('Tooltip hit-test fixture normalized.');
