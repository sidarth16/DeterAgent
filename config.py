# deteragent_config.py
import os, time
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OG_PRIVATE_KEY = os.getenv("OG_PRIVATE_KEY")


# Mock ENS registry — swap for real ENS tomorrow
ENS_REGISTRY = {}

def set_ens_score(agent_name: str, score: int, total_checks: int):
    ENS_REGISTRY[agent_name] = {
        "trust_score": score,
        "total_checks": total_checks,
        "verdict": "TRUSTED" if score >= 80 else "UNRELIABLE",
        "last_checked": time.time()
    }
    print(f"   🏷️  ENS: {agent_name}.eth → trust_score={score}")

def get_ens_score(agent_name: str) -> dict:
    return ENS_REGISTRY.get(agent_name, {})
