# Local SOTA Research Report: Reducing API Dependency

**Date:** 2025-11-27
**Focus:** Innovative Local Tools for Threat Detection (No LLMs/Vision)

## Executive Summary

To drastically reduce API costs and latency, we propose a **"Local-First" Filter Pipeline**. By implementing state-of-the-art (SOTA) local data structures and lightweight machine learning models, we can handle **80-90% of traffic locally**, reserving expensive API calls (VirusTotal, GSB) only for truly unknown/suspicious edge cases.

---

## 1. The "Local-First" Pipeline Architecture

Instead of sending every URL to the cloud, traffic flows through these local gates:

1.  **Gate 1: The Iron Dome (Bloom Filters)** - _0ms latency, 0 cost_
    - Check URL against a massive, compressed local dataset of known bad URLs.
2.  **Gate 2: The ML Sentinel (Static Analysis)** - _~50ms latency, 0 cost_
    - Extract lexical features (length, entropy, weird chars) and run a pre-trained local model.
3.  **Gate 3: The Content Inspector (Safe Fetch)** - _~500ms latency, 0 cost_
    - Fetch page HTML/headers (headless & sandboxed) and scan with YARA rules.
4.  **Gate 4: Cloud API (Fallback)** - _High latency, $$ cost_
    - Only if Gates 1-3 are inconclusive.

---

## 2. Recommended SOTA Local Tools

### A. Massive Blocklist Management (Gate 1)

_Problem: Checking millions of bad URLs locally is slow and memory-hungry._

**Solution: Rust-backed Bloom Filters**

- **Tool:** **`rbloom`** (Python wrapper for Rust implementation)
  - **Why:** It's significantly faster than pure Python implementations and memory-efficient. You can load millions of URLs (from OpenPhish, PhishTank, URLHaus) into a few MBs of RAM.
  - **Repo:** `KenanHanke/rbloom`
  - **Strategy:** Download daily feeds from OpenPhish/URLHaus, compile into a Bloom filter. If `url in filter` -> BLOCK immediately.

### B. Malicious URL Detection - Machine Learning (Gate 2)

*Problem: Detecting *new* phishing URLs that aren't on any list yet.*

**Solution 1: FastText + BiLSTM (Deep Learning)**

- **Tool:** **`PhishDetect`** (or custom implementation based on it)
  - **Why:** Uses character-level embeddings to understand the "structure" of a phishing URL (e.g., `g00gle.com-secure-login.php`). FastText is incredibly efficient for text classification.
  - **Performance:** Can achieve >98% accuracy with <100ms inference on CPU.

**Solution 2: Lightweight Lexical Analysis (Random Forest)**

- **Tool:** **`scikit-learn`** + **`tldextract`**
  - **Why:** "Old reliable" but SOTA when optimized. Extract ~20 features (length, dot count, subdomain depth, entropy, presence of IP).
  - **Repo:** `pirocheto/phishing-url-detection` (Good reference implementation)
  - **Strategy:** Train a small Random Forest model on a merged dataset (PhishTank + benign Alexa Top 1M). Export with `joblib`. Run locally.

### C. File & Content Analysis (Gate 3)

_Problem: Scanning files (PDFs) or page content without uploading to VirusTotal._

**Solution 1: PDF Forensics**

- **Tool:** **`pdfid`** & **`peepdf`**
  - **Why:** Analyzes PDF structure for Javascript, OpenActions, and obfuscation _without_ executing the file.
  - **Tool:** **`quicksand`**
  - **Why:** Specialized in stripping active content and exploits from documents.

**Solution 2: YARA Rules**

- **Tool:** **`yara-python`**
  - **Why:** The industry standard for pattern matching.
  - **Strategy:** Maintain a local set of YARA rules for HTML phishing signatures (e.g., "hidden iframe", "fake login form", "obfuscated JS"). Scan the HTML body of fetched URLs.

---

## 3. Implementation Roadmap

### Phase 1: The Blocklist Engine (Day 1-2)

1.  Implement `rbloom`.
2.  Create a cron job to fetch free feeds:
    - URLHaus (Malware)
    - OpenPhish (Phishing - Free feed)
    - PhishTank (Phishing)
3.  Build the "Iron Dome" check.

### Phase 2: The ML Classifier (Day 3-4)

1.  Gather datasets (Benign: Tranco/Alexa list, Malicious: Above feeds).
2.  Train a `RandomForest` model (easier to start than Deep Learning) on lexical features.
3.  Deploy as a microservice or Python function.

### Phase 3: Integration

1.  Modify `ScanOrchestrator`.
2.  Logic:

    ```python
    if bloom_filter.check(url):
        return "MALICIOUS (Known)"

    score = ml_model.predict(url)
    if score > 0.9:
        return "MALICIOUS (High Confidence ML)"

    # Only now do we pay for API
    return virus_total.scan(url)
    ```

## 4. Expected Impact

- **API Cost Reduction:** ~90% (assuming most traffic is either obviously safe or known bad).
- **Latency:** "Known bad" detection drops from ~2s to ~2ms.
- **Privacy:** User URLs stay local unless necessary.
