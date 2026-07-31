# Pixelmatch 7 migration

Pixelmatch 6 and newer are ESM-only. The existing CommonJS screenshot
harness therefore loads Pixelmatch through one controlled dynamic import
inside its existing async main function.

Pixelmatch 7 also changes semi-transparent pixel comparison by blending
against a checkerboard by default. This lane explicitly sets
`checkerboard: false` to preserve the measurements and owner-approved
baselines produced by Pixelmatch 5. A later baseline-policy change must
be a separate visual decision, never an incidental dependency update.

`npm run visual:pixelmatch:contract` verifies the package, import path,
explicit option and a one-pixel functional fixture proving the semantic
difference between old and new alpha blending.
