import path from 'node:path';

const TOP_LEVEL_KEY_RX = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/;
const JOB_KEY_RX = /^  ([A-Za-z0-9_-]+):\s*$/;
const PERMISSION_VALUE_RX = /^(?:read|write|none)$/;
const FULL_SHA_RX = /^[a-f0-9]{40}$/i;

function stripYamlComment(line) {
  let single = false;
  let double = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const previous = index > 0 ? line[index - 1] : '';
    if (char === "'" && !double) single = !single;
    else if (char === '"' && !single && previous !== '\\') double = !double;
    else if (char === '#' && !single && !double) return line.slice(0, index);
  }
  return line;
}

function indentation(line) {
  return line.match(/^\s*/)?.[0].length || 0;
}

function unquote(value) {
  const trimmed = String(value || '').trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseInlineList(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return [];
  return trimmed.slice(1, -1)
    .split(',')
    .map((item) => unquote(item))
    .filter(Boolean);
}

function parsePermissions(lines, index, expectedIndent) {
  const raw = stripYamlComment(lines[index]);
  if (indentation(raw) !== expectedIndent || !/^\s*permissions\s*:/.test(raw)) return null;
  const rest = raw.slice(raw.indexOf(':') + 1).trim();
  if (rest === '{}') return { permissions: {}, nextIndex: index + 1, explicit: true };
  if (rest === 'read-all' || rest === 'write-all') {
    return {
      permissions: { '*': rest === 'read-all' ? 'read' : 'write' },
      nextIndex: index + 1,
      explicit: true,
    };
  }
  if (rest) throw new Error(`unsupported permissions scalar at line ${index + 1}: ${rest}`);

  const permissions = {};
  let cursor = index + 1;
  for (; cursor < lines.length; cursor += 1) {
    const candidate = stripYamlComment(lines[cursor]);
    if (!candidate.trim()) continue;
    const candidateIndent = indentation(candidate);
    if (candidateIndent <= expectedIndent) break;
    if (candidateIndent !== expectedIndent + 2) {
      throw new Error(`invalid permissions indentation at line ${cursor + 1}`);
    }
    const match = candidate.trim().match(/^([A-Za-z0-9_-]+):\s*([A-Za-z-]+)\s*$/);
    if (!match || !PERMISSION_VALUE_RX.test(match[2])) {
      throw new Error(`invalid permission entry at line ${cursor + 1}: ${candidate.trim()}`);
    }
    permissions[match[1]] = match[2];
  }
  return { permissions, nextIndex: cursor, explicit: true };
}

function parseEvents(lines) {
  const index = lines.findIndex((line) => indentation(stripYamlComment(line)) === 0 && /^on\s*:/.test(stripYamlComment(line).trim()));
  if (index < 0) return [];
  const raw = stripYamlComment(lines[index]).trim();
  const rest = raw.slice(raw.indexOf(':') + 1).trim();
  if (rest) {
    const inline = parseInlineList(rest);
    return inline.length ? inline.sort() : [unquote(rest)].filter(Boolean);
  }

  const events = [];
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const candidate = stripYamlComment(lines[cursor]);
    if (!candidate.trim()) continue;
    const candidateIndent = indentation(candidate);
    if (candidateIndent === 0) break;
    if (candidateIndent === 2) {
      const match = candidate.trim().match(/^([A-Za-z0-9_-]+):(?:\s|$)/);
      if (match) events.push(match[1]);
    }
  }
  return [...new Set(events)].sort();
}

function findTopLevelBlock(lines, key) {
  return lines.findIndex((line) => {
    const clean = stripYamlComment(line);
    return indentation(clean) === 0 && clean.trim().startsWith(`${key}:`);
  });
}

function parseExternalAction(value) {
  const normalized = unquote(value);
  if (!normalized || normalized.startsWith('./') || normalized.startsWith('docker://')) return null;
  const separator = normalized.lastIndexOf('@');
  if (separator <= 0 || separator === normalized.length - 1) {
    return { value: normalized, owner: normalized, ref: '', pinned: false };
  }
  const owner = normalized.slice(0, separator);
  const ref = normalized.slice(separator + 1);
  return { value: normalized, owner, ref, pinned: FULL_SHA_RX.test(ref) };
}

