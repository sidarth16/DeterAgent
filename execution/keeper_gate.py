import requests, os, time
from dotenv import load_dotenv
from utils.ui_logger import emit
load_dotenv()

KEEPERHUB_WEBHOOK = os.getenv("KEEPERHUB_WEBHOOK")
wfb_api_key = os.getenv("KEEPERHUB_WFB_API_KEY")
kh_api_key = os.getenv("KEEPERHUB_KH_API_KEY")

tokens = {
    "USDC" : "0x065F27e8652c2222272955fcEe1b381d36024b3B",
    "WETH" : "0xAe5939d77EED36445AEA2f067BD57eF069495aE3",
    "USDT" : "0x6A51D957b57428a9E6ec09B7fCe96d713F1dD2F8"
}

def _normalize_response(data: dict) -> dict:
    success = bool(data.get("success"))
    tx_hash = data.get("tx_hash") or data.get("transactionHash") or data.get("transaction_hash")

    normalized = {
        **data,
        "success": success,
    }
    if tx_hash:
        normalized["tx_hash"] = tx_hash
    return normalized


# def _extract_tx_fields(payload: dict | None) -> tuple[str | None, str | None]:
#     if not isinstance(payload, dict):
#         return None, None

#     candidates = [
#         payload,
#         payload.get("execution") if isinstance(payload.get("execution"), dict) else {},
#         payload.get("output") if isinstance(payload.get("output"), dict) else {},
#         (payload.get("execution") or {}).get("output") if isinstance(payload.get("execution"), dict) else {},
#     ]

#     for candidate in candidates:
#         if not isinstance(candidate, dict):
#             continue

#         tx_hash = (
#             candidate.get("transactionHash")
#             or candidate.get("transaction_hash")
#             or candidate.get("txHash")
#             or candidate.get("tx_hash")
#         )
#         tx_link = (
#             candidate.get("transactionLink")
#             or candidate.get("transaction_link")
#             or candidate.get("txLink")
#             or candidate.get("tx_link")
#         )

#         if tx_hash or tx_link:
#             return tx_hash, tx_link

#     return None, None

def _extract_tx_fields(payload: dict | None) -> tuple[str | None, str | None]:
    if not isinstance(payload, dict):
        return None, None

    def extract_from_obj(obj: dict):
        if not isinstance(obj, dict):
            return None, None

        tx_hash = (
            obj.get("transactionHash")
            or obj.get("transaction_hash")
            or obj.get("txHash")
            or obj.get("tx_hash")
        )
        tx_link = (
            obj.get("transactionLink")
            or obj.get("transaction_link")
            or obj.get("txLink")
            or obj.get("tx_link")
        )

        return tx_hash, tx_link

    logs = payload.get("logs")
    if isinstance(logs, list):
        # reverse → latest execution first
        for log in reversed(logs):
            if not isinstance(log, dict):
                continue

            # optional: restrict to contract writes
            if log.get("nodeType") != "web3/write-contract":
                continue

            tx_hash, tx_link = extract_from_obj(log.get("output", {}))
            if tx_hash or tx_link:
                return tx_hash, tx_link

    candidates = [
        payload,
        payload.get("execution") if isinstance(payload.get("execution"), dict) else {},
        payload.get("output") if isinstance(payload.get("output"), dict) else {},
        (payload.get("execution") or {}).get("output") if isinstance(payload.get("execution"), dict) else {},
    ]

    for candidate in candidates:
        tx_hash, tx_link = extract_from_obj(candidate)
        if tx_hash or tx_link:
            return tx_hash, tx_link

    return None, None

