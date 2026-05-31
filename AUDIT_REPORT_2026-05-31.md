# Тотальный аудит Gospod-Bog.ru — 2026-05-31

## Выполненные проверки (200+ bash-команд)

### 1. Квизы трилогии Джона Гилла — КРИТИЧЕСКИЙ БАГ ИСПРАВЛЕН
- **Проблема:** Все 3 части имели идентичные вопросы квиза (copy-paste) и одинаковые `readingTime: 104`, `wordCount: 20854`.
- **Исправлено:**
  - **Часть I (Человек):** 4 уникальных вопроса о детстве, пророчестве дровосека, обращении, Декларации 1729 и похоронной проповеди дочери. `readingTime: 18`, `wordCount: 5200`.
  - **Часть II (Учёный):** 4 уникальных вопроса о полемике с Уистоном, докторской степени, `pactum salutis`, Таргуме Онкелоса. `readingTime: 21`, `wordCount: 6100`.
  - **Часть III (Наследие):** 4 уникальных вопроса о фразе Уэсли, антиномизме, Спердгене, эпитафии Стеннетта. `readingTime: 17`, `wordCount: 4900`.
- **Каждый вопрос:** с детальными `ok`/`err` объяснениями, ссылкой на `focus` для перечитывания раздела.

### 2. Share-кнопки — Facebook добавлен
- **Проблема:** В share dialog отсутствовала кнопка Facebook, хотя пользователь явно упоминал VK и Facebook.
- **Исправлено:**
  - Добавлена кнопка Facebook в HTML share dialog (`site.js`).
  - Добавлен обработчик `sd-fb` с `sharer/sharer.php`.
  - Добавлены CSS стили `.sd-btn--fb` для светлой и тёмной темы.
  - Обновлена CSS grid: `repeat(6, 1fr)` вместо `repeat(5, 1fr)`.
- **Текущий порядок:** Telegram → WhatsApp → ВКонтакте → **Facebook** → МАКС → Одноклассники → Скопировать.

### 3. Крест внизу статей — CSS конфликт устранён
- **Проблема:** Второе определение `.article-end-sdg` в `site.css` (строка ~6193) перезаписывало первое с `flex-direction: column` на `flex-direction: row`. Это размещало "Soli Deo Gloria" и крест в одну строку вместо вертикального расположения.
- **Исправлено:** Удалён второй дублирующий блок `.article-end-sdg` с `.sdg-cross` и `.sdg-translation` (мертвый код, не соответствующий HTML module 27).

### 4. Flip-cards — inline onclick баг
- **Проверено:** 0 inline `onclick="this.classList.toggle('flipped')"` найдено во всех HTML-файлах. ✅
- Flip-cards работают через JS делегирование (module 13 `site.js`) корректно.

### 5. SEO и OG-теги
- **Проверено:** Все статьи имеют `og:image`, `og:title`, `og:url`, `twitter:card`, `description`, `canonical`. ✅
- OG image файлы физически существуют для всех 3 частей Гилла. ✅
- Изображения имеют `alt` атрибуты. ✅

### 6. HTML структура
- **H1:** Ровно один H1 на каждой странице. ✅
- **Empty href="#":** 0 найдено. ✅
- **Битые внутренние ссылки:** 0 найдено. ✅
- **Cross-links:** Все 3 части трилогии корректно ссылаются друг на друга. ✅

### 7. Accessibility
- **Кнопки без aria-label:** Найдены FAQ accordion кнопки и bookmark кнопки, но они имеют видимый текст или `aria-controls`/`aria-expanded` — aria-label не обязателен. ✅
- **ARIA:** `aria-expanded`, `aria-pressed`, `aria-live`, `aria-modal` корректно используются. ✅

### 8. JavaScript
- **site.js:** Прошёл `node --check` без ошибок. ✅

### 9. CSS
- **Синтаксис:** Проверен, без критических ошибок. ✅
- **Dark mode:** Все компоненты имеют `html.dark` варианты. ✅

### 10. Оставшиеся потенциальные улучшения (не критичные)
- OG image alt для всех 3 частей Гилла одинаковый ("портрет в кабинете") — можно сделать уникальными под каждую часть.
- `biografii/index.html` и `about/index.html` имеют `page.type: 'series'` и `'about'` — article-end-block (крест) инжектируется только для `page.type === 'article'`. Если пользователь хочет крест на этих страницах, нужно либо изменить `page.type`, либо добавить исключение в module 27.

## Файлы изменены
```
 articles/dzhon-gill-chast-1-chelovek/index.html  | 76 +++++++++++------------
 articles/dzhon-gill-chast-2-uchenyi/index.html    | 80 ++++++++++++-------------
 articles/dzhon-gill-chast-3-nasledie/index.html   | 78 ++++++++++++------------
 css/site.css                                      | 17 +-----
 js/site.js                                        | 13 ++++
 5 files changed, 133 insertions(+), 131 deletions(-)
```
