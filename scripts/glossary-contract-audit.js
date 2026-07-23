#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const policyPath = path.join(ROOT, "data/glossary-policy.json");
const dictionaryPath = path.join(ROOT, "data/glossary.json");
const runtimePath = path.join(ROOT, "js/glossary.js");
const siteRuntimePath = path.join(ROOT, "js/site.js");

const roots = [
  "src",
  "articles",
  "biografii",
  "hard-texts",
  "konfessii",
  "pastor-series",
  "baptisty-rossii"
];

const extensions = new Set([".astro", ".html", ".md", ".mdx", ".jsx", ".tsx"]);
const errors = [];
const warnings = [];

const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);
const rel = (file) => path.relative(ROOT, file).replaceAll(path.sep, "/");
const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`${rel(file)}: invalid JSON (${error.message})`);
    return null;
  }
}

function walk(directory, output = []) {
  if (!fs.existsSync(directory)) return output;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", "dist", "reports", "public"].includes(entry.name)) {
      continue;
    }

    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file, output);
    else if (extensions.has(path.extname(entry.name).toLowerCase())) output.push(file);
  }

  return output;
}

function dictionaryIndex(dictionary) {
  const aliases = new Map();

  for (const [canonical, raw] of Object.entries(dictionary || {})) {
    const entry = raw || {};
    const nested =
      entry.definition && typeof entry.definition === "object"
        ? entry.definition
        : {};

    const definition =
      typeof entry === "string"
        ? entry
        : typeof entry.definition === "string"
          ? entry.definition
          : typeof nested.definition === "string"
            ? nested.definition
            : "";

    if (!definition.trim()) {
      fail(`data/glossary.json: "${canonical}" has no brief definition`);
    }

    const forms = Array.isArray(entry.aliases)
      ? entry.aliases.slice()
      : Array.isArray(nested.aliases)
        ? nested.aliases.slice()
        : [];
    forms.unshift(canonical);

    for (const form of forms) {
      const key = normalize(form);
      if (!key) {
        fail(`data/glossary.json: "${canonical}" contains an empty alias`);
        continue;
      }

      const previous = aliases.get(key);
      if (previous && previous !== canonical) {
        fail(
          `data/glossary.json: alias "${form}" maps to both "${previous}" and "${canonical}"`
        );
      } else {
        aliases.set(key, canonical);
      }
    }

    for (const field of ["minWordGap", "minBlockGap", "maxPerArticle"]) {
      if (entry[field] !== undefined && !Number.isFinite(Number(entry[field]))) {
        fail(`data/glossary.json: "${canonical}.${field}" must be numeric`);
      }
    }
  }

  return aliases;
}

function validatePolicy(policy) {
  if (!policy) return;

  for (const field of [
    "rootSelectors",
    "proseSelectors",
    "hydrationForbiddenSelectors",
    "placementForbiddenSelectors"
  ]) {
    if (!Array.isArray(policy[field]) || policy[field].length === 0) {
      fail(`data/glossary-policy.json: ${field} must be a non-empty array`);
    }
  }

  for (const field of ["minWordGap", "minBlockGap", "maxPerArticle"]) {
    const value = policy.cadence && policy.cadence[field];
    if (!Number.isFinite(Number(value)) || Number(value) < 0) {
      fail(`data/glossary-policy.json: cadence.${field} must be non-negative`);
    }
  }

  for (const selector of [
    ".summary-card",
    ".note-box",
    ".context-bridge",
    ".reading-list-section",
    "table",
    "nav",
    "figure",
    "[data-glossary-skip]"
  ]) {
    if (!policy.placementForbiddenSelectors.includes(selector)) {
      fail(
        `data/glossary-policy.json: placement policy is missing ${selector}`
      );
    }
  }

  for (const selector of ["a", "abbr", ".gterm", ".gtip", "code", "pre"]) {
    if (!policy.hydrationForbiddenSelectors.includes(selector)) {
      fail(
        `data/glossary-policy.json: hydration policy is missing ${selector}`
      );
    }
  }
}

