=== ПАКЕТ ТРИЛОГИИ ГИЛЛА ===

Состав:
- articles/dzhon-gill-chast-1-chelovek/index.html   (Часть I: Человек, 4 иллюстрации)
- articles/dzhon-gill-chast-2-uchenyi/index.html    (Часть II: Учёный, 4 иллюстрации)
- articles/dzhon-gill-chast-3-nasledie/index.html   (Часть III: Наследие, 3 иллюстрации + квиз)
- images/gill-*                                    (11 иллюстраций × 3 размера: webp/jpg/900w/600w)
- images/og-dzhon-gill-chast-2/3-*                 (OG-обложки для соцсетей)
- gill-trilogy-split.patch                         (основной патч разделения)
- sw-final-fix.patch                               (фиксы Service Worker)

Инструкция по применению:
1. Распакуйте содержимое gill-package/ в папку вашего репозитория (gb-is-my-strength)
   Поверх существующих файлов (replace all).
2. Удалите старую папку: articles/dzhon-gill-1697-1771/
3. Выполните: git add -A && git commit -m "feat(gill): трилогия с иллюстрациями"
4. Запустите: npm run cache-bust
5. git push

Важно:
- В Части III оставлен оригинальный квиз. Для Частей I и II нужно добавить свои квизы
  (скопируйте шаблон из Части III и адаптируйте вопросы).
- Pagefind сам пересоберёт поисковый индекс при деплое.
