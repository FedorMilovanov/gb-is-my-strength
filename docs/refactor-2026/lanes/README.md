# Active Lanes

Индекс активных и недавно закрытых lanes. Обновляется вручную интегратором или владельцем lane.

## Статусы

```text
active     — в работе
review     — готов к review/merge
blocked    — заблокирован (ждёт другой lane или решение)
stale      — неактивен более 3 дней, нужен статус
merged     — слит в main
abandoned  — отменён
```

## Active lanes

| Branch | Scope | Mode | Status | Merge? | Owner |
|---|---|---|---|---|---|
| `lane/system-protection-simple-v3-0` | Упрощение защиты агентов | SYSTEM | merged | ✅ | Arena Agent |
| `lane/nagornaya-componentization` | Componentize chast-2..5 | LANE | merged | ✅ | Arena Agent |
| `lane/gill-full-native-closeout-2026-06-23` | Strict-native closeout for Gill cluster | LANE | active | ⏳ | Arena Agent |
| `lane/kod-da-vinchi-final-section-native-2026-06-23` | Kod Da Vinci: promote final raw article section to Astro | LANE | review | ✅ | Arena Agent |
| `lane/system-native-runtime-taxonomy-audit-2026-06-23` | Native runtime taxonomy audit + Nagornaya branch verification | SYSTEM | review | ✅ | Arena Agent |
| `lane/system-native-head-closeout-2026-06-23` | Remove last legacy-head routes (`/about/`, `kod-da-vinchi`) | SYSTEM | review | ✅ | Arena Agent |

## Recently merged

| Branch | Scope | Date | PR/Commit |
|---|---|---|---|
| `lane/phase3-protection-v1-5` | Protection sync | 2026-06-22 | 6ee6258 |

## Abandoned / stale

None.
