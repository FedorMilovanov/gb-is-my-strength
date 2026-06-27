# External Audit Empirical Results — 2026-06-27

**Project:** gb-is-my-strength / gospod-bog.ru  
**Branch:** `lane/system-premiumcontrols-dist-gate-wiring-2026-06-27`  
**Source HEAD tested:** `01b38ac0`  
**Mode:** empirical tool verification, not broad refactor  
**Environment:** Arena/E2B, Node `v22.12.0`, npm `10.9.0`, Playwright Chromium installed, 4 GiB temporary swap enabled.

---

## 1. Environment setup that worked

```bash
export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH
sudo fallocate -l 4G /swapfile-arena || true
sudo chmod 600 /swapfile-arena
sudo mkswap /swapfile-arena || true
sudo swapon /swapfile-arena || true
npm run strangler:build:production-like
npm run pagefind:build:dist
python3 -m http.server 8080 --bind 127.0.0.1 -d dist
```

Lighthouse required explicit Chrome path in this sandbox:

```bash
export CHROME_PATH=/home/user/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome
```

Without `CHROME_PATH`, Lighthouse failed with:

```text
The CHROME_PATH environment variable must be set to a Chrome/Chromium executable
```

---

## 2. 30+ link verification

Extracted external links from `docs/EXTERNAL_AUDIT_CHECKS_TOOLBOX_2026-06-27.md` and checked them with `curl -I -L`.

Result:

```text
TOTAL 72 external URLs checked
OK-ish 72
PROBLEM 0
```

Notes:

- Some URLs are login-gated or product pages, but they resolve (`200`/redirect) and are real.
- `cards-dev.twitter.com/validator` redirects to X login; useful only manually with account access.
- PageSpeed Insights API endpoint is real but returned quota error without API key.

---

## 3. Tools actually executed and empirical value

| Tool | Status in Arena | Result | Keep? |
|---|---|---|---|
| Lighthouse CLI | ✅ Works with `CHROME_PATH` | Produced JSON scores for home and Gill | ✅ Keep |
| Pa11y (`axe` runner) | ✅ Works | Found real a11y classes: contrast and ARIA | ✅ Keep |
| Linkinator | ✅ Works | Scanned 346 local links, all OK | ✅ Keep |
| `html-validator-cli` | ⚠️ Works but remote/flaky | Home: 22 errors + 28 warnings; Gill: W3C 502 | ⚠️ Keep as sample/warn-only |
| `npm audit --json` | ✅ Works | 8 dev vulns: 3 low, 5 moderate, 0 high/critical | ✅ Keep |
| Retire.js | ✅ Works | No vulnerable JS libs found (`data: []`) | ✅ Keep |
| markdownlint-cli2 | ✅ Works | Found style defects in new toolbox doc; fixed | ✅ Keep for docs |
| curl production headers | ✅ Works | HSTS present; CSP/XCTO/XFO/Referrer/Permissions absent | ✅ Keep as advisory |
| PageSpeed Insights API | ❌ Needs API key/quota | Returned 429 quota error | ❌ Do not rely without key |
| `@axe-core/cli` | ❌ Bad fit in Arena npx | Could not find Chrome binary even with env; pa11y covers axe better | ❌ Drop local quick path |
| Semgrep via `npx` | ❌ Bad invocation/package path | `npm error could not determine executable to run` | ⚠️ Use Docker/pip/GitHub Action only |
| Lychee via `npx` | ❌ Not an npm quick tool here | `could not determine executable` | ⚠️ Use binary/GitHub Action, or Linkinator locally |
| Gitleaks via `npx` | ❌ Not an npm quick tool here | `could not determine executable` | ⚠️ Use binary/GitHub Action |

---

## 4. Concrete findings from new checks

### 4.1 Lighthouse

Home:

```text
performance      65
accessibility    95
best-practices   75
seo              100
```

Gill context:

```text
performance      56
accessibility    92
best-practices   75
seo              100
```

Common failed Lighthouse audits:

