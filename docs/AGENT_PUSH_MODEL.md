# Agent Push Model

**Repository:** `FedorMilovanov/gb-is-my-strength`  
**Updated:** 2026-07-24  
**Current rule:** branch + pull request; direct `main` push is forbidden outside an explicit owner-approved emergency.

## 1. Authentication truth

- GitHub repository secrets (`${{ secrets.NAME }}`) exist only inside GitHub Actions.
- An external coding runtime does not inherit `GITHUB_TOKEN`, PAT or repository secrets unless that runtime provides its own authenticated connector or secure environment.
- The presence of `ARENA_AGENT` or another repository secret does not imply that `$GH_TOKEN` exists in an agent shell.
- Never request, paste or store a PAT in chat, text files, issues, PR descriptions, commits, gists or example environment files.

## 2. Allowed write paths

Normal work:

```text
lane/**
agent/**
arena/**
```

Protected destinations:

```text
main
gh-pages
release
production
```

Rules:

- push a named branch and open a PR;
- never force-push another owner’s branch;
- verify the remote branch SHA after push;
- a statement such as “я запушил” is not evidence.

An emergency direct-main operation requires an explicit owner decision, exact post-push workflow inspection, a rollback SHA and follow-up AuditRepo reconciliation when canonical status changes.

## 3. Current write-capable workflows

The filesystem-derived control-plane audit classifies two continuing same-repository autofix writers:

- `.github/workflows/glossary-contract.yml`;
- `.github/workflows/search-manifest-policy.yml`.

They are accepted only because their write paths are label-gated and require the PR head repository to equal the target repository. Other `contents: write` workflows are warnings until an explicit continuing owner is documented.

Do not rely on a static list in this document. Run:

```bash
npm run control-plane:audit
```

and inspect `reports/repository-control-plane-audit.{json,md}` for the exact current inventory.

## 4. Safe capability probe

When using a shell-based external runtime:

```bash
git fetch --all --prune
git rev-parse origin/main
git checkout -b lane/push-probe-YYYY-MM-DD
# create a harmless commit only when the owner approved a real probe
git push -u origin HEAD
```

A `403` means the runtime has no usable credential. Use the GitHub connector, owner patch relay or another approved authenticated path. Do not work around it by exposing credentials.

Delete a probe branch only after confirming it contains no unique content and recording its disposition. Branch cleanup follows `docs/LANE_LOCK_POLICY.md`.

## 5. Verification before push and merge

Choose checks from `docs/WORK_MODES.md` according to actual scope.

For workflow/system changes, at minimum:

```bash
git diff --check
npm run guard:shared-files
npm run workflows:check
npm run control-plane:audit
npm run workflows:lint
```

For production/shared/refactor changes, the final barrier normally includes:

```bash
npm run validate:static-publication
npm run guard:shared-files
```

Add route/browser/visual/source contracts for the touched surface. Do not use a Gill-specific smoke suite as a universal substitute for current scoped contracts.

## 6. Post-push evidence

Trust only:

- `origin/<branch>` at an exact SHA;
- the GitHub PR head SHA and actual diff;
- exact-head workflow runs and artifacts;
- built `dist` when build output is the claim;
- exact Pages/live witness when production is the claim.

A green check on an earlier commit does not validate a moved head. A merged source commit does not prove that production serves the same bytes.

## 7. Dynamic state

Never hard-code “open PRs must be 0” or a current `main` SHA in this document. Query GitHub and `git rev-parse origin/main` at the start of the task. Use `docs/refactor-2026/lanes/README.md` only as navigation and AuditRepo for canonical source/production boundaries.

## Historical policy

The 2026-06-29 version remains in Git history at blob `93e8e0d86f0ce2adf119a678d00d8bfad48a6cfa`. Its fixed main SHA, one-writer claim, static zero-PR assertion and Gill-specific universal gate list are retired.
