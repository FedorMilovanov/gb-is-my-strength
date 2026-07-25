#!/usr/bin/env python3
"""Temporary read-only verifier for the exact f5e29998 production chain.

This file and its workflow must never merge. It uses only read APIs, downloads the
exact deploy-run witness artifact, validates the live pointer/provenance, and
writes one machine-readable report for forensic import into AuditRepo.
"""

from __future__ import annotations

import io
import json
import os
import pathlib
import re
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from typing import Any

REPOSITORY = os.environ.get("GITHUB_REPOSITORY", "FedorMilovanov/gb-is-my-strength").strip()
TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
TARGET_SHA = os.environ.get("TARGET_SHA", "f5e29998c5b42cc9e4e7c917b1e1c1072aa52320").strip().lower()
TARGET_PR = int(os.environ.get("TARGET_PR", "286"))
LIVE_BASE_URL = os.environ.get("LIVE_BASE_URL", "https://gospod-bog.ru").rstrip("/")
REPORT_PATH = pathlib.Path("reports/production-evidence-f5e29998.json")
API_BASE = "https://api.github.com"
FULL_SHA_RE = re.compile(r"^[a-f0-9]{40}$")
DIGEST_RE = re.compile(r"^sha256:[a-f0-9]{64}$")

if not TOKEN:
    raise SystemExit("GITHUB_TOKEN is required")
if not FULL_SHA_RE.fullmatch(TARGET_SHA):
    raise SystemExit("TARGET_SHA must be a full 40-character lowercase SHA")
if "/" not in REPOSITORY:
    raise SystemExit("GITHUB_REPOSITORY must be owner/name")

OWNER, REPO = REPOSITORY.split("/", 1)
checks: list[dict[str, Any]] = []
errors: list[str] = []


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def record(name: str, ok: bool, details: Any = None) -> None:
    checks.append({"name": name, "status": "PASS" if ok else "FAIL", "details": details})
    if not ok:
        errors.append(f"{name}: {details}")


def request_bytes(url: str, *, github_api: bool = False) -> tuple[bytes, dict[str, str], int, str]:
    headers = {
        "User-Agent": "gb-production-evidence-verifier/1.0",
        "Accept": "application/vnd.github+json" if github_api else "application/json, text/plain, */*",
        "Cache-Control": "no-cache, no-store, max-age=0",
        "Pragma": "no-cache",
    }
    if github_api:
        headers["Authorization"] = f"Bearer {TOKEN}"
        headers["X-GitHub-Api-Version"] = "2022-11-28"
    request = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            return response.read(), {k.lower(): v for k, v in response.headers.items()}, response.status, response.geturl()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} for {url}: {body[:800]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"network error for {url}: {exc}") from exc


def api_json(path: str, query: dict[str, Any] | None = None) -> Any:
    query_string = urllib.parse.urlencode(query or {}, doseq=True)
    url = f"{API_BASE}{path}"
    if query_string:
        url += f"?{query_string}"
    body, _headers, status, _final_url = request_bytes(url, github_api=True)
    if status < 200 or status >= 300:
        raise RuntimeError(f"unexpected API status {status} for {url}")
    return json.loads(body.decode("utf-8"))


def live_json(path_or_url: str) -> tuple[Any, str]:
    base = path_or_url if path_or_url.startswith("http") else f"{LIVE_BASE_URL}{path_or_url}"
    separator = "&" if "?" in base else "?"
    url = f"{base}{separator}evidence_probe={TARGET_SHA[:12]}-{int(datetime.now().timestamp())}"
    body, headers, status, final_url = request_bytes(url, github_api=False)
    if status != 200:
        raise RuntimeError(f"live HTTP {status} for {url}")
    content_type = headers.get("content-type", "")
    if not re.search(r"json|text/plain|octet-stream", content_type, re.I):
        raise RuntimeError(f"unexpected live content-type {content_type!r} for {url}")
    return json.loads(body.decode("utf-8")), final_url


