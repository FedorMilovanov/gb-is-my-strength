# actionlint v1.7.7 offline source authority

This directory contains the six official archives required by the repository's
supported Node platform/architecture mappings. Runtime validation never fetches
from GitHub Releases: the selected archive and any extracted cache entry are
verified locally on every invocation.

## Upstream identity

- Repository: `rhysd/actionlint`
- Release/tag: `v1.7.7`
- Release ID: `195510160`
- Tag commit: `03d0035246f3e81f36aed592ffb4bebf33a03106`
- Release author: `github-actions[bot]`
- Published: `2025-01-19T12:01:22Z`
- License: MIT; exact upstream `LICENSE.txt` is checked in beside the archives.

The GitHub release API reported `immutable: false`. The `v1.7.7` ref was a
lightweight commit ref rather than a signed annotated-tag object, so the tag is
treated as unsigned. Those limitations are explicit: repository review binds
the release ID, asset IDs, byte sizes, upstream checksum asset, independently
computed SHA-256 values and exact tag commit instead of assuming GitHub release
metadata is immutable or cryptographically signed.

## Acquisition witness

The assets were acquired by the bounded, read-only checkpoint workflow on the
Product repository and then committed as reviewed source:

- workflow run: `31709241523`, attempt `1`, SUCCESS
- checkpoint SHA: `b03f15784c991300d7bef65c857e5da4f18301bf`
- artifact ID: `9184483405`
- artifact name: `actionlint-v1.7.7-upstream-31709241523`
- artifact SHA-256: `b3499665ac1b4ac6b422289e77a3700c142dd8f28d13c140cbed41e8ad0a0fe6`

`ACQUISITION_WITNESS.json` records the release metadata and each asset ID, byte
size and digest. `actionlint_1.7.7_checksums.txt` is the exact upstream checksum
asset (ID `221573261`), and `manifest.json` binds it to every local archive and
to each extracted executable digest. The temporary acquisition workflow is not
part of the terminal control plane.

## Pinned archives

| Runtime target | Upstream asset ID | Bytes | SHA-256 |
|---|---:|---:|---|
| `darwin-x64` | `221573249` | `2092389` | `28e5de5a05fc558474f638323d736d822fff183d2d492f0aecb2b73cc44584f5` |
| `darwin-arm64` | `221573250` | `1962532` | `2693315b9093aeacb4ebd91a993fea54fc215057bf0da2659056b4bc033873db` |
| `linux-x64` | `221573254` | `2080472` | `023070a287cd8cccd71515fedc843f1985bf96c436b7effaecce67290e7e0757` |
| `linux-arm64` | `221573255` | `1911516` | `401942f9c24ed71e4fe71b76c7d638f66d8633575c4016efd2977ce7c28317d0` |
| `win32-x64` | `221573260` | `2229473` | `7f12f1801bca3d480d67aaf7774f4c2a6359a3ca8eebe382c95c10c9704aa731` |
| `win32-arm64` | `221573259` | `2020826` | `76e9514cfac18e5677aa04f3a89873c981f16a2f2353bb97372a86cd09b1f5a8` |

## Upgrade procedure

Treat an actionlint upgrade as a SYSTEM/source-authority change. Acquire the
new exact release on an isolated branch, verify its tag identity, release and
asset IDs, sizes, upstream checksums, independent hashes, extracted-binary
hashes and license, then update the manifest, policy ratchet and all regression
fixtures together. Obtain exact-head Linux, Windows and Intel macOS execution
evidence. Any temporary acquisition workflow must be deleted before merge.
