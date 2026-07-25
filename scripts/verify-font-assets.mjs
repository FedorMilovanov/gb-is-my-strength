#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, verifyFontAssets } from './font-assets-lib.mjs';

const report = verifyFontAssets();
const reportPath = path.join(ROOT, 'reports', 'font-assets-verification.json');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Font assets verification: PASS (${report.assets.length} pinned WOFF2 files; ${report.upstreamDrift.length} recorded upstream drifts).`);
