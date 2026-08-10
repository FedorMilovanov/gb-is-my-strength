from pathlib import Path
import json, re

def patch_job(path, job_name, mutation_anchor, commit_message):
    p = Path(path)
    s = p.read_text()
    marker = f"\n  {job_name}:\n"
    start = s.find(marker)
    if start < 0:
        raise SystemExit(f"{path}:{job_name}: job missing")
    off = start + len(marker)
    rest = s[off:]
    m = re.search(r"\n  [A-Za-z0-9_-]+:\n", rest)
    end = len(s) if not m else off + m.start()
    job = s[off:end]

    def once(old, new, label):
        nonlocal job
        count = job.count(old)
        if count != 1:
            raise SystemExit(f"{path}:{job_name}:{label}: expected 1 got {count}")
        job = job.replace(old, new, 1)

    once(
        "    permissions:\n      contents: write\n",
        "    permissions:\n      contents: write\n      pull-requests: read\n",
        "permissions",
    )
    once(
        "          ref: ${{ github.event.pull_request.head.ref }}\n",
        "          ref: ${{ github.event.pul_request.head.sha }}\n",
        "immutable checkout",
    )
    lease_steps = (
        "      - name: Snapshot machine writer lease\n"
        "        run: node scripts/writer-lease.mjs snapshot\n\n"
        "      - name: Reject stale or foreign writer before mutation\n"
        "        env:\n"
        "          GITHUB_TOKEN: ${{ github.token }}\n"
        "        run: node scripts/writer-lease.mjs assert-live --phase=pre-mutation\n\n"
    )
    once(mutation_anchor, lease_steps + mutation_anchor, "lease pre-mutation")
    commit_anchor = f'          git commit -m "{commit_message}"\n'
    commit_index = job.find(commit_anchor)
    if commit_index < 0 or job.find(commit_anchor, commit_index + 1) >= 0:
        raise SystemExit(f"{path}:{job_name}:commit anchor must be unique")
    commit_step_start = job.rfind("      - name: ", 0, commit_index)
    if commit_step_start < 0:
        raise SystemExit(f"{path}:{job_name}:commit step missing")
    commit_step = job[commit_step_start:]
    env_old = "        env:\n          HEAD_REF: ${{ github.event.pull_request.head.ref }}\n"
    if commit_step.count(env_old) != 1:
        raise SystemExit(f"{path}:{job_name}:commit env expected 1 got {commit_step.count(env_old)}")
    commit_step = commit_step.replace(
        env_old,
        "        env:\n          HEAD_REF: ${{ github.event.pull_request.head.ref }}\n          GITHUB_TOKEN: ${{ github.token }}\n",
        1,
    )
    config = '          git config user.name "github-actions[bot]"\n'
    if commit_step.count(config) != 1:
        raise SystemExit(f"{path}:{job_name}:commit config expected 1 got {commit_step.count(config)}")
    guard = (
        "          node scripts/writer-lease.mjs assert-live --phase=pre-commit\n"
        "          EXPECTED_HEAD=\"$(node scripts/writer-lease.mjs field expectedHead)\"\n"
        "          LEASE_TRAILER=\"$(node scripts/writer-lease.mjs trailer)\"\n"
    )
    commit_step = commit_step.replace(config, guard + config, 1)
    if commit_step.count(commit_anchor) != 1:
        raise SystemExit(f"{path}:{job_name}:commit message expected 1 got {commit_step.count(commit_anchor)}")
    commit_step = commit_step.replace(
        commit_anchor,
        f'          git commit -m "{commit_message}" -m "${{LEASE_TRAILER}}"\n',
        1,
    )
    push_old = '          git push origin "HEAD:${HEAD_REF}"\n'
    if commit_step.count(push_old) != 1:
        raise SystemExit(f"{path}:{job_name}:commit push expected 1 got {commit_step.count(push_old)}")
    commit_step = commit_step.replace(
        push_old,
        '          node scripts/writer-lease.mjs assert-live --phase=pre-push\n'
        '          git push --force-with-lease="refs/heads/${HEAD_REF}:${EXPECTED_HEAD}" origin "HEAD:${HEAD_REF}"\n',
        1,
    )
    job = job[:commit_step_start] + commit_step
    p.write_text(s[:off] + job + s[end:])

patch_job(
    '.github/workflows/glossary-contract.yml',
    'placement-autofix',
    '      - name: Check normalizer syntax\n",
    'fix(content): normalize glossary and tooltip contracts',
)
patch_job(
    '.github/workflows/indexnow.yml',
    'headline-autofix',
     '      - name: Normalize registered article headlines\n',
    'fix(metadata): normalize canonical article headline',
)
patch_job(
    '.github/workflows/search-manifest-policy.yml',
    'search-manifest-autofix',
    '      - name: Install dependencies\n",
    'fix(search): align manifest, RSS and sitemap with route policy',
)
patch_job(
     '.github/workflows/scripture-occurrence-index-contract.yml',
    'scripture-occurrence-autofix',
    '      - name: Generate canonical Scripture occurrence index\n',
    'fix(scripture): regenerate occurrence index',
)

