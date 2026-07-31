# Node 22 LTS patch migration

Canonical release toolchain: Node 22.23.1 and npm 10.9.8.

- Every active GitHub Actions `node-version` is an exact patch.
- Release workflows verify both Node and npm exactly.
- Historical audit records and `engines >=22.12.0` remain historical or compatibility facts.
- The dedicated Node Toolchain Contract and `node-toolchain-pin-contract-test.mjs` permanently reject floating or divergent active runtime pins.
- Node 24/npm 11 is a separate future major migration.
