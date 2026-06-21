# ARENA SESSION MANUAL — полное выживание в песочнице

**Обновлено:** 2026-06-21  
**Среда:** Arena Agent Mode (Qwen Code) — изолированный git worktree  
**Характеристики:** maxRoundsPerAgent=50, timeoutSeconds=600

---

## 0. ГЛАВНОЕ (чтобы не повторять моих ошибок)

```
1. Файлы СОХРАНЯЮТСЯ между сообщениями в одной сессии.
   write_file и bash cat >> оба работают. Не надо пересоздавать.

2. git remote с токеном СОХРАНЯЕТСЯ между сообщениями.
   .git/config не сбрасывается пока сессия жива.
   Достаточно 1 раз установить remote и пушить.

3. Новая сессия = ВСЁ новое. Определяется по git log --oneline -1.
   Если последний коммит НЕ тот что вы ожидаете — remote пропал,
   node_modules нет, dist нет.

4. Я падаю потому что делаю 5-10 tool calls за раз.
   Надо 1-2 команды на ответ. Это превышает лимит шагов.
```

## 1. ДИАГНОСТИКА СЕССИИ

```bash
cd /home/user/repo

# Та же сессия или новая?
git log --oneline -1
# Если коммит совпадает с ожидаемым — remote жив, всё на месте
# Если нет — remote нужно переустановить, npm install, build

# Что сохранилось?
git remote -v                    # remote URL? (всегда жив в сессии)
ls node_modules/.package-lock.json 2>/dev/null || echo "NO node_modules"
ls dist/index.html 2>/dev/null || echo "NO dist"
```

## 2. PUSH (только 1 раз на сессию)

```bash
# Установка remote — ОДИН РАЗ в начале сессии
git remote set-url origin "https://FedorMilovanov:${GH_TOKEN}@github.com/FedorMilovanov/gb-is-my-strength.git"

# Все последующие push в этой сессии работают без повторения
git push origin main
```

## 3. СБОРКА (1 раз в начале сессии)

```bash
export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH
npm install --no-audit --no-fund
npm run strangler:build:production-like
```

## 4. ПОЧЕМУ Я ПАДАЮ

**Причина:** >3 tool calls за раз. Arena имеет лимит 600 секунд на сессию. 
Каждый bash-вызов жрёт время. 5+ команд = превышение.

**Решение:** 1-2 команды на ответ. Никогда не делать 5+ tool calls в одном сообщении.

## 5. СКРИНШОТЫ

Я НЕ вижу изображения — нет vision API. 
Но могу проанализировать: размер, цвета, яркость, текстовые зоны.
Опиши словами что там если нужно точное понимание.

## 6. ЧТО НЕЛЬЗЯ

- ❌ Пушить без audit-pro
- ❌ Менять visual baseline без owner approval
- ❌ Править Avraam (protected audit 28/28)
- ❌ Плодить CSS/JS без проверки AGENTS.md
