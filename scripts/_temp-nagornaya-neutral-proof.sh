#!/usr/bin/env bash
set -euo pipefail

STATUS_FILE="reports/nagornaya-neutral-comparison/transaction-status.txt"
EVIDENCE_DIR="reports/nagornaya-neutral-comparison"

if [[ -f "$STATUS_FILE" ]]; then
  echo "Nagornaya proof already completed: $(cat "$STATUS_FILE")"
  exit 0
fi

mkdir -p "$EVIDENCE_DIR"
BASE_URL="https://gospod-bog.ru" EVIDENCE_DIR="$EVIDENCE_DIR" \
  node scripts/_temp-nagornaya-neutral-baseline-witness.mjs
python3 scripts/_temp-nagornaya-neutral-comparison-patcher.py
npm run strangler:build:production-like
cp dist/nagornaya/chast-4/index.html nagornaya/chast-4/index.html
cp dist/nagornaya/chast-5/index.html nagornaya/chast-5/index.html
npm run nagornaya:neutral-comparison:test
npm run engine:contracts
node scripts/cache-bust.js
EVIDENCE_DIR="$EVIDENCE_DIR" npm run nagornaya:neutral-comparison:browser:test
npm run validate:static-publication:light

cat > "$EVIDENCE_DIR/README.md" <<EOF
# Nagornaya neutral comparison evidence

- Baseline source: live production from exact verified main \`6c4106aecd35a3c95b09b041332d653f581ceb92\`.
- Shared Files Guard proof run: \`${GITHUB_RUN_ID}\`.
- Viewports: 390×844 and 1440×900.
- Blocks: Part IV / Green, Part IV / Thomas, Part V / pastoral discernment.
- Browser contract also covers 320×760, reduced motion, Sepia, ARIA, DOM order and horizontal overflow.
EOF
printf 'success %s\n' "$GITHUB_RUN_ID" > "$STATUS_FILE"

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add \
  package.json \
  src/lib/nagornaya-claim-projection.ts \
  src/components/nagornaya/shared/NagornayaClaimComparison.astro \
  src/components/nagornaya/chast-4/NagornayaChast4MainShell.astro \
  src/components/nagornaya/chast-5/NagornayaChast5MainShell.astro \
  nagornaya/chast-4/index.html \
  nagornaya/chast-5/index.html \
  scripts/nagornaya-neutral-comparison-regression-test.js \
  scripts/nagornaya-neutral-comparison-browser-test.mjs \
  reports/nagornaya-neutral-comparison
git diff --cached --check
git commit -m 'feat(nagornaya): add neutral comparison UI'
git push origin HEAD:refs/heads/agent/nagornaya-neutral-comparison-ui-2026-07-22
