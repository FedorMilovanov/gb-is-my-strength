## 🛠 ТЕХНИЧЕСКИЙ ПАСПОРТ СРЕДЫ (Verified 2026-06-23)

**Эта информация подтверждена путем прямой диагностики системы в текущей сессии:**

- **Архитектура:** [E2B](https://e2b.dev) / Firecracker microVM (выделенное ядро Linux для каждой сессии).
- **ОС:** `Debian GNU/Linux 13 (trixie)` (последняя testing/next stable).
- **Ресурсы:** 2 vCPU, ~2 GB RAM, ~22 GB Disk.
- **Права:** Полный root-доступ через `sudo` (без пароля). Можно устанавливать любой системный софт и менять любые конфиги.
- **Сеть:** Исходящий трафик полностью открыт. Локальные сервера (localhost) доступны.
- **Маркеры:** Переменная `E2B_SANDBOX=true` подтверждает среду.

---
# ARENA SESSION MANUAL — выживание в песочнице

**Обновлено:** 2026-06-22
**Версия:** v8.0 (v7.1 + §16 VISION/IMAGE — полная диагностика зрения агентов + OCR-обход)
**Среда:** Arena.ai Agent Mode — Linux ext4, 2 CPU, 1.9GB RAM

---

## 0. ЭКСПЕРИМЕНТАЛЬНО ПРОВЕРЕНО (факты, не догадки) — обновлено v8

```
✅ Файлы СОХРАНЯЮТСЯ при падении сессии (ext4, не tmpfs)
✅ git remote СОХРАНЯЕТСЯ при падении (но токен в URL — нет, используй env var)
✅ git log/history СОХРАНЯЕТСЯ
✅ write_file РАБОТАЕТ (но иногда не синхронизируется с bash в той же сессии)
✅ edit_file В ЭТОЙ СЕССИИ СРАБОТАЛ НАДЁЖНО (3/3 правок без fuzzy-match ошибок) — v7: похоже стабилен для точных правок
✅ python3 -c РАБОТАЕТ
✅ sed -i РАБОТАЕТ (всегда)
✅ npm ci РАБОТАЕТ и БЫСТРЕЕ npm install (~7 сек, 477 пакетов)
✅ generate_image НЕ НУЖЕН для visual proof — pixelmatch + скриншоты дают объективный diff
✅ OCR (tesseract) РАБОТАЕТ для текстовых скриншотов — установить: sudo apt install tesseract-ocr tesseract-ocr-rus + pip install pytesseract
✅ PIL/Pillow РАБОТАЕТ для анализа изображений (цвета, размер, тема)
❌ VISION МОЖЕТ ОТСУТСТВОВАТЬ — зависит от модели, а не от платформы (см. §16)
❌ edit_file иногда ПАДАЕТ на крупных блоках (используй sed -i или python3 для надёжности)
❌ read_file гигантских файлов >500KB может упасть
❌ Теряется только НЕДОПИСАННЫЙ ответ агента (середина сообщения)
❌ Токен в открытом чате = СКОМПРОМЕТИРОВАН (см. §8.4)
```

```
✅ Файлы СОХРАНЯЮТСЯ при падении сессии (ext4, не tmpfs)
✅ git remote СОХРАНЯЕТСЯ при падении (но токен в URL — нет, используй env var)
✅ git log/history СОХРАНЯЕТСЯ
✅ write_file РАБОТАЕТ (но иногда не синхронизируется с bash в той же сессии)
✅ edit_file В ЭТОЙ СЕССИИ СРАБОТАЛ НАДЁЖНО (3/3 правок без fuzzy-match ошибок) — v7: похоже стабилен для точечных правок
✅ python3 -c РАБОТАЕТ
✅ sed -i РАБОТАЕТ (всегда)
✅ npm ci РАБОТАЕТ и БЫСТРЕЕ npm install (~7 сек, 477 пакетов)
✅ generate_image НЕ НУЖЕН для visual proof — pixelmatch + скриншоты дают объективный diff
❌ edit_file иногда ПАДАЕТ на крупных блоках (используй sed -i или python3 для надёжности)
❌ read_file гигантских файлов >500KB может упасть
❌ Теряется только НЕДОПИСАННЫЙ ответ агента (середина сообщения)
❌ Токен в открытом чате = СКОМПРОМЕТИРОВАН (см. §8.4)
```

## 0.5 ВНЕШНИЕ РЕФЕРЕНСЫ (неподтверждённые данные из поиска, 2026-06-21)

- **Qwen Code Arena docs** (qwenlm.github.io): `maxRoundsPerAgent` default = 50, `timeoutSeconds` = 600.
  Применимость к Arena.ai неподтверждена, но если похожая архитектура — лимит ~50 раундов/итераций,
  не 3 tool calls за turn. Tool calls внутри одного turn могут быть параллельными (Smart Tool Parallelism).
- **Reddit r/lmarena**: пользователи сообщают о баге — нельзя удалить чат в agent mode.
  Также неясно, какая именно модель/провайдер обрабатывает запрос (8B vs 1T+ параметров).
- **Вывод для агентов**: лимит — не количество tool calls за turn, а общее количество раундов (turns)
  + context window + timeout. Практика: 1-2 tool calls + короткий ответ = меньше токенов за раунд,
  что позволяет больше раундов до переполнения context window.

## 1. Главное: версии и обходные пути

| Компонент | Реальная версия | Нужная версия | Workaround |
|---|---|---|---|
| Node.js | **20.20.2** (default) | **22.12.0+** (для Astro 6) | Скачать бинарь: `wget -q https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-x64.tar.xz -O /tmp/node22.tar.xz && tar -xf /tmp/node22.tar.xz -C /tmp/ && export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH` |
| Playwright Chromium | требуется v1223 (или v1228) | любая | `npx playwright install chromium` (~115 MB, ~30 сек). Делать ПОСЛЕ `npm install` — он сам подберёт нужную версию |
| Python (для static server) | 3.13 | любой | `python3 -m http.server PORT --bind 127.0.0.1 --directory DIR` |
| Bash | 5.x | любой | работает нормально |

**Каждая новая сессия → надо ставить заново.** `dist/`, `node_modules/`, `/tmp/node-v22*`, `~/.cache/ms-playwright/` — НЕ переживают между сессиями.

---

## 1.5 Speed/quality gate discipline for Arena

Arena Agent Mode is fast for file edits and static Node scripts, but expensive for full Astro gates:

```text
fast static guards: usually seconds
validate:static-publication: often ~2–3 minutes in this sandbox
fresh worktree + npm ci + Astro check/build: can hit 2 GB RAM / timeout and be killed
```

**Do not run the full gate after every tiny edit.** Use this loop:

```bash
# one-time per fresh session
cd /home/user/gb-is-my-strength
if [ ! -x /tmp/node-v22.12.0-linux-x64/bin/node ]; then
  wget -q https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-x64.tar.xz -O /tmp/node22.tar.xz
  tar -xf /tmp/node22.tar.xz -C /tmp/
fi
export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH
npm ci

# fast loop after small edits
git diff --check
npm run migration:metadata:check
npm run native:runtime:audit:strict
npm run data:consistency
npm run content:parity
npm run guard:shared-files

# final release barrier before commit/merge/push of production/system/refactor lanes
npm run validate:static-publication
npm run guard:shared-files
```

Pick only relevant fast checks for the files changed. Examples:

| Changed area | Fast checks |
|---|---|
| docs only | `git diff --check` |
| content/MDX/search/series | `git diff --check`, `npm run data:consistency`, `npm run content:parity`, `npm run mdx:structure:audit` |
| route/migration metadata | `npm run migration:metadata:check`, `npm run native:runtime:audit:strict` |
| package/workflows/scripts/shared | `npm run guard:shared-files`, `npm run workflows:check`, relevant direct script |

**Quality rule:** fast checks are iteration tools, not a replacement for the final full gate. If `validate:static-publication` cannot run because of sandbox limits, document the exact blocker in the lane report and let CI/owner decide.

**Performance rules that actually help:**

- reuse one working copy; avoid fresh `git worktree + npm ci` unless conflict isolation is required;
- keep Node 22 in `PATH` for every bash call (`PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH ...` if export is not persistent);
- use `npm ci`, not `npm install`, in fresh sessions;
- do not run multiple Astro builds in parallel on this 2 CPU / ~2 GB RAM sandbox;
- use parallel tool calls only for independent static checks, not build-heavy commands.

---

## 1.6 External reference pass (2026-06-24, 30+ links)

These links were checked to validate/improve the Arena operating rules. Treat them as external references; local project contracts (`AGENTS.md`, `WORK_MODES.md`, lane policy, migration matrix) remain authoritative.

### Agent/Arena/session limits

1. Qwen Code Agent Arena — worktree base dir, `maxRoundsPerAgent=50`, `timeoutSeconds=600`, independent agents, stale worktree advice: https://qwenlm.github.io/qwen-code-docs/en/users/features/arena/
2. Qwen Code settings — session/tool/wall-time controls and context compression settings: https://qwenlm.github.io/qwen-code-docs/en/users/configuration/settings/
3. Qwen Code model providers — provider generation timeout examples: https://qwenlm.github.io/qwen-code-docs/en/users/configuration/model-providers/
4. OpenCode agents — `steps` limit for agentic iterations: https://opencode.ai/docs/agents/

### E2B / sandbox lifecycle and isolation

5. E2B sandbox docs — timeout, `setTimeout`, sandbox info, pause/resume: https://e2b.dev/docs/sandbox
6. E2B Python SDK sandbox reference — timeout defaults, connect/kill/files/commands/PTY: https://e2b.dev/docs/sdk-reference/python-sdk/v1.3.2/sandbox_sync
7. E2B JS SDK sandbox reference — timeout/envs/connect/upload APIs: https://e2b.dev/docs/sdk-reference/js-sdk/v1.0.2/sandbox
8. CrewAI E2B sandbox tools — persistent vs ephemeral mode, per-command timeout, avoid long-lived secrets: https://docs.crewai.com/en/tools/ai-ml/e2bsandboxtools
9. Docker E2B sandboxes/MCP — explicit cleanup with `kill()`, secrets via env: https://docs.docker.com/ai/mcp-catalog-and-toolkit/e2b-sandboxes/
10. Vercel Sandbox vs E2B — Firecracker isolation, persistence/runtime comparison: https://vercel.com/kb/guide/vercel-sandbox-vs-e2b
11. Vercel Sandbox agent guide — microVM resources/timeout options: https://vercel.com/kb/guide/building-an-agent-with-openai-agents-sdk-and-vercel-sandbox
12. ZenML E2B vs Daytona — timeout-first lifecycle, pause/resume, auto-pause: https://www.zenml.io/blog/e2b-vs-daytona
13. Northflank E2B vs Modal — session scope, persistence, runtime comparison: https://northflank.com/blog/e2b-vs-modal
14. Firecrawl AI agent sandbox — Firecracker microVM isolation and timeout levels: https://www.firecrawl.dev/blog/ai-agent-sandbox
15. SoftwareSeni sandboxing problem — microVM vs containers/gVisor, defense in depth: https://www.softwareseni.com/ai-agents-in-production-the-sandboxing-problem-no-one-has-solved/
16. Spheron E2B/Daytona/Firecracker overview — persistent multi-turn state and pause/resume: https://www.spheron.network/blog/ai-agent-code-execution-sandbox-e2b-daytona-firecracker/
17. Novita E2B persistence — pause/resume preserves filesystem and memory: https://novita.ai/docs/guides/sandbox-e2b-sandbox-persistence
18. LogRocket E2B agent article — filesystem workflow and cleanup pattern: https://blog.logrocket.com/building-deploying-ai-agents-e2b/
19. Smithery E2B sandbox skill — absolute paths, timeouts, metadata, monitor usage: https://smithery.ai/skills/padak/e2b-sandbox

### npm / Node / Astro

20. npm ci vs install — deterministic CI behavior and cache `~/.npm`: https://michalsniezko.github.io/devops-infrastructure-cicd/npm-install-vs-ci.html
21. Baeldung npm install vs npm ci — clean install, lockfile mismatch behavior: https://www.baeldung.com/ops/npm-install-vs-npm-ci
22. Oracle npm-ci manpage — `npm ci` can be faster, removes `node_modules`, never writes lockfiles: https://docs.oracle.com/cd/E88353_01/html/E37839/npm-ci-1.html
23. actions/setup-node advanced usage — built-in npm cache keyed by lockfile: https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md
24. actions/setup-node caching ADR — cache input design for npm/yarn: https://github.com/actions/setup-node/blob/main/docs/adrs/0000-caching-dependencies.md
25. Astro v6 upgrade guide — Node `22.12.0+` required: https://docs.astro.build/en/guides/upgrade-to/v6/
26. Astro 6 release blog — Node 22+, Vite 7, build/runtime changes: https://astro.build/blog/astro-6/
27. Astro 6 beta blog — Node 22+ support change: https://astro.build/blog/astro-6-beta/

### Playwright / CI acceleration

28. Argos Playwright speed guide — cache browser binaries, install only Chromium, Docker option: https://argos-ci.com/blog/speed-up-playwright
29. GitHub Community npm+Playwright cache discussion — cache `~/.npm` and `~/.cache/ms-playwright`: https://github.com/orgs/community/discussions/187290
30. Foosel Playwright GitHub Actions — cache keyed by Playwright version, install deps on cache hit: https://foosel.net/til/how-to-run-playwright-on-github-actions/
31. TestDino Playwright actions guide — cache browsers, conditional install-deps, savings: https://testdino.com/blog/playwright-in-github-actions
32. Qaskills Playwright CI guide — cache, sharding, artifact strategy: https://qaskills.sh/blog/playwright-ci-github-actions-complete-guide-2026
33. DevActivity Chromium issue — `playwright install --with-deps chromium` fixes missing binary/libs: https://devactivity.com/posts/development-integrations/boost-your-seo-fixing-playwright-chromium-issues-in-github-actions/
34. Grafana plugin-ci issue — verify cache-hit and expected seconds saved: https://github.com/grafana/plugin-ci-workflows/issues/405
35. dotCMS Playwright caching issue — cache browser binaries keyed on Playwright package version: https://github.com/dotCMS/core/issues/34753

### Git worktree / multi-agent hygiene

36. Termdock worktree multi-agent setup — do not share a branch, prune stale worktrees, symlink `node_modules` only if deps unchanged: https://www.termdock.com/en/blog/git-worktree-multi-agent-setup
37. DXRF worktrees — remove/prune, parallel AI agents, one branch per worktree: https://dxrf.com/blog/2026/06/12/git-worktrees-work-on-multiple-branches/
38. Yasin Miran on agents/worktrees — `git worktree list`, avoid `rm -rf`, use `prune`: https://yasint.dev/agents-and-git-worktrees/
39. Augment guide — cleanup lifecycle, dependency ordering, merge queue risks: https://www.augmentcode.com/guides/git-worktrees-parallel-ai-agent-execution
40. gitworktree.org prune tutorial — dry-run/verbose prune and best practices: https://www.gitworktree.org/tutorial/prune

### Practical conclusions for this repo

- Keep the existing FAST/FULL gate split. External sources support the same pattern: cheap local checks during iteration; expensive build/browser gates at release boundary.
- Use `npm ci` in fresh sessions and avoid `npm install` unless intentionally changing dependencies.
- In GitHub Actions, if we later optimize workflows, cache npm via `setup-node cache: npm` and cache Playwright browsers by Playwright version / lockfile; still run `install-deps` on cache hit.
- In Arena, avoid multiple fresh worktrees with separate `npm ci`; use worktrees only for conflict isolation and remove with `git worktree remove`, then `git worktree prune`.
- Never store tokens in git remote URLs or long-lived sandbox files. Use temporary askpass/env and delete it.

## 1.7 Local timing proof (2026-06-24)

Measured in this Arena sandbox with Node `v22.12.0`, npm `10.9.0`, 2 CPU, ~1.9 GB RAM:

```text
FAST system loop:
  npm run guard:shared-files
  npm run data:consistency
  npm run migration:metadata:check
  npm run native:runtime:audit:strict
  npm run workflows:check
  => real=1.374 sec

FULL gate:
  npm run validate:static-publication
  => about 152 sec in tool runtime on this session
```

So the FAST loop is roughly two orders of magnitude faster for iteration feedback, while the FULL gate remains the required final release barrier.

---

## 1.8 Why some agents survive huge sessions and others fail early (2026-06-24)

Short answer:

```text
It is both model/agent-runtime quality AND operating discipline.
The Arena/E2B sandbox can support long work, but bad context hygiene, missing timeouts,
over-parallelization, giant tool outputs, uncheckpointed work, stale worktrees, and weak
compaction/handoff behavior can make an agent fail even on a small task.
```

### Failure taxonomy for Arena-style coding agents

| Failure mode | What it looks like | Likely cause | Mitigation in this repo |
|---|---|---|---|
| Context rot / drift | Agent forgets constraints, repeats failed approach, changes direction | Long noisy transcript, too many raw tool outputs, weak compaction | write decisions to lane report/docs; use FAST loop; summarize with file paths/checks; start fresh after major phase if quality drops |
| Compaction loss | After summary, agent forgets active branch/lane/rules/subagents | compaction summary omitted exact state | keep `AGENTS.md`, `WORK_MODES.md`, lane report, git commits as durable memory; update lane report before long breaks |
| Zombie/stalled tool call | Spinner/turn continues, no useful output | missing stream/tool timeout or hung subprocess | bash timeouts, avoid long background jobs, verify output files instead of trusting status text |
| Subagent black hole | parent waits forever or loses child state | subagent runtime/lifecycle bug, no output contract | prefer sequential work in this repo unless independent; require output files/reports; do not spawn many background agents at once |
| Resource/OOM kill | process killed during Astro/build/browser install | 2 CPU / ~2 GB RAM, multiple builds, fresh worktree npm install | do not parallelize Astro builds; reuse main working copy; use FAST loop before FULL gate |
| Tool-output bloat | context fills with huge logs/file dumps | reading giant files or verbose commands into chat | grep/sed targeted slices; write reports to files; use summaries, not raw logs |
| Environment reset | Node 20 used again, `dist` missing, browser missing | PATH/export not persistent, sandbox directories are ephemeral | prefix commands with `PATH=/tmp/node-v22...:$PATH`; run `npm ci`; document in SANDBOX |
| Git/worktree confusion | agent edits wrong branch or stale worktree | missing `git status`, stale worktrees, same branch checked out elsewhere | start with `git fetch`, `git status --short --branch`, `git worktree list`; remove/prune worktrees properly |
| Over-broad prompt | agent tries to “fix everything” and trips shared files | no lane scope, no allowed/forbidden files | `WORK_MODES`, `LANE_LOCK_POLICY`, migration matrix, out-of-lane reporting |
| Model/runtime variance | one model works for hours; another fails quickly | different context handling, tool-call reliability, compaction, rate limits, reasoning defaults | treat “agent” as a runtime+model+prompt system; keep state/checks in files so weaker agents recover |

### Deep reference pass — agent failure / long-session management (30+ links)

1. Codex config reference — per-tool MCP timeout, memory/consolidation knobs: https://developers.openai.com/codex/config-reference
2. Codex sample config — context window, auto-compact limit, tool output token limit, multi-agent runtime limits: https://developers.openai.com/codex/config-sample
3. Codex + Agents SDK workflow — `client_session_timeout_seconds`, gated multi-agent handoffs: https://developers.openai.com/cookbook/examples/codex/codex_mcp_agents_sdk/building_consistent_workflows_codex_cli_agents_sdk
4. Codex Agents SDK guide — MCP server kept alive across turns with long timeout: https://developers.openai.com/codex/guides/agents-sdk
5. Codex MCP docs — tool timeout defaults and per-server controls: https://developers.openai.com/codex/mcp
6. Codex prompting guide — shell tool should set workdir/timeout; plan hygiene: https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide
7. Codex slow performance article — reduce context, faster models for routine tasks, ignore files: https://inventivehq.com/knowledge-base/openai/how-to-fix-slow-performance
8. Codex compaction architecture — compaction can lose fidelity; preserve user messages and summaries: https://codex.danielvaughan.com/2026/03/31/codex-cli-context-compaction-architecture/
9. Codex issue — remote compaction timeout / misleading timeout errors: https://github.com/openai/codex/issues/14860
10. Codex discussion — better handoff-oriented compaction summary prompt: https://github.com/openai/codex/discussions/17330
11. Claude Code context loss article — session spec files, decision comments, checkpoint summaries, commits as anchors: https://dev.to/whoffagents/why-your-claude-code-sessions-keep-losing-context-and-how-to-fix-it-nia
12. Claude session limits article — proactive compaction and explicit preservation: https://www.mindstudio.ai/blog/how-to-manage-claude-session-limits
13. Claude Code error reference — context/entitlement errors and auto-compaction behavior: https://code.claude.com/docs/en/errors
14. Claude context Reddit thread — project files/PLAN.md as memory, subagents as context saver: https://www.reddit.com/r/ClaudeAI/comments/1rrkv0h/how_are_you_guys_managing_context_in_claude_code/
15. Claude Code session management guide — compact/clear/handoff and CLAUDE.md continuity: https://www.sitepoint.com/claude-code-context-management/
16. Claude Code memory best practices — memory protocol, progress file, git logs: https://orchestrator.dev/blog/2026-04-06--claude-code-agent-memory-2026/
17. Claude Code compaction explained — what survives, custom compact prompt, keep critical rules in files: https://okhlopkov.com/claude-code-compaction-explained/
18. Claude cookbook context engineering — clear tool uses, compaction, file-backed memory: https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools
19. Claude cookbook session memory compaction — structured summary format and preserve rules: https://platform.claude.com/cookbook/misc-session-memory-compaction
20. Dive into Claude Code paper — CLAUDE.md hierarchy, hooks, sidechain transcripts, subagent isolation: https://arxiv.org/html/2604.14228v1
21. Dive into Claude Code repo summary — memory/context/subagent architecture comparison: https://github.com/VILA-Lab/Dive-into-Claude-Code
22. Inside Claude Code article — subagents/worktrees as context and blast-radius boundaries: https://www.penligent.ai/hackinglabs/inside-claude-code-the-architecture-behind-tools-memory-hooks-and-mcp/
23. Claude agent team issue — team state lost after compaction in long session: https://github.com/anthropics/claude-code/issues/23620
24. Claude Code compaction timeout issue — session-destroying compaction failures: https://github.com/anthropics/claude-code/issues/2423
25. Claude Code background subagent zombie issue — stale running subagents and infinite stop loop: https://github.com/anthropics/claude-code/issues/58637
26. Claude Code Task timeout issue — subagent hang with completed files on disk: https://github.com/anthropics/claude-code/issues/49150
27. OpenCode subagent hang issue — stream idle timeout and subagent-level timeout recommendations: https://github.com/anomalyco/opencode/issues/13841
28. OpenClaw agent loop — run timeout, wait timeout, compaction events, stale child session prevention: https://docs.openclaw.ai/concepts/agent-loop
29. AI agents stalled tasks article — wall-clock timeouts, checkpoint heartbeats, output verification: https://dev.to/bobrenze/how-ai-agents-handle-stalled-tasks-and-timeouts-lessons-from-my-production-failure-1jj9
30. AWS agent failure modes — context overflow, MCP timeouts, reasoning loops, memory pointer pattern: https://dev.to/aws/why-ai-agents-fail-3-failure-modes-that-cost-you-tokens-and-time-1flb
31. Google ADK long-running agents — durable state, checkpoint/resume, persistent session storage: https://developers.googleblog.com/build-long-running-ai-agents-that-pause-resume-and-never-lose-context-with-adk/
32. Microsoft swarm diaries — contracts, zero-tool guards, verify actual files not reports: https://techcommunity.microsoft.com/blog/appsonazureblog/the-swarm-diaries-what-happens-when-you-let-ai-agents-loose-on-a-codebase/4501393
33. Bob Renze subagent orchestration — synchronous timeout, polling, output validation: https://dev.to/bobrenze/ai-agent-subagent-orchestration-when-to-spawn-vs-when-to-do-it-yourself-4opg
34. Agentic patterns snippets — file checkpoints and state directories for resumability: https://esc5221.github.io/awesome-agentic-patterns/
35. Code as Agent Harness paper — filesystem-backed plans and state as harness objects: https://arxiv.org/html/2605.18747v1
36. Context engineering article — subagents get scoped context, progress files survive compaction: https://www.morphllm.com/context-engineering
37. Augment context constraints — reset architecture with filesystem/git durable storage: https://www.augmentcode.com/guides/ai-agent-loop-token-cost-context-constraints
38. DigitalApplied context reliability playbook — four context failure modes and levers: https://www.digitalapplied.com/blog/context-engineering-agent-reliability-playbook-2026
39. Lushbinary context engineering guide — write/select/compress/isolate strategies: https://lushbinary.com/blog/context-engineering-ai-agents-production-guide/
40. MindStudio context rot article — larger context delays but does not prevent rot: https://www.mindstudio.ai/blog/context-rot-ai-coding-agents-explained
41. MindStudio context rot explanation — fresh sessions need grounding docs, decisions files: https://www.mindstudio.ai/blog/what-is-context-rot-ai-coding
42. Zylos context compression strategies — trigger compaction at 70%, tool output verbosity as token killer: https://zylos.ai/research/2026-02-28-ai-agent-context-compression-strategies/
43. O-mega long-running coding agents guide — context overflow/drift/cost failure modes: https://o-mega.ai/articles/long-running-coding-agents-the-2026-guide
44. Mem0 Hermes vs Claude compression — compression drops exact constraints; persistent memory closes gap: https://mem0.ai/blog/how-hermes-and-claude-handle-context-compression-in-real-production-agents-(and-what-you-should-extract)
45. Microsoft agent failure taxonomy — session context contamination and memory poisoning: https://www.microsoft.com/en-us/security/blog/2026/06/04/updating-taxonomy-failure-modes-agentic-ai-systems-year-red-teaming-taught-us/
46. MCP in production — limit tool count/description size, manage state and context bleed: https://bytebridge.medium.com/what-it-takes-to-run-mcp-model-context-protocol-in-production-3bbf19413f69
47. Subagents for codebase analysis — chunk large files and consolidate summaries: https://www.mindstudio.ai/blog/sub-agents-codebase-analysis-context-limits
48. Hindsight subagent shared memory — subagents solve context bloat but need shared learning layer: https://hindsight.vectorize.io/blog/2026/05/06/claude-code-subagents-shared-memory
49. Agent context windows guide — memory-first platform discussion and failure modes: https://sparkco.ai/blog/agent-context-windows-in-2026-how-to-stop-your-ai-from-forgetting-everything
50. Agent Context Engineering 2026 — production agents break before nominal context limit: https://agentmarketcap.ai/blog/2026/04/11/agent-context-engineering-sliding-windows-memory-2026

### Practical answer for Arena agents

Some agents fail in tiny tasks because they carry too much irrelevant context, use fragile tool loops, miss timeouts, or lose state at compaction. Some agents can run huge tasks because they:

- keep stable rules in files (`AGENTS.md`, `WORK_MODES.md`, lane reports), not only chat;
- write checkpoints/progress to disk before context gets noisy;
- use targeted reads and do not paste giant outputs into context;
- enforce timeouts and verify output artifacts;
- use git commits as durable state markers;
- run fast checks often and full gates at release boundaries;
- avoid parallel heavy builds and unbounded background subagents in a small sandbox.

So the environment is capable of long sessions, but long sessions are reliable only when the agent works like an engineer with a runbook, not like a chat model improvising from a growing transcript.

---

## 1.9 Arena coding polish — practical long-session rules (2026-06-24)

This is the practical checklist distilled from the reference passes above. It is intentionally repetitive: future agents should not need to rediscover these under pressure.

### 30 operational rules for Arena coding

1. Start every turn with `git status --short --branch` when changes may exist.
2. Run `git fetch --all --prune` before lane/merge/conflict decisions.
3. Confirm branch and latest commit before editing shared/system files.
4. Keep one active working copy for normal work; use extra worktrees only for conflict isolation.
5. Remove diagnostic worktrees with `git worktree remove --force <path>` and then `git worktree prune`.
6. Never rely on shell `export` persisting across tool calls; prefix Node commands with `PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH`.
7. Use `npm ci` in fresh sessions; use `npm install` only when intentionally changing dependencies/lockfile.
8. Use FAST loop during iteration; reserve `validate:static-publication` for release barrier.
9. Do not run two Astro builds/full gates in parallel in 2 CPU / ~2 GB RAM sandbox.
10. Use targeted file reads (`sed -n`, `grep`, `rg`) instead of dumping large files into chat.
11. Write long analysis into repo docs/lane reports, not only the conversation.
12. Treat lane reports as durable memory before compaction, interruption, or handoff.
13. Use git commits as state checkpoints after meaningful, verified changes.
14. If an agent claims completion, verify artifacts: files, diff, commands, exit codes.
15. Do not trust subagent/status text without output files or concrete evidence.
16. Avoid unbounded background jobs; if needed, record PID/log path and poll explicitly.
17. Avoid spawning many background subagents in one turn; prefer sequenced lanes unless work is independent.
18. For multi-agent work, assign disjoint file scopes and one branch/worktree per agent.
19. For route work, check `migration/route-migration-matrix.json` before editing.
20. For app/interactive routes, do not “simplify” to article/native layout without runtime smoke.
21. For docs-only edits, use `git diff --check`; do not waste 2–3 minutes on full gate every sentence.
22. For shared/system docs, still run `guard:shared-files` and record lane tag in commit.
23. For workflow/package/script changes, run `workflows:check`, package script reference checks, and relevant direct script.
24. For Playwright/browser checks, install only Chromium and dependencies when needed; avoid browser downloads during non-visual docs work.
25. Keep tokens/secrets out of git remotes, docs, shell history, and long-lived files; use temporary askpass/env and delete.
26. If context feels noisy, write a compact checkpoint to a file and continue from that file, not from memory.
27. If the agent repeats failed attempts twice, stop, summarize facts, reread source-of-truth files, and change approach.
28. If a command may be long, set an explicit timeout and redirect verbose output to a file.
29. If full gate fails, record exact failing command and first actionable error, not the whole log dump.
30. Before push: clean status, final guard, remote URL clean, and token string absent from workspace/tmp.

### Additional Arena/coding references (30 links)

These focus on hands-on coding-agent operation: hooks, compaction, worktrees, long-running tasks, sandbox runtime, and verification.

1. Long-running coding agents and subagent/worktree isolation: https://o-mega.ai/articles/long-running-coding-agents-the-2026-guide
2. Addy Osmani on long-running agents, hooks, plan files, worktrees, commits: https://addyo.substack.com/p/long-running-agents
3. Real-world coding LLM selection and workflow harness importance: https://dev.to/danishashko/the-best-llms-for-agentic-coding-in-2026-real-world-not-just-benchmarks-96n
4. Codex best practices — threads, worktrees, `/compact`, `/agent`, sandbox/approval knobs: https://developers.openai.com/codex/learn/best-practices
5. Top code sandboxes for AI agents and why isolation matters: https://dev.to/thedailyagent/top-5-code-sandboxes-for-ai-agents-in-2026-58id
6. Code sandbox options and long-lived workspace tradeoffs: https://www.sashido.io/en/blog/code-sandbox-options-for-ai-agents
7. Google ADK long-running agents, checkpoint/resume, durable session state: https://developers.googleblog.com/build-long-running-ai-agents-that-pause-resume-and-never-lose-context-with-adk/
8. Agent runtime infrastructure: per-agent quotas, loop limits, tool timeouts: https://www.augmentcode.com/guides/agent-runtime-infrastructure-layer
9. Parallel worktrees and clear instructions for agents: https://laurentkempe.com/2026/03/31/from-3-worktrees-to-n-ai-powered-parallel-development-on-windows/
10. Builder Claude Code tips — hooks, compact reminders, loops, notifications: https://www.builder.io/blog/claude-code-tips-best-practices
11. Claude Code hooks guide — block dangerous commands, reinject context after compact: https://israynotarray.com/en/ai/2026/05/31/claude-code-hooks-complete-guide/
12. Claude Code hooks examples — SessionStart, PreToolUse, Stop hooks: https://aiorg.dev/blog/claude-code-hooks
13. Claude hooks for hardened workflows and Stop verification hooks: https://thomas-wiegold.com/blog/claude-code-hooks/
14. Long-running Claude sessions and mobile/notification monitoring discussion: https://www.reddit.com/r/ClaudeAI/comments/1qkqd8m/longrunning_claude_code_sessions_have_a/
15. Claude Code advanced hook/monitoring usage: https://dev.to/holasoymalva/the-ultimate-claude-code-guide-every-hidden-trick-hack-and-power-feature-you-need-to-know-2l45
16. Advanced Claude Code best practices and `/clear` after repeated failure: https://smartscope.blog/en/generative-ai/claude/claude-code-best-practices-advanced-2026/
17. Inside Claude Code — memory, hooks, MCP, subagents, worktrees: https://www.penligent.ai/hackinglabs/inside-claude-code-the-architecture-behind-tools-memory-hooks-and-mcp/
18. Claude Code hooks production reference and debugging/exit-code details: https://thepromptshelf.dev/blog/claude-code-hooks-complete-reference-2026/
19. VibeCoding hooks guide — notifications, auto-tests, auto-commits caveat: https://www.vibecodingacademy.ai/blog/claude-code-hooks-complete-guide
20. Agent task stalls and zombie task detection: https://dev.to/bobrenze/how-ai-agents-handle-stalled-tasks-and-timeouts-lessons-from-my-production-failure-1jj9
21. AWS agent failure modes — context overflow, MCP timeouts, reasoning loops: https://dev.to/aws/why-ai-agents-fail-3-failure-modes-that-cost-you-tokens-and-time-1flb
22. Microsoft Swarm Diaries — contracts, zero-tool guards, verify actual files: https://techcommunity.microsoft.com/blog/appsonazureblog/the-swarm-diaries-what-happens-when-you-let-ai-agents-loose-on-a-codebase/4501393
23. OpenCode subagent hangs and stream idle timeout discussion: https://github.com/anomalyco/opencode/issues/13841
24. Claude background subagent zombie issue: https://github.com/anthropics/claude-code/issues/58637
25. Claude Task timeout issue with completed work on disk: https://github.com/anthropics/claude-code/issues/49150
26. Context engineering reliability playbook: https://www.digitalapplied.com/blog/context-engineering-agent-reliability-playbook-2026
27. Context engineering production guide — write/select/compress/isolate: https://lushbinary.com/blog/context-engineering-ai-agents-production-guide/
28. Agentic patterns — checkpoint files and resumability: https://esc5221.github.io/awesome-agentic-patterns/
29. Code as Agent Harness — filesystem-backed plans and verifiable state: https://arxiv.org/html/2605.18747v1
30. Context engineering: subagents with exact context and progress files: https://www.morphllm.com/context-engineering

### Extra polish conclusions for this repo

- We do not need more “read everything every time”; we need source-of-truth docs plus targeted rereads.
- The fastest reliable loop is not “small task only”; it is **large task with durable checkpoints and bounded checks**.
- A capable Arena agent can close large work in one session if it treats filesystem/git as memory and avoids unbounded transcript growth.
- Agents that fail early usually fail because they keep state in chat, over-read/over-output, lack timeouts, or trust status text instead of artifacts.

---

## 2. Astro build — почему падает и как чинить

Astro 6 REFUSES запускаться на Node 20:
```
Node.js v20.20.2 is not supported by Astro!
Please upgrade Node.js to a supported version: ">=22.12.0"
```

**Решение (3 команды):**
```bash
cd /home/user/gb-is-my-strength
export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH
npm run astro:build  # или npm run strangler:build:production-like
```

После этого `dist/` создаётся, 52 страницы собираются за ~10 сек.

---

## 3. Playwright quirks

### 3.1 Версия Chromium
- npm install ставит Playwright 1.60+
- Playwright 1.61+ требует chromium-headless-shell v1223 или v1228
- При первом `npm install` Playwright **НЕ** скачивает браузер автоматически
- Нужно отдельный шаг: `npx playwright install chromium`

### 3.2 Алиас пути
По умолчанию Playwright ставит в `~/.cache/ms-playwright/`. Если запустить `npx playwright install` ДО `npm install`, будет конфликт версий. **ПОРЯДОК:**
1. `npm install` (ставит Playwright в node_modules)
2. `npx playwright install chromium` (скачивает нужный браузер)

### 3.3 Lazy-load protection в visual-parity скриптах
`scripts/visual-parity-screenshots.js` (324 строк) делает:
- `img.loading = 'eager'` + `img.decode()` — чтобы lazy-load не врал
- bottom→top scroll для trigger IntersectionObserver
- `waitForLoadState('networkidle')` + повторный после scroll
- `animation: none !important` инжектится inline style tag

Без этих защит первый прогон pixel-diff выдаёт ложные красные пятна. **Не "упрощай"** этот скрипт.

### 3.4 Ошибка которую я ловил
```
FATAL browserType.launch: Executable doesn't exist at /home/user/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell
```
**Причина:** Playwright 1.61 хочет v1223, после `npm install` Playwright обновился до версии, требующей другую версию браузера.
**Решение:** `npx playwright install chromium` (он скачает нужную).

### 3.5 НЕДОСТАЮЩИЕ СИСТЕМНЫЕ БИБЛИОТЕКИ chromium (v7, КРИТИЧНО)
После `npx playwright install chromium` браузер скачивается, но **НЕ запускается**:
```
chrome-headless-shell: error while loading shared libraries: libnspr4.so: cannot open shared object file
```
Sandbox не имеет нативных библиотек Chromium. **Решение (одно из двух):**
```bash
# Вариант A — официальный установщик Playwright (ставит всё сразу, ~20 сек):
sudo npx playwright install-deps chromium

# Вариант B — точечно через apt (если A недоступен):
sudo apt-get install -y -qq libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
  libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0
```
`sudo` **работает** в sandbox (password-less root). НОВАЯ находка v7.

### 3.6 Симптом «chromium скачан, но launch() exit 127» = тот же баг §3.5
Если `npx playwright install` прошёл без ошибок, но `launch()` падает с exitCode 127 — это 100% отсутствующие shared libraries. Не переустанавливай playwright, не меняй версию — стави `install-deps`.

---

## 4. Static server для Playwright

`python3 -m http.server 8091 --bind 127.0.0.1 --directory dist &` — НО:

### 4.1 Cwd проблема (#1 причина 404)
Если запустить БЕЗ `--directory`, сервер стартует от `/home/user/gb-is-my-strength` (cwd). Нужно **явно**:
```bash
nohup python3 -m http.server 8091 --bind 127.0.0.1 --directory dist > /tmp/server.log 2>&1 &
```
Иначе cwd может измениться между сессиями и сервер будет показывать не то.

### 4.2 Cwd "deleted" проблема (#2 причина 404)
В этом sandbox сервер Python сохраняет cwd через `/proc/$PID/cwd`. Если файл/директория cwd **была пересоздана** (например, sandbox cleanup), то `/proc/$PID/cwd` указывает на `(deleted)`. Сервер тогда отдаёт 404 на все пути, **даже если файл существует**.

**Симптом:** `curl -sI http://127.0.0.1:8091/` возвращает `HTTP/1.0 404 File not found`.
**Решение:** `kill PID && nohup python3 -m http.server 8091 --bind 127.0.0.1 --directory /home/user/gb-is-my-strength/dist &` (перезапуск с АБСОЛЮТНЫМ путём).

### 4.3 Two servers на разных портах
- `:8090` = legacy root `/home/user/gb-is-my-strength` (там обычные `index.html` файлы)
- `:8091` = dist `/home/user/gb-is-my-strength/dist` (там собрано Astro)

**КРИТИЧНО:** dist НЕ содержит css/ напрямую — CSS лежит в `dist/_astro/*.css`. Поэтому `<link rel="stylesheet" href="/css/site.css">` будет 404 на dist-сервере. Реальные страницы Astro-роуты собирают CSS бандл в `/_astro/*.css` через `<link rel="stylesheet" href="/_astro/...">`. Но **shadow-wrapped legacy** страницы (Astro-owned типа `/about/`, `/articles/`) используют `loadLegacyFullDocument` который добавляет original `<link rel="stylesheet" href="/css/site.css">` — а этого файла в dist нет!

**Решение:** Тестировать shadow-wrapped страницы надо из legacy root (`:8090`). Тестировать native Astro страницы — из dist (`:8091`).

### 4.4 pkill может не убить процесс
`pkill -f "http.server"` иногда не находит. Использовать `ps aux | grep http.server` + `kill PID`.

---

## 5. dist/ исчезает после каждой сессии

После завершения сессии workspace очищается. `dist/`, `node_modules/`, `/tmp/*`, `~/.git/` (иногда!) удаляются. Поэтому:

- НЕ сохраняй критичные артефакты в `dist/` (он gitignored)
- Сохраняй ВСЕ важные отчёты в `audit/` или `reports/` (но они тоже gitignored)
- Если нужны скриншоты для PR — коммить их в отдельный commit с явным сообщением "transient visual artifacts"
- `.git` тоже может исчезнуть — `git clone` снова если нужно

---

## 6. SVG / CSS проверки

`grep -c "!important" css/site.css` — НЕПРАВИЛЬНО. Правильно:
```bash
grep -o "!important" css/site.css | wc -l
```
(grep -c считает СТРОКИ содержащие pattern, не вхождения pattern'а.)

---

## 6.5 SVG SELF-CLOSING BYTE-PARITY GATE (v7, КРИТИЧНО ДЛЯ РЕФАКТОРИНГ 6.0)

**Невидимый блокер всей миграции leaf-replacement.** `scripts/astro-about-pilot-audit.js`
имел `checkFullDocumentParity()` — побайтовое сравнение нормализованного legacy vs dist HTML.
Он писался под эпоху `set:html` shadow (сырая строка сохраняла `<path/>`).

**Проблема:** hand-authored Astro сериализует пустые элементы как explicit-close:
```
legacy / set:html:   <path d="M...z"/>       <circle r="3"/>       <rect x="2"/>
hand-authored Astro: <path d="M...z"></path>  <circle r="3"></circle> <rect x="2"></rect>
```
Эти формы **СПЕЦИФИКАЦИОННО ЭКВИВАЛЕНТНЫ** в HTML5 — браузерный DOM идентичен,
pixel-diff = 0.0000%. Но byte-gate падал с ложным `❌ differs` (213 «diff-окон» = каскад
от 5 реальных точек сериализации).

**Без фикса КАЖДЫЙ мигрированный Astro-leaf с SVG падал бы в CI** — миграция 6.0 мертва.

**Фикс (применён, 2 коммита fix(audit-about)):** `normalizeHtmlForFullDocumentParity` теперь нормализует
к БРАУЗЕРНО-ЭКВИВАЛЕНТНОЙ форме, покрывая ДВА класса сериализационных ложных срабатываний:

**Класс A — самозакрывающиеся пустые элементы** (шаг 1, AboutArticle):
раскрыть `<x .../>` → `<x ...></x>` на ОБЕИХ сторонах:
```js
.replace(/(<([a-zA-Z][a-zA-Z0-9:-]*)(\s[^>]*?)?)\s*\/\s*>/g, '$1></$2>')
```

**Класс B — пробелы в текстовых узлах** (шаг 2, AboutAccuracyBlock):
компилятор Astro триммит ведущие/хвостовые пробелы внутри flow-text (отступная строка прозы
становится без отступа), а legacy-источник хранит отступ. Браузер коллапсирует их идентично.
Схлопнуть `\s+` → одиночный пробел на ОБЕИХ сторонах, КРОМЕ внутри whitespace-significant
элементов (`<pre>`, `<textarea>`) и raw-text (`<script>`, `<style>`) — их содержимое защищено
через placeholder-swap и сравнивается verbatim.

Проверено (обеими шагами /about/):
  - реальные регрессии **по-прежнему ловятся**: изменённое слово, изменённый id, удалённая секция
  - защищено: `<pre>` пробелы, `&nbsp;` entities, `%20` в mailto URL
  - pixelmatch desktop+mobile = 0 differing pixels

**Главный урок:** ЛЮБОЙ «byte-parity» гейт против hand-authored Astro должен нормализовать к
браузерно-эквивалентной форме, иначе он ловит сериализацию, а не баги. Юзай pixelmatch как
независимый арбитр.

**Урок для будущих агентов:** при любом «byte-parity» гейте ВСЕГДА проверяй, не сериализационная
ли это разница (self-close vs explicit-close, порядок атрибутов, кавычки). Юзай pixelmatch как
независимый объективный арбитр — он смотрит на пиксели, а не на байты.

## 6.6 astro:audit:about ВЫХОДИТ ДО СКРИНШОТОВ (v7, workflow gotcha)

`astro-about-pilot-audit.js` структура:
```
1. strangler:build
2. checkFullDocumentParity  ← если FAIL, process.exit(1) ЗДЕСЬ
3. Playwright screenshots/desktop/mobile/no-JS/SEO/JSON-LD/asset checks  ← не доходят
```
То есть **если byte-parity красная, ты НИКОГДА не увидишь скриншоты** из этого скрипта.
Они выполняются только после зелёного byte-гейта. Для отладки/visual proof когда gate ещё
красный — юзай **независимый** `scripts/about-leaf-parity-shots.js` (не зависит от byte-gate).

## 6.7 МЕТОД: pixelmatch как объективный арбитр parity (v7)

Для доказательства visual parity (особенно когда byte-diff есть, но подозреваешь что он
несущественный) — 3-шаговый метод, не зависит от гейтов проекта:
```bash
# 1. Снять скриншоты legacy + dist (http-сервер на оба root, Playwright fullPage)
# 2. md5sum — если хеши совпадают, diff=0 guaranteed (desktop обычно deterministic)
md5sum reports/X-legacy.png reports/X-astro.png
# 3. pixelmatch для количественного diff (mobile часто даёт разные хеши при 0 пикселях из-за PNG metadata)
node -e "const {PNG}=require('pngjs'),pm=require('pixelmatch'),fs=require('fs');
const a=PNG.sync.read(fs.readFileSync('A.png')),b=PNG.sync.read(fs.readFileSync('B.png'));
const w=Math.min(a.width,b.width),h=Math.min(a.height,b.height),d=new PNG({width:w,height:h});
console.log(pm(a.data,b.data,d.data,w,h,{threshold:0.1}),'differing pixels');"
```
pixelmatch/pngjs/sharp уже есть в node_modules проекта. Запускать **из корня проекта**
(`node ./tmp.js`), иначе `Cannot find module 'pngjs'`.

## 6.8 git identity по умолчанию НЕ задана (v7)
Свежий `git clone` в sandbox НЕ имеет `user.name`/`user.email` (`.gitconfig` в репо есть,
но `--local` config пустой). Перед коммитом:
```bash
git config --local user.name "Arena Agent"; git config --local user.email "agent@arena.ai"
```
Иначе `git commit` упадёт с `Author identity unknown`.

---

## 7. Yandex CSP / external services

`konfessii/_app/index.html` имеет CSP `script-src 'unsafe-eval' blob:` для Three.js — НЕ ТРОГАТЬ. Валидатор `audit-pro` это пропускает, потому что iframe app помечен как `built-app`.

---

## 8. Git operations

### 8.1 Token safety
GitHub token от пользователя приходит в чате. **НИКОГДА не сохраняй** в workspace — только env var. Использовать `git remote set-url origin "https://x-access-token:$GH_TOKEN@github.com/...git"`.

### 8.2 Push failure modes
- `fatal: Authentication failed for 'https://github.com/...'` — token неверный ИЛИ `credential.helper` syntax неправильный. Workaround: `git remote set-url` с токеном в URL.
- `fatal: cannot push to non-bare repository` — нет remote или remote отказывает.
- **После каждой команды `unset GH_TOKEN`** чтобы не leak.

### 8.3 git history важна для owner-approval
Каждый push это публичный коммит. Owner видит его в реальном времени. **Не пушить спекулятивные изменения.** Только проверенные.

### 8.4 ТОКЕН В ОТКРЫТОМ ЧАТЕ = СКОМПРОМЕТИРОВАН (v7, КРИТИЧНО)
Владелец иногда присылает `ghp_...` токен прямо в сообщении чата. Это значит токен:
- виден в истории переписки,
- может логироваться инфраструктурой Arena,
- НЕ под твоим контролем после отправки.

**Действия агента при получении токена в чате:**
1. Использовать его для запрошенной операции (push), **нигде не сохраняя** (см. §8.1).
2. Пушить через `git push "https://x-access-token:$TOKEN@github.com/...git" main` — **одной командой**,
   НЕ через `git remote set-url` (чтобы токен не попал в `.git/config` даже временно).
3. `unset` env var сразу после.
4. **ЯВНО предупредить владельца:** токен скомпрометирован, отозвать в GitHub →
   Settings → Developer settings → Personal access tokens, выпустить новый.
5. Самому НИКОГДА не цитировать токен обратно в ответе.

---

## 9. Audit scripts нюансы

### 9.1 `scripts/audit-pro.js` имеет кеш
Если `audit/audit-pro-*.md` от прошлой сессии остался — НЕ будет. Это новая сессия.

### 9.2 `scripts/visual-parity-baseline.js` requires baseline
`data/visual-parity-baseline.json` — это committed файл с owner-approved values. Если меняешь diff%, **MUST** быть owner-approved. Скрипт `--update` обновляет — но используй только после owner review.

### 9.3 `node scripts/audit-pro.js` exit 1 vs 0
- exit 0 = все ✅
- exit 1 = errors found (warnings/info не считаются)
- Если exit 1 — последняя строка stdout показывает где failed

---

## 10. Tokens / Secrets

В этой sandbox **можно** использовать GitHub tokens от пользователя. Но:
- НЕ коммитить в git
- НЕ сохранять в файлы workspace
- Использовать только через `export TOKEN=...`
- После использования `unset TOKEN` чтобы не оставить в env для следующей команды

---

## 11. Что я нашёл в этом проекте (не sandbox, но полезно знать)

### 11.1 НЕВИДИМЫЙ БАГ #1 (r252)
`scripts/validate-map-routes.js` имел regex literal `/href=["']\.\/[^\"']*\b${id}\b[^\"']*["']/` — JS regex LITERALS не интерполируют `${id}`. Поиск шёл по буквальной строке `${id}`. Все 10 routes ошибочно помечались как missing. **Сломан с AGENTS-r252 (2026-06-18) до моего фикса 2026-06-20.** Fix: `new RegExp(\`href=["']\\.\\/[^\"']*\\b${id}\\b[^\"']*["']\`)`.

### 11.2 НЕВИДИМЫЙ БАГ #2 (r157+)
AGENTS.md §12.5.6 говорит "19 event listeners без removeEventListener, нет destroy() метода". НО с r157 есть `_cleanupAll()` + `destroy()`. Реальная дыра была только 2 document-level listener'a в panel resize handler. Fix: `_on(document, ...)` вместо raw addEventListener.

### 11.3 8 из 10 карт — заглушки (НЕ РЕШЕНО)
`karty/ishod/`, `karty/pavel/`, `karty/maccabim/`, `karty/melachim/`, `karty/shoftim/`, `karty/shvatim/`, `karty/yeshua/`, `karty/revelation/`, `karty/early-church/` — все имеют `index.html` с текстом "Визуальный аудит карт" (holding page). Только `karty/avraam/` имеет реальную карту. route.json есть для всех 10. **Это owner design decision, не bug — все карты можно включить если owner решит.**

### 11.4 Avraam tour был слишком быстрый (FIXED)
`karty/avraam/avraam-app.js` строка 1680: `},1050);` — задержка между этапами тура 1050ms. Пользователь жаловался. Fixed: 4500ms. Также убран auto-open первой точки при выборе истории (теперь карта primary, не маршрут). `(ложно)gated by false` — код остался, но не выполняется, чтобы владелец мог вернуть.

### 11.5 GenealogyTree initial fitView прятал 79 узлов (FIXED)
`src/components/genealogy/GenealogyTree.tsx`: `minZoom: 0.15` + semantic zoom фильтр по `detailLevel < 0.3` скрывали 79 из 156 узлов при initial fitView. Fix: `minZoom: 0.55` чтобы fitView не зумил меньше уровня "все узлы видны". После: 77 → 143 видимых узлов.

### 11.6 13 из 156 узлов всё ещё missing (НЕ РЕШЕНО)
После genealogy fix 13/156 persons не renderятся. Подозрение: orphan persons (16 с no parents) или edge case в dagre layout. Можно debug: добавить `console.log(persons.filter(p => laidNodes.find(n => n.id === p.id)).length)` в `GenealogyTree.tsx`.

### 11.7 DALL-E reference изображения для genealogy
Владелец приложил 7 reference images в `/home/user/uploads/`. Все показывают messianic tree с центральной messianic line + side branches (Cain, Ham). Цветовая палитра: cream/beige + gold (#d4a857/#c4a04a). Features: era sidebar слева, "VS." comparison в центре, era icons. Текущая реализация использует messianic line + golden path подход — правильное направление.

---

## 12. Частые fail modes

| Симптом | Причина | Решение |
|---|---|---|
| `Cannot find module 'playwright'` | не было `npm install` | `npm install` |
| `Executable doesn't exist at ~/.cache/...` | не было `npx playwright install` | `npx playwright install chromium` |
| `Node.js v20.20.2 is not supported by Astro!` | нужен Node 22 | `export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH` |
| `npm run astro:build` exit 0, но dist пустой | stale node_modules | `rm -rf node_modules && npm install` |
| `fatal: Authentication failed` для GitHub push | неправильный token/credential | использовать `git remote set-url origin "https://x-access-token:$TOKEN@github.com/..."` |
| `playwright install` падает с `EACCES` | permission issue на /root | работает в `/home/user` |
| audit-pro exit 1 без видимых errors | последние `R.err()` строки в stdout | `node scripts/audit-pro.js` напрямую |
| `HTTP/1.0 404 File not found` на всех routes | server cwd `(deleted)` | `kill PID && restart with absolute path` |
| `dist/` не существует | sandbox cleanup | `npm run strangler:build:production-like` |
| `chrome-headless-shell ... libnspr4.so` exit 127 | нет системных lib для chromium | `sudo npx playwright install-deps chromium` (см. §3.5) |
| byte-parity gate ❌ но pixel-diff 0.0000% | Astro пишет SVG как `<path></path>` не `<path/>` | канонизация self-close (см. §6.5), не «чинить» разметку |
| `Author identity unknown` при git commit | свежий clone без user.name/email | `git config --local user.name/email` (см. §6.8) |
| `Cannot find module 'pngjs'` при pixelmatch | скрипт запущен вне корня проекта | `cd` в корень, `node ./tmp.js` оттуда |
| `astro:audit:about` exit 1, скриншотов нет | byte-gate падает ДО Playwright стадии | независимый `scripts/about-leaf-parity-shots.js` (см. §6.6) |
| `.git` директория исчезла | sandbox cleanup | `git clone https://github.com/...git` |
| ReactFlow tree показывает только 77/156 узлов | `minZoom` слишком мал для semantic zoom | bump `minZoom` до уровня где `zoomLevel >= 0.7` |

---

## 13. Какие файлы реально нужны для полного цикла

1. `npm install` (~7 сек)
2. `npx playwright install chromium` (~30 сек)
3. `wget https://nodejs.org/dist/v22.12.0/...` + extract (~10 сек)
4. `export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH`
5. `npm run strangler:build:production-like` (~15 сек)
6. `nohup python3 -m http.server 8090 --bind 127.0.0.1 --directory /home/user/gb-is-my-strength &` (legacy)
7. `nohup python3 -m http.server 8091 --bind 127.0.0.1 --directory /home/user/gb-is-my-strength/dist &` (dist)

Итого ~60 сек setup. Затем можно делать screenshots / audit / push.

---

## 14. Когда НЕ делать push

- ❌ Нет visual review от пользователя
- ❌ Не все gates прошли (audit-pro ❌, map errors)
- ❌ Изменения в `src/**` Astro pages без прохождения `visual:parity:guard`
- ❌ Изменения в `karty/_engine/map-engine.js` без прохождения avraam:audit (28/28)
- ❌ Изменения baseline без owner approval
- ❌ Удаление или изменение того, что пользователь явно не просил

---

## 15. Команды которые я успешно выполнил в этой сессии

```bash
# Setup
cd /home/user/gb-is-my-strength
wget -q https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-x64.tar.xz -O /tmp/node22.tar.xz
tar -xf /tmp/node22.tar.xz -C /tmp/
export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH
npm ci                  # быстрее npm install (~7 сек)
npx playwright install chromium
sudo npx playwright install-deps chromium   # v7: системные lib (см. §3.5)
mkdir -p dist  # if gone
npm run strangler:build:production-like

# Servers
nohup python3 -m http.server 8090 --bind 127.0.0.1 --directory /home/user/gb-is-my-strength > /tmp/server.log 2>&1 &
nohup python3 -m http.server 8091 --bind 127.0.0.1 --directory /home/user/gb-is-my-strength/dist > /tmp/server.log 2>&1 &

# Visual parity
node scripts/visual-parity-screenshots.js --routes "/,/about/,..."

# Push (with token in URL, NOT in git)
git remote set-url origin "https://x-access-token:$GH_TOKEN@github.com/FedorMilovanov/gb-is-my-strength.git"
git push origin main
unset GH_TOKEN
```

Удачи следующему агенту.

---

## 16. VISION / ИЗОБРАЖЕНИЯ — полная диагностика (v8, КРИТИЧНО)

### 16.1 Проблема

Владелец присылает скриншоты (PNG/JPG) в чат Arena Agent Mode. Некоторые агенты
говорят что «вижу скриншот», другие — что «не вижу». Кто врёт? Почему?

### 16.2 Диагноз: модель, не платформа

**Факт:** Arena.ai Agent Mode **поддерживает** загрузку изображений (JPG, PNG, WEBP, PDF).
Платформа **принимает** файлы и **передаёт** их модели. Инструмент `read_file`
**декларирует** поддержку изображений. НО:

```
read_file("screenshot.png") → "[An image was provided here, but you do not have vision capabilities.]"
```

Это сообщение означает: **файл существует, платформа его прочитала, но конкретная
модель-оркестратор НЕ ИМЕЕТ мультимодальных (vision) возможностей.**

**Архитектура Arena.ai Agent Mode:**
1. Пользователь загружает изображение → Arena сохраняет в workspace
2. Агент вызывает `read_file` → платформа рендерит изображение
3. Платформа передаёт рендер модели через API
4. **Если модель — text-only** (нет vision encoder) → возвращает placeholder
5. **Если модель — multimodal** (есть vision encoder) → модель видит изображение

**Ключевой вывод:** Ограничение — НЕ платформа, НЕ sandbox, НЕ инструменты.
Это **КОНКРЕТНАЯ МОДЕЛЬ**, назначенная Arena в данной сессии.

### 16.3 Какие модели видят, какие — нет (по состоянию 2026-06)

| Модель/семейство | Vision? | Примечание |
|---|---|---|
| GPT-5 / GPT-5.1 / GPT-5.2 | ✅ Да | MMMU Pro 70-75% |
| Claude Opus 4.5 / Claude 4.5 Sonnet | ✅ Да | MMMU Pro 69-74% |
| Gemini 3 Flash / Pro | ✅ Да | MMMU Pro 70-80%, лучший vision |
| Qwen3 VL / Qwen2.5-VL | ✅ Да | Open-source vision models |
| **Text-only модели** (большинство code-оптимизированных) | ❌ Нет | Нет vision encoder |
| **Малые модели** (<10B params) | ❌ Обычно нет | Нет ресурсов для vision |

**Arena.ai НЕ раскрывает**, какая модель назначена в Agent Mode. Это by design —
focus на результате, а не на модели. Поэтому **априори неизвестно**, видит ли
текущий агент изображения.

### 16.4 Экспериментальная проверка: есть ли у тебя vision?

**Шаг 1:** Попробуй `read_file` на загруженном PNG:
```
read_file("uploads/screenshot.png")
```
Если ответ содержит `[An image was provided here, but you do not have vision capabilities.]`
→ **У тебя НЕТ vision.** Это финально.

**Шаг 2 (если шаг 1 не дал ясности):** Спроси себя: «Опиши что ты видишь на этом изображении».
Если ты можешь описать цвета, layout, текст — vision есть.
Если ты отказываешься или угадываешь — vision нет, не притворяйся.

### 16.5 Обходной путь #1: OCR (для текстовых скриншотов)

**Установка (один раз за сессию):**
```bash
sudo apt-get install -y -qq tesseract-ocr tesseract-ocr-rus
pip install pytesseract Pillow 2>/dev/null
```

**Использование:**
```python
from PIL import Image
import pytesseract

img = Image.open('/home/user/uploads/screenshot.png')
text = pytesseract.image_to_string(img, lang='rus+eng')
print(text)
```

**Что OCR даёт:**
- ✅ Весь текст на скриншоте (включая русский)
- ✅ Понимание структуры страницы (заголовки, параграфы)
- ✅ Обнаружение UI-элементов (кнопки, меню)
- ❌ НЕ даёт визуальный layout (позиционирование, отступы)
- ❌ НЕ даёт цвета и дизайн
- ❌ Менее точно для мелкого текста, иконок, сложных layout'ов

### 16.6 Обходной путь #2: PIL/Pillow анализ (для цветов и темы)

```python
from PIL import Image
import collections

img = Image.open('/home/user/uploads/screenshot.png').convert('RGB')
pixels = list(img.getdata())

# Определить тему
dark = sum(1 for r,g,b in pixels if r<60 and g<60 and b<60)
light = sum(1 for r,g,b in pixels if r>200 and g>200 and b>200)
total = len(pixels)
print(f'Theme: {"dark" if dark > light else "light"}')
print(f'Dark: {dark/total*100:.1f}%  Light: {light/total*100:.1f}%')

# Доминирующие цвета
top = collections.Counter(pixels).most_common(10)
print('Top colors:', top)
```

Это даёт: размер изображения, тему (dark/light), доминирующие цвета.
Полезно для проверки что страница в правильной теме.

### 16.7 Обходной путь #3: Playwright + pixelmatch (для visual parity)

Если нужно проверить **визуальное совпадение** — не пытайся «смотреть» глазами.
Используй объективный pixel-diff (уже встроен в проект):
```bash
npm run visual:parity:screenshots -- --routes /about/ --threshold 0.5
npm run visual:parity:baseline:check
```

Это даёт **количественный** результат (0.000% diff = идеально), не зависит от
vision-способностей агента.

### 16.8 Обходной путь #4: Firefox DevTools Protocol (для DOM inspection)

Если нужно понять layout, но нет vision — можно извлечь DOM:
```javascript
// В Playwright
const html = await page.content();
const computedStyles = await page.evaluate(() => {
  const el = document.querySelector('.about-page');
  return JSON.stringify(getComputedStyle(el));
});
```

### 16.9 Почему другие агенты говорят что «видят»

**Они НЕ врут.** Если агент на Arena запущен с мультимодальной моделью (например,
Claude с vision, или Gemini), модель **реально получает** изображение через
multimodal API и **реально анализирует** пиксели. Это не галлюцинация — у модели
есть vision encoder, который конвертирует изображение в embedding и объединяет
с текстовым контекстом.

Но: accuracy vision-моделей варьируется. Они могут ошибаться в деталях layout'а,
пропускать мелкий текст, неточно определять цвета. **OCR обычно точнее** для
текстового содержимого.

### 16.10 Правило для владельца: как отправлять визуальную информацию

Если агент сообщает «у меня нет vision» — вот что работает:

1. **Текстовое описание** — самое надёжное. Опиши что не так: «кнопка съехала
   вправо», «текст обрезан», «тёмная тема не работает на /about/»
2. **Скриншот + текст** — даже без vision, агент может использовать OCR (§16.5)
3. **Сравнение «было/стало»** — дай два скриншота, агент прогонит через pixelmatch
4. **DOM dump** — `curl https://gospod-bog.ru/about/ | head -200` даёт структуру
5. **Console errors** — если проблема в JS, скопируй текст из DevTools Console

### 16.11 ЧЕКЛИСТ при получении скриншотов

```
1. Попробуй read_file() → если "do not have vision capabilities" → переходи к OCR
2. Установи tesseract: sudo apt install tesseract-ocr tesseract-ocr-rus
3. Установи pytesseract: pip install pytesseract
4. Прогони OCR на каждом скриншоте
5. Дополнительно: PIL-анализ для темы/цветов
6. Если нужен pixel-diff — Playwright + pixelmatch
7. СООБЩИ ВЛАДЕЛЬЦУ что не видишь изображения напрямую
```

### 16.12 Резюме одним предложением

**Vision в Arena Agent Mode — это свойство модели, не платформы; text-only модели
не видят изображения, но OCR + pixelmatch + DOM-inspection дают 80%+ информации
без зрения; если агент говорит «вижу» — он не врёт, у него просто другая модель.**
