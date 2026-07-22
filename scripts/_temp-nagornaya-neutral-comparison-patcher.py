#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)


def replace_paragraph(text: str, anchor: str, replacement: str, label: str) -> str:
    start = text.find(anchor)
    if start < 0:
        raise SystemExit(f'{label}: anchor not found')
    end = text.find('</p>', start)
    if end < 0:
        raise SystemExit(f'{label}: paragraph end not found')
    return text[:start] + replacement + text[end + 4:]


part4_path = ROOT / 'src/components/nagornaya/chast-4/NagornayaChast4MainShell.astro'
part4 = part4_path.read_text(encoding='utf-8')
part4 = replace_once(
    part4,
    ' */\n---\n<main id="main-content"',
    ' */\nimport NagornayaClaimComparison from \'../shared/NagornayaClaimComparison.astro\';\n---\n<main id="main-content"',
    'Part IV import',
)

v_start = part4.index('<!-- V. Ipsissima verba/vox -->')
v_end = part4.index('<!-- VI. Герменевтика библейских авторов -->', v_start)
v_segment = part4[v_start:v_end]
argument_anchor = '<p class="text-stone-700 text-[16px] leading-relaxed mb-5 text-justify">Аргумент Дональда Грина в этой статье сводится к трём фундаментальным пунктам:</p>'
argument_start = v_segment.index(argument_anchor)
outer_close = v_segment.rfind('</div>')
if outer_close <= argument_start:
    raise SystemExit('Part IV Green: outer close not found')
green_replacement = '''<p class="text-stone-700 text-[16px] leading-relaxed mb-5 text-justify">Ниже аргумент Грина показан не как бинарный ответ «правильно / неправильно», а как литературно-богословская модель: отдельно указаны первичный источник, сильная альтернатива, предел вывода и конфессиональная позиция серии.</p>
<NagornayaClaimComparison
  claimId="green-ipsissima-vox-model"
  title="Ipsissima vox: строгая модель и её границы"
/>
'''
v_segment = v_segment[:argument_start] + green_replacement + v_segment[outer_close:]
part4 = part4[:v_start] + v_segment + part4[v_end:]

part4 = replace_once(
    part4,
    '<h2 id="x-современные-угрозы-редакционная-критика-иисус-семинар-и-ск" class="text-xl font-bold text-stone-800 tracking-tight">X. Современные угрозы: Редакционная критика, Иисус Семинар и Скептицизм</h2></div><p class="text-stone-500 text-sm font-medium ml-14">Апология Семинарии Мастерс против деисторизации Писания. Warfield, The Real Problem of Inspiration</p>',
    '<h2 id="x-современные-угрозы-редакционная-критика-иисус-семинар-и-ск" class="text-xl font-bold text-stone-800 tracking-tight">X. Историко-критические модели: аргументы, пределы и конфессиональный ответ</h2></div><p class="text-stone-500 text-sm font-medium ml-14">Наблюдение → реконструкция → метод → доктринальная оценка</p>',
    'Part IV Thomas heading',
)
part4 = replace_paragraph(
    part4,
    '<p class="text-stone-700 text-[16px] leading-relaxed mb-5 text-justify"><strong>2. «Иисус Семинар»',
    '''<p class="text-stone-700 text-[16px] leading-relaxed mb-5 text-justify"><strong>2. «Иисус Семинар» (The Jesus Seminar).</strong> Цветное голосование за подлинность изречений стало радикальным примером исторической реконструкции. Роберт Томас подверг эту методологию сильной критике; однако его статья подтверждает аргумент конкретного автора, а не автоматически каждую институциональную или более широкую богословскую формулу.</p>
<NagornayaClaimComparison
  claimId="thomas-jesus-seminar-critique"
  title="Роберт Томас: критика Jesus Seminar и предел вывода"
/>''',
    'Part IV Thomas paragraph',
)
part4 = replace_paragraph(
    part4,
    '<p class="text-stone-700 text-[16px] leading-relaxed mb-5 text-justify">Особенно тревожно то, что Семинарии Мастерс пришлось бороться',
    '''<p class="text-stone-700 text-[16px] leading-relaxed mb-5 text-justify">Спор проходил и внутри евангельской академической среды. Случай Роберта Гандри и дискуссия в ETS показывают реальную конфессиональную границу вокруг историчности евангельского повествования. Томас, Фарнелл и Грин представляют сильную консервативную линию аргументации в TMSJ; эти авторские работы нужно оценивать по их собственным доказательствам, не превращая место публикации в автоматическое подтверждение каждого вывода серии.[26]</p>''',
    'Part IV institution boundary',
)
part4_path.write_text(part4, encoding='utf-8')

