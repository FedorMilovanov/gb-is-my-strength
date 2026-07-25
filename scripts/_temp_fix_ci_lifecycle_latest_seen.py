#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE = ROOT / "scripts/ci-failure-lifecycle.cjs"
TEST = ROOT / "scripts/ci-failure-lifecycle-contract-test.cjs"
SOURCE_CONTRACT = ROOT / "scripts/ci-failure-lifecycle-source-contract-test.cjs"

module = MODULE.read_text(encoding="utf-8")
old = """  const previousFailure = previousState && previousState.latestFailure;\n\n  if (previousFailure && compareRunVersion(current, previousFailure) <= 0) {\n    core.info(`Ignoring stale/duplicate failure run ${current.id}/${current.attempt}`);\n    return { action: 'ignored-stale-failure', issueNumber: existing.number };\n  }\n"""
new = """  const previousFailure = previousState && previousState.latestFailure;\n  const latestTransition = previousState && (previousState.latestSeen || previousFailure);\n\n  if (latestTransition && compareRunVersion(current, latestTransition) <= 0) {\n    core.info(\n      `Ignoring stale/duplicate failure run ${current.id}/${current.attempt}; ` +\n      `latest transition is ${latestTransition.id}/${latestTransition.attempt}`,\n    );\n    return { action: 'ignored-stale-failure', issueNumber: existing.number };\n  }\n"""
if module.count(old) != 1:
    raise SystemExit(f"expected one failure ordering block, found {module.count(old)}")
MODULE.write_text(module.replace(old, new), encoding="utf-8")

test = TEST.read_text(encoding="utf-8")
anchor = """  assert.ok(state.comments.some((comment) => comment.issue_number === state.issues[0].number && /recovered/.test(comment.body)));\n\n  // Same run ID with a higher successful attempt is also newer and can recover a rerun.\n"""
insertion = """  assert.ok(state.comments.some((comment) => comment.issue_number === state.issues[0].number && /recovered/.test(comment.body)));\n\n  // A delayed rerun of an older failure must not reopen after a newer recovery transition.\n  const commentsAfterRecovery = state.comments.length;\n  state.jobsByRun.set(101, failedJob('Delayed old failure attempt'));\n  const delayedFailureAfterRecovery = await runNotifier({\n    github,\n    context,\n    core,\n    workflowRun: makeRun({ id: 101, run_attempt: 2 }),\n  });\n  assert.equal(delayedFailureAfterRecovery.action, 'ignored-stale-failure');\n  assert.equal(state.issues[0].state, 'closed');\n  assert.equal(state.comments.length, commentsAfterRecovery);\n\n  // An event equal to the latest recovery transition is also a duplicate.\n  const duplicateRecoveryVersion = await runNotifier({\n    github,\n    context,\n    core,\n    workflowRun: makeRun({ id: 104, run_attempt: 1 }),\n  });\n  assert.equal(duplicateRecoveryVersion.action, 'ignored-stale-failure');\n  assert.equal(state.issues[0].state, 'closed');\n\n  // A genuinely newer failure after recovery reopens the same machine-key issue.\n  state.jobsByRun.set(105, failedJob('Genuinely newer post-recovery failure'));\n  const reopenedAfterRecovery = await runNotifier({\n    github,\n    context,\n    core,\n    workflowRun: makeRun({ id: 105 }),\n  });\n  assert.equal(reopenedAfterRecovery.action, 'reopened');\n  assert.equal(state.issues.length, 2);\n  assert.equal(state.issues[0].state, 'open');\n  assert.match(state.issues[0].body, /Genuinely newer post-recovery failure/);\n\n  const recoveredAgain = await runNotifier({\n    github,\n    context,\n    core,\n    workflowRun: makeRun({ id: 106, conclusion: 'success' }),\n  });\n  assert.equal(recoveredAgain.action, 'recovered');\n  assert.equal(state.issues[0].state, 'closed');\n\n  // Same run ID with a higher successful attempt is also newer and can recover a rerun.\n"""
if test.count(anchor) != 1:
    raise SystemExit(f"expected one deterministic contract anchor, found {test.count(anchor)}")
TEST.write_text(test.replace(anchor, insertion), encoding="utf-8")

source_contract = SOURCE_CONTRACT.read_text(encoding="utf-8")
source_anchor = """  must('notifier refuses ambiguous duplicate markers', notifier, /Ambiguous CI lifecycle state/);\n  mustNot('notifier infers routes from commit message', notifier, /affectedHint|msg\\.includes\\(|Подозреваемые route/);\n"""
source_insertion = """  must('notifier refuses ambiguous duplicate markers', notifier, /Ambiguous CI lifecycle state/);\n  must('failure ordering uses latest lifecycle transition', notifier, /latestTransition[\\s\\S]*previousState\\.latestSeen/);\n  mustNot('notifier infers routes from commit message', notifier, /affectedHint|msg\\.includes\\(|Подозреваемые route/);\n"""
if source_contract.count(source_anchor) != 1:
    raise SystemExit(f"expected one source contract anchor, found {source_contract.count(source_anchor)}")
source_contract = source_contract.replace(source_anchor, source_insertion)
contract_anchor = """  must('contract covers recovery', contract, /newer success closes the issue/);\n  must('contract covers factual failed steps', contract, /Evidence comes from job data/);\n"""
contract_insertion = """  must('contract covers recovery', contract, /newer success closes the issue/);\n  must('contract covers delayed failure after recovery', contract, /delayed rerun of an older failure must not reopen/);\n  must('contract covers genuine post-recovery failure', contract, /genuinely newer failure after recovery reopens/);\n  must('contract covers factual failed steps', contract, /Evidence comes from job data/);\n"""
if source_contract.count(contract_anchor) != 1:
    raise SystemExit(f"expected one contract coverage anchor, found {source_contract.count(contract_anchor)}")
source_contract = source_contract.replace(contract_anchor, contract_insertion)
mutation_anchor = """  {\n    label: 'recovery state reason removal',\n    key: 'notifier',\n    mutate: (source) => source.replace(\"    state_reason: 'completed',\\n\", ''),\n  },\n"""
mutation_insertion = mutation_anchor + """  {\n    label: 'latest transition ordering removal',\n    key: 'notifier',\n    mutate: (source) => source.replace(\n      '  const latestTransition = previousState && (previousState.latestSeen || previousFailure);\\n',\n      '  const latestTransition = previousFailure;\\n',\n    ),\n  },\n"""
if source_contract.count(mutation_anchor) != 1:
    raise SystemExit(f"expected one mutation anchor, found {source_contract.count(mutation_anchor)}")
SOURCE_CONTRACT.write_text(source_contract.replace(mutation_anchor, mutation_insertion), encoding="utf-8")

Path(__file__).unlink()