function normalizePermissions(permissions) {
  return Object.fromEntries(Object.entries(permissions || {}).sort(([left], [right]) => left.localeCompare(right)));
}

function writeScopes(permissions) {
  return Object.entries(permissions || {})
    .filter(([, value]) => value === 'write')
    .map(([scope]) => scope)
    .sort();
}

function equalObjects(left, right) {
  return JSON.stringify(normalizePermissions(left)) === JSON.stringify(normalizePermissions(right));
}

export function parseWorkflow(text, file = '<workflow>') {
  const lines = String(text).split(/\r?\n/);
  const events = parseEvents(lines);
  const workflowPermissionsIndex = lines.findIndex((line) => {
    const clean = stripYamlComment(line);
    return indentation(clean) === 0 && /^permissions\s*:/.test(clean.trim());
  });
  let workflowPermissions = null;
  if (workflowPermissionsIndex >= 0) {
    workflowPermissions = parsePermissions(lines, workflowPermissionsIndex, 0)?.permissions ?? null;
  }
  const workflowConcurrency = findTopLevelBlock(lines, 'concurrency') >= 0;
  const jobsIndex = findTopLevelBlock(lines, 'jobs');
  if (jobsIndex < 0) throw new Error(`${file}: jobs block is missing`);

  const jobStarts = [];
  for (let cursor = jobsIndex + 1; cursor < lines.length; cursor += 1) {
    const clean = stripYamlComment(lines[cursor]);
    if (!clean.trim()) continue;
    if (indentation(clean) === 0) break;
    const match = clean.match(JOB_KEY_RX);
    if (match) jobStarts.push({ id: match[1], index: cursor });
  }

  const jobs = {};
  for (let position = 0; position < jobStarts.length; position += 1) {
    const start = jobStarts[position];
    const end = position + 1 < jobStarts.length ? jobStarts[position + 1].index : lines.length;
    const block = lines.slice(start.index, end).join('\n');
    let jobPermissions = null;
    for (let cursor = start.index + 1; cursor < end; cursor += 1) {
      const clean = stripYamlComment(lines[cursor]);
      if (indentation(clean) === 4 && /^\s*permissions\s*:/.test(clean)) {
        jobPermissions = parsePermissions(lines, cursor, 4)?.permissions ?? null;
        break;
      }
    }
    const effectivePermissions = jobPermissions !== null ? jobPermissions : workflowPermissions;
    const actions = [];
    for (let cursor = start.index + 1; cursor < end; cursor += 1) {
      const clean = stripYamlComment(lines[cursor]);
      const match = clean.match(/^\s*uses:\s*(.+?)\s*$/);
      if (!match) continue;
      const action = parseExternalAction(match[1]);
      if (action) actions.push({ ...action, line: cursor + 1 });
    }
    const jobConcurrency = lines.slice(start.index + 1, end).some((line) => {
      const clean = stripYamlComment(line);
      return indentation(clean) === 4 && /^\s*concurrency\s*:/.test(clean);
    });
    jobs[start.id] = {
      id: start.id,
      block,
      actions,
      declaredPermissions: jobPermissions === null ? null : normalizePermissions(jobPermissions),
      effectivePermissions: effectivePermissions === null ? null : normalizePermissions(effectivePermissions),
      writeScopes: writeScopes(effectivePermissions),
      concurrency: jobConcurrency,
    };
  }

  return {
    file: path.posix.normalize(file),
    text,
    events,
    workflowPermissions: workflowPermissions === null ? null : normalizePermissions(workflowPermissions),
    workflowConcurrency,
    jobs,
  };
}

