# Lane: playember-hover-premium-2026-06-27

**Date:** 2026-06-27
**Mode:** LANE (premium interaction + TTS, runtime JS+CSS)
**Branch:** `lane/playember-hover-premium-2026-06-27` → merged to main
**Goal:** премиальная hover-логика PlayEmber по требованиям владельца + TTS-фиксы (русский голос, пауза).
Spec: `AuditRepo/.../verified/PLAYEMBER_INTERACTION_SPEC_2026-06-27.md`.

## Что сделано

### 1. Hover-bloom speed-pill (owner spec)
- `css/floating-cluster.css`: pill раскрывается на **hover** (desktop), резиново/глубоко, морфом из
  круга (`clip-path: circle → inset round 999px`, `.42s cubic-bezier(.16,1.08,.3,1)`). Каскад кнопок скорости.
- **Singles:** Play смещается вбок `translateX(4px) scale(1.04)` — «выезжает из круга» (как на референсе).
- **GBS/Gill:** Play без бокового сдвига (`scale(1.06)`), pill раскрывается **вверх** (существующее
  `[data-gill-v16]` правило). Hover-правила scoped к `(hover:hover)` — touch не затронут.
- `js/floating-cluster-controller.js`: `HOVER_CAPABLE`; `mouseenter→openPanel`, `mouseleave→close`,
  `focus/focusout` a11y. Клик по Play = **play/pause** (не открытие). Клик по скорости = мгновенный
  выбор + старт из idle. Touch: pill по тапу.

### 2. TTS-фиксы (functional, все premium-страницы)
- Русский голос: `pickRuVoice()` + `u.voice` (было: только `u.lang`, браузер брал английский).
- Пауза: клик по ember теперь вызывает `handlePlayClick` (play→pause→resume) — раньше залипал.

## Проверки (Playwright, production-like dist)
- single-herm hover: opacity 1, 6 кнопок скорости, ember `translateX(4px) scale(1.04)`, pill влево —
  скриншот совпал с референсом владельца.
- gill-context hover: opacity 1, ember `scale(1.06)` (без сдвига), направление UP.
- play/pause: idle→playing→paused; pickRuVoice → «Google русский (ru-RU)».
- `strangler:build:production-like` 53 pages; `audit-pro` PASS; `data:consistency` PASS; cache-bust синхронизирован.

## Scope
`css/floating-cluster.css` + `js/floating-cluster-controller.js` + cache-bust hashes. Затрагивает все
premium-страницы с `.gb-ember`.
