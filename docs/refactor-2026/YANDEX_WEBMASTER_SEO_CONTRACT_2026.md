# YANDEX_WEBMASTER_SEO_CONTRACT_2026.md — Яндекс.Вебмастер, индексация, переезд, sitemap

Дата: 2026-06-12  
Связано с:

- `docs/SEO_TECHNICAL_CONTRACT_2026.md`
- `docs/URL_CONTRACT_2026.md`
- `docs/DEPLOYMENT_SECURITY_ENV_2026.md`

---

## 1. Почему отдельный документ

Для проекта важен не только Google, но и Яндекс. При Astro-миграции нужно сохранить:

```text
verification files;
robots.txt;
sitemap.xml;
canonical;
редиректы;
доступность страниц роботу;
Yandex.Metrika.
```

---

## 2. Verification files

Сохранить:

```text
yandex_42bc0d54a1ca4952.html
yandex_d8876d66da1b4592.html
```

В Astro:

```text
public/yandex_42bc0d54a1ca4952.html
public/yandex_d8876d66da1b4592.html
```

---

## 3. Sitemap

Yandex reindex docs указывают, что информация о страницах должна быть в Sitemap file и страницы должны быть доступны роботу.

Правила:

```text
[ ] sitemap.xml доступен
[ ] sitemap содержит публичные canonical URLs
[ ] draft/noindex не включать
[ ] старый /feed.xml не путать с sitemap
[ ] после миграции отправить sitemap в Webmaster
```

---

## 4. Canonical

Yandex API/status docs включают статус `NOT_CANONICAL`: страница индексируется по canonical URL, указанному в rel="canonical"; если canonical неверен — исправить или удалить.

Правило:

```text
canonical должен быть самоссылочным для публичных страниц.
```

---

## 5. Redirects / site move

Yandex docs по redirects/site move предупреждают:

```text
не редиректить все страницы на главную;
редиректить внутренние страницы на соответствующие новые страницы;
контент должен совпадать;
переезд/изменение адреса может занимать около месяца;
```

Для нас лучший вариант:

```text
URL не менять → redirects не нужны.
```

Если URL меняется:

```text
old URL → corresponding new URL
301/302 по инструкции Яндекса/хостинга
проверить Server response
отправить важные страницы на переиндексацию
```

---

## 6. Robots/noindex

Yandex statuses include:

```text
ROBOTS_HOST_ERROR
ROBOTS_URL_ERROR
NO_INDEX
CLEAN_PARAMS
DUPLICATE
```

Правила:

```text
[ ] не блокировать публичные страницы robots.txt
[ ] noindex только для dev/draft/system
[ ] Clean-param использовать осторожно
[ ] canonical/duplicates контролировать
```

---

## 7. Important pages monitoring

После пилотного деплоя проверить в Яндекс.Вебмастере:

```text
/about/
/articles/
/karty/
/karty/avraam/
/feed.xml
/sitemap.xml
```

Смотреть статусы:

```text
NOTHING_FOUND
HOST_ERROR
HTTP_ERROR
NOT_CANONICAL
ROBOTS_URL_ERROR
NO_INDEX
DUPLICATE
LOW_QUALITY
```

---

## 8. Reindexing

После миграции/пилота:

```text
[ ] убедиться, что page returns 200
[ ] canonical self
[ ] sitemap includes URL
[ ] submit for reindexing if needed
```

Yandex notes: если redirect используется, робот постепенно отследит redirects; для ускорения можно отправить страницы на переиндексацию.

---

## 9. Metrika

Metrika сохранена как отдельная тема в CSP:

```text
docs/SECURITY_CSP_IMPLEMENTATION_PLAN.md
```

---

## 10. Итог

Для Яндекса стратегия такая же:

```text
не менять URL;
не ломать canonical;
сохранить sitemap/verification;
не блокировать robots;
после пилота проверить важные страницы в Webmaster.
```
