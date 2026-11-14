/**
 * Pinned vendor change: 3d-force-graph@1.80.0 reheats a dragged graph to .30
 * before calling onNodeDrag. The released Baptist 3D scene uses .16.
 * An exact-version, exact-source check prevents silent dependency drift.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'node_modules', '3d-force-graph', 'package.json'), 'utf8'));
if (pkg.version !== '1.80.0') {
  throw new Error('3d-force-graph version drift: ' + pkg.version + '; re-review pinned drag patch');
}
const target = path.join(root, 'node_modules', '3d-force-graph', 'dist', '3d-force-graph.mjs');
const oldValue = 'state.forceGraph.d3AlphaTarget(0.3)';
const patchedValue = 'state.forceGraph.d3AlphaTarget(0.16)';
const contents = readFileSync(target, 'utf8');
const count = (s, q) => s.split(q).length - 1;
if (count(contents, oldValue) === 1 && count(contents, patchedValue) === 0) {
  if (process.argv.includes('--check')) throw new Error('Run npm ci / postinstall to patch vendored 3D drag');
  writeFileSync(target, contents.replace(oldValue, patchedValue), 'utf8');
  console.log('Applied pinned 3d-force-graph@1.80.0 drag alpha 0.30 -> 0.16');
} else if (count(contents, oldValue) === 0 && count(contents, patchedValue) === 1) {
  console.log('3d-force-graph drag alpha 0.16 verified');
} else {
  throw new Error('3d-force-graph drag implementation changed or duplicated; review upstream');
}
