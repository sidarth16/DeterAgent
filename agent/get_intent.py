import re
from typing import Optional, Dict, Any

def parse_user_intent(text: str) -> Optional[Dict[str, Any]]:
    text_original = text
    text = text.lower()

    # -------------------------
    # ACTION detection
    # -------------------------
    action_match = re.search(r"\b(swap|buy|stake)\b", text)

    if not action_match:
        return {
            "action": None,
            "tokenA": None,
            "tokenB": None,
            "amount": None,
            "condition": text_original,
        }

    action = action_match.group(1)

    amount = None
    token_a = None
    token_b = None

    # -------------------------
    # SWAP
    # -------------------------
    if action == "swap":
        match = re.search(
            r"swap\s+(\d+(\.\d+)?)\s+([a-zA-Z]+)\s+to\s+([a-zA-Z]+)",
            text,
        )
        if match:
            amount = float(match.group(1))
            token_a = match.group(3).upper()
            token_b = match.group(4).upper()

    # -------------------------
    # BUY
    # -------------------------
    elif action == "buy":
        match = re.search(
            r"buy\s+(\d+(\.\d+)?)\s+([a-zA-Z]+)",
            text,
        )
        if match:
            amount = float(match.group(1))
            token_a = match.group(3).upper()

    # -------------------------
    # STAKE
    # -------------------------
    elif action == "stake":
        match = re.search(
            r"stake\s+(\d+(\.\d+)?)\s+([a-zA-Z]+)",
            text,
        )
        if match:
            amount = float(match.group(1))
            token_a = match.group(3).upper()

    # -------------------------
    # CONDITION extraction
    # -------------------------
    condition_match = re.search(r"\bif\b(.+)", text)

    condition = None
    if condition_match:
        condition = condition_match.group(1).strip()
        condition = re.sub(r"[.]+$", "", condition).strip()

    return {
        "action": action,
        "tokenA": token_a,
        "tokenB": token_b,
        "amount": int(amount),
        "condition": condition,
    }

if __name__ == "__main__":
    query = "buy 500 weth, if eth is less than 5000$ yesterday"

    result = parse_user_intent(query)
    print(result)