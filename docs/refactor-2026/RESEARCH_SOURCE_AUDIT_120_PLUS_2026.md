# RESEARCH_SOURCE_AUDIT_120_PLUS_2026.md — третий deep pass: хостинг, Россия, стоимость, ограничения

Дата: 2026-06-12  
Назначение: дополнить предыдущие source audits вопросами доступности сервисов из России, бесплатных/платных лимитов и текущей стратегии GitHub Pages.

---

## 1. Главный новый вывод

```text
Cloudflare Pages технически хорош, но для владельца из России не должен быть обязательной зависимостью.
GitHub Pages/current static hosting остаётся правильным baseline.
Переход на Cloudflare/другой хостинг — только если GitHub Pages реально начнёт жать.
```

---

## 2. Cloudflare / Russia sources

### 67. Cloudflare blog: Ukraine, Belarus, Russia actions

URL: https://blog.cloudflare.com/steps-taken-around-cloudflares-services-in-ukraine-belarus-and-russia/

Выводы:

- Cloudflare соблюдает санкции;
- closed off paid access in comprehensively-sanctioned regions;
- terminated customers tied to sanctions;
- Cloudflare не полностью отключал services in Russia, объясняя, что Russia needs more Internet access, not less.

Влияние:

```text
Cloudflare как paid/service dependency для владельца из России рискован.
```

### 68. Cloudflare community: payment from Russia

URL: https://community.cloudflare.com/t/payment-for-services-for-clients-from-russia/361526

Вывод:

- российские карты/PayPal могут не работать;
- Cloudflare likely won't provide sanction bypass methods.

Влияние:

```text
Не планировать paid Cloudflare features как обязательные.
```

### 69. Reports on Russia throttling/blocking Cloudflare-protected sites

URLs:

- https://cybernews.com/security/russia-blocks-cloudflare-protected-sites/
- https://therecord.media/cloudflare-russia-restricting-access-crackdown

Вывод:

- российские провайдеры/регулятор могут ограничивать Cloudflare-protected sites;
- это outside Cloudflare control.

Влияние:

```text
Для русскоязычного проекта с владельцем/аудиторией в РФ Cloudflare может быть operational risk.
```

---

## 3. GitHub Pages official sources

### 70. GitHub Pages limits

URL: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

Официальные лимиты:

```text
source repo recommended limit: 1GB;
published site max: 1GB;
deployment timeout: 10 minutes;
soft bandwidth limit: 100GB/month;
soft limit: 10 builds/hour, unless custom GitHub Actions workflow;
rate limits possible, 429;
not intended for SaaS/e-commerce/sensitive transactions.
```

Влияние:

```text
Для статического богословского сайта подходит, если следить за images/dist size.
```

### 71. GitHub Actions billing

URL: https://docs.github.com/en/billing/concepts/product-billing/github-actions

Выводы:

- public repositories: standard GitHub-hosted runners are free;
- private repositories: quotas and paid overages;
- larger runners billed separately;
- artifact/cache storage can matter.

Влияние:

```text
Если репозиторий public, CI/build/validation можно держать бесплатно на стандартных runners.
```

### 72. GitHub Pages community discussions

URLs:

- https://github.com/orgs/community/discussions/171898
- https://github.com/orgs/community/discussions/167331

Выводы:

- Pages is static hosting;
- 100GB/month bandwidth repeated;
- not for high-RPS experiments;
- private Pages on free personal accounts limited.

Влияние:

```text
Current use case okay; avoid heavy media/high-RPS assets.
```

---

## 4. Cloudflare Pages / static hosting comparisons

### 73. Static hosting comparisons 2026

URLs:

- https://pressless.io/blog/host-website-free-2026
- https://danubedata.ro/blog/cloudflare-pages-vs-netlify-vs-vercel-static-hosting-2026
- https://danubedata.ro/blog/best-netlify-alternatives-static-site-hosting-2026
- https://htmlpub.com/blog/netlify-alternatives

Выводы:

- many 2026 comparisons highlight Cloudflare Pages free/unlimited bandwidth;
- Netlify/Vercel often have bandwidth/team/paid limits;
- GitHub Pages is free but limited/static;
- Cloudflare great technically but access/payment issue for Russia remains.

Влияние:

```text
Cloudflare stays future option only.
```

---

## 5. Russian/local hosting alternatives

### 74. Yandex Object Storage pricing

URL: https://yandex.cloud/en/docs/storage/pricing

Выводы:

- cost includes storage, operations, outgoing traffic;
- small free monthly allowances;
- paid after allowance;
- pricing currency depends on contracting entity.

Влияние:

```text
Yandex Object Storage/CDN is a possible Russia-accessible paid fallback, not free equivalent to GitHub Pages.
```

### 75. Russian cloud/storage comparison sources

URLs:

- https://www.cloud4y.ru/blog/cloud-storage-rating-2026/
- https://tproger.ru/articles/oblaka-dlya-startapov--5-provajderov-s-samymi-vygodnymi-tarifami

Вывод:

- Russian providers exist: Yandex Cloud, Selectel, Timeweb Cloud, Beget/VK/Cloud4Y;
- object storage/CDN traffic can become paid;
- useful if foreign access becomes unreliable.

Влияние:

```text
Fallback only, not now.
```

---

## 6. CMS / paid services follow-up

### 76. Keystatic Cloud pricing

URL: https://keystatic.com/docs/cloud

Выводы:

```text
free account;
up to 3 users/team free;
Pro starts $10/month;
additional users beyond 3 cost $5/month/user;
Pro includes Cloud Images and experimental multiplayer editing.
```

Влияние:

```text
Keystatic local/core free; Cloud features paid only if team/media needs appear.
```

### 77. Keystatic review/pricing sources

URLs:

- https://www.luckymedia.dev/insights/keystatic
- https://makerstack.co/reviews/keystatic-review/
- https://github.com/Thinkmill/keystatic/discussions/107

Вывод:

- Keystatic core intended free/open source;
- paid add-ons/cloud possible;
- GitHub/user access can still create indirect cost.

---

## 7. Search cost follow-up

### 78. Pagefind vs Algolia/Lunr comparisons

URLs:

- https://staticsignal.io/posts/static-site-search-with-pagefind/
- https://dev.to/morinaga/static-site-search-for-astro-in-2026-why-i-picked-pagefind-over-algolia-and-lunr-pg1

Вывод:

- Pagefind costs $0, static files;
- Algolia can become paid/SaaS dependency;
- Pagefind likely first full-text layer.

---

## 8. Updated infrastructure decision

```text
Decision: stay on GitHub Pages/current static hosting.
Reason: free, working, enough for current scale, portable with Astro static output.
Cloudflare: future candidate only if access/payment/need resolved.
Russia constraint: do not make Cloudflare mandatory.
```

---

## 9. New docs created from this pass

```text
RUSSIA_ACCESS_HOSTING_CONSTRAINTS_2026.md
GITHUB_PAGES_RETENTION_PLAN_2026.md
```

---

## 10. Practical instruction

```text
Do not rush hosting migration.
Do not solve hypothetical Cloudflare payment/access now.
Keep the architecture portable static.
Optimize media to stay within GitHub Pages limits.
```
