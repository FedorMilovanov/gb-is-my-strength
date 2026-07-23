#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const POLICY_PATH = path.join(ROOT, "data", "glossary-policy.json");
const DICT_PATH = path.join(ROOT, "data", "glossary.json");
const RUNTIME_PATH = path.join(ROOT, "js", "glossary.js");
const SITE_RUNTIME_PATH = path.join(ROOT, "js", "site.js");

const SOURCE_ROOTS = [
  "src",
  "articles",
  "biografii",
  "hard-texts",
  "konfessii",
  "pastor-series",
  "baptisty-rossii"
].map((item) => path.join(ROOT, item));

const SOURCE_EXTENSIONS = new Set([
  ".astro",
  ".html",
  ".md",
  ".mdx",
  ".jsx",
  ".tsx"
]);

const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`${relative(filePath)}: cannot read valid JSON (${error.message})`);
    return null;
  }
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replaceAll(path.sep, "/");
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function walk(directory, files = []) {
  if (!fs.existsSync(directory)) return files;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (
      entry.name === ".git" ||
      entry.name === "node_modules" ||
      entry.name === "dist" ||
      entry.name === "reports" ||
      entry.name === "public"
    ) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

function compileDictionary(dict) {
  const aliasAll = new Map();

  for (const [canonical, rawEntry] of Object.entries(dict || {})) {
    const entry = rawEntry || {};
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

    const aliases = Array.isArray(entry.aliases)
      ? entry.aliases.slice()
      : Array.isArray(nested.aliases)
        ? nested.aliases.slice()
        : [];

    aliases.unshift(canonical);

    for (const alias of aliases) {
      const key = normalize(alias);
      if (!key) {
        fail(`data/glossary.json: "${canonical}" contains an empty alias`);
        continue;
      }

      const previous = aliasAll.get(key);
      if (previous && previous !== canonical) {
        fail(
          `data/glossary.json: alias "${alias}" maps to both "${previous}" and "${canonical}"`
        );
      } else {
        aliasAll.set(key, canonical);
      }
    }

    for (const field of ["minWordGap", "minBlockGap", "maxPerArticle"]) {
      if (entry[field] !== undefined && !Number.isFinite(Number(entry[field]))) {
        fail(`data/glossary.json: "${canonical}.${field}" must be numeric`);
      }
    }
  }

  return aliasAll;
}

function validatePolicy(policy) {
  if (!policy || typeof policy !== "object") return;

  for (const field of ["rootSelectors", "proseSelectors", "forbiddenSelectors"]) {
    if (!Array.isArray(policy[field]) || policy[field].length === 0) {
      fail(`data/glossary-policy.json: ${field} must be a non-empty array`);
    }
  }

  for (const field of ["minWordGap", "minBlockGap", "maxPerArticle"]) {
    const value = policy.cadence && policy.cadence[field];
    if (!Number.isFinite(Number(value)) || Number(value) < 0) {
      fail(
        `data/glossary-policy.json: cadence.${field} must be a non-negative number`
      );
    }
  }

  const requiredUniversalSelectors = [
    ".summary-card",
    ".note-box",
    ".context-bridge",
    ".reading-list-section",
    "table",
    "nav",
    "figure",
    "[data-glossary-skip]"
  ];

  for (const selector of requiredUniversalSelectors) {
    if (!policy.forbiddenSelectors.includes(selector)) {
      fail(
        `data/glossary-policy.json: missing universal forbidden selector ${selector}`
      );
    }
  }
}

function selectorMatchesFrame(selector, frame) {
  if (!selector || !frame) return false;

  if (selector.startsWith(".")) {
    return frame.classes.has(selector.slice(1));
  }

  if (selector.startsWith("[") && selector.endsWith("]")) {
    const body = selector.slice(1, -1);
    const attribute = body.split("=")[0].trim();
    return frame.attributes.has(attribute);
  }

  if (/^[a-z][a-z0-9-]*$/i.test(selector)) {
    return frame.tag === selector.toLowerCase();
  }

  return false;
}

function frameForbidden(stack, policy) {
  return stack.some((frame) =>
    policy.forbiddenSelectors.some((selector) =>
      selectorMatchesFrame(selector, frame)
    )
  );
}

function parseAttributes(raw) {
  const classes = new Set();
  const attributes = new Map();
  const attributePattern =
    /([:@A-Za-z_][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  let match;
  while ((match = attributePattern.exec(raw)) !== null) {
    const name = match[1];
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    attributes.set(name, value);

    if (name === "class" || name === "className") {
      value
        .split(/\s+/)
        .filter(Boolean)
        .forEach((item) => classes.add(item));
    }
  }

  return { classes, attributes };
}

function visibleTermFromOpenTag(rawTag) {
  const match = rawTag.match(/data-term\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
  return match ? match[1] || match[2] || "" : "";
}

function auditSourceFile(filePath, policy, aliasAll) {
  const source = fs.readFileSync(filePath, "utf8");
  const stack = [];
  const tagPattern = /<\/?([A-Za-z][\w:-]*)([^>]*)>/g;
  let match;

  while ((match = tagPattern.exec(source)) !== null) {
    const full = match[0];
    const tag = match[1].toLowerCase();
    const rawAttributes = match[2] || "";
    const isClosing = full.startsWith("</");
    const isSelfClosing =
      full.endsWith("/>") ||
      ["img", "source", "br", "hr", "meta", "link", "input"].includes(tag);

    if (isClosing) {
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        if (stack[index].tag === tag) {
          stack.splice(index, 1);
          break;
        }
      }
      continue;
    }

    const parsed = parseAttributes(rawAttributes);
    const frame = {
      tag,
      classes: parsed.classes,
      attributes: parsed.attributes
    };
    const nextStack = stack.concat(frame);
    const isGlossaryTerm =
      parsed.classes.has("gterm") || parsed.classes.has("gtip");

    if (isGlossaryTerm && frameForbidden(nextStack, policy)) {
      const line = source.slice(0, match.index).split("\n").length;
      fail(
        `${relative(filePath)}:${line}: glossary markup is inside a forbidden container`
      );
    }

    if (parsed.classes.has("gterm")) {
      const dataTerm = visibleTermFromOpenTag(full);
      if (dataTerm && !aliasAll.has(normalize(dataTerm))) {
        const line = source.slice(0, match.index).split("\n").length;
        fail(
          `${relative(filePath)}:${line}: data-term "${dataTerm}" does not resolve to data/glossary.json`
        );
      }
    }

    if (!isSelfClosing) stack.push(frame);
  }
}

function validateRuntime(policy) {
  if (!fs.existsSync(RUNTIME_PATH)) {
    fail("js/glossary.js is missing");
    return;
  }

  const runtime = fs.readFileSync(RUNTIME_PATH, "utf8");
  const requiredTokens = [
    "/data/glossary-policy.json",
    "minWordGap",
    "minBlockGap",
    "maxPerArticle",
    "data-glossary-skip",
    "hydrateGlossaryTerms"
  ];

  for (const token of requiredTokens) {
    if (!runtime.includes(token)) {
      fail(`js/glossary.js: missing universal contract token ${token}`);
    }
  }

  if (/\bgill\b|dzhon-gill/i.test(runtime)) {
    fail("js/glossary.js: route- or series-specific glossary logic is forbidden");
  }

  if (fs.existsSync(SITE_RUNTIME_PATH)) {
    const siteRuntime = fs.readFileSync(SITE_RUNTIME_PATH, "utf8");
    if (!siteRuntime.includes(".gtip")) {
      fail("js/site.js: TTS/runtime exclusion for .gtip is missing");
    }
  } else {
    warn("js/site.js is missing; TTS exclusion could not be checked");
  }

  const forbidden = policy.forbiddenSelectors || [];
  for (const selector of [
    ".summary-card",
    ".note-box",
    ".context-bridge",
    ".reading-list-section"
  ]) {
    if (!forbidden.includes(selector)) {
      fail(`glossary runtime policy does not forbid ${selector}`);
    }
  }
}

const policy = readJson(POLICY_PATH);
const dict = readJson(DICT_PATH);

if (policy) validatePolicy(policy);
const aliasAll = dict ? compileDictionary(dict) : new Map();
if (policy) validateRuntime(policy);

const files = SOURCE_ROOTS.flatMap((sourceRoot) => walk(sourceRoot));
if (policy && dict) {
  files.forEach((filePath) => auditSourceFile(filePath, policy, aliasAll));
}

warnings.forEach((message) => console.warn(`WARN: ${message}`));

if (errors.length > 0) {
  errors.forEach((message) => console.error(`ERROR: ${message}`));
  console.error(
    `Glossary contract failed: ${errors.length} error(s), ${warnings.length} warning(s).`
  );
  process.exit(1);
}

console.log(
  `Glossary contract passed: ${Object.keys(dict || {}).length} terms, ${aliasAll.size} aliases, ${files.length} source files.`
);
