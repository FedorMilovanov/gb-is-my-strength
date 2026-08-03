from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
target = ROOT / "scripts" / "dist-publication-audit.js"
workflow = ROOT / ".github" / "workflows" / "_tmp-pwa-publication-parser-autofix.yml"
self_path = Path(__file__).resolve()

old = r'''function parseSwPrecache(sw) {
  const match = sw.match(/PRECACHE_ASSETS=\[([^\]]+)\]/);
  if (!match) return [];
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}'''

new = r'''function parseSwPrecache(sw) {
  const match = sw.match(/\bPRECACHE_ASSETS\s*=\s*\[([\s\S]*?)\];/);
  if (!match) return [];

  const constants = new Map(
    [...sw.matchAll(/\bconst\s+([A-Z][A-Z0-9_]*)\s*=\s*(["'])(.*?)\2\s*;/g)]
      .map((entry) => [entry[1], entry[3]])
  );
  const assets = [];
  for (const rawToken of match[1].split(',')) {
    const token = rawToken.trim();
    if (!token) continue;
    const quoted = token.match(/^(["'])(.*?)\1$/);
    if (quoted) {
      assets.push(quoted[2]);
      continue;
    }
    if (constants.has(token)) {
      assets.push(constants.get(token));
      continue;
    }
    return [];
  }
  return assets;
}'''

text = target.read_text(encoding="utf-8")
if text.count(old) != 1:
    raise SystemExit(f"expected exactly one legacy parser, found {text.count(old)}")
target.write_text(text.replace(old, new), encoding="utf-8")

workflow.unlink()
self_path.unlink()
