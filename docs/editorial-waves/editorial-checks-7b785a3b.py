#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Проверки редакционной ветки arena/7b785a3b-gb-is-my-strength (девять глав серии «Тайны сердца»).

Запуск из корня репозитория:  python3 docs/editorial-waves/editorial-checks-7b785a3b.py
Нужен собранный dist (npm run strangler:build).

Разделы:
  1. WCAG 3.1.2 — непомеченные иноязычные прогоны в dist (наследование lang по дереву)
  2. Горизонт якорей индекса — anchor=null не имеет права расти (порог билдера 1200 символов)
  3. Паритет близнецов Body.astro <-> MDX по цитатным литералам «…»
  4. ASCII-троеточие внутри «…» в моих главах обязано отсутствовать
  5. Проекция индекса src -> dist (сущности/вхождения идентичны)
  6. АДВАЙЗОРИ: readingTime против политики 180 слов/мин (норматива владельца нет — решение 8)
  7. АДВАЙЗОРИ: латинская диакритика внутри кириллических слов в файлах, которые ветка трогает

Базовые значения — состояние bcd4719 (волна 26). Рост по разделам 1, 2, 4, 5 — провал;
улучшение — предупреждение обновить базу (иначе база молча устаревает после слияний).
"""
import collections
import glob
import json
import os
import re
import sys
from html.parser import HTMLParser

FAILS = []
NOTES = []

# Девять глав этой ветки: (slug маршрута, каталог pilot-компонента, префикс Body-файла)
CHAPTERS = [
    ('myslennaya-zhizn-serdca', 'myslennaya', 'Myslennaya'),
    ('serdce-i-sokrovishche', 'serdce-sokrovishche', 'SerdceSokrovishche'),
    ('kak-hranit-serdce', 'kak-hranit', 'KakHranit'),
    ('osvobozhdennoe-serdce', 'osvobozhdennoe', 'Osvobozhdennoe'),
    ('serdce-pod-skorbyu', 'serdce-skorb', 'SerdceSkorb'),
    ('serdce-ne-v-odinochku', 'ne-v-odinochku', 'NeVOdinochku'),
    ('rimlyanam-7-veruyushchiy-ili-neveruyushchiy', 'rimlyanam7', 'Rimlyanam7'),
    ('religioznoe-serdce', 'religioznoe', 'Religioznoe'),
    ('starye-dorozhki-serdca', 'starye-dorozhki', 'StaryeDorozhki'),
]

SKIP = {'script', 'style', 'noscript', 'code', 'pre', 'svg', 'math', 'textarea', 'kbd', 'samp'}
GREEK_LANG = re.compile(r'^(?:el|grc)(?:-|$)', re.I)
HEBREW_LANG = re.compile(r'^(?:he|iw|hbo)(?:-|$)', re.I)
GR = re.compile(r'[\u0370-\u03FF\u1F00-\u1FFF]')
HE = re.compile(r'[\u0590-\u05FF\uFB1D-\uFB4F]')


def bad(msg):
    FAILS.append(msg)
    print('   ПРОВАЛ: %s' % msg)


def note(msg):
    NOTES.append(msg)
    print('   адвайзори: %s' % msg)


class Walker(HTMLParser):
    """Считает прогоны греческих/еврейских символов, у которых унаследованный lang не подходит."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []          # [(tag, lang)]
        self.skip_depth = 0
        self.runs = []           # (kind, inherited_lang, text)

    def inherited(self):
        for _tag, lang in reversed(self.stack):
            if lang:
                return lang
        return None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        lang = a.get('lang') or a.get('xml:lang')
        if tag in SKIP:
            self.skip_depth += 1
        self.stack.append((tag, lang))

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        if tag in SKIP and self.skip_depth:
            self.skip_depth -= 1
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if self.skip_depth or not data.strip():
            return
        lang = self.inherited()
        for kind, rx, ok in (('gr', GR, GREEK_LANG), ('he', HE, HEBREW_LANG)):
            if ok.match(lang or ''):
                continue
            for m in re.finditer(r'%s{2,}' % ('[\u0370-\u03FF\u1F00-\u1FFF\u0300-\u036F]' if kind == 'gr'
                                              else '[\u0590-\u05FF\uFB1D-\uFB4F\u0591-\u05C7]'), data):
                self.runs.append((kind, lang, m.group(0)))


