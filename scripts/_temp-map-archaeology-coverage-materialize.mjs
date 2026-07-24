#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CATALOG_FILE = path.join(ROOT, 'karty/_data/archaeology-source-registry.json');
const PROVENANCE_FILE = path.join(ROOT, 'karty/_data/archaeology-source-provenance.json');
const STALE_SHA = '7765a4cb216509d9462f6c7ac4fa0999909a424b';
const STALE_URL = `https://raw.githubusercontent.com/FedorMilovanov/gb-is-my-strength/${STALE_SHA}/karty/_data/archaeology-source-registry.json`;
const WRITE = process.argv.includes('--write');
const TODAY = '2026-07-24';

const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
const provenance = JSON.parse(fs.readFileSync(PROVENANCE_FILE, 'utf8'));
const response = await fetch(STALE_URL, { headers: { 'user-agent': 'gb-map-archaeology-materializer/2.0' } });
if (!response.ok) throw new Error(`failed to fetch fixed expansion registry: ${response.status} ${response.statusText}`);
const stale = await response.json();

const NEW_IDS = [
  'biu-gath-final-report','biu-gath-overview','biu-gath-project','biu-hurbat-husham-thamnata',
  'bm-babylonian-chronicle-21946','bm-cyrus-cylinder-object','bm-kenyon-jericho-publication','bm-lachish-relief',
  'bm-nebusarsekim-tablet','bm-papyrus-anastasi-v','bm-taylor-prism','brooklyn-elephantine-marriage',
  'custodia-capernaum','egypt-sinai-fortifications','elephantine-yaho-tax-list','elephantine-yaho-temple-letter',
  'hu-qeiyafa-project','hu-qeiyafa-vol1','hu-qeiyafa-vol2','iaa-dss-digital-library','iaa-dss-discovery-sites',
  'iaa-givati-2017-2018','iaa-givati-2019-2020','iaa-horbat-ha-gardi','iaa-migdal-2013','iaa-migdal-2015',
  'iaa-siloam-silwan-2014','imj-cradle-christianity','imj-great-isaiah-scroll','imj-heliodorus-stele',
  'imj-shrine-book','imj-temple-scroll','louvre-mesha-stele','oeai-ephesos-branch','oeai-forschungen-ephesos',
  'pcma-retaba-2011','pcma-retaba-pam23','sapienza-jericho-2019-2023','sapienza-jericho-project',
  'sapienza-jericho-urban-diversity'
].sort();

const subject = (label, startYear, endYear = startYear) => ({ label, startYear, endYear, convention: 'conventional-archaeological' });
const p = (publicationYear, locatorType, workType, authority, review, evidenceUse, identifiers = {}, subjectDate = null) => ({
  publicationYear, locatorType, workType, authority, review, perspective: 'general', evidenceUse, identifiers,
  ...(subjectDate ? { subjectDate } : {})
});

