#!/bin/bash
# Improved word count — handles all HTML structures
echo "=== ARTICLE WORD COUNT AUDIT V2 ==="
echo "Дата: $(date)"
echo ""

count_words() {
  local file="$1"
  # strip all HTML tags, normalize whitespace, count words
  local wc=$(cat "$file" | \
    sed 's/<script[^>]*>.*<\/script>//g' | \
    sed 's/<style[^>]*>.*<\/style>//g' | \
    sed 's/<[^>]*>//g' | \
    sed 's/&[a-z]*;//g' | \
    tr '[:space:]' ' ' | \
    wc -w)
  echo "$wc"
}

echo "--- ARTICLES ---"
for f in articles/*/index.html; do
  slug=$(echo "$f" | cut -d/ -f2)
  wc=$(count_words "$f")
  echo "$slug: $wc words"
done

echo ""
echo "--- NAGORNAYA (всё тело) ---"
for f in nagornaya/chast-*/index.html; do
  slug=$(echo "$f" | cut -d/ -f2)
  wc=$(count_words "$f")
  echo "$slug: $wc words"
done
for f in nagornaya/istochniki/index.html nagornaya/nakhodki/index.html nagornaya/seriya/index.html; do
  if [ -f "$f" ]; then
    slug=$(echo "$f" | cut -d/ -f2)
    wc=$(count_words "$f")
    echo "$slug: $wc words"
  fi
done

echo ""
echo "--- BAPTISTY-ROSSII (всё тело) ---"
for f in baptisty-rossii/*/index.html; do
  slug=$(echo "$f" | cut -d/ -f2)
  [ "$slug" = "index.html" ] || [ "$slug" = "research" ] || [ "$slug" = "map-data" ] && continue
  wc=$(count_words "$f")
  echo "$slug: $wc words"
done

echo ""
echo "--- HOME & ABOUT ---"
for f in index.html about/index.html biografii/index.html hard-texts/index.html pastor-series/index.html; do
  if [ -f "$f" ]; then
    slug=$(echo "$f" | cut -d/ -f1)
    wc=$(count_words "$f")
    echo "$f: $wc words"
  fi
done

echo ""
echo "=== DONE ==="
