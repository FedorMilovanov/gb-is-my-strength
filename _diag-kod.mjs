import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const REPO = '/home/user/gb-is-my-strength';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function settle(p) {
  await p.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach(i => i.loading = 'eager');
    const st = document.createElement('style');
    st.textContent = '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;}';
    document.head.appendChild(st);
    await Promise.all(Array.from(document.images).map(i =>
      (i.complete && i.naturalWidth) ? Promise.resolve() : new Promise(r => { i.onload = i.onerror = r; })
    ));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  });
  await p.evaluate(async () => {
    let last = -1;
    for (let i = 0; i < 80; i++) {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 90));
      if (document.body.scrollHeight === last) break;
      last = document.body.scrollHeight;
    }
    window.scrollTo(0, 0);
  });
  await sleep(700);
}

async function shotStitched(page, vp) {
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const vpH = vp.height, w = vp.width;
  const strips = [];
  for (let y = 0; y < total; y += vpH) {
    const scrollY = Math.min(y, Math.max(0, total - vpH));
    await page.evaluate(yy => window.scrollTo(0, yy), scrollY);
    await sleep(150);
    const buf = await page.screenshot();
    strips.push({ png: PNG.sync.read(buf), y });
  }
  const out = new PNG({ width: w, height: total });
  for (const s of strips) {
    const h = Math.min(s.png.height, total - s.y);
    PNG.bitblt(s.png, out, 0, 0, w, h, 0, s.y);
  }
  return out;
}

async function capture(b, url, vp) {
  const page = await b.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, colorScheme: 'light' });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await settle(page);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await settle(page);
  const png = await shotStitched(page, vp);
  await page.close();
  return png;
}

async function wait(u, t = 90000) {
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
  const res = {};
  const outDir = REPO + '/reports/visual-parity/kod-da-vinchi';
  mkdirSync(outDir, { recursive: true });

  for (const vp of [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'mobile', width: 390, height: 844 }
  ]) {
    console.log(`\n=== ${vp.name.toUpperCase()} (${vp.width}x${vp.height}) ===`);
    const l = await capture(b, 'http://localhost:8080/articles/kod-da-vinchi/', vp);
    const d = await capture(b, 'http://localhost:4321/articles/kod-da-vinchi/', vp);
    const w = Math.min(l.width, d.width), h = Math.min(l.height, d.height);
    const lc = new PNG({ width: w, height: h });
    PNG.bitblt(l, lc, 0, 0, w, h, 0, 0);
    const dc = new PNG({ width: w, height: h });
    PNG.bitblt(d, dc, 0, 0, w, h, 0, 0);
    const diff = new PNG({ width: w, height: h });
    const px = pixelmatch(lc.data, dc.data, diff.data, w, h, { threshold: 0.1 });
    const pct = +((px / (w * h)) * 100).toFixed(4);
    res[vp.name] = { pct, px, legacy: `${l.width}x${l.height}`, dist: `${d.width}x${d.height}`, dH: d.height - l.height };
    console.log(`kod-${vp.name}: ${pct}% (${px} px) | legacy ${l.width}x${l.height} dist ${d.width}x${d.height} (ΔH ${d.height - l.height})`);

    // Y-distribution analysis
    const bucket = 2000;
    const counts = {};
    let totalDiff = 0;
    for (let y = 0; y < h; y++) {
      const bIdx = Math.floor(y / bucket);
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (diff.data[i] > 0 || diff.data[i + 1] > 0 || diff.data[i + 2] > 0) {
          counts[bIdx] = (counts[bIdx] || 0) + 1;
          totalDiff++;
        }
      }
    }
    console.log(`Y-distribution (per ${bucket}px band):`);
    const bands = Object.keys(counts).map(Number).sort((a, b) => a - b);
    const maxBand = bands.length > 0 ? Math.max(...bands.map(b => counts[b])) : 1;
    for (const bIdx of bands) {
      const bandPx = counts[bIdx];
      const bar = '█'.repeat(Math.min(40, Math.round((bandPx / maxBand) * 40)));
      console.log(`  Y[${(bIdx * bucket).toString().padStart(5)}-${(bIdx * bucket + bucket).toString().padStart(5)}]: ${bandPx.toString().padStart(7)} px  ${bar}`);
    }
    writeFileSync(`${outDir}/diff-${vp.name}.png`, PNG.sync.write(diff));
  }

  await b.close();
  writeFileSync(`${outDir}/report.json`, JSON.stringify(res, null, 2));
  console.log('\n✅ Done. Report:', `${outDir}/report.json`);
} finally {
  procs.forEach(p => { try { p.kill('SIGTERM'); } catch {} });
}
