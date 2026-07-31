# GitHub Actions immutable major migration

The control plane targets checkout 7.0.1, setup-node 7.0.0, upload-artifact
7.0.1, download-artifact 8.0.1, upload-pages-artifact 5.0.0, deploy-pages
5.0.0 and github-script 9.0.0 through immutable 40-character SHA pins.

Workflow policy, source-link, release, deployment and TTS witnesses are updated
as one transaction. Build-once ordering, exact candidate identity, provenance,
artifact immutability, Pages ordering, dist-dry-run and trusted-default-branch
execution remain fail closed.

The Gill print pagination witness remains a separate visual/print issue.
