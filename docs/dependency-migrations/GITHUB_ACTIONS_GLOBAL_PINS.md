# Global GitHub Actions immutable pins

Every external `uses:` declaration in `.github/workflows` is pinned to a full 40-hex commit SHA.

The permanent global pin contract:

- permits repository-local actions via `./...`;
- permits Docker actions only with a `sha256:` digest;
- rejects mutable tags and branches such as `@v7`, `@main`, and `@latest`;
- runs as part of `workflows:check` and therefore `workflows:policy`.

Approved current identities are documented by version comments beside their immutable SHA values.
