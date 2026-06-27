<!-- markdownlint-disable MD013 MD034 MD060 -->

# External / Advanced Audit Checks Toolbox — gb-is-my-strength

**Date:** 2026-06-27  
**Scope:** `gb-is-my-strength` / gospod-bog.ru  
**Purpose:** practical catalogue of high-value checks that can be run in Arena or externally, beyond the current repo-specific gates.  
**Status:** advisory / research document. Do **not** make all checks blocking at once.

---

## 0. Arena sandbox build survival notes

Arena/E2B in this project is usually:

- ~2 vCPU
- ~1.9–2 GiB RAM
- no swap by default
- default Node often `20.20.2`, while Astro 6 requires `>=22.12.0`

### 0.1 Why another agent's build failed with OOM

Example failing pattern:

```bash
export NODE_OPTIONS="--max-old-space-size=1500 --max-semi-space-size=2"
timeout 290 npm run astro:build
```

If only ~1.1 GiB RAM is available, `--max-old-space-size=1500` is not a promise that the machine has 1.5 GiB to spare. It is only V8's old-space ceiling. The process still needs extra native memory for Vite/Rollup/Astro, file buffers, sourcemap work, child processes, libc, and page cache. So the kernel can OOM-kill the build before V8 reaches its JS heap limit.

`--max-semi-space-size=2` also forces a tiny young generation. That may reduce one slice of heap, but it can increase GC churn and does not solve non-heap/native memory pressure.

### 0.2 First-line setup for heavy checks

```bash
# Node 22 for every shell command
if [ ! -x /tmp/node-v22.12.0-linux-x64/bin/node ]; then
  wget -q https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-x64.tar.xz -O /tmp/node22.tar.xz
  tar -xf /tmp/node22.tar.xz -C /tmp/
fi
export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH
node -v
npm -v
```

### 0.3 Temporary swap workaround in Arena

Use only when full Astro / Playwright / production-like dist gates need it:

```bash
free -h
sudo fallocate -l 4G /swapfile-arena || sudo dd if=/dev/zero of=/swapfile-arena bs=1M count=4096 status=progress
sudo chmod 600 /swapfile-arena
sudo mkswap /swapfile-arena
sudo swapon /swapfile-arena
free -h
/usr/sbin/swapon --show || true
```

This session proved that `npm run strangler:audit:production-like` can pass after adding 4 GiB swap.

### 0.4 Recommended memory/command discipline

Prefer this sequence:

```bash
export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH
export NODE_OPTIONS="--max-old-space-size=1200 --max-semi-space-size=8"
npm run validate:static-publication
npm run strangler:audit:production-like
```

If OOM persists:

```bash
export NODE_OPTIONS="--max-old-space-size=1024 --max-semi-space-size=8"
npm run astro:build
```

Do **not** run Astro builds in parallel. Do not create multiple fresh worktrees with separate `npm ci` unless conflict isolation is necessary.

---

## 1. How to use this document

### Recommended adoption model

1. Run new tools as **manual / warn-only** reports first.
2. Record findings in AuditRepo.
3. Deduplicate against existing custom audits.
4. Promote only stable, low-noise checks to CI.
5. Keep expensive SaaS/browser audits scheduled or manual, not always blocking.

### Local site target in Arena

```bash
npm run strangler:build:production-like
npm run pagefind:build:dist
python3 -m http.server 8080 --bind 127.0.0.1 -d dist
# target: http://127.0.0.1:8080/
```

### Production target

```text
https://gospod-bog.ru/
```

---

## 2. Highest-priority additions for this repo

| Priority | Tool/check | Why it is useful here | First mode |
|---:|---|---|---|
| 1 | Pa11y / pa11y-ci sitemap | Independent WCAG sweep across public routes | warn-only |
| 2 | Lighthouse CI | Standard performance/SEO/a11y/best-practices budgets | warn-only |
| 3 | Lychee or Linkinator | External broken-link checks for HTML + AuditRepo docs | warn-only |
| 4 | SecurityHeaders + Mozilla Observatory + SSL Labs | Production HTTP/TLS security surface | manual monthly |
| 5 | Semgrep + CodeQL | Source-level SAST beyond project-specific scripts | warn-only SARIF |
| 6 | Gitleaks + TruffleHog | Secrets defense-in-depth | blocking after baseline |
| 7 | W3C/Nu HTML validation | Spec-level HTML validation independent of custom guards | sample pages first |
| 8 | PageSpeed Insights + WebPageTest | Real external performance perspective | manual release check |

