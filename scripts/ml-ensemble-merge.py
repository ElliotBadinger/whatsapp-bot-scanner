import argparse
import json
from pathlib import Path
from typing import Iterable, List, Optional


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--inputs",
        nargs="+",
        required=True,
        help="Input JSONL files with ml scores",
    )
    parser.add_argument("--output", required=True, help="Output JSONL path")
    parser.add_argument(
        "--mode",
        choices=["avg", "max"],
        default="avg",
        help="Aggregation mode for ml scores",
    )
    parser.add_argument("--max-rows", type=int, default=0)
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Fail on URL mismatches across inputs",
    )
    return parser.parse_args()


def aggregate(values: List[float], mode: str) -> float:
    if not values:
        return 0.0
    if mode == "max":
        return max(values)
    return sum(values) / len(values)


def main() -> None:
    args = parse_args()
    input_paths = [Path(p) for p in args.inputs]
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    streams = [p.open("r", encoding="utf-8") for p in input_paths]
    try:
        with output_path.open("w", encoding="utf-8") as out:
            row_count = 0
            while True:
                lines = [stream.readline() for stream in streams]
                if any(line == "" for line in lines):
                    break
                entries = [json.loads(line) for line in lines]
                url = entries[0].get("url")
                if args.strict and any(entry.get("url") != url for entry in entries[1:]):
                    raise SystemExit("URL mismatch across inputs")

                malicious_scores: List[float] = []
                benign_scores: List[float] = []
                sources: List[str] = []
                for entry in entries:
                    if isinstance(entry.get("mlMaliciousScore"), (int, float)):
                        malicious_scores.append(float(entry["mlMaliciousScore"]))
                    if isinstance(entry.get("mlBenignScore"), (int, float)):
                        benign_scores.append(float(entry["mlBenignScore"]))
                    source = entry.get("mlSource")
                    if isinstance(source, str) and source.strip():
                        sources.append(source.strip())

                malicious_score = aggregate(malicious_scores, args.mode)
                benign_score = aggregate(benign_scores, args.mode)
                ml_label = "malicious" if malicious_score >= benign_score else "benign"

                merged = dict(entries[0])
                merged.update(
                    {
                        "mlLabel": ml_label,
                        "mlMaliciousScore": malicious_score,
                        "mlBenignScore": benign_score,
                        "mlSource": f"ensemble:{args.mode}:" + ",".join(sources),
                    }
                )
                out.write(json.dumps(merged, ensure_ascii=True) + "\n")
                row_count += 1
                if args.max_rows and row_count >= args.max_rows:
                    break
    finally:
        for stream in streams:
            stream.close()


if __name__ == "__main__":
    main()
