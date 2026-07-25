#!/usr/bin/env python3
"""Temporary exact production/ledger verifier. Never merge."""
from __future__ import annotations

import json
import os
import pathlib
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any

REPOSITORY = os.environ.get("GITHUB_REPOSITORY", "FedorMilovanov/gb-is-my-strength")
TOKEN = os.environ["GITHUB_TOKEN"]
TARGET_SHA = os.environ.get("TARGET_SHA", "f5e29998c5b42cc9e4e7c917b1e1c1072aa52320").lower()
TARGET_PR = int(os.environ.get("TARGET_PR", "286"))
DEPLOY_RUN_ID = int(os.environ.get("DEPLOY_RUN_ID", "30169443420"))
WITNESS_DIRECTORY = pathlib.Path(os.environ["WITNESS_DIRECTORY"])
LIVE_BASE_URL = os.environ.get("LIVE_BASE_URL", "https://gospod-bog.ru").rstrip("/")
REPORT_PATH = pathlib.Path("reports/production-evidence-f5e29998-v2.json")
API = "https://api.github.com"
OWNER, REPO = REPOSITORY.split("/", 1)
DIGEST_RE = re.compile(r"^sha256:[a-f0-9]{64}$")
checks: list[dict[str, Any]] = []
errors: list[str] = []


def add(name: str, ok: bool, details: Any = None) -> None:
    checks.append({"name": name, "status": "PASS" if ok else "FAIL", "details": details})
    if not ok:
        errors.append(f"{name}: {details}")


def api_request(path: str, query: dict[str, Any] | None = None, accept: str = "application/vnd.github+json"):
    url = path if path.startswith("http") else f"{API}{path}"
    if query:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(query, doseq=True)
    request = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {TOKEN}",
        "Accept": accept,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "gb-production-evidence-v2/1.0",
    })
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read(), response.status, response.geturl()


def api_json(path: str, query: dict[str, Any] | None = None) -> Any:
    body, status, _ = api_request(path, query)
    if status < 200 or status >= 300:
        raise RuntimeError(f"GitHub API {status}: {path}")
    return json.loads(body.decode("utf-8"))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        return None


def github_blob_bytes(path: str) -> bytes:
    url = f"{API}{path}"
    opener = urllib.request.build_opener(NoRedirect)
    request = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "gb-production-evidence-v2/1.0",
    })
    try:
        opener.open(request, timeout=45)
        raise RuntimeError("expected GitHub redirect")
    except urllib.error.HTTPError as exc:
        if exc.code not in (301, 302, 303, 307, 308):
            raise
        location = exc.headers.get("Location")
        if not location:
            raise RuntimeError(f"GitHub redirect lacks Location for {path}") from exc
    unsigned = urllib.request.Request(location, headers={"User-Agent": "gb-production-evidence-v2/1.0"})
    with urllib.request.urlopen(unsigned, timeout=45) as response:
        return response.read()


def live_json(path: str) -> Any:
    url = f"{LIVE_BASE_URL}{path}?evidence_v2={TARGET_SHA[:12]}-{int(datetime.now().timestamp())}"
    request = urllib.request.Request(url, headers={
        "User-Agent": "gb-production-evidence-v2/1.0",
        "Cache-Control": "no-cache, no-store, max-age=0",
        "Pragma": "no-cache",
    })
    with urllib.request.urlopen(request, timeout=45) as response:
        if response.status != 200:
            raise RuntimeError(f"live HTTP {response.status}: {url}")
        return json.loads(response.read().decode("utf-8"))


def compact_run(run: dict[str, Any] | None) -> Any:
    if not run:
        return None
    return {key: run.get(key) for key in (
        "id", "name", "event", "status", "conclusion", "head_sha", "head_branch",
        "run_attempt", "created_at", "updated_at", "html_url",
    )}


report: dict[str, Any] = {
    "schemaVersion": 2,
    "kind": "exact-production-evidence-import",
    "repository": REPOSITORY,
    "targetSha": TARGET_SHA,
    "targetPullRequest": TARGET_PR,
    "deployRunId": DEPLOY_RUN_ID,
    "startedAt": datetime.now(timezone.utc).isoformat(),
    "checks": checks,
}

