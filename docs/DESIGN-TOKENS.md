# Design Tokens — gospod-bog.ru

## Policy

New CSS should use canonical semantic tokens:

```css
--color-canvas
--color-surface
--color-surface-muted
--color-text
--color-text-muted
--color-text-faint
--color-border
--color-accent
```

Legacy tokens remain as compatibility aliases for old components and inline article CSS:

```css
--bg
--bg-elevated
--text
--muted
--text-primary
--text-secondary
--text-muted
--fg
--fg-secondary
```

Do not introduce new component code using legacy names unless it is a compatibility patch.

## Architecture

The project uses a staged token architecture:

1. canonical semantic tokens (`--color-*`)
2. theme remap in `html.dark`
3. legacy aliases for existing code
4. future component tokens only when a component genuinely needs local state tokens

This keeps old pages stable while allowing new articles/components to use the clean token layer.

## Migration rule

When editing an old component, migrate only touched declarations to `--color-*` if it is visually safe. Avoid global search/replace: contrast and dark-mode must be checked component by component.

## Governance check

Run:

```bash
npm run tokens:check
```

The check fails if canonical tokens are missing or legacy aliases stop pointing to canonical tokens. Legacy `var(--text)`-style usages are reported as migration telemetry, not as an error, until the migration is complete.

## Current migration status

- v20: canonical semantic layer and legacy aliases.
- v21: command palette bridge moved to canonical `--color-*`; token governance check added.
- Next phases should migrate component clusters gradually, only with visual checks.

- v22: governance ratchet added; safe global controls migrated; `ci:check` runs `tokens:check`.

- v23: base/article reading layer migrated to canonical `--color-*`; ratchet lowered to 552.

- v24: quiz/bookmark/bottom-TOC utility cluster migrated; ratchet lowered to 483.
