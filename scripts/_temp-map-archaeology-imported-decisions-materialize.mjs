#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_FILE = path.join(ROOT, 'karty/_data/archaeology-source-registry.json');
const PROVENANCE_FILE = path.join(ROOT, 'karty/_data/archaeology-source-provenance.json');
const WRITE = process.argv.includes('--write');
const TODAY = '2026-07-24';
const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
const provenance = JSON.parse(fs.readFileSync(PROVENANCE_FILE, 'utf8'));
const records = provenance.records || {};

const DECISIONS = {
  'aig-have-we-found-sodom': {
    verification:'verified', year:2017,
    title:'Have We Found Sodom?',
    url:'https://answersingenesis.org/archaeology/have-we-found-sodom/',
    note:'YEC evaluation of proposed Sodom sites; published 2017-09-01. Interpretation only; independent excavation sources remain required for factual claims.',
    identifiers:{author:'Mike Matthews',publishedDate:'2017-09-01'}
  },
  'creation-chronogenealogies': {
    verification:'verified', year:2003,
    url:'https://creation.com/en/articles/biblical-chronogenealogies',
    note:'YEC chronological interpretation; underlying article first appeared in Journal of Creation 17(3), pages 14–18, December 2003; current web edition published 2023-10-07.',
    identifiers:{author:'Jonathan Sarfati',journal:'Journal of Creation',volume:'17(3)',pages:'14-18',originalYear:2003,webPublishedDate:'2023-10-07'}
  },
  'creation-times-abraham': {
    verification:'verified', year:1986,
    url:'https://creation.com/en/articles/the-times-of-abraham',
    note:'YEC chronological interpretation; underlying article first appeared in Journal of Creation 2(1), pages 77–87, April 1986; current web edition published 2006-03-30.',
    identifiers:{author:'A.J.M. Osgood',journal:'Journal of Creation',volume:'2(1)',pages:'77-87',originalYear:1986,webPublishedDate:'2006-03-30'}
  },
  'icr-biblical-age': {
    verification:'verified', year:null,
    title:'Biblical Age of the Earth',
    url:'https://www.icr.org/biblical-age',
    note:'Institutional YEC chronology overview. The current resource exposes no reliable article byline or publication date; interpretation only.',
    identifiers:{resourceSlug:'biblical-age'}
  },
  'loc-mamre': {
    verification:'verified', year:null,
    title:'Southern Palestine, Hebron, Beersheba and Gaza area. Ramet el-Khalil, Mamre excavations. Gen. 25:9',
    organization:'Library of Congress, Matson Photo Service',
    url:'https://www.loc.gov/pictures/item/2019705536/',
    note:'Library of Congress visual record; created/published between 1950 and 1977. Visual context only, not archaeological identification evidence.',
    identifiers:{locItem:'2019705536',digitalId:'matpc.22876',reproduction:'LC-DIG-matpc-22876',creator:'Matson Photo Service',dateCreatedPublished:'between 1950 and 1977'}
  },
  'loc-shur-el-raha': {
    verification:'verified', year:null,
    title:'To Sinai via the desert. Wilderness of Shur',
    organization:'Library of Congress, American Colony (Jerusalem). Photo Department',
    url:'https://www.loc.gov/pictures/item/2019695634/',
    note:'Library of Congress visual record; created/published approximately 1900–1920. Visual context only, not route-identification evidence.',
    identifiers:{locItem:'2019695634',digitalId:'matpc.01946',reproduction:'LC-DIG-matpc-01946',creator:'American Colony (Jerusalem). Photo Department',dateCreatedPublished:'approximately 1900 to 1920'}
  },
  'ritmeyer-mamre': {
    verification:'needs-review', year:2010,
    url:'https://www.ritmeyer.com/2010/10/12/mamre-and-the-temple-mount-in-jerusalem/',
    note:'Needs review: the dated URL redirects without exposing the claimed article, and current independent search did not recover exact publication metadata. Keep as conservative interpretation only; do not use as excavation evidence.',
    identifiers:{urlDate:'2010-10-12',reviewReason:'exact article metadata unresolved on current site'}
  },
  'wibilex-beersheba': {
    verification:'verified', year:null,
    url:'https://www.die-bibel.de/ressourcen/wibilex/altes-testament/beerscheba',
    note:'Direct WiBiLex scholarly encyclopedia article under Deutsche Bibelgesellschaft editorial governance; interpretation/reference layer, not excavation report.',
    identifiers:{wibilexSlug:'beerscheba'}
  },
  'wibilex-bethel': {
    verification:'verified', year:null,
    url:'https://www.die-bibel.de/ressourcen/wibilex/altes-testament/bethel-ort',
    note:'Direct WiBiLex scholarly encyclopedia article under Deutsche Bibelgesellschaft editorial governance; Bethel identification remains an interpretation/candidate layer.',
    identifiers:{wibilexSlug:'bethel-ort'}
  },
  'wibilex-hebron': {
    verification:'verified', year:null,
    url:'https://www.die-bibel.de/ressourcen/wibilex/altes-testament/hebron',
    note:'Direct WiBiLex scholarly encyclopedia article under Deutsche Bibelgesellschaft editorial governance; interpretation/reference layer, not excavation report.',
    identifiers:{wibilexSlug:'hebron'}
  }
};

