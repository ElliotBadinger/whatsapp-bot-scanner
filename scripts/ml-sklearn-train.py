import argparse
import json
from pathlib import Path

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression


def normalize_label(label: str) -> int | None:
    if not label:
        return None
    normalized = label.strip().lower()
    if normalized in {"phish", "phishing", "malware", "malicious", "bad", "evil"}:
        return 1
    if normalized in {"benign", "legit", "legitimate", "good", "clean"}:
        return 0
    if normalized == "1":
        return 1
    if normalized == "0":
        return 0
    return None


def load_entries(paths: list[str], max_rows: int) -> tuple[list[str], list[int]]:
    urls: list[str] = []
    labels: list[int] = []
    count = 0
    for path in paths:
        with Path(path).open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                url = entry.get("url")
                if not isinstance(url, str) or not url.strip():
                    continue
                label = normalize_label(str(entry.get("label", "")))
                if label is None:
                    continue
                urls.append(url.strip())
                labels.append(label)
                count += 1
                if max_rows and count >= max_rows:
                    return urls, labels
    return urls, labels


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inputs", nargs="+", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--max-rows", type=int, default=0)
    parser.add_argument("--max-features", type=int, default=200000)
    parser.add_argument("--ngram-min", type=int, default=3)
    parser.add_argument("--ngram-max", type=int, default=5)
    parser.add_argument("--c", type=float, default=2.0)
    args = parser.parse_args()

    urls, labels = load_entries(args.inputs, args.max_rows)

    vectorizer = TfidfVectorizer(
        analyzer="char",
        ngram_range=(args.ngram_min, args.ngram_max),
        max_features=args.max_features,
        lowercase=True,
    )
    X = vectorizer.fit_transform(urls)

    clf = LogisticRegression(
        max_iter=200,
        C=args.c,
        n_jobs=1,
    )
    clf.fit(X, labels)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"vectorizer": vectorizer, "model": clf}, output_path)


if __name__ == "__main__":
    main()
