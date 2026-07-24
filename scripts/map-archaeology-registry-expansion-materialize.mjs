#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, 'karty/_data/archaeology-source-registry.json');
const write = process.argv.includes('--write');
const registry = JSON.parse(fs.readFileSync(TARGET, 'utf8'));

const EXPECTED_BASE = '184d7ed1b50161ec5fa1418ca24539e33977e2a8';
const NEW_BOUNDARY = '93b272c6a47dd6bbe5a6cdd2a0107a5829ba92cc';
const NOW = '2026-07-24';

if (registry.schemaVersion === '1.1.0' && registry.sourceBoundary === NEW_BOUNDARY && Array.isArray(registry.runtimeCategories) && registry.runtimeCategories.length === 12) {
  console.log('PASS archaeology registry expansion already materialized');
  process.exit(0);
}
if (registry.schemaVersion !== '1.0.0') throw new Error(`expected schema 1.0.0, got ${registry.schemaVersion}`);
if (registry.sourceBoundary !== EXPECTED_BASE) throw new Error(`expected source boundary ${EXPECTED_BASE}, got ${registry.sourceBoundary}`);
if (registry.runtimeCategories !== undefined) throw new Error('runtimeCategories unexpectedly already exists');

const sources = [
  {id:'pcma-retaba-2011',title:'Tell el-Retaba, season 2011',organization:'Polish Centre of Mediterranean Archaeology, University of Warsaw',year:2011,url:'https://pcma.uw.edu.pl/en/research/season-by-season/tell-el-retaba-egypt-2011/',tier:'primary-excavation',status:'active',verification:'verified',verifiedAt:NOW,maps:['ishod'],places:['retaba'],note:'Field report for Wadi Tumilat archaeology; it does not establish an Exodus event.'},
  {id:'pcma-retaba-pam23',title:'Tell el-Retaba excavation report in Polish Archaeology in the Mediterranean 23/1',organization:'Polish Centre of Mediterranean Archaeology, University of Warsaw',year:2014,url:'https://pcma.uw.edu.pl/2018/02/28/pam-23-1/',tier:'peer-reviewed',status:'active',verification:'verified',verifiedAt:NOW,maps:['ishod'],places:['retaba']},
  {id:'bm-papyrus-anastasi-v',title:'Papyrus Anastasi V',organization:'British Museum',year:1250,url:'https://www.britishmuseum.org/collection/object/Y_EA10244-2',tier:'official-collection',status:'active',verification:'verified',verifiedAt:NOW,maps:['ishod'],places:['egypt'],note:'New Kingdom scribal papyrus; historical context, not direct proof of the biblical Exodus.'},
  {id:'egypt-sinai-fortifications',title:'New archaeological discoveries in Sinai',organization:'Egyptian Ministry of Tourism and Antiquities',year:2025,url:'https://egymonuments.gov.eg/news/new-archaeological-discoveries-in-sinai/',tier:'institutional-synthesis',status:'active',verification:'verified',verifiedAt:NOW,maps:['ishod'],places:['sinai']},

  {id:'iaa-givati-2017-2018',title:'Jerusalem, Giv‘ati Parking Lot 2017–2018',organization:'Israel Antiquities Authority',year:2021,url:'https://hadashot.iaa.org.il/Report_Detail_Eng.aspx?id=26089',tier:'primary-excavation',status:'active',verification:'verified',verifiedAt:NOW,maps:['ierusalim','maccabim','plenenie'],places:['jerusalem']},
  {id:'iaa-givati-2019-2020',title:'Jerusalem, Giv‘ati Parking Lot 2019–2020',organization:'Israel Antiquities Authority',year:2024,url:'https://hadashot.iaa.org.il/report_detail_eng.aspx?id=26474&mag_id=137',tier:'primary-excavation',status:'active',verification:'verified',verifiedAt:NOW,maps:['ierusalim','maccabim','plenenie'],places:['jerusalem']},
  {id:'bm-taylor-prism',title:'Taylor Prism of Sennacherib',organization:'British Museum',year:-690,url:'https://www.britishmuseum.org/collection/object/W_1855-1003-1',tier:'official-collection',status:'active',verification:'verified',verifiedAt:NOW,maps:['tsari','ierusalim'],places:['jerusalem','lachish']},
  {id:'bm-lachish-relief',title:'Sennacherib watches the capture of Lachish',organization:'British Museum',year:-700,url:'https://www.britishmuseum.org/collection/object/W_1856-0909-14_7',tier:'official-collection',status:'active',verification:'verified',verifiedAt:NOW,maps:['tsari','ierusalim'],places:['lachish']},
  {id:'hu-qeiyafa-project',title:'Khirbet Qeiyafa excavation project',organization:'Hebrew University of Jerusalem',year:2026,url:'https://khirbet-qeiyafa.huji.ac.il/',tier:'institutional-synthesis',status:'active',verification:'verified',verifiedAt:NOW,maps:['david'],places:['qeiyafa']},
  {id:'hu-qeiyafa-vol1',title:'Khirbet Qeiyafa Vol. 1: Excavation Report 2007–2008',organization:'Hebrew University of Jerusalem',year:2009,url:'https://cris.huji.ac.il/en/publications/khirbet-qeiyafa-vol-1-excavation-report-2007-2008/',tier:'primary-excavation',status:'active',verification:'verified',verifiedAt:NOW,maps:['david'],places:['qeiyafa']},
  {id:'hu-qeiyafa-vol2',title:'Khirbet Qeiyafa Vol. 2: Stratigraphy and Architecture',organization:'Hebrew University of Jerusalem',year:2014,url:'https://cris.huji.ac.il/en/publications/khirbet-qeiyafa-vol-2-excavation-report-2009-2013-stratigraphy-an/',tier:'primary-excavation',status:'active',verification:'verified',verifiedAt:NOW,maps:['david'],places:['qeiyafa']},
  {id:'louvre-mesha-stele',title:'Mesha Stele',organization:'Musée du Louvre',year:-840,url:'https://collections.louvre.fr/en/ark%3A/53355/cl010120339',tier:'official-collection',status:'active',verification:'verified',verifiedAt:NOW,maps:['david','tsari'],places:['moab'],note:'Official object record preserves the inscription and bibliography; disputed line readings remain disputed.'},

  {id:'iaa-horbat-ha-gardi',title:'Horbat Ha-Gardi reexamination',organization:'Israel Antiquities Authority',year:2024,url:'https://hadashot.iaa.org.il/Report_Detail_Eng.aspx?id=26469',tier:'primary-excavation',status:'active',verification:'verified',verifiedAt:NOW,maps:['maccabim'],places:['modiin'],note:'The report evaluates, but does not prove, identification with the tombs of the Maccabees.'},
  {id:'biu-hurbat-husham-thamnata',title:'Between Text and Trowel: Hurbat Husham and the identification of Thamnata',organization:'Bar-Ilan University',year:2025,url:'https://cris.biu.ac.il/en/publications/between-text-and-trowel-archaeological-investigations-at-hurbat-h/',tier:'peer-reviewed',status:'active',verification:'verified',verifiedAt:NOW,maps:['maccabim'],places:['thamnata']},
  {id:'imj-heliodorus-stele',title:'Heliodorus Stele',organization:'Israel Museum',year:2007,url:'https://www.imj.org.il/en/exhibitions/heliodorus-stele',tier:'official-collection',status:'active',verification:'verified',verifiedAt:NOW,maps:['maccabim'],places:['jerusalem']},

  {id:'biu-gath-project',title:'Tell es-Safi/Gath Archaeological Project',organization:'Bar-Ilan University',year:2021,url:'https://lisa.biu.ac.il/en/node/1378',tier:'primary-excavation',status:'active',verification:'verified',verifiedAt:NOW,maps:['shoftim'],places:['gath']},
  {id:'biu-gath-overview',title:'The Tell es-Safi/Gath Archaeological Project: Overview',organization:'Bar-Ilan University',year:2017,url:'https://cris.biu.ac.il/en/publications/the-tell-e%E1%B9%A3-%E1%B9%A3%C3%A2figath-archaeological-project-overview-overview/',tier:'peer-reviewed',status:'active',verification:'verified',verifiedAt:NOW,maps:['shoftim'],places:['gath']},
  {id:'biu-gath-final-report',title:'Tell es-Safi/Gath I: The 1996–2005 Seasons',organization:'Bar-Ilan University',year:2012,url:'https://cris.biu.ac.il/en/publications/tell-es-safigath-i-the-1996-2005-seasons/',tier:'primary-excavation',status:'active',verification:'verified',verifiedAt:NOW,maps:['shoftim'],places:['gath']},

  {id:'oeai-ephesos-branch',title:'Ephesos excavation branch',organization:'Austrian Archaeological Institute',year:2026,url:'https://www.oeaw.ac.at/en/oeai/institute/branches/ephesos',tier:'institutional-synthesis',status:'active',verification:'verified',verifiedAt:NOW,maps:['pavel'],places:['ephesus']},
  {id:'oeai-forschungen-ephesos',title:'Forschungen in Ephesos publication series',organization:'Austrian Academy of Sciences',year:2026,url:'https://www.oeaw.ac.at/en/oeai/publishing/series/forschungen-in-ephesos',tier:'official-collection',status:'active',verification:'verified',verifiedAt:NOW,maps:['pavel'],places:['ephesus']},
  {id:'custodia-capernaum',title:'Capernaum: history and archaeology',organization:'Custodia Terrae Sanctae',year:2026,url:'https://www.custodia.org/en/sanctuaries/capernaum/',tier:'institutional-synthesis',status:'active',verification:'verified',verifiedAt:NOW,maps:['iisus','early-church'],places:['capernaum']},
  {id:'iaa-siloam-silwan-2014',title:'Jerusalem, Silwan — excavation south of the Pool of Siloam',organization:'Israel Antiquities Authority',year:2014,url:'https://hadashot.iaa.org.il/Report_Detail_Eng.aspx?id=10572&mag_id=121&print=nopic',tier:'primary-excavation',status:'active',verification:'verified',verifiedAt:NOW,maps:['iisus','ierusalim'],places:['siloam']},
  {id:'imj-cradle-christianity',title:'The Cradle of Christianity',organization:'Israel Museum',year:2000,url:'https://www.imj.org.il/en/exhibitions/cradle-christianity',tier:'official-collection',status:'active',verification:'verified',verifiedAt:NOW,maps:['iisus','early-church'],places:['caesarea','jerusalem'],note:'Museum synthesis includes the Pilate inscription and Caiaphas ossuary; it does not authenticate every Gospel event.'},
  {id:'iaa-migdal-2013',title:'Migdal excavation 2009–2013',organization:'Israel Antiquities Authority',year:2013,url:'https://hadashot.iaa.org.il/report_detail_eng.aspx?id=2304',tier:'primary-excavation',status:'active',verification:'verified',verifiedAt:NOW,maps:['iisus'],places:['magdala']},
  {id:'iaa-migdal-2015',title:'Migdal 2015 excavation',organization:'Israel Antiquities Authority',year:2017,url:'https://hadashot.iaa.org.il/Report_Detail_Eng.aspx?id=25336',tier:'primary-excavation',status:'active',verification:'verified',verifiedAt:NOW,maps:['iisus'],places:['magdala']},

  {id:'iaa-dss-digital-library',title:'Leon Levy Dead Sea Scrolls Digital Library',organization:'Israel Antiquities Authority',year:2026,url:'https://www.deadseascrolls.org.il/about-the-project/the-digital-library?locale=en_US',tier:'official-collection',status:'active',verification:'verified',verifiedAt:NOW,maps:['qumran'],places:['qumran']},
  {id:'iaa-dss-discovery-sites',title:'Dead Sea Scrolls discovery sites',organization:'Israel Antiquities Authority',year:2026,url:'https://www.deadseascrolls.org.il/learn-about-the-scrolls/discovery-sites',tier:'institutional-synthesis',status:'active',verification:'verified',verifiedAt:NOW,maps:['qumran'],places:['qumran','nahal-hever']},
  {id:'imj-shrine-book',title:'Shrine of the Book',organization:'Israel Museum',year:2026,url:'https://dss.collections.imj.org.il/shrine',tier:'official-collection',status:'active',verification:'verified',verifiedAt:NOW,maps:['qumran'],places:['qumran']},
  {id:'imj-great-isaiah-scroll',title:'Great Isaiah Scroll',organization:'Israel Museum',year:-100,url:'https://dss.collections.imj.org.il/isaiah',tier:'official-collection',status:'active',verification:'verified',verifiedAt:NOW,maps:['qumran'],places:['qumran-cave-1']},
  {id:'imj-temple-scroll',title:'Temple Scroll',organization:'Israel Museum',year:0,url:'https://dss.collections.imj.org.il/temple?id=0',tier:'official-collection',status:'active',verification:'verified',verifiedAt:NOW,maps:['qumran'],places:['qumran-cave-11']},

  {id:'bm-babylonian-chronicle-21946',title:'Babylonian Chronicle BM 21946',organization:'British Museum',year:-600,url:'https://www.britishmuseum.org/collection/object/W_1896-0409-51',tier:'official-collection',status:'active',verification:'verified',verifiedAt:NOW,maps:['plenenie'],places:['babylon','jerusalem']},
  {id:'bm-nebusarsekim-tablet',title:'Tablet naming Nebo-Sarsekim, a Babylonian official',organization:'British Museum',year:-595,url:'https://www.britishmuseum.org/collection/object/W_1920-1213-81',tier:'official-collection',status:'active',verification:'verified',verifiedAt:NOW,maps:['plenenie'],places:['babylon','jerusalem']},
  {id:'bm-cyrus-cylinder-object',title:'Cyrus Cylinder',organization:'British Museum',year:-539,url:'https://www.britishmuseum.org/collection/object/W_1880-0617-1941',tier:'official-collection',status:'active',verification:'verified',verifiedAt:NOW,maps:['vozvrashchenie'],places:['babylon','persia']},
  {id:'elephantine-yaho-temple-letter',title:'Letter concerning damage to the Temple of Yaho at Elephantine',organization:'Staatliche Museen zu Berlin — Elephantine project',year:-407,url:'https://elephantine.smb.museum/objects/object.php?o=100282',tier:'official-collection',status:'active',verification:'verified',verifiedAt:NOW,maps:['vozvrashchenie'],places:['elephantine']},
  {id:'elephantine-yaho-tax-list',title:'Tax list for the Yaho Temple at Elephantine',organization:'Staatliche Museen zu Berlin — Elephantine project',year:-420,url:'https://elephantine.smb.museum/objects/object.php?o=306605',tier:'official-collection',status:'active',verification:'verified',verifiedAt:NOW,maps:['vozvrashchenie'],places:['elephantine']},
  {id:'brooklyn-elephantine-marriage',title:'Aramaic Marriage Document from Elephantine',organization:'Brooklyn Museum',year:-449,url:'https://opencollection.brooklynmuseum.org/objects/3488',tier:'official-collection',status:'active',verification:'verified',verifiedAt:NOW,maps:['vozvrashchenie'],places:['elephantine']},

  {id:'sapienza-jericho-project',title:'Jericho — Tell es-Sultan excavation project',organization:'Sapienza University of Rome / Palestinian MOTA-DACH',year:2026,url:'https://www.antichita.uniroma1.it/eng/jericho-tell-es-sultan',tier:'primary-excavation',status:'active',verification:'verified',verifiedAt:NOW,maps:['ierrihon'],places:['jericho']},
  {id:'sapienza-jericho-2019-2023',title:'Interim report on Tell es-Sultan excavations 2019–2023',organization:'Sapienza University of Rome',year:2024,url:'https://iris.uniroma1.it/handle/11573/1729743',tier:'peer-reviewed',status:'active',verification:'verified',verifiedAt:NOW,maps:['ierrihon'],places:['jericho']},
  {id:'sapienza-jericho-urban-diversity',title:'Jericho from the Neolithic to the Bronze and Iron Ages',organization:'Sapienza University of Rome',year:2022,url:'https://iris.uniroma1.it/handle/11573/1680717',tier:'peer-reviewed',status:'active',verification:'verified',verifiedAt:NOW,maps:['ierrihon'],places:['jericho']},
  {id:'bm-kenyon-jericho-publication',title:'Excavations at Jericho — Kenyon publication record',organization:'British Museum',year:1981,url:'https://www.britishmuseum.org/collection/term/BIB11226',tier:'official-collection',status:'active',verification:'verified',verifiedAt:NOW,maps:['ierrihon'],places:['jericho']}
];

