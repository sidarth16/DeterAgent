# agent/agent.py
import uuid
import requests
from openai import OpenAI
from agent.og_logger import log_footprint, fetch_footprints
from config import OPENAI_API_KEY

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

        print(f"   ✅ Fetched {len(text)} chars from {url[:50]}")
        return text[:4000]
    except Exception as e:
        print(f"   ❌ Failed to fetch {url}: {e}")
        return ""
    
def search_urls(task: str, max_results: int = 3) -> list[str]:
    """Agent finds its own sources."""
    with DDGS() as ddgs:
        results = list(ddgs.text(task, max_results=max_results))
    urls = [r["href"] for r in results]
    print(f"   🔎 Found {len(urls)} sources for: {task}")
    for url in urls:
        print(f"      → {url}")
    return urls


def run_agent(task: str, urls: list[str]) -> dict:
    """
    Run the agent:
    1. Fetch each URL
    2. Log every source to og_logger
    3. Generate response using OpenAI
    """
    task_id = str(uuid.uuid4())[:8]
    print(f"\n🤖 Agent starting...")
    print(f"   Task: {task}")
    print(f"   Task ID: {task_id}")

    # Step 1: Fetch and log sources
    sources = []
    print(f"\n📥 Fetching {len(urls)} sources...")
    
    # Agent finds its own URLs
    urls = search_urls(task)

    for url in urls:
        content = fetch_url(url)
        if content:
            log_footprint(task_id, url, content)
            sources.append(content)

    if not sources:
        return {
            "task_id": task_id,
            "task": task,
            "response": "No sources could be fetched.",
            "sources": []
        }

    # Step 2: Generate response
    combined = "\n\n---\n\n".join(sources)
    print(f"\n🧠 Generating response...")

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"""Answer this question using ONLY 
the sources below. Be specific. 3-5 sentences.

Question: {task}

Sources:
{combined[:6000]}"""
        }]
    )

    response = completion.choices[0].message.content
    print(f"\n📝 Agent response:\n{response}")

    return {
        "task_id": task_id,
        "task": task,
        "response": response,
        "source_count": len(sources)
    }