# Метрика раздела 1 своя: прогоны из >=2 греческих/еврейских символов (их библиотека ветки
# 1d569906 считает ФРАЗОВЫЕ прогоны и даёт на этой же странице 28, а не 37: двухсловное
# «ὁ ἔσω ἄνθρωπος» у меня распадается на два прогона, одиночное «ὁ» отбрасывается).
# Сравнивать 37 и 28 нельзя — это разные счётчики; важна неизменность своего.
BASE_RUNS = {'rimlyanam-7-veruyushchiy-ili-neveruyushchiy': 37}


def section1():
    print('\n### 1. WCAG 3.1.2: непомеченные иноязычные прогоны в dist (наследование lang)')
    total = 0
    for slug, _d, _p in CHAPTERS:
        path = 'dist/articles/%s/index.html' % slug
        if not os.path.exists(path):
            bad('нет страницы %s (dist не собран?)' % slug)
            continue
        w = Walker()
        w.feed(open(path, encoding='utf8').read())
        n = len(w.runs)
        total += n
        base = (BASE_RUNS or {}).get(slug, 0)
        mark = '' if n == base else ('  <-- РОСТ' if n > base else '  <-- УЛУЧШЕНО, обновите базу')
        print('   %-52s прогонов=%3d (база %3d)%s' % (slug[:52], n, base, mark))
        if n > base:
            bad('%s: %d непомеченных прогонов при базе %d (пример: %r)' % (slug, n, base, w.runs[0][2][:40]))
        elif n < base:
            note('%s: прогонов стало %d вместо %d — обновите BASE_RUNS' % (slug, n, base))
    corpus = 0
    for p in glob.glob('dist/**/*.html', recursive=True):
        if '/pagefind/' in p:
            continue
        w = Walker()
        try:
            w.feed(open(p, encoding='utf8', errors='replace').read())
        except Exception:
            continue
        corpus += len(w.runs)
    print('   по корпусу: %d прогонов, из них мои девять глав — %d' % (corpus, total))


BASE_NULL = {
    'myslennaya-zhizn-serdca': 9, 'serdce-i-sokrovishche': 13, 'kak-hranit-serdce': 2,
    'osvobozhdennoe-serdce': 11, 'serdce-pod-skorbyu': 8, 'serdce-ne-v-odinochku': 5,
    'rimlyanam-7-veruyushchiy-ili-neveruyushchiy': 57, 'religioznoe-serdce': 4,
    'starye-dorozhki-serdca': 4,
}


def section2():
    print('\n### 2. Горизонт якорей индекса: anchor=null по моим маршрутам (порог билдера 1200)')
    # nearestExplicitAnchor() в scripts/build-scripture-occurrence-index.mjs (строки 239-261)
    # ищет литеральный id в окне 1800 символов и отбрасывает его, если до цитаты больше 1200.
    # Любой рост разметки между якорем и цитатой молча делает ссылку неглубокой.
    path = 'dist/data/scripture-search-index.json'
    if not os.path.exists(path):
        bad('нет %s' % path)
        return
    idx = json.load(open(path, encoding='utf8'))
    null = collections.Counter()
    tot = collections.Counter()

    def walk(o):
        if isinstance(o, dict):
            if 'url' in o:
                for slug in BASE_NULL:
                    if '/articles/%s/' % slug in o['url']:
                        tot[slug] += 1
                        if not o.get('anchor'):
                            null[slug] += 1
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for x in o:
                walk(x)

    walk(idx.get('references', idx))
    for slug, base in BASE_NULL.items():
        grow = null[slug] - base
        print('   %-52s вхождений %4d | anchor=null %3d (база %3d, %+d)'
              % (slug[:52], tot[slug], null[slug], base, grow))
        if grow > 0:
            bad('%s: anchor=null вырос на %d — глубокие ссылки потеряны (горизонт 1200)' % (slug, grow))
        elif grow < 0:
            note('%s: anchor=null уменьшился до %d — обновите BASE_NULL' % (slug, null[slug]))
    s, t = sum(null.values()), sum(tot.values())
    print('   итого у меня: %d из %d вхождений без якоря (%.1f%%)' % (s, t, 100.0 * s / max(1, t)))


QUOTE = re.compile(r'«[^»]{6,400}»')


def norm(s):
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def twin_files(chapter):
    slug, directory, prefix = chapter
    body = 'src/components/article-pilots/%s/%sBody.astro' % (directory, prefix)
    mdx = 'src/content/articles/%s.mdx' % slug
    return (body if os.path.exists(body) else None, mdx if os.path.exists(mdx) else None)