const claims = [
  {id:'exodus-eastern-delta-sinai-context',map:'ishod',status:'accepted-context',places:['retaba','egypt','sinai'],statement:'Wadi Tumilat and Sinai preserve New Kingdom settlement, administrative and frontier contexts relevant to an Exodus map.',evidenceSources:['pcma-retaba-2011','pcma-retaba-pam23','bm-papyrus-anastasi-v','egypt-sinai-fortifications'],interpretationSources:[],limitations:'These records do not identify Moses, Israelites, a specific Exodus encampment or a miraculous event.'},
  {id:'jerusalem-first-temple-assyrian-context',map:'ierusalim',status:'accepted-context',places:['jerusalem','lachish'],statement:'Excavations and Assyrian royal records document Iron Age Judah, Jerusalem and the 701 BCE campaign context.',evidenceSources:['iaa-givati-2017-2018','bm-taylor-prism','bm-lachish-relief'],interpretationSources:[],limitations:'The evidence contextualizes named kings and cities; it does not prove every biblical episode or proposed architectural identification.'},
  {id:'maccabean-judea-context',map:'maccabim',status:'accepted-context',places:['modiin','jerusalem','thamnata'],statement:'Archaeology and inscriptions document Hellenistic Judea and settings preceding and following the Maccabean revolt.',evidenceSources:['iaa-horbat-ha-gardi','biu-hurbat-husham-thamnata','imj-heliodorus-stele','iaa-givati-2017-2018'],interpretationSources:[],limitations:'Horbat Ha-Gardi remains an evaluated candidate rather than a proven tomb of the Maccabees.'},
  {id:'judges-philistine-shephelah-context',map:'shoftim',status:'accepted-context',places:['gath'],statement:'Long-term excavation and publication at Tell es-Safi/Gath document Philistine and Judean Shephelah contexts relevant to Judges-era geography.',evidenceSources:['biu-gath-project','biu-gath-overview','biu-gath-final-report'],interpretationSources:[],limitations:'No excavated stratum or object is assigned to Samson or another biblical individual without direct evidence.'},
  {id:'kings-assyrian-babylonian-context',map:'tsari',status:'accepted-context',places:['jerusalem','lachish'],statement:'Royal inscriptions, reliefs and Jerusalem stratigraphy document Neo-Assyrian and later imperial pressure on Judah.',evidenceSources:['bm-taylor-prism','bm-lachish-relief','iaa-givati-2019-2020'],interpretationSources:[],limitations:'Correlation with biblical chronology must preserve archaeological and textual uncertainties.'},
  {id:'early-church-urban-context',map:'early-church',status:'accepted-context',places:['ephesus','capernaum','jerusalem'],statement:'Excavation programs at Ephesus, Capernaum and Jerusalem provide urban and religious context for the early Christian world.',evidenceSources:['oeai-ephesos-branch','oeai-forschungen-ephesos','custodia-capernaum','iaa-siloam-silwan-2014'],interpretationSources:[],limitations:'Archaeological context is not direct proof of a specific sermon, miracle or apostolic residence.'},
  {id:'jesus-first-century-context',map:'iisus',status:'accepted-context',places:['capernaum','magdala','siloam','jerusalem'],statement:'Capernaum, Magdala, Siloam and Jerusalem preserve first-century settings relevant to the Gospel narrative.',evidenceSources:['custodia-capernaum','iaa-migdal-2013','iaa-migdal-2015','iaa-siloam-silwan-2014','imj-cradle-christianity'],interpretationSources:[],limitations:'The sites and objects contextualize the period; they do not archaeologically authenticate every narrated event.'},
  {id:'dead-sea-scrolls-manuscript-context',map:'qumran',status:'accepted-context',places:['qumran','nahal-hever'],statement:'The IAA and Israel Museum collections document the manuscript corpus, discovery sites and principal scroll objects.',evidenceSources:['iaa-dss-digital-library','iaa-dss-discovery-sites','imj-shrine-book','imj-great-isaiah-scroll','imj-temple-scroll'],interpretationSources:[],limitations:'Scroll provenance and dating must follow object records; theological conclusions remain an interpretive layer.'},
  {id:'babylonian-exile-documentary-context',map:'plenenie',status:'accepted-context',places:['babylon','jerusalem'],statement:'Babylonian chronicles, administrative tablets and Jerusalem excavations document the imperial and destruction context of the Babylonian exile.',evidenceSources:['bm-babylonian-chronicle-21946','bm-nebusarsekim-tablet','iaa-givati-2019-2020'],interpretationSources:[],limitations:'Individual tablet identifications must follow exact inscriptional readings and cannot be generalized to unmentioned persons.'},
  {id:'persian-return-imperial-context',map:'vozvrashchenie',status:'accepted-context',places:['babylon','persia','elephantine'],statement:'The Cyrus Cylinder and Elephantine archives document Persian imperial policy and Jewish communal life in the Persian period.',evidenceSources:['bm-cyrus-cylinder-object','elephantine-yaho-temple-letter','elephantine-yaho-tax-list','brooklyn-elephantine-marriage'],interpretationSources:[],limitations:'The Cyrus Cylinder does not name the Judeans or quote Ezra; it supplies broader imperial-policy context.'},
  {id:'jericho-conquest-chronology-disputed',map:'ierrihon',status:'candidate',places:['jericho'],statement:'Tell es-Sultan is securely ancient Jericho, while the relationship between its destruction sequence and the biblical conquest remains disputed.',evidenceSources:['sapienza-jericho-project','sapienza-jericho-2019-2023','sapienza-jericho-urban-diversity','bm-kenyon-jericho-publication'],interpretationSources:[],limitations:'This is a disputed chronology candidate; excavation reports do not by themselves identify Joshua’s destruction event and require future YEC interpretation review.'},
  {id:'early-judah-davidic-context',map:'david',status:'accepted-context',places:['qeiyafa','moab'],statement:'Khirbet Qeiyafa and regional inscriptions document early Iron Age Judah and neighboring monarchic contexts used by the Davidic map.',evidenceSources:['hu-qeiyafa-project','hu-qeiyafa-vol1','hu-qeiyafa-vol2','louvre-mesha-stele'],interpretationSources:[],limitations:'The evidence informs state-formation and regional-history debates; it does not directly identify David’s palace or prove every event attributed to his reign.'}
];

