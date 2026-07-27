#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'out'

ARTICLE_6A = ROOT / 'src/content/articles/kniga-enoha-kotoroy-ne-bylo-kak-raznye-proizvedeniya-stali-korpusom.mdx'
ARTICLE_6B = ROOT / 'src/content/articles/mozhno-li-doveryat-1-enohu-kanonicheskiy-audit.mdx'
GATE_JSON = ROOT / 'data/genesis6-enoch-footnote-gates.json'
GATE_SCRIPT = ROOT / 'scripts/genesis6-enoch-footnote-gate.mjs'

EXPECTED_BLOBS = {
    ARTICLE_6A: '7fa248e9a1ac78487e4ca48f208972b9600e3d64',
    ARTICLE_6B: '1eb4a45ef692e5da71a1c1011e4c1f7917600211',
    GATE_JSON: 'ad98895bc38b5dc879d04949aab23ffbfe5b45f3',
    GATE_SCRIPT: '118405c0ab54d2573233f53af1dc2c8b916d88d5',
}


def git_blob(path: Path) -> str:
    return subprocess.check_output(['git', 'hash-object', str(path)], cwd=ROOT, text=True).strip()


def require_exact_blobs() -> None:
    for path, expected in EXPECTED_BLOBS.items():
        actual = git_blob(path)
        if actual != expected:
            raise SystemExit(f'baseline blob drift for {path.relative_to(ROOT)}: {actual} != {expected}')


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return source.replace(old, new, 1)


