#!/usr/bin/env node
/**
 * Lot Print Diagram Microtext Contract (GBS-LOT-PRINT-DIAGRAM-MICROTEXT)
 *
 * Ensures SVG diagram typography on `/articles/lot-pravednik-v-sodome/` maintains
 * a >= 6.0pt physical print size on constrained A4 article measures (~363pt column):
 * - LotJourneyDiagram (`viewBox` width 1040 -> 0.349 pt/unit): all classes >= 18.5px (>= 6.45pt)
 * - LotFamilyDiagram (`viewBox` width 960 -> 0.378 pt/unit): all classes >= 16.5px (>= 6.24pt)
 * - Print contrast preservation (`@media print` dark ink fills + `print-color-adjust: exact`)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PRINT_COLUMN_PT = 363; // Measured Chromium A4 article measure width (~484px CSS)
const MIN_PRINT_PT = 6.0;

const specs = [
  {
    file: 'src/components/article-pilots/lot/LotJourneyDiagram.astro',
    classes: ['lot-diagram__place', 'lot-diagram__sub', 'lot-diagram__ref', 'lot-diagram__axis'],
  },
  {
    file: 'src/components/article-pilots/lot/LotFamilyDiagram.astro',
    classes: ['lot-family__name', 'lot-family__note-title', 'lot-family__meta', 'lot-family__branch-note'],
  },
];

for (const spec of specs) {
  const src = fs.readFileSync(path.join(ROOT, spec.file), 'utf8');
  const vb = src.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  assert.ok(vb, `${spec.file}: missing SVG viewBox`);
  const vbWidth = Number(vb[1]);
  const ptPerUnit = PRINT_COLUMN_PT / vbWidth;

  for (const cls of spec.classes) {
    const rule = src.match(new RegExp(`\\.${cls}\\s*\\{([\\s\\S]*?)\\}`));
    assert.ok(rule, `${spec.file}: missing CSS rule for .${cls}`);
    const fsMatch = rule[1].match(/font-size:\s*(\d+(?:\.\d+)?)px/);
    assert.ok(fsMatch, `${spec.file}: .${cls} must declare explicit px font-size in SVG coordinate units`);
    const svgUnits = Number(fsMatch[1]);
    const physicalPt = svgUnits * ptPerUnit;
    assert.ok(
      physicalPt >= MIN_PRINT_PT,
      `${spec.file} .${cls}: physical print size ${physicalPt.toFixed(2)}pt < ${MIN_PRINT_PT}pt`
    );
  }

  assert.match(src, /@media print\s*\{[\s\S]*?print-color-adjust:\s*exact/, `${spec.file}: missing @media print contrast rule`);
}

console.log('✅ Lot print diagram microtext contract passed (all labels >= 6.0pt physical A4 print size)');