const categories = [
  {id:'exodus_route',title:'Exodus and eastern Delta/Sinai',status:'registry-ready',sourceIds:['pcma-retaba-2011','pcma-retaba-pam23','bm-papyrus-anastasi-v','egypt-sinai-fortifications'],claimIds:['exodus-eastern-delta-sinai-context'],limitations:'Contextual archaeology only; no direct Exodus artefact claim.'},
  {id:'jerusalem_first_temple',title:'Jerusalem and the First Temple period',status:'registry-ready',sourceIds:['iaa-givati-2017-2018','iaa-givati-2019-2020','bm-taylor-prism','bm-lachish-relief'],claimIds:['jerusalem-first-temple-assyrian-context'],limitations:'Architectural and event identifications retain their published uncertainty.'},
  {id:'maccabees',title:'Maccabean and Hasmonean Judea',status:'registry-ready',sourceIds:['iaa-horbat-ha-gardi','biu-hurbat-husham-thamnata','imj-heliodorus-stele','iaa-givati-2017-2018'],claimIds:['maccabean-judea-context'],limitations:'Candidate tomb and fortress identifications are not promoted to certainty.'},
  {id:'early_church',title:'Early Church urban context',status:'registry-ready',sourceIds:['oeai-ephesos-branch','oeai-forschungen-ephesos','custodia-capernaum','iaa-siloam-silwan-2014','imj-cradle-christianity'],claimIds:['early-church-urban-context'],limitations:'Context is separated from claims about specific apostolic events.'},
  {id:'judges_period',title:'Judges and Philistine Shephelah',status:'registry-ready',sourceIds:['biu-gath-project','biu-gath-overview','biu-gath-final-report','iaa-esi-series'],claimIds:['judges-philistine-shephelah-context'],limitations:'No direct Samson attribution.'},
  {id:'kings_period',title:'Kings of Judah and imperial campaigns',status:'registry-ready',sourceIds:['bm-taylor-prism','bm-lachish-relief','iaa-givati-2019-2020','louvre-mesha-stele'],claimIds:['kings-assyrian-babylonian-context'],limitations:'Text/stratum correlations remain explicit interpretations.'},
  {id:'jesus_ministry',title:'First-century Judea and Galilee',status:'registry-ready',sourceIds:['custodia-capernaum','iaa-migdal-2013','iaa-migdal-2015','iaa-siloam-silwan-2014','imj-cradle-christianity'],claimIds:['jesus-first-century-context'],limitations:'Period context is not event authentication.'},
  {id:'dead_sea_scrolls',title:'Dead Sea Scrolls corpus',status:'registry-ready',sourceIds:['iaa-dss-digital-library','iaa-dss-discovery-sites','imj-shrine-book','imj-great-isaiah-scroll','imj-temple-scroll'],claimIds:['dead-sea-scrolls-manuscript-context'],limitations:'Object-level provenance and dating control runtime wording.'},
  {id:'babylonian_exile',title:'Babylonian exile',status:'registry-ready',sourceIds:['bm-babylonian-chronicle-21946','bm-nebusarsekim-tablet','iaa-givati-2019-2020','bm-taylor-prism'],claimIds:['babylonian-exile-documentary-context'],limitations:'Only exact inscriptional identifications are permitted.'},
  {id:'persian_return',title:'Persian return and diaspora',status:'registry-ready',sourceIds:['bm-cyrus-cylinder-object','elephantine-yaho-temple-letter','elephantine-yaho-tax-list','brooklyn-elephantine-marriage'],claimIds:['persian-return-imperial-context'],limitations:'The Cyrus Cylinder supplies imperial context but does not mention Judah.'},
  {id:'jericho_ai',title:'Jericho and Ai chronology debate',status:'registry-ready',sourceIds:['sapienza-jericho-project','sapienza-jericho-2019-2023','sapienza-jericho-urban-diversity','bm-kenyon-jericho-publication'],claimIds:['jericho-conquest-chronology-disputed'],limitations:'Conquest-event identification remains disputed and requires separate YEC analysis.'},
  {id:'davidic_kingdom',title:'Davidic kingdom and early Judah',status:'registry-ready',sourceIds:['hu-qeiyafa-project','hu-qeiyafa-vol1','hu-qeiyafa-vol2','louvre-mesha-stele','bm-taylor-prism'],claimIds:['early-judah-davidic-context'],limitations:'State-formation evidence is not a personal David artefact.'}
];

