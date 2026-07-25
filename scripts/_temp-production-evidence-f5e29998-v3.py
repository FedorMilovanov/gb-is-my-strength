#!/usr/bin/env python3
"""Temporary V3 production-evidence certifier. Never merge.

Consumes the immutable V2 report captured while f5e29998 was the live current
pointer, then verifies the current operator-recovery marker and merged source
repair. It never upgrades the historical automated ledger run to success.
"""
from __future__ import annotations

import json
import os
import pathlib
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any

REPOSITORY = os.environ.get("GITHUB_REPOSITORY", "FedorMilovanov/gb-is-my-strength")
TOKEN = os.environ["GITHUB_TOKEN"]
TARGET_SHA = "f5e29998c5b42cc9e4e7c917b1e1c1072aa52320"
TARGET_PR = 286
SOURCE_FIX_PR = 312
SOURCE_FIX_MERGE_SHA = "733ba309e159023ae44682b7cb71b2c042cd8eb6"
DEPLOY_RUN_ID = 30169443420
DEPLOY_RUN_ATTEMPT = 1
WITNESS_ARTIFACT_ID = 8622642553
V2_DIRECTORY = pathlib.Path(os.environ["V2_DIRECTORY"])
OUTPUT = pathlib.Path("reports/production-evidence-f5e29998-v3.json")
API = "https://api.github.com"
OWNER, REPO = REPOSITORY.split("/", 1)
MARKER = (
    "<!-- deployment-capability-witness:tts:"
    f"{TARGET_SHA}:{DEPLOY_RUN_ID}:{DEPLOY_RUN_ATTEMPT}:{WITNESS_ARTIFACT_ID} -->"
)

checks: list[dict[str, Any]] = []
errors: list[str] = []


def add(name: str, ok: bool, details: Any = None) -> None:
    checks.append({"name": name, "status": "PASS" if ok else "FAIL", "details": details})
    if not ok:
        errors.append(f"{name}: {details}")


def api_json(path: str, query: dict[str, Any] | None = None) -> Any:
    url = path if path.startswith("http") else f"{API}{path}"
    if query:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(query, doseq=True)
    request = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "gb-production-evidence-v3/1.0",
    })
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.loads(response.read().decode("utf-8"))


report: dict[str, Any] = {
    "schemaVersion": 3,
    "kind": "exact-production-evidence-import",
    "repository": REPOSITORY,
    "targetSha": TARGET_SHA,
    "targetPullRequest": TARGET_PR,
    "projection": {
        "mode": "operator-recovery",
        "historicalAutomatedLedgerRun": 30169981463,
        "historicalAutomatedLedgerConclusion": "failure",
        "sourceRepairPullRequest": SOURCE_FIX_PR,
        "sourceRepairMergeSha": SOURCE_FIX_MERGE_SHA,
    },
    "startedAt": datetime.now(timezone.utc).isoformat(),
    "checks": checks,
}

