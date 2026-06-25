#!/usr/bin/env python3
"""
convert-fc-to-gb.py v2 — миграция fc-* классов → gb-* в root HTML.

Типы:
  A) Series-lite (antisovetov): fc-series-lite → замена на gb-floater--series-lite
  B) Single (kod-da-vinchi): fc-single → замена на gb-floater
  C) Gill series (6 files): fc-* regex class="", gbs2-* не трогать
"""

import re, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS_HREF = '../../css/floating-cluster.css'
CSS_VER = 'INITIAL'

FILES_GILL = [
    'articles/dzhon-gill-istoricheskiy-kontekst/index.html',
    'articles/dzhon-gill-chast-1-chelovek/index.html',
    'articles/dzhon-gill-chast-2-uchenyi/index.html',
    'articles/dzhon-gill-chast-3-nasledie/index.html',
    'articles/dzhon-gill-spravochnik/index.html',
]

SINGLE_CLUSTER = """<div id="gbFloatingControls" class="gb-floater" data-fc-root data-fc-variant="article" role="group" aria-label="Быстрые действия статьи">
<button type="button" class="gb-icon gb-theme-toggle" data-fc-action="theme" aria-label="Тема" aria-pressed="false">
<span class="theme-icon-sun" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg></span>
<span class="theme-icon-moon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></span>
</button>
<button type="button" class="gb-icon" data-fc-action="search" aria-label="Поиск">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
</button>
<button type="button" class="gb-ember" data-state="idle" style="--p:0;--ember-size:36px;--ring-color:var(--color-accent,#7a2e2e)" data-fc-action="play" aria-label="Озвучка" aria-disabled="true">
<svg class="gb-ember__ring-svg" viewBox="0 0 100 100" aria-hidden="true"><circle class="gb-ember__ring-track" cx="50" cy="50" r="45"/><circle class="gb-ember__ring-progress" cx="50" cy="50" r="45"/></svg>
<svg class="gb-ember__glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.8v14.4L18.5 12 7 4.8z"/></svg>
<svg class="gb-ember__pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg>
<svg class="gb-ember__check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.1L19 7"/></svg>
</button>
<button type="button" class="gb-save" data-fc-action="save" aria-label="Сохранить" aria-pressed="false">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
</button>
</div>"""

SERIES_LITE_PASTOR = """<div id="gbFloatingControls" class="gb-floater gb-floater--series-lite gb-floater--pastor" data-fc-root data-fc-mode="series-lite" data-fc-variant="pastor" data-fc-series="pastor-series" role="group" aria-label="Действия серии «Тёмная сторона кафедры»">
<a class="gb-series-chip" href="/pastor-series/" aria-label="Открыть серию «Тёмная сторона кафедры»">
<span class="gb-series-chip__eyebrow">Серия</span>
<span class="gb-series-chip__title">Тёмная сторона кафедры</span>
</a>
<div class="gb-series-controls">
<span class="gb-series-index" aria-label="Часть I">I</span>
<button type="button" class="gb-icon gb-theme-toggle" data-fc-action="theme" aria-label="Тема" aria-pressed="false">
<span class="theme-icon-sun" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg></span>
<span class="theme-icon-moon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></span>
</button>
<button type="button" class="gb-icon" data-fc-action="search" aria-label="Поиск">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
</button>
<button type="button" class="gb-ember" data-state="idle" style="--p:0;--ember-size:36px;--ring-color:var(--color-accent,#7a2e2e)" data-fc-action="play" aria-label="Озвучка" aria-disabled="true">
<svg class="gb-ember__ring-svg" viewBox="0 0 100 100" aria-hidden="true"><circle class="gb-ember__ring-track" cx="50" cy="50" r="45"/><circle class="gb-ember__ring-progress" cx="50" cy="50" r="45"/></svg>
<svg class="gb-ember__glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.8v14.4L18.5 12 7 4.8z"/></svg>
<svg class="gb-ember__pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg>
<svg class="gb-ember__check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.1L19 7"/></svg>
</button>
<button type="button" class="gb-save" data-fc-action="save" aria-label="Сохранить" aria-pressed="false">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
</button>
</div>
</div>"""


def add_css_link(html):
    if CSS_HREF in html:
        return html
    link = '<link rel="stylesheet" href="%s?v=%s">' % (CSS_HREF, CSS_VER)
    return html.replace('</head>', link + '\n</head>')


