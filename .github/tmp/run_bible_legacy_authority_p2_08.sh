#!/usr/bin/env bash
set -euo pipefail

BASE_SHA="38fdfc7a4712bdc3ef69e8f9c1d777a39f3ec3f6"
BRANCH="${HEAD_REF:-lane/scripture-legacy-authority-p2-08-20260804}"
HELPER=".github/tmp/apply_bible_legacy_authority_p2_08.py"
RUNNER=".github/tmp/run_bible_legacy_authority_p2_08.sh"
TEMP_WORKFLOW=".github/workflows/tmp-bible-legacy-authority-p2-08.yml"

# Exact base and source-owner guards.
git fetch --depth=1 origin main
test "$(git rev-parse origin/main)" = "${BASE_SHA}"
git merge-base --is-ancestor "${BASE_SHA}" HEAD
test "$(git rev-parse HEAD:js/site.js)" = "2a9a304961a52a7f39c8baa8dc11d410b6277bde"
test "$(git rev-parse HEAD:css/site.css)" = "7a4730f21f677b67d7eee270cefa557891cd9472"
test "$(git rev-parse HEAD:scripts/lib/a04-contract.mjs)" = "a615d6dceed1cb841bb94786f4adede8cdb8948a"
test "$(git rev-parse HEAD:src/lib/asset-version.js)" = "e740a08b7a87862036ebea29e62dd7704287aea3"
test "$(git rev-parse HEAD:sw.js)" = "92086be1003298492a5f9633b981a8fbd32f31eb"
test "$(git rev-parse HEAD:migration/sw-cache-version-baseline.json)" = "a14c573788090cf7a6f30c974a0b577ac19f035a"
test "$(git rev-parse HEAD:data/offline-route-matrix.json)" = "1f390cdab009b0fa5f154a66ccb97c418b658bef"
test "$(git rev-parse HEAD:docs/REFERENCE-TOOLTIP-CONTRACT.md)" = "85ef5d2189a6fa9a0bf5ffe540e93f08849ea4e1"
test "$(git rev-parse HEAD:scripts/bible-reference-contract.mjs)" = "f83d417dea0514c1ece6360586e2cf7f54958fa7"
test "$(git rev-parse HEAD:scripts/bible-legacy-authority-regression-test.mjs)" = "d1ccaf51fb51cecce352ec4365c14992cbeedae9"
test "$(git rev-parse HEAD:.github/workflows/bible-reference-contract.yml)" = "e0235e5c94ac5073969e2c581a52afc5729f0ce1"
test "$(git rev-parse HEAD:${HELPER})" = "3e0f32050964bc4aea8fbe4c4b6e61762992221c"
test ! -e data/verses.json
test -f "${RUNNER}"
test -f "${TEMP_WORKFLOW}"

# Capture exact revision-owner inventories before mutation.
git grep -l 'js/site.js?v=' -- '*.html' '*.astro' '*.mdx' | sort > "${RUNNER_TEMP}/site-js-refs.before"
git grep -l 'css/site.css?v=' -- '*.html' '*.astro' '*.mdx' | sort > "${RUNNER_TEMP}/site-css-refs.before"
test -s "${RUNNER_TEMP}/site-js-refs.before"
test -s "${RUNNER_TEMP}/site-css-refs.before"

python3 -m py_compile "${HELPER}"
python3 "${HELPER}"
node --check js/site.js
node --check scripts/bible-reference-contract.mjs
node --check scripts/bible-legacy-authority-regression-test.mjs
node --check scripts/lib/a04-contract.mjs
node scripts/cache-bust.js
grep -q "gb-v197-bible-legacy-authority-20260804" sw.js

# Remove temporary control plane before inspecting candidate state.
rm -f "${HELPER}" "${RUNNER}" "${TEMP_WORKFLOW}"
rm -rf .github/tmp/__pycache__
git diff --check origin/main
{ git diff --name-only origin/main; git ls-files --others --exclude-standard; } | sort -u > "${RUNNER_TEMP}/changed.txt"
{
  printf '%s\n' \
    .github/workflows/bible-reference-contract.yml \
    css/site.css \
    data/offline-route-matrix.json \
    data/verses.json \
    docs/REFERENCE-TOOLTIP-CONTRACT.md \
    js/site.js \
    migration/sw-cache-version-baseline.json \
    scripts/bible-legacy-authority-regression-test.mjs \
    scripts/bible-reference-contract.mjs \
    scripts/lib/a04-contract.mjs \
    src/lib/asset-version.js \
    sw.js
  cat "${RUNNER_TEMP}/site-js-refs.before"
  cat "${RUNNER_TEMP}/site-css-refs.before"
} | sort -u > "${RUNNER_TEMP}/expected.txt"
diff -u "${RUNNER_TEMP}/expected.txt" "${RUNNER_TEMP}/changed.txt"
while IFS= read -r changed; do
  case "${changed}" in
    *tts*|*TTS*|*vosk*|*Vosk*) echo "Forbidden TTS/Vosk path: ${changed}"; exit 1 ;;
  esac
