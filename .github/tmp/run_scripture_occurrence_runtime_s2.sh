#!/usr/bin/env bash
set -euo pipefail

BASE_SHA="5fc06fc0c4a9a7c60f849619129890df70089b57"
HEAD_REF="${HEAD_REF:-lane/scripture-occurrence-runtime-s2-20260804}"
HELPER=".github/tmp/apply_scripture_occurrence_runtime_s2.py"
RUNNER=".github/tmp/run_scripture_occurrence_runtime_s2.sh"
TEMP_WORKFLOW=".github/workflows/tmp-scripture-occurrence-runtime-s2.yml"

# Immutable source guards.
git fetch --depth=1 origin main
test "$(git rev-parse origin/main)" = "${BASE_SHA}"
git rev-list HEAD | grep -qx "${BASE_SHA}"
test "$(git rev-parse HEAD:js/search.js)" = "734ca9f74b61fb5a3960c6422bd9b1b6acb83a0b"
test "$(git rev-parse HEAD:data/scripture-search-index.json)" = "952443d2580ce50308362625da3c17f7fe76a50d"
test "$(git rev-parse HEAD:sw.js)" = "12c88772c3998c5a10218f2ec34013580439cb6a"
test "$(git rev-parse HEAD:migration/sw-cache-version-baseline.json)" = "99d93fd59b8e9db3149f2dcea6f59017c2b38549"
test "$(git rev-parse HEAD:data/offline-route-matrix.json)" = "5c5b9e1fd16bb590f02e77649a7279c7bdc751c0"
test "$(git rev-parse HEAD:src/lib/asset-version.js)" = "4154a4016f0fc2bfb11d99c5f2b8fe63ad70e758"
test "$(git rev-parse HEAD:scripts/search-scripture-occurrence-runtime-browser-test.mjs)" = "c673190f2cd577db2cb56f11a74ee6e54a266e62"
test "$(git rev-parse HEAD:.github/workflows/search-scripture-occurrence-runtime.yml)" = "a8f369ecd4ce4a3a05f0b58ee70d5815cb2af8c5"
test "$(git rev-parse HEAD:${HELPER})" = "2de146d871a7358f5d86ea48e925a7137affb62f"
test -f "${RUNNER}"
test -f "${TEMP_WORKFLOW}"

# Exact mutation and deterministic source contracts.
git grep -l 'js/search.js?v=' -- '*.html' '*.astro' | sort > "${RUNNER_TEMP}/search-js-references.before"
test -s "${RUNNER_TEMP}/search-js-references.before"
python3 -m py_compile "${HELPER}"
python3 "${HELPER}" --write
node --check js/search.js
node --check scripts/search-scripture-occurrence-runtime-browser-test.mjs
node scripts/build-scripture-occurrence-index.mjs --check
node scripts/scripture-occurrence-index-contract.mjs
node scripts/cache-bust.js
grep -q "gb-v196-scripture-occurrence-runtime-20260804" sw.js

# Remove all temporary control plane before inspecting the candidate.
rm -f "${HELPER}" "${RUNNER}" "${TEMP_WORKFLOW}"
rm -rf .github/tmp/__pycache__
git diff --check origin/main
{ git diff --name-only origin/main; git ls-files --others --exclude-standard; } | sort -u > "${RUNNER_TEMP}/changed.txt"
for required in \
  .github/workflows/search-scripture-occurrence-runtime.yml \
  data/offline-route-matrix.json \
  js/search.js \
  migration/sw-cache-version-baseline.json \
  scripts/search-scripture-occurrence-runtime-browser-test.mjs \
  src/lib/asset-version.js \
  sw.js; do
  grep -qx "${required}" "${RUNNER_TEMP}/changed.txt"
done
while IFS= read -r changed; do
  case "${changed}" in
    .github/workflows/search-scripture-occurrence-runtime.yml|data/offline-route-matrix.json|js/search.js|migration/sw-cache-version-baseline.json|scripts/search-scripture-occurrence-runtime-browser-test.mjs|src/lib/asset-version.js|sw.js) ;;
    *) grep -qxF "${changed}" "${RUNNER_TEMP}/search-js-references.before" || { echo "Unexpected changed path: ${changed}"; exit 1; } ;;
  esac
  case "${changed}" in
    *tts*|*TTS*|*vosk*|*Vosk*) echo "Forbidden TTS/Vosk path: ${changed}"; exit 1 ;;
  esac
done < "${RUNNER_TEMP}/changed.txt"
test "$(git grep -l 'js/search.js?v=' -- '*.html' '*.astro' | sort)" = "$(cat "${RUNNER_TEMP}/search-js-references.before")"

# Protected-owner proof from the exact candidate tree.
mapfile -t revision_refs < "${RUNNER_TEMP}/search-js-references.before"
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add -- \
  "${HELPER}" "${RUNNER}" "${TEMP_WORKFLOW}" \
  .github/workflows/search-scripture-occurrence-runtime.yml \
  data/offline-route-matrix.json \
  js/search.js \
  migration/sw-cache-version-baseline.json \
  scripts/search-scripture-occurrence-runtime-browser-test.mjs \
  src/lib/asset-version.js \
  sw.js \
  "${revision_refs[@]}"
probe_tree="$(git write-tree)"
probe_head="$(printf '%s\n' 'Scripture occurrence S2 shared-files probe' | git commit-tree "${probe_tree}" -p HEAD)"
node scripts/guard-shared-files.js --base origin/main --head "${probe_head}" --branch "${HEAD_REF}"
git reset

# Full source, production-like, browser, offline and publication evidence.
npm run guard:agents-rev
node scripts/cache-bust.js
node scripts/build-scripture-occurrence-index.mjs --check
node scripts/scripture-occurrence-index-contract.mjs
npm run strangler:build:production-like
npm run pagefind:build:dist
node scripts/search-index-policy-inventory.js --dist=dist --strict
npx playwright install --with-deps chromium
node scripts/search-scripture-occurrence-runtime-browser-test.mjs --dist=dist --report=reports/scripture-occurrence-runtime-s2
npm run sw:dist:audit
npm run sw:dist:audit:deploy-switch
npm run validate:static-publication

# No validator may expand the candidate tree.
git diff --check origin/main
{ git diff --name-only origin/main; git ls-files --others --exclude-standard; } | sort -u > "${RUNNER_TEMP}/changed-after.txt"
diff -u "${RUNNER_TEMP}/changed.txt" "${RUNNER_TEMP}/changed-after.txt"

# Commit only the already inventoried permanent transaction.
git add -- \
  "${HELPER}" "${RUNNER}" "${TEMP_WORKFLOW}" \
  .github/workflows/search-scripture-occurrence-runtime.yml \
  data/offline-route-matrix.json \
  js/search.js \
  migration/sw-cache-version-baseline.json \
  scripts/search-scripture-occurrence-runtime-browser-test.mjs \
  src/lib/asset-version.js \
  sw.js \
  "${revision_refs[@]}"
git diff --cached --quiet && { echo 'No Scripture occurrence S2 candidate generated'; exit 1; }
git commit -m 'feat(search): render exact Scripture occurrences first'
git push origin "HEAD:${HEAD_REF}"