- browser console errors logged;
- third-party cookies;
- main-thread work;
- LCP element / LCP image discovery;
- color contrast;
- unused CSS;
- text compression when served by local Python server;
- cache lifetimes when served locally.

Interpretation:

- SEO is strong in Lighthouse.
- Performance findings are useful but local Python server makes compression/cache results non-production-representative.
- LCP and unused CSS are worth future review.

### 4.2 Pa11y / axe runner

Home:

```text
105 issues
101 color-contrast
4 aria-prohibited-attr
```

Gill context:

```text
64 issues
33 aria-allowed-attr
29 color-contrast
1 aria-hidden-focus
1 aria-valid-attr-value
```

Kod da Vinci / PremiumControls route:

```text
118 issues
84 color-contrast
24 aria-allowed-attr
7 aria-hidden-focus
1 scrollable-region-focusable
1 aria-prohibited-attr
1 aria-valid-attr-value
```

Interpretation:

- Pa11y is the strongest newly tested tool for this repo.
- The biggest classes are contrast and ARIA semantics.
- PremiumControls speed-panel radio buttons likely need semantic review: pa11y flags `aria-allowed-attr` around generated speed buttons.
- This should start as warn-only; color contrast is highly visual/owner-sensitive.

### 4.3 HTML validator

`html-validator-cli --file dist/index.html --format json --verbose`:

```text
50 messages total
22 errors
28 warnings
```

Examples:

- bad `http-equiv="X-Content-Type-Options"` meta;
- unnecessary `role="navigation"` on `nav`;
- unnecessary `role="list"` on `ul`;
- `aria-label` on generic `div` without role;
- several `href` not allowed at this point.

Interpretation:

- Useful but noisy; run first on representative pages, not whole site blocking.
- The `http-equiv="X-Content-Type-Options"` issue is a real standards finding; security headers belong in HTTP response headers, not meta.

### 4.4 Linkinator

```text
Successfully scanned 346 links in 3.186 seconds.
```

Exit code `0`.

Interpretation:

- Excellent local broken-link smoke.
- More practical in Arena than Lychee npx.

### 4.5 npm audit

```text
3 low
5 moderate
0 high
0 critical
8 total
```

Interpretation:

- Not an immediate P0 because all are dev/transitive in current evidence.
- Should be tracked; do not run `npm audit fix --force` blindly because it proposes major/dev-tool changes.

### 4.6 Retire.js

```json
"data": [], "messages": [], "errors": []
```

Interpretation:

- Good lightweight JS dependency/browser-library witness.
- No issue found in this pass.

### 4.7 Production security headers via curl

Production response for `https://gospod-bog.ru/` showed:

```text
strict-transport-security: present
content-security-policy: missing
x-content-type-options: missing
x-frame-options: missing
referrer-policy: missing
permissions-policy: missing
cross-origin-opener-policy: missing
```

Interpretation:

- This is production/platform-level evidence, not source HTML evidence.
- Since the site is on GitHub Pages, adding headers may require platform/CDN strategy, not just Astro/source changes.
- Keep as advisory unless/ until deployment platform supports custom headers.

---

## 5. Curated keep/defer/drop list after empirical testing

### Keep now — real and useful

1. Lighthouse CLI with explicit `CHROME_PATH`.
2. Pa11y with axe runner.
3. Linkinator local crawl.
4. `html-validator-cli` sample-page validation.
5. `npm audit --json` baseline.
6. Retire.js.
7. markdownlint-cli2 for docs.
8. Production header check with `curl`.
9. SecurityHeaders.com / Mozilla Observatory / SSL Labs as manual production checks.
10. W3C / Rich Results / Schema validators as manual semantic checks.

### Defer / use externally or in CI only

1. PageSpeed Insights API — needs real API key/quota.
2. Semgrep — use Docker/pip/GitHub Action, not `npx` quick path.
3. Gitleaks — use official binary/GitHub Action, not `npx` quick path.
4. TruffleHog — use official binary/GitHub Action.
5. Lychee — use binary/GitHub Action; locally Linkinator is simpler.
6. Percy / Argos / Chromatic — useful only if owner wants external visual review workflow.

