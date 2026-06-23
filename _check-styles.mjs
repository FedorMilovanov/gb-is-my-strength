import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

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

async function getStyles(page) {
  return page.evaluate(() => {
    const els = [
      { sel: 'h1#articleH1', name: 'h1' },
      { sel: '.article-desc', name: 'desc' },
      { sel: 'p.drop-cap', name: 'drop-cap' },
      { sel: '.article-body', name: 'body' },
      { sel: 'h2#sec-intro', name: 'h2-intro' },
      { sel: '.breadcrumb__link', name: 'breadcrumb-link' },
      { sel: '.skip-link', name: 'skip-link' },
    ];
    const result = {};
    for (const {sel, name} of els) {
      const el = document.querySelector(sel);
      if (!el) { result[name] = 'NOT FOUND'; continue; }
      const cs = getComputedStyle(el);
      result[name] = {
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        wordSpacing: cs.wordSpacing,
        marginTop: cs.marginTop,
        marginBottom: cs.marginBottom,
        paddingTop: cs.paddingTop,
        paddingBottom: cs.paddingBottom,
        width: cs.width,
        color: cs.color,
      };
    }
    return result;
  });
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
    
    // Settle
    await page.evaluate(async () => {
      document.querySelectorAll('img[loading="lazy"]').forEach(i => i.loading = 'eager');
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
    });
    await sleep(500);
    
    const styles = await getStyles(page);
    console.log(`\n=== ${name} (${port}) ===`);
    console.log(JSON.stringify(styles, null, 2));
    
    await page.close();
  }
  
  await b.close();
} finally {
  procs.forEach(p => { try { p.kill('SIGTERM'); } catch {} });
}