def replace_gb_floating_block(html):
    """Replace ANY gbFloatingControls block (single or series-lite) by tracking exact <div> nesting."""
    if 'gbFloatingControls' not in html:
        return html, None

    idx = html.index('id="gbFloatingControls"')
    tag_start = html.rfind('<div', 0, idx)
    if tag_start < 0:
        return html, None

    # Determine the type: series-lite or single
    context = html[idx:idx + 300]
    is_series_lite = 'fc-series-lite' in context or 'data-fc-mode="series-lite"' in context

    # Find the closing </div> for the gbFloatingControls div by counting nesting
    # Start counting from the opening <div (tag_start)
    open_div = 0
    i = tag_start
    while i < len(html):
        if html[i:i+4] == '<div' and not html[i+4:i+5].isspace():
            i += 4
            continue
        if html[i:i+4] == '<div':
            open_div += 1
            i += 4
        elif html[i:i+6] == '</div>':
            open_div -= 1
            if open_div == 0:
                block_end = i + 6
                break
            i += 6
        else:
            i += 1
    else:
        return html, None  # malformed

    old_block = html[tag_start:block_end]
    new_block = SERIES_LITE_PASTOR if is_series_lite else SINGLE_CLUSTER

    result = html[:tag_start] + '\n' + new_block + '\n' + html[block_end:]
    return result, ('series-lite' if is_series_lite else 'single')


def replace_gill_classes(html):
    """Replace fc-* classes in class="" for Gill series files."""

    def _replace_class_content(content):
        content = content.replace('fc-mobile-actions', '')
        content = content.replace('fc-rail', '')
        content = content.replace('fc-series', '')
        content = content.replace('fc-rfoot', '')
        content = content.replace('fc-home', '')
        content = content.replace('fc-offline', '')
        content = content.replace('fc-theme-toggle', 'gb-theme-toggle')
        content = content.replace('fc-button', '')
        content = content.replace('fc-font', 'gb-font-size')
        content = content.replace('fc-play-ember__ring', '')
        content = content.replace('fc-play-ember__icon', '')
        content = content.replace('--play', 'gb-ember__glyph')
        content = content.replace('--pause', 'gb-ember__pause')
        content = content.replace('--spark', 'gb-ember__check')
        content = content.replace('fc-play-ember', 'gb-ember')
        content = content.replace('fc-save', 'gb-save')
        content = content.replace('fc-theme-toggle__sun', 'theme-icon-sun')
        content = content.replace('fc-theme-toggle__moon', 'theme-icon-moon')
        content = content.replace('fc-root', '')
        content = content.replace('fc-single--article', '')
        content = content.replace('fc-single', '')
        # Remove any remaining fc-* class
        content = re.sub(r'\bfc-[\w-]+\b', '', content)
        content = re.sub(r'\s{2,}', ' ', content).strip()
        return content

    # Double-quoted
    html = re.sub(r'class="([^"]*)"', lambda m: 'class="%s"' % _replace_class_content(m.group(1)) if _replace_class_content(m.group(1)) else '', html)
    # Single-quoted
    html = re.sub(r"class='([^']*)'", lambda m: "class='%s'" % _replace_class_content(m.group(1)) if _replace_class_content(m.group(1)) else '', html)
    # Remove empty class=""
    html = re.sub(r"""\sclass=""", '', html)
    html = re.sub(r' class=""', '', html)
    html = re.sub(r' class=\'\'', '', html)
    html = re.sub(r'\s{2,}', ' ', html)
    return html


def verify_no_fc_classes(html, name):
    classes = re.findall(r'class="([^"]*)"', html)
    for c in classes:
        fcs = re.findall(r'\bfc-[\w-]+\b', c)
        if fcs:
            print('  ⚠️  %s: fc- classes remain: %s' % (name, fcs))
            return False
    return True


def process_file(rel_path, file_type='auto'):
    full = os.path.join(ROOT, rel_path)
    with open(full, 'r', encoding='utf-8') as f:
        html = f.read()
    orig = html

    if file_type == 'gill':
        html = replace_gill_classes(html)
        html = add_css_link(html)
    elif file_type in ('single', 'series-lite'):
        html, typ = replace_gb_floating_block(html)
        if typ:
            html = add_css_link(html)
    else:  # auto
        if 'fc-series-lite' in html or 'data-fc-mode="series-lite"' in html:
            html, typ = replace_gb_floating_block(html)
            if typ:
                html = add_css_link(html)
        elif 'fc-single' in html:
            html, typ = replace_gb_floating_block(html)
            if typ:
                html = add_css_link(html)

    if html == orig:
        print('  ⏭️  %s' % rel_path)
        return

    with open(full, 'w', encoding='utf-8') as f:
        f.write(html)
    print('  ✅ %s' % rel_path)

    v = verify_no_fc_classes(html, rel_path)
    if not v:
        sys.exit(1)


def main():
    print()
    print('=== Конвертация fc-* → gb-* ===')
    print()

    # Series-lite (antisovetov)
    print('A: Series-lite')
    process_file('articles/20-antisovetov-pastoru/index.html', 'auto')

    # Single (kod-da-vinchi)
    print('B: Single')
    process_file('articles/kod-da-vinchi/index.html', 'auto')

    # Gill series
    print('C: Gill series')
    for f in FILES_GILL:
        process_file(f, 'gill')

    print()
    print('=== Готово ===')


if __name__ == '__main__':
    main()
