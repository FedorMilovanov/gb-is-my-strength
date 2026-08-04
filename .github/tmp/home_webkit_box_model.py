#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path.cwd()
BASE_SHA = "3341eb2580ba8655901731344274633b767eb431"
BASE_CSS_BLOB = "8de86b1b02c2dc6d2097ec4154ddedd173daf3f8"
BRANCH = "fix/home-webkit-content-box-20260804"
CSS_PATH = Path("css/home.css")
ASSET_REGISTRY_PATH = Path("src/lib/asset-version.js")
HELPER_PATH = Path(".github/tmp/home_webkit_box_model.py")
WORKFLOW_PATH = Path(".github/workflows/tmp-home-webkit-box-model.yml")
REPORT_PATH = Path("reports/home-webkit-box-model-transaction.json")
OLD_BLOCK = """body.home-page .home-content{
  width:min(100%,1240px);
  max-width:1240px;
  padding-inline:clamp(22px,4.4vw,56px);
}
"""
NEW_BLOCK = """body.home-page .home-content{
  box-sizing:border-box;
  width:min(100%,1240px);
  max-width:1240px;
  padding-inline:clamp(22px,4.4vw,56px);
}
"""
URL_TOKEN_RE = re.compile(rb"home\.css\?v=([0-9a-f]{8})")
REGISTRY_TOKEN_RE = re.compile(
    rb"(?m)^(\s*'css/home\.css':\s*')([0-9a-f]{8})(',\s*)$"
)
FORBIDDEN_PATH_PARTS = ("tts", "vosk")


def run(*args: str, check: bool = True, capture: bool = False) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        args,
        cwd=ROOT,
        check=False,
        text=True,
        capture_output=capture,
    )
    if check and result.returncode != 0:
        if capture:
            sys.stderr.write(result.stdout)
            sys.stderr.write(result.stderr)
        raise SystemExit(f"command failed ({result.returncode}): {' '.join(args)}")
    return result


def output(*args: str) -> str:
    return run(*args, capture=True).stdout.strip()


def changed_files(base: str = BASE_SHA) -> list[str]:
    text = output("git", "diff", "--name-only", base)
    return [line for line in text.splitlines() if line]


def git_bytes(revision: str, path: str) -> bytes:
    result = subprocess.run(
        ["git", "show", f"{revision}:{path}"],
        cwd=ROOT,
        check=False,
        capture_output=True,
    )
    if result.returncode != 0:
        raise SystemExit(f"cannot read {revision}:{path}")
    return result.stdout


def assert_control_plane_only() -> None:
    run("git", "fetch", "origin", "main", "--quiet")
    live_main = output("git", "rev-parse", "origin/main")
    if live_main != BASE_SHA:
        raise SystemExit(f"main moved: expected {BASE_SHA}, got {live_main}")
    run("git", "merge-base", "--is-ancestor", BASE_SHA, "HEAD")

    base_blob = output("git", "rev-parse", f"{BASE_SHA}:{CSS_PATH.as_posix()}")
    if base_blob != BASE_CSS_BLOB:
        raise SystemExit(f"canonical CSS blob drifted: expected {BASE_CSS_BLOB}, got {base_blob}")

    initial = set(output("git", "diff", "--name-only", f"{BASE_SHA}...HEAD").splitlines())
    expected = {HELPER_PATH.as_posix(), WORKFLOW_PATH.as_posix()}
    if initial != expected:
        raise SystemExit(f"unexpected preparatory diff: {sorted(initial)}")


def patch_css() -> None:
    source = CSS_PATH.read_text(encoding="utf-8")
    if source.count(OLD_BLOCK) != 1:
        raise SystemExit(f"canonical Home content block drifted: {source.count(OLD_BLOCK)} matches")
    if source.count(NEW_BLOCK) != 0:
        raise SystemExit("box-model fix already present")

    candidate = source.replace(OLD_BLOCK, NEW_BLOCK, 1)
    if candidate != source.replace(OLD_BLOCK, NEW_BLOCK, 1):
        raise SystemExit("candidate CSS differs beyond canonical replacement")
    if "overflow" in NEW_BLOCK or "!important" in NEW_BLOCK:
        raise SystemExit("forbidden masking rule in candidate")
    CSS_PATH.write_text(candidate, encoding="utf-8")


def parse_registry_token(content: bytes, path: str) -> bytes:
    matches = REGISTRY_TOKEN_RE.findall(content)
    if len(matches) != 1:
        raise SystemExit(f"asset registry Home entry is ambiguous in {path}: {len(matches)} matches")
    return matches[0][1]


def replace_registry_token(content: bytes, old: bytes, new: bytes) -> bytes:
    replacement_count = 0

    def replace(match: re.Match[bytes]) -> bytes:
        nonlocal replacement_count
        if match.group(2) != old:
            return match.group(0)
        replacement_count += 1
        return match.group(1) + new + match.group(3)

    candidate = REGISTRY_TOKEN_RE.sub(replace, content)
    if replacement_count != 1:
        raise SystemExit(f"asset registry replacement count is {replacement_count}, expected 1")
    return candidate


