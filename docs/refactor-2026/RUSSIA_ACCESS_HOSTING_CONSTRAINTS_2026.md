# RUSSIA_ACCESS_HOSTING_CONSTRAINTS_2026.md — Россия, доступность сервисов, Cloudflare, GitHub Pages

Дата: 2026-06-12  
Статус: практическое уточнение к хостинг-стратегии.

---

## 1. Контекст

Владелец проекта находится в России. Это влияет на:

```text
доступ к Cloudflare/Vercel/Netlify;
оплату зарубежных сервисов;
стабильность доступа к dashboard;
возможность поддержки/верификации;
риск блокировок/троттлинга;
выбор хостинга для production.
```

Поэтому архитектура не должна зависеть от сервиса, к которому владелец не может стабильно зайти.

---

## 2. Cloudflare Pages

Cloudflare Pages технически остаётся сильным вариантом для static Astro, но для владельца из России есть практические проблемы:

```text
[ ] dashboard может быть недоступен или нестабилен;
[ ] оплата российскими картами может быть невозможна;
[ ] paid features могут быть недоступны;
[ ] российские провайдеры могут ограничивать доступ к Cloudflare-protected resources;
[ ] поддержка/аккаунт/биллинг могут упереться в санкционные compliance policies.
```

Cloudflare в 2022 писал, что соблюдает санкции и закрыл paid access в comprehensively-sanctioned regions, а также terminated customers tied to sanctions. Российские пользователи в community также обсуждали невозможность оплаты российскими картами.

Практический вывод:

```text
Cloudflare Pages не должен быть обязательным элементом архитектуры.
```

---

## 3. Можно ли «через друга»

Технически кто-то вне России может создать/оплатить аккаунт, но это не должно становиться фундаментом проекта.

Риски:

```text
аккаунт юридически/фактически не ваш;
зависимость от третьего лица;
возможные нарушения правил сервиса или санкционных ограничений;
сложности с доменом, доступами, recovery;
невозможность оперативно решать инциденты;
```

Рекомендация:

```text
Не строить production на схеме «друг оплатит», пока нет критической необходимости.
```

Если когда-нибудь понадобится, делать только легально, прозрачно и с пониманием TOS/ownership. Но сейчас — не нужно.

---

## 4. GitHub Pages как текущий safe baseline

GitHub Pages подходит текущей стратегии:

```text
static site;
public repository;
no server-side runtime;
custom domain;
free;
CI через GitHub Actions;
```

Официальные GitHub Pages limits:

```text
source repository recommended limit: 1 GB;
published site max size: 1 GB;
deployments timeout after 10 minutes;
soft bandwidth limit: 100 GB/month;
soft limit: 10 builds/hour, unless custom GitHub Actions workflow;
rate limits possible with HTTP 429;
```

Источник: GitHub Pages limits docs.

---

## 5. GitHub Actions cost

GitHub Actions docs:

```text
public repositories: standard GitHub-hosted runners are free;
private repositories: quota + paid overages;
larger runners always have separate billing;
Copilot code review can consume minutes/AI credits depending context;
```

Практический вывод:

```text
Если repo public, стандартный CI для Astro/validation можно держать бесплатно.
Не использовать larger runners.
Не хранить большие artifacts долго.
```

---

## 6. Что может прижать на GitHub Pages

```text
1. Published site > 1GB.
2. Bandwidth near/over 100GB/month.
3. Build > 10 minutes.
4. Нужно custom headers/CSP/redirects сложнее, чем Pages позволяет.
5. Нужен server endpoint/RUM/API.
6. Нужна приватная staging-среда.
```

Пока ни один пункт не выглядит срочным.

---

## 7. Как снизить риск лимитов GitHub Pages

```text
[ ] не хранить гигантские изображения;
[ ] AVIF/WebP и responsive images;
[ ] не хранить видео в repo;
[ ] generated artifacts не коммитить без нужды;
[ ] build cache аккуратно;
[ ] no huge Pagefind index upfront;
[ ] карты не превращать в мегабайтные растровые подложки;
[ ] следить за размером dist;
```

---

## 8. Российские альтернативы, если GitHub станет тесен

Платные/локальные варианты рассматривать только при необходимости:

```text
Yandex Cloud Object Storage + CDN/static website
Selectel S3/CDN
Timeweb Cloud/S3
Beget/static/VPS
обычный VPS + Caddy/Nginx
```

Минусы:

```text
обычно платно;
нужна настройка;
нужно управлять headers/cache/SSL;
у S3/CDN часто платный исходящий трафик;
```

Yandex Object Storage pricing docs показывают, что стоимость складывается из storage, operations и outgoing traffic; есть небольшой бесплатный monthly allowance, но traffic/storage сверх лимита оплачиваются.

---

## 9. Решение на сейчас

```text
Остаёмся на GitHub Pages/current static pipeline.
Cloudflare Pages держим как theoretical future option, но не планируем в ближайших фазах.
Не суетимся, пока GitHub Pages не жмёт.
```

---

## 10. Архитектурное требование

Сайт должен быть deployable в любую static hosting среду:

```text
GitHub Pages
Cloudflare Pages
Netlify
Vercel
Yandex Object Storage
VPS + Nginx/Caddy
```

То есть:

```text
никакой жёсткой зависимости от Cloudflare-specific features;
никакой зависимости от serverless на первой фазе;
static output must be portable.
```

---

## 11. Итог

Правильная позиция:

```text
Cloudflare хорош технически, но не обязателен и потенциально проблемен для владельца из России.
GitHub Pages уже работает и бесплатен.
Переходить нужно только при реальном давлении лимитов или функций.
```