def completed_success(runs: list[dict[str, Any]], name: str) -> list[dict[str, Any]]:
    matches = [
        run
        for run in runs
        if run.get("name") == name
        and str(run.get("head_sha", "")).lower() == TARGET_SHA
        and run.get("status") == "completed"
        and run.get("conclusion") == "success"
    ]
    return sorted(matches, key=lambda run: (run.get("created_at") or "", int(run.get("run_attempt") or 0), int(run.get("id") or 0)))


def safe_extract_zip(data: bytes, destination: pathlib.Path) -> list[pathlib.Path]:
    extracted: list[pathlib.Path] = []
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        for info in archive.infolist():
            pure = pathlib.PurePosixPath(info.filename)
            if pure.is_absolute() or ".." in pure.parts:
                raise RuntimeError(f"unsafe artifact path: {info.filename}")
            target = destination.joinpath(*pure.parts)
            if info.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(info) as source, target.open("wb") as output:
                output.write(source.read())
            extracted.append(target)
    return extracted


def summarize_run(run: dict[str, Any] | None) -> Any:
    if not run:
        return None
    return {
        "id": run.get("id"),
        "name": run.get("name"),
        "event": run.get("event"),
        "status": run.get("status"),
        "conclusion": run.get("conclusion"),
        "headSha": run.get("head_sha"),
        "headBranch": run.get("head_branch"),
        "runAttempt": run.get("run_attempt"),
        "createdAt": run.get("created_at"),
        "updatedAt": run.get("updated_at"),
        "url": run.get("html_url"),
    }


report: dict[str, Any] = {
    "schemaVersion": 1,
    "kind": "exact-production-evidence-import",
    "repository": REPOSITORY,
    "targetSha": TARGET_SHA,
    "targetPullRequest": TARGET_PR,
    "liveBaseUrl": LIVE_BASE_URL,
    "startedAt": now_iso(),
    "checks": checks,
}

