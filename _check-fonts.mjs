import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const REPO = '/home/user/gb-is-my-strength';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function wait(u, t = 60000) {
  const s = Date.now();
  while (Date.now() - s < t) {
    try { const r = await fetch(u); if (r.ok || r.status === 200 || r.status === 404) return; } catch {}
    await sleep(400);
  }
  throw new Error('timeout ' + u);
}

const procs = [];
try {
  procs.push(spawn('python3', ['-m', 'http.server', '8080'], { cwd: REPO, stdio: 'ignore' }));
  procs.push(spawn('npx', ['astro', 'preview', '--port', '4321'], { cwd: REPO, stdio: 'ignore' }));
  await wait('http://localhost:8080/articles/kod-da-vinchi/');
  await wait('http://localhost:4321/articles/kod-da-vinchi/');
  
  const b = await chromium.launch();
  
  for (const [name, port] of [['legacy', 8080], ['dist', 4321]]) {
    const page = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(`http://localhost:${port}/articles/kod-da-vinchi/`, { waitUntil: 'networkidle', timeout: 60000 });
    
    // Get computed font-family for body text
    const fonts = await page.evaluate(() => {
      const els = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, li, a, button, div');
      const fontSet = new Set();
      const fontCount = {};
      for (const el of els) {
        const style = window.getComputedStyle(el);
        const ff = style.fontFamily;
        const fs = style.fontSize;
        const key = `${ff} ${fs}`;
        fontCount[key] = (fontCount[key] || 0) + 1;
        fontSet.add(ff);
      }
      return { fonts: [...fontSet], count: fontCount };
    });
    
    console.log(`\n=== ${name} (${port}) ===`);
    console.log('Unique font-families:', fonts.fonts.length);
    fonts.fonts.slice(0, 10).forEach(f => console.log('  ', f));
    
    // Top 10 font+size combos
    const sorted = Object.entries(fonts.count).sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log('Top font+size combos:');
    sorted.forEach(([k, v]) => console.log(`  ${v}x: ${k}`));
    
    // Check if fonts are loaded
    const fontFaces = await page.evaluate(() => {
      return [...document.fonts].map(f => ({
        family: f.family,
        status: f.status,
        loaded: f.loaded
      }));
    });
    console.log('Font faces:');
    fontFaces.slice(0, 20).forEach(f => console.log(`  ${f.family}: ${f.status}`));
    
    // Check for font loading errors
    const fontErrors = await page.evaluate(() => {
      const errors = [];
      document.querySelectorAll('link[rel="preload"][as="font"]').forEach(link => {
        errors.push({ href: link.href, loaded: link.sheet !== null });
      });
      return errors;
    });
    console.log('Font preload links:', fontErrors);
    
    await page.close();
  }
  
  await b.close();
} finally {
  procs.forEach(p => { try { p.kill('SIGTERM'); } catch {} });
}
