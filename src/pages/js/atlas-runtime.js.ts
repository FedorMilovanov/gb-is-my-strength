import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const prerender = true;

const runtimeSource = path.join(process.cwd(), 'src/runtime/atlas-runtime.js');

export async function GET() {
  const runtime = await readFile(runtimeSource, 'utf8');
  return new Response(runtime, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
