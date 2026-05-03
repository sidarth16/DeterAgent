# agent/agent.py
import uuid
import requests
from openai import OpenAI
import time

from agent.og_logger import build_proof_bundle, log_footprint, upload_proof_bundle
from config import OPENAI_API_KEY
from utils.ui_logger import emit

import trafilatura
from ddgs import DDGS


client = OpenAI(api_key=OPENAI_API_KEY)

def fetch_url(url: str) -> str:
    """Fetch text content from a URL."""
    try:
        text = ""

        if trafilatura is not None:
            downloaded = trafilatura.fetch_url(url)
            if downloaded:
                extracted = trafilatura.extract(downloaded)
                if extracted:
                    text = extracted.strip()

        if not text:
            r = requests.get(url, timeout=10,
                            headers={"User-Agent": "Mozilla/5.0"})
            # Strip HTML tags
            import re
            text = re.sub(r'<[^>]+>', ' ', r.text)
            text = re.sub(r'\s+', ' ', text).strip()

        # emit(f"Read {len(text)} chars from {url[:50]}")
        return text[:4000]
    except Exception as e:
        # emit(f"Failed to read {url}: {e}")
        emit(f"Failed to read {url}")

        return ""
    
def search_urls(task: str, max_results: int = 3) -> list[str]:
    """Agent finds its own sources."""
    with DDGS() as ddgs:
        results = list(ddgs.text(task, max_results=max_results))
    urls = [r["href"] for r in results]
    # emit(f"Found {len(urls)} sources for: {task}")
    emit(f"Fetching from {len(urls)} sources...")
    # for url in urls:
    #     # emit(f"Source picked: {url}")
    #     emit(f" {url}")

    return urls


def collect_sources_and_proof(task: str, urls: list[str] | None = None) -> dict:
    """
    Collect sources and upload one proof bundle:
    1. Fetch each URL
    2. Build a single proof bundle from all sources
    3. Upload the proof bundle to 0G Storage
    """
    task_id = str(uuid.uuid4())[:8]
    # emit("Agent initialized for condition verification")
    emit(f"Checking: {task}")
    emit(f"Task ID pinned: {task_id}")

    # Agent finds its own URLs
    urls = urls or search_urls(task)
    # emit(f"Fetching {len(urls)} sources...")
    # emit(f"Fetching from {len(urls)} sources...")
    # emit(urls)

    sources = []
    for url in urls:
        content = fetch_url(url)
        if content:
            emit(f"✅ {url}")
            log_footprint(task_id, url, content)
            sources.append({
                "url": url,
                "content": content,
                "fetched_at": time.time(),
            })

    if not sources:
        return {
            "task_id": task_id,
            "task": task,
            "urls": urls,
            "sources": [],
            "proof_hash": "local_only",
            "source_count": 0,
        }



    proof_bundle = build_proof_bundle(task_id, task, sources)
    emit(f"Logging proof bundle to 0G with {proof_bundle['source_count']} sources...")
    proof_hash = upload_proof_bundle(proof_bundle)

    return {
        "task_id": task_id,
        "task": task,
        "urls": urls,
        "sources": sources,
        "source_count": len(sources),
        "proof_hash": proof_hash,
        "proof_bundle": proof_bundle,
    }

def generate_response(task: str, sources: list[dict]) -> str:
    combined = "\n\n---\n\n".join(source["content"] for source in sources)
    emit("Generating response from sources ...")

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.4,
        messages=[
            {
                "role": "system",
                "content": """You are a grounded AI agent.

Your job is to answer questions using the provided sources.

RULES:
- Use the sources as your primary evidence
- You MAY make simple, safe inferences (e.g., comparing numbers)
- DO NOT introduce new facts, numbers, or dates not present in sources
- Avoid time-based assumptions like "yesterday" or "today" unless explicitly stated
- If information is unclear, answer cautiously instead of guessing

STYLE:
- 1–3 sentences
- Clear, concise, and confident
- No fluff, no speculation
"""
            },
            {
                "role": "user",
                "content": f"""Question: {task}

Sources:
{combined[:6000]}"""
            }
        ]
    )

    response = completion.choices[0].message.content.strip()

    if not response:
        response = "Based on the provided sources, I cannot determine this clearly."

    emit(f"Agent response: {response}")
    return response


def run_agent(task: str, urls: list[str]) -> dict:
    proof_result = collect_sources_and_proof(task, urls)
    if not proof_result.get("sources"):
        return {
            "task_id": proof_result["task_id"],
            "task": task,
            "response": "No sources could be fetched.",
            "sources": [],
            "source_count": 0,
            "proof_hash": proof_result.get("proof_hash", "local_only"),
        }

    response = generate_response(task, proof_result["sources"])
    return {
        **proof_result,
        "response": response,
    }
