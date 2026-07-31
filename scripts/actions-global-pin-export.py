#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit("usage: actions-global-pin-export.py <target-root>")

root = Path(sys.argv[1]).resolve()
workflows = root / ".github/workflows"
changed: set[str] = set()

pins = {
    "actions/checkout@v7": "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1",
    "actions/setup-node@v7": "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0",
    "actions/upload-artifact@v7": "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1",
}

for path in sorted(workflows.glob("*.yml")):
    lines = path.read_text(encoding="utf-8").splitlines()
    output: list[str] = []
    touched = False
    for line in lines:
        updated = line
        for mutable, immutable in pins.items():
            if mutable not in updated:
                continue
            prefix, _, _comment = updated.partition("#")
            updated = prefix.replace(mutable, immutable).rstrip()
            touched = True
            break
        output.append(updated)
    if touched:
        path.write_text("\n".join(output) + "\n", encoding="utf-8")
        changed.add(path.relative_to(root).as_posix())

guard = root / "scripts/github-actions-global-pin-contract-test.mjs"
guard.write_text("""#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workflowDir = path.join(process.cwd(), '.github', 'workflows');
const declarations = [];
const violations = [];
for (const name of fs.readdirSync(workflowDir).filter((entry) => /\\.ya?ml$/.test(entry)).sort()) {
  const source = fs.readFileSync(path.join(workflowDir, name), 'utf8');
  for (const [index, line] of source.split(/\\r?\\n/).entries()) {
    const match = line.match(/^\\s*-?\\s*uses:\\s*([^\\s#]+)/);
    if (!match) continue;
    const value = match[1].replace(/^['\"]|['\"]$/g, '');
    declarations.push({ name, line: index + 1, value });
    if (value.startsWith('./')) continue;
    if (value.startsWith('docker://')) {
      if (!/^docker:\/\/[^@]+@sha256:[0-9a-f]{64}$/i.test(value)) {
        violations.push(`${name}:${index + 1}: mutable Docker action ${value}`);
      }
      continue;
    }
    const separator = value.lastIndexOf('@');
    const ref = separator >= 0 ? value.slice(separator + 1) : '';
    if (!/^[0-9a-f]{40}$/i.test(ref)) {
      violations.push(`${name}:${index + 1}: external action is not pinned to a 40-hex commit: ${value}`);
    }
  }
}
assert.ok(declarations.length >= 100, `expected at least 100 action declarations, found ${declarations.length}`);
assert.deepEqual(violations, [], `all external actions must be immutable:\n${violations.join('\\n')}`);
console.log(`GLOBAL GITHUB ACTIONS PIN CONTRACT: PASS (${declarations.length} declarations)`);
""", encoding="utf-8")
changed.add(guard.relative_to(root).as_posix())

package_path = root / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
command = "node scripts/github-actions-global-pin-contract-test.mjs"
if command not in package["scripts"]["workflows:check"]:
    package["scripts"]["workflows:check"] += " && " + command
    package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    changed.add(package_path.relative_to(root).as_posix())

doc = root / "docs/dependency-migrations/GITHUB_ACTIONS_GLOBAL_PINS.md"
doc.parent.mkdir(parents=True, exist_ok=True)
doc.write_text("""# Global GitHub Actions immutable pins

Every external `uses:` declaration in `.github/workflows` is pinned to a full 40-hex commit SHA.

The permanent global pin contract:

- permits repository-local actions via `./...`;
- permits Docker actions only with a `sha256:` digest;
- rejects mutable tags and branches such as `@v7`, `@main`, and `@latest`;
- runs as part of `workflows:check` and therefore `workflows:policy`.

Approved current identities are documented by version comments beside their immutable SHA values.
""", encoding="utf-8")
changed.add(doc.relative_to(root).as_posix())

manifest = root / "reports/actions-global-pin-export/changed-files.txt"
manifest.parent.mkdir(parents=True, exist_ok=True)
manifest.write_text("\n".join(sorted(changed)) + "\n", encoding="utf-8")

print(f"Prepared {len(changed)} changed files")
for item in sorted(changed):
    print(item)