function validatePolicyMetadata(policy, file, jobId, addIssue) {
  const requiredStrings = ['purpose', 'repositoryBoundary', 'branchBoundary'];
  for (const field of requiredStrings) {
    if (typeof policy[field] !== 'string' || !policy[field].trim()) {
      addIssue(`${file} jobs.${jobId}: permission policy requires non-empty ${field}`);
    }
  }
  if (!Array.isArray(policy.allowedEvents) || policy.allowedEvents.length === 0) {
    addIssue(`${file} jobs.${jobId}: permission policy requires allowedEvents[]`);
  }
  if (!Array.isArray(policy.mutationTargets) || policy.mutationTargets.length === 0) {
    addIssue(`${file} jobs.${jobId}: permission policy requires mutationTargets[]`);
  }
  if (!Array.isArray(policy.requiredMarkers)) {
    addIssue(`${file} jobs.${jobId}: permission policy requires requiredMarkers[]`);
  }
}

export function auditWorkflowPermissionPolicy(workflows, registry) {
  const issues = [];
  const addIssue = (message) => {
    if (!issues.includes(message)) issues.push(message);
  };
  if (!registry || registry.version !== 1 || typeof registry.workflows !== 'object') {
    return { issues: ['workflow permission registry must be version 1 with workflows{}'], privilegedJobs: [], effectivePermissions: [] };
  }

  const privilegedJobs = [];
  const effectivePermissions = [];
  const byFile = new Map(workflows.map((workflow) => [workflow.file, workflow]));

  for (const workflow of workflows) {
    for (const job of Object.values(workflow.jobs)) {
      if (job.effectivePermissions === null) {
        addIssue(`${workflow.file} jobs.${job.id}: implicit repository-default permissions are forbidden`);
        continue;
      }
      effectivePermissions.push({
        workflow: workflow.file,
        job: job.id,
        permissions: job.effectivePermissions,
        writeScopes: job.writeScopes,
      });
      if (job.writeScopes.length === 0) continue;

      const policy = registry.workflows?.[workflow.file]?.jobs?.[job.id];
      if (!policy) {
        addIssue(`${workflow.file} jobs.${job.id}: unregistered write scopes: ${job.writeScopes.join(', ')}`);
        continue;
      }
      validatePolicyMetadata(policy, workflow.file, job.id, addIssue);
      if (!equalObjects(job.effectivePermissions, policy.permissions || {})) {
        addIssue(`${workflow.file} jobs.${job.id}: effective permissions do not match registry`);
      }
      for (const event of policy.allowedEvents || []) {
        if (!workflow.events.includes(event)) {
          addIssue(`${workflow.file} jobs.${job.id}: policy event ${event} is absent from workflow triggers`);
        }
      }
      if (workflow.events.includes('pull_request_target') && policy.allowPullRequestTarget !== true) {
        addIssue(`${workflow.file} jobs.${job.id}: pull_request_target with write permissions is forbidden`);
      }
      if (policy.requiresConcurrency !== false && !workflow.workflowConcurrency && !job.concurrency) {
        addIssue(`${workflow.file} jobs.${job.id}: mutation job requires concurrency/idempotency boundary`);
      }
      for (const marker of policy.requiredMarkers || []) {
        if (!workflow.text.includes(marker)) {
          addIssue(`${workflow.file} jobs.${job.id}: required trust-boundary marker is missing: ${marker}`);
        }
      }
      for (const action of job.actions) {
        if (!action.pinned) {
          addIssue(`${workflow.file} jobs.${job.id}: privileged action is not pinned to a full SHA at line ${action.line}: ${action.value}`);
        }
      }
      privilegedJobs.push({
        workflow: workflow.file,
        job: job.id,
        permissions: job.effectivePermissions,
        writeScopes: job.writeScopes,
        purpose: policy.purpose,
        mutationTargets: policy.mutationTargets,
      });
    }
  }

  for (const [file, workflowPolicy] of Object.entries(registry.workflows)) {
    const workflow = byFile.get(file);
    if (!workflow) {
      addIssue(`${file}: registered permission policy points to a missing workflow`);
      continue;
    }
    for (const jobId of Object.keys(workflowPolicy.jobs || {})) {
      if (!workflow.jobs[jobId]) addIssue(`${file} jobs.${jobId}: registered permission policy points to a missing job`);
      else if (workflow.jobs[jobId].writeScopes.length === 0) addIssue(`${file} jobs.${jobId}: stale write policy remains for a read-only job`);
    }
  }

  return { issues, privilegedJobs, effectivePermissions };
}
