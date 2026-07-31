#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
import textwrap
from pathlib import Path

root = Path(sys.argv[1]).resolve()
changed: set[str] = set()


def write_if_changed(path: Path, content: str) -> None:
    original = path.read_text(encoding="utf-8") if path.exists() else None
    if original != content:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        changed.add(path.relative_to(root).as_posix())


for path in sorted((root / ".github/workflows").glob("*.yml")):
    text = path.read_text(encoding="utf-8")
    updated = text.replace("22.12.0", "22.23.1")
    updated = updated.replace("10.9.0", "10.9.8")
    updated = updated.replace("Node 22.12", "Node 22.23.1")
    updated = re.sub(r"(node-version:\s*)['\"]22['\"]", r"\1'22.23.1'", updated)
    write_if_changed(path, updated)

for relative in (
    "scripts/check-workflows.js",
    "scripts/deployment-provenance-contract-test.mjs",
    "scripts/record-deployment-witness-contract-test.cjs",
    "scripts/release-pipeline-contract-test.mjs",
):
    path = root / relative
    text = path.read_text(encoding="utf-8")
    updated = text.replace("22.12.0", "22.23.1").replace("10.9.0", "10.9.8")
    updated = updated.replace(r"22\.12\.0", r"22\.23\.1").replace(r"10\.9\.0", r"10\.9\.8")
    updated = updated.replace("Node 22.12", "Node 22.23.1")
    write_if_changed(path, updated)

guard = textwrap.dedent(r'''\
#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const toolchain = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/release-toolchain.json'), 'utf8'));
assert.match(toolchain.node, /^22\.\d+\.\d+$/, 'canonical Node must be an exact Node 22 patch');
assert.match(toolchain.npm, /^10\.\d+\.\d+$/, 'canonical npm must be an exact npm 10 patch');

const workflowDir = path.join(ROOT, '.github', 'workflows');
const declarations = [];
const mismatches = [];
for (const name of fs.readdirSync(workflowDir).filter((name) => name.endsWith('.yml')).sort()) {
  const source = fs.readFileSync(path.join(workflowDir, name), 'utf8');
  for (const match of source.matchAll(/node-version:\s*['\"]?([^'\"\s#]+)['\"]?/g)) {
    const value = match[1];
    declarations.push({ name, value });
    if (value !== toolchain.node) mismatches.push(`${name}: node-version ${value}`);
  }
}
assert.ok(declarations.length >= 35, `expected at least 35 setup-node declarations, found ${declarations.length}`);
assert.deepEqual(mismatches, [], `all workflow Node runtimes must equal ${toolchain.node}:\n${mismatches.join('\n')}`);

const deploy = fs.readFileSync(path.join(workflowDir, 'deploy.yml'), 'utf8');
assert.match(deploy, new RegExp(`RELEASE_NODE_VERSION:\\s*['\"]${toolchain.node.replaceAll('.', '\\.')}['\"]`));
assert.match(deploy, new RegExp(`RELEASE_NPM_VERSION:\\s*['\"]${toolchain.npm.replaceAll('.', '\\.')}['\"]`));
const candidate = fs.readFileSync(path.join(workflowDir, 'deploy-candidate-contract.yml'), 'utf8');
assert.ok(candidate.includes(`npm@${toolchain.npm}`), 'deploy candidate must install canonical npm');
console.log(`NODE TOOLCHAIN PIN CONTRACT: PASS (${declarations.length} exact declarations; Node ${toolchain.node}; npm ${toolchain.npm})`);
''')
write_if_changed(root / "scripts/node-toolchain-pin-contract-test.mjs", guard)

package_path = root / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
command = "node scripts/node-toolchain-pin-contract-test.mjs"
if command not in package["scripts"]["workflows:check"]:
    package["scripts"]["workflows:check"] += " && " + command
write_if_changed(package_path, json.dumps(package, ensure_ascii=False, indent=2) + "\n")

documentation = textwrap.dedent('''\
# Node 22 LTS patch migration

Canonical release toolchain: Node 22.23.1 and npm 10.9.8.

- Every active GitHub Actions `node-version` is an exact patch.
- Release workflows verify both Node and npm exactly.
- Historical audit records and `engines >=22.12.0` remain historical/compatibility facts.
- `workflows:check` permanently rejects floating or divergent runtime pins.
- Node 24/npm 11 is a separate future major migration.
''')
write_if_changed(root / "docs/dependency-migrations/NODE_22_LTS_PATCH.md", documentation)

manifest = root / "reports/node22-export/changed-files.txt"
manifest.parent.mkdir(parents=True, exist_ok=True)
manifest.write_text("\n".join(sorted(changed)) + "\n", encoding="utf-8")
print(f"Prepared {len(changed)} changed files")
for item in sorted(changed):
    print(item)
