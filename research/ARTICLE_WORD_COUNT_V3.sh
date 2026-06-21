#!/bin/bash
count_body_words() {
  local file="$1"
  # Extract body content, remove script, style, SVG, then count
  python3 -c "
import re, sys
with open('$file', 'r') as f:
    html = f.read()
# Remove script blocks
html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
# Remove style blocks
html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
# Remove SVG blocks
html = re.sub(r'<svg[^>]*>.*?</svg>', '', html, flags=re.DOTALL)
# Remove inline event handlers
html = re.sub(r'on\w+=\"[^\"]*\"', '', html)
# Remove all HTML tags
html = re.sub(r'<[^>]+>', ' ', html)
# Remove entities
html = re.sub(r'&[a-z]+;', ' ', html)
# Normalize whitespace
words = html.split()
print(len(words))
"
}
echo "=== ARTICLE WORD COUNT V3 (python parser) ==="
echo "Date: $(date)"
echo ""

echo "--- ARTICLES ---"
for f in articles/*/index.html; do
  slug=$(echo "$f" | cut -d/ -f2)
  wc=$(count_body_words "$f")
  echo "$slug: $wc words"
done

echo ""
echo "--- NAGORNAYA ---"
for f in nagornaya/chast-*/index.html nagornaya/istochniki/index.html nagornaya/nakhodki/index.html nagornaya/seriya/index.html; do
  [ -f "$f" ] || continue
  slug=$(echo "$f" | cut -d/ -f2)
  wc=$(count_body_words "$f")
  echo "$slug: $wc words"
done

echo ""
echo "--- BAPTISTY-ROSSII ---"
for f in baptisty-rossii/*/index.html; do
  slug=$(echo "$f" | cut -d/ -f2)
  [ "$slug" = "index.html" ] || [ "$slug" = "research" ] || [ "$slug" = "map-data" ] && continue
  wc=$(count_body_words "$f")
  echo "$slug: $wc words"
done