def trigger_keeperhub(trust_score: int, taskId: str, intent:dict, agent: str = "deteragent") -> dict:
    payload = {
        "taskId" : '#'+taskId,
        "trust_score": trust_score,
        "threshold": 70,
        "agent": agent,
        "action": intent.get("action","swap"),
        "tokenA": tokens.get(intent.get("tokenA")),
        "tokenAname": intent.get("tokenA"),
        "tokenB": tokens.get(intent.get("tokenB")),
        "tokenBname": intent.get("tokenB"),
        "amount": intent.get("amount")
    }

    headers_webhook = {
        "Authorization": f"Bearer {wfb_api_key}",
        "Content-Type": "application/json"
    }

    headers_api = {
        "Authorization": f"Bearer {kh_api_key}",
        "Content-Type": "application/json"
    }

    emit("Triggering KeeperHub")
    
    try:
        r = requests.post(KEEPERHUB_WEBHOOK, json=payload, headers=headers_webhook, timeout=15)
        data = r.json()
        execution_id = data.get("executionId")
        emit(f"KeeperHub started: {execution_id}" if execution_id else "KeeperHub failed to start workflow")

        if not execution_id:
            return {"status": "error", "success": False, "raw": data}

        status_url = f"https://app.keeperhub.com/api/workflows/executions/{execution_id}/status"
        final_status_data: dict = {}

        while True:
            status_res = requests.get(status_url, headers=headers_api, timeout=10)
            status_data = status_res.json()
            final_status_data = status_data

            status = status_data.get("status")
            emit(f"KeeperHub status: {status}")

            if status in ["success", "error", "cancelled"]:
                break

            time.sleep(2)

        if status == "success":
            emit("KeeperHub Workflow: Executed")
        else:
            emit("KeeperHub Workflow: Failed")

        time.sleep(2)

        logs_url = f"https://app.keeperhub.com/api/workflows/executions/{execution_id}/logs"
        tx_hash = None
        tx_link = None
        emit("Extracting TxHash ...")

        for _ in range(15):
            logs_res = requests.get(logs_url, headers=headers_api, timeout=10).json()
            tx_hash, tx_link = _extract_tx_fields(logs_res)

            if tx_hash or tx_link:
                break

            time.sleep(2)

        # logs_res = requests.get(logs_url, headers=headers_api, timeout=10)
        # logs_res = logs_res.json()
        # print(logs_res.json())

        # execution_output_logs = logs_res.get("execution").get("output")
        # tx_hash = execution_output_logs.get("transactionHash")
        # tx_link = execution_output_logs.get("transactionLink")

        if tx_hash:
            emit(f"KeeperHub tx hash pinned: {tx_hash}")
        else:
            emit(f"Failed to retrieve TxHash; logs keys: {list((logs_res or {}).keys()) if isinstance(logs_res, dict) else 'non-dict response'}")
        if tx_link:
            emit(f"Etherscan Link : {tx_link}")
        data = {"status": status, "executionId":execution_id, "tx_hash":tx_hash, "tx_link":tx_link}

        normalized = _normalize_response({**data})
        normalized["status"] = status
        normalized["success"] = status == "success"
        if tx_hash:
            normalized["tx_hash"] = tx_hash
        normalized["executionId"] = execution_id
        return normalized
    except Exception as e:
        emit(f"KeeperHub error: {e}")
        return {"status": "error", "success": False}



if __name__ == "__main__":
    import time

    payload = {
         "taskId" : "#12334",
        "trust_score": 80,
        "threshold": 70,
        "agent": "agentx0.eth",
        "action": "swap",
        "tokenA": tokens.get("WETH"),
        "tokenB": tokens.get("USDC"),
        "amount": 1000
    }

    url = os.getenv("KEEPERHUB_WEBHOOK")
    wfb_api_key = os.getenv("KEEPERHUB_WFB_API_KEY")
    kh_api_key = os.getenv("KEEPERHUB_KH_API_KEY")

    headers_webhook = {
        "Authorization": f"Bearer {wfb_api_key}",
        "Content-Type": "application/json"
    }

    headers_api = {
        "Authorization": f"Bearer {kh_api_key}",
        "Content-Type": "application/json"
    }

    print("Triggering KeeperHub")
    
    try:
        r = requests.post(url, json=payload, headers=headers_webhook, timeout=15)
        data = r.json()
        execution_id = data.get("executionId")
        print('started exectionID : ', execution_id)
        if not execution_id:
            print("KeeperHub failed to start workflow")
            print( {"status": "error", "success": False, "raw": data})

        # execution_id = "6bc48jhtb209joomxn9fq"

        status_url = f"https://app.keeperhub.com/api/workflows/executions/{execution_id}/status"

        while True:
            status_res = requests.get(status_url, headers=headers_api, timeout=10)
            status_data = status_res.json()
            final_status_data = status_data

            status = status_data.get("status")
            print(f"KeeperHub status: {status}")

            if status in ["success", "error", "cancelled"]:
                break

            time.sleep(2)

        if status == "success":
            print("KeeperHub Workflow: Executed")
        else:
            print("KeeperHub Workflow: Failed")
        

        logs_url = f"https://app.keeperhub.com/api/workflows/executions/{execution_id}/logs"
        for _ in range(15):
            logs_res = requests.get(logs_url, headers=headers_api, timeout=10).json()
            tx_hash, tx_link = _extract_tx_fields(logs_res)

            if tx_hash or tx_link:
                break

            time.sleep(2)

        
        # logs_res = requests.get(logs_url, headers=headers_api, timeout=10)
        # logs_res = logs_res.json()

        # execution_output_logs = logs_res.get("execution").get("output")
        # tx_hash = execution_output_logs.get("transactionHash")
        # tx_link = execution_output_logs.get("transactionLink")

        if tx_hash:
            print(f"KeeperHub tx hash pinned: {tx_hash}")
        else:
            print(f"Failed to retrieve TxHash; logs keys: {list((logs_res or {}).keys()) if isinstance(logs_res, dict) else 'non-dict response'}")
        if tx_link:
            print(f"Etherscan Link : {tx_link}")
        data = {"status": status, "executionId":execution_id, "tx_hash":tx_hash, "tx_link":tx_link}

        normalized = _normalize_response({**data})
        normalized["status"] = status
        normalized["success"] = status == "success"
        if tx_hash:
            normalized["tx_hash"] = tx_hash
        normalized["executionId"] = execution_id
        print( normalized)
    except Exception as e:
        print(f"KeeperHub error: {e}")
        print( {"status": "error", "success": False})
