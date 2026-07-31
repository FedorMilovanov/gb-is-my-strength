#!/usr/bin/env python3
from __future__ import annotations

import json
import runpy
import subprocess
import sys
import textwrap
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit("usage: node22-current-main-builder.py <target-root>")

target = Path(sys.argv[1]).resolve()
helper_root = Path(__file__).resolve().parent

# Update the canonical release source of truth before the deterministic exporter
# derives workflow and contract changes from the current pinned-Actions main.
toolchain_path = target / "data/release-toolchain.json"
toolchain = json.loads(toolchain_path.read_text(encoding="utf-8"))
toolchain["node"] = "22.23.1"
toolchain["npm"] = "10.9.8"
toolchain_path.write_text(json.dumps(toolchain, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

sys.argv = [str(helper_root / "node22-toolchain-export-v3.py"), str(target)]
runpy.run_path(str(helper_root / "node22-toolchain-export-v3.py"), run_name="__main__")

node_workflow = textwrap.dedent("""\
name: Node Toolchain Contract

on:
  pull_request:
    branches: [main]
    paths:
      - '.github/workflows/**'
      - 'data/release-toolchain.json'
      - 'docs/dependency-migrations/NODE_22_LTS_PATCH.md'
      - 'package.json'
      - 'scripts/check-workflows.js'
      - 'scripts/node-toolchain-pin-contract-test.mjs'
  push:
    branches: [main]
    paths:
      - '.github/workflows/**'
      - 'data/release-toolchain.json'
      - 'docs/dependency-migrations/NODE_22_LTS_PATCH.md'
      - 'package.json'
      - 'scripts/check-workflows.js'
      - 'scripts/node-toolchain-pin-contract-test.mjs'
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: node-toolchain-contract-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  exact-pins:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout exact head
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{ github.event.pull_request.head.sha || github.sha }}
          persist-credentials: false

      - name: Set up canonical Node
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: '22.23.1'

      - name: Enforce workflow and toolchain contracts
        run: |
          node scripts/check-workflows.js
          node scripts/node-toolchain-pin-contract-test.mjs

      - name: Lint this workflow
        run: node scripts/run-actionlint.mjs -no-color .github/workflows/node-toolchain-contract.yml

      - name: Ensure validation is read-only
        run: git diff --exit-code
""")
workflow_path = target / ".github/workflows/node-toolchain-contract.yml"
workflow_path.write_text(node_workflow, encoding="utf-8")

manifest_path = target / "reports/node22-export/changed-files.txt"
candidates = {
    line.strip()
    for line in manifest_path.read_text(encoding="utf-8").splitlines()
    if line.strip()
}
candidates.update({"data/release-toolchain.json", ".github/workflows/node-toolchain-contract.yml"})

for forbidden in (
    ".github/workflows/node22-current-main-export.yml",
    "scripts/node22-current-main-builder.py",
    "scripts/node22-toolchain-export.py",
    "scripts/node22-toolchain-export-v3.py",
):
    candidates.discard(forbidden)

# Mark any newly created candidate paths as intent-to-add so one Git diff command
# reports both tracked modifications and genuinely new permanent files. Then
# remove the temporary index markers; the working tree remains unchanged.
sorted_candidates = sorted(candidates)
subprocess.run(
    ["git", "-C", str(target), "add", "-N", "--", *sorted_candidates],
    check=True,
)
try:
    diff_output = subprocess.check_output(
        ["git", "-C", str(target), "diff", "--name-only", "--", *sorted_candidates],
        text=True,
    )
finally:
    subprocess.run(
        ["git", "-C", str(target), "reset", "--", *sorted_candidates],
        check=True,
        stdout=subprocess.DEVNULL,
    )

entries = {line.strip() for line in diff_output.splitlines() if line.strip()}
unexpected = entries - candidates
if unexpected:
    raise SystemExit(f"Unexpected paths in Node export diff: {sorted(unexpected)}")
if not entries:
    raise SystemExit("Node export produced no changed permanent files")

for path in entries:
    if "node22-current-main-export" in path or "node22-current-main-builder" in path or "node22-toolchain-export" in path:
        raise SystemExit(f"Helper surface leaked into permanent export: {path}")

manifest_path.write_text("\n".join(sorted(entries)) + "\n", encoding="utf-8")
print(f"Prepared current-main combined Node migration: {len(entries)} changed permanent files")
for entry in sorted(entries):
    print(entry)
