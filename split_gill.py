#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
split_gill.py — Разделение биографии Джона Гилла на 3 самостоятельные статьи.
Часть I. Человек | Часть II. Учёный | Часть III. Наследие
"""

import os
import re
import json
from bs4 import BeautifulSoup, NavigableString

SRC = 'articles/dzhon-gill-1697-1771/index.html'

def read_html():
    with open(SRC, 'r', encoding='utf-8') as f:
        return f.read()

def get_sections(soup):
    """Извлекает секции (h2/h3 + следующий контент) из article-body."""
    article = soup.find('article', class_='article-body')
    if not article:
        raise ValueError('article-body not found')

    sections = []
    current_heading = None
    current_nodes = []

    for node in article.children:
        if getattr(node, 'name', None) in ('h2', 'h3'):
            if current_heading:
                sections.append((current_heading, current_nodes))
            current_heading = node
            current_nodes = []
        elif current_heading is not None:
            current_nodes.append(node)
        else:
            # Контент ДО первого h2/h3 — вводная секция
            if sections and sections[0][0] is None:
                sections[0][1].append(node)
            else:
                sections.insert(0, (None, [node]))

    if current_heading:
        sections.append((current_heading, current_nodes))

    return sections, article

def heading_id(heading):
    if not heading:
        return '__intro__'
    return heading.get('id', '') or heading.get_text(strip=True)[:40]

def heading_text(heading):
    if not heading:
        return '__intro__'
    return heading.get_text(strip=True)

# Маппинг: какой h3-ид принадлежит к какой части
PART_III_H3 = {
    'sec-controversy', 'sec-rare-episodes', 'sec-spouse',
    'sec-disciples', 'sec-america', 'sec-chain',
    'sec-contemporaries', 'sec-sources', 'sec-legacy',
    'sec-whiston-bayly', 'sec-brown-gift', 'sec-spurgeon-1859',
    'sec-baptism-method', 'sec-toplady-memoir', 'sec-gill-islam-detail',
    'sec-gill-brown-atlantic', 'sec-ordination-rippon', 'sec-hymnology',
    'sec-gill-last-pages', 'sec-gill-rippon-ocean', 'sec-gill-muller-rediscovery',
    'sec-nettles', 'sec-hypercalv-deep', 'sec-spurgeon-commentary',
    'sec-toplady-poem', 'sec-anecdotes-misc', 'sec-anne-dutton',
    'sec-discipline-generation', 'sec-terms'
}

PART_II_H3 = {
    'sec-dd', 'sec-hebrew-diss', 'sec-ordinances', 'sec-eschatology',
    'sec-love', 'sec-kennicon', 'sec-commentary', 'sec-habakkuk',
    'sec-systematics', 'sec-pactum', 'sec-ecclesiology', 'sec-whitby',
    'sec-pastoral', 'sec-deism-polemic', 'sec-pactum-salutis',
    'sec-gill-catholicity', 'sec-ordo-salutis', 'sec-aberdeen-details',
    'sec-gill-solter'
}

PART_I_H3 = {
    'sec-intro', 'sec-birth-prophecy', 'sec-education', 'sec-conversion',
    'sec-pastor', 'sec-illness-family', 'sec-evangelism',
    'sec-goatyardDecl', 'sec-daughter-sermon', 'sec-family-deep',
    'sec-ordination-1720', 'sec-personal-credo', 'sec-context-southwark',
    'sec-last-words-wife', 'sec-skepp-detail'
}

def classify_section(heading, prev_part=None):
    """Определяет, к какой части относится секция."""
    if heading is None:
        return 1  # intro -> Part I

    hid = heading.get('id', '')
    htext = heading.get_text(strip=True)

    # По id h3
    if hid in PART_I_H3:
        return 1
    if hid in PART_II_H3:
        return 2
    if hid in PART_III_H3:
        return 3

    # По тексту h2
    if 'I. Становление' in htext or 'II. Пасторское' in htext:
        return 1
    if 'III. Богословские' in htext or 'IV. Полемика' in htext:
        return 2
    if 'V. Историческое влияние' in htext:
        return 3

    # fallback: следуем за предыдущей частью
    return prev_part or 3

def build_new_article(soup, article, sections, target_part, meta):
    # Очищаем article и наполняем своими секциями
    for child in list(article.children):
        child.extract()

    for heading, nodes in sections:
        # Восстанавливаем heading
        if heading:
            article.append(heading)
        for node in nodes:
            article.append(node)

    # Обновляем метатеги
    title_tag = soup.find('title')
    if title_tag:
        title_tag.string = meta['title']

    desc = soup.find('meta', attrs={'name': 'description'})
    if desc:
        desc['content'] = meta['description']

    og_title = soup.find('meta', property='og:title')
    if og_title:
        og_title['content'] = meta['title']

    og_desc = soup.find('meta', property='og:description')
    if og_desc:
        og_desc['content'] = meta['description']

    og_url = soup.find('meta', property='og:url')
    if og_url:
        og_url['content'] = meta['canonical']

    canonical = soup.find('link', rel='canonical')
    if canonical:
        canonical['href'] = meta['canonical']

    # JSON-LD
    for script in soup.find_all('script', type='application/ld+json'):
        try:
            data = json.loads(script.string)
            if isinstance(data, dict) and data.get('@type') == 'NewsArticle':
                data['headline'] = meta['title']
                data['url'] = meta['canonical']
                data['description'] = meta['description']
                data['dateModified'] = '2026-05-30T22:00:00+03:00'
                script.string = json.dumps(data, ensure_ascii=False, indent=2)
        except Exception:
            pass

    # Обновляем навигацию в шапке
    nav = soup.find('nav', class_='article-nav')
    if nav:
        nav.clear()
        nav.append(BeautifulSoup(meta['breadcrumbs'], 'html.parser'))

    return str(soup)

def main():
    raw = read_html()
    soup = BeautifulSoup(raw, 'lxml')

    sections, article = get_sections(soup)

    # Классифицируем
    classified = []
    current_part = 1
    for heading, nodes in sections:
        part = classify_section(heading, current_part)
        current_part = part
        classified.append((part, heading, nodes))

    # Распечатаем диагностику
    for part, heading, nodes in classified:
        htext = heading_text(heading) if heading else 'INTRO'
        print(f'Part {part}: {htext[:60]}')

    # Создаём директории
    dirs = {
        1: 'articles/dzhon-gill-chast-1-chelovek',
        2: 'articles/dzhon-gill-chast-2-uchenyi',
        3: 'articles/dzhon-gill-chast-3-nasledie'
    }

    metas = {
        1: {
            'title': 'Джон Гилл (1697–1771). Часть I: Человек — детство, призвание, семья',
            'description': 'Первая часть трилогии о лондонском пасторе XVIII века: от рождения в Кетеринге до формирования характера. Детство, самообразование, обращение 1716 года, рукоположение, семья и Декларация 1729.',
            'canonical': 'https://gospod-bog.ru/articles/dzhon-gill-chast-1-chelovek/',
            'reading_time': '≈ 18 минут',
            'breadcrumbs': '''<ol class="breadcrumbs" itemscope itemtype="https://schema.org/BreadcrumbList">
  <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><a href="/" itemprop="item"><span itemprop="name">Главная</span></a><meta itemprop="position" content="1"/></li>
  <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><a href="/biografii/" itemprop="item"><span itemprop="name">Биографии</span></a><meta itemprop="position" content="2"/></li>
  <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><span itemprop="name">Гилл I. Человек</span><meta itemprop="position" content="3"/></li>
</ol>'''
        },
        2: {
            'title': 'Джон Гилл (1697–1771). Часть II: Учёный — экзегеза, система, иврит',
            'description': 'Вторая часть трилогии о лондонском пасторе: раввинистика, девятитомный комментарий на всю Библию, учение о Троице, полемика с деизмом и монументальный Свод богословия 1769 года.',
            'canonical': 'https://gospod-bog.ru/articles/dzhon-gill-chast-2-uchenyi/',
            'reading_time': '≈ 21 минута',
            'breadcrumbs': '''<ol class="breadcrumbs" itemscope itemtype="https://schema.org/BreadcrumbList">
  <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><a href="/" itemprop="item"><span itemprop="name">Главная</span></a><meta itemprop="position" content="1"/></li>
  <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><a href="/biografii/" itemprop="item"><span itemprop="name">Биографии</span></a><meta itemprop="position" content="2"/></li>
  <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><span itemprop="name">Гилл II. Учёный</span><meta itemprop="position" content="3"/></li>
</ol>'''
        },
        3: {
            'title': 'Джон Гилл (1697–1771). Часть III: Наследие — полемика, память, наука',
            'description': 'Третья часть трилогии о лондонском пасторе: полемика с Джоном Уэсли, обвинения в гиперкальвинизме, Сперджен как наследник, влияние на Америку, смерть в Бенхилл-Филдс и историческая реабилитация.',
            'canonical': 'https://gospod-bog.ru/articles/dzhon-gill-chast-3-nasledie/',
            'reading_time': '≈ 17 минут',
            'breadcrumbs': '''<ol class="breadcrumbs" itemscope itemtype="https://schema.org/BreadcrumbList">
  <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><a href="/" itemprop="item"><span itemprop="name">Главная</span></a><meta itemprop="position" content="1"/></li>
  <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><a href="/biografii/" itemprop="item"><span itemprop="name">Биографии</span></a><meta itemprop="position" content="2"/></li>
  <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><span itemprop="name">Гилл III. Наследие</span><meta itemprop="position" content="3"/></li>
</ol>'''
        }
    }

    for part_num in (1, 2, 3):
        # Фильтруем секции для этой части
        part_sections = [(h, n) for p, h, n in classified if p == part_num]
        if not part_sections:
            continue

        # Клонируем суп
        part_soup = BeautifulSoup(str(soup), 'lxml')
        part_article = part_soup.find('article', class_='article-body')

        # Очищаем article
        for child in list(part_article.children):
            child.extract()

        # Вставляем секции
        for heading, nodes in part_sections:
            if heading:
                part_article.append(BeautifulSoup(str(heading), 'html.parser'))
            for node in nodes:
                part_article.append(BeautifulSoup(str(node), 'html.parser'))

        # Обновляем мета
        meta = metas[part_num]

        # title
        t = part_soup.find('title')
        if t:
            t.string = meta['title']

        # description meta
        dm = part_soup.find('meta', attrs={'name': 'description'})
        if dm:
            dm['content'] = meta['description']

        # og:title, og:description, og:url
        for prop, val in (('og:title', meta['title']), ('og:description', meta['description']), ('og:url', meta['canonical'])):
            tag = part_soup.find('meta', property=prop)
            if tag:
                tag['content'] = val

        # canonical
        can = part_soup.find('link', rel='canonical')
        if can:
            can['href'] = meta['canonical']

        # article:modified_time
        amm = part_soup.find('meta', property='article:modified_time')
        if amm:
            amm['content'] = '2026-05-30T22:00:00+03:00'

        # JSON-LD Article
        for script in part_soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string)
                if isinstance(data, dict) and data.get('@type') in ('NewsArticle', 'Article'):
                    data['headline'] = meta['title']
                    data['url'] = meta['canonical']
                    data['description'] = meta['description']
                    data['dateModified'] = '2026-05-30T22:00:00+03:00'
                    # Обновляем mainEntityOfPage
                    if 'mainEntityOfPage' in data:
                        data['mainEntityOfPage']['@id'] = meta['canonical']
                    script.string = json.dumps(data, ensure_ascii=False, indent=2)
                elif isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict) and item.get('@type') in ('NewsArticle', 'Article'):
                            item['headline'] = meta['title']
                            item['url'] = meta['canonical']
                            item['description'] = meta['description']
                            item['dateModified'] = '2026-05-30T22:00:00+03:00'
                            if 'mainEntityOfPage' in item:
                                item['mainEntityOfPage']['@id'] = meta['canonical']
                    script.string = json.dumps(data, ensure_ascii=False, indent=2)
            except Exception:
                pass

        # Добавляем навигационный блок между частями в начало article
        nav_block = f'''
<div class="note-box" style="margin: 32px 0 48px; border-left: 4px solid var(--color-accent); padding: 24px 28px;">
  <div style="display:flex; gap: 12px; align-items:flex-start; margin-bottom: 20px;">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; margin-top:2px; color:var(--color-accent);">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/><polyline points="2 17 12 22 22 17"/>
    </svg>
    <div>
      <div style="font-weight:700;font-size:0.7rem;color:var(--color-accent);text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px;">Трилогия о Джоне Гилле</div>
      <p style="margin:0; font-size: 0.95rem; line-height: 1.6; color: var(--color-text-secondary);">
        Биография Джона Гилла — не просто история пастора XVIII века. Это рассказ о беспрецедентной интеллектуальной дисциплине, богословской системе и ярлыках, которые история поспешила повесить на него после смерти. Мы разделили исследование на три самостоятельных текста.
      </p>
    </div>
  </div>
  <div class="grid md:grid-cols-3 gap-4">
    <div style="background:var(--color-surface); border:1px solid {'var(--color-accent)' if part_num==1 else 'var(--color-border)'}; border-radius:8px; padding:16px; display:flex; flex-direction:column; {'opacity:1' if part_num==1 else 'opacity:0.75'}">
      <div style="font-weight:700;font-size:0.6rem;color:var(--color-accent);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Часть I {'<span style="display:inline-block;width:4px;height:4px;background:var(--color-accent);border-radius:50%;margin-left:4px;vertical-align:middle;"></span> Вы здесь' if part_num==1 else ''}</div>
      <h4 style="font-weight:700;font-size:1rem;margin-bottom:4px;color:var(--color-text-primary);">Человек</h4>
      <p style="font-size:0.8rem;color:var(--color-text-secondary);margin:0;flex-grow:1;">От юности в Кетеринге до формирования характера. Детство, призвание, семья, Декларация 1729.</p>
      <div style="margin-top:10px; padding-top:10px; border-top:1px dashed var(--color-border); font-size:0.7rem; color:var(--color-text-muted);">≈ 18 минут чтения</div>
      {'<a href="./" style="display:none;"></a>' if part_num==1 else '<a href="/articles/dzhon-gill-chast-1-chelovek/" style="display:block;margin-top:8px;font-size:0.75rem;color:var(--color-accent);text-decoration:none;font-weight:600;">Читать Часть I →</a>'}
    </div>
    <div style="background:var(--color-surface); border:1px solid {'var(--color-accent)' if part_num==2 else 'var(--color-border)'}; border-radius:8px; padding:16px; display:flex; flex-direction:column; {'opacity:1' if part_num==2 else 'opacity:0.75'}">
      <div style="font-weight:700;font-size:0.6rem;color:{'var(--color-accent)' if part_num==2 else 'var(--color-text-muted)'};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Часть II {'<span style="display:inline-block;width:4px;height:4px;background:var(--color-accent);border-radius:50%;margin-left:4px;vertical-align:middle;"></span> Вы здесь' if part_num==2 else ''}</div>
      <h4 style="font-weight:700;font-size:1rem;margin-bottom:4px;color:var(--color-text-primary);">Учёный</h4>
      <p style="font-size:0.8rem;color:var(--color-text-secondary);margin:0;flex-grow:1;">Экзегеза, раввинистика, 9-томный комментарий, учение о Троице, Свод богословия 1769.</p>
      <div style="margin-top:10px; padding-top:10px; border-top:1px dashed var(--color-border); font-size:0.7rem; color:var(--color-text-muted);">≈ 21 минута чтения</div>
      {'<a href="./" style="display:none;"></a>' if part_num==2 else '<a href="/articles/dzhon-gill-chast-2-uchenyi/" style="display:block;margin-top:8px;font-size:0.75rem;color:var(--color-accent);text-decoration:none;font-weight:600;">Читать Часть II →</a>'}
    </div>
    <div style="background:var(--color-surface); border:1px solid {'var(--color-accent)' if part_num==3 else 'var(--color-border)'}; border-radius:8px; padding:16px; display:flex; flex-direction:column; {'opacity:1' if part_num==3 else 'opacity:0.75'}">
      <div style="font-weight:700;font-size:0.6rem;color:{'var(--color-accent)' if part_num==3 else 'var(--color-text-muted)'};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Часть III {'<span style="display:inline-block;width:4px;height:4px;background:var(--color-accent);border-radius:50%;margin-left:4px;vertical-align:middle;"></span> Вы здесь' if part_num==3 else ''}</div>
      <h4 style="font-weight:700;font-size:1rem;margin-bottom:4px;color:var(--color-text-primary);">Наследие</h4>
      <p style="font-size:0.8rem;color:var(--color-text-secondary);margin:0;flex-grow:1;">Полемика с Уэсли, гиперкальвинизм, Спердген, влияние на Америку, смерть, реабилитация.</p>
      <div style="margin-top:10px; padding-top:10px; border-top:1px dashed var(--color-border); font-size:0.7rem; color:var(--color-text-muted);">≈ 17 минут чтения</div>
      {'<a href="./" style="display:none;"></a>' if part_num==3 else '<a href="/articles/dzhon-gill-chast-3-nasledie/" style="display:block;margin-top:8px;font-size:0.75rem;color:var(--color-accent);text-decoration:none;font-weight:600;">Читать Часть III →</a>'}
    </div>
  </div>
</div>
'''

        # Вставляем НАВИГАЦИЮ в начало article, а КВИЗ — только для III части
        nav_soup = BeautifulSoup(nav_block, 'html.parser')
        first_child = part_article.find()
        if first_child:
            first_child.insert_before(nav_soup)
        else:
            part_article.append(nav_soup)

        # Для частей I и II: удаляем квиз-контейнер если он затесался
        if part_num != 3:
            for quiz in part_article.find_all(id='quizSection'):
                quiz.decompose()
            for quiz in part_soup.find_all(id='quizSection'):
                quiz.decompose()

        # Удаляем старый блок трилогии если есть (он в начале)
        for old_nav in part_article.find_all(class_=lambda x: x and 'gill-trilogy' in str(x)):
            old_nav.decompose()

        # Путь
        out_dir = dirs[part_num]
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, 'index.html')

        html_out = part_soup.prettify()
        # prettify может сломать некоторые inline-скрипты; если нужно — используем str()
        html_out = str(part_soup)

        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(html_out)

        print(f'✓ Written {out_path}')

    print('\nГотово. 3 части созданы.')
    print('Теперь нужно вручную:')
    print('1. Добавить квизы для Части I и II (скопировать из III и адаптировать вопросы)')
    print('2. Обновить articles/index.html, biografii/index.html, sitemap.xml, feed.xml')
    print('3. Удалить старую директорию articles/dzhon-gill-1697-1771/')
    print('4. Обновить внутренние ссылки (../../images/ → правильные относительные)')

if __name__ == '__main__':
    main()