---

## 3. Performance / Core Web Vitals / synthetic monitoring

| # | Tool | URL | Local / external use |
|---:|---|---|---|
| 1 | Lighthouse CLI | https://github.com/GoogleChrome/lighthouse | `npx lighthouse http://127.0.0.1:8080/ --output=json --output-path=reports/lighthouse-home.json --chrome-flags="--headless --no-sandbox"` |
| 2 | Lighthouse CI | https://github.com/GoogleChrome/lighthouse-ci | `npx lhci autorun` with `.lighthouserc.json` |
| 3 | Lighthouse CI GitHub Action | https://github.com/marketplace/actions/lighthouse-ci-action | PR artifacts / thresholds |
| 4 | PageSpeed Insights | https://pagespeed.web.dev/ | production URL |
| 5 | PageSpeed Insights API | https://developers.google.com/speed/docs/insights/v5/get-started | `curl` / scheduled report |
| 6 | Chrome UX Report / CrUX | https://developer.chrome.com/docs/crux | field data for production URLs |
| 7 | WebPageTest | https://www.webpagetest.org/ | waterfall, filmstrip, multi-location |
| 8 | GTmetrix | https://gtmetrix.com/ | external waterfall + report |
| 9 | DebugBear | https://www.debugbear.com/ | continuous Lighthouse/CWV monitoring |
| 10 | Calibre | https://calibreapp.com/ | performance budgets / scheduled audits |
| 11 | SpeedCurve | https://speedcurve.com/ | synthetic + RUM monitoring |
| 12 | Sitespeed.io | https://www.sitespeed.io/ | self-hosted performance suite |
| 13 | Yellow Lab Tools | https://yellowlab.tools/ | DOM/JS/CSS quality/perf heuristics |
| 14 | Pingdom Website Speed Test | https://tools.pingdom.com/ | quick public waterfall sanity check |
| 15 | KeyCDN Performance Test | https://tools.keycdn.com/performance | asset timing by location |

---

## 4. Accessibility checks beyond current repo gates

| # | Tool | URL | Suggested first command/use |
|---:|---|---|---|
| 16 | Pa11y | https://github.com/pa11y/pa11y | `npx pa11y http://127.0.0.1:8080/ --standard WCAG2AA --runner axe --reporter json` |
| 17 | pa11y-ci | https://github.com/pa11y/pa11y-ci | `npx pa11y-ci --sitemap http://127.0.0.1:8080/sitemap.xml` |
| 18 | axe-core CLI | https://github.com/dequelabs/axe-core-npm | `npx @axe-core/cli http://127.0.0.1:8080/ --exit` |
| 19 | WAVE | https://wave.webaim.org/ | production URL manual check |
| 20 | IBM Equal Access Accessibility Checker | https://www.ibm.com/able/toolkit/tools | browser/CLI second witness |
| 21 | HTML_CodeSniffer | https://squizlabs.github.io/HTML_CodeSniffer/ | through pa11y `htmlcs` runner |
| 22 | Accessibility Insights | https://accessibilityinsights.io/ | manual assisted browser audit |
| 23 | ARC Toolkit | https://www.tpgi.com/arc-platform/arc-toolkit/ | browser accessibility second witness |

---

## 5. HTML / CSS / feeds / structured data

