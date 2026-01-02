#!/usr/bin/env python3
import argparse
import csv
import gzip
import json
import os
import re
import shutil
import tarfile
import tempfile
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

REPORT_URL_PATTERN = re.compile(r"https?://[^\\s\\)\\]\\}<>\"']+")
DEFANG_PATTERN = re.compile(r"^hxxps?://", re.IGNORECASE)
DEFANG_HOST_DOT = re.compile(r"\\[\\.\\]|\\(\\.\\)")
TEXT_EXTENSIONS = {".txt", ".csv", ".tsv", ".json", ".jsonl", ".ndjson"}
SANS_SCORE_MIN = int(os.environ.get("SANS_SCORE_MIN", "3"))

DATASET_SOURCES = [
    {
        "id": "openphish_feed",
        "type": "text_feed",
        "feed_format": "url_list",
        "label": "malicious",
        "source_url": "https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt",
        "notes": "OpenPhish public feed (near-real-time)",
    },
    {
        "id": "urlhaus_feed",
        "type": "text_feed",
        "feed_format": "url_list",
        "label": "malicious",
        "source_url": "https://urlhaus.abuse.ch/downloads/text_online/",
        "notes": "URLHaus online URL list (near-real-time)",
    },
    {
        "id": "certpl_feed",
        "type": "text_feed",
        "feed_format": "domain_list",
        "label": "malicious",
        "source_url": "https://hole.cert.pl/domains/v2/domains.txt",
        "notes": "CERT.PL malicious domain list",
    },
    {
        "id": "sans_domaindata",
        "type": "text_feed",
        "feed_format": "sans_json",
        "label": "suspicious",
        "source_url": "https://isc.sans.edu/feeds/domaindata.json.gz",
        "notes": "SANS ISC domain data (suspicious)",
    },
    {
        "id": "phishtank_feed",
        "type": "text_feed",
        "feed_format": "phishtank_json",
        "label": "malicious",
        "env": "PHISHTANK_API_KEY",
        "template": "http://data.phishtank.com/data/{value}/online-valid.json",
        "source_url": "https://phishtank.org/",
        "notes": "PhishTank online-valid feed (requires API key)",
    },
    {
        "id": "phishing_database",
        "type": "text_feed",
        "feed_format": "domain_list",
        "label": "malicious",
        "source_url": "https://raw.githubusercontent.com/mitchellkrogza/Phishing.Database/master/phishing-domains-ACTIVE.txt",
        "notes": "Phishing.Database domain list",
    },
    {
        "id": "majestic_top",
        "type": "text_feed",
        "feed_format": "majestic_csv",
        "label": "benign",
        "source_url": "https://downloads.majestic.com/majestic_million.csv",
        "notes": "Majestic million top domains (benign)",
    },
    {
        "id": "phreshphish",
        "type": "huggingface",
        "hf_id": "phreshphish/phreshphish",
        "url_field": "url",
        "label_field": "label",
        "source_url": "https://huggingface.co/datasets/phreshphish/phreshphish",
        "notes": "PhreshPhish (HuggingFace dataset)",
    },
    {
        "id": "qr_phishing_github",
        "type": "github_zip",
        "repo": "fouadtrad/Detecting-Quishing-Attacks-with-Machine-Learning-Techniques-Through-QR-Code-Analysis",
        "branch": "main",
        "source_url": "https://github.com/fouadtrad/Detecting-Quishing-Attacks-with-Machine-Learning-Techniques-Through-QR-Code-Analysis",
        "notes": "QR phishing dataset (GitHub)",
    },
    {
        "id": "cic_trap4phish_2025",
        "type": "archive",
        "env": "CIC_TRAP4PHISH_ARCHIVE",
        "source_url": "https://www.unb.ca/cic/datasets/trap4phish2025.html",
        "notes": "CIC-Trap4Phish 2025 (requires manual download)",
    },
    {
        "id": "url_phish",
        "type": "archive",
        "env": "URL_PHISH_ARCHIVE",
        "source_url": "https://data.mendeley.com/datasets/65z9twcx3r/1",
        "notes": "URL-Phish (Mendeley Data, requires manual download)",
    },
    {
        "id": "stealthphisher",
        "type": "archive",
        "env": "STEALTHPHISHER_ARCHIVE",
        "source_url": "https://data.mendeley.com/datasets/m2479kmybx/1",
        "notes": "StealthPhisher (Mendeley Data, requires manual download)",
    },
    {
        "id": "phishofe",
        "type": "archive",
        "env": "PHISHOFE_ARCHIVE",
        "source_url": "https://ieee-dataport.org/documents/phishofe-dataset-phishing-url-dataset",
        "notes": "PhishOFE (IEEE Dataport, requires manual download)",
    },
    {
        "id": "dynapd_kits",
        "type": "archive_kits",
        "env": "DYNAPD_ARCHIVE",
        "source_url": "https://github.com/code-philia/DynaPD",
        "notes": "DynaPD phishing kit dataset (requires manual download)",
    },
    {
        "id": "redirect_patterns",
        "type": "archive",
        "env": "REDIRECT_PATTERNS_ARCHIVE",
        "source_url": "https://arxiv.org/pdf/2507.22019",
        "notes": "Redirect patterns dataset (Internet Archive)",
    },
    {
        "id": "threatfox_full",
        "type": "threatfox",
        "source_url": "https://threatfox.abuse.ch/export/json/full/",
        "notes": "ThreatFox full export",
    },
    {
        "id": "sslbl",
        "type": "sslbl",
        "source_url": "https://sslbl.abuse.ch/blacklist/sslipblacklist.csv",
        "notes": "abuse.ch SSLBL IP blacklist",
    },
    {
        "id": "urlscan_export",
        "type": "urlscan_export",
        "env": "URLSCAN_EXPORT_PATH",
        "source_url": "https://urlscan.io/docs/api/",
        "notes": "urlscan.io export (local JSON/JSONL)",
    },
    {
        "id": "report_patterns",
        "type": "report_patterns",
        "source_url": "scripts/dataset reports",
        "notes": "Report-derived patterns from local artifacts",
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch and normalize robustness datasets for scanner testing."
    )
    parser.add_argument(
        "--output-dir",
        default="storage/robustness",
        help="Directory for normalized JSONL outputs.",
    )
    parser.add_argument(
        "--manifest",
        default="storage/robustness/manifest.json",
        help="Manifest output path.",
    )
    parser.add_argument(
        "--reports-dir",
        default="scripts/dataset reports",
        help="Directory containing local dataset reports.",
    )
    parser.add_argument(
        "--source",
        action="append",
        default=[],
        help="Limit to specific dataset ids (can be repeated).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download archives even if cached.",
    )
    parser.add_argument(
        "--max-rows",
        type=int,
        default=0,
        help="Maximum rows per source (0 = no limit).",
    )
    return parser.parse_args()


def defang_url(value: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        return trimmed
    trimmed = DEFANG_PATTERN.sub(
        lambda m: "https://" if "hxxps" in m.group(0).lower() else "http://",
        trimmed,
    )
    trimmed = DEFANG_HOST_DOT.sub(".", trimmed)
    trimmed = trimmed.replace("[.]", ".").replace("(.)", ".")
    return trimmed


def normalize_url(value: str) -> Optional[str]:
    cleaned = defang_url(value)
    cleaned = cleaned.strip().strip(")]},>\"'")
    if not cleaned.lower().startswith(("http://", "https://")):
        return None
    try:
        parsed = urllib.parse.urlsplit(cleaned)
    except Exception:
        return None
    if parsed.scheme not in ("http", "https"):
        return None
    if not parsed.netloc:
        return None
    netloc = parsed.netloc.lower()
    normalized = urllib.parse.urlunsplit(
        (parsed.scheme, netloc, parsed.path or "/", parsed.query, "")
    )
    return normalized


def normalize_domain(value: str) -> Optional[str]:
    trimmed = value.strip().lower()
    if not trimmed or "." not in trimmed:
        return None
    return trimmed.rstrip(".")


def map_label(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = str(value).strip().lower()
    if not normalized:
        return None
    if normalized in ("1", "phish", "phishing", "malware", "malicious", "bad"):
        return "malicious"
    if normalized in ("0", "benign", "legit", "legitimate", "good", "clean"):
        return "benign"
    if normalized in ("sus", "suspicious"):
        return "suspicious"
    if normalized in ("tricky", "hard"):
        return "tricky"
    return None


def infer_label_from_path(path: Path) -> Optional[str]:
    lowered = str(path).lower()
    if "benign" in lowered or "legit" in lowered:
        return "benign"
    if "phish" in lowered or "malicious" in lowered or "bad" in lowered:
        return "malicious"
    if "suspicious" in lowered:
        return "suspicious"
    return None


def resolve_source_url(source: Dict) -> str:
    env_key = source.get("env")
    if env_key:
        value = os.environ.get(env_key, "").strip()
        if not value:
            raise RuntimeError(f"Missing environment variable: {env_key}")
        template = source.get("template")
        return template.format(value=value) if template else value
    return source.get("source_url") or ""


def read_text_maybe_gzip(file_path: Path) -> str:
    data = file_path.read_bytes()
    if file_path.suffix.lower() == ".gz":
        data = gzip.decompress(data)
    return data.decode("utf-8", errors="ignore")


def parse_url_list(raw: str) -> List[str]:
    urls: List[str] = []
    for line in raw.splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#"):
            continue
        normalized = normalize_url(trimmed)
        if normalized:
            urls.append(normalized)
    return urls


def parse_domain_list(raw: str) -> List[str]:
    domains: List[str] = []
    for line in raw.splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#"):
            continue
        normalized = normalize_domain(trimmed)
        if normalized:
            domains.append(normalized)
    return domains


def parse_majestic_csv(raw: str) -> List[str]:
    domains: List[str] = []
    lines = [line for line in raw.splitlines() if line.strip()]
    start = 1 if lines and "globalrank" in lines[0].lower() else 0
    for line in lines[start:]:
        parts = line.split(",")
        if len(parts) < 3:
            continue
        domain = normalize_domain(parts[2])
        if domain:
            domains.append(domain)
    return domains


def parse_sans_domains(raw: str) -> List[str]:
    trimmed = raw.strip()
    if not trimmed:
        return []
    records: List[Dict] = []
    if trimmed.startswith("["):
        try:
            parsed = json.loads(trimmed)
            if isinstance(parsed, list):
                records = parsed
        except json.JSONDecodeError:
            return []
    else:
        for line in trimmed.splitlines():
            entry = line.strip()
            if not entry:
                continue
            if not entry.startswith("{"):
                domain = normalize_domain(entry)
                if domain:
                    records.append({"domainname": domain, "score": SANS_SCORE_MIN})
                continue
            try:
                records.append(json.loads(entry))
            except json.JSONDecodeError:
                continue
    domains: List[str] = []
    for record in records:
        if not isinstance(record, dict):
            continue
        raw_score = record.get("score") or record.get("risk") or record.get("risk_score") or record.get("r")
        try:
            score = int(float(raw_score))
        except (TypeError, ValueError):
            score = 0
        if score < SANS_SCORE_MIN:
            continue
        domain = (
            normalize_domain(str(record.get("domainname") or ""))
            or normalize_domain(str(record.get("domain") or ""))
            or normalize_domain(str(record.get("name") or ""))
            or normalize_domain(str(record.get("fqdn") or ""))
            or normalize_domain(str(record.get("host") or ""))
        )
        if domain:
            domains.append(domain)
    return domains


def parse_phishtank_urls(raw: str) -> List[str]:
    trimmed = raw.strip()
    if not trimmed:
        return []
    urls: List[str] = []
    if trimmed.startswith("["):
        try:
            parsed = json.loads(trimmed)
            if isinstance(parsed, list):
                for entry in parsed:
                    if not isinstance(entry, dict):
                        continue
                    url = entry.get("url") or entry.get("phish_url")
                    if not url:
                        continue
                    normalized = normalize_url(str(url))
                    if normalized:
                        urls.append(normalized)
                return urls
        except json.JSONDecodeError:
            return []
    for line in trimmed.splitlines():
        match = REPORT_URL_PATTERN.search(line)
        if not match:
            continue
        normalized = normalize_url(match.group(0))
        if normalized:
            urls.append(normalized)
    return urls


def write_entry(
    output_file,
    url: str,
    label: Optional[str],
    source_id: str,
    fetched_at: str,
    counts: Dict[str, int],
    metadata: Optional[Dict[str, str]] = None,
    max_rows: Optional[int] = None,
) -> bool:
    if max_rows and counts.get("total", 0) >= max_rows:
        return False
    entry = {"url": url, "label": label or "unknown", "source": source_id, "fetchedAt": fetched_at}
    if metadata:
        entry["metadata"] = metadata
    output_file.write(json.dumps(entry) + "\n")
    counts["total"] = counts.get("total", 0) + 1
    label_key = label or "unknown"
    counts[label_key] = counts.get(label_key, 0) + 1
    return True


def resolve_limit(source: Dict, max_rows: int) -> Optional[int]:
    source_limit = source.get("max_rows")
    if isinstance(source_limit, int) and source_limit > 0:
        return source_limit
    if max_rows and max_rows > 0:
        return max_rows
    return None


def download_file(url: str, dest: Path, force: bool) -> Path:
    if dest.exists() and not force:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        with open(dest, "wb") as handle:
            shutil.copyfileobj(resp, handle)
    return dest


def extract_archive(archive_path: Path, dest_dir: Path) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    if archive_path.suffix.lower() == ".zip":
        with zipfile.ZipFile(archive_path, "r") as zf:
            zf.extractall(dest_dir)
        return
    if archive_path.suffix.lower() in (".tgz", ".gz", ".tar"):
        mode = "r:gz" if archive_path.suffix.lower() in (".tgz", ".gz") else "r"
        with tarfile.open(archive_path, mode) as tf:
            tf.extractall(dest_dir)
        return
    raise RuntimeError(f"Unsupported archive format: {archive_path}")


def iter_candidate_files(root_dir: Path) -> Iterable[Path]:
    for path in root_dir.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() in TEXT_EXTENSIONS:
            yield path


def parse_csv_file(
    file_path: Path,
    output_file,
    counts: Dict[str, int],
    source_id: str,
    fetched_at: str,
    default_label: Optional[str] = None,
    max_rows: Optional[int] = None,
) -> None:
    with open(file_path, "r", encoding="utf-8", errors="ignore") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample)
        except csv.Error:
            dialect = csv.excel
        reader = csv.DictReader(handle, dialect=dialect)
        if not reader.fieldnames:
            return
        field_map = {field.strip().lower(): field for field in reader.fieldnames}
        fields = list(field_map.keys())
        url_fields = [
            name
            for name in fields
            if name in ("url", "urls", "link", "uri", "target", "phish_url", "decoded_url")
        ]
        label_fields = [
            name
            for name in fields
            if name in ("label", "class", "status", "is_phishing", "phishing")
        ]
        for row in reader:
            url_value = None
            for url_field in url_fields:
                raw = row.get(field_map.get(url_field, ""))
                if raw:
                    url_value = raw
                    break
            if not url_value:
                continue
            url = normalize_url(str(url_value))
            if not url:
                continue
            label_value = None
            for label_field in label_fields:
                label_value = row.get(field_map.get(label_field, ""))
                if label_value is not None:
                    break
            label = map_label(label_value) or default_label
            if not write_entry(
                output_file,
                url,
                label,
                source_id,
                fetched_at,
                counts,
                max_rows=max_rows,
            ):
                return


def parse_json_lines(
    handle,
    output_file,
    counts: Dict[str, int],
    source_id: str,
    fetched_at: str,
    default_label: Optional[str] = None,
    max_rows: Optional[int] = None,
) -> None:
    for line in handle:
        trimmed = line.strip()
        if not trimmed:
            continue
        try:
            entry = json.loads(trimmed)
        except json.JSONDecodeError:
            continue
        for url_value, label_value in iter_urls_from_entry(entry):
            url = normalize_url(url_value)
            if not url:
                continue
            label = map_label(label_value) or default_label
            if not write_entry(
                output_file,
                url,
                label,
                source_id,
                fetched_at,
                counts,
                max_rows=max_rows,
            ):
                return


def iter_urls_from_entry(entry) -> Iterable[Tuple[str, Optional[str]]]:
    if isinstance(entry, dict):
        for key in ("url", "urls", "link", "uri", "target", "phish_url", "decoded_url"):
            if key in entry:
                value = entry.get(key)
                if isinstance(value, list):
                    for item in value:
                        if item:
                            yield str(item), entry.get("label")
                elif value:
                    yield str(value), entry.get("label")
        if "ioc_value" in entry and entry.get("ioc_type") in ("url", "domain", "ip", "ip:port"):
            value = str(entry.get("ioc_value"))
            ioc_type = entry.get("ioc_type")
            if ioc_type == "url":
                yield value, "malicious"
            else:
                yield f"http://{value}", "malicious"
        for value in entry.values():
            for url_value, label_value in iter_urls_from_entry(value):
                yield url_value, label_value
        return
    if isinstance(entry, list):
        for item in entry:
            for url_value, label_value in iter_urls_from_entry(item):
                yield url_value, label_value


def parse_json_file(
    file_path: Path,
    output_file,
    counts: Dict[str, int],
    source_id: str,
    fetched_at: str,
    default_label: Optional[str] = None,
    max_rows: Optional[int] = None,
) -> None:
    size = file_path.stat().st_size
    if size > 50 * 1024 * 1024:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as handle:
            parse_json_lines(
                handle,
                output_file,
                counts,
                source_id,
                fetched_at,
                default_label,
                max_rows=max_rows,
            )
        return
    with open(file_path, "r", encoding="utf-8", errors="ignore") as handle:
        try:
            data = json.load(handle)
        except json.JSONDecodeError:
            handle.seek(0)
            parse_json_lines(
                handle,
                output_file,
                counts,
                source_id,
                fetched_at,
                default_label,
                max_rows=max_rows,
            )
            return
    for url_value, label_value in iter_urls_from_entry(data):
        url = normalize_url(url_value)
        if not url:
            continue
        label = map_label(label_value) or default_label
        if not write_entry(
            output_file,
            url,
            label,
            source_id,
            fetched_at,
            counts,
            max_rows=max_rows,
        ):
            return


def parse_text_file(
    file_path: Path,
    output_file,
    counts: Dict[str, int],
    source_id: str,
    fetched_at: str,
    default_label: Optional[str] = None,
    max_rows: Optional[int] = None,
) -> None:
    with open(file_path, "r", encoding="utf-8", errors="ignore") as handle:
        for line in handle:
            trimmed = line.strip()
            if not trimmed or trimmed.startswith("#"):
                continue
            match = REPORT_URL_PATTERN.search(trimmed)
            if not match:
                continue
            url = normalize_url(match.group(0))
            if not url:
                continue
            if not write_entry(
                output_file,
                url,
                default_label,
                source_id,
                fetched_at,
                counts,
                max_rows=max_rows,
            ):
                return


def parse_dataset_tree(
    root_dir: Path,
    output_file,
    counts: Dict[str, int],
    source_id: str,
    fetched_at: str,
    default_label: Optional[str] = None,
    max_rows: Optional[int] = None,
) -> None:
    for file_path in iter_candidate_files(root_dir):
        label_hint = infer_label_from_path(file_path) or default_label
        suffix = file_path.suffix.lower()
        if suffix in (".csv", ".tsv"):
            parse_csv_file(
                file_path,
                output_file,
                counts,
                source_id,
                fetched_at,
                label_hint,
                max_rows=max_rows,
            )
        elif suffix in (".jsonl", ".ndjson"):
            with open(file_path, "r", encoding="utf-8", errors="ignore") as handle:
                parse_json_lines(
                    handle,
                    output_file,
                    counts,
                    source_id,
                    fetched_at,
                    label_hint,
                    max_rows=max_rows,
                )
        elif suffix == ".json":
            parse_json_file(
                file_path,
                output_file,
                counts,
                source_id,
                fetched_at,
                label_hint,
                max_rows=max_rows,
            )
        else:
            parse_text_file(
                file_path,
                output_file,
                counts,
                source_id,
                fetched_at,
                label_hint,
                max_rows=max_rows,
            )
        if max_rows and counts.get("total", 0) >= max_rows:
            return


def fetch_text_feed(
    source: Dict,
    output_path: Path,
    cache_dir: Path,
    force: bool,
    fetched_at: str,
    max_rows: Optional[int],
) -> Dict:
    url = resolve_source_url(source)
    if not url:
        raise RuntimeError("Feed URL not available")
    if url.startswith(("http://", "https://")):
        parsed = urllib.parse.urlparse(url)
        suffix = Path(parsed.path).suffix or ".txt"
        dest = cache_dir / f"{source['id']}{suffix}"
        download_file(url, dest, force)
    else:
        dest = Path(url)
        if not dest.exists():
            raise RuntimeError("Feed path missing")
    raw = read_text_maybe_gzip(dest)
    feed_format = source.get("feed_format", "url_list")
    label = source.get("label")
    scheme = source.get("scheme", "https")

    counts: Dict[str, int] = {}
    with open(output_path, "w", encoding="utf-8") as output_file:
        if feed_format == "url_list":
            for url_value in parse_url_list(raw):
                if not write_entry(
                    output_file,
                    url_value,
                    label,
                    source["id"],
                    fetched_at,
                    counts,
                    max_rows=max_rows,
                ):
                    break
        elif feed_format == "domain_list":
            for domain in parse_domain_list(raw):
                url_value = normalize_url(f"{scheme}://{domain}")
                if not url_value:
                    continue
                if not write_entry(
                    output_file,
                    url_value,
                    label,
                    source["id"],
                    fetched_at,
                    counts,
                    max_rows=max_rows,
                ):
                    break
        elif feed_format == "sans_json":
            for domain in parse_sans_domains(raw):
                url_value = normalize_url(f"{scheme}://{domain}")
                if not url_value:
                    continue
                if not write_entry(
                    output_file,
                    url_value,
                    label,
                    source["id"],
                    fetched_at,
                    counts,
                    max_rows=max_rows,
                ):
                    break
        elif feed_format == "phishtank_json":
            for url_value in parse_phishtank_urls(raw):
                if not write_entry(
                    output_file,
                    url_value,
                    label,
                    source["id"],
                    fetched_at,
                    counts,
                    max_rows=max_rows,
                ):
                    break
        elif feed_format == "majestic_csv":
            for domain in parse_majestic_csv(raw):
                url_value = normalize_url(f"{scheme}://{domain}")
                if not url_value:
                    continue
                if not write_entry(
                    output_file,
                    url_value,
                    label,
                    source["id"],
                    fetched_at,
                    counts,
                    max_rows=max_rows,
                ):
                    break
        else:
            raise RuntimeError(f"Unknown feed format: {feed_format}")

    return counts


def fetch_huggingface(
    source: Dict, output_path: Path, fetched_at: str, max_rows: Optional[int]
) -> Dict:
    try:
        from datasets import load_dataset
    except ImportError as exc:
        raise RuntimeError(
            "datasets is required for HuggingFace sources. Install with "
            "pip install -r scripts/robustness/requirements.txt"
        ) from exc

    dataset = load_dataset(source["hf_id"], split="train", streaming=True)
    counts: Dict[str, int] = {}
    with open(output_path, "w", encoding="utf-8") as output_file:
        for row in dataset:
            url_value = row.get(source.get("url_field", "url"))
            if not url_value:
                continue
            url = normalize_url(str(url_value))
            if not url:
                continue
            label_value = row.get(source.get("label_field", "label"))
            label = map_label(label_value)
            if not write_entry(
                output_file,
                url,
                label,
                source["id"],
                fetched_at,
                counts,
                max_rows=max_rows,
            ):
                break
    return counts


def fetch_github_zip(
    source: Dict,
    output_path: Path,
    cache_dir: Path,
    force: bool,
    fetched_at: str,
    max_rows: Optional[int],
) -> Dict:
    repo = source["repo"]
    branch = source.get("branch", "main")
    url = f"https://github.com/{repo}/archive/refs/heads/{branch}.zip"
    archive_path = cache_dir / f"{source['id']}.zip"
    download_file(url, archive_path, force)
    temp_dir = Path(tempfile.mkdtemp(prefix=f"{source['id']}-"))
    try:
        extract_archive(archive_path, temp_dir)
        counts: Dict[str, int] = {}
        with open(output_path, "w", encoding="utf-8") as output_file:
            parse_dataset_tree(
                temp_dir,
                output_file,
                counts,
                source["id"],
                fetched_at,
                max_rows=max_rows,
            )
        return counts
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def resolve_archive_path(source: Dict, cache_dir: Path, force: bool) -> Optional[Path]:
    env_key = source.get("env")
    if not env_key:
        return None
    value = os.environ.get(env_key, "").strip()
    if not value:
        return None
    if value.startswith(("http://", "https://")):
        dest = cache_dir / f"{source['id']}{Path(urllib.parse.urlparse(value).path).suffix}"
        return download_file(value, dest, force)
    return Path(value)


def fetch_archive_source(
    source: Dict,
    output_path: Path,
    cache_dir: Path,
    force: bool,
    fetched_at: str,
    max_rows: Optional[int],
) -> Dict:
    archive_path = resolve_archive_path(source, cache_dir, force)
    if not archive_path or not archive_path.exists():
        raise RuntimeError("Archive not available")
    temp_dir = Path(tempfile.mkdtemp(prefix=f"{source['id']}-"))
    try:
        extract_archive(archive_path, temp_dir)
        counts: Dict[str, int] = {}
        with open(output_path, "w", encoding="utf-8") as output_file:
            parse_dataset_tree(
                temp_dir,
                output_file,
                counts,
                source["id"],
                fetched_at,
                max_rows=max_rows,
            )
        return counts
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def fetch_dynapd_kits(
    source: Dict,
    output_path: Path,
    cache_dir: Path,
    force: bool,
    fetched_at: str,
    max_rows: Optional[int],
) -> Dict:
    archive_path = resolve_archive_path(source, cache_dir, force)
    if not archive_path or not archive_path.exists():
        raise RuntimeError("Archive not available")
    temp_dir = Path(tempfile.mkdtemp(prefix=f"{source['id']}-"))
    try:
        extract_archive(archive_path, temp_dir)
        counts: Dict[str, int] = {}
        with open(output_path, "w", encoding="utf-8") as output_file:
            for file_path in temp_dir.rglob("*"):
                if not file_path.is_file():
                    continue
                rel = file_path.relative_to(temp_dir).as_posix()
                ext = file_path.suffix.lower()
                if ext not in (".php", ".html", ".htm", ".asp", ".aspx", ".jsp", ".cgi", ".js"):
                    continue
                url = normalize_url(f"https://phishing-kit.local/{rel}")
                if not url:
                    continue
                if not write_entry(
                    output_file,
                    url,
                    "malicious",
                    source["id"],
                    fetched_at,
                    counts,
                    metadata={"path": rel},
                    max_rows=max_rows,
                ):
                    return counts
                if max_rows and counts.get("total", 0) >= max_rows:
                    return counts
        return counts
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def fetch_threatfox(
    source: Dict,
    output_path: Path,
    cache_dir: Path,
    force: bool,
    fetched_at: str,
    max_rows: Optional[int],
) -> Dict:
    archive_path = cache_dir / f"{source['id']}.zip"
    download_file(source["source_url"], archive_path, force)
    temp_dir = Path(tempfile.mkdtemp(prefix=f"{source['id']}-"))
    try:
        extract_archive(archive_path, temp_dir)
        json_files = list(temp_dir.rglob("*.json"))
        if not json_files:
            raise RuntimeError("ThreatFox archive missing JSON payload")
        counts: Dict[str, int] = {}
        with open(output_path, "w", encoding="utf-8") as output_file:
            for json_file in json_files:
                with open(json_file, "r", encoding="utf-8", errors="ignore") as handle:
                    try:
                        data = json.load(handle)
                    except json.JSONDecodeError:
                        continue
                for url_value, label_value in iter_urls_from_entry(data):
                    url = normalize_url(url_value)
                    if not url:
                        continue
                    label = map_label(label_value) or "malicious"
                    if not write_entry(
                        output_file,
                        url,
                        label,
                        source["id"],
                        fetched_at,
                        counts,
                        max_rows=max_rows,
                    ):
                        return counts
                if max_rows and counts.get("total", 0) >= max_rows:
                    break
        return counts
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def fetch_sslbl(
    source: Dict,
    output_path: Path,
    cache_dir: Path,
    force: bool,
    fetched_at: str,
    max_rows: Optional[int],
) -> Dict:
    archive_path = cache_dir / f"{source['id']}.csv"
    download_file(source["source_url"], archive_path, force)
    counts: Dict[str, int] = {}
    with open(output_path, "w", encoding="utf-8") as output_file:
        with open(archive_path, "r", encoding="utf-8", errors="ignore") as handle:
            for line in handle:
                if line.startswith("#"):
                    continue
                parts = [part.strip() for part in line.split(",")]
                if not parts or not parts[0]:
                    continue
                ip = parts[0]
                port = parts[1] if len(parts) > 1 and parts[1].isdigit() else ""
                url = normalize_url(f"https://{ip}:{port}/" if port else f"https://{ip}/")
                if not url:
                    continue
                if not write_entry(
                    output_file,
                    url,
                    "malicious",
                    source["id"],
                    fetched_at,
                    counts,
                    max_rows=max_rows,
                ):
                    break
    return counts


def fetch_urlscan_export(
    source: Dict, output_path: Path, fetched_at: str, max_rows: Optional[int]
) -> Dict:
    export_path = os.environ.get(source.get("env", ""), "").strip()
    if not export_path:
        raise RuntimeError("URLSCAN export not provided")
    export_path = Path(export_path)
    if not export_path.exists():
        raise RuntimeError("URLSCAN export missing")
    counts: Dict[str, int] = {}
    with open(output_path, "w", encoding="utf-8") as output_file:
        if export_path.suffix.lower() in (".jsonl", ".ndjson"):
            with open(export_path, "r", encoding="utf-8", errors="ignore") as handle:
                parse_json_lines(
                    handle,
                    output_file,
                    counts,
                    source["id"],
                    fetched_at,
                    "suspicious",
                    max_rows=max_rows,
                )
        else:
            parse_json_file(
                export_path,
                output_file,
                counts,
                source["id"],
                fetched_at,
                "suspicious",
                max_rows=max_rows,
            )
    return counts


def extract_patterns_from_reports(reports_dir: Path) -> List[str]:
    patterns: List[str] = []

    link_corpus = reports_dir / "link-corpus.js"
    if link_corpus.exists():
        text = link_corpus.read_text(encoding="utf-8", errors="ignore")
        in_section = False
        for line in text.splitlines():
            if line.lower().startswith("## sample representative url patterns"):
                in_section = True
                continue
            if in_section and line.startswith("## "):
                break
            if not in_section:
                continue
            for match in re.findall(r"`(https?://[^`]+)`", line):
                parts = [part.strip() for part in re.split(r"\\s+→\\s+|\\s+->\\s+", match)]
                patterns.extend(parts)

    json_report = reports_dir / "trun_74f21421f86a402ab75ea8fb08f8305c.json"
    if json_report.exists():
        try:
            data = json.loads(json_report.read_text(encoding="utf-8", errors="ignore"))
            for entry in data.get("output", {}).get("representative_url_patterns", []):
                pattern = entry.get("sanitized_url_pattern")
                if pattern:
                    patterns.append(pattern)
        except json.JSONDecodeError:
            pass

    pdf_report = reports_dir / "URL Tactics Research Request.pdf"
    if pdf_report.exists():
        try:
            from pypdf import PdfReader
        except ImportError:
            PdfReader = None
        if PdfReader:
            reader = PdfReader(str(pdf_report))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
            lines = text.splitlines()
            in_section = False
            for line in lines:
                if "Examples of Tricky Malicious URL Patterns" in line:
                    in_section = True
                    continue
                if in_section and line.startswith("Trusted Domain"):
                    break
                if not in_section:
                    continue
                for match in re.findall(r"hxxps?://[^\\s]+|https?://[^\\s]+", line, re.IGNORECASE):
                    patterns.append(match)

    cleaned = []
    for pattern in patterns:
        url = normalize_url(pattern)
        if url:
            cleaned.append(url)
    return cleaned


def fetch_report_patterns(
    source: Dict,
    output_path: Path,
    fetched_at: str,
    reports_dir: Path,
    max_rows: Optional[int],
) -> Dict:
    counts: Dict[str, int] = {}
    patterns = extract_patterns_from_reports(reports_dir)
    with open(output_path, "w", encoding="utf-8") as output_file:
        for url in patterns:
            if not write_entry(
                output_file,
                url,
                "tricky",
                source["id"],
                fetched_at,
                counts,
                max_rows=max_rows,
            ):
                break
    return counts


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    sources_dir = output_dir / "sources"
    sources_dir.mkdir(parents=True, exist_ok=True)
    cache_dir = output_dir / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)

    reports_dir = Path(args.reports_dir)
    fetched_at = datetime.now(timezone.utc).isoformat()
    manifest = {"generatedAt": fetched_at, "sources": []}

    target_ids = set(args.source or [])

    for source in DATASET_SOURCES:
        if target_ids and source["id"] not in target_ids:
            continue
        output_path = sources_dir / f"{source['id']}.jsonl"
        max_rows = resolve_limit(source, args.max_rows)
        record = {
            "id": source["id"],
            "status": "skipped",
            "path": str(output_path),
            "sourceUrl": source.get("source_url"),
            "notes": source.get("notes"),
            "maxRows": max_rows,
        }
        try:
            if source["type"] == "text_feed":
                counts = fetch_text_feed(
                    source, output_path, cache_dir, args.force, fetched_at, max_rows
                )
            elif source["type"] == "huggingface":
                counts = fetch_huggingface(source, output_path, fetched_at, max_rows)
            elif source["type"] == "github_zip":
                counts = fetch_github_zip(
                    source, output_path, cache_dir, args.force, fetched_at, max_rows
                )
            elif source["type"] == "archive":
                counts = fetch_archive_source(
                    source, output_path, cache_dir, args.force, fetched_at, max_rows
                )
            elif source["type"] == "archive_kits":
                counts = fetch_dynapd_kits(
                    source, output_path, cache_dir, args.force, fetched_at, max_rows
                )
            elif source["type"] == "threatfox":
                counts = fetch_threatfox(
                    source, output_path, cache_dir, args.force, fetched_at, max_rows
                )
            elif source["type"] == "sslbl":
                counts = fetch_sslbl(
                    source, output_path, cache_dir, args.force, fetched_at, max_rows
                )
            elif source["type"] == "urlscan_export":
                counts = fetch_urlscan_export(source, output_path, fetched_at, max_rows)
            elif source["type"] == "report_patterns":
                counts = fetch_report_patterns(
                    source, output_path, fetched_at, reports_dir, max_rows
                )
            else:
                raise RuntimeError(f"Unknown source type: {source['type']}")
            record["status"] = "ready"
            record["counts"] = counts
        except Exception as exc:
            record["status"] = "skipped"
            record["reason"] = str(exc)
        manifest["sources"].append(record)

    manifest_path = Path(args.manifest)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
