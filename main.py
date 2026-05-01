# main.py
import os
import sys

from utils import ui_logger as ui

ui.install()

STATE_RUNNING = "running"
STATE_DONE = "done"
STATE_FAILED = "failed"

STEP_AGENT_SELECTION = "Agent Selection"
STEP_FETCH_URL_PROOF = "Fetch URL, Log Proof to 0G"
STEP_AGENT_RESPONSE = "Agent Response"
STEP_TRUST_ANALYSIS = "Trust Analysis"
STEP_KEEPERHUB_GATE = "KeeperHub Gate"
STEP_REPUTATION_UPDATE = "Reputation Update"

CAT_INPUT = ui.CAT_INPUT
CAT_PLAN = ui.CAT_PLAN
CAT_FETCH = ui.CAT_FETCH
CAT_REASON = ui.CAT_REASON
CAT_RISK = ui.CAT_RISK
CAT_TRUST = ui.CAT_TRUST
CAT_EXEC = ui.CAT_EXEC
CAT_PROOF = ui.CAT_PROOF
CAT_ENS = ui.CAT_ENS

STEP_READY = ui.STEP_READY
STEP_ACTIVE = ui.STEP_ACTIVE
STEP_DONE = ui.STEP_DONE

CURRENT_CATEGORY = CAT_INPUT
CURRENT_STEP = ""
CURRENT_STEP_STATE = STEP_READY
CURRENT_LINE = ""
PROCESS_STATE = STATE_RUNNING

from agent.agent import collect_sources_and_proof, generate_response
from agent.og_logger import fetch_footprints
from execution.keeper_gate import trigger_keeperhub
from handle_ens.ens_manager import AGENTS, select_best_agent, update_trust_score, list_agents

from deteragent.scrub import calculate_trust_score


def sync_logger_context() -> None:
    ui.set_context(
        category=CURRENT_CATEGORY,
        step=CURRENT_STEP,
        state=CURRENT_STEP_STATE,
        line=CURRENT_LINE,
        process_state=PROCESS_STATE,
    )


def emit(line: str, *, patch: dict | None = None) -> None:
    global CURRENT_LINE
    CURRENT_LINE = line
    sync_logger_context()
    ui.emit(line, patch=patch)


def build_trace_steps(
    task: str,
    selected_agent: dict,
    agent_result: dict,
    logged_sources: list[str],
    result: dict,
    keeper_result: dict,
    current_score: int,
    new_score: int,
    proof_hash: str,
) -> tuple[list[dict], list[str]]:
    source_count = agent_result.get("source_count", len(logged_sources))
    response_excerpt = (agent_result.get("response") or "")[:220]
    log_lines = [
        "TRACEBACK :: execution started",
        f"Task => {task}",
        f"Selected agent => {selected_agent['name']} ({current_score}/100)",
        f"Source receipts => {len(logged_sources)} bundled and logged to 0G",
        f"Trust score => {result['trust_score']}/100 ({result['verdict']})",
        f"KeeperHub => {keeper_result.get('status', 'unknown')}",
        f"ENS => {selected_agent['name']} {current_score} → {new_score}",
    ]

    phases = [
        {
            "title": "Agent Selection",
            "state": "done",
            "summary": f"{selected_agent['name']} selected via ENS reputation.",
            "logs": [
                f"Reading agent trust scores from ENS...",
                f"Selected: {selected_agent['name']} (score: {current_score})",
            ],
        },
        {
            "title": "Fetch URL, Log Proof to 0G",
            "state": "done",
            "summary": f"{source_count} sources fetched and bundled into one 0G proof.",
            "logs": [
                f"Fetching {source_count} sources...",
                "Logging one proof bundle to 0G...",
                f"0G proof => {proof_hash}",
            ] + [f"Receipt {i + 1}: {src[:140]}" for i, src in enumerate(logged_sources[:4])],
        },
        {
            "title": "Agent Response",
            "state": "done",
            "summary": "Response generated from the logged evidence.",
            "logs": [
                "Generating response...",
                response_excerpt + ("..." if len(response_excerpt) == 220 else ""),
            ],
        },
        {
            "title": "Trust Analysis",
            "state": "active",
            "summary": f"Hallucination {result['hallucination_score']}/100 · Relevance {result['relevance_score']}/100.",
            "logs": [
                "Running post-flight check...",
                f"Sentences checked: {result['total_sentences']}",
                f"Clean: {result['clean_count']}  Flagged: {result['flagged_count']}",
                f"Verdict: {result['verdict']}",
            ],
        },
        {
            "title": "Reputation Update",
            "state": "ready",
            "summary": f"ENS updated: {selected_agent['name']} {current_score} → {new_score}.",
            "logs": [
                f"Updating ENS text records...",
                f"Trust score => {current_score} → {new_score}",
            ],
        },
        {
            "title": "KeeperHub Gate",
            "state": "ready",
            "summary": f"Decision: {'EXECUTE' if result['trust_score'] >= 70 else 'HOLD'}",
            "logs": [
                f"KeeperHub workflow => {keeper_result.get('status', 'unknown')}",
                f"Threshold => 70",
            ],
        },
    ]

    return phases, log_lines

