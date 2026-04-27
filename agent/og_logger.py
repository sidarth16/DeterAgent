# agent/og_logger.py

import json
import os
import time

LOG_FILE = "logs/footprints.json"

def log_footprint(task_id: str, url: str, content: str):
    os.makedirs("logs", exist_ok=True)
    
    entry = {
        "task_id": task_id,
        "url": url,
        "content": content[:3000],
        "timestamp": time.time()
    }
    
    # Append to local log file
    logs = []
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, "r") as f:
            logs = json.load(f)
    
    logs.append(entry)
    
    with open(LOG_FILE, "w") as f:
        json.dump(logs, f, indent=2)
    
    print(f"   📝 Logged: {url[:60]}")
    return entry

def fetch_footprints(task_id: str) -> list[str]:
    if not os.path.exists(LOG_FILE):
        return []
    
    with open(LOG_FILE, "r") as f:
        logs = json.load(f)
    
    return [
        e["content"] for e in logs
        if e["task_id"] == task_id
    ]