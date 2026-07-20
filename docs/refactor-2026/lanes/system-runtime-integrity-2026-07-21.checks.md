Targeted local checks completed before opening the draft PR:

- `node --check js/site-utils.js`
- `node scripts/runtime-integrity-test.js`

Full repository validation is delegated to GitHub Actions because the execution container cannot resolve github.com and cannot materialize a checkout.