part5_path = ROOT / 'src/components/nagornaya/chast-5/NagornayaChast5MainShell.astro'
part5 = part5_path.read_text(encoding='utf-8')
part5_frontmatter = ''' */
import NagornayaClaimComparison from '../shared/NagornayaClaimComparison.astro';
import type { NagornayaClaimProjection } from '../../../lib/nagornaya-claim-projection';

const lordshipPastoralProjection: NagornayaClaimProjection = {
  id: 'lordship-pastoral-discernment',
  claim: 'Живая вера направляет человека к покаянию и послушанию; длительное сознательное нераскаяние требует серьёзного самоиспытания и пастырского предупреждения.',
  layer: 'pastoral-application',
  primaryEvidence: [
    {
      id: 'matthew-7-james-2',
      title: 'Мф 7:21–23; Иак 2:14–26',
      note: 'Канонические тексты связывают исповедание веры с исполнением воли Отца и предупреждают о мёртвой вере.',
    },
    {
      id: 'macarthur-ultimate-religious-decision',
      author: 'John MacArthur',
      title: 'The Ultimate Religious Decision',
      publication: 'Grace to You, 42-90 (2001)',
      note: 'Конфессионально-пастырская формулировка позиции Lordship Salvation.',
    },
  ],
  alternative: 'Сильная версия Free Grace подчёркивает, что оправдание основано исключительно на обещании Христа и вере, а плоды нельзя превращать во второе основание принятия Богом или в механический тест возрождения. Внутри этого лагеря различаются ответы о покаянии, ученичестве, уверенности и длительном непослушании.',
  limits: 'Внешний наблюдатель не знает сердца и не может измерить благодать одной временной шкалой. Нужно учитывать слабый или скрытый плод, зависимость, травму, депрессию, инвалидность, насилие, страх и изоляцию; окончательный суд принадлежит Христу.',
  seriesPosition: 'Серия исповедует, что спасительная вера не остаётся без плода и что упорное сознательное нераскаяние является серьёзным поводом для предупреждения. Это призыв к покаянию и пастырской помощи, а не окончательный приговор о состоянии конкретной души.',
  confidence: 'confessional',
  changeCondition: 'Формулировка должна быть пересмотрена, если экзегеза Мф 7 или Иак 2 представлена неточно либо если пастырское применение снова начинает действовать как автоматический внешний диагноз вместо различения и помощи.',
  attributionLevel: 'series',
};
---
<main id="main-content"'''
part5 = replace_once(
    part5,
    ' */\n---\n<main id="main-content"',
    part5_frontmatter,
    'Part V imports and projection',
)
part5 = replace_paragraph(
    part5,
    '<p class="text-stone-700 text-[16px] leading-relaxed mb-5 text-justify">Сбалансированная библейская позиция должна быть защищена от карикатур',
    '''<p class="text-stone-700 text-[16px] leading-relaxed mb-5 text-justify">Спор с <em>Free Grace</em> нельзя сводить к выбору между «плоды нужны» и «плоды не нужны». Он касается природы спасительной веры, покаяния, ученичества, длительного непослушания, самоиспытания и основания уверенности. Поэтому ниже сначала представлена сильная версия альтернативы, затем — конфессиональная позиция серии и предел пастырского применения.</p>''',
    'Part V alternative introduction',
)

