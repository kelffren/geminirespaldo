import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

SOURCE_REPO = "kelffren/gemini"
BACKUP_REPO = "kelffren/geminirespaldo"
SOURCE_DIR = Path(os.environ.get("SOURCE_DIR", "_source")).resolve()
INDEX_PATH = Path("BACKUP_INDEX.json")
TOKEN = os.environ.get("GITHUB_TOKEN", "")
SMOKE_RESULT = os.environ.get("SMOKE_RESULT", "failure").lower()
FORCE_SEMI = os.environ.get("FORCE_SEMI", "false").lower() == "true"


def run(args, cwd=None, check=True, input_text=None):
    result = subprocess.run(
        args,
        cwd=cwd,
        check=False,
        text=True,
        input=input_text,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if check and result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or f"command failed: {args[0]}")
    return result


def api(path):
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "kelo-versioned-backup-vault",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    req = Request(f"https://api.github.com{path}", headers=headers)
    with urlopen(req, timeout=30) as response:
        return json.load(response)


def latest_workflow_run(runs, workflow_path, source_sha):
    matches = [
        r for r in runs
        if r.get("head_sha") == source_sha and r.get("path") == workflow_path
    ]
    matches.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    return matches[0] if matches else None


def safe_version():
    index = SOURCE_DIR / "index.html"
    if not index.exists():
        return "unknown"
    text = index.read_text(errors="ignore")
    match = re.search(r"<title>\s*Kelo World\s*[—-]\s*([^<]+)</title>", text, re.I)
    raw = match.group(1).strip() if match else "unknown"
    return re.sub(r"[^A-Za-z0-9._-]+", "-", raw).strip("-") or "unknown"


def load_index():
    if INDEX_PATH.exists():
        return json.loads(INDEX_PATH.read_text())
    return {
        "schema": 1,
        "source_repo": SOURCE_REPO,
        "backup_repo": BACKUP_REPO,
        "policy": {
            "clean_requires": [
                "Kelo CI success for exact source SHA",
                "Live mobile screenshot audit success for exact source SHA",
                "fresh mobile playability smoke success with no crash/pageerror detected",
            ],
            "defer_if_required_checks_are_still_running": True,
            "semi_after_missing_or_failed_checks_hours": 2,
            "prune_trigger_clean_count": 10,
            "prune_count": 5,
            "minimum_clean_after_prune": 5,
            "prune_priority": ["SEMI", "oldest CLEAN"],
        },
        "snapshots": [],
    }


def remote_url():
    if not TOKEN:
        raise RuntimeError("GITHUB_TOKEN missing")
    return f"https://x-access-token:{TOKEN}@github.com/{BACKUP_REPO}.git"