def patch_6a(source: str) -> str:
    replacements = [
        ('3. Кумранские рукописи подтверждают дохристианскую древность значительных частей корпуса, но не содержат полного свитка нынешних 108 глав.', '3. Кумранские рукописи подтверждают дохристианскую древность значительных частей корпуса, но не содержат полного свитка нынешних 108 глав.[^28]', '6A geez/qumran boundary'),
        ('Псевдоэпиграфия не означает автоматически, что произведение позднее, бессмысленное или намеренно мошенническое в современном юридическом смысле. Она означает, что автор или круг авторов говорит от имени почитаемой фигуры прошлого. Енох особенно подходил для такой роли: он жил до Потопа, ходил с Богом и был взят Им.', 'Псевдоэпиграфия не означает автоматически, что произведение позднее, бессмысленное или намеренно мошенническое в современном юридическом смысле. Она означает, что автор или круг авторов говорит от имени почитаемой фигуры прошлого. Енох особенно подходил для такой роли: он жил до Потопа, ходил с Богом и был взят Им.[^10]', '6A pseudepigraphy'),
        ('Так называют славянскую книгу о небесном восхождении Еноха и его наставлениях. Она известна прежде всего через славянскую передачу греческого произведения и имеет собственную сложную историю. Её нельзя использовать как прямой источник Иуды или Петра без специального доказательства датировки и передачи конкретного места.', 'Так называют славянскую книгу о небесном восхождении Еноха и его наставлениях. Она известна прежде всего через славянскую передачу греческого произведения и имеет собственную сложную историю. Её нельзя использовать как прямой источник Иуды или Петра без специального доказательства датировки и передачи конкретного места.[^11]', '6A 2 Enoch'),
        ('Это значительно более поздний еврейский мистический текст, связанный с традициями небесных дворцов и Метатрона. Он относится к другому периоду истории иудаизма.', 'Это значительно более поздний еврейский мистический текст, связанный с традициями небесных дворцов и Метатрона. Он относится к другому периоду истории иудаизма.[^12]', '6A 3 Enoch'),
        ('> «Пять книг Еноха» — удобная карта позднего корпуса, а не доказательство одного автора, одной даты или одного древнего свитка.', '> «Пять книг Еноха» — удобная карта позднего корпуса, а не доказательство одного автора, одной даты или одного древнего свитка.[^13]', '6A macrostructure'),
        ('Дошедшая форма соединяет эти линии, хотя руководители, виды преступления и наказания различаются. Поэтому точнее говорить:', 'Дошедшая форма соединяет эти линии, хотя руководители, виды преступления и наказания различаются.[^14] Поэтому точнее говорить:', '6A composite Watchers'),
        ('Здесь развращение объясняется не только союзом с женщинами, но и незаконным откровением знаний.', 'Здесь развращение объясняется не только союзом с женщинами, но и незаконным откровением знаний.[^15]', '6A Shemihazah/Azazel'),
        ('Но она не является просто утраченными главами между 1 Енох 16 и 17 и не должна включаться в нумерацию 1–108.', 'Но она не является просто утраченными главами между 1 Енох 16 и 17 и не должна включаться в нумерацию 1–108.[^16]', '6A Book of Giants'),
        ('> `4Q204` подтверждает дохристианское существование арамейской формы судебного оракула, тесно связанного с Иуд. 14–15; связное чтение зависит от реконструкции и сопоставления версий.', '> `4Q204` подтверждает дохристианское существование арамейской формы судебного оракула, тесно связанного с Иуд. 14–15; связное чтение зависит от реконструкции и сопоставления версий.[^17]', '6A 4Q204/Jude'),
        ('Но оно означает, что нельзя ссылаться на Кумран как на прямое физическое дохристианское подтверждение Притчей.', 'Но оно означает, что нельзя ссылаться на Кумран как на прямое физическое дохристианское подтверждение Притчей.[^18]', '6A Parables witness absence'),
        ('Материал имеет древний арамейский контроль в `4Q204`, но древность рассказа не делает каждую его подробность частью канонического повествования Бытия.', 'Материал имеет древний арамейский контроль в `4Q204`, но древность рассказа не делает каждую его подробность частью канонического повествования Бытия.[^19]', '6A Noah material'),
        ('Первоначальная связь главы 108 с Посланием остаётся предметом специального исследования.', 'Первоначальная связь главы 108 с Посланием остаётся предметом специального исследования.[^20]', '6A chapter 108'),
        ('Современные исследования различают два почерка и несколько Еноховых блоков, включая перекрывающийся материал. Физическое перекрытие установлено увереннее, чем его причина.', 'Современные исследования различают два почерка и несколько Еноховых блоков, включая перекрывающийся материал. Физическое перекрытие установлено увереннее, чем его причина.[^21]', '6A Panopolitanus hands'),
        ('Он подтверждает греческую христианскую передачу частей 1 Енох 97–107 в IV веке. Но совместный кодекс снова свидетельствует о чтении и хранении, а не автоматически о каноничности.', 'Он подтверждает греческую христианскую передачу частей 1 Енох 97–107 в IV веке. Но совместный кодекс снова свидетельствует о чтении и хранении, а не автоматически о каноничности.[^22]', '6A Michigan codex'),
        ('Современный проект нового геэз-издания использовал значительно более широкую рукописную базу, включая не менее тридцати трёх важных ранних рукописей.[^9]', 'Современный проект нового геэз-издания использовал значительно более широкую рукописную базу, включая не менее тридцати трёх важных ранних рукописей.[^9]\n\nЦифровые каталоги и порталы помогают находить свидетелей, но не заменяют критического издания, колляции и проверки конкретного листа.[^23]', '6A digital portal limits'),
        ('1 Енох имеет реальный канонический статус в Эфиопской Православной Тэвахэдо Церкви.', '1 Енох имеет реальный канонический статус в Эфиопской Православной Тэвахэдо Церкви.[^24]', '6A EOTC canon'),
        ('Это не означает, что реконструкция произвольна. Некоторые восстановления почти неизбежны благодаря параллельным версиям и сохранившимся буквам. Другие остаются спорными.', 'Это не означает, что реконструкция произвольна. Некоторые восстановления почти неизбежны благодаря параллельным версиям и сохранившимся буквам. Другие остаются спорными. Публикация фотографии, транскрипции или музейного факсимиле требует отдельной проверки лицензии и права воспроизведения; научная цитата сама по себе не сообщает права на изображение.[^25]', '6A image rights'),
        ('Реконструкция не равна подделке. Но восстановленное нельзя выдавать за непосредственно видимое.', 'Реконструкция не равна подделке. Но восстановленное нельзя выдавать за непосредственно видимое. Равным образом современный фрагмент без проверяемого происхождения нельзя объявлять древним только по внешнему виду или заявлению продавца.[^26]', '6A modern forgeries'),
        ('Академический исследователь может установить материальный или языковой факт с высокой точностью и одновременно придерживаться теории Писания, которую этот сайт не разделяет.', 'Академический исследователь может установить материальный или языковой факт с высокой точностью и одновременно придерживаться теории Писания, которую этот сайт не разделяет.[^27]', '6A confessional boundary'),
    ]
    for old, new, label in replacements:
        source = replace_once(source, old, new, label)
    notes = r'''
[^10]: О псевдоэпиграфии и формировании Еноховой литературной традиции см. Annette Yoshiko Reed, *Fallen Angels and the History of Judaism and Christianity*; George W. E. Nickelsburg, *1 Enoch 1*. Здесь термин описывает литературную атрибуцию и не используется как автоматическое обвинение в современном мошенничестве.

[^11]: F. I. Andersen, “2 (Slavonic Apocalypse of) Enoch,” в *The Old Testament Pseudepigrapha*, vol. 1; Andrei A. Orlov, исследования славянской Еноховой традиции. Датировка и направление передачи отдельных форм остаются предметом дискуссии.

[^12]: Hugo Odeberg, *3 Enoch or The Hebrew Book of Enoch*; Peter Schäfer, исследования Hekhalot-литературы. 3 Енох относится к поздней раввинистической мистической среде и не служит прямым свидетелем эпохи Иуды.

[^13]: Nickelsburg, *1 Enoch 1*; Nickelsburg and VanderKam, *1 Enoch 2*; Jonas C. Greenfield and Michael E. Stone, “The Enochic Pentateuch and the Date of the Similitudes.” Пятичастная схема описывает поздний корпус, а не единый автограф.

[^14]: Nickelsburg, *1 Enoch 1*; Reed, *Fallen Angels*; Loren T. Stuckenbruck, исследования Книги Стражей. Композиционное различение линий используется как литературный анализ, а не как утверждение о полностью восстановленных независимых документах.

[^15]: 1 Енох 6–11 в критических изданиях Nickelsburg и Knibb; арамейские свидетели `4Q201–4Q202`. Различение линии Шемихазы и линии Асаэла/Азазеля отражает разные акценты дошедшего текста; точная редакционная история остаётся реконструкцией.

[^16]: Loren T. Stuckenbruck, *The Book of Giants from Qumran*; J. T. Milik, *The Books of Enoch*. Книга Исполинов принадлежит Еноховой литературной среде, но не является нумерованной частью геэз-корпуса 1–108.

[^17]: `4Q204 / 4QEnᶜ`; Henryk Drawnel, *Qumran Cave 4: The Aramaic Books of Enoch*; Milik, *The Books of Enoch*; Иуд. 14–15. Прямо читаемые буквы необходимо отличать от связного редакторского восстановления оракула.

[^18]: Nickelsburg and VanderKam, *1 Enoch 2*; Michael A. Knibb, исследования Притчей; *Enoch and the Messiah Son of Man*. Среди общепризнанных арамейских Еноховых рукописей Кумрана главы 37–71 не засвидетельствованы; вывод из отсутствия остаётся ограниченным.

[^19]: `4Q204` и 1 Енох 106–107 в критических изданиях Nickelsburg–VanderKam и Knibb. Арамейская древность Ноевского материала не делает его добавочные детали частью канонического рассказа Бытия.

[^20]: Stuckenbruck, *1 Enoch 91–108*. Связь главы 108 с Посланием и её редакционная функция остаются композиционным `HOLD`; выводы должны относиться к конкретному заключительному тексту.

[^21]: Bibliotheca Alexandrina, `BAAM 0522 / P.Cairo 10759`; Helen R. Jacobus, исследование писцов и порядка блоков; Houghton and Monier, повторная идентификация Codex Panopolitanus. Два почерка и перекрывающийся материал являются наблюдаемыми фактами; намерение редактора не установлено.

[^22]: University of Michigan Papyrology Collection, `P.Mich.inv. 5552`; издания Chester Beatty–Michigan Enoch manuscript. Кодекс свидетельствует о греческой христианской передаче частей 1 Енох 97–107, но совместное хранение с Мелитоном не доказывает равный канонический статус.

[^23]: Цифровые каталоги, включая Open Context и рукописные порталы, используются как средства обнаружения карточек, изображений и метаданных. Они не заменяют критического издания, проверки сиглы, листа, редакционной истории и условий доступа.

[^24]: Канонический статус 1 Еноха в Эфиопской Православной Тэвахэдо Церкви фиксируется её церковной традицией и профильными исследованиями эфиопского канона; см. также Knibb, *The Ethiopic Book of Enoch*. Этот исторический факт не решает вопрос протестантского канона.

[^25]: Права на изображения и факсимиле определяются владельцем конкретного артефакта или цифровой коллекции — Israel Antiquities Authority, Bibliotheca Alexandrina, University of Michigan и др. Транскрипция, перевод, фотография и музейная карточка имеют разные правовые режимы; до отдельного решения используются текстовые ссылки и открытые схемы.

[^26]: Современная история неподтверждённых и поддельных “древних” фрагментов показывает необходимость документированной provenance, материаловедческой проверки и сопоставления с надёжно раскопанными свидетелями. В этой статье никакой предмет без проверяемой истории происхождения не используется как древнее доказательство.

[^27]: Второе Лондонское баптистское исповедание 1689 года, глава 1; Вестминстерское исповедание веры, глава 1. Конфессиональная граница определяет богословский суд статьи, но не разрешает искажать материальные, языковые или текстологические факты.

[^28]: Knibb, *The Ethiopic Book of Enoch*, vols. 1–2; Nickelsburg and VanderKam, *1 Enoch 1–2*; Ted Erho and Loren Stuckenbruck, “A Manuscript History of Ethiopic Enoch.” Полная последовательность 1–108 известна по геэз-передаче, тогда как Кумран сохраняет древние, но фрагментарные арамейские произведения и сборки.
'''.strip()
    if '[^10]:' in source or '[^28]:' in source:
        raise SystemExit('6A new definitions already present')
    return source.rstrip() + '\n\n' + notes + '\n'


