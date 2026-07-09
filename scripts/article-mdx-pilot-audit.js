#!/usr/bin/env node
'use strict';

/*
 * Compatibility entrypoint.
 *
 * Historical versions of this command treated repository-root legacy HTML as
 * current production truth and compared Astro output back to that mutable copy.
 * Strict-native production is now owned by Astro/strangler dist, so the command
 * delegates to the effective native source/dist contract audit. The old
 * implementation remains under scripts/legacy-audits/ for migration archaeology.
 */

if (!process.argv.includes('--articles-only')) process.argv.push('--articles-only');
console.log('ℹ️ astro:audit:article-mdx now runs the effective strict-native standalone article contract audit.');
require('./article-native-effective-contract-audit');
