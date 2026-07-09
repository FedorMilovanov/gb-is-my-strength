#!/usr/bin/env node
'use strict';

/*
 * Compatibility entrypoint.
 *
 * Historical versions of this command treated repository-root legacy HTML as
 * current production truth and compared Astro output back to that mutable copy.
 * Strict-native production is now owned by Astro/strangler dist, so the command
 * delegates to the native source/dist contract audit. The old implementation is
 * retained under scripts/legacy-audits/ for migration archaeology only and is
 * intentionally outside blocking validation.
 */

console.log('ℹ️ astro:audit:article-mdx now runs the strict-native article contract audit.');
require('./article-native-contract-audit');