def patch_6b(source: str) -> str:
    replacements = [
        ('Книга Стражей понимает «сынов Божиих» как небесных Стражей, которые покидают своё место и соединяются с человеческими женщинами.', 'Книга Стражей понимает «сынов Божиих» как небесных Стражей, которые покидают своё место и соединяются с человеческими женщинами. Слова Христа о том, что ангелы на небесах не женятся, задают обязательную каноническую границу, но сами по себе не решают, возможно ли ангельское падение вне состояния небесной верности.[^4]', '6B Matthew 22:30'),
        ('Быт. 6 и канонические параллели не приводят эти числа, имена и географические детали.', 'Быт. 6 и канонические параллели не приводят эти числа, имена и географические детали.[^5]', '6B Qumran/Hermon'),
        ('Стражи обучают людей оружию, металлам, украшениям, косметике, заклинаниям, корням и астрологическим наблюдениям.', 'Стражи обучают людей оружию, металлам, украшениям, косметике, заклинаниям, корням и астрологическим наблюдениям.[^6]', '6B forbidden arts'),
        ('В распространённых переводах 1 Енох 10:8 Бог повелевает связать Азазеля и говорит, что на нём следует возложить весь грех.', 'В распространённых переводах 1 Енох 10:8 Бог повелевает связать Азазеля и говорит, что на нём следует возложить весь грех.[^7]', '6B 10:8 text'),
        ('Сатана искушает и обольщает, но человек остаётся виновным.', 'Сатана искушает и обольщает, но человек остаётся виновным.[^8]', '6B canonical anthropology'),
        ('В 1 Енох 98:4 прямо говорится, что грех не был послан на землю, но человек создал его сам.', 'В 1 Енох 98:4 прямо говорится, что грех не был послан на землю, но человек создал его сам.[^9]', '6B 98:4'),
        ('При первом чтении наиболее естественным остаётся проблемное возложение полноты греха на Азазеля. Но окончательный вердикт должен быть вынесен после проверки текста и версии.', 'При первом чтении наиболее естественным остаётся проблемное возложение полноты греха на Азазеля. Но окончательный вердикт должен быть вынесен после проверки текста, версии и конкурирующих объяснений формулы.[^10]', '6B 10:8 interpretations'),
        ('Книга Стражей объясняет происхождение злых духов так: исполины рождаются от союза Стражей и женщин; их тела погибают, но вышедшие от них духи остаются на земле и становятся злыми духами.', 'Книга Стражей объясняет происхождение злых духов так: исполины рождаются от союза Стражей и женщин; их тела погибают, но вышедшие от них духи остаются на земле и становятся злыми духами.[^11]', '6B 15:8-12'),
        ('Канон нигде не учит, что все бесы являются бесплотными духами погибших нефилимов.', 'Канон нигде не учит, что все бесы являются бесплотными духами погибших нефилимов.[^12]', '6B canonical demonology'),
        ('Енох выступает писцом, посредником сообщения и вестником суда.', 'Енох выступает писцом, посредником сообщения и вестником суда.[^13]', '6B Enoch role'),
        ('Глава 22 описывает места ожидания умерших, разделённые до суда. Другие части корпуса говорят о долинах, горах, огне, безднах, темницах и небесных хранилищах.', 'Глава 22 описывает места ожидания умерших, разделённые до суда. Другие части корпуса говорят о долинах, горах, огне, безднах, темницах и небесных хранилищах.[^14]', '6B chapter 22'),
        ('- датировка широко обсуждается;', '- датировка широко обсуждается;[^15]', '6B Parables dating'),
        ('Это важно для истории иудейской мессианской мысли.', 'Это важно для истории иудейской мессианской мысли, но направление литературной зависимости между Притчами и новозаветной христологией не устанавливается одной тематической параллелью.[^16]', '6B Son of Man dependence'),
        ('Некоторые переводы создают впечатление, что Енох отождествляется с небесным Сыном человеческим. Другие исследователи предлагают иные синтаксические и композиционные решения.', 'Некоторые переводы создают впечатление, что Енох отождествляется с небесным Сыном человеческим. Другие исследователи предлагают иные синтаксические и композиционные решения.[^17]', '6B chapter 71'),
        ('- сравнить арамейские формы `4Q208–4Q211`;', '- сравнить арамейские формы `4Q208–4Q211`;[^18]', '6B astronomical witnesses'),
        ('364 дня образуют ровно 52 недели. Такая схема удобна для устойчивого распределения праздников и священного времени.', '364 дня образуют ровно 52 недели. Такая схема удобна для устойчивого распределения праздников и священного времени.[^19]', '6B 364-day calendar'),
        ('Но идентификация каждого животного, дата каждого слоя и новая гипотеза о нескольких Animal Apocalypse(s) относятся к историко-литературной реконструкции, а не к доктрине.', 'Но идентификация каждого животного, дата каждого слоя и новая гипотеза о нескольких Animal Apocalypse(s) относятся к историко-литературной реконструкции, а не к доктрине.[^20]', '6B Animal Apocalypse'),
        ('Нарушенный порядок текста между главами 93 и 91 также напоминает, что богословский анализ зависит от текстологии.', 'Нарушенный порядок текста между главами 93 и 91 также напоминает, что богословский анализ зависит от текстологии; `4Q212` является ключевым арамейским свидетелем при восстановлении последовательности.[^21]', '6B Weeks'),
        ('Древний арамейский фрагмент показывает, что рассказ существовал давно. Он не превращает его в Бытие.', 'Древний арамейский фрагмент показывает, что рассказ существовал давно. Он не превращает его в Бытие.[^22]', '6B Noah birth'),
        ('Но её связь с первоначальным Посланием обсуждается.', 'Но её связь с первоначальным Посланием обсуждается.[^23]', '6B chapter 108'),
        ('Канонический текст утверждает истинность приведённого пророчества и его атрибуцию Еноху.', 'Канонический текст утверждает истинность приведённого пророчества и его атрибуцию Еноху. `4Q204` подтверждает дохристианское существование близкой арамейской формы судебного оракула, но не показывает на коже одну полную непрерывную цитату Иуд. 14–15.[^24]', '6B Jude/4Q204'),
        ('Некоторые ранние христианские авторы высоко оценивали 1 Еноха и использовали его при толковании Быт. 6, Иуды и демонологии. Другие относились к нему осторожнее или отвергали его канонический статус.', 'Некоторые ранние христианские авторы высоко оценивали 1 Еноха и использовали его при толковании Быт. 6, Иуды и демонологии. Другие относились к нему осторожнее или отвергали его канонический статус.[^25]', '6B early reception'),
        ('1 Енох является каноническим в Эфиопской Православной Тэвахэдо Церкви. Это исторический факт, который нельзя стирать.', '1 Енох является каноническим в Эфиопской Православной Тэвахэдо Церкви. Это исторический факт, который нельзя стирать.[^26]', '6B EOTC canon'),
        ('Анализ должен идти не по принципу «книга истинна» или «книга ложна», а по конкретным произведениям, версиям и утверждениям.', 'Анализ должен идти не по принципу «книга истинна» или «книга ложна», а по конкретным произведениям, версиям и утверждениям.[^27]', '6B corpus bibliography'),
    ]
    for old, new, label in replacements:
        source = replace_once(source, old, new, label)
    notes = r'''
[^4]: Мф. 22:30; Мк. 12:25; ср. Иуд. 6. Канонический текст описывает ангелов “на небесах” как не вступающих в брак; применение этого места к падшим существам требует аргумента и не должно подменять анализ Быт. 6.

[^5]: 1 Енох 6:1–6; `4Q201 / 4QEnᵃ` и связанные арамейские свидетели в изданиях Milik и Drawnel. Число двести, имена предводителей и Ермон принадлежат Еноховой разработке и не названы в Быт. 6.

[^6]: 1 Енох 7–8 в критических изданиях Nickelsburg и Knibb; Reed, *Fallen Angels*. Нравственная оценка оружия, магии и развращения совместима с каноном, но происхождение каждого ремесла от названного ангела является дополнительной традицией.

[^7]: 1 Енох 10:4–8 в изданиях Nickelsburg, Knibb и доступных древних версиях. Формулу о возложении греха на Азазеля нельзя оценивать по одному популярному переводу без проверки геэз, греческих и арамейских данных.

[^8]: Быт. 3; Быт. 6:5; Иер. 17:9; Мк. 7:20–23; Рим. 5:12–19; Иак. 1:14–15. Каноническая антропология сохраняет личную человеческую вину даже при реальности сатанинского искушения.

[^9]: 1 Енох 98:4; Stuckenbruck, *1 Enoch 91–108*. Формула о человеческом производстве греха является внутренним коррективом против чтения всего корпуса как снятия ответственности с людей.

[^10]: Nickelsburg, *1 Enoch 1*; Reed, *Fallen Angels*; LIX version-control matrix. Обсуждаются по меньшей мере текстологическое, репрезентативное, судебное, редакционное и внутренне-корпусное объяснения 10:8; ни одно не должно объявляться доказанным без версии и контекста.

[^11]: 1 Енох 15:8–12 в критических изданиях Nickelsburg и Knibb; арамейские остатки Книги Стражей. Утверждение о духах погибших исполинов относится к конкретной Еноховой демонологической модели.

[^12]: Мф. 25:41; Мк. 1:23–27; Лк. 8:26–33; Еф. 6:12; Иуд. 6; 2 Пет. 2:4. Канон говорит о дьяволе, его ангелах, бесах и заключённых ангелах, но не раскрывает единую родословную всех злых духов от нефилимов.

[^13]: 1 Енох 12–16; Nickelsburg, *1 Enoch 1*. Енох является писцом и вестником приговора; он не отменяет Божий суд и не совершает искупление.

[^14]: 1 Енох 22 в изданиях Nickelsburg и Knibb. Камеры умерших важны для истории представлений о посмертном ожидании, но их подробная топография не устанавливает каноническую карту шеола, hades, рая и геенны.

[^15]: Knibb, “The Date of the Parables of Enoch: A Critical Review”; *Enoch and the Messiah Son of Man*; Greenfield and Stone, “The Enochic Pentateuch and the Date of the Similitudes.” Датировка Притчей остаётся самостоятельным `HOLD`.

[^16]: John J. Collins и другие исследования фигуры Сына человеческого; *Enoch and the Messiah Son of Man*. Тематическая близость к Дан. 7 и Новому Завету не определяет автоматически направление зависимости или единый общепринятый титул.

[^17]: Nickelsburg and VanderKam, *1 Enoch 2*, комментарий к главам 70–71; современные исследования геэз-синтаксиса и композиции. Возможное отождествление Еноха остаётся `TEXT-VARIANT / HOLD`.

[^18]: Henryk Drawnel, *The Aramaic Astronomical Book (4Q208–4Q211)*; каталожные данные `4Q208–4Q211`. Арамейские формы пространнее и местами организованы иначе, чем поздняя геэз-нумерация.

[^19]: Jonathan Ben-Dov и Henryk Drawnel, исследования 364-дневных календарей и Астрономической книги. Необходимо различать литургическую норму, богословие порядка и физическое описание года.

[^20]: Elena L. Dugan, *The Apocalypse of the Birds*; традиционные исследования Животного Апокалипсиса. Модель нескольких Animal Apocalypse(s) является современной литературной гипотезой, а не завершённым консенсусом.

[^21]: `4Q212 / 4QEnᵍ`; Stuckenbruck, *1 Enoch 91–108*. Арамейский свидетель поддерживает реконструкцию более естественного порядка Апокалипсиса Недель, но реконструированный порядок должен быть обозначен как редакционный.

[^22]: 1 Енох 106–107; `4Q204`; Nickelsburg and VanderKam, *1 Enoch 2*. Древность рассказа о рождении Ноя не сообщает канонический статус его сияющему облику и другим легендарным деталям.

[^23]: Stuckenbruck, *1 Enoch 91–108*. Глава 108 может сохранять темы суда, совместимые с Писанием, но её первоначальная связь с Посланием и функция в корпусе остаются композиционным `HOLD`.

[^24]: Иуд. 14–15; `4Q204 / 4QEnᶜ`; Richard Bauckham, *Jude, 2 Peter*; Drawnel и Milik по арамейскому свидетелю. Канон утверждает пророчество, а рукопись подтверждает древнюю близкую форму; это не канонизирует весь составной корпус.

[^25]: Annette Yoshiko Reed, *Fallen Angels and the History of Judaism and Christianity*; свидетельства Тертуллиана, Оригена и других ранних авторов. Цитирование, положительное употребление, литургическая рецепция и канонический статус являются разными категориями.

[^26]: Эфиопская Православная Тэвахэдо Церковь и исследования эфиопского канона; Knibb, *The Ethiopic Book of Enoch*. Реальная каноничность в этой традиции является историческим фактом, но не устанавливает протестантскую каноническую границу.

[^27]: Nickelsburg, *1 Enoch 1*; Nickelsburg and VanderKam, *1 Enoch 2*; Knibb, *The Ethiopic Book of Enoch*; Reed, *Fallen Angels*. Эти труды используются для разделения произведений, версий и истории рецепции, а не как внешний магистериум над каноническим Писанием.
'''.strip()
    if '[^4]:' in source or '[^27]:' in source:
        raise SystemExit('6B new definitions already present')
    return source.rstrip() + '\n\n' + notes + '\n'