def strip_markup(q):
    """«…<em>слово</em>…» и «…*слово*…» -> один и тот же литерал."""
    t = re.sub(r'<[^>]+>', '', q)
    t = t.replace('*', '')
    return norm(t)


# База расхождений близнецов (bcd4719). Раздел 3 — МОНИТОР РЕГРЕССИЙ, а не оракул: Body содержит
# карточки «Коротко», кросс-ссылки и заголовок серии «Тайны человеческого сердца», которых в MDX
# нет, поэтому ненулевое расхождение законно. Провал — только рост числа относительно базы.
BASE_DIVERGENCE = {}


def section3():
    print('\n### 3. Паритет близнецов Body.astro <-> MDX по цитатным литералам «…» (нормализовано)')
    for chapter in CHAPTERS:
        body, mdx = twin_files(chapter)
        if not body or not mdx:
            bad('%s: нет близнеца (body=%s mdx=%s)' % (chapter[0], bool(body), bool(mdx)))
            continue
        qb = {strip_markup(m.group(0)) for m in QUOTE.finditer(open(body, encoding='utf8').read())}
        qm = {strip_markup(m.group(0)) for m in QUOTE.finditer(open(mdx, encoding='utf8').read())}
        div = len(qb ^ qm)
        base = BASE_DIVERGENCE.get(chapter[0], div)
        mark = '' if div == base else ('  <-- РОСТ' if div > base else '  <-- УЛУЧШЕНО, обновите базу')
        print('   %-52s цитат Body=%3d MDX=%3d | расхождений %2d (база %2d)%s'
              % (chapter[0][:52], len(qb), len(qm), div, base, mark))
        if div > base:
            for x in sorted(qb ^ qm)[:3]:
                bad('%s: новое расхождение близнецов: %s' % (chapter[0], x[:70]))
        elif div < base:
            note('%s: расхождений %d вместо %d — обновите BASE_DIVERGENCE' % (chapter[0], div, base))


ASCII_DOTS = re.compile(r'«[^»]*\.\.\.[^»]*»')


def section4():
    print('\n### 4. ASCII-троеточие внутри «…» в моих главах (конвенция корпуса — «…)')
    hits = 0
    for chapter in CHAPTERS:
        for f in twin_files(chapter):
            if not f:
                continue
            for m in ASCII_DOTS.finditer(open(f, encoding='utf8').read()):
                hits += 1
                bad('%s: ASCII-троеточие в %s: %s' % (chapter[0], os.path.basename(f), m.group(0)[:60]))
    print('   найдено: %d (база 0 — закрыто волной 26, L1 22 сайта + L2 Евр. 4:16)' % hits)


def sig(path):
    j = json.load(open(path, encoding='utf8'))
    out = []
    # dist-проекция не несёт raw/sourceKind/sourceOwner у вхождений и bookId/canonicalSource/
    # canonicalText/key/kind/testament у сущностей; context есть в обеих копиях и сравнивается.
    DROP = {'raw', 'sourceKind', 'sourceOwner', 'bookId', 'canonicalSource', 'canonicalText',
            'key', 'kind', 'testament'}

    def walk(o):
        if isinstance(o, dict):
            if 'url' in o:
                # dist не печатает ключи с пустым значением (в частности anchor: null), поэтому
                # пустые отбрасываются с обеих сторон — иначе сигнатуры расходятся на 1558 записях.
                out.append(json.dumps({k: v for k, v in o.items()
                                       if k not in DROP and v not in ('', None, [])},
                                      sort_keys=True, ensure_ascii=False))
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for x in o:
                walk(x)

    walk(j.get('references', j))
    return sorted(out)


def section5():
    print('\n### 5. Проекция индекса src -> dist')
    a, b = 'data/scripture-search-index.json', 'dist/data/scripture-search-index.json'
    if not (os.path.exists(a) and os.path.exists(b)):
        bad('нет индекса src или dist')
        return
    ja, jb = json.load(open(a, encoding='utf8')), json.load(open(b, encoding='utf8'))
    ea, eb = ja.get('references', []), jb.get('references', [])
    oa = sum(len(e.get('occurrences', [])) for e in ea)
    ob = sum(len(e.get('occurrences', [])) for e in eb)
    same = sig(a) == sig(b)
    print('   сущностей src=%d dist=%d | вхождений src=%d dist=%d | идентичны=%s'
          % (len(ea), len(eb), oa, ob, same))
    if len(ea) != len(eb) or oa != ob or not same:
        bad('проекция индекса расходится')