### Drop from Arena local quick checks

1. `@axe-core/cli` direct npx path — Chrome binary detection failed; Pa11y already runs axe successfully.
2. PageSpeed no-key API calls — quota error, not reliable.
3. Whole-site W3C validation as blocking gate — likely too noisy/flaky at first.

---

## 6. Recommended next implementation lane

If owner approves, add **warn-only** scripts, not blocking deploy gates:

```json
"external:a11y:pa11y:home": "pa11y http://127.0.0.1:8080/ --standard WCAG2AA --runner axe --reporter json",
"external:links:local": "linkinator http://127.0.0.1:8080/ --recurse --verbosity error",
"external:perf:lighthouse:home": "lighthouse http://127.0.0.1:8080/ --output=json --output-path=reports/lighthouse-home.json",
"external:deps:audit": "npm audit --json",
"external:deps:retire": "retire --path . --outputformat json"
```

But first create baselines and suppressions. Do not turn Pa11y or W3C validation into blocking gates until visual/ARIA policy is reviewed.

---

## 7. Evidence files generated locally

Generated under ignored `reports/external-audit-2026-06-27/`:

```text
external-tool-url-head-check.tsv
lighthouse-home.json
lighthouse-gill-context.json
pa11y-home.out
pa11y-gill.out
pa11y-premium.out
htmlval-home.json
linkinator-local.out
npm-audit-json.out
retire.json
markdownlint-toolbox-after.out
production-headers.txt
empirical-summary.json
```

These are not committed by default because `reports/` is ignored. If needed, copy curated evidence into AuditRepo.

---

## 8. Round 2 empirical retries and additional tools

This round followed the rule: if a tool does not start, try 2–3 realistic launch modes before rejecting it.

### 8.1 Pa11y-ci sitemap

Command shape:

```bash
npx pa11y-ci \
  --sitemap http://127.0.0.1:8081/sitemap.xml \
  --sitemap-find https://gospod-bog.ru \
  --sitemap-replace http://127.0.0.1:8081 \
  --threshold 9999 \
  --reporter json
```

Result:

```text
total: 43 routes
passes: 7
errors: 615
```

Interpretation:

- Very useful as a broad accessibility witness.
- Too noisy for blocking CI today.
- Findings are dominated by contrast; start as scheduled/warn-only.

### 8.2 LHCI collect

First attempt failed because Chrome was not discoverable. Retried with `CHROME_PATH` exported and it succeeded.

```text
Running Lighthouse 1 time on /
Run #1...done.
```

Interpretation: LHCI is viable, but the repo must document `CHROME_PATH` for Arena or install system Chrome in CI.

### 8.3 Unlighthouse

Command shape:

```bash
CHROME_PATH=/home/user/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome \
  npx @unlighthouse/cli \
  --site http://127.0.0.1:8081 \
  --urls /,/articles/dzhon-gill-istoricheskiy-kontekst/ \
  --samples 1 \
  --reporter json
```

Result:

```text
2 routes in 30s
Generated json report
```

Notes:

- Works in Arena with explicit Chrome path.
- Warns that its current Lighthouse dependency wants Node `>=22.19`; current project Node pin is `22.12.0`.
- Good candidate for manual/scheduled runs, not immediate blocking gate.

### 8.4 webhint

Attempts:

1. `npx hint URL --format json` — wrong option (`--formatters` needed).
2. `npx hint URL --formatters json` — failed due missing X server.
3. `xvfb-run -a npx hint URL --formatters json` — still failed: no supported browser installation found.

Interpretation:

- Not worth local Arena use.
- Could be revisited only with a dedicated installed Chrome/Puppeteer setup.

### 8.5 Stylelint with minimal config

A no-config run fails because stylelint requires configuration. Retried with a minimal temporary config for syntax/duplicates.

