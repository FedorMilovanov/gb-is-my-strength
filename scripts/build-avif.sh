#!/usr/bin/env bash
# build-avif.sh — конвертирует все *.webp/*.jpg/*.png в /images/ в AVIF.
# Требования: avifenc (apt install libavif-bin / brew install libavif).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGES="$ROOT/images"
COUNT=0
if ! command -v avifenc &> /dev/null; then
  echo "❌ avifenc не найден. Установите: apt install libavif-bin"
  exit 1
fi
echo "🖼  Сканируем $IMAGES …"
while IFS= read -r -d '' f; do
  base="${f%.*}"
  out="$base.avif"
  if [[ -f "$out" && "$out" -nt "$f" ]]; then continue; fi
  echo "  → $(basename "$f")"
  if avifenc --min 28 --max 36 --speed 4 -j all "$f" "$out" > /dev/null 2>&1; then
    COUNT=$((COUNT + 1))
  else
    echo "    ⚠ avifenc failed for $f"
  fi
done < <(find "$IMAGES" -type f \( -iname "*.webp" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \) -print0)
echo ""
echo "✅ Готово. Создано/обновлено $COUNT AVIF-файлов."
