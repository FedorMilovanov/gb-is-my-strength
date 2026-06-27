# Local Windows audit pack — Fedor workstation

**Target local repo:** `C:\Users\Fedor\Projects\gb-is-my-strength`
**Primary script:** `audit/external-checks/run-local-windows-audit.ps1`
**Purpose:** run checks that are too heavy/noisy/impossible in Arena, without adding them blindly to CI.

This file is the update point for local-only check decisions. Keep it compact: if a check is rejected, record it here so future agents do not rediscover the same dead end.

## How to run

From PowerShell or CMD, use the root launcher:

```powershell
cd C:\Users\Fedor\Projects\gb-is-my-strength
.\RUN-LOCAL-WINDOWS-AUDIT.cmd
```

Optional deeper/noisy re-evaluation:

```powershell
.\RUN-LOCAL-WINDOWS-AUDIT.cmd -RunNoisy -RunFullTrivy
```

Do **not** paste the full `.ps1` file into PowerShell. When pasted line by line, `$PSScriptRoot` is empty and the `param(...)` block is no longer script metadata. Execute the file/launcher instead.

Reports are written under:

```text
C:\Users\Fedor\Projects\gb-is-my-strength\reports\local-external-checks-<timestamp>\
```

The main report is intentionally compact. Full command output is split into per-check logs under `logs\` inside the same report folder. Do not commit raw 20k+ line reports to repo root.

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


## PowerShell / Windows references used for this runner

These are implementation references for Windows 11 Pro / PowerShell usage. They justify the current launcher pattern and argument/redirect handling.

1. PowerShell about_Scripts — `$PSScriptRoot`, script execution, execution policy: https://github.com/MicrosoftDocs/PowerShell-Docs/blob/main/reference/7.6/Microsoft.PowerShell.Core/About/about_Scripts.md
2. Set-ExecutionPolicy docs: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/set-executionpolicy
3. PowerShell about_Parsing — native command argument mode: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_parsing
4. PowerShell about_Redirection: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_redirection
5. Start-Process docs: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/start-process
6. about_Automatic_Variables: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_automatic_variables
7. about_Execution_Policies: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies
8. about_Preference_Variables: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_preference_variables
9. about_Operators: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_operators
10. about_Environment_Variables: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_environment_variables
11. about_Quoting_Rules: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_quoting_rules
12. Tee-Object docs: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/tee-object
13. Out-File docs: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/out-file
14. ConvertTo-Json docs: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/convertto-json
15. Invoke-RestMethod docs: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/invoke-restmethod
16. Invoke-WebRequest docs: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/invoke-webrequest
17. Expand-Archive docs: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.archive/expand-archive
18. Get-Command docs: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/get-command
19. Resolve-Path docs: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/resolve-path
20. Join-Path docs: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/join-path
21. PowerShell script security / signing overview: https://learn.microsoft.com/en-us/powershell/scripting/security/security-features
22. GitHub CLI / Git credential hygiene reference: https://docs.github.com/en/get-started/git-basics/caching-your-github-credentials-in-git
23. Node.js Windows downloads: https://nodejs.org/en/download
24. npm ci docs: https://docs.npmjs.com/cli/commands/npm-ci
25. npm audit docs: https://docs.npmjs.com/cli/commands/npm-audit
26. npm sbom docs: https://docs.npmjs.com/cli/commands/npm-sbom
27. Playwright install browsers docs: https://playwright.dev/docs/browsers
28. Playwright CI docs: https://playwright.dev/docs/ci
29. Lighthouse CLI docs: https://github.com/GoogleChrome/lighthouse#using-the-node-cli
30. Pa11y CLI docs: https://github.com/pa11y/pa11y
31. actionlint usage docs: https://github.com/rhysd/actionlint/blob/main/docs/usage.md
32. OSV Scanner releases/docs: https://github.com/google/osv-scanner
33. Gitleaks docs: https://github.com/gitleaks/gitleaks
34. Trivy filesystem docs: https://trivy.dev/docs/latest/target/filesystem/
35. CycloneDX npm docs: https://github.com/CycloneDX/cyclonedx-node-npm
36. PowerShell 7 releases: https://github.com/PowerShell/PowerShell/releases


## Report storage policy

- `reports/` is git-ignored. Keep raw local outputs there.
- Do not commit root files like `LOCAL_REPO_AUDIT_REPORT.txt` or huge pasted-console captures.
- The runner writes:
  - `LOCAL_WINDOWS_AUDIT_REPORT.md` — compact report with excerpts and links to logs;
  - `summary.json` — machine-readable PASS/WARN/FAIL summary;
  - `logs/*.log` — full per-check output.
- If agents need to review local results, send/upload only `summary.json` and the compact `LOCAL_WINDOWS_AUDIT_REPORT.md` first. Add individual `logs/*.log` only for failed checks.
