# External checks registry

**Updated:** 2026-07-24  
**Purpose:** one governed entry point for optional third-party quality/security checks. External tools supplement repository contracts; they do not silently become blocking gates.

## 1. Current rules

1. Run repository-native checks first. An external scanner does not replace source, browser, visual or publication contracts.
2. Record the exact source SHA, tool version, command, environment and raw report location.
3. Treat old findings as historical until reproduced on current `main`.
4. Do not commit large raw logs by default. Use `reports/` or a workflow artifact with explicit retention.
5. Do not add a network-installed executable to CI without version pinning and integrity/provenance review.
6. Never auto-run destructive dependency upgrades such as `npm audit fix --force`.
7. A scanner exit code is not automatically a product defect; triage the finding against shipped code and repository policy.

The original June 2026 registry, including all measured scores and 40+ reference links, remains in Git at blob `51b88b508292203c6fca8c8feb85ef6004cf81a6`. Those measurements are historical, not current baseline values.

## 2. Repository-native baseline

Before external checks:

```bash
npm ci
npm run guard:shared-files
npm run control-plane:audit
npm run workflows:check
npm run validate:static-publication
```

Add current route/browser/visual contracts for the affected surface. Environment setup is capability-detected through `docs/SANDBOX-ENV-2026-06-21.md`; do not assume E2B, root, open network or a fixed `/tmp/node-*` path.

## 3. Actionlint — canonical path

Use only the repository-pinned, checksum-verified runner:

```bash
node scripts/run-actionlint.mjs
# after package alias convergence:
npm run workflows:lint
```

Do not add another inline installer and do not use an unpinned `npx actionlint` path. The permanent repository control-plane audit detects duplicated inline installers and alias drift.

## 4. Local Windows runner

The maintained launcher exists at the repository root:

```powershell
cd C:\Users\Fedor\Projects\gb-is-my-strength
.\RUN-LOCAL-WINDOWS-AUDIT.cmd
```

Deep/noisy mode:

```powershell
.\RUN-LOCAL-WINDOWS-AUDIT.cmd -RunNoisy -RunFullTrivy
```

Reports are written under `reports\local-external-checks-*`. Execute the script file rather than pasting its PowerShell body into an interactive console; `$PSScriptRoot` and `param(...)` depend on script execution semantics.

See `audit/external-checks/LOCAL-WINDOWS-AUDIT.md` for the current local-only set.

## 5. Tool disposition

These are policy categories, not claims that a June result still reproduces.

| Tool | Disposition | Current use |
|---|---|---|
| actionlint | `KEEP / PINNED` | GitHub Actions syntax/expression validation through `scripts/run-actionlint.mjs`. |
| npm audit | `KEEP / TRIAGE` | Dependency advisory inventory; no automatic forced upgrades. |
| OSV Scanner | `KEEP / PINNED-OR-LOCAL` | Independent lockfile advisory check when a verified binary is available. |
| Retire.js | `KEEP / DIAGNOSTIC` | Repository/dist JavaScript advisory scan. |
| Pa11y / axe-core | `KEEP / DIAGNOSTIC` | Accessibility checks against a running production-like server; confirm with DOM/browser evidence. |
| Lighthouse | `KEEP / DIAGNOSTIC` | Performance/a11y/best-practice observation; local server compression and hardware affect scores. |
| Linkinator / Lychee | `KEEP / DIAGNOSTIC` | Internal/external link discovery; distinguish network failure from broken source. |
| Semgrep CE | `KEEP / TRIAGE` | SAST for source/workflow patterns; validate reachability and policy. |
| Checkov / zizmor | `KEEP / TRIAGE` | GitHub Actions hardening; findings need repository-specific allowlist/decision. |
| Gitleaks | `KEEP` | Secret discovery with redaction. Never expose a candidate while discussing it. |
| detect-secrets | `CONFIG-FIRST` | Requires a reviewed baseline to avoid high-entropy hash/asset noise. |
| html-validate / Nu checker | `CONFIG-FIRST` | Generated Astro HTML needs project rules before a blocking gate. |
| full Trivy scans | `LOCAL/DEEP` | Resource/noise-heavy; use the Windows runner or a deliberate scheduled lane. |

## 6. Reverification record format

```md
Tool: <name + version>
Source SHA: <exact>
Environment: <OS/runtime/browser/network>
Command: <exact>
Target: <source / dist / live URL>
Exit: <code>
Report: <artifact/path + digest when durable>
Finding count: <raw>
Triage: <confirmed / false positive / config debt / needs owner>
Canonical issue: <AuditRepo ID or none>
```

Do not update a canonical bug count directly from an untriaged scanner output.

## 7. Serving production-like output

When a tool needs HTTP:

```bash
npm run strangler:build:production-like
npm run pagefind:build:dist
python3 -m http.server 8090 --bind 127.0.0.1 --directory dist
```

First verify that the current environment permits the build, browser and local port. A refused connection caused by an absent server is test setup failure, not a map/site defect.

## 8. Historical findings

The June registry recorded useful discoveries, including workflow template-injection candidates, noisy default HTML validation, dependency advisories, contrast findings and absent secrets. None should be quoted as current without a new run on an exact SHA.

Old labels such as `BUG-032`, `BUG-033`, `BUG-034` and old Gill-selector failures are historical references. Current defect status comes from AuditRepo and current exact-head contracts, not this registry.

## 9. Adding a tool

Before adding a new external check:

- confirm it is not already classified here or in `LOCAL-WINDOWS-AUDIT.md`;
- verify license, release provenance and installation path;
- run it non-blocking on an exact SHA;
- measure runtime, noise and false-positive rate;
- document whether it inspects source, built output or live production;
- open a separate system/security lane before making it blocking.

No external tool may introduce a hidden writer, unpinned executable or surviving temporary workflow.