try:
    v2_files = list(V2_DIRECTORY.rglob("production-evidence-f5e29998-v2.json"))
    add("immutable V2 report is unique", len(v2_files) == 1, [str(path) for path in v2_files])
    v2 = json.loads(v2_files[0].read_text(encoding="utf-8")) if len(v2_files) == 1 else {}
    report["immutableV2"] = {
        "schemaVersion": v2.get("schemaVersion"),
        "result": v2.get("result"),
        "errors": v2.get("errors"),
        "startedAt": v2.get("startedAt"),
        "finishedAt": v2.get("finishedAt"),
        "runs": v2.get("runs"),
        "witnessArtifacts": {
            "tts": next((check.get("details") for check in v2.get("checks", []) if check.get("name") == "TTS artifact nonexpired positive digest"), None),
            "pages": next((check.get("details") for check in v2.get("checks", []) if check.get("name") == "Pages artifact nonexpired positive digest"), None),
        },
    }

    expected_v2_failures = {"downstream ledger succeeded", "exact ledger comment exists"}
    v2_failed_checks = {
        check.get("name")
        for check in v2.get("checks", [])
        if check.get("status") == "FAIL"
    }
    add("V2 failed only on historical projection boundary", v2_failed_checks == expected_v2_failures, sorted(v2_failed_checks))

    required_pass_checks = {
        "readiness exact SHA succeeded",
        "deploy exact SHA succeeded",
        "exact TTS artifact unique",
        "exact Pages artifact unique",
        "TTS artifact nonexpired positive digest",
        "Pages artifact nonexpired positive digest",
        "downloaded witness has exactly one report",
        "downloaded live report is exact PASS",
        "downloaded live report points to readiness",
        "downloaded live report has routes/assets",
        "GitHub Pages deployment status succeeded",
        "live current pointer exact",
        "live run provenance exact",
    }
    v2_pass_checks = {
        check.get("name")
        for check in v2.get("checks", [])
        if check.get("status") == "PASS"
    }
    missing_passes = sorted(required_pass_checks - v2_pass_checks)
    add("V2 contains the full exact production chain", not missing_passes, missing_passes)

    runs = v2.get("runs", {})
    add(
        "V2 run identities are exact",
        runs.get("readiness", {}).get("id") == 30169126149
        and runs.get("readiness", {}).get("conclusion") == "success"
        and runs.get("deploy", {}).get("id") == DEPLOY_RUN_ID
        and runs.get("deploy", {}).get("conclusion") == "success"
        and runs.get("deploy", {}).get("head_sha") == TARGET_SHA,
        runs,
    )

    ledger_diagnostic = v2.get("ledgerDiagnostic", {})
    ledger_run = ledger_diagnostic.get("run", {})
    log_tail = "\n".join(ledger_diagnostic.get("failedJobLogTail", []))
    add(
        "V2 preserves the exact historical ledger failure",
        ledger_run.get("id") == 30169981463
        and ledger_run.get("conclusion") == "failure"
        and "Resource not accessible by integration" in log_tail
        and f"issues/{TARGET_PR}/comments" in log_tail,
        {"run": ledger_run, "logTail": ledger_diagnostic.get("failedJobLogTail", [])},
    )

    comments = api_json(f"/repos/{OWNER}/{REPO}/issues/{TARGET_PR}/comments", {"per_page": 100})
    matching = [comment for comment in comments if MARKER in str(comment.get("body") or "")]
    report["projection"]["commentMarker"] = MARKER
    report["projection"]["matchingComments"] = [
        {"id": comment.get("id"), "url": comment.get("html_url"), "createdAt": comment.get("created_at")}
        for comment in matching
    ]
    add("exact operator projection marker is unique", len(matching) == 1, report["projection"]["matchingComments"])
    if len(matching) == 1:
        body = str(matching[0].get("body") or "")
        add(
            "operator projection is explicitly non-automated and evidence-bound",
            "operator recovery" in body.lower()
            and "not" in body.lower()
            and "30169981463" in body
            and "403 Resource not accessible by integration" in body
            and "8622642553" in body
            and "sha256:bacb0330c7a2201289eeeb7d2b9b9dc832106eec292cd890afc1c5819e1eec7f" in body
            and "8622641548" in body
            and "sha256:38a3a138d9f062e43c0e3ed52666113759d310cb0231e2ee388fc522b25e2b2c" in body,
            {"commentId": matching[0].get("id"), "url": matching[0].get("html_url")},
        )

    source_fix = api_json(f"/repos/{OWNER}/{REPO}/pulls/{SOURCE_FIX_PR}")
    report["sourceRepair"] = {
        "number": source_fix.get("number"),
        "state": source_fix.get("state"),
        "merged": source_fix.get("merged"),
        "mergeCommitSha": source_fix.get("merge_commit_sha"),
        "url": source_fix.get("html_url"),
    }
    add(
        "permission/replay/supply-chain source repair is merged",
        source_fix.get("merged") is True
        and source_fix.get("merge_commit_sha") == SOURCE_FIX_MERGE_SHA,
        report["sourceRepair"],
    )

except Exception as exc:  # noqa: BLE001
    add("V3 completed without unexpected exception", False, f"{type(exc).__name__}: {exc}")

report["finishedAt"] = datetime.now(timezone.utc).isoformat()
report["result"] = "PASS" if not errors else "FAIL"
report["errors"] = errors
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
raise SystemExit(0 if not errors else 1)
