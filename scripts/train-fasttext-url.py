import argparse
import json
from pathlib import Path

import fasttext


def normalize_label(label: str) -> str | None:
    if not label:
        return None
    normalized = label.strip().lower()
    if normalized in {"phish", "phishing", "malware", "malicious", "bad", "evil"}:
        return "__label__phishing"
    if normalized in {"benign", "legit", "legitimate", "good", "clean"}:
        return "__label__clean"
    if normalized == "1":
        return "__label__phishing"
    if normalized == "0":
        return "__label__clean"
    return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inputs", nargs="+", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--train-file", default="")
    parser.add_argument("--max-rows", type=int, default=0)
    parser.add_argument("--epoch", type=int, default=10)
    parser.add_argument("--lr", type=float, default=0.5)
    parser.add_argument("--dim", type=int, default=100)
    parser.add_argument("--word-ngrams", type=int, default=2)
    parser.add_argument("--minn", type=int, default=3)
    parser.add_argument("--maxn", type=int, default=5)
    parser.add_argument("--quantize", action="store_true")
    args = parser.parse_args()

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    train_file = (
        Path(args.train_file)
        if args.train_file
        else output_path.with_suffix(".train.txt")
    )

    count = 0
    with train_file.open("w", encoding="utf-8") as out:
        for input_path in args.inputs:
            with Path(input_path).open("r", encoding="utf-8") as f:
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
                    if not label:
                        continue
                    out.write(f"{label} {url.strip()}\n")
                    count += 1
                    if args.max_rows and count >= args.max_rows:
                        break
            if args.max_rows and count >= args.max_rows:
                break

    model = fasttext.train_supervised(
        input=str(train_file),
        lr=args.lr,
        epoch=args.epoch,
        dim=args.dim,
        wordNgrams=args.word_ngrams,
        minn=args.minn,
        maxn=args.maxn,
    )
    model.save_model(str(output_path))

    if args.quantize:
        q_path = output_path.with_suffix(".ftz")
        model.quantize(
            input=str(train_file),
            qnorm=True,
            retrain=True,
        )
        model.save_model(str(q_path))


if __name__ == "__main__":
    main()