| # | Tool | URL | Suggested use |
|---:|---|---|---|
| 24 | W3C Markup Validator | https://validator.w3.org/ | production/manual HTML validation |
| 25 | Nu Html Checker | https://validator.w3.org/nu/ | living HTML validator |
| 26 | `html-validator-cli` | https://www.npmjs.com/package/html-validator-cli | `npx html-validator-cli --file dist/index.html` |
| 27 | `w3c-html-validator` | https://www.npmjs.com/package/w3c-html-validator | mass dist file validation with ignore config |
| 28 | W3C CSS Validator | https://jigsaw.w3.org/css-validator/ | validate `css/*.css` externally |
| 29 | Feed Validator | https://validator.w3.org/feed/ | validate `feed.xml` |
| 30 | Rocket Validator | https://rocketvalidator.com/ | paid/site-wide W3C + axe checks |
| 31 | Google Rich Results Test | https://search.google.com/test/rich-results | JSON-LD/rich eligibility |
| 32 | Schema Markup Validator | https://validator.schema.org/ | Schema.org semantic validation |
| 33 | Yandex Structured Data Validator | https://webmaster.yandex.ru/tools/microtest/ | Yandex/schema/OpenGraph witness |
| 34 | Bing Markup Validator | https://www.bing.com/webmasters/markup-validator | Bing structured-data witness |
| 35 | Facebook Sharing Debugger | https://developers.facebook.com/tools/debug/ | Open Graph social card check |
| 36 | X/Twitter Card Validator | https://cards-dev.twitter.com/validator | card preview check |
| 37 | SEO META in 1 CLICK | https://chromewebstore.google.com/detail/seo-meta-in-1-click/bjogjfinolnhfhkbipphpdlldadpnmhc | manual browser meta/heading/social scan |

---

## 6. Security headers / TLS / CSP / DAST

| # | Tool | URL | Suggested use |
|---:|---|---|---|
| 38 | SecurityHeaders.com | https://securityheaders.com/ | production headers A-F scan |
| 39 | Mozilla Observatory | https://developer.mozilla.org/en-US/observatory | security headers + CSP score |
| 40 | SSL Labs Server Test | https://www.ssllabs.com/ssltest/ | TLS/cipher/certificate test |
| 41 | Google CSP Evaluator | https://csp-evaluator.withgoogle.com/ | CSP weakness review |
| 42 | OWASP ZAP Baseline Scan | https://www.zaproxy.org/docs/docker/baseline-scan/ | passive DAST against owned URL |
| 43 | Sucuri SiteCheck | https://sitecheck.sucuri.net/ | malware/blocklist scan |
| 44 | VirusTotal URL Scan | https://www.virustotal.com/gui/home/url | reputation scan |
| 45 | Hardenize | https://www.hardenize.com/ | broader TLS/DNS/mail/web hardening |
| 46 | testssl.sh | https://testssl.sh/ | local TLS scan for production domain |
| 47 | shcheck | https://github.com/santoru/shcheck | local HTTP security header check |

---

## 7. SAST / dependency / secrets / supply chain

| # | Tool | URL | Suggested command/use |
|---:|---|---|---|
| 48 | Semgrep | https://semgrep.dev/ | `npx semgrep scan --config p/javascript --config p/typescript --config p/owasp-top-ten --sarif --output reports/semgrep.sarif` |
| 49 | CodeQL | https://codeql.github.com/ | GitHub code scanning / CLI database analyze |
| 50 | OSV-Scanner | https://google.github.io/osv-scanner/ | `osv-scanner --recursive .` |
| 51 | Snyk Open Source / Code | https://snyk.io/ | dependency/code scan, warn-only first |
| 52 | Retire.js | https://retirejs.github.io/retire.js/ | `npx retire --path . --outputformat json` |
| 53 | Gitleaks | https://github.com/gitleaks/gitleaks | `gitleaks detect --source . --redact` |
| 54 | TruffleHog | https://github.com/trufflesecurity/trufflehog | `trufflehog filesystem . --only-verified` |
| 55 | SonarCloud | https://sonarcloud.io/ | quality/security dashboard |
| 56 | npm audit | https://docs.npmjs.com/cli/v10/commands/npm-audit | `npm audit --json` baseline |
| 57 | Dependabot | https://docs.github.com/en/code-security/dependabot | dependency PRs/alerts |

---

## 8. Links / markdown / docs quality

| # | Tool | URL | Suggested command/use |
|---:|---|---|---|
| 58 | Lychee | https://lychee.cli.rs/ | `npx lychee --no-progress './**/*.md' './**/*.html'` |
| 59 | lychee-action | https://github.com/lycheeverse/lychee-action | scheduled/PR broken-link reports |
| 60 | Linkinator | https://github.com/JustinBeckwith/linkinator | `npx linkinator http://127.0.0.1:8080 --recurse` |
| 61 | markdownlint-cli2 | https://github.com/DavidAnson/markdownlint-cli2 | `npx markdownlint-cli2 '**/*.md'` |
| 62 | remark-lint | https://github.com/remarkjs/remark-lint | semantic markdown lint |
| 63 | Vale | https://vale.sh/ | prose/style lint for Russian/English docs |
| 64 | alex | https://github.com/get-alex/alex | inclusive-language lint; likely advisory only |