vii_start = part5.index('<!-- VII. Пасторский баланс -->')
vii_end = part5.index('<!-- VIIa. Путь практической мудрости: От Законничества к Благодати -->', vii_start)
vii_segment = part5[vii_start:vii_end]
green_start = vii_segment.index('<div class="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-5 my-5">')
close_positions = []
cursor = green_start
while True:
    cursor = vii_segment.find('</div>', cursor)
    if cursor < 0:
        break
    close_positions.append(cursor)
    cursor += len('</div>')
if len(close_positions) < 3:
    raise SystemExit(f'Part V green block: expected trailing closes, found {len(close_positions)}')
green_outer_close = close_positions[-2] + len('</div>')
pastoral_component = '''<NagornayaClaimComparison
  projection={lordshipPastoralProjection}
  title="Живая вера, плоды и предел пастырского диагноза"
/>'''
vii_segment = vii_segment[:green_start] + pastoral_component + vii_segment[green_outer_close:]
part5 = part5[:vii_start] + vii_segment + part5[vii_end:]
part5_path.write_text(part5, encoding='utf-8')

package_path = ROOT / 'package.json'
package = package_path.read_text(encoding='utf-8')
package = replace_once(
    package,
    '"engine:contracts": "node scripts/check-engine-contracts.js && npm run series:facade:guard && npm run nagornaya:bar-asset:contract"',
    '"engine:contracts": "node scripts/check-engine-contracts.js && npm run series:facade:guard && npm run nagornaya:bar-asset:contract && npm run nagornaya:neutral-comparison:test"',
    'package engine contracts',
)
package = replace_once(
    package,
    '"nagornaya:bar-asset:browser:test": "node scripts/nagornaya-bar-asset-browser-test.js"',
    '"nagornaya:bar-asset:browser:test": "node scripts/nagornaya-bar-asset-browser-test.js",\n    "nagornaya:neutral-comparison:test": "node scripts/nagornaya-neutral-comparison-regression-test.js",\n    "nagornaya:neutral-comparison:browser:test": "node scripts/nagornaya-neutral-comparison-browser-test.mjs"',
    'package neutral scripts',
)
package_path.write_text(package, encoding='utf-8')

browser_path = ROOT / 'scripts/nagornaya-neutral-comparison-browser-test.mjs'
browser = browser_path.read_text(encoding='utf-8')
browser = replace_once(
    browser,
    "{ path: '/nagornaya/chast-4/', expected: 2, slug: 'part-4' },\n  { path: '/nagornaya/chast-5/', expected: 1, slug: 'part-5' },",
    "{ path: '/nagornaya/chast-4/', expected: 2, slug: 'part-4', evidence: ['green', 'thomas'] },\n  { path: '/nagornaya/chast-5/', expected: 1, slug: 'part-5', evidence: ['pastoral'] },",
    'browser route evidence names',
)
browser = replace_once(
    browser,
    '''      if (evidenceDir && (viewport.name === '390' || viewport.name === '1440')) {
        await page.screenshot({
          path: join(evidenceDir, `after-${route.slug}-${viewport.name}.png`),
          fullPage: true,
        });
      }''',
    '''      if (evidenceDir && (viewport.name === '390' || viewport.name === '1440')) {
        const blocks = page.locator('[data-nagornaya-claim-comparison]');
        for (let index = 0; index < route.evidence.length; index += 1) {
          await blocks.nth(index).scrollIntoViewIfNeeded();
          await page.waitForTimeout(150);
          await page.screenshot({
            path: join(evidenceDir, `after-${route.slug}-${route.evidence[index]}-${viewport.name}.jpg`),
            type: 'jpeg',
            quality: 82,
          });
        }
      }''',
    'browser after evidence capture',
)
browser_path.write_text(browser, encoding='utf-8')

print('Nagornaya neutral comparison exact patch applied')
