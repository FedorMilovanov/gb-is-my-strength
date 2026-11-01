# Security Policy

## Supported scope

Security fixes are handled against the current `main` branch. Historical branches and old audit snapshots are evidence only; they do not define the supported security state.

## Reporting a vulnerability

Please do not publish suspected exploitable vulnerabilities, credentials, proof-of-concept payloads, or sensitive account details in a public issue, pull request, discussion, or chat transcript.

Use GitHub's private vulnerability reporting / Security Advisories for this repository when that feature is available. If private reporting is not available, contact the maintainer through a private channel before public disclosure. Include the affected file or component, impact, and minimal reproduction steps, but do not include live secret values.

## Credentials and secret exposure

Never commit API keys, OAuth tokens, bot tokens, passwords, private keys, production environment files, or database credentials.

If a credential may have been exposed:
1. identify the credential type and affected provider without reproducing its value;
2. revoke or rotate it at the provider;
3. verify the replacement through the existing owner-controlled operational process;
4. treat history rewriting as insufficient on its own — removing a value from Git does not revoke it.

## Repository controls

- Secret scanning runs against the full Git history through GitHub Actions.
- Dependency changes are reviewed through Dependabot and the repository's npm audit security gate.
- GitHub Actions must remain pinned to immutable commit SHAs and use explicit least-privilege permissions.

## Responsible testing

Test only systems, accounts, and data that you are authorized to access. Do not use exposed credentials, attempt destructive provider operations, or run denial-of-service tests. A security test must not publish content or mutate provider state unless a separate, explicit owner authorization permits that exact operation.
