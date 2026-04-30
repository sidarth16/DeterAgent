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

Be strict about grounding. If a number or fact is not explicitly in the sources, mark it ungrounded.
Return ONLY valid JSON. No markdown. No explanation outside the JSON."""


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
