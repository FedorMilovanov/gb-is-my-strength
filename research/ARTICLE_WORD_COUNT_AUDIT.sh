#!/bin/bash
# Article word count audit — проверка, не обрезаны ли статьи
echo "=== ARTICLE WORD COUNT AUDIT ==="
echo "Дата: $(date)"
echo ""

for html_file in articles/*/index.html; do
  slug=$(echo "$html_file" | cut -d/ -f2)
  # Extract <article> content, strip HTML tags, count words
  wc=$(sed -n '/<article/,/<\/article>/p' "$html_file" | 
       sed 's/<[^>]*>//g' | 
       tr '[:space:]' ' ' | 
       wc -w)
  echo "$slug: $wc words"
done

echo ""
echo "=== NAGORNAYA ==="
for html_file in nagornaya/chast-*/index.html; do
  slug=$(echo "$html_file" | cut -d/ -f2)
  wc=$(sed -n '/<article/,/<\/article>/p' "$html_file" | 
       sed 's/<[^>]*>//g' | 
       tr '[:space:]' ' ' | 
       wc -w)
  echo "$slug: $wc words"
done

echo ""
echo "=== BAPTISTY-ROSSII ==="
for html_file in baptisty-rossii/*/index.html; do
  slug=$(echo "$html_file" | cut -d/ -f2)
  if [ "$slug" = "index.html" ] || [ "$slug" = "research" ]; then continue; fi
  wc=$(sed -n '/<article/,/<\/article>/p' "$html_file" 2>/dev/null || 
       cat "$html_file" | sed 's/<[^>]*>//g' | tr '[:space:]' ' ' | wc -w)
  echo "$slug: $wc words"
done
