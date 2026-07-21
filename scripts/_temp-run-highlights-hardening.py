#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "js/highlights.js"
PATCHER = ROOT / "scripts/_temp-highlights-runtime-hardening-patch.py"
BRANCH = "lane/highlights-runtime-hardening-2026-07-21"


def run(*args: str) -> None:
    subprocess.run(args, cwd=ROOT, check=True)


def load_patcher():
    spec = importlib.util.spec_from_file_location("highlights_hardening_patch", PATCHER)
    if spec is None or spec.loader is None:
        raise SystemExit("cannot load exact highlights patcher")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def verify_transaction_paths() -> None:
    changed = subprocess.check_output(
        ["git", "diff", "--name-only"], cwd=ROOT, text=True
    ).splitlines()
    allowed_exact = {
        "js/highlights.js",
        "scripts/highlights-runtime-regression-test.js",
        "src/lib/asset-version.js",
    }
    unexpected = [
        path
        for path in changed
        if path not in allowed_exact
        and not path.endswith(".html")
        and not path.endswith(".astro")
    ]
    if unexpected:
        raise SystemExit("unexpected paths: " + ", ".join(unexpected))
    required = {
        "js/highlights.js",
        "scripts/highlights-runtime-regression-test.js",
    }
    missing = required.difference(changed)
    if missing:
        raise SystemExit("required permanent files are missing: " + ", ".join(sorted(missing)))
    print(f"✅ restricted generated transaction: {len(changed)} paths")


def main() -> None:
    if "function gbHighlightPath" in RUNTIME.read_text(encoding="utf-8"):
        print("✅ highlights hardening already materialized; no-op")
        return

    patcher = load_patcher()
    patcher.apply_patch()

    run("node", "--check", "js/highlights.js")
    run("node", "scripts/highlights-runtime-regression-test.js")
    run("node", "scripts/cache-bust.js", "--write")
    run("node", "scripts/cache-bust.js")
    verify_transaction_paths()
    run("git", "diff", "--check")
    run("npm", "run", "validate:static-publication:light")

    run("git", "add", "-A")
    run("git", "config", "user.name", "github-actions[bot]")
    run(
        "git",
        "config",
        "user.email",
        "41898282+github-actions[bot]@users.noreply.github.com",
    )
    run(
        "git",
        "commit",
        "-m",
        "fix(reader): deduplicate highlights and synchronize dialog state",
    )
    run("git", "push", "origin", f"HEAD:{BRANCH}")


if __name__ == "__main__":
    main()
