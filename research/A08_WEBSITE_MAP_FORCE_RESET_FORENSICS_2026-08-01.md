# A08 — Force-reset и website-map provenance

**Дата:** 2026-08-01  
**Статус:** `BLOCKED_PROVENANCE`  
**Production claim:** `no`

## Lane record

- **Mode:** `SYSTEM`
- **Lane / owner:** `agent/a08-website-map-provenance-20260801`
- **Purpose:** доказательно определить pre-reset head ветки `claude/website-map-audit-ik3ypo` либо закрыть вопрос fail-closed blocker-статусом.
- **Base / rollback SHA:** `be970bfc13882119e99605ba1689605af4a4af8a`
- **Allowed repository:** `FedorMilovanov/gb-is-my-strength`; AuditRepo, Research и Drive использованы read-only.
- **Allowed paths:** этот отчёт, provenance-ledger, contract test и существующий repository-history forensic workflow.
- **Adjacent active work:** PR #659 меняет только Atlas geometry scripts; пересечения файлов нет. PR #111 принадлежит другому агенту и не изменялся.
- **Source of truth:** immutable Git objects, GitHub ancestry/PR metadata и сохранённый Drive all-refs snapshot.
- **Required checks:** provenance contract, repository-history forensic audit, workflow/control-plane checks, exact-head CI.

## Ответ

Точный head ветки **до force-reset доказать невозможно** по доступным материалам. Вопрос закрыт как `BLOCKED_PROVENANCE`, а не как «почти найдено».

Нельзя объявлять `26a344f042a6d907a3c3de96540a9f241256739d` точным head. Это сильнейший кандидат, но прямой записи вида `branch -> SHA` до reset не найдено.

## Установленная цепочка

1. В сохранённом all-refs snapshot ветка уже указывает на `0f7cefbb20abb17c65872e53c00c733c480f2a97` — общий governance checkpoint от 28 июля, а не на самостоятельный website-map commit.
2. SHA-256 канонической строки ref-доказательства: `68fa9da6ce21d85aa084ae83a5a6b168fb756aae70aac946b622dddf7ad4670e`.
3. В текущем product repository ветка отсутствует.
4. PR с точным именем ветки в разрешённых репозиториях не найден.
5. В доступном Drive-наборе не найден pre-reset reflog, `fsck`-запись или packed-ref со старым SHA.
6. GitHub сохраняет длинную цепочку product-коммитов Claude-сессии `01MhT2bkRHUuPpdhpzrBtjm7`. Последний доступный product commit этой сессии — `26a344f...` от 17 июля.
7. `26a344f...` доступен как полноценный Git object и является предком нынешнего `main`; следовательно, соответствующая работа не исчезла из истории.
8. Однако session ordering не равен branch-ref provenance. Между «последний commit сессии» и «точный head ветки перед reset» остаётся недоказанный переход.

## Candidate ledger

| Кандидат | Роль | Уверенность | Решение |
|---|---|---|---|
| `26a344f042a6d907a3c3de96540a9f241256739d` | последний доступный product commit той же Claude-сессии | высокая кандидатная | не повышать до exact head |
| `0f7cefbb20abb17c65872e53c00c733c480f2a97` | точный post-reset ref из снимка | точная только после reset | не является искомым head |
| `32f0c45e37b14a383b89616cc0017394a24b77fb` | одноимённая AuditRepo ветка | cross-repo evidence | не product head |
| `0659e20c15ab1221f09b62aaf0d3746a24f399ed` | одноимённая Research ветка | cross-repo evidence | не product head |

## Chain of custody

- Drive file ID: `1duSRvMPOemunrgg58SZP9bP3R4Ojl-rs`
- Exact name: `000005__04-all-refs.txt`
- Method: authenticated read-only Drive fetch; exact branch-line match.
- Verified: `2026-08-01`.
- Evidence-line digest: `68fa9da6ce21d85aa084ae83a5a6b168fb756aae70aac946b622dddf7ad4670e`.
- File-level SHA-256 не заявляется: connector предоставил текстовую проекцию, а не доказанный raw-byte manifest.

Дополнительные архивные файлы:

- `1zbIuN1mTay9QvmGyuGFLhnyLOaivfFPY` — `000003__02-fetch.txt`;
- `1Kt6dOSnc-x2cWEFoFfZX43R5GhiMQ4FK` — `000010__09-merged-branches.txt`.

Они подтверждают состояние refs после governance cleanup, но не восстанавливают старый head.

## Fail-closed правило

Статус можно изменить на `RECOVERED_EXACT_HEAD` только если появится хотя бы один immutable источник, который **прямо** связывает имя product-ветки со старым SHA:

- reflog/packed-ref старого клона до reset;
- GitHub audit-log/ref-update old SHA → new SHA;
- Actions artifact/log с branch name и exact head;
- PR record с сохранённым original product head.

Сходство файлов, порядок коммитов или принадлежность одной Claude-сессии недостаточны.

## Изменение продукта

Читательских routes, CSS, JS, данных карт, search, print, TTS и production assets не меняется. Эта lane фиксирует только evidence semantics и машинный запрет на ложное восстановление SHA.

## Финальный формат

- **Status:** `BLOCKED_PROVENANCE`
- **Base SHA:** `be970bfc13882119e99605ba1689605af4a4af8a`
- **Final PR head:** заполняется PR metadata
- **Merge commit:** заполняется после guarded merge
- **Main verification SHA:** заполняется после merge
- **Changed repositories:** `FedorMilovanov/gb-is-my-strength`
- **Closed defects:** снята неопределённость между доказанным post-reset ref и недоказанным pre-reset head; установлен fail-closed contract.
- **Remaining blockers:** отсутствует прямой pre-reset ref/reflog/PR-head/artifact.
- **Warnings:** `26a344f...` остаётся кандидатом, не exact head.
- **Artifacts and digests:** ledger + report + evidence-line SHA-256 `68fa9da6ce21d85aa084ae83a5a6b168fb756aae70aac946b622dddf7ad4670e`.
- **Review threads:** должны быть `0` перед merge.
- **Branch disposition:** текущая историческая ветка — `UNKNOWN_PROTECTED`; lane-ветка после merge очищается по lifecycle.
- **Production boundary:** source evidence only; production не заявляется.
- **Next unblocked task:** любой независимый Agent; Agent 03 остаётся после завершения активного handoff.
