#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { projectNoteRegistry } from './lib/note-registry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = {
  distRoot: path.join(ROOT, 'dist'),
  reportDir: path.join(ROOT, 'reports'),
  styleSource: path.join(ROOT, 'src', 'runtime', 'note-registry.css'),
  dryRun: false,
};

for (const arg of process.argv.slice(2)) {
  if (arg === '--dry-run') options.dryRun = true;
  else if (arg.startsWith('--dist=')) options.distRoot = path.resolve(ROOT, arg.slice('--dist='.length));
  else if (arg.startsWith('--reports=')) options.reportDir = path.resolve(ROOT, arg.slice('--reports='.length));
  else if (arg.startsWith('--style=')) options.styleSource = path.resolve(ROOT, arg.slice('--style='.length));
  else throw new Error(`unknown argument: ${arg}`);
}

try {
  const report = projectNoteRegistry(options);
  console.log('A03 NoteRegistry projection');
  console.log(`Routes with notes: ${report.registry.routeCount}`);
  console.log(`Notes: ${report.registry.noteCount}`);
  console.log(`HTML files scanned/changed: ${report.filesScanned}/${report.filesChanged}`);
  console.log(`Interaction owner: ${report.registry.interactionOwner}`);
  console.log(`Stylesheet: ${report.registry.stylesheet}`);
  console.log(options.dryRun ? 'A03 NoteRegistry dry-run passed' : 'A03 NoteRegistry projected to final dist');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
