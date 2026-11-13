#!/usr/bin/env python3
"""Метрики связности прозы для редакторских волн (audit-friendly, без зависимостей).

Определения (фиксированы, чтобы цифры в отчёте были воспроизводимы):
  слова      — токены [A-Za-zА-Яа-яЁё0-9]+ во всём теле статьи (без frontmatter),
               включая заголовки, списки, цитаты и HTML-текст;
  прозаич. блок — абзац между пустыми строками, который НЕ является заголовком
               (#), элементом списка (-, *, +, 1.), цитатой (>), HTML/JSX-строкой
               (<...>) или таблицей (|); HTML-теги внутри абзаца срезаются;
  медиана    — медианная длина прозаического блока в словах;
  <40 слов   — доля прозаических блоков короче 40 слов (дробность прозы);
  пункты     — количество элементов списков (-, *, +, 1.).

Использование: python3 prose-metrics.py FILE [FILE ...]
"""
import re
import statistics
import sys

WORD = re.compile(r"[A-Za-zА-Яа-яЁё0-9]+")
TAG = re.compile(r"<[^>]+>")


def strip_frontmatter(text: str) -> str:
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) == 3:
            return parts[2]
    return text


def metrics(path: str) -> dict:
    body = strip_frontmatter(open(path, encoding="utf-8").read())
    words = len(WORD.findall(TAG.sub(" ", body)))
    blocks, items = [], 0
    for raw in re.split(r"\n\s*\n", body):
        block = raw.strip()
        if not block:
            continue
        first = block.split("\n", 1)[0].strip()
        if first.startswith(("#", "<", "|", ">", "```")):
            continue
        if re.match(r"^(?:[-*+]|\d+\.)\s", first):
            items += len(re.findall(r"(?m)^\s*(?:[-*+]|\d+\.)\s", block))
            continue
        clean = TAG.sub(" ", block)
        n = len(WORD.findall(clean))
        if n:
            blocks.append(n)
    return {
        "words": words,
        "blocks": len(blocks),
        "median": int(statistics.median(blocks)) if blocks else 0,
        "short": round(100 * sum(1 for b in blocks if b < 40) / len(blocks)) if blocks else 0,
        "items": items,
    }


if __name__ == "__main__":
    for path in sys.argv[1:]:
        m = metrics(path)
        print(f"{path}\t{m['words']} сл.\t{m['blocks']} блоков\tмедиана {m['median']}"
              f"\t<40: {m['short']} %\tпунктов: {m['items']}")