try:
    runs = api_json(f"/repos/{OWNER}/{REPO}/actions/runs", {"head_sha": TARGET_SHA, "per_page": 100}).get("workflow_runs", [])
    exact = [run for run in runs if str(run.get("head_sha", "")).lower() == TARGET_SHA]
    readiness = next((r for r in exact if r.get("id") == 30169126149), None)
    deploy = next((r for r in exact if r.get("id") == DEPLOY_RUN_ID), None)
    ledger_runs = sorted([r for r in exact if r.get("name") == "Deployment Witness Ledger"], key=lambda r: int(r.get("id") or 0))
    ledger = ledger_runs[-1] if ledger_runs else None
    report["runs"] = {"readiness": compact_run(readiness), "deploy": compact_run(deploy), "ledger": compact_run(ledger)}
    add("readiness exact SHA succeeded", bool(readiness and readiness.get("conclusion") == "success"), compact_run(readiness))
    add("deploy exact SHA succeeded", bool(deploy and deploy.get("conclusion") == "success"), compact_run(deploy))

    artifacts = api_json(f"/repos/{OWNER}/{REPO}/actions/runs/{DEPLOY_RUN_ID}/artifacts", {"per_page": 100}).get("artifacts", [])
    live_artifacts = [a for a in artifacts if a.get("name") == f"tts-live-deployment-{DEPLOY_RUN_ID}"]
    page_artifacts = [a for a in artifacts if a.get("name") == "github-pages"]
    add("exact TTS artifact unique", len(live_artifacts) == 1, live_artifacts)
    add("exact Pages artifact unique", len(page_artifacts) == 1, page_artifacts)
    live_artifact = live_artifacts[0] if len(live_artifacts) == 1 else None
    page_artifact = page_artifacts[0] if len(page_artifacts) == 1 else None
    for label, artifact in (("TTS", live_artifact), ("Pages", page_artifact)):
        add(f"{label} artifact nonexpired positive digest", bool(
            artifact and artifact.get("expired") is False and int(artifact.get("id") or 0) > 0
            and int(artifact.get("size_in_bytes") or 0) > 0 and DIGEST_RE.fullmatch(str(artifact.get("digest") or ""))
        ), artifact)

    files = list(WITNESS_DIRECTORY.rglob("tts-live-deployment-contract.json"))
    add("downloaded witness has exactly one report", len(files) == 1, [str(p) for p in files])
    witness = json.loads(files[0].read_text(encoding="utf-8")) if len(files) == 1 else {}
    pass_attempts = [a for a in witness.get("attempts", []) if a.get("result") == "PASS"]
    evidence = pass_attempts[0].get("evidence", {}) if len(pass_attempts) == 1 else {}
    deploy_attempt = int(deploy.get("run_attempt") or 0) if deploy else 0
    provenance_path = f"/deployments/{TARGET_SHA}/{DEPLOY_RUN_ID}-{deploy_attempt}.json"
    add("downloaded live report is exact PASS", witness.get("result") == "PASS" and witness.get("deployedSha") == TARGET_SHA and witness.get("workflowRunId") == DEPLOY_RUN_ID and witness.get("workflowRunAttempt") == deploy_attempt, witness)
    add("downloaded live report points to readiness", evidence.get("provenance", {}).get("sourceReadinessRunId") == 30169126149, evidence.get("provenance"))
    add("downloaded live report has routes/assets", len(evidence.get("routeEvidence", [])) >= 2 and all(k in evidence.get("assets", {}) for k in ("controller", "engine", "noticeCss", "serviceWorker")), evidence)

    deployments = api_json(f"/repos/{OWNER}/{REPO}/deployments", {"sha": TARGET_SHA, "environment": "github-pages", "per_page": 100})
    successful_deployments = []
    for deployment in deployments:
        statuses = api_json(deployment["statuses_url"], {"per_page": 100})
        success = next((s for s in statuses if s.get("state") == "success"), None)
        if success:
            successful_deployments.append({"deployment": deployment, "successStatus": success})
    report["githubPagesDeployments"] = successful_deployments
    add("GitHub Pages deployment status succeeded", len(successful_deployments) >= 1, successful_deployments)

    pointer = live_json("/deployments/current.json")
    provenance = live_json(provenance_path)
    report["livePointer"] = pointer
    report["liveProvenance"] = provenance
    add("live current pointer exact", pointer.get("commitSha") == TARGET_SHA and pointer.get("immutablePath") == provenance_path and pointer.get("workflow", {}).get("runId") == DEPLOY_RUN_ID, pointer)
    add("live run provenance exact", provenance.get("commitSha") == TARGET_SHA and provenance.get("immutablePath") == provenance_path and provenance.get("workflow", {}).get("runId") == DEPLOY_RUN_ID and provenance.get("workflow", {}).get("sourceReadinessRunId") == 30169126149, provenance)

    ledger_ok = bool(ledger and ledger.get("status") == "completed" and ledger.get("conclusion") == "success")
    ledger_details: dict[str, Any] = {"run": compact_run(ledger)}
    if ledger and not ledger_ok:
        jobs = api_json(f"/repos/{OWNER}/{REPO}/actions/runs/{ledger['id']}/jobs", {"per_page": 100}).get("jobs", [])
        ledger_details["jobs"] = jobs
        failed = [job for job in jobs if job.get("conclusion") == "failure"]
        if failed:
            log_bytes = github_blob_bytes(f"/repos/{OWNER}/{REPO}/actions/jobs/{failed[0]['id']}/logs")
            log_text = log_bytes.decode("utf-8", errors="replace")
            ledger_details["failedJobLogTail"] = log_text.splitlines()[-80:]
    report["ledgerDiagnostic"] = ledger_details
    add("downstream ledger succeeded", ledger_ok, ledger_details)

    comments = api_json(f"/repos/{OWNER}/{REPO}/issues/{TARGET_PR}/comments", {"per_page": 100})
    artifact_id = int(live_artifact.get("id") or 0) if live_artifact else 0
    marker = f"<!-- deployment-capability-witness:tts:{TARGET_SHA}:{DEPLOY_RUN_ID}:{deploy_attempt}:{artifact_id} -->"
    matching = [c for c in comments if marker in str(c.get("body") or "")]
    report["expectedLedgerMarker"] = marker
    report["ledgerComments"] = [{"id": c.get("id"), "url": c.get("html_url")} for c in matching]
    add("exact ledger comment exists", len(matching) == 1, report["ledgerComments"])
except Exception as exc:  # noqa: BLE001
    add("verifier completed without unexpected exception", False, f"{type(exc).__name__}: {exc}")

report["finishedAt"] = datetime.now(timezone.utc).isoformat()
report["result"] = "PASS" if not errors else "FAIL"
report["errors"] = errors
REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
raise SystemExit(0 if not errors else 1)