def push_snapshot(source_sha, tree_sha, branch, message):
    env = os.environ.copy()
    env.update({
        "GIT_AUTHOR_NAME": "Kelo Backup Vault",
        "GIT_AUTHOR_EMAIL": "backup-vault@users.noreply.github.com",
        "GIT_COMMITTER_NAME": "Kelo Backup Vault",
        "GIT_COMMITTER_EMAIL": "backup-vault@users.noreply.github.com",
    })
    commit = subprocess.run(
        ["git", "commit-tree", tree_sha],
        cwd=SOURCE_DIR,
        text=True,
        input=message + "\n",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
    )
    if commit.returncode != 0:
        raise RuntimeError(commit.stderr.strip())
    snapshot_commit = commit.stdout.strip()
    result = subprocess.run(
        ["git", "push", remote_url(), f"{snapshot_commit}:refs/heads/{branch}"],
        cwd=SOURCE_DIR,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    return snapshot_commit


def delete_snapshot_branch(branch):
    result = run(["git", "push", remote_url(), "--delete", branch], check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"failed deleting {branch}")


def commit_catalog(message):
    run(["git", "config", "user.name", "Kelo Backup Vault"])
    run(["git", "config", "user.email", "backup-vault@users.noreply.github.com"])
    run(["git", "add", "BACKUP_INDEX.json", "LATEST_SNAPSHOT.txt", "LATEST_CLEAN.txt"], check=False)
    staged = run(["git", "diff", "--cached", "--quiet"], check=False)
    if staged.returncode == 0:
        return
    run(["git", "commit", "-m", message])
    run(["git", "push", "origin", "main"])


def main():
    if not SOURCE_DIR.exists():
        raise RuntimeError(f"source directory missing: {SOURCE_DIR}")

    source_sha = run(["git", "rev-parse", "HEAD"], cwd=SOURCE_DIR).stdout.strip()
    tree_sha = run(["git", "rev-parse", "HEAD^{tree}"], cwd=SOURCE_DIR).stdout.strip()
    commit_epoch = int(run(["git", "show", "-s", "--format=%ct", "HEAD"], cwd=SOURCE_DIR).stdout.strip())
    age_hours = max(0.0, (datetime.now(timezone.utc).timestamp() - commit_epoch) / 3600.0)
    version = safe_version()

    index = load_index()
    snapshots = index.setdefault("snapshots", [])
    if any(s.get("source_sha") == source_sha for s in snapshots):
        print(f"BACKUP_SKIP already cataloged source_sha={source_sha}")
        return 0

    runs_data = api(f"/repos/{SOURCE_REPO}/actions/runs?branch=main&per_page=100")
    runs = runs_data.get("workflow_runs", [])
    ci = latest_workflow_run(runs, ".github/workflows/ci.yml", source_sha)
    live = latest_workflow_run(runs, ".github/workflows/live-audit.yml", source_sha)

    required = {"kelo_ci": ci, "live_mobile_audit": live}
    pending = [
        name for name, run_info in required.items()
        if run_info and run_info.get("status") in {"queued", "in_progress", "waiting", "pending"}
    ]
    missing = [name for name, run_info in required.items() if not run_info]

    if not FORCE_SEMI and (pending or (missing and age_hours < 2.0)):
        print(json.dumps({
            "decision": "DEFER",
            "source_sha": source_sha,
            "age_hours": round(age_hours, 2),
            "pending": pending,
            "missing": missing,
            "smoke": SMOKE_RESULT,
        }))
        return 0

    ci_success = bool(ci and ci.get("status") == "completed" and ci.get("conclusion") == "success")
    live_success = bool(live and live.get("status") == "completed" and live.get("conclusion") == "success")
    smoke_success = SMOKE_RESULT == "success"
    status = "CLEAN" if ci_success and live_success and smoke_success else "SEMI"

    next_id = max([int(s.get("id", 0)) for s in snapshots] or [0]) + 1
    now = datetime.now(timezone.utc)
    stamp = now.strftime("%Y%m%d-%H%M%S")
    branch = f"snapshots/{next_id:04d}-{status}-{version}-{stamp}"

    failures = []
    if not ci_success:
        failures.append("Kelo CI not successful for exact source SHA")
    if not live_success:
        failures.append("Live mobile screenshot audit not successful for exact source SHA")
    if not smoke_success:
        failures.append("fresh playability smoke failed")

    message = (
        f"Kelo World backup {next_id:04d} {status}\n"
        f"Source: {SOURCE_REPO}@{source_sha}\n"
        f"Version: {version}\n"
        f"Classification: {status}\n"
    )
    snapshot_commit = push_snapshot(source_sha, tree_sha, branch, message)

    record = {
        "id": next_id,
        "status": status,
        "branch": branch,
        "source_sha": source_sha,
        "source_tree_sha": tree_sha,
        "snapshot_commit": snapshot_commit,
        "version": version,
        "created_at": now.isoformat(),
        "active": True,
        "qualification": {
            "kelo_ci": {
                "success": ci_success,
                "run_id": ci.get("id") if ci else None,
                "conclusion": ci.get("conclusion") if ci else "missing",
            },
            "live_mobile_audit": {
                "success": live_success,
                "run_id": live.get("id") if live else None,
                "conclusion": live.get("conclusion") if live else "missing",
            },
            "fresh_playability_smoke": {
                "success": smoke_success,
                "outcome": SMOKE_RESULT,
            },
            "detected_failures": failures,
        },
    }
    snapshots.append(record)

    # Retention: nothing is pruned until there are at least 10 active CLEAN snapshots.
    active = [s for s in snapshots if s.get("active", True)]
    clean_active = [s for s in active if s.get("status") == "CLEAN"]
    pruned = []
    if len(clean_active) >= 10:
        candidates = sorted(
            [s for s in active if s["branch"] != branch],
            key=lambda s: (0 if s.get("status") == "SEMI" else 1, int(s.get("id", 0))),
        )
        current_clean = len(clean_active)
        for old in candidates:
            if len(pruned) >= 5:
                break
            if old.get("status") == "CLEAN" and current_clean <= 5:
                continue
            delete_snapshot_branch(old["branch"])
            old["active"] = False
            old["pruned_at"] = datetime.now(timezone.utc).isoformat()
            old["prune_reason"] = "automatic retention after reaching 10 CLEAN snapshots"
            pruned.append(old["branch"])
            if old.get("status") == "CLEAN":
                current_clean -= 1

    index["last_run_at"] = datetime.now(timezone.utc).isoformat()
    index["latest_snapshot"] = branch
    index["latest_clean"] = next((s["branch"] for s in reversed(snapshots) if s.get("status") == "CLEAN" and s.get("active", True)), None)
    index["active_counts"] = {
        "clean": sum(1 for s in snapshots if s.get("active", True) and s.get("status") == "CLEAN"),
        "semi": sum(1 for s in snapshots if s.get("active", True) and s.get("status") == "SEMI"),
        "total": sum(1 for s in snapshots if s.get("active", True)),
    }
    INDEX_PATH.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n")
    Path("LATEST_SNAPSHOT.txt").write_text(branch + "\n")
    Path("LATEST_CLEAN.txt").write_text((index.get("latest_clean") or "NONE") + "\n")
    commit_catalog(f"backup: register {next_id:04d} {status}")

    print(json.dumps({
        "decision": status,
        "id": next_id,
        "branch": branch,
        "source_sha": source_sha,
        "version": version,
        "failures": failures,
        "pruned": pruned,
        "active_counts": index["active_counts"],
    }))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"BACKUP_VAULT_ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
