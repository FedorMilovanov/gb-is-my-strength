// Acceptance witness, not a third extractor. Compare ordered material from two rendered hosts after opening the same anchor.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const file = process.argv[2];
if (!file) throw Error('usage: node parity.mjs <owners.jsonl>');
const rows = (await readFile(file, 'utf8'))
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l));
for (const m of rows.filter((r) => r.w === 390 && r.pilot)) {
  const d = rows.find(
    (r) => r.w === 1440 && r.pilot && r.path === m.path && r.id === m.id,
  );
  assert.ok(d && !m.error && !d.error);
  const out = { path: m.path, anchor: m.id };
  for (const key of ['heading', 'refs', 'terms', 'evidence']) {
    const val = (r) =>
      key === 'evidence'
        ? r.material?.evidence.map((x) => x.id || x.lead)
        : r.material?.[key];
    out[key] =
      !!m.material &&
      !!d.material &&
      JSON.stringify(val(m)) === JSON.stringify(val(d));
  }
  console.log(JSON.stringify(out));
  if (Object.values(out).includes(false)) process.exitCode = 1;
}
