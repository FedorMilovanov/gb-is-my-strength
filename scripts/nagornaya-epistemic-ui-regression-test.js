#!/usr/bin/env node
'use strict';
const assert=require('assert/strict');const fs=require('fs');const path=require('path');const ROOT=path.resolve(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(ROOT,p),'utf8');
const registry=JSON.parse(read('data/nagornaya/source-registry.json'));
const supported=registry.claims.filter(c=>c.confidence!=='unsupported');
for(const claim of supported){assert.ok(claim.presentation,`${claim.id}: canonical presentation missing`);for(const field of ['title','claim','alternative','seriesPosition','changeCondition'])assert.ok(claim.presentation[field]?.trim(),`${claim.id}: presentation.${field} missing`);for(const field of ['explains','doesNotProve','assumptionCost'])assert.ok(Array.isArray(claim.presentation[field])&&claim.presentation[field].length,`${claim.id}: presentation.${field} missing`)}
const claimComponent=read('src/components/nagornaya/_shared/NagornayaClaimComparison.astro');
assert.match(claimComponent,/import registry from ['"]\.\.\/\.\.\/\.\.\/\.\.\/data\/nagornaya\/source-registry\.json['"]/);
assert.match(claimComponent,/blockId: string/);assert.match(claimComponent,/data-nagornaya-epistemic-ui="claim-registry"/);assert.doesNotMatch(claimComponent,/bg-(?:red|emerald|green)-/);assert.doesNotMatch(claimComponent,/[✓✗]/);
const modelComponent=read('src/components/nagornaya/_shared/NagornayaModelComparison.astro');assert.match(modelComponent,/Что объясняет/);assert.match(modelComponent,/Ограничения/);assert.match(modelComponent,/Цена предпосылок/);assert.match(modelComponent,/Позиция серии/);assert.doesNotMatch(modelComponent,/bg-(?:red|emerald|green)-/);
const observation=read('src/components/nagornaya/_shared/NagornayaObservationComparison.astro');for(const label of ['Наблюдение','Возможное объяснение','Конкурирующее объяснение','Уверенность'])assert.ok(observation.includes(label),`observation matrix missing ${label}`);
const files={
 p1main:read('src/components/nagornaya/chast-1/NagornayaChast1MainShell.astro'),p1section:read('src/components/nagornaya/chast-1/NagornayaChast1SectionII.astro'),
 p2main:read('src/components/nagornaya/chast-2/NagornayaChast2MainShell.astro'),p2vi:read('src/components/nagornaya/chast-2/NagornayaChast2SectionVI.astro'),p2viii:read('src/components/nagornaya/chast-2/NagornayaChast2SectionVIII.astro'),p2ix:read('src/components/nagornaya/chast-2/NagornayaChast2SectionIX.astro'),
 p4main:read('src/components/nagornaya/chast-4/NagornayaChast4MainShell.astro'),p4v:read('src/components/nagornaya/chast-4/NagornayaChast4SectionV.astro'),p4x:read('src/components/nagornaya/chast-4/NagornayaChast4SectionX.astro'),p4page:read('src/pages/nagornaya/chast-4/index.astro')};
for(const key of ['p1main','p1section']){assert.ok(files[key].includes('nagornaya-matthew-luke-observation-matrix'),`${key}: C80 matrix missing`);assert.ok(files[key].includes('Сначала текстовые данные'),`${key}: calibrated subtitle missing`)}
for(const key of ['p2main','p2vi']){assert.ok(files[key].includes('nagornaya-ipsissima-vox-models'),`${key}: D18 registry block missing`);assert.doesNotMatch(files[key],/Узкая ipsissima vox \(TMS\)/);assert.doesNotMatch(files[key],/Приемлемо\./)}
for(const key of ['p2main','p2viii']){assert.ok(files[key].includes('nagornaya-sermon-identity-models'),`${key}: sermon model matrix missing`);assert.doesNotMatch(files[key],/Наиболее убедительна<\/span>/);assert.doesNotMatch(files[key],/Настороженно \(TMS\)/)}
for(const key of ['p2main','p2ix']){assert.ok(files[key].includes('Авторские статьи в TMSJ'),`${key}: author attribution label missing`);assert.doesNotMatch(files[key],/Строгая позиция TMS/)}
for(const key of ['p4main','p4v'])assert.ok(files[key].includes('nagornaya-part4-green-model'),`${key}: Green in-context registry block missing`);
for(const key of ['p4main','p4x']){assert.ok(files[key].includes('nagornaya-part4-thomas-model'),`${key}: Thomas in-context registry block missing`);assert.ok(files[key].includes('не утверждает, что их выводы или процедуры логически тождественны'),`${key}: false-continuum guard missing`)}
assert.doesNotMatch(files.p4page,/<aside class="lg:pl-64" aria-label="Сравнение моделей/,'page-end duplicate pilot must be removed');
const duplicateIds=[...files.p4main.matchAll(/blockId="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(duplicateIds).size,duplicateIds.length,'part4 block ids must be unique');
console.log('✅ Nagornaya epistemic UI: C80 observation boundary, neutral model matrices, registry SSOT, author attribution and false-continuum guards passed');
