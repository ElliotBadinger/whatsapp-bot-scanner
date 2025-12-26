import argparse
import csv
import html
import io
import json
import os
import pickle
import re
import sys
import zipfile
from urllib.parse import urlparse
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional, Tuple

import pandas as pd
import requests
import pyarrow.parquet as pq
from huggingface_hub import HfApi, hf_hub_download
import cv2


BASE_DIR = Path(__file__).resolve().parents[1]
STORAGE_DIR = BASE_DIR / "storage" / "external-datasets"


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def download(url: str, dest: Path, chunk_size: int = 1024 * 1024) -> None:
    if dest.exists():
        return
    ensure_dir(dest.parent)
    with requests.get(url, stream=True, timeout=60) as res:
        res.raise_for_status()
        with dest.open("wb") as f:
            for chunk in res.iter_content(chunk_size=chunk_size):
                if chunk:
                    f.write(chunk)


def write_jsonl(entries: Iterable[dict], dest: Path) -> int:
    ensure_dir(dest.parent)
    count = 0
    with dest.open("w", encoding="utf-8") as f:
        for entry in entries:
            f.write(json.dumps(entry, ensure_ascii=True) + "\n")
            count += 1
    return count


def guess_url_and_label_columns(df: pd.DataFrame) -> Tuple[str, Optional[str]]:
    lower_cols = {c.lower(): c for c in df.columns}
    url_col = None
    for key in ["url", "urls", "website", "web_url", "link"]:
        if key in lower_cols:
            url_col = lower_cols[key]
            break
    if not url_col:
        for col in df.columns:
            if "url" in col.lower():
                url_col = col
                break
    label_col = None
    for key in ["label", "class", "phishing", "is_phishing", "result", "type"]:
        if key in lower_cols:
            label_col = lower_cols[key]
            break
    return url_col, label_col


def normalize_label(value: object) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        val = value.strip().lower()
        if val in {"benign", "legit", "legitimate", "good", "safe"}:
            return "benign"
        if val in {"phishing", "phish", "malicious", "malware", "bad"}:
            return "malicious"
        if val in {"suspicious"}:
            return "suspicious"
    if isinstance(value, (int, float)) and not pd.isna(value):
        if int(value) == 0:
            return "benign"
        if int(value) == 1:
            return "malicious"
    return None


def normalize_url(raw: str) -> Optional[str]:
    cleaned = html.unescape(raw).strip()
    if not cleaned:
        return None
    if cleaned.startswith("//"):
        cleaned = "https:" + cleaned
    if not re.match(r"^https?://", cleaned, flags=re.I):
        cleaned = "https://" + cleaned
    parsed = urlparse(cleaned)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return cleaned


def entries_from_dataframe(
    df: pd.DataFrame,
    dataset: str,
    source: str,
    max_rows: int,
) -> List[dict]:
    url_col, label_col = guess_url_and_label_columns(df)
    if not url_col:
        raise ValueError(f"Unable to locate URL column in dataset {dataset}")
    if max_rows > 0 and len(df) > max_rows:
        df = df.sample(n=max_rows, random_state=42)

    entries: List[dict] = []
    for _, row in df.iterrows():
        url = row.get(url_col)
        if not isinstance(url, str):
            continue
        normalized = normalize_url(url)
        if not normalized:
            continue
        label = None
        if label_col:
            label = normalize_label(row.get(label_col))
        if not label:
            continue
        entries.append(
            {
                "url": normalized,
                "label": label,
                "source": source,
                "dataset": dataset,
            }
        )
    return entries


def fetch_mendeley_dataset(dataset_id: str, dataset: str, max_rows: int) -> List[dict]:
    meta = requests.get(f"https://data.mendeley.com/public-api/datasets/{dataset_id}", timeout=60)
    meta.raise_for_status()
    payload = meta.json()
    files = payload.get("files", [])
    if not files:
        raise RuntimeError(f"No files found for Mendeley dataset {dataset_id}")
    file_meta = files[0]
    download_url = file_meta.get("content_details", {}).get("download_url")
    if not download_url:
        raise RuntimeError(f"No download URL for Mendeley dataset {dataset_id}")
    dataset_dir = STORAGE_DIR / dataset
    ensure_dir(dataset_dir)
    dest = dataset_dir / file_meta.get("filename", "dataset.csv")
    download(download_url, dest)
    df = pd.read_csv(dest)
    return entries_from_dataframe(df, dataset, "mendeley", max_rows)


