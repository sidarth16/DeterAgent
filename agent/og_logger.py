import json, os, time, subprocess
from dotenv import load_dotenv
load_dotenv()

LOG_FILE = "logs/footprints.json"
OG_SCRIPT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "../og_storage/upload.js"
)

def log_footprint(task_id: str, url: str, content: str) -> str:
    os.makedirs("logs", exist_ok=True)

    entry = {
        "task_id": task_id,
        "url": url,
        "content": content[:3000],
        "timestamp": time.time()
    }

    # Save locally always
    logs = []
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE) as f:
            logs = json.load(f)
    logs.append(entry)
    with open(LOG_FILE, "w") as f:
        json.dump(logs, f, indent=2)

    print(f"    Logged: {url[:60]}")

    # Upload to 0G Storage
    try:
        tmp_path = f"logs/tmp_{task_id}_{int(time.time())}.json"
        with open(tmp_path, "w") as f:
            json.dump(entry, f)

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
            print(f"    0G Storage: {root[:20]}...")
            return root
        else:
            print(f"   ⚠️  0G failed: {result.stderr[-100:]}")
            return "local_only"

    except Exception as e:
        print(f"   ⚠️  0G Storage failed: {e}")
        return "local_only"

def fetch_footprints(task_id: str) -> list[str]:
    if not os.path.exists(LOG_FILE):
        return []
    with open(LOG_FILE) as f:
        logs = json.load(f)
    return [e["content"] for e in logs
            if e["task_id"] == task_id]