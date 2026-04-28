import requests, os
from dotenv import load_dotenv
load_dotenv()

KEEPERHUB_WEBHOOK = os.getenv("KEEPERHUB_WEBHOOK")

def trigger_keeperhub(trust_score: int, agent: str = "deteragent") -> dict:
    payload = {
        "trust_score": trust_score,
        "threshold": 70,
        "agent": agent,
    }

    print(f"\n⚙️  Triggering KeeperHub...")
    
    try:
        r = requests.post(KEEPERHUB_WEBHOOK, json=payload, timeout=15)
        data = r.json()
        
        if trust_score >= 70:
            print(f"   ✅ KeeperHub: EXECUTE")
        else:
            print(f"   🚨 KeeperHub: BLOCKED")
            
        return data
    except Exception as e:
        print(f"   ⚠️  KeeperHub error: {e}")
        return {"status": "error"}