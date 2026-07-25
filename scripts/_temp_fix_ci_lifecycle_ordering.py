#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE = ROOT / "scripts/ci-failure-lifecycle.cjs"
TEST = ROOT / "scripts/ci-failure-lifecycle-contract-test.cjs"

module = MODULE.read_text(encoding="utf-8")
old = """  const previousFailure = previousState && previousState.latestFailure;\n\n  if (previousFailure && compareRunVersion(current, previousFailure) <= 0) {\n    core.info(`Ignoring stale/duplicate failure run ${current.id}/${current.attempt}`);\n    return { action: 'ignored-stale-failure', issueNumber: existing.number };\n  }\n"""
new = """  const previousFailure = previousState && previousState.latestFailure;\n  const latestTransition = previousState && (previousState.latestSeen || previousFailure);\n\n  if (latestTransition && compareRunVersion(current, latestTransition) <= 0) {\n    core.info(\n      `Ignoring stale/duplicate failure run ${current.id}/${current.attempt}; ` +\n      `latest transition is ${latestTransition.id}/${latestTransition.attempt}`,\n    );\n    return { action: 'ignored-stale-failure', issueNumber: existing.number };\n  }\n"""
if module.count(old) != 1:
    raise SystemExit(f"expected one module ordering block, found {module.count(old)}")
MODULE.write_text(module.replace(old, new), encoding="utf-8")

test = TEST.read_text(encoding="utf-8")
anchor = """  assert.ok(state.comments.some((comment) => comment.issue_number === state.issues[0].number && /recovered/.test(comment.body)));\n\n  // Same run ID with a higher successful attempt is also newer and can recover a rerun.\n"""
insertion = """  assert.ok(state.comments.some((comment) => comment.issue_number === state.issues[0].number && /recovered/.test(comment.body)));\n\n  // A delayed rerun of an older failure must not reopen after a newer recovery transition.\n  const commentsAfterRecovery = state.comments.length;\n  state.jobsByRun.set(101, failedJob('Delayed old failure attempt'));\n  const delayedFailureAfterRecovery = await runNotifier({\n    github,\n    context,\n    core,\n    workflowRun: makeRun({ id: 101, run_attempt: 2 }),\n  });\n  assert.equal(delayedFailureAfterRecovery.action, 'ignored-stale-failure');\n  assert.equal(state.issues[0].state, 'closed');\n  assert.equal(state.comments.length, commentsAfterRecovery);\n\n  // A genuinely newer failure after recovery reopens the same machine-key issue.\n  state.jobsByRun.set(105, failedJob('Genuinely newer post-recovery failure'));\n  const reopenedAfterRecovery = await runNotifier({\n    github,\n    context,\n    core,\n    workflowRun: makeRun({ id: 105 }),\n  });\n  assert.equal(reopenedAfterRecovery.action, 'reopened');\n  assert.equal(state.issues.length, 2);\n  assert.equal(state.issues[0].state, 'open');\n  assert.match(state.issues[0].body, /Genuinely newer post-recovery failure/);\n\n  const recoveredAgain = await runNotifier({\n    github,\n    context,\n    core,\n    workflowRun: makeRun({ id: 106, conclusion: 'success' }),\n  });\n  assert.equal(recoveredAgain.action, 'recovered');\n  assert.equal(state.issues[0].state, 'closed');\n\n  // Same run ID with a higher successful attempt is also newer and can recover a rerun.\n"""
if test.count(anchor) != 1:
    raise SystemExit(f"expected one deterministic-test anchor, found {test.count(anchor)}")
TEST.write_text(test.replace(anchor, insertion), encoding="utf-8")

# The workflow is removed externally after this one-shot patch commits.
Path(__file__).unlink()
