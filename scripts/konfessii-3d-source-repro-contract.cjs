#!/usr/bin/env node
'use strict';
/** Gate for checked-in Russian Baptist 3D singlefile and React source.
 * Execute after npm ci && npm run build within reconciled-app.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const app = path.join(root, '_build-tools', 'konfessii-baptizm', 'reconciled-app');
const generated = path.join(app, 'dist', 'index.html');
const checkedIn = path.join(root, 'konfessii', 'russkij-baptizm', '_app', 'index.html');
const source = path.join(app, 'src', 'components', 'MindMap3D.tsx');
const styles = path.join(app, 'src', 'index.css');
const template = path.join(app, 'index.html');
const read = (f) => fs.readFileSync(f, 'utf8');
const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const fail = (why) => { throw new Error('Baptist 3D source parity: ' + why); };
for (const f of [generated, checkedIn, source, styles, template]) {
  if (!fs.existsSync(f)) fail('Missing source/build file: ' + path.relative(root, f));
}
const generatedHash = hash(generated);
const checkedInHash = hash(checkedIn);
if (generatedHash !== checkedInHash) fail('Checked-in _app differs from clean React/Vite build');
const bundle = read(checkedIn), mindmap = read(source), css = read(styles), head = read(template);
const expected = [
  [/d3AlphaTarget\(\.16\)\.resetCountdown\(\)/, 'soft drag alpha from pinned vendor source'],
  [/d3AlphaDecay:\.0165,d3VelocityDecay:\.24,warmupTicks:150,cooldownTicks:220,cooldownTime:7e3/, 'calm graph defaults'],
  [/strength\*1\.28/, 'restoring anchor force'],
  [/Content-Security-Policy/, 'CSP'],
  [/name="robots" content="noindex"/, 'no duplicate search indexing'],
];
for (const [regex, label] of expected) {
  if (!regex.test(bundle)) fail('Compiled application lost ' + label);
}
if (/d3AlphaTarget\(\.3\)\.resetCountdown\(\)/.test(bundle)) fail('Upstream hard drag 0.30 returned');
if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(bundle)) fail('External fonts bypass the deployed CSP');
if (!/onNodeDrag=\{handleNodeDrag as any\}/.test(mindmap)) fail('3D drag owner changed');
if (!/cooldownTicks=\{220\} cooldownTime=\{7000\}/.test(mindmap)) fail('3D cooldown source drift');
if (/html\s*\{[^}]*overflow-x\s*:\s*(?:hidden|clip)/.test(css) ||
    /body\s*\{[^}]*overflow-x\s*:\s*(?:hidden|clip)/.test(css)) {
  fail('Global overflow masking returned');
}
if (/[ \t]+(?=\r?\n|$)/g.test(bundle)) fail('Generated HTML contains trailing whitespace; fix the reproducible build, not .gitattributes');
if (!bundle.includes('site-utils.js')) fail('Shared OverlayRuntime bootstrap is missing from the 3D application');
for (const asset of ['js/reader-preferences-head.js', 'js/reader-preferences.js', 'css/reader-preferences.css', 'js/site-utils.js']) {
  const pattern = new RegExp(asset.replaceAll('.', '\\.') + '\\?v=([a-f\\d]{8})');
  const match = head.match(pattern);
  if (!match) fail('Missing governed asset version: ' + asset);
  const actual = crypto.createHash('md5').update(fs.readFileSync(path.join(root, asset))).digest('hex').slice(0,8);
  if (match[1] !== actual) fail('Stale Reader asset reference: ' + asset + ' (' + match[1] + ', expected ' + actual + ')');
}
console.log(JSON.stringify({status:'PASS',checkedInHash,compiledBytes:fs.statSync(checkedIn).size,source:path.relative(root,app)},null,2));