# Workflow Policy v2 becomes the permanent ratchet for current and future branch writers.
p = Path('scripts/check-workflows.js')
s = p.read_text()
replacements = [
    (
        "  must(file, job, /permissions:\\s*\\n\\s*contents:\\s*write/, `${jobName} must declare job-local contents: write`);\n",
        "  must(file, job, /permissions:\\s*\\n\\s*contents:\\s*write/, `${jobName} must declare job-local contents: write`);\n"
        "  must(file, job, /pull-requests:\\s*read/, `${jobName} must receive read-only PR metadata for live lease verification`);\n",
    ),
    (
        "  must(file, job, /ref:\\s*\\$\\{\\{\\s*github\\.event\\.pull_request\\.head\\.ref\\s*\\}\\}/, `${jobName} must checkout the exact PR branch`);\n",
        "  must(file, job, /ref:\\s*\\$\\{\\{\\s*github\\.event\\.pull_request\\.head\\.sha\\s*\\}\\}/, `${jobName} must checkout the immutable queued PR head`);\n"
        "  must(file, job, /node scripts\\/writer-lease\\.mjs snapshot/, `${jobName} must snapshot the queud machine writer lease`);\n"
        "  must(file, job, /writer-lease\\.mjs assert-live --phase=pre-mutation/, `${jobName} must reject a stale lease before local mutation`);\n"
        "  must(file, job, /writer-lease\\.mjs assert-live --phase=pre-commit/, `${jobName} must prove live lease + expected head before commit`);\n"
        "  must(file, job, /writer-lease\\.mjs assert-live --phase=pre-push/, `${jobName} must re-prove live lease + expected head immediately before push`);\n",
    ),
    (
        "  must(file, job, /\\bgit push origin \"HEAD:\\$\\{HEAD_REF\\}\"/, `${jobName} must push only to the checked PR branch`);\n",
        "  must(file, job, /--force-with-lease=\"refs\\/heads\\/\\$\\{HEAD_REF\\}:\\$\\{EXPECTED_HEAD\\}\"/, `${jobName} must CAS-push against the queued expected head`);\n"
        "  must(file, job, /Writer-Lease:|writer-lease\\.mjs trailer/, `${jobName} must stamp the machine lease identity into its commit`);\n"
        "  mustNot(file, job, /\\bgit push origin \"HEAD:\\$\\{HEAD_REF\\}\"/, `${jobName} must not blind-push a mutable branch ref`);\n",
    ),
    (
        "function isWriteCapabilityJob(job) {\n  return /^\\s*permissions:\\s*\\n\\s*contents:\\s*write\\s*$/m.test(job)\n",
        "function isWriteCapabilityJob(job) {\n  return /^\\s*contents:\\s*write\\s*$/m.test(job)\n",
    ),
    (
        "console.log('✅ Explicit autofix and transactional write capabilities are isolated and fail-closed');\n",
        "console.log('✅ Explicit autofix capabilities require machine writer lease + exact-head CAS; transactional observation remains isolated');\n",
    ),
]
for old, new in replacements:
    count = s.count(old)
    if count != 1:
        raise SystemExit(f"check-workflows replacement expected 1 got {count}: {old[:80]!r}")
    s = s.replace(old, new, 1)
p.write_text(s)

# Permission registry is the complete current branch-writer census.
p = Path('data/workflow-permission-policy.json')
policy = json.loads(p.read_text())
targets = {
    '.github/workflows/glossary-contract.yml': 'placement-autofix',
    '.github/workflows/indexnow.yml': 'headline-autofix',
    '.github/workflows/search-manifest-policy.yml': 'search-manifest-autofix',
    '.github/workflows/scripture-occurrence-index-contract.yml': 'scripture-occurrence-autofix',
}
markers = [
    "contains(github.event.pull_request.labels.*.name, 'autofix')",
    "github.event.pul_request.head.repo.full_name == github.repository",
    "ref: ${{ github.event.pull_request.head.sha }}",
    "node scripts/writer-lease.mjs snapshot",
    "node scripts/writer-lease.mjs assert-live --phase=pre-mutation",
    "node scripts/writer-lease.mjs assert-live --phase=pre-commit",
    "node scripts/writer-lease.mjs assert-live --phase=pre-push",
    '--force-with-lease="refs/heads/${HEAD_REF}:${EXPECTED_HEAD}"',
]
for workflow_path, job_name in targets.items():
    job = policy['workflows'][workflow_path]['jobs'][job_name]
    if job['permissions'].get('contents') != 'write':
        raise SystemExit(f"{workflow_path}:{job_name}: not a contents writer")
    job['permissions']['pull-requests'] = 'read'
    job['branchBoundary'] = 'immutable queued PR head plus active owner-token/generation lease; final push is CAS-bound to the same expected head'
    job['requiredMarkers'] = markers
