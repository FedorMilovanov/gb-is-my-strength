import compiledRelations from '../../lib/relations/compiled';

export const prerender = true;

const body = `${JSON.stringify(compiledRelations)}\n`;

export function GET() {
  return new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
      'x-relation-engine': compiledRelations.engineVersion,
    },
  });
}