const PROVENANCE = {
  'biu-gath-final-report': p(2012,'publication-record','excavation-report','primary','institutional','high',{}),
  'biu-gath-overview': p(2017,'journal-article','archaeological-synthesis','secondary','peer-reviewed','high',{}),
  'biu-gath-project': p(null,'project-page','research-project','secondary','institutional','supporting',{}),
  'biu-hurbat-husham-thamnata': p(2025,'journal-article','journal-article','secondary','peer-reviewed','high',{}),
  'bm-babylonian-chronicle-21946': p(null,'collection-page','collection-record','primary','institutional','high',{museumObject:'W_1896-0409-51'},subject('late 7th–early 6th century BCE',-625,-580)),
  'bm-cyrus-cylinder-object': p(null,'collection-page','collection-record','primary','institutional','high',{museumObject:'W_1880-0617-1941'},subject('539 BCE',-539)),
  'bm-kenyon-jericho-publication': p(1981,'publication-record','excavation-report','primary','institutional','high',{catalog:'BIB11226'}),
  'bm-lachish-relief': p(null,'collection-page','collection-record','primary','institutional','high',{museumObject:'W_1856-0909-14_7'},subject('c. 700 BCE',-710,-690)),
  'bm-nebusarsekim-tablet': p(null,'collection-page','collection-record','primary','institutional','high',{museumObject:'W_1920-1213-81'},subject('c. 595 BCE',-600,-590)),
  'bm-papyrus-anastasi-v': p(null,'collection-page','collection-record','primary','institutional','high',{museumObject:'Y_EA10244-2'},subject('New Kingdom, conventional c. 1250 BCE',-1275,-1225)),
  'bm-taylor-prism': p(null,'collection-page','collection-record','primary','institutional','high',{museumObject:'W_1855-1003-1'},subject('c. 691 BCE',-700,-680)),
  'brooklyn-elephantine-marriage': p(null,'collection-page','collection-record','primary','institutional','high',{museumObject:'3488'},subject('449 BCE',-449)),
  'custodia-capernaum': p(null,'project-page','archaeological-synthesis','secondary','institutional','supporting',{}),
  'egypt-sinai-fortifications': p(2025,'news-item','archaeological-synthesis','secondary','institutional','supporting',{}),
  'elephantine-yaho-tax-list': p(null,'collection-page','collection-record','primary','institutional','high',{object:'306605'},subject('c. 420 BCE',-425,-415)),
  'elephantine-yaho-temple-letter': p(null,'collection-page','collection-record','primary','institutional','high',{object:'100282'},subject('407 BCE',-407)),
  'hu-qeiyafa-project': p(null,'project-page','research-project','secondary','institutional','supporting',{}),
  'hu-qeiyafa-vol1': p(2009,'publication-record','excavation-report','primary','institutional','high',{}),
  'hu-qeiyafa-vol2': p(2014,'publication-record','excavation-report','primary','institutional','high',{}),
  'iaa-dss-digital-library': p(null,'collection-page','collection-record','primary','institutional','high',{}),
  'iaa-dss-discovery-sites': p(null,'project-page','archaeological-synthesis','secondary','institutional','supporting',{}),
  'iaa-givati-2017-2018': p(2021,'field-report','excavation-report','primary','institutional','high',{iaaReport:'26089'}),
  'iaa-givati-2019-2020': p(2024,'field-report','excavation-report','primary','institutional','high',{iaaReport:'26474'}),
  'iaa-horbat-ha-gardi': p(2024,'field-report','excavation-report','primary','institutional','high',{iaaReport:'26469'}),
  'iaa-migdal-2013': p(2013,'field-report','excavation-report','primary','institutional','high',{iaaReport:'2304'}),
  'iaa-migdal-2015': p(2017,'field-report','excavation-report','primary','institutional','high',{iaaReport:'25336'}),
  'iaa-siloam-silwan-2014': p(2014,'field-report','excavation-report','primary','institutional','high',{iaaReport:'10572'}),
  'imj-cradle-christianity': p(2000,'collection-page','archaeological-synthesis','secondary','institutional','supporting',{}),
  'imj-great-isaiah-scroll': p(null,'collection-page','collection-record','primary','institutional','high',{},subject('conventional late 2nd century BCE',-150,-100)),
  'imj-heliodorus-stele': p(2007,'collection-page','collection-record','primary','institutional','high',{},subject('178 BCE',-178)),
  'imj-shrine-book': p(null,'collection-page','collection-record','secondary','institutional','supporting',{}),
  'imj-temple-scroll': p(null,'collection-page','collection-record','primary','institutional','high',{},subject('Second Temple period',-150,50)),
  'louvre-mesha-stele': p(null,'collection-page','collection-record','primary','institutional','high',{ark:'53355/cl010120339'},subject('9th century BCE',-875,-825)),
  'oeai-ephesos-branch': p(null,'project-page','research-project','secondary','institutional','supporting',{}),
  'oeai-forschungen-ephesos': p(null,'collection-page','bibliographic-index','secondary','institutional','supporting',{}),
  'pcma-retaba-2011': p(2011,'field-report','excavation-report','primary','institutional','high',{}),
  'pcma-retaba-pam23': p(2014,'journal-article','excavation-report','secondary','peer-reviewed','high',{}),
  'sapienza-jericho-2019-2023': p(2024,'publication-record','excavation-report','primary','peer-reviewed','high',{handle:'11573/1729743'}),
  'sapienza-jericho-project': p(null,'project-page','research-project','secondary','institutional','supporting',{}),
  'sapienza-jericho-urban-diversity': p(2022,'journal-article','archaeological-synthesis','secondary','peer-reviewed','high',{handle:'11573/1680717'})
};

