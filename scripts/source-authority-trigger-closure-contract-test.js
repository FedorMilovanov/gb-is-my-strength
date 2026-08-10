#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WORKFLOW_REL = '.github/workflows/source-authority-contract.yml';
const VALIDATOR_REL = 'scripts/sources-hygiene.js';
const CONTRACT_REL = 'scripts/source-authority-trigger-closure-contract-test.js';
const PACKAGE_REL = 'package.json';
const LOCK_REL = 'package-lock.json';
const LIGHT_SCRIPT = 'validate:static-publication:light';
const HYGIENE_SCRIPT = 'sources:hygiene';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function parseJson(text, label, issues) {
  try { return JSON.parse(text); }
  catch (error) {
    issues.push(`${label}: invalid JSON: ${error.message}`);
    return {};
  }
}

function extractConstStringArray(source, name, issues) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!match) {
    issues.push(`${VALIDATOR_REL}: ${name} declaration missing or no longer declarative`);
    return [];
  }
  const values = [];
  const stringPattern = /(['"])(.*?)\1/g;
  let item;
  while ((item = stringPattern.exec(match[1]))) values.push(item[2]);
  if (!values.length) issues.push(`${VALIDATOR_REL}: ${name} must contain at least one literal path`);
  return values;
}

function collectNpmScriptClosure(scripts, rootName, issues) {
  const seen = new Set();
  const stack = [rootName];
  while (stack.length) {
    const name = stack.pop();
    if (seen.has(name)) continue;
    seen.add(name);
    const command = scripts[name];
    if (typeof command !== 'string') {
      issues.push(`${PACKAGE_REL} scripts.${name}: missing from ${rootName} composition closure`);
      continue;
    }
    const re = /(?:^|[;&|]\s*|\s)npm\s+run\s+([A-Za-z0-9:_-]+)/g;
    let match;
    while ((match = re.exec(command))) stack.push(match[1]);
  }
  return seen;
}

function collectDirectScriptFiles(scripts, closure) {
  const files = new Set();
  const re = /(?:^|[;&|]\s*|\s)(?:node|bash)\s+(?!-e\b)(["']?)(scripts\/[A-Za-z0-9_./-]+\.(?:js|mjs|cjs|sh))\1/g;
  for (const name of closure) {
    const command = scripts[name];
    if (typeof command !== 'string') continue;
    let match;
    while ((match = re.exec(command))) files.add(match[2]);
    re.lastIndex = 0;
  }
  return [...files].sort();
}

function indentation(line) {
  return line.match(/^\s*/)[0].length;
}

function extractEventPaths(workflow, eventName, issues) {
  const lines = workflow.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `  ${eventName}:`);
  if (start < 0) {
    issues.push(`${WORKFLOW_REL}: on.${eventName} missing`);
    return [];
  }
  let pathsLine = -1;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    const indent = indentation(line);
    if (line.trim() && indent <= 2) break;
    if (indent === 4 && line.trim() === 'paths:') {
      pathsLine = i;
      break;
    }
  }
  if (pathsLine < 0) {
    issues.push(`${WORKFLOW_REL}: on.${eventName}.paths missing`);
    return [];
  }
  const paths = [];
  for (let i = pathsLine + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    const indent = indentation(line);
    if (indent <= 4) break;
    const match = line.match(/^\s{6}-\s+(['"]?)(.+?)\1\s*$/);
    if (!match) {
      issues.push(`${WORKFLOW_REL}: unsupported ${eventName}.paths entry: ${line.trim()}`);
      continue;
    }
    paths.push(match[2]);
  }
  return paths;
}

function globToRegExp(pattern) {
  let out = '^';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        i += 1;
        if (pattern[i + 1] === '/') {
          i += 1;
          out += '(?:.*/)?';
        } else {
          out += '.*';
        }
      } else {
        out += '[^/]*';
      }
    } else if (ch === '?') {
      out += '[^/]';
    } else {
      out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`${out}$`);
}

function pathIncluded(rel, patterns) {
  let included = false;
  for (const raw of patterns) {
    const negative = raw.startsWith('!');
    const pattern = negative ? raw.slice(1) : raw;
    if (globToRegExp(pattern).test(rel)) included = !negative;
  }
  return included;
}

function dirProbe(dir) {
  return `${dir.replace(/\/+$/, '')}/__source_authority_trigger_probe__/ProbeBody.astro`;
}

function sortedUnique(items) {
  return [...new Set(items)].sort();
}

function sameSet(a, b) {
  const aa = sortedUnique(a);
  const bb = sortedUnique(b);
  return aa.length === bb.length && aa.every((value, index) => value === bb[index]);
}

function validateContract({ workflow, packageText, validatorText }) {
  const issues = [];
  const pkg = parseJson(packageText, PACKAGE_REL, issues);
  const scripts = pkg.scripts || {};
  const closure = collectNpmScriptClosure(scripts, LIGHT_SCRIPT, issues);

  if (!closure.has(HYGIENE_SCRIPT)) {
    issues.push(`${PACKAGE_REL}: ${LIGHT_SCRIPT} must transitively include ${HYGIENE_SCRIPT}`);
  }
  const hygieneCommand = scripts[HYGIENE_SCRIPT];
  if (typeof hygieneCommand !== 'string' || !/^\s*node\s+scripts\/sources-hygiene\.js(?:\s|$)/.test(hygieneCommand)) {
    issues.push(`${PACKAGE_REL}: scripts.${HYGIENE_SCRIPT} must execute ${VALIDATOR_REL}`);
  }

  const directScriptFiles = collectDirectScriptFiles(scripts, closure);
  const scanDirs = extractConstStringArray(validatorText, 'SCAN_DIRS', issues);
  const scanFiles = extractConstStringArray(validatorText, 'SCAN_FILES', issues);
  const pullPaths = extractEventPaths(workflow, 'pull_request', issues);
  const pushPaths = extractEventPaths(workflow, 'push', issues);

  if (!sameSet(pullPaths, pushPaths)) {
    issues.push(`${WORKFLOW_REL}: pull_request.paths and push.paths must be symmetric`);
  }

  const required = [
    [PACKAGE_REL, 'light-gate composition owner'],
    [LOCK_REL, 'npm ci dependency lock'],
    [VALIDATOR_REL, 'S12 validator self'],
    [CONTRACT_REL, 'trigger-closure contract self'],
    [WORKFLOW_REL, 'workflow self'],
    ...directScriptFiles.map((file) => [file, `light-gate direct script ${file}`]),
    ...scanDirs.map((dir) => [dirProbe(dir), `S12 protected directory ${dir}`]),
    ...scanFiles.map((file) => [file, `S12 explicit reader/config input ${file}`]),
  ];

  for (const [probe, label] of required) {
    if (!pathIncluded(probe, pullPaths)) issues.push(`${WORKFLOW_REL}: pull_request.paths misses ${label} (${probe})`);
    if (!pathIncluded(probe, pushPaths)) issues.push(`${WORKFLOW_REL}: push.paths misses ${label} (${probe})`);
  }

  const contractStep = workflow.indexOf(`node ${CONTRACT_REL}`);
  const lightGateStep = workflow.indexOf(`npm run ${LIGHT_SCRIPT}`);
  if (contractStep < 0) issues.push(`${WORKFLOW_REL}: must execute ${CONTRACT_REL}`);
  if (lightGateStep < 0) issues.push(`${WORKFLOW_REL}: must execute npm run ${LIGHT_SCRIPT}`);
  if (contractStep >= 0 && lightGateStep >= 0 && contractStep > lightGateStep) {
    issues.push(`${WORKFLOW_REL}: trigger-closure contract must run before ${LIGHT_SCRIPT}`);
  }
  if (!/^permissions:\s*\n\s{2}contents:\s*read\s*$/m.test(workflow)) {
    issues.push(`${WORKFLOW_REL}: top-level permissions must remain contents: read`);
  }
  if (/^\s{2,}contents:\s*write\s*$/m.test(workflow)) {
    issues.push(`${WORKFLOW_REL}: contents: write is forbidden`);
  }

  return { issues, closure: sortedUnique([...closure]), directScriptFiles, scanDirs, scanFiles, pullPaths, pushPaths };
}

function removePathEntry(workflow, pattern, eventName = null) {
  const lines = workflow.split(/\r?\n/);
  let event = null;
  const out = [];
  for (const line of lines) {
    const eventMatch = line.match(/^  (pull_request|push):$/);
    if (eventMatch) event = eventMatch[1];
    const pathMatch = line.match(/^\s{6}-\s+(['"]?)(.+?)\1\s*$/);
    if (pathMatch && pathMatch[2] === pattern && (!eventName || event === eventName)) continue;
    out.push(line);
  }
  return out.join('\n');
}

function removeCoveringEntries(workflow, probe) {
  const seedIssues = [];
  const patterns = sortedUnique([
    ...extractEventPaths(workflow, 'pull_request', seedIssues),
    ...extractEventPaths(workflow, 'push', seedIssues),
  ]).filter((pattern) => !pattern.startsWith('!') && pathIncluded(probe, [pattern]));
  let mutated = workflow;
  for (const pattern of patterns) mutated = removePathEntry(mutated, pattern);
  return mutated;
}

function insertArrayLiteral(source, name, literal) {
  const re = new RegExp(`(const\\s+${name}\\s*=\\s*\\[)`);
  if (!re.test(source)) throw new Error(`cannot mutate ${name}`);
  return source.replace(re, `$1\n  '${literal}',`);
}

function removeNpmRun(command, scriptName) {
  return command
    .replace(new RegExp(`\\s*&&\\s*npm\\s+run\\s+${scriptName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`), '')
    .replace(new RegExp(`npm\\s+run\\s+${scriptName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*&&\\s*`), '')
    .replace(new RegExp(`npm\\s+run\\s+${scriptName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`), '');
}

function expectFailure(label, base, mutate, fragment) {
  const mutated = mutate({ ...base });
  const result = validateContract(mutated);
  if (!result.issues.some((issue) => issue.includes(fragment))) {
    const rendered = result.issues.length ? result.issues.join(' | ') : 'NO FAILURE';
    throw new Error(`mutation ${label} did not fail closed for ${fragment}: ${rendered}`);
  }
}

function runMutationSuite(base) {
  expectFailure('future direct validator script without trigger', base, (input) => {
    const pkg = JSON.parse(input.packageText);
    pkg.scripts['source-authority:future-probe'] = 'node scripts/__source_authority_future_validator.js';
    pkg.scripts[LIGHT_SCRIPT] += ' && npm run source-authority:future-probe';
    input.packageText = JSON.stringify(pkg, null, 2);
    input.workflow = removeCoveringEntries(input.workflow, 'scripts/__source_authority_future_validator.js');
    return input;
  }, 'light-gate direct script');

  expectFailure('new protected content family without trigger', base, (input) => {
    const probeRoot = 'src/components/__source_authority_future_family';
    input.validatorText = insertArrayLiteral(input.validatorText, 'SCAN_DIRS', probeRoot);
    input.workflow = removeCoveringEntries(input.workflow, dirProbe(probeRoot));
    return input;
  }, 'S12 protected directory');

  expectFailure('new manifest/data input without trigger', base, (input) => {
    const probe = 'data/__source_authority_future_manifest.json';
    input.validatorText = insertArrayLiteral(input.validatorText, 'SCAN_FILES', probe);
    input.workflow = removeCoveringEntries(input.workflow, probe);
    return input;
  }, 'S12 explicit reader/config input');

  expectFailure('validator-self trigger removed', base, (input) => {
    input.workflow = removeCoveringEntries(input.workflow, VALIDATOR_REL);
    return input;
  }, 'S12 validator self');

  expectFailure('composition owner trigger removed', base, (input) => {
    input.workflow = removeCoveringEntries(input.workflow, PACKAGE_REL);
    return input;
  }, 'light-gate composition owner');

  expectFailure('light composition drops sources:hygiene', base, (input) => {
    const pkg = JSON.parse(input.packageText);
    pkg.scripts[LIGHT_SCRIPT] = removeNpmRun(pkg.scripts[LIGHT_SCRIPT], HYGIENE_SCRIPT);
    input.packageText = JSON.stringify(pkg, null, 2);
    return input;
  }, `must transitively include ${HYGIENE_SCRIPT}`);

  expectFailure('sources:hygiene command points away from validator', base, (input) => {
    const pkg = JSON.parse(input.packageText);
    pkg.scripts[HYGIENE_SCRIPT] = 'node scripts/not-the-authority.js';
    input.packageText = JSON.stringify(pkg, null, 2);
    return input;
  }, `must execute ${VALIDATOR_REL}`);

  expectFailure('PR/push trigger divergence', base, (input) => {
    const pull = extractEventPaths(input.workflow, 'pull_request', []);
    const removable = pull.find((pattern) => pattern === 'src/content/articles/**') || pull[0];
    input.workflow = removePathEntry(input.workflow, removable, 'push');
    return input;
  }, 'must be symmetric');

  expectFailure('contract step removed', base, (input) => {
    input.workflow = input.workflow.replace(new RegExp(`^\\s*run:\\s*node\\s+${CONTRACT_REL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm'), '        run: echo closure-contract-removed');
    return input;
  }, `must execute ${CONTRACT_REL}`);
}

const base = {
  workflow: read(WORKFLOW_REL),
  packageText: read(PACKAGE_REL),
  validatorText: read(VALIDATOR_REL),
};
const result = validateContract(base);
if (result.issues.length) {
  console.error('❌ Source Authority trigger closure contract failed:');
  for (const issue of result.issues) console.error(`- ${issue}`);
  process.exit(1);
}

try { runMutationSuite(base); }
catch (error) {
  console.error(`❌ Source Authority adversarial mutation suite failed: ${error.message}`);
  process.exit(1);
}

console.log('✅ Source Authority trigger closure contract passed');
console.log(`✅ ${LIGHT_SCRIPT} composition reaches ${HYGIENE_SCRIPT}`);
console.log(`✅ PR/push trigger sets are symmetric (${result.pullPaths.length} paths each)`);
console.log(`✅ Light-gate direct script closure covered: ${result.directScriptFiles.length} script file(s)`);
console.log(`✅ S12 input authority covered: ${result.scanDirs.length} directory scopes + ${result.scanFiles.length} explicit file(s)`);
console.log('✅ Adversarial closure mutations fail closed');
