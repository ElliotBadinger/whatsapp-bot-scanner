#!/usr/bin/env python3
import argparse
import json
import random
import string
from datetime import datetime, timezone


SHORTENERS = [
    "bit.ly",
    "t.co",
    "tinyurl.com",
    "cutt.ly",
    "rb.gy",
    "is.gd",
    "lnkd.in",
    "s.id",
    "shorturl.at",
    "tiny.cc",
]

CLOUD_HOSTS = [
    "drive.google.com",
    "docs.google.com",
    "storage.googleapis.com",
    "s3.amazonaws.com",
    "pastebin.com",
    "github.io",
    "gitbook.io",
    "vercel.app",
    "netlify.app",
    "firebaseapp.com",
    "sites.google.com",
    "dropbox.com",
]

BRANDS = [
    "paypal",
    "microsoft",
    "apple",
    "google",
    "facebook",
    "instagram",
    "whatsapp",
    "netflix",
    "amazon",
    "dhl",
    "fedex",
    "usps",
]

MALICIOUS_TLDS = ["com", "net", "xyz", "top", "shop", "site", "live", "info"]
BENIGN_TLDS = ["com", "org", "net", "io", "app", "edu"]
OPEN_REDIRECT_PARAMS = ["redirect", "next", "url", "continue", "return"]


def token(length: int = 6) -> str:
    alphabet = string.ascii_lowercase + string.digits
    return "".join(random.choice(alphabet) for _ in range(length))


def brand_host(brand: str) -> str:
    tld = random.choice(MALICIOUS_TLDS)
    slug = f"{brand}-{random.choice(['secure', 'verify', 'login', 'account'])}"
    return f"{slug}.{tld}"


def benign_host() -> str:
    tld = random.choice(BENIGN_TLDS)
    return f"{random.choice(['docs', 'help', 'news', 'portal'])}.{token(4)}.{tld}"


def short_url() -> str:
    return f"https://{random.choice(SHORTENERS)}/{token(7)}"


def open_redirect_url(host: str, target: str) -> str:
    key = random.choice(OPEN_REDIRECT_PARAMS)
    return f"https://{host}/redirect?{key}={target}"


def cloud_target() -> str:
    host = random.choice(CLOUD_HOSTS)
    return f"https://{host}/{token(10)}"


def malicious_target() -> str:
    brand = random.choice(BRANDS)
    host = brand_host(brand)
    return f"https://{host}/{random.choice(['login', 'signin', 'secure'])}?session={token(10)}"


def benign_target() -> str:
    host = benign_host()
    return f"https://{host}/{random.choice(['article', 'support', 'docs'])}/{token(8)}"


def build_entry(label: str) -> dict:
    input_url = short_url()
    use_requests = random.random() < 0.35
    chain = [input_url]

    if label == "malicious":
        redirector = benign_host()
        target = malicious_target()
        chain.append(open_redirect_url(redirector, target))
        chain.append(target)
    elif label == "suspicious":
        redirector = benign_host()
        target = cloud_target()
        chain.append(open_redirect_url(redirector, target))
        chain.append(target)
    else:
        target = benign_target()
        chain.append(target)

    redirects = [{"url": url} for url in chain]
    payload = {
        "task": {"url": input_url},
        "page": {"url": chain[-1]},
        "data": {"redirects": redirects} if not use_requests else {"requests": redirects},
    }

    if label == "malicious":
        payload[random.choice(["classification", "result"])] = random.choice(
            ["malicious", "phishing"]
        )
    elif label == "suspicious":
        payload["verdicts"] = {"overall": {"label": "suspicious"}}
    else:
        payload["classification"] = "benign"

    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate urlscan-style fixtures.")
    parser.add_argument("--out", default="storage/robustness/urlscan-export.jsonl")
    parser.add_argument("--count", type=int, default=500)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    random.seed(args.seed)
    out_path = args.out
    now = datetime.now(timezone.utc).isoformat()

    labels = []
    for _ in range(args.count):
        roll = random.random()
        if roll < 0.6:
            labels.append("malicious")
        elif roll < 0.9:
            labels.append("suspicious")
        else:
            labels.append("benign")

    with open(out_path, "w", encoding="utf-8") as handle:
        for label in labels:
            entry = build_entry(label)
            entry["generated_at"] = now
            handle.write(json.dumps(entry, ensure_ascii=True) + "\n")


if __name__ == "__main__":
    main()
