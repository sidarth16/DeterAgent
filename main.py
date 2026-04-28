# main.py
from agent.agent import run_agent
from agent.og_logger import fetch_footprints
from deteragent.scrub import calculate_trust_score

def run_traceback(task: str, urls: list[str]=[]) -> dict:

    print("\n" + "="*60)
    print("⚡ TRACEBACK — TRUST LAYER FOR AI AGENTS")
    print("="*60)

    # STEP 1: Run agent (fetches URLs, logs footprints)
    agent_result = run_agent(task, urls)
    task_id = agent_result["task_id"]
    response = agent_result["response"]

    # STEP 2: Fetch logged sources
    print(f"\n📂 Fetching logged sources...")
    logged_sources = fetch_footprints(task_id)
    print(f"   Found {len(logged_sources)} logged sources")

    # STEP 3: Run post-flight trust check
    print(f"\n🔍 Running post-flight check...")
    result = calculate_trust_score(task, response, logged_sources)

    # STEP 4: Print report
    print("\n" + "="*60)
    print("📊 TRACEBACK REPORT")
    print("="*60)
    print(f"Task:     {task}")
    print(f"{'─'*60}")
    print(f"Hallucination Score : {result['hallucination_score']}/100")
    print(f"Relevance Score     : {result['relevance_score']}/100")
    print(f"TRUST SCORE         : {result['trust_score']}/100")
    print(f"VERDICT             : {result['verdict']}")
    print(f"{'─'*60}")
    print(f"Sentences checked   : {result['total_sentences']}")
    print(f"Clean               : {result['clean_count']}")
    print(f"Flagged             : {result['flagged_count']}")
    print(f"\nSentence breakdown:")

    for r in result["sentence_results"]:
        icon = "✅" if r["status"] == "CLEAN" else "🚨"
        print(f"  {icon} {r['sentence'][:80]}")
        if r["flag_reason"]:
            print(f"      ↳ {r['flag_reason']}")

    print("="*60)

    return {**result, "task_id": task_id, "response": response}


if __name__ == "__main__":
    # TEST RUN
    run_traceback(
        task="When was Uniswap launched and who created it?"
        # task="What is the current ETH gas price?"
        # task="What are the latest Ethereum upgrades in 2026?"
        # task="What is Vitalik Buterin's current net worth and his latest project in 2026?"

        # urls=[
        #     "https://en.wikipedia.org/wiki/Uniswap",
        #     "https://uniswap.org/blog/uniswap-history"
        # ]
    )

    
