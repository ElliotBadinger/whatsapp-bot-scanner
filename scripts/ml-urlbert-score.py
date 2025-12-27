import argparse
import json
from pathlib import Path
from typing import Dict, Iterable, List

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer


DEFAULT_MODEL = "CrabInHoney/urlbert-tiny-v4-malicious-url-classifier"


def chunked(items: List[str], size: int) -> Iterable[List[str]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def build_label_map(model, model_id: str) -> Dict[int, str]:
    if hasattr(model.config, "id2label") and model.config.id2label:
        id2label = {int(k): v for k, v in model.config.id2label.items()}
    else:
        id2label = {}
    if id2label and all(v.startswith("LABEL_") for v in id2label.values()):
        if "urlbert-tiny-v4-malicious-url-classifier" in model_id or (
            "urlbert-tiny-v3-malicious-url-classifier" in model_id
        ):
            return {
                0: "benign",
                1: "defacement",
                2: "malware",
                3: "phishing",
            }
        if "tinybert-url-detection-1.0" in model_id.lower():
            return {
                0: "benign",
                1: "phishing",
            }
        if len(id2label) == 2:
            return {
                0: "benign",
                1: "phishing",
            }
    return id2label


def score_urls(
    urls: List[str],
    tokenizer,
    model,
    id2label: Dict[int, str],
) -> List[Dict[str, float | str]]:
    max_len = getattr(model.config, "max_position_embeddings", 256)
    tokens = tokenizer(
        urls,
        padding=True,
        truncation=True,
        max_length=max_len,
        return_tensors="pt",
    )
    with torch.no_grad():
        logits = model(**tokens).logits
    probs = torch.softmax(logits, dim=-1).cpu().tolist()

    results = []
    for row in probs:
        label_scores = {id2label.get(i, f"LABEL_{i}").lower(): row[i] for i in range(len(row))}
        benign_score = label_scores.get("benign", label_scores.get("safe", 0.0))
        malicious_candidates = [
            label_scores.get("phish"),
            label_scores.get("phishing"),
            label_scores.get("malware"),
            label_scores.get("defacement"),
            label_scores.get("malicious"),
        ]
        malicious_score = max([s for s in malicious_candidates if s is not None] or [0.0])
        # Pick predicted label name if known.
        best_idx = int(max(range(len(row)), key=lambda i: row[i]))
        ml_label = id2label.get(best_idx, f"LABEL_{best_idx}")

        results.append(
            {
                "mlLabel": ml_label,
                "mlMaliciousScore": float(malicious_score),
                "mlBenignScore": float(benign_score),
            }
        )
    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Input JSONL corpus path")
    parser.add_argument("--output", required=True, help="Output JSONL path")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--max-rows", type=int, default=0)
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    tokenizer = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForSequenceClassification.from_pretrained(args.model)
    model.eval()

    id2label = build_label_map(model, args.model)

    urls: List[str] = []
    raw_entries: List[dict] = []
    with input_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            entry = json.loads(line)
            url = entry.get("url")
            if not isinstance(url, str) or not url.strip():
                continue
            raw_entries.append(entry)
            urls.append(url.strip())
            if args.max_rows and len(urls) >= args.max_rows:
                break

    with output_path.open("w", encoding="utf-8") as out:
        offset = 0
        for batch in chunked(urls, args.batch_size):
            batch_entries = raw_entries[offset : offset + len(batch)]
            scored = score_urls(batch, tokenizer, model, id2label)
            for entry, score in zip(batch_entries, scored):
                entry.update(score)
                entry["mlSource"] = args.model
                out.write(json.dumps(entry, ensure_ascii=True) + "\n")
            offset += len(batch)


if __name__ == "__main__":
    main()
