# deteragent/scrub.py
import json
import os
from openai import OpenAI
from utils.ui_logger import emit
from dotenv import load_dotenv
load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

emit("Loading...  Deter.Agent...")


SYSTEM_PROMPT = """You are a verification agent.
Your ONLY job is to check if an agent's response is grounded in its logged sources.

Rules:
- Grounded = the claim is supported by or present in the sources
- Ungrounded = the claim is not in any source (agent assumed or invented it)
- Relevant = the sentence helps answer the original task
- Answer = the agent's yes/no conclusion to the task (if applicable)

Scoring rules (be granular, avoid 0 and 100 unless extreme):

GROUNDING (0-100):
- Every claim explicitly in sources → 90-100
- Most claims in sources, minor gaps → 60-80
- Some grounded, key facts missing → 30-55
- Claims contradict sources → 0-20

RELEVANCE (0-100):
- Directly answers task precisely → 85-100
- Answers but vague/incomplete → 50-75
- Partially related → 20-45

TRUST SCORE = (grounding * 0.6) + (relevance * 0.4)
DO NOT set trust_score independently. Always compute it.

Be strict about grounding. If a number or fact is not explicitly in the sources, mark it ungrounded.
Return ONLY valid JSON. No markdown. No explanation outside the JSON.

IMPORTANT — Handling "I don't know" responses:

CASE 1: Agent says it doesn't know BUT the answer IS present in sources
- This is a failure — agent ignored available evidence
- Grounding score = 20
- Relevance score = 40  
- Trust score = 28
- Verdict = "DO NOT TRUST"
- Flag reason = "agent ignored available source data"

CASE 2: Agent says it doesn't know AND answer is genuinely absent from sources
- This is honest uncertainty, not hallucination
- Grounding score = 70
- Relevance score = 60
- Trust score = 66
- Verdict = "VERIFY"
- Flag reason = null

To determine which case: search the logged sources carefully.
If the answer can be derived or found in sources → CASE 1
If sources genuinely lack the information → CASE 2
"""


def calculate_trust_score(
    task: str,
    response: str,
    logged_sources: list[str]
) -> dict:

    sources_text = "\n\n---\n\n".join(logged_sources[:3])

    prompt = f"""Task: {task}

Agent Response: {response}

Logged Sources (what the agent actually read):
{sources_text[:4000]}

Analyze and return ONLY this JSON:
{{
  "grounding_score": <0-100>,
  "relevance_score": <0-100>,
  "trust_score": <0-100>,
  "answer": <"YES" | "NO" | "UNCLEAR">,
  "verdict": <"TRUST" | "VERIFY" | "DO NOT TRUST">,
  "reasoning": "<one sentence>",
  "ungrounded_claims": ["<claim1>", "<claim2>"],
  "sentence_results": [
    {{
      "sentence": "<sentence>",
      "grounded": <true|false>,
      "relevant": <true|false>,
      "status": <"CLEAN" | "FLAGGED">,
      "flag_reason": <null | "ungrounded claim" | "not relevant to task">
    }}
  ]
}}"""

    # print(f"\n🔍 scrubbing agents's response...")

    result = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        temperature=0
    )

    text = result.choices[0].message.content.strip()
    text = text.replace("```json", "").replace("```", "").strip()

    data = json.loads(text)

    # Normalize verdict
    score = data.get("trust_score", 0)
    if score >= 80:
        data["verdict"] = "TRUST"
    elif score >= 50:
        data["verdict"] = "VERIFY"
    else:
        data["verdict"] = "DO NOT TRUST"

    # Add counts
    sentences = data.get("sentence_results", [])
    data["total_sentences"] = len(sentences)
    data["clean_count"] = sum(1 for s in sentences if s.get("status") == "CLEAN")
    data["flagged_count"] = data["total_sentences"] - data["clean_count"]

    # Keep backward compat
    data["hallucination_score"] = data.get("grounding_score", 0)

    print(f"   Grounding  : {data.get('grounding_score')}/100")
    print(f"   Relevance  : {data.get('relevance_score')}/100")
    print(f"   Trust Score: {data.get('trust_score')}/100")
    print(f"   Answer     : {data.get('answer')}")
    print(f"   Verdict    : {data.get('verdict')}")


    # return {
    #     "trust_score": trust_score,
    #     "hallucination_score": hallucination_score,
    #     "relevance_score": relevance_score,
    #     "verdict": verdict,
    #     "total_sentences": total,
    #     "clean_count": clean_count,
    #     "flagged_count": total - clean_count,
    #     "sentence_results": results
    # }
    return data
