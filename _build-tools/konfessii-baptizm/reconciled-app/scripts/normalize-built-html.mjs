/**
 * Normalize incidental trailing ASCII whitespace from upstream Three.js GLSL
 * template literals in the generated Vite singlefile. This is a deterministic
 * build-output formatting step, not an exception to the repository's Git policy.
 * Trailing whitespace is not significant to GLSL; no text or tags are removed.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../dist/index.html', import.meta.url);
const before = readFileSync(file, 'utf8');
const after = before.replace(/[ \t]+(?=\r?\n|$)/g, '');
const changed = (before.match(/[ \t]+(?=\r?\n|$)/g) || []).length;
if (!before.includes('name="robots" content="noindex"') || !before.includes('Content-Security-Policy')) {
  throw new Error('Refusing to normalize unexpected 3D build output');
}
if (changed) writeFileSync(file, after, 'utf8');
console.log('3D singlefile normalized: trailing-whitespace sequences=' + changed);