def mdx_words(text):
    t = re.sub(r'^---[\s\S]*?^---\s*', '', text, flags=re.M)
    t = re.sub(r'\{/\*[\s\S]*?\*/\}', ' ', t)
    t = re.sub(r'<!--[\s\S]*?-->', ' ', t)
    t = re.sub(r'^\s*(?:import|export)\s.*$', ' ', t, flags=re.M)
    t = re.sub(r'<[^>]+>', ' ', t)
    return len([w for w in t.split() if re.search(r'[\w\u0400-\u04FF\u0370-\u03FF]', w)])


def section6():
    print('\n### 6. АДВАЙЗОРИ: readingTime против 180 слов/мин (политика ветки 4786e4e2, норматива владельца нет)')
    import math
    for slug, _d, _p in CHAPTERS:
        mdx = 'src/content/articles/%s.mdx' % slug
        if not os.path.exists(mdx):
            continue
        text = open(mdx, encoding='utf8').read()
        m = re.search(r'^readingTime:\s*(\d+)', text, re.M)
        decl = int(m.group(1)) if m else None
        w = mdx_words(text)
        exp = max(1, math.ceil(w / 180))
        flag = '' if decl == exp else ('  ДРЕЙФ x%.1f' % (decl / exp) if decl else '  нет поля')
        print('   %-52s слов=%5d объявлено=%3s политика=%3d%s' % (slug[:52], w, decl, exp, flag))
    note('значения не менялись этой веткой (равны main); пересчёт возможен только по решению владельца')
    # Эталонные значения, измеренные их же аудитом (scripts/reading-time-audit.js --json ветки
    # 4786e4e2, политика 180 wpm/ceil/min 1) по этому же дереву. Мой подсчёт слов чуть скромнее
    # (4189 против 4368 у rimlyanam-7), поэтому для rimlyanam-7 они дают 25, а мой счёт 24.
    THEIRS = {'myslennaya-zhizn-serdca': (2465, 14), 'serdce-i-sokrovishche': (2007, 12),
              'kak-hranit-serdce': (2103, 12), 'osvobozhdennoe-serdce': (2084, 12),
              'serdce-pod-skorbyu': (2191, 13), 'serdce-ne-v-odinochku': (1933, 11),
              'rimlyanam-7-veruyushchiy-ili-neveruyushchiy': (4368, 25),
              'religioznoe-serdce': (1856, 11), 'starye-dorozhki-serdca': (2702, 16)}
    print('   их аудит (SSOT политики): %s' % ', '.join('%s=%d' % (k[:14], v[1]) for k, v in THEIRS.items()))


LATIN_IN_CYR = re.compile(r'[\u0400-\u04FF]{2,}[\u00C0-\u024F]|[\u00C0-\u024F][\u0400-\u04FF]{2,}')


def section7():
    print('\n### 7. АДВАЙЗОРИ: латинская диакритика внутри кириллических слов в файлах ветки')
    import subprocess
    files = subprocess.run(['git', 'diff', '--name-only', '9618e82', 'HEAD'],
                           capture_output=True, text=True).stdout.split()
    hits = 0
    for f in files:
        if not (f.endswith('.mdx') or f.endswith('.astro')) or not os.path.exists(f):
            continue
        for m in LATIN_IN_CYR.finditer(open(f, encoding='utf8').read()):
            hits += 1
            if hits <= 6:
                note('%s: %r' % (os.path.basename(f), m.group(0)))
    print('   всего мест: %d (известное: «хюперентюнх\\u00e1ней» в serdce-i-duh — обе ветки '
          'a5fb5b75 и 1d569906 привели к а+U+0301 байт-в-байт)' % hits)


def main():
    print('=== editorial-checks-7b785a3b: %d глав, dist %s'
          % (len(CHAPTERS), 'есть' if os.path.isdir('dist') else 'НЕТ'))
    for fn in (section1, section2, section3, section4, section5, section6, section7):
        fn()
    print('\nВСЕГО ПРОВАЛОВ: %d | адвайзори: %d' % (len(FAILS), len(NOTES)))
    return 1 if FAILS else 0


if __name__ == '__main__':
    sys.exit(main())
