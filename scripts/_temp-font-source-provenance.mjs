#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORTS = path.join(ROOT, 'reports');
const USER_AGENT = 'Mozilla/5.0 AppleWebKit/537.36 Chrome/124.0 font-source-provenance/1.0';
const MAX_REDIRECTS = 5;

const SPECS = [
  ['Cormorant Garamond',400,'normal','cyrillic','fonts/CormorantGaramond/cormorantgaramond-cyrillic-400.woff2',12776,'0d23162e67528fdc5fe1b12bedc525a69bbdc86d5d9f3c2ee9e9ee459934ecd4'],
  ['Cormorant Garamond',400,'italic','cyrillic','fonts/CormorantGaramond/cormorantgaramond-cyrillic-400i.woff2',12720,'109ce34012f204b9794f2fa2e8e6fdff52b156636cd5da86d86ae7142b48aa03'],
  ['Cormorant Garamond',500,'normal','cyrillic','fonts/CormorantGaramond/cormorantgaramond-cyrillic-500.woff2',12920,'30aec8d9cdb4ea84534ffcd7c58b0f06069f63dc177b5aafd7438627dfe10fb8'],
  ['Inter',300,'normal','cyrillic','fonts/Inter/inter-cyrillic-300.woff2',7812,'2f4d3f2e59e0dd665765f7e6d52f0cd8173a1ec1732b544622e3a4780ad3877c'],
  ['Inter',400,'normal','cyrillic','fonts/Inter/inter-cyrillic-400.woff2',7712,'f0bb586459ce8f09b238285040f17e3e9e9538b2c5a7aae0775194e33c36c3c3'],
  ['Inter',500,'normal','cyrillic','fonts/Inter/inter-cyrillic-500.woff2',7900,'b77a86ec16aadc157f4a99e8898d71cd75ea264753d9bdf13f962f8c3988cbb0'],
  ['Inter',600,'normal','cyrillic','fonts/Inter/inter-cyrillic-600.woff2',7972,'6c2a37f82a676bcd441b735e4e2cda4edb8873a059ab9c362a84f0711f257041'],
  ['Lora',400,'normal','cyrillic','fonts/Lora/lora-cyrillic-400.woff2',11480,'d1f41090bba5100d2857cf974e2ae542d4be61556febbb2b5afd072c2e42fdea'],
  ['Lora',400,'italic','cyrillic','fonts/Lora/lora-cyrillic-400i.woff2',12512,'aaeb039ba0ecdbc75108a6f66ee9f6745315412de78a4061cc90365b513fc4a3'],
  ['Lora',500,'normal','cyrillic','fonts/Lora/lora-cyrillic-500.woff2',11916,'b1693c55066ecf7c2b60a74c7761169256c8c1b7bcfe829fc0dc4f18306ee334'],
  ['Lora',500,'italic','cyrillic','fonts/Lora/lora-cyrillic-500i.woff2',12944,'5a2b8761b75d9bac2849aa3e21420bd62e69483efae6923445b161bf67c8df0b'],
  ['Lora',600,'normal','cyrillic','fonts/Lora/lora-cyrillic-600.woff2',12056,'b3ba5dad180e78000d8c3f3aec5f589fb05e3a83d8486caea70449179d522cd2'],
  ['Lora',400,'normal','latin','fonts/Lora/lora-latin-400.woff2',21148,'ac079950fd9885261c0f73d9e87233f31b5427333ce0eb20e26c119458493c40'],
  ['Lora',400,'italic','latin','fonts/Lora/lora-latin-400i.woff2',22756,'723cc14fe86bc9fadb2f5f34efb421d246edb240a18d2a7828d2edc041d79996'],
  ['Lora',600,'normal','latin','fonts/Lora/lora-latin-600.woff2',21916,'7bbfe9f3c9e9d6d07e17da4d5229a42b042cc2e16024993cb687dc08cc762557'],
  ['Noto Sans',400,'normal','greek','fonts/NotoSansGreek/notosansgreek-400.woff2',7888,'c7c42b4b60ab0553cabd0a22b12d7ac595ae1fb90f4dff814e1a42e4eb95d0d6'],
  ['Noto Sans Hebrew',400,'normal','hebrew','fonts/NotoSansHebrew/notosanshebrew-400.woff2',7068,'330b5c315ebac6a102bea95898207a4fdae4a6180d27783dfbb2a700deb61845'],
  ['Noto Serif',400,'normal','greek','fonts/NotoSerifGreek/notoserifgreek-400.woff2',147464,'692cd413544ca3d808dbee80080da657faaf8a0ef051e343ba9280c2922ee4d9'],
  ['Noto Serif Hebrew',400,'normal','hebrew','fonts/NotoSerifHebrew/notoserifhebrew-400.woff2',18412,'b5535c575a15a5cccb8ac562dd2c606e39696236d86abc86d65946baf1dfacfe'],
  ['Noto Serif Hebrew',500,'normal','hebrew','fonts/NotoSerifHebrew/notoserifhebrew-500.woff2',18412,'b5535c575a15a5cccb8ac562dd2c606e39696236d86abc86d65946baf1dfacfe'],
  ['Playfair Display',400,'normal','cyrillic','fonts/PlayfairDisplay/playfairdisplay-cyrillic-400.woff2',11444,'e740be684698fe83afd47e28ba5070f6e8d9759d37717679a74abd461eda01f6'],
  ['Playfair Display',400,'italic','cyrillic','fonts/PlayfairDisplay/playfairdisplay-cyrillic-400i.woff2',12664,'2b016e18145f89b6b998a13152ff85a5815e94751210d85d9808549f712c62e1'],
  ['Playfair Display',600,'normal','cyrillic','fonts/PlayfairDisplay/playfairdisplay-cyrillic-600.woff2',12224,'6106d72e36626a3a77914192ac8f89f0e737d9aea78387238bd6df50d2ce1a2c'],
  ['Playfair Display',700,'normal','cyrillic','fonts/PlayfairDisplay/playfairdisplay-cyrillic-700.woff2',12360,'cfbfb0e36791f82470367d25c5a8d498dc1561a7a66a4172b7c6df749fdf9894'],
  ['Source Sans 3',400,'normal','cyrillic','fonts/SourceSans3/sourcesans3-cyrillic-400.woff2',9604,'b0324c3af47c138a2b5457466037637b8279576197024ed6968041836ffc0546'],
  ['Source Sans 3',500,'normal','cyrillic','fonts/SourceSans3/sourcesans3-cyrillic-500.woff2',9560,'a8b6600fa85eaf7d5677c92ec0f2d1775c1bc43c5dbe9c1bf523c75dd8d20786'],
  ['Source Sans 3',600,'normal','cyrillic','fonts/SourceSans3/sourcesans3-cyrillic-600.woff2',9644,'31fe183d248fa315a872f0956e0e43bc5d1d6c9c7fea2fa434deb91ab2a686ff'],
  ['Source Sans 3',400,'normal','latin','fonts/SourceSans3/sourcesans3-latin-400.woff2',15696,'0f73f35e08cde0a2f10c109c6e01d71459d97e4099ecd9a50f1b6c0209e4de2b'],
];

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