const TOPICS = {
  babylon:'Babylon and Neo-Babylonian evidence cluster', jerusalem:'Jerusalem evidence cluster', persia:'Persian imperial context',
  jericho:'Tell es-Sultan / Jericho evidence cluster', lachish:'Lachish evidence cluster', egypt:'Egyptian textual context',
  elephantine:'Elephantine Jewish community and Yaho temple archive', capernaum:'Capernaum archaeology', sinai:'Sinai frontier archaeology',
  qeiyafa:'Khirbet Qeiyafa evidence cluster', gath:'Tell es-Safi/Gath evidence cluster', thamnata:'Proposed Thamnata identification cluster',
  qumran:'Qumran and Dead Sea Scrolls institutional corpus', 'nahal-hever':'Nahal Hever discovery context', modiin:'Modiin/Maccabean tomb candidate cluster',
  magdala:'Magdala/Migdal archaeology', siloam:'Pool of Siloam and Silwan archaeology', caesarea:'Caesarea early-Christian material context',
  'qumran-cave-1':'Qumran Cave 1 manuscript context', 'qumran-cave-11':'Qumran Cave 11 manuscript context', moab:'Moabite inscriptional context',
  ephesus:'Ephesus excavation and publication corpus', retaba:'Tell el-Retaba / Wadi Tumilat archaeology'
};

const CATEGORIES = [
  {id:'exodus_route',label:'Exodus route context',mapScopes:['ishod'],sourceIds:['bm-papyrus-anastasi-v','egypt-sinai-fortifications','pcma-retaba-2011','pcma-retaba-pam23'],claimIds:['exodus-route-context']},
  {id:'jericho_ai',label:'Jericho and conquest chronology',mapScopes:['ierrihon'],sourceIds:['bm-kenyon-jericho-publication','sapienza-jericho-2019-2023','sapienza-jericho-project','sapienza-jericho-urban-diversity'],claimIds:['jericho-archaeology-disputed']},
  {id:'judges_period',label:'Judges-period Philistine context',mapScopes:['shoftim'],sourceIds:['biu-gath-final-report','biu-gath-overview','biu-gath-project'],claimIds:['gath-philistine-context']},
  {id:'davidic_kingdom',label:'Davidic kingdom context',mapScopes:['david'],sourceIds:['hu-qeiyafa-project','hu-qeiyafa-vol1','hu-qeiyafa-vol2','louvre-mesha-stele'],claimIds:['qeiyafa-davidic-context']},
  {id:'kings_period',label:'Kingdoms and Assyrian campaigns',mapScopes:['tsari'],sourceIds:['bm-lachish-relief','bm-taylor-prism','louvre-mesha-stele','iaa-givati-2017-2018'],claimIds:['assyrian-kingdoms-context']},
  {id:'jerusalem_first_temple',label:'Jerusalem First Temple context',mapScopes:['ierusalim'],sourceIds:['iaa-givati-2017-2018','iaa-givati-2019-2020','bm-taylor-prism','bm-lachish-relief'],claimIds:['jerusalem-first-temple-context']},
  {id:'babylonian_exile',label:'Babylonian exile context',mapScopes:['plenenie'],sourceIds:['bm-babylonian-chronicle-21946','bm-nebusarsekim-tablet','iaa-givati-2017-2018','iaa-givati-2019-2020'],claimIds:['babylonian-exile-context']},
  {id:'persian_return',label:'Persian return and Elephantine',mapScopes:['vozvrashchenie'],sourceIds:['bm-cyrus-cylinder-object','brooklyn-elephantine-marriage','elephantine-yaho-tax-list','elephantine-yaho-temple-letter'],claimIds:['persian-return-context']},
  {id:'maccabees',label:'Maccabean period',mapScopes:['maccabim'],sourceIds:['biu-hurbat-husham-thamnata','iaa-horbat-ha-gardi','imj-heliodorus-stele','iaa-givati-2019-2020'],claimIds:['maccabean-context']},
  {id:'jesus_ministry',label:'Jesus ministry material context',mapScopes:['iisus'],sourceIds:['custodia-capernaum','iaa-migdal-2013','iaa-migdal-2015','iaa-siloam-silwan-2014','imj-cradle-christianity'],claimIds:['jesus-ministry-context']},
  {id:'early_church',label:'Early church material context',mapScopes:['early-church','pavel'],sourceIds:['imj-cradle-christianity','custodia-capernaum','oeai-ephesos-branch','oeai-forschungen-ephesos'],claimIds:['early-church-context']},
  {id:'dead_sea_scrolls',label:'Dead Sea Scrolls corpus',mapScopes:['qumran'],sourceIds:['iaa-dss-digital-library','iaa-dss-discovery-sites','imj-great-isaiah-scroll','imj-shrine-book','imj-temple-scroll'],claimIds:['dead-sea-scrolls-context']}
];

