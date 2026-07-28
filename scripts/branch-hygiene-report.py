#!/usr/bin/env python3
"""Generate a read-only GitHub remote-branch inventory.

The script never updates refs, branches, issues, labels, comments, PR state or
repository settings. Its classifications are preliminary review queues, not
deletion decisions.
"""

from __future__ import annotations

import argparse
import datetime as dt
import email.utils
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


API = "https://api.github.com"
MAX_REQUEST_ATTEMPTS = 4
DIAGNOSTIC_PREFIXES = (
    "diag/",
    "probe/",
    "snapshot/",
    "witness/",
    "tmp/",
    "temp/",
    "_temp/",
    "materializer/",
    "carrier/",
    "memory/",
    "experiment/",
    "agent/diag-",
    "agent/diag/",
    "agent/probe-",
    "agent/probe/",
    "agent/snapshot-",
    "agent/snapshot/",
    "agent/witness-",
    "agent/witness/",
    "agent/temp-",
    "agent/temp/",
    "agent/_temp-",
    "agent/_temp/",
    "agent/materializer-",
    "agent/carrier-",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repository", required=True, help="owner/name")
    parser.add_argument("--output-dir", required=True)
    return parser.parse_args()


def retry_delay(error: urllib.error.HTTPError, attempt: int) -> float | None:
    retry_after = error.headers.get("Retry-After")
    if retry_after:
        try:
            return max(1.0, min(float(retry_after), 120.0))
        except ValueError:
            parsed = email.utils.parsedate_to_datetime(retry_after)
            if parsed is not None:
                return max(
                    1.0,
                    min((parsed - dt.datetime.now(dt.timezone.utc)).total_seconds(), 120.0),
                )

    remaining = error.headers.get("X-RateLimit-Remaining")
    reset = error.headers.get("X-RateLimit-Reset")
    if error.code == 403 and remaining == "0" and reset:
        try:
            return max(1.0, min(float(reset) - time.time() + 1.0, 120.0))
        except ValueError:
            pass

    if error.code == 429 or 500 <= error.code < 600:
        return min(2.0**attempt, 30.0)
    return None


def request_json(path: str, token: str) -> tuple[Any, dict[str, str]]:
    request = urllib.request.Request(
        f"{API}{path}",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "gb-branch-hygiene-report",
        },
    )
    for attempt in range(MAX_REQUEST_ATTEMPTS):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.loads(response.read().decode("utf-8"))
                return payload, dict(response.headers.items())
        except urllib.error.HTTPError as error:
            delay = retry_delay(error, attempt)
            if delay is not None and attempt + 1 < MAX_REQUEST_ATTEMPTS:
                print(
                    f"GitHub API {error.code} for {path}; retrying in {delay:.1f}s",
                    file=sys.stderr,
                )
                time.sleep(delay)
                continue
            detail = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"GitHub API {error.code} for {path}: {detail}") from error
        except (TimeoutError, urllib.error.URLError) as error:
            if attempt + 1 < MAX_REQUEST_ATTEMPTS:
                delay = min(2.0**attempt, 30.0)
                print(
                    f"GitHub API transport failure for {path}; retrying in {delay:.1f}s: {error}",
                    file=sys.stderr,
                )
                time.sleep(delay)
                continue
            raise RuntimeError(f"GitHub API transport failure for {path}: {error}") from error
    raise AssertionError("unreachable request retry loop")


def paged(path: str, token: str) -> list[dict[str, Any]]:
    separator = "&" if "?" in path else "?"
    page = 1
    result: list[dict[str, Any]] = []
    while True:
        payload, _ = request_json(f"{path}{separator}per_page=100&page={page}", token)
        if not isinstance(payload, list):
            raise RuntimeError(f"Expected list from {path}, got {type(payload).__name__}")
        result.extend(payload)
        if len(payload) < 100:
            return result
        page += 1