NEW_GATE = {
    'schemaVersion': 2,
    'seriesId': 'genesis-6',
    'releaseState': 'blocked',
    'articles': [
        {'articleKey': '6A', 'slug': 'kniga-enoha-kotoroy-ne-bylo-kak-raznye-proizvedeniya-stali-korpusom', 'researchDocumentId': 'GEN6-ENOCH-6A-FOOTNOTE-MAP-LIX', 'minimumExistingFootnoteDefinitions': 28, 'targetClaimLevelFootnoteGroups': 27, 'requiredFootnoteIds': [str(i) for i in range(1, 29)], 'status': 'claim-level-source-pass-complete'},
        {'articleKey': '6B', 'slug': 'mozhno-li-doveryat-1-enohu-kanonicheskiy-audit', 'researchDocumentId': 'GEN6-ENOCH-6B-SOURCE-PASS-LIX', 'minimumExistingFootnoteDefinitions': 27, 'targetClaimLevelFootnoteGroups': 26, 'requiredFootnoteIds': [str(i) for i in range(1, 28)], 'status': 'claim-level-source-pass-complete'},
    ],
    'policy': {'failOnFootnoteRegression': True, 'targetIsPublicationGate': True, 'allowDraftBelowTarget': False, 'requireEveryDefinitionReferenced': True, 'requireExactDefinitionSet': True, 'requireDraft': True, 'requireNoindex': True, 'requireSourcesRequired': True},
}

