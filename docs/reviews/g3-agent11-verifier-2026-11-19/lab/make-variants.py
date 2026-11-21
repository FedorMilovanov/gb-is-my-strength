"""Build disposable /articles/ HTML variants for the no-JS Back lab (never touches Product source).
Usage: python3 make-variants.py <dist-of-36e69c4> <out-dir>"""
import re, sys, os
dist, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
src = open(f'{dist}/articles/index.html', encoding='utf8').read()
w = lambda n, s: open(f'{out}/{n}.html', 'w', encoding='utf8').write(s)
w('v0', src)
v1 = src.replace('id="catalog-materials" aria-labelledby="hArticlesLabel" tabindex="-1"', 'id="catalog-materials" aria-labelledby="hArticlesLabel"'); assert v1 != src; w('v1-no-tabindex', v1)
w('v2-no-scripts', re.sub(r'<script(?![^>]*application/ld\+json)[^>]*>[\s\S]*?</script>', '', src))
w('v4-auto-nomargin', src.replace('</head>', '<style>html,body{scroll-behavior:auto!important}*{scroll-margin:0!important}</style></head>'))
w('v6-auto-only', src.replace('</head>', '<style>html{scroll-behavior:auto!important}</style></head>'))
w('v7-nomargin-only', src.replace('</head>', '<style>*{scroll-margin:0!important}</style></head>'))
items = ''.join(f'<li><a href="/articles/x{i}/">Статья {i}</a><p>' + 'текст ' * 60 + '</p></li>' for i in range(90))
syn = f'<!doctype html><html lang=ru><meta charset=utf-8><meta name=viewport content="width=device-width"><title>s</title><body><p><a href="#catalog-materials">Все материалы</a></p><div style="height:900px">hero</div><section id="catalog-materials"><ul>{items}</ul></section></body></html>'
w('v3-synthetic', syn)
w('v5-synthetic-tabindex', syn.replace('<section id="catalog-materials">', '<section id="catalog-materials" tabindex="-1">'))
w('v9-synthetic-smooth', syn.replace('<body>', '<style>html{scroll-behavior:smooth}</style><body>'))
w('v10-synthetic-smooth-margin', syn.replace('<body>', '<style>html{scroll-behavior:smooth}#catalog-materials{scroll-margin-top:64px}</style><body>'))
