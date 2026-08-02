#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "css" / "site.css"

DEAD = "@keyframes fx-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}"
LIVE = "@keyframes fx-breathe{0%,100%{transform:scale(1);opacity:.82}50%{transform:scale(1.06);opacity:1}}"
TOKEN = "@keyframes fx-breathe"

text = TARGET.read_text(encoding="utf-8")

if text.count(TOKEN) != 2:
    raise SystemExit(f"expected exactly 2 fx-breathe definitions before repair, found {text.count(TOKEN)}")
if text.count(DEAD) != 1:
    raise SystemExit(f"expected exactly 1 dead transform-only definition, found {text.count(DEAD)}")
if text.count(LIVE) != 1:
    raise SystemExit(f"expected exactly 1 live opacity-aware definition, found {text.count(LIVE)}")

updated = text.replace(DEAD, "", 1)

if updated.count(TOKEN) != 1:
    raise SystemExit(f"expected exactly 1 fx-breathe definition after repair, found {updated.count(TOKEN)}")
if DEAD in updated:
    raise SystemExit("dead transform-only fx-breathe definition survived")
if updated.count(LIVE) != 1:
    raise SystemExit("live opacity-aware fx-breathe definition was altered")

TARGET.write_text(updated, encoding="utf-8")
print("removed one dead transform-only fx-breathe definition; live opacity-aware owner retained")