NEW_GATE_SCRIPT = r'''#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gatePath = path.join(ROOT, 'data/genesis6-enoch-footnote-gates.json');
const fail = (message) => { console.error(`ERROR genesis6 enoch footnote gate: ${message}`); process.exitCode = 1; };
const frontmatterValue = (source, key) => {
  const match = source.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
  if (!match) return undefined;
  const raw = match[1].trim();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw.replace(/^["']|["']$/g, '');
};
const collect = (source, regex) => { const values = []; for (const match of source.matchAll(regex)) values.push(match[1]); return values; };
if (!fs.existsSync(gatePath)) { fail('missing data/genesis6-enoch-footnote-gates.json'); process.exit(); }
const gate = JSON.parse(fs.readFileSync(gatePath, 'utf8'));
if (gate.schemaVersion !== 2 || gate.seriesId !== 'genesis-6') fail('invalid schemaVersion/seriesId');
if (gate.releaseState !== 'blocked') fail('releaseState must remain blocked until a separate publication transaction');
if (!Array.isArray(gate.articles) || gate.articles.length !== 2) fail('exactly two extension articles are required');
const seen = new Set();
const results = [];
for (const article of gate.articles) {
  if (!['6A', '6B'].includes(article.articleKey)) fail(`unsupported articleKey ${article.articleKey}`);
  if (seen.has(article.articleKey)) fail(`duplicate articleKey ${article.articleKey}`);
  seen.add(article.articleKey);
  if (!Number.isInteger(article.minimumExistingFootnoteDefinitions) || article.minimumExistingFootnoteDefinitions < 1) fail(`${article.articleKey} invalid minimumExistingFootnoteDefinitions`);
  if (!Number.isInteger(article.targetClaimLevelFootnoteGroups) || article.targetClaimLevelFootnoteGroups < 1) fail(`${article.articleKey} invalid targetClaimLevelFootnoteGroups`);
  if (!/^GEN6-ENOCH-6[AB]-.+-LIX$/.test(article.researchDocumentId || '')) fail(`${article.articleKey} invalid Research document id`);
  if (article.status !== 'claim-level-source-pass-complete') fail(`${article.articleKey} status must be claim-level-source-pass-complete`);
  if (!Array.isArray(article.requiredFootnoteIds) || article.requiredFootnoteIds.length < article.targetClaimLevelFootnoteGroups) fail(`${article.articleKey} requiredFootnoteIds incomplete`);
  const file = path.join(ROOT, 'src/content/articles', `${article.slug}.mdx`);
  if (!fs.existsSync(file)) { fail(`${article.articleKey} missing article file ${article.slug}.mdx`); continue; }
  const source = fs.readFileSync(file, 'utf8');
  const definitions = collect(source, /^\[\^([^\]]+)\]:/gm);
  const references = collect(source, /\[\^([^\]]+)\](?!:)/g);
  const uniqueDefinitions = new Set(definitions);
  const uniqueReferences = new Set(references);
  const required = new Set(article.requiredFootnoteIds);
  if (frontmatterValue(source, 'slug') !== article.slug) fail(`${article.articleKey} slug drift`);
  if (frontmatterValue(source, 'series') !== 'genesis-6') fail(`${article.articleKey} series drift`);
  if (gate.policy?.requireDraft && frontmatterValue(source, 'draft') !== true) fail(`${article.articleKey} must remain draft`);
  if (gate.policy?.requireNoindex && frontmatterValue(source, 'noindex') !== true) fail(`${article.articleKey} must remain noindex`);
  if (gate.policy?.requireSourcesRequired && frontmatterValue(source, 'sourcesRequired') !== true) fail(`${article.articleKey} must require sources`);
  if (gate.policy?.failOnFootnoteRegression && definitions.length < article.minimumExistingFootnoteDefinitions) fail(`${article.articleKey} footnote definitions regressed: ${definitions.length} < ${article.minimumExistingFootnoteDefinitions}`);
  if (uniqueDefinitions.size !== definitions.length) fail(`${article.articleKey} contains duplicate footnote definitions`);
  if (new Set(article.requiredFootnoteIds).size !== article.requiredFootnoteIds.length) fail(`${article.articleKey} requiredFootnoteIds contains duplicates`);
  for (const id of required) {
    if (!uniqueDefinitions.has(id)) fail(`${article.articleKey} missing required definition [^${id}]`);
    if (!uniqueReferences.has(id)) fail(`${article.articleKey} missing claim reference [^${id}]`);
  }
  if (gate.policy?.requireExactDefinitionSet) for (const id of uniqueDefinitions) if (!required.has(id)) fail(`${article.articleKey} unexpected definition [^${id}]`);
  if (gate.policy?.requireEveryDefinitionReferenced) for (const id of uniqueDefinitions) if (!uniqueReferences.has(id)) fail(`${article.articleKey} unreferenced definition [^${id}]`);
  const targetMet = definitions.length >= article.targetClaimLevelFootnoteGroups;
  if (!gate.policy?.allowDraftBelowTarget && !targetMet) fail(`${article.articleKey} target not met: ${definitions.length} < ${article.targetClaimLevelFootnoteGroups}`);
  results.push({ articleKey: article.articleKey, definitions: definitions.length, references: references.length, target: article.targetClaimLevelFootnoteGroups, targetMet });
}
if ([...seen].sort().join(',') !== '6A,6B') fail('article keys must be exactly 6A and 6B');
if (!process.exitCode) {
  const detail = results.map((item) => `${item.articleKey} ${item.definitions}/${item.target} target-met (${item.references} references)`).join(', ');
  console.log(`Genesis 6 Enoch footnote gate: PASS (${detail}; release blocked pending separate publication transaction)`);
}
'''


