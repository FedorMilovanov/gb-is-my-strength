import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173';
const outDir = path.resolve('reports/gill-image-premium-audit');

const routes = [
  ['context', '/articles/dzhon-gill-istoricheskiy-kontekst/'],
  ['part1', '/articles/dzhon-gill-chast-1-chelovek/'],
  ['part2', '/articles/dzhon-gill-chast-2-uchenyi/'],
  ['part3', '/articles/dzhon-gill-chast-3-nasledie/'],
  ['reference', '/articles/dzhon-gill-spravochnik/'],
];

const viewports = [
  { name: 'mobile390', width: 390, height: 844, isMobile: true },
  { name: 'tablet768', width: 768, height: 1024, isMobile: false },
  { name: 'desktop1440', width: 1440, height: 1100, isMobile: false },
];

const safe = (value) => String(value || 'none')
  .normalize('NFKD')
  .replace(/[^a-zA-Z0-9_-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 64) || 'none';

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  routes: [],
};

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
  });

  await context.addInitScript(() => {
    localStorage.removeItem('theme');
    localStorage.removeItem('gb-theme');
  });

  for (const [slug, route] of routes) {
    const page = await context.newPage();
    await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173)/, (requestRoute) => requestRoute.abort());
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0.001ms !important;
          animation-delay: 0ms !important;
          transition-duration: 0.001ms !important;
          scroll-behavior: auto !important;
          caret-color: transparent !important;
        }
      `,
    });
    await page.waitForTimeout(700);

    const routeDir = path.join(outDir, `${slug}-${viewport.name}`);
    await fs.mkdir(routeDir, { recursive: true });

    await page.screenshot({
      path: path.join(routeDir, 'top.png'),
      fullPage: false,
    });

    const hero = page.locator('#gbs2Hero');
    if (await hero.count()) {
      await hero.scrollIntoViewIfNeeded();
      await page.waitForTimeout(80);
      await hero.screenshot({ path: path.join(routeDir, 'hero.png') });
    }

    if (viewport.width >= 1024) {
      const rail = page.locator('.gbs-rail');
      if (await rail.count()) {
        await rail.screenshot({ path: path.join(routeDir, 'rail.png') });
      }
      const current = page.locator('.gbs2-current');
      if (await current.count()) {
        await current.screenshot({ path: path.join(routeDir, 'rail-current-card.png') });
      }
    }

    const audit = await page.evaluate(() => {
      const rect = (element) => {
        if (!element) return null;
        const r = element.getBoundingClientRect();
        return {
          x: Number(r.x.toFixed(2)),
          y: Number(r.y.toFixed(2)),
          width: Number(r.width.toFixed(2)),
          height: Number(r.height.toFixed(2)),
          top: Number(r.top.toFixed(2)),
          right: Number(r.right.toFixed(2)),
          bottom: Number(r.bottom.toFixed(2)),
          left: Number(r.left.toFixed(2)),
        };
      };

      const parsePosition = (value) => {
        const tokens = String(value || '50% 50%').trim().split(/\s+/);
        const keyword = { left: 0, top: 0, center: 50, right: 100, bottom: 100 };
        const parse = (token, fallback) => {
          if (token in keyword) return keyword[token];
          const match = token.match(/^(-?[\d.]+)%$/);
          return match ? Number(match[1]) : fallback;
        };
        return [parse(tokens[0], 50), parse(tokens[1] || '50%', 50)];
      };

      const cropFor = (img) => {
        const styles = getComputedStyle(img);
        const r = img.getBoundingClientRect();
        const nw = img.naturalWidth || Number(img.getAttribute('width')) || 0;
        const nh = img.naturalHeight || Number(img.getAttribute('height')) || 0;
        if (!nw || !nh || !r.width || !r.height || styles.objectFit !== 'cover') {
          return { mode: styles.objectFit, cropPct: 0, cropX: 0, cropY: 0 };
        }
        const scale = Math.max(r.width / nw, r.height / nh);
        const visibleW = r.width / scale;
        const visibleH = r.height / scale;
        const cropX = Math.max(0, nw - visibleW);
        const cropY = Math.max(0, nh - visibleH);
        const [px, py] = parsePosition(styles.objectPosition);
        return {
          mode: styles.objectFit,
          cropPct: Number((((cropX * nh + cropY * nw - cropX * cropY) / (nw * nh)) * 100).toFixed(2)),
          cropX: Number(cropX.toFixed(2)),
          cropY: Number(cropY.toFixed(2)),
          cropLeft: Number((cropX * px / 100).toFixed(2)),
          cropRight: Number((cropX * (100 - px) / 100).toFixed(2)),
          cropTop: Number((cropY * py / 100).toFixed(2)),
          cropBottom: Number((cropY * (100 - py) / 100).toFixed(2)),
          positionX: px,
          positionY: py,
        };
      };

      const seen = new Set();
      const figures = Array.from(document.querySelectorAll('#main-content figure, main figure, .article-body figure'))
        .filter((figure) => {
          if (seen.has(figure)) return false;
          seen.add(figure);
          return Boolean(figure.querySelector('img'));
        })
        .map((figure, index) => {
          const img = figure.querySelector('img');
          const caption = figure.querySelector('figcaption');
          const fr = figure.getBoundingClientRect();
          const ir = img.getBoundingClientRect();
          const cr = caption?.getBoundingClientRect();
          const fs = getComputedStyle(figure);
          const is = getComputedStyle(img);
          const cs = caption ? getComputedStyle(caption) : null;
          const captionOverlapsImage = Boolean(cr && cr.top < ir.bottom - 1 && cr.bottom > ir.top + 1);
          const visibleBottomStrip = Math.max(0, fr.bottom - Math.max(ir.bottom, cr?.bottom || -Infinity));
          const warnings = [];
          const crop = cropFor(img);

          if (figure.id === 'gbs2Hero' && visibleBottomStrip > 1.5) warnings.push(`hero-bottom-strip:${visibleBottomStrip.toFixed(1)}px`);
          if (figure.id === 'gbs2Hero' && caption && !captionOverlapsImage) warnings.push('hero-caption-not-overlay');
          if (crop.cropPct > 26) warnings.push(`aggressive-cover-crop:${crop.cropPct}%`);
          if (crop.cropPct > 15 && is.objectPosition === '50% 50%') warnings.push('cropped-with-generic-center-focus');
          if (ir.width > document.documentElement.clientWidth + 1) warnings.push('horizontal-overflow');
          if (caption && Number.parseFloat(cs?.fontSize || '0') < 11) warnings.push('caption-small');

          return {
            index,
            id: figure.id || '',
            className: figure.className || '',
            img: {
              src: img.getAttribute('src'),
              currentSrc: img.currentSrc,
              alt: img.alt,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
              loading: img.loading,
              widthAttr: img.getAttribute('width'),
              heightAttr: img.getAttribute('height'),
              rect: rect(img),
              objectFit: is.objectFit,
              objectPosition: is.objectPosition,
              display: is.display,
              transform: is.transform,
            },
            figure: {
              rect: rect(figure),
              display: fs.display,
              overflow: fs.overflow,
              background: fs.backgroundColor,
              borderRadius: fs.borderRadius,
              padding: fs.padding,
            },
            caption: caption ? {
              text: caption.textContent?.trim().replace(/\s+/g, ' ') || '',
              rect: rect(caption),
              position: cs.position,
              background: cs.background,
              color: cs.color,
              padding: cs.padding,
              overlapsImage: captionOverlapsImage,
              gapFromImage: Number((cr.top - ir.bottom).toFixed(2)),
            } : null,
            crop,
            visibleBottomStrip: Number(visibleBottomStrip.toFixed(2)),
            warnings,
          };
        });

      const cover = document.querySelector('.gbs2-current-cover');
      const coverStyle = cover ? getComputedStyle(cover) : null;
      const currentCard = document.querySelector('.gbs2-current');

      return {
        viewport: {
          width: document.documentElement.clientWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
        },
        page: {
          title: document.title,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        },
        figures,
        railCurrent: currentCard ? {
          cardRect: rect(currentCard),
          coverRect: rect(cover),
          coverBackgroundImage: coverStyle?.backgroundImage || '',
          coverBackgroundSize: coverStyle?.backgroundSize || '',
          coverBackgroundPosition: coverStyle?.backgroundPosition || '',
          coverOpacity: coverStyle?.opacity || '',
        } : null,
      };
    });

    for (const figure of audit.figures) {
      const locator = page.locator('#main-content figure, main figure, .article-body figure').filter({ has: page.locator('img') }).nth(figure.index);
      try {
        await locator.scrollIntoViewIfNeeded();
        await page.waitForTimeout(50);
        const name = `${String(figure.index).padStart(2, '0')}-${safe(figure.id || figure.className)}.png`;
        await locator.screenshot({ path: path.join(routeDir, name) });
      } catch (error) {
        figure.screenshotError = String(error?.message || error);
      }
    }

    await fs.writeFile(path.join(routeDir, 'audit.json'), JSON.stringify(audit, null, 2));
    report.routes.push({ slug, route, viewport: viewport.name, ...audit });
    await page.close();
  }

  await context.close();
}

await browser.close();

const warnings = report.routes.flatMap((entry) => entry.figures.flatMap((figure) =>
  figure.warnings.map((warning) => ({
    slug: entry.slug,
    viewport: entry.viewport,
    figure: figure.index,
    src: figure.img.src,
    warning,
  }))
));

report.warningCount = warnings.length;
report.warnings = warnings;
await fs.writeFile(path.join(outDir, 'audit-all.json'), JSON.stringify(report, null, 2));

const rows = warnings.length
  ? warnings.map((w) => `| ${w.slug} | ${w.viewport} | ${w.figure} | ${w.warning} | ${w.src} |`).join('\n')
  : '| — | — | — | No automatic warnings | — |';

await fs.writeFile(path.join(outDir, 'SUMMARY.md'), `# Gill image premium audit\n\nGenerated: ${report.generatedAt}\n\nAutomatic warnings: **${warnings.length}**\n\n| Route | Viewport | Figure | Warning | Source |\n|---|---|---:|---|---|\n${rows}\n`);

console.log(`Gill image audit complete: ${report.routes.length} route/viewports, ${warnings.length} warnings.`);