const importedIds = (catalog.sources || []).filter((source) => source.verification === 'imported').map((source) => source.id).sort();
const decisionIds = Object.keys(DECISIONS).sort();
if (JSON.stringify(importedIds) !== JSON.stringify(decisionIds)) {
  throw new Error(`imported decision set drift\nimported=${importedIds.join(',')}\ndecisions=${decisionIds.join(',')}`);
}

for (const source of catalog.sources) {
  const decision = DECISIONS[source.id];
  if (!decision) continue;
  const record = records[source.id];
  if (!record) throw new Error(`${source.id}: missing provenance`);
  source.verification = decision.verification;
  source.verifiedAt = TODAY;
  source.accessedAt = TODAY;
  source.year = decision.year;
  source.url = decision.url;
  source.note = decision.note;
  if (decision.title) source.title = decision.title;
  if (decision.organization) source.organization = decision.organization;

  record.canonicalUrl = decision.url;
  record.accessedAt = TODAY;
  record.publicationYear = decision.year;
  record.identifiers = {...(record.identifiers || {}), ...decision.identifiers};
}
provenance.updatedAt = TODAY;
catalog.updatedAt = TODAY;

const remainingImported = catalog.sources.filter((source) => source.verification === 'imported');
const queue = catalog.sources.filter((source) => decisionIds.includes(source.id));
if (remainingImported.length) throw new Error(`remaining imported records: ${remainingImported.map((s) => s.id).join(',')}`);
if (queue.filter((source) => source.verification === 'verified').length !== 9) throw new Error('expected 9 verified decisions');
if (queue.filter((source) => source.verification === 'needs-review').map((source) => source.id).join(',') !== 'ritmeyer-mamre') throw new Error('expected only ritmeyer-mamre to need review');
for (const source of queue) {
  const record = records[source.id];
  if (source.url !== record.canonicalUrl || source.accessedAt !== record.accessedAt || (source.year ?? null) !== (record.publicationYear ?? null)) {
    throw new Error(`${source.id}: catalog/provenance decision drift`);
  }
  if (record.evidenceUse === 'high') throw new Error(`${source.id}: verification review cannot promote evidence strength`);
  if (record.perspective === 'yec' && !['interpretation','none'].includes(record.evidenceUse)) throw new Error(`${source.id}: YEC role drift`);
}

if (WRITE) {
  fs.writeFileSync(CATALOG_FILE, `${JSON.stringify(catalog, null, 2)}\n`);
  fs.writeFileSync(PROVENANCE_FILE, `${JSON.stringify(provenance, null, 2)}\n`);
  console.log('UPDATED 9 verified records and 1 explicit needs-review record');
} else {
  console.log(JSON.stringify({verified:9,needsReview:['ritmeyer-mamre'],remainingImported:0},null,2));
}
