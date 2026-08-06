# Strangler parity authority and Baptists built-app measurement

Date: 2026-08-06  
Base: `main@a55a03851506945ef61bb753efe58205d231a807`

## Purpose

This lane performs the two measurement/authority prerequisites selected by the owner:

1. measure whether the retained Baptists 3D built app is worth splitting;
2. transfer blocking visual-parity authority away from mutable URL-shaped root HTML before any retirement of the 51 Astro shadows.

## Current facts

The existing deterministic inventory records:

- 52 public `index.html` files;
- 51 Astro-owned native shadows, 4,026,027 bytes total;
- one independent built app at `konfessii/russkij-baptizm/_app/index.html`, 2,245,854 bytes at the measured inventory anchor;
- zero unowned public indexes.

The 51 shadows are not deleted in this lane. They still have non-parity readers recorded in the legacy-reference ledger. Deletion requires a later route-bounded migration after those readers are removed or repointed.

## Authority transfer

`data/visual-parity-authority.json` derives blocking render ownership from `migration/page-ownership.json`:

- `owner=astro` resolves to `native-contract`;
- `owner=built-app` or `status=copy-as-built-asset` resolves to `built-app-contract`;
- root-vs-dist pixel screenshots remain diagnostics and historical evidence;
- no authority record grants permission to delete legacy HTML.

The authority audit requires existing source/dist/browser guards for every transferred route and fails closed if an Astro route falls back to `legacy-diff`, a built app receives the wrong mode, a guard is missing, or the policy claims deletion authority.

## Baptists measurement

The static measurement records:

- exact file inventory and SHA-256 values;
- entry and total bytes;
- gzip and Brotli sizes;
- inline script/style share;
- approximate DOM size and local references;
- a bounded static recommendation.

The Chromium measurement records three clean-cache desktop runs:

- FCP, DOMContentLoaded and load timing;
- main/resource encoded and transfer bytes;
- DOM, script, style, canvas and SVG counts;
- long-task count, total and maximum duration;
- page errors, console errors, failed requests and overflow observations.

The automated recommendation distinguishes:

- runtime-supported extraction of cacheable JS/CSS;
- optional cacheability-only splitting;
- keeping the current artifact.

A recommendation never mutates the app and never authorizes a split. Any extraction remains a separate reversible Product PR with before/after browser evidence.

## Scope and exclusions

Permanent scope:

- two existing read-only workflows;
- one authority data file;
- one shared resolver;
- one authority audit;
- one static built-app measurement;
- one Chromium built-app measurement;
- this record.

Explicit exclusions:

- no route or UI change;
- no built-app byte change;
- no legacy shadow deletion or move;
- no ledger rewrite;
- no cache-bust or metadata projection change;
- no production deployment claim.
