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

## Recently merged

| Branch | Scope | Date | PR/Commit |
|---|---|---|---|
| `lane/phase3-protection-v1-5` | Protection sync | 2026-06-22 | 6ee6258 |

## Abandoned / stale

None.
