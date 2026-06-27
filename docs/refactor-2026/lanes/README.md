# Active Lanes

Индекс активных и недавно закрытых lanes. Обновляется вручную интегратором или владельцем lane.

## Статусы

```text
merged     — в работе
merged     — готов к merged/merge
blocked    — заблокирован (ждёт другой lane или решение)
stale      — неактивен более 3 дней, нужен статус
merged     — слит в main
abandoned  — отменён
```

## Active lanes

| Branch | Scope | Mode | Status | Merge? | Owner |
|---|---|---|---|---|---|
| `lane/system-download-fonts-syntax-fix-2026-06-27` | Fix `download-fonts.js` SPECS outer array syntax | SYSTEM | merged | ✅ | arena-surgical-surgeon |
| `lane/system-premiumcontrols-reconciliation-2026-06-27` | PremiumControls reconciliation & Control plane parity | SYSTEM | merged | ✅ | arena-surgical-surgeon |
| `lane/system-ci-contract-reconciliation-2026-06-24` | Fix CI checks, issues, guard behavior and stale docs | SYSTEM | active | ⏳ | Arena Agent |
| `lane/system-protection-simple-v3-0` | Упрощение защиты агентов | SYSTEM | merged | ✅ | Arena Agent |
| `lane/nagornaya-componentization` | Componentize chast-2..5 | LANE | merged | ✅ | Arena Agent |
| `lane/gill-full-native-closeout-2026-06-23` | Strict-native closeout for Gill cluster | LANE | merged | ✅ | Arena Agent |
| `lane/kod-da-vinchi-final-section-native-2026-06-23` | Kod Da Vinci: promote final raw article section to Astro | LANE | merged | ✅ | Arena Agent |
| `lane/system-native-runtime-taxonomy-audit-2026-06-23` | Native runtime taxonomy audit + Nagornaya branch verification | SYSTEM | merged | ✅ | Arena Agent |
| `lane/system-native-head-closeout-2026-06-23` | Remove last legacy-head routes (`/about/`, `kod-da-vinchi`) | SYSTEM | merged | ✅ | Arena Agent |
| `lane/baptisty-total-closeout-2026-06-23` | Strict-native closeout for the full baptisty-rossii route family | LANE | merged | ✅ | Arena Agent |
| `lane/system-final-hybrid-closeout-2026-06-23` | Close the remaining non-app hybrid landing/catalog/article routes | SYSTEM | merged | ✅ | Arena Agent |

## Recently merged

| Branch | Scope | Date | PR/Commit |
|---|---|---|---|
| `lane/phase3-protection-v1-5` | Protection sync | 2026-06-22 | 6ee6258 |

## Abandoned / stale

None.
