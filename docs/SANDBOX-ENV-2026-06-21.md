# Sandbox environment capability policy

**Updated:** 2026-07-24  
**Historical origin:** Arena/E2B snapshot first recorded 2026-06-21–23.  
**Rule:** no agent may treat that historical snapshot as a universal current environment contract.

## 1. Why this file changed

The previous document stated session-specific observations as permanent facts: E2B/Firecracker, Debian 13, passwordless root, fully open outbound network, persistent files, exact CPU/RAM and particular tool behavior. Coding sessions now run through multiple runtimes and connectors with different limits. A stale environment claim can cause unsafe installation, credential, network and persistence assumptions.

The original 322-line snapshot remains immutable in Git at blob `9349b0868f6e9a8fdf4ba50de19b70c8cbf43936`. Use it only as historical Arena evidence.

## 2. Detect capabilities per session

Before depending on an environment feature, verify it in the current runtime.

```bash
# identity / OS / resources
id
uname -a
cat /etc/os-release 2>/dev/null || true
nproc 2>/dev/null || true
free -h 2>/dev/null || true
df -h . 2>/dev/null || true

# project toolchain
node --version 2>/dev/null || true
npm --version 2>/dev/null || true
python3 --version 2>/dev/null || true
git --version 2>/dev/null || true

# repository state
git status --short --branch
git remote -v
git rev-parse HEAD
git rev-parse origin/main 2>/dev/null || true
```

Do not install or mutate the system merely because an old document says root is available.

## 3. Network is capability-scoped

Test only the endpoint needed by the task. DNS, HTTPS, redirects, CORS and connector access are separate capabilities.

```bash
getent hosts github.com 2>/dev/null || true
curl -I --max-time 15 https://github.com 2>/dev/null || true
```

Interpretation:

- a GitHub connector may work while shell/container DNS is blocked;
- a successful server-side request does not prove browser CORS;
- a successful first URL does not prove a redirected CDN target is allowed;
- never weaken CSP or replace primary-source verification based on sandbox reachability alone.

Use the GitHub connector for repository operations when shell authentication/network is unavailable.

## 4. Filesystem and session persistence

Assume working directories, `/tmp`, installed packages, browser binaries and environment variables are ephemeral unless the current platform explicitly guarantees otherwise.

Before relying on persistence:

```bash
pwd
mount 2>/dev/null | head
printf 'session-probe\n' > /tmp/gb-session-probe
stat /tmp/gb-session-probe
```

A probe inside one turn proves only current-session behavior. Durable work belongs in a committed branch, a GitHub PR, an approved artifact or governed AuditRepo evidence.

## 5. Credentials and push

- Never expose PATs or tokens in chat, files, URLs, logs, issues or commits.
- Repository Actions secrets do not exist in an external shell.
- Verify authentication with a non-destructive command before planning a push.
- Normal writes use a branch and PR; see `docs/AGENT_PUSH_MODEL.md`.
- “I pushed” is not evidence; verify the remote SHA and PR head.

## 6. Node and dependency setup

The repository requires Node `>=22.12.0`. Detect the current version first. Prefer the runtime’s supported installation mechanism; do not blindly reuse a historical `/tmp/node-v22.12.0-linux-x64` path.

For a clean checkout:

```bash
node --version
npm ci
```

Use `npm ci`, not `npm install`, when reproducing the lockfile. If installation is impossible because of network or resource restrictions, record the exact blocker and rely on exact-head CI rather than claiming local success.

## 7. Browser verification

Playwright browser availability is session-specific.

```bash
npx playwright --version
npx playwright install --dry-run chromium 2>/dev/null || true
```

Install only the required engine when permitted. A Chromium pass does not replace required WebKit coverage; current route/browser contracts are defined by repository scripts and CI.

OCR is never the default method for reading screenshots. Prefer browser DOM/computed-style assertions and native vision; use OCR only as a last resort for text that cannot otherwise be inspected.

## 8. Resource discipline

Detect resources rather than assuming a fixed 2 CPU / 2 GB sandbox.

- avoid parallel build-heavy jobs on constrained machines;
- use targeted iteration checks;
- run the appropriate final barrier in CI or a capable environment;
- never turn an OOM, timeout or missing browser into a product failure without reproducing it under the intended contract.

Current verification guidance lives in `docs/WORK_MODES.md` and `docs/LANE_LOCK_POLICY.md`.

## 9. Tool-specific truth

File-editing, shell, GitHub connector, browser and artifact tools may have different visibility and persistence. Confirm that the file or ref exists in the system that will consume it.

Examples:

- a GitHub file reference is not automatically a local container path;
- a local generated artifact is not in the repository until explicitly committed/uploaded;
- a closed PR head may eventually lose its service ref unless preserved by a durable branch/tag or governed evidence;
- an Actions artifact has retention limits and is not a permanent source of truth by itself.

## 10. Session handoff

Record only facts another agent can reproduce:

```md
Runtime/platform: <observed>
Repository SHA: <exact>
Network capabilities: <tested endpoints>
Installed tool versions: <exact>
Checks run: <commands + results>
Unavailable checks: <exact blocker>
Durable outputs: <PR / commit / artifact / issue>
```

Do not promote an environment diary into product or production truth.