def run_traceback(task: str, urls: list[str]=[]) -> dict:
    global CURRENT_CATEGORY, CURRENT_STEP, CURRENT_STEP_STATE, CURRENT_LINE, PROCESS_STATE

    all_agents = list_agents()
    PROCESS_STATE = STATE_RUNNING
    CURRENT_CATEGORY = CAT_INPUT
    CURRENT_STEP = "Traceback"
    CURRENT_STEP_STATE = STEP_ACTIVE
    CURRENT_LINE = ""
    live_state: dict = {
        "task": task,
        "task_id": None,
        "selected_agent": None,
        "agents": all_agents,
        "trace_steps": [],
        "keeper_status": "PENDING",
        "process_state": "running",
    }

    def publish(**extra: object) -> None:
        if extra:
            live_state.update(extra)
            sync_logger_context()
            ui.push_state(patch=extra)

    emit("⚡ Traceback diary: trust layer for AI agents")

    # STEP 0 — Select best agent via ENS
    CURRENT_CATEGORY = CAT_ENS
    CURRENT_STEP = STEP_AGENT_SELECTION
    CURRENT_STEP_STATE = STEP_ACTIVE
    emit("Selecting the best agent from ENS")
    best_agent = select_best_agent()
    agent_name = best_agent["name"]
    current_score = best_agent["trust_score"]
    total_checks = best_agent["total_checks"]
    live_state["selected_agent"] = {
        "name": agent_name,
        "trust_score": current_score,
        "status": "active",
    }
    CURRENT_STEP_STATE = STEP_DONE
    publish(selected_agent=live_state["selected_agent"])

    # STEP 1: Fetch URLs and upload a single bundled proof to 0G
    CURRENT_CATEGORY = CAT_FETCH
    CURRENT_STEP = STEP_FETCH_URL_PROOF
    CURRENT_STEP_STATE = STEP_ACTIVE
    emit(f"Let’s start our agent ({agent_name})")
    proof_result = collect_sources_and_proof(task, urls)
    task_id = proof_result["task_id"]
    source_count = proof_result.get("source_count", 0)
    live_state["task_id"] = task_id
    live_state["proof_hash"] = proof_result.get("proof_hash", "local_only")
    live_state["source_count"] = source_count
    CURRENT_STEP_STATE = STEP_DONE
    publish(task_id=task_id, proof_hash=live_state["proof_hash"], source_count=source_count)

    # STEP 2: Generate the final response from the collected evidence
    CURRENT_CATEGORY = CAT_REASON
    CURRENT_STEP = STEP_AGENT_RESPONSE
    CURRENT_STEP_STATE = STEP_ACTIVE
    if proof_result.get("sources"):
        response = generate_response(task, proof_result.get("sources", []))
    else:
        response = "No sources could be fetched."
    agent_result = {
        **proof_result,
        "response": response,
    }
    live_state["response"] = response
    CURRENT_STEP_STATE = STEP_DONE
    publish(response=response)

    # STEP 2: Deteragent: Fetch logged sources 
    CURRENT_CATEGORY = CAT_FETCH
    CURRENT_STEP = STEP_FETCH_URL_PROOF
    CURRENT_STEP_STATE = STEP_ACTIVE
    emit("Gathering logged sources")
    logged_sources = fetch_footprints(task_id)
    emit(f"Found {len(logged_sources)} logged sources")
    for index, source in enumerate(logged_sources[:4], start=1):
        emit(f"Receipt {index}: {source[:140]}")
    live_state["logged_sources"] = logged_sources
    CURRENT_STEP_STATE = STEP_DONE
    publish(logged_sources=logged_sources)

    # STEP 3: Deteragent Scrub (Run post-flight trust check)
    CURRENT_CATEGORY = CAT_TRUST
    CURRENT_STEP = STEP_TRUST_ANALYSIS
    CURRENT_STEP_STATE = STEP_ACTIVE
    emit("Reviewing trust, relevance, and hallucination")
    result = calculate_trust_score(task, response, logged_sources)
    emit(f"Hallucination score: {result['grounding_score']}/100")
    emit(f"Relevance score: {result['relevance_score']}/100")
    emit(f"Trust score: {result['trust_score']}/100")
    emit(f"Verdict: {result['verdict']}")
    emit(f"Sentences checked: {result['total_sentences']}")
    emit(f"Clean: {result['clean_count']}")
    emit(f"Flagged: {result['flagged_count']}")
    for sentence_result in result["sentence_results"]:
        icon = "✅" if sentence_result["status"] == "CLEAN" else "🚨"
        emit(f"{icon} {sentence_result['sentence'][:80]}")
        if sentence_result["flag_reason"]:
            emit(f"↳ {sentence_result['flag_reason']}")
    CURRENT_STEP_STATE = STEP_DONE
    publish(**result)

    # STEP 5 — KeeperHub
    CURRENT_CATEGORY = CAT_EXEC
    CURRENT_STEP = STEP_KEEPERHUB_GATE
    CURRENT_STEP_STATE = STEP_ACTIVE
    emit("Passing through KeeperHub")
    keeper_result = trigger_keeperhub(result["trust_score"])
    keeper_success = bool(keeper_result.get("success") or keeper_result.get("status") == "success")
    keeper_status = keeper_result.get("status")
    keeper_tx_hash = keeper_result.get("tx_hash") or keeper_result.get("transactionHash") or keeper_result.get("transaction_hash")
    
    if keeper_success:
        emit("KeeperHub Workflow: Executed successfully")
    else:
        emit("KeeperHub Workflow: Failed")

    if keeper_tx_hash:
        emit(f"KeeperHub tx hash: {keeper_tx_hash}")

    live_state["keeper_status"] = "EXECUTED" if keeper_success else "FAILED"
    live_state["keeper"] = {
        "status": live_state["keeper_status"],
        "workflow_result": {
            **keeper_result,
            "tx_hash": keeper_tx_hash,
        },
    }
    CURRENT_STEP_STATE = STEP_DONE
    publish(keeper=live_state["keeper"], keeper_status=live_state["keeper_status"], keeper_success=keeper_success)

    # STEP 6 — Update ENS if score changed significantly
    CURRENT_CATEGORY = CAT_ENS
    CURRENT_STEP = STEP_REPUTATION_UPDATE
    CURRENT_STEP_STATE = STEP_ACTIVE
    emit(f"Updating ENS reputation for {agent_name}")
    new_checks = total_checks + 1
    new_score = round((current_score * total_checks + result["trust_score"]) / new_checks)
    emit(f"Trust score: {current_score} → {new_score}")
    update_trust_score(agent_name, new_score, current_score, new_checks)

    phases, log_lines = build_trace_steps(
        task=task,
        selected_agent=best_agent,
        agent_result=agent_result,
        logged_sources=logged_sources,
        result=result,
        keeper_result=keeper_result,
        current_score=current_score,
        new_score=new_score,
        proof_hash=live_state["proof_hash"],
    )

    dashboard_payload = {
        **live_state,
        **result,
        "task": task,
        "task_id": task_id,
        "selected_agent": {
            "name": agent_name,
            "trust_score": current_score,
            "status": "active",
        },
        "trust_delta": result["trust_score"] - current_score,
        "keeper_status": live_state["keeper_status"],
        "keeper_success": keeper_success,
        "ens_before": current_score,
        "ens_after": new_score,
        "proof_hash": live_state["proof_hash"],
        "agents": [
            {
                **agent,
                "selected": agent["name"] == agent_name,
                "last_updated": "just now" if agent["name"] == agent_name else "recently",
                "proof_ref": f"0G root · {live_state['proof_hash'][:14]}",
            }
            for agent in all_agents
        ],
        "trace_steps": phases,
        "process_state": "done",
        "current_category": CURRENT_CATEGORY,
        "current_step": CURRENT_STEP,
        "current_step_state": STEP_DONE,
        "current_line": CURRENT_LINE,
    }
    PROCESS_STATE = STATE_DONE
    CURRENT_STEP_STATE = STEP_DONE
    sync_logger_context()
    ui.push_state(patch=dashboard_payload)

    return {
        **result,
        "task_id": task_id,
        "response": response,
        "keeper": {
            "status": live_state["keeper_status"],
            "workflow_result": {
                **keeper_result,
                "tx_hash": keeper_tx_hash,
            },
        },
    }


if __name__ == "__main__":
    cli_task = os.getenv("TASK") or (sys.argv[1] if len(sys.argv) > 1 else None)
    # TEST RUN
    final = run_traceback(
        task=cli_task or "When was Uniswap launched and who created it?"
        # task="What is the current ETH gas price?"
        # task="What are the latest Ethereum upgrades in 2026?"
        # task="What is Vitalik Buterin's current net worth and his latest project in 2026?"

        # urls=[
        #     "https://en.wikipedia.org/wiki/Uniswap",
        #     "https://uniswap.org/blog/uniswap-history"
        # ]
    )


    # CURRENT_CATEGORY = CAT_EXEC
    # CURRENT_STEP = STEP_KEEPERHUB_GATE
    # CURRENT_STEP_STATE = STEP_DONE
    # CURRENT_LINE = "KeeperHub execution complete"
    # PROCESS_STATE = STATE_DONE
    # sync_logger_context()
    # ui.push_state(
    #     patch={
    #         "final": final,
    #         "current_category": CURRENT_CATEGORY,
    #         "current_step": CURRENT_STEP,
    #         "current_step_state": CURRENT_STEP_STATE,
    #         "process_state": PROCESS_STATE,
    #     }
    # )
