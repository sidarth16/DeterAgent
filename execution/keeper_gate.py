import requests, os, time
from dotenv import load_dotenv
from utils.ui_logger import emit
load_dotenv()

KEEPERHUB_WEBHOOK = os.getenv("KEEPERHUB_WEBHOOK")
wfb_api_key = os.getenv("KEEPERHUB_WFB_API_KEY")
kh_api_key = os.getenv("KEEPERHUB_KH_API_KEY")

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

def trigger_keeperhub(trust_score: int, agent: str = "deteragent") -> dict:
    payload = {
        "trust_score": trust_score,
        "threshold": 70,
        "agent": agent,
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

        tx_hash = (
            final_status_data.get("transactionHash")
            or final_status_data.get("transaction_hash")
            or final_status_data.get("tx_hash")
            or data.get("transactionHash")
            or data.get("transaction_hash")
            or data.get("tx_hash")
        )
        if tx_hash:
            emit(f"KeeperHub tx hash pinned: {tx_hash}")

        normalized = _normalize_response({**data, **final_status_data})
        normalized["status"] = status
        normalized["success"] = status == "success"
        if tx_hash:
            normalized["tx_hash"] = tx_hash
        normalized["executionId"] = execution_id
        return normalized
    except Exception as e:
        emit(f"KeeperHub error: {e}")
        return {"status": "error", "success": False}



# if __name__ == "__main__":
#     import time

#     payload = {
#         "trust_score": 35,
#         "threshold": 70,
#         "agent": "deteragent",
#     }

#     url = os.getenv("KEEPERHUB_WEBHOOK")
#     wfb_api_key = os.getenv("KEEPERHUB_WFB_API_KEY")
#     kh_api_key = os.getenv("KEEPERHUB_KH_API_KEY")


#     headers_webhook = {
#         "Authorization": f"Bearer {wfb_api_key}",
#         "Content-Type": "application/json"
#     }

#     headers_api = {
#         "Authorization": f"Bearer {kh_api_key}",
#         "Content-Type": "application/json"
#     }

#     print("Triggering KeeperHub")
    
#     try:
#         r = requests.post(url, json=payload, headers=headers_webhook, timeout=15)
#         data = r.json()
#         execution_id = data.get("executionId")
#         print('started exectionID : ', execution_id)
#         if not execution_id:
#             print("KeeperHub failed to start workflow")
#             print( {"status": "error", "success": False, "raw": data})

#         status_url = f"https://app.keeperhub.com/api/workflows/executions/{execution_id}/status"

#         while True:
#             status_res = requests.get(status_url, headers=headers_api, timeout=10)
#             status_data = status_res.json()

#             status = status_data.get("status")
#             print(f"KeeperHub status: {status}")

#             if status in ["success", "error", "cancelled"]:
#                 break

#             time.sleep(2)

#         if status == "success":
#             print("KeeperHub Workflow: Executed")
#         else:
#             print("KeeperHub Workflow: Failed")

#         tx_hash = data.get("tx_hash")
#         if tx_hash:
#             print(f"KeeperHub tx hash pinned: {tx_hash}")

#         # print( data)
#     except Exception as e:
#         print(f"KeeperHub error: {e}")
#         print( {"status": "error", "success": False})