def validate_generated_diff() -> dict[str, object]:
    files = changed_files()
    temporary = {HELPER_PATH.as_posix(), WORKFLOW_PATH.as_posix()}
    permanent = [path for path in files if path not in temporary]

    if CSS_PATH.as_posix() not in permanent:
        raise SystemExit("canonical CSS owner missing from candidate diff")
    if ASSET_REGISTRY_PATH.as_posix() not in permanent:
        raise SystemExit("canonical asset registry missing from candidate diff")
    if any(part in path.lower() for path in permanent for part in FORBIDDEN_PATH_PARTS):
        raise SystemExit(f"TTS/Vosk path entered Home lane: {permanent}")

    base_css = git_bytes(BASE_SHA, CSS_PATH.as_posix()).decode("utf-8")
    candidate_css = CSS_PATH.read_text(encoding="utf-8")
    expected_css = base_css.replace(OLD_BLOCK, NEW_BLOCK, 1)
    if candidate_css != expected_css:
        raise SystemExit("css/home.css changed beyond the one canonical box-model insertion")

    old_tokens: set[bytes] = set()
    new_tokens: set[bytes] = set()
    literal_revision_files: list[str] = []
    registry_revision_files: list[str] = []

    for path in permanent:
        if path == CSS_PATH.as_posix():
            continue

        before = git_bytes(BASE_SHA, path)
        after = Path(path).read_bytes()

        if path == ASSET_REGISTRY_PATH.as_posix():
            old = parse_registry_token(before, f"{BASE_SHA}:{path}")
            new = parse_registry_token(after, path)
            if old == new:
                raise SystemExit("asset registry changed without Home revision movement")
            expected_after = replace_registry_token(before, old, new)
            if after != expected_after:
                raise SystemExit("asset registry changed beyond exact css/home.css entry replacement")
            registry_revision_files.append(path)
        else:
            before_tokens = set(URL_TOKEN_RE.findall(before))
            after_tokens = set(URL_TOKEN_RE.findall(after))
            if len(before_tokens) != 1 or len(after_tokens) != 1:
                raise SystemExit(f"literal Home revision owner is ambiguous: {path}")
            old = next(iter(before_tokens))
            new = next(iter(after_tokens))
            if old == new:
                raise SystemExit(f"literal owner changed without Home revision movement: {path}")
            expected_after = before.replace(b"home.css?v=" + old, b"home.css?v=" + new)
            if after != expected_after:
                raise SystemExit(f"literal owner changed beyond exact Home revision replacement: {path}")
            literal_revision_files.append(path)

        old_tokens.add(old)
        new_tokens.add(new)

    if len(old_tokens) != 1 or len(new_tokens) != 1:
        raise SystemExit(f"Home revision movement is not singular: old={old_tokens}, new={new_tokens}")

    report = {
        "baseSha": BASE_SHA,
        "baseCssBlob": BASE_CSS_BLOB,
        "oldRevision": next(iter(old_tokens)).decode(),
        "newRevision": next(iter(new_tokens)).decode(),
        "permanentFiles": permanent,
        "literalRevisionOnlyFiles": literal_revision_files,
        "registryRevisionOnlyFiles": registry_revision_files,
        "rootFix": "box-sizing:border-box on body.home-page .home-content",
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def apply() -> None:
    assert_control_plane_only()
    patch_css()
    run("node", "scripts/cache-bust.js", "--write")
    run("node", "scripts/cache-bust.js")
    report = validate_generated_diff()
    print(json.dumps(report, ensure_ascii=False, indent=2))


def finalize() -> None:
    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    validate_generated_diff()

    HELPER_PATH.unlink()
    WORKFLOW_PATH.unlink()
    REPORT_PATH.unlink(missing_ok=True)

    final_files = changed_files()
    expected = set(report["permanentFiles"])
    if set(final_files) != expected:
        raise SystemExit(f"final diff drifted: expected {sorted(expected)}, got {sorted(final_files)}")
    if any(path.startswith(".github/tmp/") or path == WORKFLOW_PATH.as_posix() for path in final_files):
        raise SystemExit("temporary control-plane remains in final tree")
    if any(part in path.lower() for path in final_files for part in FORBIDDEN_PATH_PARTS):
        raise SystemExit(f"TTS/Vosk path entered final tree: {final_files}")

    run("git", "add", "--all")
    staged = output("git", "diff", "--cached", "--name-only").splitlines()
    if set(staged) != expected:
        raise SystemExit(f"staged inventory drifted: {staged}")

    run("git", "config", "user.name", "ChatGPT")
    run("git", "config", "user.email", "chatgpt@users.noreply.github.com")
    run("git", "commit", "-m", "fix(home): correct mobile content box geometry")
    run("git", "push", "origin", f"HEAD:{BRANCH}")


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in {"apply", "finalize"}:
        raise SystemExit("usage: home_webkit_box_model.py apply|finalize")
    apply() if sys.argv[1] == "apply" else finalize()