done < "${RUNNER_TEMP}/changed.txt"
test "$(git grep -l 'js/site.js?v=' -- '*.html' '*.astro' '*.mdx' | sort)" = "$(cat "${RUNNER_TEMP}/site-js-refs.before")"
test "$(git grep -l 'css/site.css?v=' -- '*.html' '*.astro' '*.mdx' | sort)" = "$(cat "${RUNNER_TEMP}/site-css-refs.before")"

# Candidate must contain no legacy data, runtime, CSS or public triggers.
test ! -e data/verses.json
! grep -q '/data/verses.json' js/site.js
! grep -q 'gbx-verse' js/site.js
! grep -q 'gbx-verse' css/site.css
! git grep -n -E 'class=["'"'][^"'"']*gbx-verse|data-verse=' -- '*.html' '*.astro' '*.mdx'

# Protected-owner proof from exact candidate tree.
mapfile -t site_js_refs < "${RUNNER_TEMP}/site-js-refs.before"
mapfile -t site_css_refs < "${RUNNER_TEMP}/site-css-refs.before"
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add -- \
  "${HELPER}" "${RUNNER}" "${TEMP_WORKFLOW}" \
  .github/workflows/bible-reference-contract.yml \
  css/site.css \
  data/offline-route-matrix.json \
  data/verses.json \
  docs/REFERENCE-TOOLTIP-CONTRACT.md \
  js/site.js \
  migration/sw-cache-version-baseline.json \
  scripts/bible-legacy-authority-regression-test.mjs \
  scripts/bible-reference-contract.mjs \
  scripts/lib/a04-contract.mjs \
  src/lib/asset-version.js \
  sw.js \
  "${site_js_refs[@]}" \
  "${site_css_refs[@]}"
probe_tree="$(git write-tree)"
probe_head="$(printf '%s\n' 'Bible legacy authority P2-08 shared-files probe' | git commit-tree "${probe_tree}" -p HEAD)"
node scripts/guard-shared-files.js --base origin/main --head "${probe_head}" --branch "${BRANCH}"
git reset

# Source, adversarial, build, dist, SW and publication evidence.
npm run guard:agents-rev
node scripts/cache-bust.js
node scripts/bible-reference-contract.mjs --strict
node scripts/bible-legacy-authority-regression-test.mjs
node scripts/run-actionlint.mjs -no-color .github/workflows/bible-reference-contract.yml
npm run strangler:build:production-like
node scripts/bible-reference-contract.mjs --strict
node -e "const fs=require('fs');if(fs.existsSync('dist/data/verses.json'))throw new Error('legacy verse dataset leaked into dist');for(const file of fs.readdirSync('dist',{recursive:true}).filter(f=>String(f).endsWith('.html'))){const p='dist/'+file;const s=fs.readFileSync(p,'utf8');if(/class=[\"'][^\"']*\bgbx-verse\b|\bdata-verse\s*=/.test(s))throw new Error('legacy verse trigger in '+p)}"
npm run sw:dist:audit
npm run sw:dist:audit:deploy-switch
npm run validate:static-publication

# Validators may create diagnostics, but not expand the source candidate.
rm -rf reports/scripture-legacy-authority-p2-08
find . -type d -name __pycache__ -prune -exec rm -rf {} +
git diff --check origin/main
{ git diff --name-only origin/main; git ls-files --others --exclude-standard; } | sort -u > "${RUNNER_TEMP}/changed-after.txt"
diff -u "${RUNNER_TEMP}/expected.txt" "${RUNNER_TEMP}/changed-after.txt"

# Commit only the already inventoried permanent transaction.
git add -- \
  "${HELPER}" "${RUNNER}" "${TEMP_WORKFLOW}" \
  .github/workflows/bible-reference-contract.yml \
  css/site.css \
  data/offline-route-matrix.json \
  data/verses.json \
  docs/REFERENCE-TOOLTIP-CONTRACT.md \
  js/site.js \
  migration/sw-cache-version-baseline.json \
  scripts/bible-legacy-authority-regression-test.mjs \
  scripts/bible-reference-contract.mjs \
  scripts/lib/a04-contract.mjs \
  src/lib/asset-version.js \
  sw.js \
  "${site_js_refs[@]}" \
  "${site_css_refs[@]}"
git diff --cached --quiet && { echo 'No Bible legacy authority candidate generated'; exit 1; }
git commit -m 'fix(bible): remove legacy verse authority atomically'
git push origin "HEAD:${BRANCH}"
