#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

EXPECTED = {
    '.github/workflows/bible-reference-contract.yml': 'c9770a6e5427f1feecbb6345d80706ec795480d5',
    '.github/workflows/content-source-truth-coverage.yml': '19771a1e6fba37911049a3efe297d17b29529be5',
    '.github/workflows/deploy-candidate-contract.yml': 'c158862506e735b7dc4ce660e230caf74c95aea0',
    '.github/workflows/deploy.yml': 'dd2d75fc885ebee97b345bb2556a3d2dc55908de',
    '.github/workflows/dist-dry-run.yml': 'a9f57b33db3b7078f2ced5e5df586ce301775acf',
    '.github/workflows/editorial-dateline-contract.yml': '5354766390d9bbeb03de0204ad28a6128b01c107',
    '.github/workflows/editorial-metadata-v3.yml': '391e3a2c35a834679cc2a80e6eb86be656d1be58',
    '.github/workflows/gill-pre-v16-submenu.yml': '9cbc50d69a84a3e2ec7b06aaf7e5643aca7a0d70',
    '.github/workflows/glossary-contract.yml': 'ffb6738b4a7af40e1700e63f64dac6264f1a029d',
    '.github/workflows/indexnow.yml': '3ca268f4793d23fc943f3520dafcac09aae38d7d',
    '.github/workflows/interactive-audit.yml': 'ee5f04a554ba2a90a6d6208f6ed59b13701d7863',
    '.github/workflows/map-archaeology-projection.yml': '7320a90c5287e36e8ef476acbd561ecc17a9fc74',
    '.github/workflows/map-archaeology-source-registry.yml': '710d3fad32afd0e2aaa95fc5b30e9ff527bbdbd1',
    '.github/workflows/map-keyboard-contract.yml': '7ba6731ccf799594cf8c8533e35fd21082187a52',
    '.github/workflows/native-source-contract.yml': 'b67baea3de4fb5a1c07cbbdd9f7d8484179a186b',
    '.github/workflows/node-toolchain-contract.yml': '0e42684c2c3a0a916fee126aceeb9bc34894d3c3',
    '.github/workflows/overlay-runtime-browser.yml': 'c4c870bc9df7d63a7bb25add4b3ceffca3b4a9aa',
    '.github/workflows/print-paper-contract.yml': '2a8f84f576aa89f60bb3fa069fe16492edd30697',
    '.github/workflows/repository-history-forensic.yml': '7535ee76ca88367fbd25eeae35b7654d84fe0ddc',
    '.github/workflows/route-registry-validators.yml': 'b42f39679c8c70b57ff36b8329434632a7814c59',
    '.github/workflows/search-manifest-policy.yml': 'd11c9ab5e043757d7f224c0422686831df857ca4',
    '.github/workflows/shared-files-guard.yml': '1ee9b420f920431f94e154aeb7a6865822f7ba30',
    '.github/workflows/source-authority-contract.yml': 'a144d67615b89c3f75b5134eeaca95c58988bb56',
    '.github/workflows/source-links.yml': 'ae795111ea42aeb45f3ec026d6d03ab536ddd57f',
    '.github/workflows/tts-download-consent.yml': '72f386d4891cd3b87997181e2a50d1ba2c901684',
    '.github/workflows/visual-parity.yml': '3467c533b59735972cec766a71b241ea74f97f2c',
    'data/release-toolchain.json': '37b71d8e3c7276d9e14b6b5372d61c47c339add8',
    'docs/dependency-migrations/NODE_22_LTS_PATCH.md': 'd9eaad90893f41b87c18094fb2fad1421b941662',
    'package.json': 'fc8792545505cd9202b97ac6c3feb5c973df2c04',
    'scripts/check-workflows.js': '9d82187b8a7ce7e892147dc3458863632d083025',
    'scripts/deployment-provenance-contract-test.mjs': '83eef5d1cd02263c7417804c8e20817178938929',
    'scripts/node-toolchain-pin-contract-test.mjs': '5a1704d9c6ed08c6e26fcbd4d6b078f343a442ff',
    'scripts/record-deployment-witness-contract-test.cjs': '391a7e8842dd003c107f727f9b242ec706d82160',
    'scripts/release-pipeline-contract-test.mjs': '43b2648b70c7e667f0a9d8fa0fb98fee220b213a',
}

if len(sys.argv) != 3:
    raise SystemExit('usage: node22-object-transfer.py <target-root> <helper-root>')

target = Path(sys.argv[1]).resolve()
helper = Path(sys.argv[2]).resolve()
subprocess.run([sys.executable, str(helper / 'scripts/node22-current-main-builder.py'), str(target)], check=True)
manifest = target / 'reports/node22-export/changed-files.txt'
actual_paths = {line.strip() for line in manifest.read_text(encoding='utf-8').splitlines() if line.strip()}
if actual_paths != set(EXPECTED):
    raise SystemExit(f'manifest mismatch: missing={sorted(set(EXPECTED)-actual_paths)} extra={sorted(actual_paths-set(EXPECTED))}')
for path, expected_sha in sorted(EXPECTED.items()):
    actual_sha = subprocess.check_output(['git', '-C', str(target), 'hash-object', '--', path], text=True).strip()
    if actual_sha != expected_sha:
        raise SystemExit(f'blob mismatch for {path}: expected {expected_sha}, got {actual_sha}')
subprocess.run(['git', '-C', str(target), 'add', '--pathspec-from-file=reports/node22-export/changed-files.txt'], check=True)
staged = set(subprocess.check_output(['git', '-C', str(target), 'diff', '--cached', '--name-only'], text=True).splitlines())
if staged != set(EXPECTED):
    raise SystemExit(f'staged mismatch: missing={sorted(set(EXPECTED)-staged)} extra={sorted(staged-set(EXPECTED))}')
subprocess.run(['git', '-C', str(target), 'diff', '--cached', '--check'], check=True)
subprocess.run(['git', '-C', str(target), 'config', 'user.name', 'github-actions[bot]'], check=True)
subprocess.run(['git', '-C', str(target), 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], check=True)
subprocess.run(['git', '-C', str(target), 'commit', '-m', 'build(toolchain): materialize validated immutable-main Node tree'], check=True)
out = target / 'reports/node22-object-transfer'
out.mkdir(parents=True, exist_ok=True)
commit = subprocess.check_output(['git', '-C', str(target), 'rev-parse', 'HEAD'], text=True).strip()
tree = subprocess.check_output(['git', '-C', str(target), 'rev-parse', 'HEAD^{tree}'], text=True).strip()
(out / 'commit-sha.txt').write_text(commit + '\n', encoding='utf-8')
(out / 'tree-sha.txt').write_text(tree + '\n', encoding='utf-8')
(out / 'blob-shas.json').write_text(json.dumps(EXPECTED, indent=2, sort_keys=True) + '\n', encoding='utf-8')
print(f'validated commit={commit} tree={tree}')
