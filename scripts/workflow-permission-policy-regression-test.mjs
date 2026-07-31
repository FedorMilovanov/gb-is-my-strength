#!/usr/bin/env node

import assert from 'node:assert/strict';
import { auditWorkflowPermissionPolicy, parseWorkflow } from './lib/workflow-permission-policy.mjs';

function registryFor(file, job, permissions, overrides = {}) {
  return {
    version: 1,
    workflows: {
      [file]: {
        jobs: {
          [job]: {
            permissions,
            purpose: 'fixture mutation',
            allowedEvents: ['workflow_run'],
            repositoryBoundary: 'same repository',
            branchBoundary: 'main exact SHA',
            mutationTargets: ['fixture'],
            requiresConcurrency: true,
            requiredMarkers: ['trusted-marker'],
            ...overrides,
          },
        },
      },
    },
  };
}

function workflow({
  event = 'workflow_run',
  workflowPermissions = 'contents: read',
  jobPermissions = '',
  uses = 'actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 # v9.0.0',
  jobId = 'record',
  extraJob = '',
  marker = '# trusted-marker',
} = {}) {
  const workflowPermissionBlock = workflowPermissions
    ? `permissions:\n${workflowPermissions.split('\n').map((line) => `  ${line}`).join('\n')}\n`
    : '';
  const jobPermissionBlock = jobPermissions
    ? `    permissions:\n${jobPermissions.split('\n').map((line) => `      ${line}`).join('\n')}\n`
    : '';
  return `name: Fixture\non:\n  ${event}:\n${workflowPermissionBlock}concurrency:\n  group: fixture\n  cancel-in-progress: false\njobs:\n  ${jobId}:\n${jobPermissionBlock}    runs-on: ubuntu-latest\n    steps:\n      - uses: ${uses}\n      - run: echo ok\n    ${marker}\n${extraJob}`;
}

function audit(text, registry, file = '.github/workflows/fixture.yml') {
  return auditWorkflowPermissionPolicy([parseWorkflow(text, file)], registry).issues;
}

export function runWorkflowPermissionPolicyRegressionTests() {
  const file = '.github/workflows/fixture.yml';

  {
    const text = workflow({ jobPermissions: 'contents: read\nissues: write' });
    const issues = audit(text, { version: 1, workflows: {} }, file);
    assert.ok(issues.some((item) => item.includes('unregistered write scopes: issues')));
  }

  {
    const text = workflow({
      workflowPermissions: 'contents: read\nissues: write',
      extraJob: '  validate:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo validate\n',
    });
    const policy = registryFor(file, 'record', { contents: 'read', issues: 'write' });
    const issues = audit(text, policy, file);
    assert.ok(issues.some((item) => item.includes('jobs.validate: unregistered write scopes: issues')));
  }

  {
    const text = workflow({ jobPermissions: 'contents: read\nid-token: write' });
    const issues = audit(text, { version: 1, workflows: {} }, file);
    assert.ok(issues.some((item) => item.includes('unregistered write scopes: id-token')));
  }

  {
    const text = workflow({
      jobPermissions: 'contents: read\nissues: write',
      uses: 'actions/github-script@v7',
    });
    const policy = registryFor(file, 'record', { contents: 'read', issues: 'write' });
    const issues = audit(text, policy, file);
    assert.ok(issues.some((item) => item.includes('privileged action is not pinned to a full SHA')));
  }

  {
    const text = workflow({ event: 'pull_request_target', jobPermissions: 'contents: write' });
    const policy = registryFor(file, 'record', { contents: 'write' }, { allowedEvents: ['pull_request_target'] });
    const issues = audit(text, policy, file);
    assert.ok(issues.some((item) => item.includes('pull_request_target with write permissions is forbidden')));
  }

  {
    const text = workflow({ jobPermissions: 'actions: read\ncontents: read\nissues: write' });
    const policy = registryFor(file, 'record', { actions: 'read', contents: 'read', issues: 'write' });
    assert.deepEqual(audit(text, policy, file), []);
  }

  {
    const text = workflow({ workflowPermissions: '' });
    const issues = audit(text, { version: 1, workflows: {} }, file);
    assert.ok(issues.some((item) => item.includes('implicit repository-default permissions are forbidden')));
  }

  console.log('Workflow permission policy regressions: PASS (7 adversarial fixtures).');
}

if (import.meta.url === `file://${process.argv[1]}`) runWorkflowPermissionPolicyRegressionTests();
