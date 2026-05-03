# deteragent/scrub.py
import re
from transformers import pipeline
from utils.ui_logger import emit

emit("Loading the trust checker...")
nli = pipeline(
    "text-classification",
    model="cross-encoder/nli-deberta-v3-small",
    device=-1  # CPU. Change to 0 if you have GPU
)
emit("Trust checker ready.")

STOPWORDS = {
    "the","a","an","is","are","was","were","it","in","on","at","to",
    "for","of","and","or","but","with","this","that","these","those",
    "its","their","our","has","have","had","be","been","being","will",
    "would","could","should","may","might","can","do","does","did",
    "not","no","so","if","as","by","from","into","about","than","then",
    "when","where","which","who","what","how","also","just","only"
}

GROUNDING_THRESHOLD = 0.25
RELEVANCE_THRESHOLD = 0.35

def extract_sentences(response: str) -> list[str]:
    sentences = re.split(r'(?<=[.!?])\s+', response.strip())
    return [s.strip() for s in sentences
            if len(s.split()) > 4 and len(s) > 20]

def chunk_source(source: str, size: int = 60) -> list[str]:
    """Break source into smaller overlapping chunks for better matching."""
    words = source.split()
    chunks = []
    for i in range(0, len(words), max(size - 30, 1)):
        chunk = " ".join(words[i:i+size])
        if chunk:
            chunks.append(chunk)
    return chunks

def source_sentences(source: str) -> list[str]:
    """Split source into sentence-sized evidence units."""
    parts = re.split(r'(?<=[.!?])\s+', source.strip())
    return [part.strip() for part in parts if len(part.split()) > 3 and len(part) > 15]

def evidence_candidates(source: str) -> list[str]:
    """
    Build a ranked list of candidate evidence snippets.
    Sentence-sized snippets are checked first, then smaller chunks.
    """
    candidates = []
    candidates.extend(source_sentences(source))
    candidates.extend(chunk_source(source))

    seen = set()
    ordered = []
    for candidate in candidates:
        # print(f"      checking chunk: {candidate[:120]}...")
        key = candidate[:500]
        if key not in seen:
            seen.add(key)
            ordered.append(candidate)
    return ordered

def _truncate(text, max_chars=500):
    return text[:max_chars]

def _nli_scores(premise: str, hypothesis: str) -> dict[str, float]:
    outputs = nli(
        {
            "text": _truncate(premise, 500),
            "text_pair": _truncate(hypothesis, 200)
        },
        top_k=3   
    )

    # print(f"      raw NLI output: {outputs}")

    scores = {
        "entailment": 0.0,
        "neutral": 0.0,
        "contradiction": 0.0
    }

    for item in outputs:
        label = item["label"].lower()

        if "entail" in label:
            scores["entailment"] = item["score"]
        elif "neutral" in label:
            scores["neutral"] = item["score"]
        elif "contradiction" in label:
            scores["contradiction"] = item["score"]

    return scores

def keyword_filter(sentence: str, candidates: list[str]) -> list[str]:
    keywords = [
        w.lower() for w in sentence.split()
        if w.lower() not in STOPWORDS and len(w) > 3
    ]

    filtered = []
    for c in candidates:
        text = c.lower()
        if any(k in text for k in keywords):
            filtered.append(c)

    return filtered if filtered else candidates[:10]



def is_grounded(sentence: str, sources: list[str]) -> bool:
    """
    Check if sentence is entailed by ANY chunk in sources.
    Uses NLI — understands meaning, not just keywords.
    """
    best_score = 0.0
    best_chunk = ""

    for source in sources:
        candidates = evidence_candidates(source)
        candidates = keyword_filter(sentence, candidates)
        for candidate in candidates[:50]:  # keep NLI calls bounded
            try:
                scores = _nli_scores(candidate, sentence)
                entailment_score = scores["entailment"]
                # print(f"      parsed entailment score: {entailment_score:.4f}")

                if entailment_score > best_score:
                    best_score = entailment_score
                    best_chunk = candidate

                if best_score >= GROUNDING_THRESHOLD:
                    return True  # found strong match — stop early
            except:
                continue

    # print(f"      best entailment score: {best_score:.4f}")
    # if best_chunk:
        # print(f"      best grounding chunk: {best_chunk[:120]}...")
    return best_score >= GROUNDING_THRESHOLD

def is_relevant(sentence: str, task: str) -> bool:
    """
    Check if sentence actually helps answer the task.
    Uses NLI — task entails sentence = relevant.
    """
    try:
        # quick keyword filter
        sentence_words = set(sentence.lower().split())
        task_words = set(task.lower().split())

        overlap = len(sentence_words & task_words)
        # print(f"      keyword overlap: {overlap}")

        # More lenient: 1 keyword overlap is enough
        if overlap >= 1:
            return True

        scores = _nli_scores(sentence, task)
        entailment_score = scores["entailment"]
        # print(f"      relevance entailment score: {entailment_score:.4f}")
        return entailment_score >= RELEVANCE_THRESHOLD

    except Exception as e:
        emit(f"Relevance check slipped: {e}")
        return True # benefit of doubt

def calculate_trust_score(
    task: str,
    response: str,
    logged_sources: list[str]
) -> dict:

    sentences = extract_sentences(response)

    if not sentences:
        return {
            "trust_score": 0,
            "hallucination_score": 0,
            "relevance_score": 0,
            "verdict": "NO CONTENT",
            "sentence_results": []
        }

    results = []
    for sentence in sentences:
        emit(f"Checking: {sentence[:60]}...")
        grounded = is_grounded(sentence, logged_sources)
        relevant = is_relevant(sentence, task)

        results.append({
            "sentence": sentence,
            "grounded": grounded,
            "relevant": relevant,
            "status": "CLEAN" if (grounded and relevant) else "FLAGGED",
            "flag_reason": (
                None if (grounded and relevant) else
                "not grounded in sources" if (not grounded and relevant) else
                "not relevant to task" if (grounded and not relevant) else
                "not grounded and not relevant"
            )
        })

    total = len(results)
    grounded_count = sum(1 for r in results if r["grounded"])
    relevant_count = sum(1 for r in results if r["relevant"])
    clean_count = sum(1 for r in results if r["grounded"] and r["relevant"])

    hallucination_score = round((grounded_count / total) * 100)
    relevance_score = round((relevant_count / total) * 100)
    trust_score = round((clean_count / total) * 100)
    trust_score = round(0.7 * hallucination_score + 0.3 * relevance_score)

    if trust_score >= 80:
        verdict = "TRUST"
    elif trust_score >= 50:
        verdict = "VERIFY"
    else:
        verdict = "DO NOT TRUST"

    return {
        "trust_score": trust_score,
        "hallucination_score": hallucination_score,
        "relevance_score": relevance_score,
        "verdict": verdict,
        "total_sentences": total,
        "clean_count": clean_count,
        "flagged_count": total - clean_count,
        "sentence_results": results
    }
