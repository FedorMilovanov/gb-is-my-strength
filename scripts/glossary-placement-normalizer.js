#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const WRITE = process.argv.includes("--write");
const POLICY_PATH = path.join(ROOT, "data", "glossary-policy.json");
const SOURCE_ROOTS = [
  "src",
  "articles",
  "biografii",
  "hard-texts",
  "konfessii",
  "pastor-series",
  "baptisty-rossii"
];
const SOURCE_EXTENSIONS = new Set([
  ".astro",
  ".html",
  ".md",
  ".mdx",
  ".jsx",
  ".tsx"
]);
const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);

function readPolicy() {
  const raw = JSON.parse(fs.readFileSync(POLICY_PATH, "utf8"));
  if (!Array.isArray(raw.placementForbiddenSelectors)) {
    throw new Error(
      "data/glossary-policy.json must define placementForbiddenSelectors"
    );
  }
  return raw;
}

function walk(directory, output = []) {
  if (!fs.existsSync(directory)) return output;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", "dist", "reports", "public"].includes(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, output);
      continue;
    }

    if (SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      output.push(fullPath);
    }
  }

  return output;
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
      value
        .split(/\s+/)
        .filter(Boolean)
        .forEach((item) => classes.add(item));
    }
  }

  return { classes, attributes };
}

function frameMatches(selector, frame) {
  if (!selector || !frame) return false;

  if (selector.startsWith(".")) {
    return frame.classes.has(selector.slice(1));
  }

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

function addEdit(edits, start, end) {
  if (start >= end) return;
  edits.push({ start, end });
}

function mergeEdits(edits) {
  if (!edits.length) return [];
  const sorted = edits
    .slice()
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [sorted[0]];

  for (const edit of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (edit.start <= last.end) {
      last.end = Math.max(last.end, edit.end);
    } else {
      merged.push({ ...edit });
    }
  }

  return merged;
}

function applyEdits(source, edits) {
  let output = source;
  for (const edit of mergeEdits(edits).sort((a, b) => b.start - a.start)) {
    output = output.slice(0, edit.start) + output.slice(edit.end);
  }
  return output;
}

function normalizeSource(source, selectors) {
  const stack = [];
  const edits = [];
  const tagPattern = /<\/?([A-Za-z][\w:-]*)([^>]*)>/g;
  let match;

  while ((match = tagPattern.exec(source)) !== null) {
    const fullTag = match[0];
    const tag = match[1].toLowerCase();
    const isClosing = fullTag.startsWith("</");

    if (isClosing) {
      let frameIndex = -1;
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        if (stack[index].tag === tag) {
          frameIndex = index;
          break;
        }
      }

      if (frameIndex === -1) continue;

      const frame = stack[frameIndex];
      stack.splice(frameIndex);

      if (frame.isForbiddenGlossaryTerm) {
        addEdit(edits, frame.openStart, frame.openEnd);
        addEdit(edits, match.index, tagPattern.lastIndex);
      }

      if (frame.isTooltipInsideForbiddenTerm) {
        addEdit(edits, frame.openStart, tagPattern.lastIndex);
      }

      continue;
    }

    const parsed = parseAttributes(match[2] || "");
    const insideForbiddenTerm = stack.some(
      (frame) => frame.isForbiddenGlossaryTerm || frame.insideForbiddenTerm
    );
    const isGlossaryTerm = parsed.classes.has("gterm");
    const isTooltip = parsed.classes.has("gtip");
    const isForbiddenGlossaryTerm =
      isGlossaryTerm && hasForbiddenAncestor(stack, selectors);

    const frame = {
      tag,
      classes: parsed.classes,
      attributes: parsed.attributes,
      openStart: match.index,
      openEnd: tagPattern.lastIndex,
      isForbiddenGlossaryTerm,
      insideForbiddenTerm: insideForbiddenTerm || isForbiddenGlossaryTerm,
      isTooltipInsideForbiddenTerm: isTooltip && insideForbiddenTerm
    };

    const isSelfClosing = fullTag.endsWith("/>") || VOID_TAGS.has(tag);
    if (isSelfClosing) {
      if (frame.isForbiddenGlossaryTerm || frame.isTooltipInsideForbiddenTerm) {
        addEdit(edits, frame.openStart, frame.openEnd);
      }
      continue;
    }

    stack.push(frame);
  }

  return {
    source: applyEdits(source, edits),
    edits: mergeEdits(edits)
  };
}

function main() {
  const policy = readPolicy();
  const files = SOURCE_ROOTS.flatMap((root) => walk(path.join(ROOT, root)));
  const changed = [];
  let editCount = 0;

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const result = normalizeSource(
      source,
      policy.placementForbiddenSelectors
    );

    if (result.source === source) continue;

    changed.push(path.relative(ROOT, file).replaceAll(path.sep, "/"));
    editCount += result.edits.length;

    if (WRITE) {
      fs.writeFileSync(file, result.source, "utf8");
    }
  }

  if (changed.length === 0) {
    console.log("Glossary placement normalization: source tree is clean.");
    return;
  }

  changed.forEach((file) => console.log(`${WRITE ? "FIXED" : "WOULD FIX"}: ${file}`));
  console.log(
    `Glossary placement normalization: ${changed.length} file(s), ${editCount} edit range(s).`
  );

  if (!WRITE) process.exitCode = 1;
}

main();

module.exports = { normalizeSource };