const existingSourceIds = new Set(registry.sources.map((item) => item.id));
const existingClaimIds = new Set(registry.claims.map((item) => item.id));
for (const source of sources) {
  if (existingSourceIds.has(source.id)) throw new Error(`source already exists: ${source.id}`);
  if (registry.sources.some((item) => item.url === source.url)) throw new Error(`source URL already exists: ${source.url}`);
}
for (const claim of claims) {
  if (existingClaimIds.has(claim.id)) throw new Error(`claim already exists: ${claim.id}`);
}

const directRetraction = registry.sources.find((item) => item.id === 'scientific-reports-tall-retraction');
if (!directRetraction) throw new Error('Tall el-Hammam retraction source missing');
directRetraction.url = 'https://www.nature.com/articles/s41598-025-99290-6';
directRetraction.title = 'Retraction Note: A Tunguska sized airburst destroyed Tall el-Hammam';
directRetraction.note = 'Direct retraction notice published 24 April 2025; the airburst conclusion cannot support a positive claim.';

registry.schemaVersion = '1.1.0';
registry.updatedAt = NOW;
registry.sourceBoundary = NEW_BOUNDARY;
registry.sources.push(...sources);
registry.claims.push(...claims);
registry.runtimeCategories = categories;
registry.expansionPolicy = {
  runtimeMigrationBlockedUntil: 'all runtimeCategories remain registry-ready and the cross-category audit passes',
  offlinePolicy: 'Runtime migration must bundle registry data locally and must not require network access.',
  displayPolicy: 'Evidence and source badges render only in archaeology context; other tabs must not receive repeated archaeology footers.',
  yecPolicy: 'Scripture/YEC interpretation remains explicit and separate from field evidence.'
};

registry.sources.sort((a,b) => a.id.localeCompare(b.id));
registry.claims.sort((a,b) => a.id.localeCompare(b.id));
registry.runtimeCategories.sort((a,b) => a.id.localeCompare(b.id));

const output = JSON.stringify(registry, null, 2) + '\n';
if (write) {
  fs.writeFileSync(TARGET, output, 'utf8');
  console.log(`UPDATED archaeology registry: ${registry.sources.length} sources, ${registry.claims.length} claims, ${registry.runtimeCategories.length} categories`);
} else {
  console.log(`PASS guarded expansion: +${sources.length} sources, +${claims.length} claims, ${categories.length} categories`);
}