def fetch_hf_parquet(repo_id: str, dataset: str, max_rows: int) -> List[dict]:
    api = HfApi()
    files = api.list_repo_files(repo_id=repo_id, repo_type="dataset")
    parquet_files = [f for f in files if f.endswith(".parquet")]
    if not parquet_files:
        raise RuntimeError(f"No parquet files found for HF dataset {repo_id}")
    parquet_files.sort()
    dataset_dir = STORAGE_DIR / dataset
    ensure_dir(dataset_dir)
    selected = parquet_files[0]
    local_path = hf_hub_download(repo_id=repo_id, repo_type="dataset", filename=selected)
    table = pq.read_table(local_path)
    df = table.to_pandas()
    return entries_from_dataframe(df, dataset, "huggingface", max_rows)


def extract_urls_from_html_files(zip_path: Path, label: str, limit: int) -> List[str]:
    urls: List[str] = []
    with zipfile.ZipFile(zip_path) as zf:
        for name in zf.namelist():
            if not name.lower().endswith((".html", ".htm")):
                continue
            with zf.open(name) as f:
                try:
                    content = f.read().decode("utf-8", errors="ignore")
                except Exception:
                    continue
            for match in re.findall(r"https?://[^\\s\\\"'<>]+", content):
                normalized = normalize_url(match)
                if not normalized:
                    continue
                urls.append(normalized)
                if limit > 0 and len(urls) >= limit:
                    return urls
    return urls


def fetch_cic_trap4phish(max_rows: int) -> List[dict]:
    base = "http://cicresearch.ca/IOTDataset/CIC_Trap4Phish_2025_Dataset/Dataset/Source%20Files/HTML/"
    dataset_dir = STORAGE_DIR / "cic-trap4phish"
    ensure_dir(dataset_dir)
    benign_zip = dataset_dir / "Benign_HTML.zip"
    malicious_zip = dataset_dir / "Malicious_HTML.zip"
    download(f"{base}Benign_HTML.zip", benign_zip)
    download(f"{base}Malicious_HTML.zip", malicious_zip)
    limit = max_rows // 2 if max_rows > 0 else 500
    benign_urls = extract_urls_from_html_files(benign_zip, "benign", limit)
    malicious_urls = extract_urls_from_html_files(malicious_zip, "malicious", limit)
    entries = [
        {
            "url": url,
            "label": "benign",
            "source": "cic-trap4phish",
            "dataset": "cic-trap4phish",
        }
        for url in benign_urls
    ]
    entries.extend(
        {
            "url": url,
            "label": "malicious",
            "source": "cic-trap4phish",
            "dataset": "cic-trap4phish",
        }
        for url in malicious_urls
    )
    return entries


def fetch_github_zip(repo: str, dataset: str, max_rows: int) -> List[dict]:
    dataset_dir = STORAGE_DIR / dataset
    ensure_dir(dataset_dir)
    zip_path = dataset_dir / "repo.zip"
    download(f"https://github.com/{repo}/archive/refs/heads/main.zip", zip_path)
    extract_dir = dataset_dir / "repo"
    if not extract_dir.exists():
        ensure_dir(extract_dir)
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(extract_dir)
    csv_files = list(extract_dir.rglob("*.csv"))
    if not csv_files:
        raise RuntimeError(f"No CSV files found in GitHub repo {repo}")
    # pick the largest CSV as likely dataset
    csv_files.sort(key=lambda p: p.stat().st_size, reverse=True)
    df = pd.read_csv(csv_files[0])
    return entries_from_dataframe(df, dataset, repo, max_rows)


def decode_quishing_pickles(
    zip_path: Path, max_rows: int
) -> Tuple[List[str], List[int]]:
    with zipfile.ZipFile(zip_path) as zf:
        data = pickle.loads(zf.read("qr_codes_29.pickle"))
        labels = pickle.loads(zf.read("qr_codes_29_labels.pickle"))
    detector = cv2.QRCodeDetector()
    urls: List[str] = []
    decoded_labels: List[int] = []
    limit = max_rows if max_rows > 0 else len(labels)
    for i in range(min(len(labels), limit * 2)):
        img = data[i].astype("uint8")
        img = cv2.normalize(img, None, 0, 255, cv2.NORM_MINMAX)
        img = cv2.copyMakeBorder(img, 10, 10, 10, 10, cv2.BORDER_CONSTANT, value=255)
        img = cv2.resize(img, (512, 512), interpolation=cv2.INTER_NEAREST)
        val, _, _ = detector.detectAndDecode(img)
        if not val:
            continue
        normalized = normalize_url(val)
        if not normalized:
            continue
        urls.append(normalized)
        decoded_labels.append(int(labels[i]))
        if max_rows > 0 and len(urls) >= max_rows:
            break
    return urls, decoded_labels


