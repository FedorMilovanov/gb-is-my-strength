#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/deployment-witness-ledger.yml"
CONTRACT = ROOT / "scripts/deployment-witness-ledger-source-contract-test.cjs"

workflow = WORKFLOW.read_text(encoding="utf-8")
anchor = """  pull-requests: write  # comment the exact merged PR after verified deployment\n\njobs:\n"""
insertion = """  pull-requests: write  # comment the exact merged PR after verified deployment\n\nconcurrency:\n  group: deployment-witness-${{ github.event_name == 'workflow_run' && github.event.workflow_run.id || inputs.deploy_run_id }}\n  cancel-in-progress: false\n\njobs:\n"""
if workflow.count(anchor) != 1:
    raise SystemExit(f"expected one workflow insertion anchor, found {workflow.count(anchor)}")
WORKFLOW.write_text(workflow.replace(anchor, insertion), encoding="utf-8")

contract = CONTRACT.read_text(encoding="utf-8")
check_anchor = """    ['ledger owns exact PR comment projection', ledger, /^  pull-requests: write\\s+# comment the exact merged PR after verified deployment$/m],\n\n    ['automatic ledger requires successful deploy', ledger, /workflow_run\\.conclusion == 'success'/],\n"""
check_insertion = """    ['ledger owns exact PR comment projection', ledger, /^  pull-requests: write\\s+# comment the exact merged PR after verified deployment$/m],\n    ['ledger serializes automatic and manual projection by deploy run', ledger, /concurrency:[\\s\\S]{0,180}group: deployment-witness-\\$\\{\\{ github\\.event_name == 'workflow_run' && github\\.event\\.workflow_run\\.id \\|\\| inputs\\.deploy_run_id \\}\\}/],\n    ['ledger evidence writer never cancels an earlier projection', ledger, /concurrency:[\\s\\S]{0,220}cancel-in-progress: false/],\n\n    ['automatic ledger requires successful deploy', ledger, /workflow_run\\.conclusion == 'success'/],\n"""
if contract.count(check_anchor) != 1:
    raise SystemExit(f"expected one contract check anchor, found {contract.count(check_anchor)}")
contract = contract.replace(check_anchor, check_insertion)

mutation_anchor = """  ['ledger PR projection downgraded to read', { ...sources, ledger: sources.ledger.replace('  pull-requests: write', '  pull-requests: read') }],\n  ['github-script pin made mutable', { ...sources, ledger: sources.ledger.replaceAll(ACTION_PINS.githubScript, 'actions/github-script@v7') }],\n"""
mutation_insertion = """  ['ledger PR projection downgraded to read', { ...sources, ledger: sources.ledger.replace('  pull-requests: write', '  pull-requests: read') }],\n  ['ledger concurrency removed', { ...sources, ledger: sources.ledger.replace(/\\nconcurrency:[\\s\\S]*?\\n\\njobs:/, '\\n\\njobs:') }],\n  ['ledger concurrency made cancelling', { ...sources, ledger: sources.ledger.replace('  cancel-in-progress: false', '  cancel-in-progress: true') }],\n  ['ledger concurrency keyed to recorder run', { ...sources, ledger: sources.ledger.replace(\"group: deployment-witness-${{ github.event_name == 'workflow_run' && github.event.workflow_run.id || inputs.deploy_run_id }}\", 'group: deployment-witness-${{ github.run_id }}') }],\n  ['github-script pin made mutable', { ...sources, ledger: sources.ledger.replaceAll(ACTION_PINS.githubScript, 'actions/github-script@v7') }],\n"""
if contract.count(mutation_anchor) != 1:
    raise SystemExit(f"expected one mutation anchor, found {contract.count(mutation_anchor)}")
CONTRACT.write_text(contract.replace(mutation_anchor, mutation_insertion), encoding="utf-8")

Path(__file__).unlink()