---

## 9. Visual regression options beyond current custom scripts

| # | Tool | URL | Suggested use |
|---:|---|---|---|
| 65 | Playwright screenshot assertions | https://playwright.dev/docs/test-snapshots | native visual baselines in repo |
| 66 | BackstopJS | https://github.com/garris/BackstopJS | multi-page/multi-viewport visual scenarios |
| 67 | Percy | https://percy.io/ | PR visual review workflow |
| 68 | Chromatic | https://www.chromatic.com/ | Storybook/component visual diffs if Storybook appears |
| 69 | Argos CI | https://argos-ci.com/ | GitHub-focused visual screenshot review |
| 70 | Applitools Eyes | https://applitools.com/ | paid visual AI, fewer pixel false positives |

---

## 10. First safe experiments for future lanes

### 10.1 Pa11y single-page smoke

```bash
export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH
npm run strangler:build:production-like
python3 -m http.server 8080 --bind 127.0.0.1 -d dist >/tmp/gb-http.log 2>&1 &
SERVER_PID=$!
npx pa11y http://127.0.0.1:8080/ --standard WCAG2AA --runner axe --reporter json > reports/pa11y-home.json
kill $SERVER_PID
```

### 10.2 Lighthouse local smoke

```bash
npx lighthouse http://127.0.0.1:8080/ \
  --output=json \
  --output-path=reports/lighthouse-home.json \
  --chrome-flags="--headless --no-sandbox --disable-dev-shm-usage"
```

### 10.3 Lychee docs/html link scan

```bash
npx lychee --no-progress --exclude-mail './docs/**/*.md' './projects/**/*.md' './*.html'
```

For `gb-is-my-strength`, avoid unbounded external link scans as blocking CI until an ignore list is created.

### 10.4 Semgrep warn-only

```bash
npx semgrep scan \
  --config p/javascript \
  --config p/typescript \
  --config p/nodejs \
  --config p/owasp-top-ten \
  --sarif \
  --output reports/semgrep.sarif \
  --exclude node_modules \
  --exclude dist \
  --exclude reports
```

### 10.5 Secrets scan baseline

```bash
gitleaks detect --source . --redact --report-format json --report-path reports/gitleaks.json
trufflehog filesystem . --only-verified --json > reports/trufflehog.json
```

Do not paste credentials in chat or store tokens in remotes. If a token appears in chat, revoke it.

---

## 11. What not to do

- Do not add all these tools as blocking checks in one PR.
- Do not run heavy browser/build tools in parallel in Arena.
- Do not run active DAST aggressively against domains you do not own.
- Do not treat external SaaS scores as absolute truth without reproducing locally.
- Do not let noisy tools rewrite the current carefully tuned PremiumControls/Gill visual contract.

---

## 12. Recommended staged roadmap

### Stage A — manual reports only

- Lighthouse CLI on `/`, one Gill route, one PremiumControls article.
- Pa11y single-page smoke.
- SecurityHeaders / Observatory / SSL Labs screenshots or exported summaries.
- Lychee against docs only.

### Stage B — warn-only npm scripts

- `external:a11y:pa11y:home`
- `external:perf:lighthouse:home`
- `external:links:docs`
- `external:security:semgrep`
- `external:secrets:gitleaks`

### Stage C — selective CI promotion

Promote only if baseline is clean and false-positive policy is documented:

- secrets scanner: blocking
- dependency critical vulnerabilities: blocking
- PremiumControls rollout audit: already blocking in production-like path
- Pa11y/Lighthouse: thresholded, not all-or-nothing at first

---

## 13. Current repo-specific note

As of the current PremiumControls dist-gate lane, these project gates already pass with swap-backed Arena full verification:

```text
npm run validate:static-publication        ✅
npm run strangler:audit:production-like    ✅
npm run audit:premium-controls             ✅ 39/39 inside dist gate
```

So new tools should be used to find **new witness classes**, not to re-litigate already-closed PremiumControls broad narratives.