const CLAIMS = [
  {id:'exodus-route-context',category:'exodus_route',map:'ishod',places:[],topics:['egypt','sinai','retaba'],status:'accepted-context',statement:'Egyptian textual, Sinai frontier and Wadi Tumilat excavation records provide historical-geographical context for evaluating proposed Exodus routes.',evidenceSources:['bm-papyrus-anastasi-v','egypt-sinai-fortifications','pcma-retaba-2011','pcma-retaba-pam23'],interpretationSources:[],limitations:'These records do not independently prove the biblical Exodus event or identify every itinerary station.'},
  {id:'jericho-archaeology-disputed',category:'jericho_ai',map:'ierrihon',places:[],topics:['jericho'],status:'disputed',statement:'Tell es-Sultan is securely Jericho, while the relationship between its destruction layers, absolute chronology and the biblical conquest remains disputed.',evidenceSources:['bm-kenyon-jericho-publication','sapienza-jericho-2019-2023','sapienza-jericho-project','sapienza-jericho-urban-diversity'],interpretationSources:[],limitations:'The registry preserves excavation data and conventional chronology without treating one scholarly reconstruction as settled biblical synchronism.'},
  {id:'gath-philistine-context',category:'judges_period',map:'shoftim',places:[],topics:['gath'],status:'accepted-context',statement:'Tell es-Safi/Gath provides a major excavated Philistine urban context relevant to Judges-period geography.',evidenceSources:['biu-gath-final-report','biu-gath-overview','biu-gath-project'],interpretationSources:[],limitations:'The excavated city context does not authenticate every narrative episode associated with Gath.'},
  {id:'qeiyafa-davidic-context',category:'davidic_kingdom',map:'david',places:[],topics:['qeiyafa','moab'],status:'accepted-context',statement:'Khirbet Qeiyafa documents a fortified early Iron Age polity in the Shephelah relevant to debates about the scale and administration of the early Judahite kingdom.',evidenceSources:['hu-qeiyafa-vol1','hu-qeiyafa-vol2','hu-qeiyafa-project'],interpretationSources:[],limitations:'Its political attribution and direct relationship to David remain debated; the Mesha Stele belongs to a later kingdom context.'},
  {id:'assyrian-kingdoms-context',category:'kings_period',map:'tsari',places:[],topics:['lachish','jerusalem','moab'],status:'accepted-context',statement:'Assyrian royal records, the Lachish reliefs and the Mesha Stele provide independent inscriptional and visual context for the kingdoms period.',evidenceSources:['bm-lachish-relief','bm-taylor-prism','louvre-mesha-stele'],interpretationSources:[],limitations:'Royal inscriptions are partisan ancient sources and disputed readings must remain identified as disputed.'},
  {id:'jerusalem-first-temple-context',category:'jerusalem_first_temple',map:'ierusalim',places:[],topics:['jerusalem','lachish'],status:'accepted-context',statement:'Giv‘ati excavations and Assyrian records document Jerusalem and Judah across the First Temple and imperial-conflict contexts.',evidenceSources:['iaa-givati-2017-2018','iaa-givati-2019-2020','bm-taylor-prism','bm-lachish-relief'],interpretationSources:[],limitations:'Individual architectural phases require report-level dating and cannot be assigned to a named biblical figure without direct evidence.'},
  {id:'babylonian-exile-context',category:'babylonian_exile',map:'plenenie',places:[],topics:['babylon','jerusalem'],status:'accepted-context',statement:'The Babylonian Chronicle, administrative tablets and Jerusalem excavation reports provide primary context for the Neo-Babylonian conquest and exile period.',evidenceSources:['bm-babylonian-chronicle-21946','bm-nebusarsekim-tablet','iaa-givati-2017-2018','iaa-givati-2019-2020'],interpretationSources:[],limitations:'Object identifications and translations follow museum records; they do not by themselves reconstruct every event in Kings, Chronicles or Jeremiah.'},
  {id:'persian-return-context',category:'persian_return',map:'vozvrashchenie',places:[],topics:['babylon','persia','elephantine'],status:'accepted-context',statement:'The Cyrus Cylinder and Elephantine Aramaic records illuminate Persian imperial policy and Jewish communal life in the broader return-period world.',evidenceSources:['bm-cyrus-cylinder-object','brooklyn-elephantine-marriage','elephantine-yaho-tax-list','elephantine-yaho-temple-letter'],interpretationSources:[],limitations:'The Cyrus Cylinder does not mention Judah directly, and Elephantine evidence reflects a distinct diaspora community.'},
  {id:'maccabean-context',category:'maccabees',map:'maccabim',places:[],topics:['thamnata','modiin','jerusalem'],status:'candidate',statement:'Jerusalem records, the Heliodorus Stele and current excavations provide Maccabean-period context while proposed identifications of Thamnata and the Maccabean tombs remain candidates.',evidenceSources:['biu-hurbat-husham-thamnata','iaa-horbat-ha-gardi','imj-heliodorus-stele','iaa-givati-2019-2020'],interpretationSources:[],limitations:'Neither Thamnata nor Horbat Ha-Gardi should be presented as conclusively identified beyond the reporting sources.'},
  {id:'jesus-ministry-context',category:'jesus_ministry',map:'iisus',places:[],topics:['capernaum','magdala','siloam','caesarea','jerusalem'],status:'accepted-context',statement:'Excavated and institutional records from Capernaum, Magdala, Siloam and Jerusalem provide material context for the geography of Jesus’ ministry.',evidenceSources:['iaa-migdal-2013','iaa-migdal-2015','iaa-siloam-silwan-2014'],interpretationSources:[],limitations:'Material context is not an archaeological authentication of each Gospel miracle or speech.'},
  {id:'early-church-context',category:'early_church',map:'early-church',places:[],topics:['capernaum','caesarea','jerusalem','ephesus'],status:'accepted-context',statement:'Museum collections and long-running excavation programs provide material context for the Jewish and Greco-Roman settings of the earliest church.',evidenceSources:['imj-cradle-christianity','custodia-capernaum','oeai-ephesos-branch','oeai-forschungen-ephesos'],interpretationSources:[],limitations:'Institutional syntheses support context; claims about specific apostolic events require textual and site-specific analysis.'},
  {id:'dead-sea-scrolls-context',category:'dead_sea_scrolls',map:'qumran',places:[],topics:['qumran','nahal-hever','qumran-cave-1','qumran-cave-11'],status:'accepted-context',statement:'The IAA and Israel Museum digital collections provide authoritative access to manuscript objects, discovery contexts and institutional metadata for the Dead Sea Scrolls.',evidenceSources:['iaa-dss-digital-library','iaa-dss-discovery-sites','imj-great-isaiah-scroll','imj-shrine-book','imj-temple-scroll'],interpretationSources:[],limitations:'Institutional presentation does not settle every question of authorship, community identity, palaeographic dating or textual reconstruction.'}
];

