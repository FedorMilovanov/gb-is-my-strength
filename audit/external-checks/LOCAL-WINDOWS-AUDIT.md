# Local Windows audit pack — Fedor workstation

**Target local repo:** `C:\Users\Fedor\Projects\gb-is-my-strength`
**Primary script:** `audit/external-checks/run-local-windows-audit.ps1`
**Purpose:** run checks that are too heavy/noisy/impossible in Arena, without adding them blindly to CI.

This file is the update point for local-only check decisions. Keep it compact: if a check is rejected, record it here so future agents do not rediscover the same dead end.

## How to run

From PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
cd C:\Users\Fedor\Projects\gb-is-my-strength
.\audit\external-checks\run-local-windows-audit.ps1
```

Optional deeper/noisy re-evaluation:

```powershell
.\audit\external-checks\run-local-windows-audit.ps1 -RunNoisy -RunFullTrivy
```

Reports are written under:

```text
C:\Users\Fedor\Projects\gb-is-my-strength\reports\local-external-checks-<timestamp>\
```

## Arena-rejected / local-only candidates

| Check | Arena status | Why not in Arena | Local decision |
|---|---|---|---|
| Full Trivy vulnerability DB scan | `REJECTED-IN-ARENA` | DB download hit sandbox disk limit: `no space left on device` | Run locally with `-RunFullTrivy`; local disk should handle DB/cache. |
| Knip | `REJECTED-IN-ARENA` | two retries crashed in `oxc-parser` with `Array buffer allocation failed` | Run only with `-RunNoisy`; useful if local RAM is enough. |
| CSpell generic scan | `REJECTED` | Russian text/transliterated slugs produce 300k+ unknown words | Do not run by default. Only after Russian/custom dictionary exists. |
| markdownlint-cli2 full repo | `CONFIG-FIRST` | 17k+ style errors from old research/build-tool docs | Do not block; run only on changed docs or after config. |
| html-validate full dist | `CONFIG-FIRST` | 1591 default-rule errors without project config | Run manually if creating `.htmlvalidate` baseline. |
| Prettier full repo | `CONFIG-FIRST` | needs Astro plugin + project formatting decision; `site-layered.css` parse issue | Do not run as blocking gate; use only for config migration. |
| ESLint v9 | `CONFIG-FIRST` | no `eslint.config.*` | Not useful until config lane. |
| Stylelint | `CONFIG-FIRST` | no stylelint config | Not useful until config lane. |
| Biome | `CONFIG-FIRST` | thousands of formatter/import diagnostics | Not useful until Biome migration decision. |
| Lighthouse local python server as strict perf gate | `KEEP-ADVISORY` | local server lacks prod compression/cache/CDN headers | Use as diagnostic, not pass/fail. |
| dependency-cruiser no-config | `KEEP-ADVISORY` | no-config mode low value | Use only after architecture config exists. |

## Checks worth running locally by default

- Project gates: `validate:all`, `seo-audit`, `data:consistency`, `content:guard`, `content:parity`, `mdx:structure:audit`, `gill:reading-time:audit`, `gill:pagefind:audit`.
- Build/dist gates: `strangler:build:production-like`, `pagefind:build:dist`, `dist:jsonld:audit`, `dist:css-parity`, `sw:dist:audit:pagefind`, `strangler:smoke`.
- Browser gates: `interactive-audit`, `visual-audit`, `smoke:maps`, `smoke:maps:mobile`, `smoke:content:mobile`, `smoke:konfessii`.
- Security/supply-chain: `npm audit`, `npm audit signatures`, `npm sbom`, CycloneDX, OSV, Gitleaks, Retire.js, lockfile-lint.
- Workflow security: `actionlint` strict mode, Semgrep, Checkov, zizmor.
- Docs/links: Lychee/linkinator local scans.

## Update policy

When a local report is sent back:

1. Add only durable decisions here.
2. Put real bugs into `docs/BUGS_FOUND_2026-06-25.md`.
3. Put tool verdicts into `audit/external-checks/README.md` if the tool should affect future agents.
4. Do not commit raw local reports unless specifically requested.