policy['description'] = 'Fail-closed registry for every GitHub Actions write capability. Branch writers require an active machine-distinguishable writer lease and exact-head CAS; unregistered writes and mutable action refs are forbidden.'
p.write_text(json.dumps(policy, ensure_ascii=False, indent=2) + '\n')

# Clarify collision ownership vs mutation authority.
p = Path('docs/LANE_LOCK_POLICY.md')
s = p.read_text()
old = """The machine boundary is intentionally narrow and stateless:

- open same-repository pull requests are the active machine-readable ownership records; no lock file, lease, TTL, heartbeat or branch mutation exists;
"""
new = """The collision boundary is intentionally narrow and stateless:

- open same-repository pull requests are the active machine-readable collision/ownership records; the collision guard itself creates no lock file, TTL, heartbeat or branch mutation;
- branch-writing capability is governed separately by **Writer Lease v1** below; a writer lease never changes file-collision precedence or authorizes a second semantic owner;
"""
if s.count(old) != 1:
    raise SystemExit('LANE collision paragraph drift')
s = s.replace(old, new, 1)
anchor = '## 4. Active-work protection\n'
lease_doc = """### Machine writer lease — Writer Lease v1

Any same-repository PR that grants a repo-writing applicator/autofix must carry exactly one machine block in its PR body:

```md
<!-- GB_WRITER_LEASE_V1
{  "version": 1,
  \"laneId\": \"stable-lane-id\",
  \"pr\": 1234,
  \"branch\": \"lane/example\",
  \"ownerToken\": \"opaque-agent-session-token\",
  \"generation\": 1,
  \"acquisitionSha\": \"40-hex-head-at-acquisition\",
  \"status\": \"active\",
  \"handoff\": null,
  \"retirement\": null
}
GB_WRITER_LEASE_V1 -->
```

The owner token is public, opaque concurrency identity — **not a credential or secret**, and never inferred from Git author/committer names. Generation starts at 1. The acquisition SHA must be an ancestor of the queued writer head.

Permanent branch writers use `scripts/writer-lease.mjs`: checkout the immutable event head SHA, snapshot the event lease, compare the live PR lease and live head before mutation/commit/push, stamp `Writer-Lease: <owner>@<generation>` into the generated commit, then publish with `git push --force-with-lease=<branch>:<expected-head>`. A queued run fails closed when another actor moves the head or rotates the lease, even when both actors share one GitHub login.

Handoff is explicit only: successor generation is exactly predecessor generation + 1, owner token changes, `acquisitionSha` becomes the exact handoff head, and `handoff` records predecessor/successor token + generation + head. A later timestamp never steals a lease.

Retirement never uses TTL/age. The current owner changes `status` to `retired` without changing owner/generation/acquisition SHA and records exact `retirement.atHead`, a reason, and a final `BRANCH_LIFECYCLE_V4.md` disposition. Retirement ends write authority; it does not by itself authorize branch deletion, rewrite or closure. Read-only auditors do not need a writer lease.


"""
if s.count(anchor) != 1:
    raise SystemExit('LANE active-work anchor drift')
s = s.replace(anchor, lease_doc + anchor, 1)
p.write_text(s)

p = Path('docs/BRANCH_LIFECYCLE_V4.md')
s = p.read_text()
anchor = '## 7. Successor rule\n\n'
insert = """Machine writer-lease retirement is narrower than branch disposition: retiring a Writer Lease only ends mutation authority. It never proves a branch safe to close, rewrite or delete; the classifications below remain authoritative.

"""
if s.count(anchor) != 1:
    raise SystemExit('BRANCH successor anchor drift')
s = s.replace(anchor, anchor + insert, 1)
old = 'Do not close an actively used predecessor until the successor is real and the owner accepts the replacement boundary.\n'
new = 'Do not close an actively used predecessor until the successor is real and the owner accepts the replacement boundary. When the lane has an active Writer Lease v1, the same explicit handoff rotates the opaque owner token, increments generation by exactly one and binds the successor acquisition SHA to the exact handoff head; there is no timestamp-based takeover.\n'
if s.count(old) != 1:
    raise SystemExit('BRANCH handoff sentence drift')
s = s.replace(old, new, 1)
p.write_text(s)

# Bootstrap automation must disappear in the same transaction.
for rel in ['.github/workflows/system-d-one-shot.yml', '.github/workflows/system-d-bootstrap-pr.yml', 'scripts/system-d-bootstrap.py']:
    Path(rel).unlink()
