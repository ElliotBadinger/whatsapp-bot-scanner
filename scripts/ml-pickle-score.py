import argparse
import json
import pickle
from pathlib import Path
from typing import Any, Iterable, List, Optional, Tuple

import joblib
import numpy as np
from huggingface_hub import hf_hub_download


def chunked(items: List[str], size: int) -> Iterable[List[str]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def load_pickle_model(path: Path) -> Any:
    try:
        return joblib.load(path)
    except Exception:
        with path.open("rb") as handle:
            return pickle.load(handle)


def parse_class_override(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def resolve_class_indices(
    classes: Optional[List[Any]],
    malicious_override: Optional[str],
    benign_override: Optional[str],
) -> Tuple[Optional[int], Optional[int]]:
    if not classes:
        return None, None

    def find_index(target: str) -> Optional[int]:
        for idx, cls in enumerate(classes):
            if str(cls) == target:
                return idx
        return None

    if malicious_override:
        idx = find_index(malicious_override)
        if idx is not None:
            return idx, find_index(benign_override) if benign_override else None

    if benign_override:
        idx = find_index(benign_override)
        if idx is not None:
            return find_index(malicious_override) if malicious_override else None, idx

    malicious_idx = None
    benign_idx = None
    for idx, cls in enumerate(classes):
        label = str(cls).lower()
        if any(key in label for key in ["phish", "malicious", "spam", "attack", "bad"]):
            malicious_idx = idx
        if any(key in label for key in ["benign", "legit", "good", "clean", "safe"]):
            benign_idx = idx

    if malicious_idx is None and benign_idx is None and len(classes) == 2:
        if set(map(str, classes)) == {"0", "1"}:
            benign_idx = classes.index(0) if 0 in classes else 0
            malicious_idx = classes.index(1) if 1 in classes else 1
        else:
            benign_idx = 0
            malicious_idx = 1

    return malicious_idx, benign_idx


def scores_from_proba(
    proba: np.ndarray,
    malicious_idx: Optional[int],
    benign_idx: Optional[int],
) -> Tuple[float, float, int]:
    if proba.ndim == 1:
        malicious_score = float(proba[0])
        benign_score = float(1.0 - malicious_score)
        best_idx = 0 if benign_score >= malicious_score else 1
        return malicious_score, benign_score, best_idx

    row = proba
    best_idx = int(np.argmax(row))
    if malicious_idx is None:
        malicious_idx = best_idx
    if benign_idx is None:
        benign_idx = 0 if malicious_idx != 0 else 1 if row.shape[0] > 1 else 0
    malicious_score = float(row[malicious_idx]) if malicious_idx < row.shape[0] else 0.0
    benign_score = float(row[benign_idx]) if benign_idx < row.shape[0] else 0.0
    return malicious_score, benign_score, best_idx


def sigmoid(values: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-values))


def softmax(values: np.ndarray) -> np.ndarray:
    exp = np.exp(values - np.max(values))
    return exp / exp.sum(axis=-1, keepdims=True)


def score_urls(
    urls: List[str],
    model: Any,
    malicious_idx: Optional[int],
    benign_idx: Optional[int],
) -> List[dict]:
    if hasattr(model, "predict_proba"):
        proba = np.asarray(model.predict_proba(urls))
        scores = proba
    elif hasattr(model, "decision_function"):
        raw = np.asarray(model.decision_function(urls))
        scores = sigmoid(raw) if raw.ndim == 1 else softmax(raw)
    else:
        preds = model.predict(urls)
        scores = np.asarray(preds)

    results: List[dict] = []
    for row in scores:
        if isinstance(row, np.ndarray) and row.ndim > 0:
            malicious_score, benign_score, best_idx = scores_from_proba(
                row, malicious_idx, benign_idx
            )
        else:
            malicious_score = float(row)
            benign_score = float(1.0 - malicious_score)
            best_idx = 1 if malicious_score >= benign_score else 0

        results.append(
            {
                "mlLabel": f"LABEL_{best_idx}",
                "mlMaliciousScore": malicious_score,
                "mlBenignScore": benign_score,
            }
        )
    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Input JSONL corpus path")
    parser.add_argument("--output", required=True, help="Output JSONL path")
    parser.add_argument("--model-path", default="", help="Local pickle/joblib path")
    parser.add_argument("--repo", default="", help="HuggingFace repo id")
    parser.add_argument("--filename", default="", help="Filename in repo")
    parser.add_argument("--batch-size", type=int, default=512)
    parser.add_argument("--max-rows", type=int, default=0)
    parser.add_argument("--malicious-class", default=None)
    parser.add_argument("--benign-class", default=None)
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    model_path = Path(args.model_path) if args.model_path else None
    if not model_path:
        if not args.repo or not args.filename:
            raise SystemExit("Provide --model-path or --repo + --filename")
        model_path = Path(hf_hub_download(repo_id=args.repo, filename=args.filename))

    model = load_pickle_model(model_path)

    classes = getattr(model, "classes_", None)
    classes_list = list(classes) if classes is not None else None
    malicious_override = parse_class_override(args.malicious_class)
    benign_override = parse_class_override(args.benign_class)
    malicious_idx, benign_idx = resolve_class_indices(
        classes_list, malicious_override, benign_override
    )

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

    source = args.repo if args.repo else str(model_path)
    with output_path.open("w", encoding="utf-8") as out:
        offset = 0
        for batch in chunked(urls, args.batch_size):
            batch_entries = raw_entries[offset : offset + len(batch)]
            scored = score_urls(batch, model, malicious_idx, benign_idx)
            for entry, score in zip(batch_entries, scored):
                entry.update(score)
                entry["mlSource"] = source
                out.write(json.dumps(entry, ensure_ascii=True) + "\n")
            offset += len(batch)


if __name__ == "__main__":
    main()
