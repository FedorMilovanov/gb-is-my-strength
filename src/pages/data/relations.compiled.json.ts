import graphData from '../../../data/links-graph.json';
import seriesData from '../../../data/series.json';
import catalogData from '../../../data/relations.json';
import { compileRelations } from '../../lib/relations/engine.mjs';

export const prerender = true;

const compiled = compileRelations({ graphData, seriesData, catalogData, strict: true });

export function GET() {
  return new Response(`${JSON.stringify(compiled)}\n`, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
    },
  });
}