const staleById = new Map((stale.sources || []).map((source) => [source.id, source]));
const currentIds = new Set((catalog.sources || []).map((source) => source.id));
const actualNewIds = [...staleById.keys()].filter((id) => !currentIds.has(id)).sort();
if (JSON.stringify(actualNewIds) !== JSON.stringify(NEW_IDS)) {
  throw new Error(`fixed expansion ID set drift\nexpected=${NEW_IDS.join(',')}\nactual=${actualNewIds.join(',')}`);
}
if (JSON.stringify(Object.keys(PROVENANCE).sort()) !== JSON.stringify(NEW_IDS)) {
  throw new Error('explicit provenance mapping is not exactly 1:1 with the 40 new IDs');
}

const topicIds = new Set(Object.keys(TOPICS));
const normalizedSources = NEW_IDS.map((id) => {
  const source = structuredClone(staleById.get(id));
  const record = PROVENANCE[id];
  const topics = [...new Set(source.places || [])].sort();
  for (const topic of topics) if (!topicIds.has(topic)) throw new Error(`${id}: undeclared topic ${topic}`);
  source.year = record.publicationYear;
  source.accessedAt = TODAY;
  source.verifiedAt = TODAY;
  source.places = [];
  source.topics = topics;
  if (record.workType === 'collection-record') source.tier = 'official-collection';
  else if (record.workType === 'excavation-report' && record.review !== 'peer-reviewed') source.tier = 'primary-excavation';
  else if (record.review === 'peer-reviewed') source.tier = 'peer-reviewed';
  else source.tier = 'institutional-synthesis';
  return source;
});