function parseAttributes(raw) {
  const classes = new Set();
  const attributes = new Map();
  const pattern =
    /([:@A-Za-z_][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  let match;
  while ((match = pattern.exec(raw)) !== null) {
    const name = match[1];
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    attributes.set(name, value);

    if (name === "class" || name === "className") {
      value.split(/\s+/).filter(Boolean).forEach((item) => classes.add(item));
    }
  }

  return { classes, attributes };
}

function frameMatches(selector, frame) {
  if (selector.startsWith(".")) return frame.classes.has(selector.slice(1));

  if (selector.startsWith("[") && selector.endsWith("]")) {
    const attribute = selector.slice(1, -1).split("=")[0].trim();
    return frame.attributes.has(attribute);
  }

  return /^[a-z][a-z0-9-]*$/i.test(selector)
    ? frame.tag === selector.toLowerCase()
    : false;
}

function hasForbiddenAncestor(stack, selectors) {
  return stack.some((frame) =>
    selectors.some((selector) => frameMatches(selector, frame))
  );
}

function dataTermFromTag(tag) {
  const match = tag.match(/data-term\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
  return match ? match[1] || match[2] || "" : "";
}

function auditSource(file, policy, aliases) {
  const source = fs.readFileSync(file, "utf8");
  const stack = [];
  const tags = /<\/?([A-Za-z][\w:-]*)([^>]*)>/g;
  let match;

  while ((match = tags.exec(source)) !== null) {
    const full = match[0];
    const tag = match[1].toLowerCase();
    const isClosing = full.startsWith("</");

    if (isClosing) {
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        if (stack[index].tag === tag) {
          stack.splice(index, 1);
          break;
        }
      }
      continue;
    }

    const parsed = parseAttributes(match[2] || "");
    const frame = { tag, ...parsed };
    const glossaryMarkup =
      frame.classes.has("gterm") || frame.classes.has("gtip");

    if (
      glossaryMarkup &&
      hasForbiddenAncestor(stack, policy.placementForbiddenSelectors)
    ) {
      const line = source.slice(0, match.index).split("\n").length;
      fail(`${rel(file)}:${line}: glossary markup is inside a forbidden container`);
    }

    if (frame.classes.has("gterm")) {
      const key = dataTermFromTag(full);
      if (key && !aliases.has(normalize(key))) {
        const line = source.slice(0, match.index).split("\n").length;
        fail(`${rel(file)}:${line}: unresolved data-term "${key}"`);
      }
    }

    const selfClosing =
      full.endsWith("/>") ||
      ["img", "source", "br", "hr", "meta", "link", "input"].includes(tag);
    if (!selfClosing) stack.push(frame);
  }
}

function validateRuntime(policy) {
  if (!fs.existsSync(runtimePath)) {
    fail("js/glossary.js is missing");
    return;
  }

  const runtime = fs.readFileSync(runtimePath, "utf8");

  for (const token of [
    "/data/glossary-policy.json",
    "hydrationForbiddenSelectors",
    "placementForbiddenSelectors",
    "minWordGap",
    "minBlockGap",
    "maxPerArticle",
    "data-glossary-skip",
    "hydrateGlossaryTerms"
  ]) {
    if (!runtime.includes(token)) {
      fail(`js/glossary.js: missing contract token ${token}`);
    }
  }

  if (/\bgill\b|dzhon-gill/i.test(runtime)) {
    fail("js/glossary.js: route- or series-specific logic is forbidden");
  }

  if (fs.existsSync(siteRuntimePath)) {
    const siteRuntime = fs.readFileSync(siteRuntimePath, "utf8");
    if (!siteRuntime.includes(".gtip")) {
      fail("js/site.js: TTS/runtime exclusion for .gtip is missing");
    }
  } else {
    warn("js/site.js is missing; TTS exclusion was not checked");
  }

  for (const selector of [".summary-card", ".note-box", ".context-bridge"]) {
    if (!policy.placementForbiddenSelectors.includes(selector)) {
      fail(`placement policy must forbid ${selector}`);
    }
  }
}

const policy = readJson(policyPath);
const dictionary = readJson(dictionaryPath);

if (policy) validatePolicy(policy);
const aliases = dictionary ? dictionaryIndex(dictionary) : new Map();
if (policy) validateRuntime(policy);

const files = roots.flatMap((root) => walk(path.join(ROOT, root)));
if (policy && dictionary) {
  files.forEach((file) => auditSource(file, policy, aliases));
}

warnings.forEach((message) => console.warn(`WARN: ${message}`));

if (errors.length) {
  errors.slice(0, 200).forEach((message) => console.error(`ERROR: ${message}`));
  if (errors.length > 200) {
    console.error(`ERROR: ${errors.length - 200} additional errors omitted`);
  }
  console.error(
    `Glossary contract failed: ${errors.length} error(s), ${warnings.length} warning(s).`
  );
  process.exit(1);
}

console.log(
  `Glossary contract passed: ${Object.keys(dictionary || {}).length} terms, ${aliases.size} aliases, ${files.length} source files.`
);