try:
    runs_payload = api_json(f"/repos/{OWNER}/{REPO}/actions/runs", {"head_sha": TARGET_SHA, "per_page": 100})
    runs = runs_payload.get("workflow_runs", [])
    report["observedRuns"] = [summarize_run(run) for run in runs]
    record("actions runs returned for exact SHA", len(runs) > 0, {"count": len(runs)})

    readiness_runs = completed_success(runs, "Metadata & IndexNow Readiness")
    deploy_runs = completed_success(runs, "Deploy to GitHub Pages")
    ledger_runs = completed_success(runs, "Deployment Witness Ledger")
    readiness = readiness_runs[-1] if readiness_runs else None
    deploy = deploy_runs[-1] if deploy_runs else None
    ledger = ledger_runs[-1] if ledger_runs else None
    report["selectedRuns"] = {
        "readiness": summarize_run(readiness),
        "deploy": summarize_run(deploy),
        "ledger": summarize_run(ledger),
    }
    record("successful readiness run exists", readiness is not None, summarize_run(readiness))
    record("successful deploy run exists", deploy is not None, summarize_run(deploy))
    record("successful downstream ledger run exists", ledger is not None, summarize_run(ledger))

    deploy_id = int(deploy.get("id")) if deploy else 0
    deploy_attempt = int(deploy.get("run_attempt") or 0) if deploy else 0
    artifact: dict[str, Any] | None = None
    witness_report: dict[str, Any] | None = None
    witness_evidence: dict[str, Any] | None = None
    expected_provenance_path: str | None = None

    if deploy_id > 0:
        artifacts_payload = api_json(f"/repos/{OWNER}/{REPO}/actions/runs/{deploy_id}/artifacts", {"per_page": 100})
        expected_artifact_name = f"tts-live-deployment-{deploy_id}"
        matching = [item for item in artifacts_payload.get("artifacts", []) if item.get("name") == expected_artifact_name]
        record("exact live witness artifact is unique", len(matching) == 1, {"name": expected_artifact_name, "matches": len(matching)})
        if len(matching) == 1:
            artifact = matching[0]
            report["witnessArtifact"] = {
                "id": artifact.get("id"),
                "name": artifact.get("name"),
                "digest": artifact.get("digest"),
                "bytes": artifact.get("size_in_bytes"),
                "expired": artifact.get("expired"),
                "createdAt": artifact.get("created_at"),
                "expiresAt": artifact.get("expires_at"),
                "url": artifact.get("url"),
            }
            record("live witness artifact is not expired", artifact.get("expired") is False, report["witnessArtifact"])
            record("live witness artifact has positive ID and bytes", int(artifact.get("id") or 0) > 0 and int(artifact.get("size_in_bytes") or 0) > 0, report["witnessArtifact"])
            record("live witness artifact has REST SHA-256 digest", bool(DIGEST_RE.fullmatch(str(artifact.get("digest") or ""))), artifact.get("digest"))

            artifact_bytes, _headers, artifact_status, artifact_final_url = request_bytes(
                f"{API_BASE}/repos/{OWNER}/{REPO}/actions/artifacts/{artifact['id']}/zip", github_api=True
            )
            record("live witness artifact archive downloaded", artifact_status == 200 and len(artifact_bytes) > 0, {"bytes": len(artifact_bytes), "finalUrlHost": urllib.parse.urlparse(artifact_final_url).hostname})
            with tempfile.TemporaryDirectory(prefix="gb-production-witness-") as temp_dir:
                extracted = safe_extract_zip(artifact_bytes, pathlib.Path(temp_dir))
                report_files = [path for path in extracted if path.name == "tts-live-deployment-contract.json"]
                record("artifact contains exactly one live report", len(report_files) == 1, [str(path.relative_to(temp_dir)) for path in report_files])
                if len(report_files) == 1:
                    witness_report = json.loads(report_files[0].read_text(encoding="utf-8"))
                    pass_attempts = [attempt for attempt in witness_report.get("attempts", []) if attempt.get("result") == "PASS"]
                    witness_evidence = pass_attempts[0].get("evidence") if len(pass_attempts) == 1 else None
                    expected_provenance_path = f"/deployments/{TARGET_SHA}/{deploy_id}-{deploy_attempt}.json"
                    report["liveReport"] = witness_report
                    record("live report result is PASS", witness_report.get("result") == "PASS", witness_report.get("result"))
                    record("live report repository matches", witness_report.get("expectedRepository") == REPOSITORY, witness_report.get("expectedRepository"))
                    record("live report SHA matches", str(witness_report.get("deployedSha", "")).lower() == TARGET_SHA, witness_report.get("deployedSha"))
                    record("live report run identity matches", witness_report.get("workflowRunId") == deploy_id and witness_report.get("workflowRunAttempt") == deploy_attempt, {"reportRunId": witness_report.get("workflowRunId"), "reportAttempt": witness_report.get("workflowRunAttempt"), "deployRunId": deploy_id, "deployAttempt": deploy_attempt})
                    record("live report provenance path is run-addressed", witness_report.get("expected", {}).get("provenancePath") == expected_provenance_path, witness_report.get("expected", {}).get("provenancePath"))
                    record("live report has exactly one PASS attempt", len(pass_attempts) == 1, {"passAttempts": len(pass_attempts)})
                    record("live report carries route and asset evidence", bool(witness_evidence and len(witness_evidence.get("routeEvidence", [])) >= 2 and all(key in witness_evidence.get("assets", {}) for key in ("controller", "engine", "noticeCss", "serviceWorker"))), witness_evidence)

    source_readiness_id = None
    if witness_evidence:
        source_readiness_id = witness_evidence.get("provenance", {}).get("sourceReadinessRunId")
    report["sourceReadinessRunIdFromWitness"] = source_readiness_id
    if source_readiness_id:
        pointed_readiness = api_json(f"/repos/{OWNER}/{REPO}/actions/runs/{source_readiness_id}")
        report["pointedReadiness"] = summarize_run(pointed_readiness)
        record("witness points to successful exact-SHA readiness", pointed_readiness.get("name") == "Metadata & IndexNow Readiness" and pointed_readiness.get("conclusion") == "success" and str(pointed_readiness.get("head_sha", "")).lower() == TARGET_SHA, summarize_run(pointed_readiness))
    else:
        record("witness carries source readiness run ID", False, source_readiness_id)

    deployments = api_json(f"/repos/{OWNER}/{REPO}/deployments", {"sha": TARGET_SHA, "environment": "github-pages", "per_page": 100})
    successful_deployments: list[dict[str, Any]] = []
    for deployment in deployments:
        statuses = api_json(deployment["statuses_url"].replace(API_BASE, ""), {"per_page": 100})
        success_status = next((status for status in statuses if status.get("state") == "success"), None)
        if success_status:
            successful_deployments.append({
                "id": deployment.get("id"),
                "sha": deployment.get("sha"),
                "environment": deployment.get("environment"),
                "createdAt": deployment.get("created_at"),
                "status": success_status,
            })
    report["pagesDeployments"] = successful_deployments
    record("successful github-pages deployment exists for exact SHA", len(successful_deployments) > 0, {"count": len(successful_deployments), "deployments": successful_deployments})

    if expected_provenance_path:
        pointer, pointer_url = live_json("/deployments/current.json")
        report["liveCurrentPointer"] = pointer
        report["liveCurrentPointerUrl"] = pointer_url
        record("live current pointer identifies exact SHA", pointer.get("repository") == REPOSITORY and str(pointer.get("commitSha", "")).lower() == TARGET_SHA, pointer)
        record("live current pointer identifies exact run object", pointer.get("immutablePath") == expected_provenance_path and pointer.get("workflow", {}).get("runId") == deploy_id and pointer.get("workflow", {}).get("runAttempt") == deploy_attempt, pointer)

        provenance, provenance_url = live_json(expected_provenance_path)
        report["liveProvenance"] = provenance
        report["liveProvenanceUrl"] = provenance_url
        record("live run provenance identifies exact SHA and run", provenance.get("repository") == REPOSITORY and str(provenance.get("commitSha", "")).lower() == TARGET_SHA and provenance.get("workflow", {}).get("runId") == deploy_id and provenance.get("workflow", {}).get("runAttempt") == deploy_attempt, provenance)
        record("live run provenance points to readiness run", provenance.get("workflow", {}).get("sourceReadinessRunId") == source_readiness_id, {"provenanceReadiness": provenance.get("workflow", {}).get("sourceReadinessRunId"), "reportReadiness": source_readiness_id})

    comments = api_json(f"/repos/{OWNER}/{REPO}/issues/{TARGET_PR}/comments", {"per_page": 100})
    marker = None
    if artifact and deploy_id > 0:
        marker = f"<!-- deployment-capability-witness:tts:{TARGET_SHA}:{deploy_id}:{deploy_attempt}:{artifact.get('id')} -->"
    matching_comments = [comment for comment in comments if marker and marker in str(comment.get("body") or "")]
    report["ledgerCommentMarker"] = marker
    report["ledgerComments"] = [{"id": comment.get("id"), "url": comment.get("html_url"), "createdAt": comment.get("created_at")} for comment in matching_comments]
    record("exact downstream ledger comment exists on merged PR", len(matching_comments) == 1, report["ledgerComments"])

except Exception as exc:  # noqa: BLE001 - report exact operational boundary
    record("verifier completed without unexpected exception", False, f"{type(exc).__name__}: {exc}")

report["finishedAt"] = now_iso()
report["result"] = "PASS" if not errors else "FAIL"
report["errors"] = errors
REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
if errors:
    print(f"Production evidence verifier: FAIL ({len(errors)} failed checks).", file=sys.stderr)
    raise SystemExit(1)
print("Production evidence verifier: PASS.")
