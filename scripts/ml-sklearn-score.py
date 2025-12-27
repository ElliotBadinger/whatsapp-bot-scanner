import argparse
import json
from pathlib import Path

import joblib


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model-path", required=True)
    parser.add_argument("--max-rows", type=int, default=0)
    args = parser.parse_args()

    model_bundle = joblib.load(args.model_path)
    vectorizer = model_bundle["vectorizer"]
    clf = model_bundle["model"]

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
            X = vectorizer.transform([url.strip()])
            prob = float(clf.predict_proba(X)[0][1])
            entry["mlLabel"] = "malicious" if prob >= 0.5 else "benign"
            entry["mlMaliciousScore"] = prob
            entry["mlBenignScore"] = 1.0 - prob
            entry["mlSource"] = Path(args.model_path).name
            out.write(json.dumps(entry, ensure_ascii=True) + "\n")
            count += 1
            if args.max_rows and count >= args.max_rows:
                break


if __name__ == "__main__":
    main()