def parse_date(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def days_old(value: str | None, now: dt.datetime) -> int | None:
    parsed = parse_date(value)
    if parsed is None:
        return None
    return max(0, (now - parsed).days)


def markdown_code(value: str) -> str:
    return value.replace("|", "\\|").replace("`", "'")


def main() -> int:
    args = parse_args()
    token = os.environ.get("GH_TOKEN", "").strip()
    if not token:
        print("GH_TOKEN is required", file=sys.stderr)
        return 2

    repository = args.repository
    output = Path(args.output_dir)
    output.mkdir(parents=True, exist_ok=True)
    now = dt.datetime.now(dt.timezone.utc)

    repo, _ = request_json(f"/repos/{repository}", token)
    default_branch = str(repo["default_branch"])

    branches = paged(f"/repos/{repository}/branches", token)
    pulls = paged(
        f"/repos/{repository}/pulls?state=all&sort=updated&direction=desc",
        token,
    )

    prs_by_branch: dict[str, list[dict[str, Any]]] = {}
    for pr in pulls:
        head = pr.get("head") or {}
        head_repo = head.get("repo") or {}
        if head_repo.get("full_name") != repository:
            continue
        prs_by_branch.setdefault(str(head.get("ref", "")), []).append(pr)

    rows: list[dict[str, Any]] = []
    for index, branch in enumerate(branches, start=1):
        name = str(branch["name"])
        if name == default_branch:
            continue

        sha = str(branch["commit"]["sha"])
        commit, _ = request_json(f"/repos/{repository}/commits/{sha}", token)
        commit_date = (
            ((commit.get("commit") or {}).get("committer") or {}).get("date")
            or ((commit.get("commit") or {}).get("author") or {}).get("date")
        )
        age = days_old(commit_date, now)

        encoded_base = urllib.parse.quote(default_branch, safe="")
        encoded_head = urllib.parse.quote(name, safe="")
        comparison, _ = request_json(
            f"/repos/{repository}/compare/{encoded_base}...{encoded_head}", token
        )
        ahead = int(comparison.get("ahead_by", 0))
        behind = int(comparison.get("behind_by", 0))
        compare_status = str(comparison.get("status", "unknown"))

        related = prs_by_branch.get(name, [])
        open_prs = [pr for pr in related if pr.get("state") == "open"]
        merged_prs = [pr for pr in related if pr.get("merged_at")]
        closed_unmerged = [
            pr for pr in related if pr.get("state") == "closed" and not pr.get("merged_at")
        ]

        diagnostic = name.startswith(DIAGNOSTIC_PREFIXES)
        recently_updated = age is not None and age < 7

        if open_prs:
            classification = "ACTIVE_OR_IN_FLIGHT"
            deletion_blocked = True
        elif ahead == 0:
            classification = "FULLY_REPRESENTED_BY_ANCESTRY"
            deletion_blocked = True
        elif recently_updated:
            classification = "RECENT_OWNER_CHECK_REQUIRED"
            deletion_blocked = True
        elif diagnostic:
            classification = "DIAGNOSTIC_CONTENT_REVIEW"
            deletion_blocked = True
        elif merged_prs:
            classification = "SQUASH_PATCH_EQUIVALENCE_REVIEW"
            deletion_blocked = True
        elif closed_unmerged:
            classification = "CLOSED_UNMERGED_FORENSIC_REVIEW"
            deletion_blocked = True
        else:
            classification = "UNKNOWN_PROTECTED"
            deletion_blocked = True

        rows.append(
            {
                "branch": name,
                "sha": sha,
                "last_commit": commit_date,
                "age_days": age,
                "compare_status": compare_status,
                "ahead": ahead,
                "behind": behind,
                "open_prs": [int(pr["number"]) for pr in open_prs],
                "merged_prs": [int(pr["number"]) for pr in merged_prs],
                "closed_unmerged_prs": [int(pr["number"]) for pr in closed_unmerged],
                "diagnostic_prefix": diagnostic,
                "deletion_blocked": deletion_blocked,
                "classification": classification,
            }
        )
        if index % 50 == 0:
            time.sleep(1)

    rows.sort(
        key=lambda row: (
            row["classification"],
            -(row["age_days"] if row["age_days"] is not None else -1),
            row["branch"],
        )
    )

    summary: dict[str, int] = {}
    for row in rows:
        summary[row["classification"]] = summary.get(row["classification"], 0) + 1

    warning = (
        "Read-only preliminary inventory. Every branch remains deletion-blocked. "
        "Open/recent/unknown branches may belong to active agents. Squash merges require "
        "patch-equivalence and file-level verification plus owner approval."
    )
    payload = {
        "schema_version": 1,
        "generated_at": now.isoformat(),
        "repository": repository,
        "default_branch": default_branch,
        "total_non_default_branches": len(rows),
        "summary": summary,
        "branches": rows,
        "warning": warning,
    }
    (output / "branch-hygiene.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    lines = [
        f"# Branch Hygiene Report — `{repository}`",
        "",
        f"- Generated: `{now.isoformat()}`",
        f"- Default branch: `{default_branch}`",
        f"- Non-default branches: **{len(rows)}**",
        "- Mutations performed: **0**",
        "",
        f"> {warning}",
        "",
        "## Summary",
        "",
        "| Classification | Count |",
        "|---|---:|",
    ]
    for name, count in sorted(summary.items()):
        lines.append(f"| `{name}` | {count} |")

    lines.extend(
        [
            "",
            "## Branches",
            "",
            "| Branch | Age | Ahead/behind | PRs | Classification |",
            "|---|---:|---:|---|---|",
        ]
    )
    for row in rows:
        prs: list[str] = []
        if row["open_prs"]:
            prs.append("open " + ",".join(f"#{n}" for n in row["open_prs"]))
        if row["merged_prs"]:
            prs.append("merged " + ",".join(f"#{n}" for n in row["merged_prs"]))
        if row["closed_unmerged_prs"]:
            prs.append("closed " + ",".join(f"#{n}" for n in row["closed_unmerged_prs"]))
        age_text = f"{row['age_days']}d" if row["age_days"] is not None else "?"
        lines.append(
            f"| `{markdown_code(row['branch'])}` | {age_text} | "
            f"+{row['ahead']}/-{row['behind']} | {'; '.join(prs) or 'none'} | "
            f"`{row['classification']}` |"
        )

    (output / "branch-hygiene.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"total": len(rows), "summary": summary}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
