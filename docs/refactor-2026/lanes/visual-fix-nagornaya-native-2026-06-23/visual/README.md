# Visual artifacts — Nagornaya native lane

Generated on 2026-06-23 by Playwright + pixelmatch:

```bash
npm run astro:build
node scripts/copy-legacy-to-dist.js --omit-build-only
node scripts/visual-parity-screenshots.js \
  --routes /nagornaya/,/nagornaya/chast-1/,/nagornaya/chast-2/,/nagornaya/chast-3/,/nagornaya/chast-4/,/nagornaya/chast-5/,/nagornaya/seriya/,/nagornaya/istochniki/,/nagornaya/nakhodki/ \
  --threshold 0 \
  --out reports/visual-parity/nagornaya-native-all3-1782226267
```

Result: 9 routes × 2 viewports = 18/18 exact, `mismatchedPixels: 0`, `diffPct: 0`, legacy/dist dimensions equal.
