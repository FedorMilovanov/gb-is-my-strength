# ARENA SESSION MANUAL — выживание в песочнице

**Обновлено:** 2026-06-21  
**Версия:** v5 (verified experimentally)  
**Среда:** Arena.ai Agent Mode — Linux ext4, 2 CPU, 1.9GB RAM

---

## 0. ЭКСПЕРИМЕНТАЛЬНО ПРОВЕРЕНО (факты, не догадки)

```
✅ Файлы СОХРАНЯЮТСЯ при падении сессии
✅ git remote СОХРАНЯЕТСЯ при падении
✅ git log/history СОХРАНЯЕТСЯ
✅ write_file РАБОТАЕТ (но иногда не синхронизируется с bash)
✅ python3 -c РАБОТАЕТ
✅ sed -i РАБОТАЕТ (всегда)
❌ edit_file ЧАСТО ПАДАЕТ (используй sed -i вместо него)
❌ read_file гигантских файлов >500KB может упасть
❌ Теряется только НЕДОПИСАННЫЙ ответ агента (середина сообщения)
```

## 1. ОКРУЖЕНИЕ

| Параметр | Значение |
|---------|---------|
| Файловая система | **ext4** (не tmpfs — файлы живут!) |
| CPU | 2 cores |
| RAM | 1.9 GB (1.4 GB available) |
| Node.js | 20.20.2 (требуется 22 для Astro) |
| Git worktree | Нормальный branch (не detached) |
| Домашняя папка | /home/user |
| Рабочая папка | /home/user/repo |
| uploads/ | Живёт между сессиями |

## 2. ДИАГНОСТИКА (первые 2 команды)

```bash
cd /home/user/repo
echo "Remote: $(git remote -v 2>/dev/null | grep push | head -1)"
echo "Commit: $(git log --oneline -1)"
```

Если remote есть — всё работает, remote НЕ ТЕРЯЕТСЯ при падении.
Если remote пропал — **новый диалог** (только тогда).

## 3. СТАРТ (только если новый диалог)

```bash
git remote set-url origin "https://FedorMilovanov:${GH_TOKEN}@github.com/FedorMilovanov/gb-is-my-strength.git"
export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH
npm install --no-audit --no-fund
npm run strangler:build:production-like
node scripts/audit-pro.js | grep PASSED
```

## 4. ПОЧЕМУ Я ПАДАЮ (реальные причины)

```
1. СЛИШКОМ МНОГО TOOL CALLS (>3 за ответ)
   → Arena обрывает сессию. Делать 1-2 команды.

2. СЛИШКОМ ДЛИННЫЙ ОТВЕТ (>20KB текста + код)
   → Context window переполняется. Писать коротко.

3. ЧТЕНИЕ ГИГАНТСКИХ ФАЙЛОВ
   → AGENTS.md 237KB, audit-pro.js 208KB
   → Использовать head/grep, не cat всего файла.

4. web_search depth=3
   → depth=3 качает 50-100KB контента. Использовать depth=2.
```

## 5. ИНСТРУМЕНТЫ

| Инструмент | Надёжность | Альтернатива |
|-----------|-----------|-------------|
| bash | ✅ Всегда работает | — |
| read_file | ⚠️ Падает на больших файлах (>500KB) | `head -100 file`, `grep pattern file` |
| write_file | ⚠️ Иногда не синхронизируется | `cat > file << 'EOF'` |
| edit_file | ❌ Часто падает | `sed -i 's/old/new/' file` |
| web_search | ✅ depth=2 норм, depth=3 тяжёлый | depth=2 |
| fetch_page | ✅ Работает | — |
| image_search | ✅ Работает | — |

## 6. ПРОЕКТ (быстрый старт)

| Что | Команда |
|-----|---------|
| Аудит | `node scripts/audit-pro.js` |
| MDX parity | `npm run content:parity` |
| Сборка | `npm run strangler:build:production-like` |
| Карты | `npm run maps:validate && npm run avraam:audit` |
| Push | `git push origin main` (remote уже есть) |

## 7. ЗАПРЕТЫ

- Пушить без audit-pro
- Менять visual baseline без owner
- Править Avraam (protected audit 28/28)
- Создавать CSS/JS без AGENTS.md
- Использовать edit_file (он сломан)
- depth=3 в web_search (слишком тяжёлый)
