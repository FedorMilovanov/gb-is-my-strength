#!/usr/bin/env node
/**
 * Wave 32 Bible Corpus & S4 Verbatim Synodal Quote Contract
 *
 * Verifies:
 * 1. `data/bible/kassian/1korinfyanam.json` `"2:2"` carries authentic Cassian
 *    (Bezobrazov) wording rather than pasted Synodal `"и притом распятого"`.
 * 2. Repaired S4 Synodal quotes across safe Heart and Hard-Texts routes remain
 *    verbatim against Synodal text and grammatically sound in both source and
 *    built `dist/` HTML.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');

const kassian1Cor = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/bible/kassian/1korinfyanam.json'), 'utf8'));
assert.equal(
  kassian1Cor['2:2'],
  'Ибо я рассудил ничего не знать у вас, кроме Иисуса Христа, и Иисуса Христа распятого.',
  'kassian/1korinfyanam.json 2:2 must carry Cassian wording, not Synodal'
);

const routeExpectations = [
  {
    route: '/articles/skrytye-idoly-serdca/',
    mustContain: '«И люби Господа, Бога твоего, всем сердцем твоим, и всею душею твоею и всеми силами твоими» (Втор. 6:5',
    mustNotContain: 'возлюби Господа Бога твоего всем сердцем твоим, и всею душою твоею, и всею крепостью твоею',
  },
  {
    route: '/articles/sovest-vnutrenniy-sud/',
    mustContain: 'через лицемерие лжесловесников, сожженных в совести своей',
    mustNotContain: 'лицемерно лгут, сожжены в совести своей',
  },
  {
    route: '/articles/osvobozhdennoe-serdce/',
    mustContain: 'нынешние временные страдания ничего не стоят в сравнении с тою славою',
    mustNotContain: 'страдания нынешнего времени ничего не стоят',
  },
  {
    route: '/articles/strah-bozhij-rabskij-ili-synovnij/',
    mustContain: 'потому что Бог наш есть огонь поядающий',
    mustNotContain: 'огнь поядающий',
  },
  {
    route: '/articles/serdce-i-yazyk/',
    mustContain: '«Ибо от избытка сердца говорят уста. Добрый человек из доброго сокровища выносит доброе',
    mustNotContain: 'исполнен яда смертоносного',
  },
  {
    route: '/articles/serdce-i-duh/',
    mustContain: 'суть вражда против Бога; ибо закону Божию не покоряются, да и не могут',
    mustNotContain: 'во Христе Иисусе, живут не по плоти',
  },
  {
    route: '/articles/serdce-i-iskushenie/',
    mustContain: 'похоть же, зачав, рождает грех',
    mustNotContain: 'зачавши',
  },
  {
    route: '/articles/serdce-i-sokrovishche/',
    mustContain: 'где ни моль, ни ржа не истребляют и где воры не подкапывают и не крадут',
    mustNotContain: 'которого «моль и ржа не истребляют',
  },
  {
    route: '/articles/svoboda-vo-hriste/',
    mustContain: '«Итак стойте в свободе, которую даровал нам Христос',
    mustNotContain: '«стойте в свободе, которую даровал нам Христос',
  },
  {
    route: '/hard-texts/otstuplenie-ot-very-iuda-evreyam-6/',
    mustContain: 'причастниками Духа Святаго',
    mustNotContain: 'причастниками Духа Святого, и вкусивших благого глагола Божия и сил будущего века, и отпадших опять',
  },
];

assert.ok(fs.existsSync(DIST), 'dist/ missing; build dist before running wave32-bible-s4-quote-contract');

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
}

for (const check of routeExpectations) {
  const file = path.join(DIST, check.route.replace(/^\/+|\/+$/g, ''), 'index.html');
  assert.ok(fs.existsSync(file), `${check.route}: missing dist HTML`);
  const plain = stripTags(fs.readFileSync(file, 'utf8'));
  assert.ok(plain.includes(check.mustContain), `${check.route}: missing expected verbatim quote: ${check.mustContain}`);
  assert.ok(!plain.includes(check.mustNotContain), `${check.route}: still contains stale misquote: ${check.mustNotContain}`);
}

console.log(`✅ Wave 32 Bible corpus & S4 verbatim quote contract passed (Kassian 1 Cor 2:2 + ${routeExpectations.length} routes)`);
