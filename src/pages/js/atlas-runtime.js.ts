import { readFile } from 'node:fs/promises';

export const prerender = true;

const runtimeSource = new URL('../../runtime/atlas-runtime.js', import.meta.url);

export async function GET() {
  const runtime = await readFile(runtimeSource, 'utf8');
  return new Response(runtime, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