It found a **real CSS parse defect** in `css/floating-cluster.css`:

```text
Cannot parse selector around line 967:
v15: MOBILE PREVIEW — Save REMOVED from bottom-bar
```

Root cause: malformed comments around the v15 mobile bottom-bar section.

Fix applied in source:

```text
css/floating-cluster.css comment syntax normalized
```

Post-fix:

```text
parseErrors: []
warnings: 28
```

Remaining stylelint warnings are mostly duplicate/empty-block technical debt and should not be mass-fixed in this lane.

### 8.6 Semgrep

Attempts:

1. `npx semgrep ...` — failed (`could not determine executable`).
2. `pip install --user semgrep`, then direct `/home/user/.local/bin/semgrep` — failed because `pysemgrep` was not in PATH.
3. Retried with `PATH=/home/user/.local/bin:$PATH` — succeeded.

Result:

```text
Semgrep 1.168.0
74 rules
125 tracked JS/TS files scanned
0 findings
2 partial parsing warnings
several taint fixpoint timeouts in large/minified files
```

Interpretation:

- Semgrep is viable in Arena via pip + PATH fix.
- Best used warn-only / SARIF at first.
- Need tuned excludes for minified/generated files.

### 8.7 Depcheck

Result highlights:

- flagged devDependencies that look unused: `@astrojs/check`, `@astrojs/rss`, `typescript`;
- flagged missing deps inside `_build-tools/konfessii-baptizm` snapshot paths: `framer-motion`, `three`, `lucide-react`, etc.;
- flagged parser errors in some scripts due non-standard/minified patterns.

Interpretation:

- Too noisy without excludes.
- Useful only after ignoring `_build-tools`, generated/minified JS, and package-script-only dependencies.

### 8.8 npm-check-updates

Found available major upgrades:

```json
{
  "@astrojs/mdx": "^7.0.0",
  "@astrojs/react": "^6.0.0",
  "astro": "^7.0.3",
  "pixelmatch": "^7.2.0"
}
```

Interpretation:

- Useful as advisory only.
- Do not upgrade in PremiumControls lane.

### 8.9 license-checker

`--production` only sees the private root package because dependencies are dev-only.

Interpretation:

- Not useful as production-only for this static build repo.
- If used, run dev dependency license inventory separately and classify noise.

### 8.10 OSV scanner

`npx osv-scanner` failed because it is not an npm package.

Interpretation:

- Use official binary/GitHub Action, not npx.

---

## 9. Round 2 keep/defer/drop update

### Keep / can be implemented as repo scripts after baseline

- Lighthouse CLI / LHCI with explicit `CHROME_PATH` note.
- Pa11y and pa11y-ci, warn-only first.
- Linkinator.
- Stylelint with a small custom config, but initially only syntax-level rules.
- Semgrep via pip/GitHub Action, with tuned excludes.
- Retire.js.
- npm audit.
- markdownlint-cli2.

### Manual / scheduled only

- Unlighthouse: works, but heavier and wants newer Node than project minimum.
- PageSpeed Insights API: key/quota required.
- SecurityHeaders / Observatory / SSL Labs.
- W3C/Rich Results/Schema validators.

### Drop from local Arena quick path

- webhint, unless a dedicated supported browser install is configured.
- direct `@axe-core/cli`, because Pa11y already runs axe successfully.
- Lychee/Gitleaks/OSV via npx; use official binaries/actions instead.
- Depcheck as generic check without repo-specific excludes.

---

## 10. New code change caused by external checks

`stylelint` found malformed CSS comments in `css/floating-cluster.css`. This was not caught by existing gates because browsers/builds tolerated it enough to continue.

Fix class:

```text
CSS comment syntax repair only; no visual tuning and no selector/property changes.
```

Post-fix targeted gates:

```text
npm run validate:all                    ✅ PASS
npm run strangler:build:production-like ✅ PASS
npm run audit:premium-controls          ✅ PASS (39/39)
npm run dist:css-parity                 ✅ PASS
```
