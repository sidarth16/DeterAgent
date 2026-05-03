import json
import os
import subprocess
import time
from dotenv import load_dotenv
load_dotenv()
from utils.ui_logger import emit

LOG_FILE = "logs/footprints.json"
OG_SCRIPT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "../og_storage/upload.js"
)

def _load_logs() -> list[dict]:
    if not os.path.exists(LOG_FILE):
        return []
    try:
        with open(LOG_FILE, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        if isinstance(payload, list):
            return payload
    except Exception:
        pass
    return []

def _save_logs(logs: list[dict]) -> None:
    os.makedirs("logs", exist_ok=True)
    with open(LOG_FILE, "w", encoding="utf-8") as handle:
        json.dump(logs, handle, indent=2)

def log_footprint(task_id: str, url: str, content: str) -> dict:
    os.makedirs("logs", exist_ok=True)

    entry = {
        "task_id": task_id,
        "url": url,
        "content": content[:3000],
        "timestamp": time.time()
    }

    # Save locally always
    logs = _load_logs()
    logs.append(entry)
    _save_logs(logs)

    # emit(f"Footprint logged: {url[:60]}")
    return entry

def build_proof_bundle(task_id: str, task: str, sources: list[dict]) -> dict:
    return {
        "task_id": task_id,
        "task": task,
        "source_count": len(sources),
        "sources": [
            {
                "url": source.get("url", ""),
                "content": (source.get("content") or "")[:3000],
                "content_length": len(source.get("content") or ""),
                "fetched_at": source.get("fetched_at"),
            }
            for source in sources
        ],
        "created_at": time.time(),
    }

def upload_proof_bundle(bundle: dict) -> str:
    # Upload to 0G Storage
    try:
        task_id = str(bundle.get("task_id", "unknown"))
        tmp_path = f"logs/tmp_{task_id}_{int(time.time())}.json"
        with open(tmp_path, "w", encoding="utf-8") as handle:
            json.dump(bundle, handle, indent=2)

        result = subprocess.run(
            ["node", OG_SCRIPT, os.path.abspath(tmp_path)],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=os.path.join(os.path.dirname(
                os.path.abspath(__file__)), "../og_storage")
        )

        if os.path.exists(tmp_path):
            os.remove(tmp_path)

        if result.returncode == 0:
            # Get last line (the JSON output)
            last_line = [l for l in result.stdout.strip()
                        .split('\n') if l.startswith('{')][-1]
            data = json.loads(last_line)
            root = data['rootHash']
            emit(f"0G proof pinned: {root[:]}...")
            return root
        else:
            emit(f"0G upload failed: {result.stderr[-100:]}")
            return "local_only"

    except Exception as e:
        emit(f"0G upload failed: {e}")
        return "local_only"

def fetch_footprints(task_id: str) -> list[str]:
    logs = _load_logs()
    return [e["content"] for e in logs
            if e["task_id"] == task_id]
