#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, 'audit-pro.js');
let text = fs.readFileSync(file, 'utf8');
const importAnchor = "const { spawnSync } = require('child_process');\n";
const importLine = "const { auditSitemapCoverage, contractProblems } = require('./lib/sitemap-route-contract');\n";

if (!text.includes(importLine)) {
  if (text.split(importAnchor).length !== 2) throw new Error('audit-pro import anchor mismatch');
  text = text.replace(importAnchor, importAnchor + importLine);
}

const oldBlock = `    const sitemap = read('sitemap.xml');
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\\/loc>/g)].map(m => m[1]);
    const dup = urls.filter((u, i) => urls.indexOf(u) !== i);
    if (dup.length) R.err(\`sitemap duplicate loc: \${[...new Set(dup)].join(', ')}\`);
    const contentPages = htmlPages.map(rel)
      .filter(f => !['404.html'].includes(f))
      .filter(f => !verificationFileRe.test(f))
      .filter(f => !/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(read(f)));
    let missing = 0;
    for (const f of contentPages) {
      const url = SITE_URL + '/' + (f === 'index.html' ? '' : f.replace(/index\\.html$/, ''));
      if (!sitemap.includes(\`<loc>\${url}</loc>\`)) { missing++; R.warn(\`sitemap missing URL: \${url}\`); }
    }
    if (!missing && !dup.length) R.ok(\`sitemap.xml covers HTML pages (\${urls.length} loc entries)\`);
`;
const newBlock = `    const sitemap = read('sitemap.xml');
    const contract = auditSitemapCoverage(sitemap, { siteUrl: SITE_URL });
    const problems = contractProblems(contract);
    for (const problem of problems) R.err(\`sitemap contract: \${problem}\`);
    if (!problems.length) {
      R.ok(\`sitemap.xml covers canonical production routes (\${contract.expectedRoutes.length} routes; \${contract.locations.length} loc entries)\`);
    }
`;

if (text.includes(oldBlock)) text = text.replace(oldBlock, newBlock);
else if (!text.includes(newBlock)) throw new Error('audit-pro sitemap block mismatch');

fs.writeFileSync(file, text);
console.log('audit-pro sitemap integration materialized');