async function requestExact(startUrl, { hosts, contentTypes, label }) {
  const redirects = [];
  let current = new URL(startUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (current.protocol !== 'https:') throw new Error(`${label}: non-HTTPS URL ${current}`);
    if (!hosts.has(current.hostname)) throw new Error(`${label}: forbidden host ${current.hostname}`);
    const response = await fetch(current, {
      redirect: 'manual',
      headers: { 'user-agent': USER_AGENT, accept: '*/*' },
      signal: AbortSignal.timeout(30000),
    });
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`${label}: redirect lacks Location`);
      const next = new URL(location, current);
      redirects.push({ status: response.status, from: current.href, to: next.href });
      current = next;
      continue;
    }
    if (!response.ok) throw new Error(`${label}: HTTP ${response.status} ${current}`);
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!contentTypes.has(contentType)) throw new Error(`${label}: unexpected content-type ${contentType || '(missing)'}`);
    const body = Buffer.from(await response.arrayBuffer());
    return { finalUrl: current.href, redirects, status: response.status, contentType, body };
  }
  throw new Error(`${label}: too many redirects`);
}

function cssUrl(family, weight, style) {
  const italic = style === 'italic' ? 1 : 0;
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,wght@${italic},${weight}&display=swap`;
}

function pickSubsetUrl(css, subset) {
  const parts = css.split(/\/\*\s*([\w-]+)\s*\*\//);
  for (let index = 1; index < parts.length; index += 2) {
    if (parts[index].trim() !== subset) continue;
    const match = (parts[index + 1] || '').match(/src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)\s*format\(['"]woff2['"]\)/i);
    if (match) return match[1];
  }
  return null;
}

const results = [];
for (const [family, weight, style, subset, relativePath, expectedBytes, expectedSha256] of SPECS) {
  const tracked = fs.readFileSync(path.join(ROOT, relativePath));
  if (tracked.length !== expectedBytes || sha256(tracked) !== expectedSha256) {
    throw new Error(`${relativePath}: tracked bytes changed since inventory`);
  }
  const requestedCssUrl = cssUrl(family, weight, style);
  const cssResponse = await requestExact(requestedCssUrl, {
    hosts: new Set(['fonts.googleapis.com']),
    contentTypes: new Set(['text/css']),
    label: `${relativePath} CSS`,
  });
  const css = cssResponse.body.toString('utf8');
  const declaredAssetUrl = pickSubsetUrl(css, subset);
  if (!declaredAssetUrl) throw new Error(`${relativePath}: subset ${subset} not found in Google CSS`);
  const assetResponse = await requestExact(declaredAssetUrl, {
    hosts: new Set(['fonts.gstatic.com']),
    contentTypes: new Set(['font/woff2','application/font-woff2','application/octet-stream']),
    label: `${relativePath} asset`,
  });
  if (assetResponse.body.length < 1024 || assetResponse.body.length > 2_000_000) {
    throw new Error(`${relativePath}: implausible downloaded size ${assetResponse.body.length}`);
  }
  if (assetResponse.body.subarray(0,4).toString('ascii') !== 'wOF2') {
    throw new Error(`${relativePath}: downloaded asset lacks wOF2 magic`);
  }
  const downloadedSha256 = sha256(assetResponse.body);
  results.push({
    path: relativePath,
    family,
    weight,
    style,
    subset,
    cssUrl: requestedCssUrl,
    cssFinalUrl: cssResponse.finalUrl,
    cssRedirects: cssResponse.redirects,
    sourceUrl: assetResponse.finalUrl,
    sourceRedirects: assetResponse.redirects,
    sourceContentType: assetResponse.contentType,
    trackedBytes: expectedBytes,
    trackedSha256: expectedSha256,
    downloadedBytes: assetResponse.body.length,
    downloadedSha256,
    matchesTracked: assetResponse.body.length === expectedBytes && downloadedSha256 === expectedSha256,
  });
  console.log(`${relativePath}: ${results.at(-1).matchesTracked ? 'MATCH' : 'DRIFT'} ${assetResponse.finalUrl}`);
}

const report = {
  generatedAt: new Date().toISOString(),
  count: results.length,
  matches: results.filter((entry) => entry.matchesTracked).length,
  drifts: results.filter((entry) => !entry.matchesTracked).length,
  files: results,
};
fs.mkdirSync(REPORTS, { recursive: true });
fs.writeFileSync(path.join(REPORTS, 'font-source-provenance.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ count: report.count, matches: report.matches, drifts: report.drifts }, null, 2));