def fetch_quishing_dataset(max_rows: int) -> List[dict]:
    dataset_dir = STORAGE_DIR / "qr-phishing"
    ensure_dir(dataset_dir)
    repo_zip = dataset_dir / "repo.zip"
    download(
        "https://github.com/fouadtrad/Detecting-Quishing-Attacks-with-Machine-Learning-Techniques-Through-QR-Code-Analysis/archive/refs/heads/main.zip",
        repo_zip,
    )
    extract_dir = dataset_dir / "repo"
    if not extract_dir.exists():
        ensure_dir(extract_dir)
        with zipfile.ZipFile(repo_zip) as zf:
            zf.extractall(extract_dir)
    quishing_zip = next(extract_dir.rglob("QuishingDataset.zip"), None)
    if not quishing_zip:
        raise RuntimeError("QuishingDataset.zip not found in repo")
    urls, labels = decode_quishing_pickles(quishing_zip, max_rows)
    entries: List[dict] = []
    for url, label_val in zip(urls, labels):
        label = "malicious" if label_val == 1 else "benign"
        entries.append(
            {
                "url": url,
                "label": label,
                "source": "quishing-dataset",
                "dataset": "qr-phishing",
            }
        )
    return entries


def fetch_sslbl(max_rows: int) -> List[dict]:
    dataset_dir = STORAGE_DIR / "sslbl"
    ensure_dir(dataset_dir)
    dest = dataset_dir / "sslipblacklist.csv"
    download("https://sslbl.abuse.ch/blacklist/sslipblacklist.csv", dest)
    ips: List[str] = []
    with dest.open("r", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f)
        for row in reader:
            if not row or row[0].startswith("#"):
                continue
            ips.append(row[0])
            if max_rows > 0 and len(ips) >= max_rows:
                break
    return [
        {
            "url": f"https://{ip}/",
            "label": "malicious",
            "source": "sslbl",
            "dataset": "sslbl",
        }
        for ip in ips
    ]


DATASET_HANDLERS: Dict[str, Callable[[int], List[dict]]] = {
    "phreshphish": lambda max_rows: fetch_hf_parquet(
        "phreshphish/phreshphish", "phreshphish", max_rows
    ),
    "url-phish": lambda max_rows: fetch_mendeley_dataset(
        "65z9twcx3r", "url-phish", max_rows
    ),
    "stealthphisher": lambda max_rows: fetch_mendeley_dataset(
        "m2479kmybx", "stealthphisher", max_rows
    ),
    "qr-phishing": fetch_quishing_dataset,
    "cic-trap4phish": fetch_cic_trap4phish,
    "sslbl": fetch_sslbl,
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", action="append", default=[], help="Dataset key to ingest")
    parser.add_argument("--max-rows", type=int, default=2000)
    parser.add_argument("--out-manifest", default=str(STORAGE_DIR / "manifest.json"))
    args = parser.parse_args()

    ensure_dir(STORAGE_DIR)
    dataset_keys = args.dataset or list(DATASET_HANDLERS.keys())
    manifest = {"datasets": []}

    for key in dataset_keys:
        handler = DATASET_HANDLERS.get(key)
        if not handler:
            manifest["datasets"].append({"dataset": key, "status": "skipped", "reason": "unknown"})
            continue
        try:
            entries = handler(args.max_rows)
            out_path = STORAGE_DIR / key / "corpus.jsonl"
            count = write_jsonl(entries, out_path)
            manifest["datasets"].append(
                {
                    "dataset": key,
                    "status": "ok",
                    "count": count,
                    "output": str(out_path),
                }
            )
        except Exception as exc:
            manifest["datasets"].append(
                {
                    "dataset": key,
                    "status": "failed",
                    "reason": str(exc),
                }
            )

    Path(args.out_manifest).write_text(json.dumps(manifest, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