def write_product() -> None:
    require_exact_blobs()
    if OUT.exists(): shutil.rmtree(OUT)
    product = {
        'src/content/articles/kniga-enoha-kotoroy-ne-bylo-kak-raznye-proizvedeniya-stali-korpusom.mdx': patch_6a(ARTICLE_6A.read_text(encoding='utf-8')),
        'src/content/articles/mozhno-li-doveryat-1-enohu-kanonicheskiy-audit.mdx': patch_6b(ARTICLE_6B.read_text(encoding='utf-8')),
        'data/genesis6-enoch-footnote-gates.json': json.dumps(NEW_GATE, ensure_ascii=False, indent=2) + '\n',
        'scripts/genesis6-enoch-footnote-gate.mjs': NEW_GATE_SCRIPT,
    }
    manifest = {'baseCommit': 'd469cd2a697fd5d70c2df877ef625bc8f0bfecb8', 'files': []}
    for relative, content in product.items():
        target = OUT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding='utf-8', newline='')
        data = target.read_bytes()
        manifest['files'].append({'path': relative, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'gitBlob': subprocess.check_output(['git', 'hash-object', str(target)], cwd=ROOT, text=True).strip()})
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    shadow = OUT / '_validation-root'
    shadow.mkdir(parents=True, exist_ok=True)
    for relative in product:
        source = OUT / relative
        destination = shadow / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    subprocess.run(['node', str(shadow / 'scripts/genesis6-enoch-footnote-gate.mjs')], cwd=shadow, check=True)
    shutil.rmtree(shadow)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    write_product()