catalog.sources = [...catalog.sources, ...normalizedSources].sort((a,b) => a.id.localeCompare(b.id));
catalog.claims = [...catalog.claims.filter((claim) => !CLAIMS.some((item) => item.id === claim.id)), ...CLAIMS].sort((a,b) => a.id.localeCompare(b.id));
catalog.coverageSchemaVersion = '1.0.0';
catalog.coveragePolicy = {
  runtimeCategoryMeaning:'A governed evidence bundle used to replace hardcoded runtime references; it does not assert that a dedicated route or every biblical event is archaeologically proven.',
  mapScopeMeaning:'A UI/data scope identifier. Only route-profile contracts may promote a scope to a concrete route.',
  topicMeaning:'An archaeological location or evidence cluster not yet bound by this registry to a route marker.',
  minimumCategoryEvidence:'Each category requires at least three active sources, at least two high-evidence provenance records and an explicit limited claim.'
};
catalog.mapScopes = [...new Set(CATEGORIES.flatMap((category) => category.mapScopes))].sort().map((id) => ({id,kind:'runtime-scope'}));
catalog.topicVocabulary = Object.fromEntries(Object.entries(TOPICS).sort(([a],[b]) => a.localeCompare(b)).map(([id,concept]) => [id,{kind:'topic',concept}]));
catalog.runtimeCategories = CATEGORIES;
catalog.updatedAt = TODAY;

provenance.coverageSchemaVersion = '1.0.0';
provenance.coveragePolicy = {
  publicationYear:'Date of publication or institutional release; never an ancient artefact date.',
  subjectDate:'Conventional archaeological/object dating stored independently of publication year.',
  topic:'A non-route-bound evidence cluster; route bindings require a separate route contract.',
  worldview:'YEC is the project interpretation framework; evidence identity and conventional dating remain unaltered.'
};
for (const source of normalizedSources) {
  provenance.records[source.id] = {
    canonicalUrl: source.url,
    accessedAt: TODAY,
    ...PROVENANCE[source.id]
  };
}
provenance.updatedAt = TODAY;

const allCatalogIds = (catalog.sources || []).map((source) => source.id).sort();
const allProvenanceIds = Object.keys(provenance.records || {}).sort();
if (JSON.stringify(allCatalogIds) !== JSON.stringify(allProvenanceIds)) {
  throw new Error('post-materialization catalog/provenance ID coverage drift');
}
if (catalog.sources.length !== 94) throw new Error(`expected 94 sources after import, got ${catalog.sources.length}`);
if (catalog.runtimeCategories.length !== 12) throw new Error('expected 12 runtime categories');
if (catalog.sources.some((source) => Number.isFinite(source.year) && source.year < 1800)) throw new Error('ancient date remains in catalog publication year');
const tall = catalog.sources.find((source) => source.id === 'scientific-reports-tall-retraction');
if (tall?.url !== 'https://www.nature.com/articles/s41598-025-99265-5') throw new Error('canonical Tall el-Hammam retraction URL regressed');
const tallProv = provenance.records['scientific-reports-tall-retraction'];
if (tallProv?.identifiers?.doi !== '10.1038/s41598-025-99265-5') throw new Error('canonical Tall DOI regressed');
if (provenance.records['pubmed-tall-retraction']?.identifiers?.pmid !== '40275027') throw new Error('canonical Tall PMID regressed');

const catalogText = `${JSON.stringify(catalog, null, 2)}\n`;
const provenanceText = `${JSON.stringify(provenance, null, 2)}\n`;
if (WRITE) {
  fs.writeFileSync(CATALOG_FILE, catalogText);
  fs.writeFileSync(PROVENANCE_FILE, provenanceText);
  console.log('UPDATED archaeology catalog and provenance with 40 explicitly classified sources');
} else {
  console.log(JSON.stringify({sources:catalog.sources.length,provenance:Object.keys(provenance.records).length,claims:catalog.claims.length,categories:catalog.runtimeCategories.length,topics:Object.keys(catalog.topicVocabulary).length},null,2));
}
