// Bounded projection of accepted Research #632, merge f49d20d31931ec389690b3033cefbb66cda67522.
// Parent MAX 0 owns import, source registry and public-route activation; no route import here.
import base from './matrix-data.json';
import adopted from './adopted-visual-data.json';
export type MatrixData = { years: number[]; rows: { id: string; name: string; years: number[] }[] };
export type FinanceRow = { fy: number; revenue: number; expenses: number; result: number; netAssets: number };
export const RESEARCH_VISUAL_MERGE = 'f49d20d31931ec389690b3033cefbb66cda67522' as const;
export type AdoptedFinance = {
  claimId: 'G3-PUB-017'; researchMerge: typeof RESEARCH_VISUAL_MERGE;
  currency: 'USD'; fiscalYearEnd: 'December'; rows: readonly FinanceRow[];
};
export function adoptedMatrixData(): MatrixData {
  const rows = new Map(base.rows.map(r => [r.id, {...r, years: [...r.years]}]));
  for (const e of adopted.matrix.entries) {
    const row = rows.get(e.id);
    if (row) {
      if (row.name !== e.name || row.years.includes(e.year)) throw new Error('G3 adopted matrix identity conflict');
      row.years.push(e.year); row.years.sort((a,b)=>a-b);
    } else rows.set(e.id,{id:e.id,name:e.name,years:[e.year]});
  }
  const result={years:[...base.years,2018,2021].sort((a,b)=>a-b),rows:[...rows.values()]};
  if(result.rows.length!==26||result.rows.reduce((n,r)=>n+r.years.length,0)!==60) throw new Error('G3 adopted matrix cardinality drift');
  return result;
}
export const adoptedMatrixClaim = 'G3-HIST-PUB-12' as const;
export function adoptedAnnualFinance(): AdoptedFinance {
  return {claimId:'G3-PUB-017',researchMerge:RESEARCH_VISUAL_MERGE,currency:'USD',fiscalYearEnd:'December',rows:adopted.finance.rows.map(r=>({...r}))};
}
export function assertAdoptedMatrix(data: MatrixData): void {
  const canonical = (d: MatrixData) => JSON.stringify({years:d.years,rows:[...d.rows].sort((a,b)=>a.id.localeCompare(b.id)).map(r=>({id:r.id,name:r.name,years:[...r.years].sort((a,b)=>a-b)}))});
  if(canonical(data)!==canonical(adoptedMatrixData())) throw new Error('G3-HIST-PUB-12 matrix differs from adopted projection');
}
export function assertAdoptedAnnualFinance(projection: AdoptedFinance): void {
  const expected=adoptedAnnualFinance();
  if(projection?.claimId!==expected.claimId||projection.researchMerge!==expected.researchMerge||projection.currency!=='USD'||projection.fiscalYearEnd!=='December'||projection.rows.length!==7||projection.rows.some((r,i)=>['fy','revenue','expenses','result','netAssets'].some(k=>r[k as keyof FinanceRow]!==expected.rows[i][k as keyof FinanceRow]))) throw new Error('G3-PUB-017 annual data differs from adopted projection');
}
