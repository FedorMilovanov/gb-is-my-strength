#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const sourcePath = 'src/components/article-pilots/antisovetov/AntisovetovBody.astro';
const source = readFileSync(sourcePath, 'utf8');
const errors = [];
const requireText = (text, label = text) => {
  if (!source.includes(text)) errors.push(`missing: ${label}`);
};
const forbidText = (text, label = text) => {
  if (source.includes(text)) errors.push(`forbidden legacy wording: ${label}`);
};

for (let point = 1; point <= 20; point += 1) {
  const marker = `id="point-${point}"`;
  const count = source.split(marker).length - 1;
  if (count !== 1) errors.push(`${marker}: expected once, found ${count}`);
}

forbidText('Новых людей обычно встречают с особой теплотой', 'universal newcomer-warmth claim');
forbidText('В здоровой церкви вопросы разрешены и не стоят человеку дорого', 'no-cost questioning idealization');
forbidText('Первая ведёт к покаянию, свободе и исцелению. Вторая — к контролю, зависимости и духовному истощению', 'deterministic pain outcomes');
forbidText('обращение к «внутренним процедурам» бесполезно', 'internal procedures declared useless');
forbidText('коллективное письменное обращение (не анонимное)', 'universal non-anonymity requirement');
forbidText('это не «бунт», а 1 Тим. 5:19 в действии', 'collective letter equated with 1 Timothy 5:19');
forbidText('Саул, первый царь Израиля, начинал искренне смиренным', 'Saul motive certainty');
forbidText('ὑπόκρισις) — театральная игра, ношение маски', 'hypokrisis literal-mask definition');
forbidText('Лицемерие (ὑπόκρισις) — ношение маски', 'strategic-map literal-mask definition');
forbidText('Когнитивный диссонанс — внутренний конфликт между тем, что человек ощущает, и тем, что ему объясняют', 'inaccurate cognitive-dissonance definition');
forbidText('Любая система стремится к равновесию', 'universal system-homeostasis claim');
forbidText('Гомеостаз и вторичная травма', 'secondary-trauma overreach');

requireText('В некоторых принуждающих или духовно небезопасных системах первоначальная теплота может стать условной', 'bounded conditional-warmth wording');
requireText('за честный вопрос не наказывают холодом, лишением служения или духовным ярлыком', 'psychological-safety boundary');
requireText('эффекты повторяющейся неконтролируемости', 'updated learned-helplessness wording');
requireText('осторожная аналогия из семейно-системной и организационной теории', 'homeostasis analogy boundary');
requireText('напряжение между несовместимыми убеждениями, обязательствами, знаниями или поступками', 'correct cognitive-dissonance wording');
requireText('1 Тим. 5:19 прежде всего задаёт правило проверки свидетельств', '1 Timothy 5:19 evidentiary boundary');
requireText('защищённые или конфиденциальные каналы сообщения', 'protected-reporting boundary');
requireText('предполагаемом преступлении, непосредственной опасности', 'law-enforcement scope boundary');
requireText('компетентность в safeguarding, отсутствие конфликта интересов', 'external helper competence boundary');
requireText('ὑπόκρισις) — притворство и лицемерие', 'lexical correction');
requireText('Авторская аналитическая формула: «отрицательный отбор пресвитеров»', 'authorial-term boundary');
requireText('data-audit-sources="54"', '54-source audit marker');
requireText('Полный контрольный реестр Wave 7: 54 источника', 'full registry link label');

const sourceSection = source.match(/<section class="sources-block" id="istochniki"[\s\S]*?<\/section>/)?.[0] ?? '';
const urls = [...sourceSection.matchAll(/href="(https:\/\/[^\"]+)"/g)].map((match) => match[1]);
const uniqueUrls = new Set(urls);
if (uniqueUrls.size < 24) errors.push(`source frame: expected at least 24 unique external URLs, found ${uniqueUrls.size}`);
for (const requiredHost of ['doi.org', 'pubmed.ncbi.nlm.nih.gov', 'pmc.ncbi.nlm.nih.gov', 'childabuseroyalcommission.gov.au', 'iicsa.org.uk', 'churchofengland.org', 'gov.uk', 'eerdmans.com']) {
  if (![...uniqueUrls].some((url) => url.includes(requiredHost))) errors.push(`source frame missing required host: ${requiredHost}`);
}

for (const blockedName of ['Robert Morris', 'Mark Driscoll', 'Ravi Zacharias', 'Sunday Adelaja', 'David Platt']) {
  if (source.includes(blockedName)) errors.push(`modern case roster remains forbidden in core article: ${blockedName}`);
}

if (errors.length) {
  console.error(`❌ Antisovetov Wave 8 contract failed (${errors.length})`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`✅ Antisovetov Wave 8 contract passed: 20 anchors, ${uniqueUrls.size} curated links, 54-source audit boundary`);
