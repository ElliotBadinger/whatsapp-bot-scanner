import argparse
import json
from pathlib import Path
from urllib.parse import urlparse

import fasttext
import numpy as np
from huggingface_hub import hf_hub_download


DEFAULT_REPO = "mstfknn/phishing-fasttext-model"
DEFAULT_FILE = "phishing_model.bin"


def extract_hostname(raw: str) -> str | None:
    try:
        parsed = urlparse(raw)
        host = parsed.hostname or ""
        return host.lower() if host else None
    except Exception:
        return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Input JSONL corpus path")
    parser.add_argument("--output", required=True, help="Output JSONL path")
    parser.add_argument("--repo", default=DEFAULT_REPO)
    parser.add_argument("--filename", default=DEFAULT_FILE)
    parser.add_argument("--model-path", default="")
    parser.add_argument("--max-rows", type=int, default=0)
    args = parser.parse_args()

    if args.model_path:
        model_path = args.model_path
    else:
        model_path = hf_hub_download(repo_id=args.repo, filename=args.filename)
    def predict_patch(self, text, k=1, threshold=0.0, on_unicode_error="strict"):
        def check(entry):
            if entry.find("\n") != -1:
                raise ValueError("predict processes one line at a time (remove '\\n')")
            entry += "\n"
            return entry

        if isinstance(text, list):
            text = [check(entry) for entry in text]
            all_labels, all_probs = self.f.multilinePredict(
                text, k, threshold, on_unicode_error
            )
            return all_labels, all_probs
        text = check(text)
        predictions = self.f.predict(text, k, threshold, on_unicode_error)
        if predictions:
            probs, labels = zip(*predictions)
        else:
            probs, labels = ([], ())
        return labels, np.asarray(probs)

    fasttext.FastText._FastText.predict = predict_patch
    model = fasttext.load_model(model_path)

    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    count = 0
    with input_path.open("r", encoding="utf-8") as f, output_path.open(
        "w", encoding="utf-8"
    ) as out:
        for line in f:
            line = line.strip()
            if not line:
                continue
            entry = json.loads(line)
            url = entry.get("url")
            if not isinstance(url, str) or not url.strip():
                continue
            host = extract_hostname(url)
            if not host:
                continue
            labels, probs = model.predict(host)
            label = labels[0] if labels else ""
            prob = float(probs[0]) if probs else 0.0
            entry["mlLabel"] = label.replace("__label__", "")
            entry["mlMaliciousScore"] = prob if "phishing" in label else 0.0
            entry["mlBenignScore"] = prob if "clean" in label else 0.0
            entry["mlSource"] = f"{args.repo}:{args.filename}"
            out.write(json.dumps(entry, ensure_ascii=True) + "\n")
            count += 1
            if args.max_rows and count >= args.max_rows:
                break


if __name__ == "__main__":
    main()
