# ens/ens_manager.py
import os
import json
import sys
import time
from pathlib import Path
from web3 import Web3
from dotenv import load_dotenv
from utils.ui_logger import emit
load_dotenv()

ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
CHANGE_THRESHOLD = 10

w3 = Web3(Web3.HTTPProvider(os.getenv("ALCHEMY_SEPOLIA")))

ens_registry = w3.eth.contract(
    address=ENS_REGISTRY,
    abi=[{
        "name": "resolver",
        "outputs": [{"type": "address"}],
        "inputs": [{"name": "node", "type": "bytes32"}],
        "stateMutability": "view",
        "type": "function",
    }]
)

AGENTS = [
    "agentx01.deteragent.eth",
    "agentx02.deteragent.eth",
    "agentx03.deteragent.eth",
    # "agentx04.deteragent.eth",
]

CACHE_PATH = Path("logs") / "agent_scores.json"

def namehash(name: str) -> bytes:
    node = b'\x00' * 32
    if name:
        for label in reversed(name.split(".")):
            node = Web3.keccak(node + Web3.keccak(text=label))
    return node

def get_resolver(name: str):
    node = namehash(name)
    resolver_address = ens_registry.functions.resolver(node).call()
    if resolver_address == "0x0000000000000000000000000000000000000000":
        raise Exception(f"No resolver for {name}")
    resolver = w3.eth.contract(
        address=resolver_address,
        abi=[
            {
                "name": "addr",
                "outputs": [{"type": "address"}],
                "inputs": [{"name": "node", "type": "bytes32"}],
                "stateMutability": "view",
                "type": "function",
            },
            {
                "name": "text",
                "outputs": [{"type": "string"}],
                "inputs": [
                    {"name": "node", "type": "bytes32"},
                    {"name": "key", "type": "string"},
                ],
                "stateMutability": "view",
                "type": "function",
            },
            {
                "name": "setText",
                "inputs": [
                    {"name": "node", "type": "bytes32"},
                    {"name": "key", "type": "string"},
                    {"name": "value", "type": "string"},
                ],
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function",
            }
        ],
    )
    return resolver, node

def _load_cache() -> dict[str, dict]:
    try:
        if not CACHE_PATH.exists():
            return {}
        with CACHE_PATH.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        agents = payload.get("agents") if isinstance(payload, dict) else None
        if not isinstance(agents, list):
            return {}
        cache: dict[str, dict] = {}
        for agent in agents:
            if isinstance(agent, dict) and agent.get("name"):
                cache[str(agent["name"])] = agent
        return cache
    except Exception:
        return {}

def _save_cache(agents: list[dict]) -> None:
    try:
        existing = _load_cache()
        merged: dict[str, dict] = dict(existing)
        for agent in agents:
            if isinstance(agent, dict) and agent.get("name"):
                name = str(agent["name"])
                merged[name] = {
                    **merged.get(name, {}),
                    **agent,
                }

        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with CACHE_PATH.open("w", encoding="utf-8") as handle:
            json.dump({"updated_at": time.time(), "agents": list(merged.values())}, handle, indent=2)
    except Exception:
        pass

def _cached_agent(name: str) -> dict | None:
    cache = _load_cache()
    agent = cache.get(name)
    if not agent:
        return None
    return {
        "name": name,
        "trust_score": int(agent.get("trust_score", 0) or 0),
        "total_checks": int(agent.get("total_checks", 0) or 0),
        "agent_type": agent.get("agent_type") or "specialist",
    }

def get_agent(name: str) -> dict:
    try:
        resolver, node = get_resolver(name)
        trust_score = resolver.functions.text(node, "trust_score").call()
        total_checks = resolver.functions.text(node, "total_checks").call()
        agent_type = resolver.functions.text(node, "agent_type").call()
        return {
            "name": name,
            "trust_score": int(trust_score) if trust_score else 0,
            "total_checks": int(total_checks) if total_checks else 0,
            "agent_type": agent_type or "specialist",
        }
    except Exception as e:
        cached = _cached_agent(name)
        if cached:
            emit(f"ENS read failed for {name}; using local cache")
            return cached
        emit(f"ENS read failed for {name}: {e}")
        return {"name": name, "trust_score": 0, "total_checks": 0}

def select_best_agent() -> dict:
    emit("Reading agent trust scores from ENS")
    agents = [get_agent(a) for a in AGENTS]
    _save_cache(agents)
    agents.sort(key=lambda x: x["trust_score"], reverse=True)
    
    for a in agents:
        bar = "█" * (a["trust_score"] // 10)
        # emit(f"{a['name']} · {bar or '—'} {a['trust_score']}/100")
    
    best = agents[0]
    emit(f"Selected: {best['name']} (score: {best['trust_score']})")
    return best

def update_trust_score_and_og_proof(
    name: str,
    new_score: int,
    current_score: int,
    total_checks: int,
    proof_hash: str,
) -> bool:
    delta = abs(new_score - current_score)
    if delta < CHANGE_THRESHOLD:
        emit(f"ENS unchanged (delta {delta} < {CHANGE_THRESHOLD})")
        return False
    
    emit(f"ENS updating {name} (trust-score): {current_score} → {new_score}")
    emit(f"ENS updating {name} (0G-proof-hash): {proof_hash[0:5]}...{proof_hash[-5:]}")
    try:
        tx_hash = set_text(name, "trust_score", str(new_score))
        set_text(name, "total_checks", str(total_checks))
        if proof_hash:
            set_text(name, "0G-proof-hash", proof_hash)
        emit(f"ENS updated(txhash): {tx_hash}")
        _save_cache([
            {
                "name": name,
                "trust_score": new_score,
                "total_checks": total_checks,
                "agent_type": get_agent(name).get("agent_type", "specialist"),
            }
        ])
        return True
    except Exception as e:
        emit(f"ENS update failed: {e}")
        return False


def update_trust_score(name: str, new_score: int, current_score: int, total_checks: int) -> bool:
    return update_trust_score_and_og_proof(name, new_score, current_score, total_checks, "")

def list_agents() -> list[dict]:
    agents = [get_agent(name) for name in AGENTS]
    _save_cache(agents)
    agents.sort(key=lambda item: item.get("trust_score", 0), reverse=True)
    return agents

def set_text(name: str, key: str, value: str) -> str:
    private_key = os.getenv("OG_PRIVATE_KEY")
    account = w3.eth.account.from_key(private_key)
    resolver, node = get_resolver(name)
    tx = resolver.functions.setText(
        node, key, value
    ).build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gas": 200000,
        "gasPrice": w3.to_wei("20", "gwei"),
    })
    signed = w3.eth.account.sign_transaction(tx, private_key)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    return tx_hash.hex()

if __name__ == "__main__":
    if "--json" in sys.argv:
        print(json.dumps({"agents": list_agents()}, indent=2))
    else:
        select_best_agent()
