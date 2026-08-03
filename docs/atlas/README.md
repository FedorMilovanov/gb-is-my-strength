# Biblical Atlas — work entrypoint

Любой агент перед работой с картами читает документы в этом порядке:

1. [`../../AGENTS.md`](../../AGENTS.md) и применимые surface-разделы `AGENTS-REFERENCE.md`;
2. [`../WORK_MODES.md`](../WORK_MODES.md), lane/branch policies и owner invariants;
3. [`../ATLAS-CONTRACT-2026-07-10.md`](../ATLAS-CONTRACT-2026-07-10.md) — основной продуктовый и data contract;
4. [`../ATLAS-CONTRACT-APPENDIX-REFERENCE-MAP-2026-08-02.md`](../ATLAS-CONTRACT-APPENDIX-REFERENCE-MAP-2026-08-02.md) — Авраам как reference-map, Atlas Shell, SVG/source/radiocarbon rules;
5. [`../ATLAS-VISUAL-QA-MARATHON-PROTOCOL-2026-08-02.md`](../ATLAS-VISUAL-QA-MARATHON-PROTOCOL-2026-08-02.md) — обязательная macro/micro/geometry/click/keyboard/touch/print проверка;
6. для текущей reference-wave — [`../ATLAS-AVRAAM-REFERENCE-LANE-2026-08-02.md`](../ATLAS-AVRAAM-REFERENCE-LANE-2026-08-02.md).

## Короткое правило

```text
одна карта
→ один bounded lane
→ research + effective data truth
→ геометрия
→ macro/micro screenshots
→ полный interaction sweep
→ owner golden set
→ только затем shared primitive и следующая карта
```

## Не делать

- не чинить несколько карт одновременно;
- не добавлять route-specific mini-engine или `if (slug === ...)` hack;
- не скрывать неверные данные CSS/adapter-мутацией;
- не считать static audit визуальным доказательством;
- не принимать новый baseline автоматически;
- не заявлять production без same-SHA live witness.

Этот каталог — навигация, а не отдельный источник фактов. При конфликте действуют owner directive, `OWNER-INVARIANTS` и основной Atlas Contract.
