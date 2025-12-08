# WhatsApp Bot Scanner - Comprehensive Security Audit Report

**Date:** December 2024  
**Auditor:** Automated Security Penetration Test Suite  
**Scope:** Main codebase (services/control-plane, services/scan-orchestrator, services/wa-client, packages/shared)  
**Classification:** CONFIDENTIAL

---

## Executive Summary

This comprehensive penetration test and security audit identified **38 security findings** across the WhatsApp Bot Scanner codebase. While no critical vulnerabilities were discovered, **6 high-severity issues** require immediate attention, along with **19 medium-severity** and **5 low-severity** findings.

### Summary of Findings

| Severity    | Count | Description                     |
| ----------- | ----- | ------------------------------- |
| 🔴 Critical | 0     | Immediate exploitation possible |
| 🟠 High     | 6     | Significant security risk       |
| 🟡 Medium   | 19    | Moderate security concern       |
| 🔵 Low      | 5     | Minor security issue            |
| ⚪ Info     | 8     | Best practice observations      |

### Risk Score: **MEDIUM-HIGH**

---

## Table of Contents

1. [High-Severity Vulnerabilities](#high-severity-vulnerabilities)
2. [Medium-Severity Vulnerabilities](#medium-severity-vulnerabilities)
3. [Low-Severity Vulnerabilities](#low-severity-vulnerabilities)
4. [Positive Security Findings](#positive-security-findings)
5. [Remediation Priority Matrix](#remediation-priority-matrix)
6. [Detailed Technical Findings](#detailed-technical-findings)
7. [Recommendations](#recommendations)

---

## High-Severity Vulnerabilities

### 1. Missing Rate Limiting on Control Plane API

**ID:** AUTH-003  
**CVSS Score:** 7.5 (High)  
**CWE:** CWE-307 (Improper Restriction of Excessive Authentication Attempts)  
**OWASP:** A07:2021-Identification and Authentication Failures

**Location:** `services/control-plane/src/index.ts`

**Description:**  
The control-plane Fastify server does not implement rate limiting on authentication endpoints. An attacker could perform unlimited brute-force attempts against the API token without any throttling or lockout mechanism.

**Impact:**

- API token compromise through brute-force attacks
- Denial of service through authentication flooding
- Unauthorized access to administrative functions

**Proof of Concept:**

```bash
# Attacker can attempt unlimited passwords
for token in $(cat wordlist.txt); do
  curl -H "Authorization: Bearer $token" http://target:8080/status
done
```

**Remediation:**

```typescript
import rateLimit from "@fastify/rate-limit";

app.register(rateLimit, {
  max: 10,
  timeWindow: "1 minute",
  keyGenerator: (req) => req.ip,
});
```

---

### 2. CSRF Token Defaults to API Token

**ID:** AUTH-004  
**CVSS Score:** 7.1 (High)  
**CWE:** CWE-352 (Cross-Site Request Forgery)  
**OWASP:** A01:2021-Broken Access Control

**Location:** `packages/shared/src/config.ts:199-201`

**Description:**  
The CSRF protection token defaults to the same value as the API authentication token:

```typescript
get csrfToken(): string {
  return (process.env.CONTROL_PLANE_CSRF_TOKEN || getControlPlaneToken()).trim();
}
```

This completely defeats the purpose of CSRF protection since an attacker who obtains the CSRF token effectively has the API token.

**Impact:**

- CSRF protection is ineffective
- Single point of failure for authentication

**Remediation:**

```typescript
// Generate a separate CSRF token
const csrfSecret = crypto.randomBytes(32).toString('hex');

get csrfToken(): string {
  const configured = process.env.CONTROL_PLANE_CSRF_TOKEN?.trim();
  if (!configured) {
    throw new Error('CONTROL_PLANE_CSRF_TOKEN must be set separately from API token');
  }
  return configured;
}
```

---

### 3. DNS Rebinding Vulnerability

**ID:** SSRF-002  
**CVSS Score:** 7.5 (High)  
**CWE:** CWE-918 (Server-Side Request Forgery)  
**OWASP:** A10:2021-Server-Side Request Forgery

**Location:** `packages/shared/src/ssrf.ts:23-32`

**Description:**  
The SSRF protection performs DNS resolution to check if a hostname resolves to a private IP, but this check is vulnerable to DNS rebinding attacks:

```typescript
export async function isPrivateHostname(hostname: string): Promise<boolean> {
  try {
    const addrs = await dns.lookup(hostname, { all: true, family: 0 });
    return addrs.some((a) => isPrivateIp(a.address));
  } catch {
    return true; // fail closed
  }
}
```

An attacker can configure their DNS server to return a public IP during the security check, then return a private IP (e.g., 127.0.0.1) when the actual HTTP request is made.

**Impact:**

- Access to internal services (Redis, databases, cloud metadata)
- Potential for credential theft via metadata endpoints
- Internal network scanning

**Proof of Concept:**

1. Attacker controls `evil.com` DNS
2. First DNS query (security check): Returns `1.2.3.4` (public)
3. Second DNS query (HTTP request): Returns `169.254.169.254` (AWS metadata)
4. SSRF check passes, but request hits internal service

**Remediation:**

```typescript
import { Resolver } from "node:dns/promises";

async function resolveAndValidate(hostname: string): Promise<string> {
  const resolver = new Resolver();
  const addresses = await resolver.resolve4(hostname);

  // Validate ALL resolved IPs
  for (const ip of addresses) {
    if (isPrivateIp(ip)) {
      throw new Error(`DNS rebinding attempt detected: ${hostname} -> ${ip}`);
    }
  }

  // Return first valid IP to PIN for the request
  return addresses[0];
}

// Use the resolved IP directly in the HTTP request
const pinnedIp = await resolveAndValidate(hostname);
await fetch(`http://${pinnedIp}`, {
  headers: { Host: hostname },
});
```

---

### 4. Session Backups Written with Predictable Names

**ID:** SESSION-003  
**CVSS Score:** 7.2 (High)  
**CWE:** CWE-312 (Cleartext Storage of Sensitive Information)  
**OWASP:** A02:2021-Cryptographic Failures

**Location:** `services/wa-client/src/remoteAuthStore.ts:58-66`

**Description:**  
WhatsApp session credentials are written to filesystem with predictable filenames:

```typescript
async save({ session }: { session: string }): Promise<void> {
  const zipPath = path.resolve(`${session}.zip`);  // Predictable name!
  const contents = await fs.readFile(zipPath);
  // ...
}
```

**Impact:**

- Session hijacking if attacker gains filesystem read access
- Credential theft through path traversal
- WhatsApp account takeover

**Remediation:**

```typescript
import { randomBytes } from 'crypto';
import { chmod, mkdtemp } from 'fs/promises';
import os from 'os';

async save({ session }: { session: string }): Promise<void> {
  // Use secure temporary directory
  const secureDir = await mkdtemp(path.join(os.tmpdir(), 'wa-session-'));
  const randomSuffix = randomBytes(16).toString('hex');
  const zipPath = path.join(secureDir, `${randomSuffix}.zip`);

  // Set restrictive permissions (owner read/write only)
  await chmod(secureDir, 0o700);
  // ...
}
```

---

### 5. Sensitive Configuration Defaults

**ID:** CONFIG-001  
**CVSS Score:** 6.5 (High)  
**CWE:** CWE-1188 (Insecure Default Initialization of Resource)  
**OWASP:** A05:2021-Security Misconfiguration

**Location:** `packages/shared/src/config.ts`

**Description:**  
Multiple security-sensitive configuration values have insecure defaults:

- `WA_AUTH_CLIENT_ID` defaults to `'default'`
- `CONTROL_PLANE_PORT` defaults to `8080`
- Various timeouts may allow prolonged attacks

**Impact:**

- Session prediction attacks
- Accidental exposure of services
- Prolonged attack windows

**Remediation:**

```typescript
function requireEnvInProduction(name: string, defaultValue?: string): string {
  const value = process.env[name] ?? defaultValue;
  if (process.env.NODE_ENV === "production" && !process.env[name]) {
    throw new Error(`${name} must be explicitly configured in production`);
  }
  return value ?? "";
}
```

---

### 6. urlHash Validation Inconsistency

**ID:** PATH-003  
**CVSS Score:** 6.8 (High)  
**CWE:** CWE-20 (Improper Input Validation)  
**OWASP:** A03:2021-Injection

**Location:** `services/control-plane/src/index.ts:245`, `services/scan-orchestrator/src/urlscan-artifacts.ts:54`

**Description:**  
Inconsistent validation between components:

- Control-plane validates urlHash with `/^[a-fA-F0-9]{64}$/` (allows uppercase)
- `sanitizePathComponent()` only allows `[a-zA-Z0-9_-]` (rejects uppercase hex)

This mismatch could cause denial of service or force error handling code paths.

**Impact:**

- Denial of service through malformed inputs
- Potential bypass of security checks
- Application errors in production

**Remediation:**

```typescript
// Normalize all hashes to lowercase immediately
function normalizeUrlHash(hash: string): string {
  if (!/^[a-fA-F0-9]{64}$/.test(hash)) {
    throw new Error("Invalid URL hash format");
  }
  return hash.toLowerCase();
}
```

---

## Medium-Severity Vulnerabilities

### Authentication & Authorization

| ID       | Title                                       | Location                            | CWE     |
| -------- | ------------------------------------------- | ----------------------------------- | ------- |
| AUTH-001 | Non-Constant-Time Token Comparison          | control-plane/src/index.ts:45-56    | CWE-208 |
| AUTH-002 | Non-Constant-Time URLScan Secret Comparison | scan-orchestrator/src/index.ts:1895 | CWE-208 |
| AUTH-005 | Admin Command Bypass via fromMe Flag        | wa-client/src/index.ts:3970-3971    | CWE-863 |

### Server-Side Request Forgery

| ID       | Title                                    | Location                                         | CWE     |
| -------- | ---------------------------------------- | ------------------------------------------------ | ------- |
| SSRF-003 | URL Shortener Resolution May Bypass SSRF | packages/shared/src/url-shortener.ts             | CWE-918 |
| SSRF-004 | URLScan Artifact URLs Not Validated      | scan-orchestrator/src/urlscan-artifacts.ts:82-93 | CWE-918 |

### Input Validation

| ID        | Title                                       | Location                             | CWE    |
| --------- | ------------------------------------------- | ------------------------------------ | ------ |
| INPUT-003 | URL Validation Missing Data/JavaScript URLs | packages/shared/src/url.ts           | CWE-20 |
| INPUT-004 | Insufficient ChatId Validation              | packages/shared/src/schemas.ts:33-35 | CWE-20 |
| SQLI-002  | Dynamic Column Name in SQL Query            | control-plane/src/index.ts:260       | CWE-89 |

### Cryptography

| ID         | Title                                         | Location                                      | CWE     |
| ---------- | --------------------------------------------- | --------------------------------------------- | ------- |
| CRYPTO-002 | Custom Key Derivation Instead of Standard KDF | wa-client/src/crypto/dataKeyProvider.ts:24-26 | CWE-916 |
| CRYPTO-004 | Encryption Materials Cached in Memory         | wa-client/src/crypto/dataKeyProvider.ts:99    | CWE-316 |

### Session Management

| ID          | Title                                    | Location                                       | CWE     |
| ----------- | ---------------------------------------- | ---------------------------------------------- | ------- |
| SESSION-001 | WhatsApp Session Data Stored Unencrypted | wa-client/src/auth/baileys-auth-store.ts:67-73 | CWE-312 |

### Information Disclosure

| ID       | Title                                | Location                         | CWE     |
| -------- | ------------------------------------ | -------------------------------- | ------- |
| INFO-002 | SQL Queries Logged with Parameters   | services/\*/src/database.ts      | CWE-532 |
| INFO-004 | Metrics Endpoint Publicly Accessible | control-plane/src/index.ts:82-85 | CWE-200 |

### Path Traversal

| ID       | Title                                            | Location                           | CWE    |
| -------- | ------------------------------------------------ | ---------------------------------- | ------ |
| PATH-002 | Database-Stored Path Without Realpath Validation | control-plane/src/index.ts:267-295 | CWE-22 |

### Denial of Service

| ID      | Title                                  | Location                         | CWE     |
| ------- | -------------------------------------- | -------------------------------- | ------- |
| DOS-002 | URL Expansion Without Body Size Limits | packages/shared/src/url.ts:47-67 | CWE-400 |
| DOS-003 | No Queue Depth Limits                  | scan-orchestrator/src/index.ts   | CWE-400 |

### Configuration

| ID         | Title                                                 | Location                              | CWE      |
| ---------- | ----------------------------------------------------- | ------------------------------------- | -------- |
| CONFIG-002 | Environment Variable Secrets Not Validated at Startup | packages/shared/src/config.ts         | CWE-1188 |
| CONFIG-003 | Control Plane Listens on All Interfaces               | control-plane/src/index.ts:331        | CWE-668  |
| DEP-002    | Puppeteer Running with --no-sandbox                   | packages/shared/src/config.ts:280-310 | CWE-265  |

---

## Low-Severity Vulnerabilities

| ID          | Title                                         | Location                                         | CWE      |
| ----------- | --------------------------------------------- | ------------------------------------------------ | -------- |
| PATH-001    | Path Traversal Mitigation Inconsistent        | scan-orchestrator/src/urlscan-artifacts.ts:52-77 | CWE-22   |
| INPUT-002   | Phone Number Validation Too Permissive        | packages/shared/src/schemas.ts:48                | CWE-20   |
| SESSION-002 | Fixed Client ID May Enable Session Prediction | packages/shared/src/config.ts:220                | CWE-384  |
| INFO-003    | Detailed Error Messages in API Responses      | control-plane/src/index.ts:107-109               | CWE-209  |
| DOS-004     | URL Extraction Regex ReDoS Potential          | packages/shared/src/url.ts:12                    | CWE-1333 |

---

## Positive Security Findings

The audit identified several well-implemented security measures:

### ✅ Parameterized SQL Queries

The codebase consistently uses parameterized queries with better-sqlite3, preventing SQL injection in most cases.

### ✅ SSRF Protection Framework

Basic SSRF protection is implemented with `isPrivateHostname()` and `isPrivateIp()` checks, though improvements are recommended.

### ✅ Strong Encryption for Sessions

The `secureEnvelope.ts` implements AES-256-GCM with proper IV generation, HMAC-SHA256 authentication, and constant-time comparison.

### ✅ Zod Schema Validation

Input validation uses Zod schemas providing type-safe validation at API boundaries.

### ✅ Rate Limiting for WhatsApp Operations

Multiple rate limiters protect against abuse: globalLimiter, groupLimiter, groupHourlyLimiter, governanceLimiter.

### ✅ Phone Number Masking in Logs

The `maskPhone` function properly redacts sensitive information.

### ✅ Package Security Overrides

The package.json includes overrides for known vulnerable packages (tar-fs, tmp, tough-cookie, ws, form-data, glob).

### ✅ Fail-Closed DNS Resolution

The SSRF check returns `true` (blocked) when DNS lookup fails, preventing bypass through DNS errors.

---

## Remediation Priority Matrix

### Immediate (0-7 days)

1. **AUTH-003**: Implement rate limiting on control-plane
2. **AUTH-004**: Generate separate CSRF token
3. **SESSION-003**: Secure session backup file handling
4. **CONFIG-001**: Require explicit configuration in production

### Short-term (7-30 days)

5. **SSRF-002**: Implement DNS pinning for SSRF protection
6. **PATH-003**: Normalize URL hash validation
7. **AUTH-001/AUTH-002**: Use `crypto.timingSafeEqual()` for all comparisons
8. **SESSION-001**: Encrypt Baileys auth state in Redis
9. **INFO-004**: Require authentication for /metrics endpoint

### Medium-term (30-90 days)

10. **CRYPTO-002**: Replace custom KDF with HKDF
11. **INPUT-003/INPUT-004**: Strengthen input validation schemas
12. **DOS-002/DOS-003**: Implement body size and queue depth limits
13. **SSRF-003/SSRF-004**: Validate all redirect chains and artifact URLs
14. **PATH-002**: Use `fs.realpath()` for symlink protection

### Long-term (90+ days)

15. **DEP-002**: Investigate Puppeteer sandboxing alternatives
16. **DOS-004**: Review regex patterns for ReDoS
17. Implement comprehensive security testing in CI/CD

---

## Detailed Technical Findings

### Timing Attack Vulnerability Details

The token comparison in `createAuthHook`:

```typescript
// VULNERABLE - timing attack possible
if (token !== expectedToken) {
  reply.code(401).send({ error: "unauthorized" });
  return;
}
```

**Attack Vector:**

1. Attacker measures response time for different token prefixes
2. Correct prefix characters take slightly longer to compare
3. Through statistical analysis, token can be recovered character-by-character

**Secure Implementation:**

```typescript
import { timingSafeEqual, createHash } from "crypto";

function secureCompare(a: string, b: string): boolean {
  // Hash both to ensure equal length
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}
```

### SQL Injection Risk Analysis

The dynamic column selection in artifact endpoint:

```typescript
const column =
  type === "screenshot" ? "urlscan_screenshot_path" : "urlscan_dom_path";

const { rows } = await dbClient.query(
  `SELECT ${column} FROM scans WHERE url_hash=? LIMIT 1`,
  [hash],
);
```

While currently protected by type validation, this pattern is fragile. **Recommended approach:**

```typescript
// Use separate queries instead of dynamic columns
const queries = {
  screenshot:
    "SELECT urlscan_screenshot_path AS path FROM scans WHERE url_hash=? LIMIT 1",
  dom: "SELECT urlscan_dom_path AS path FROM scans WHERE url_hash=? LIMIT 1",
} as const;

const { rows } = await dbClient.query(queries[type], [hash]);
```

---

## Recommendations

### Architecture Improvements

1. **Implement Defense in Depth**
   - Add WAF rules for common attack patterns
   - Deploy network segmentation between services
   - Use mutual TLS for inter-service communication

2. **Enhanced Monitoring**
   - Alert on authentication failures exceeding threshold
   - Monitor for DNS rebinding patterns
   - Track queue depth metrics for anomaly detection

3. **Security Testing Integration**
   - Add SAST (Static Application Security Testing) to CI pipeline
   - Implement DAST (Dynamic Application Security Testing) for staging
   - Regular dependency vulnerability scanning

### Operational Security

1. **Secrets Management**
   - Migrate to dedicated secrets manager (Vault, AWS Secrets Manager)
   - Implement secret rotation procedures
   - Audit secret access patterns

2. **Logging & Audit**
   - Implement structured security event logging
   - Set up centralized log aggregation with alerting
   - Redact sensitive data before logging

3. **Incident Response**
   - Document incident response procedures
   - Establish communication channels for security issues
   - Regular security drills and tabletop exercises

---

## Testing Methodology

This audit employed the following testing methods:

1. **Static Code Analysis**
   - Manual source code review
   - Pattern matching for vulnerability signatures
   - Data flow analysis

2. **Dependency Analysis**
   - npm audit for known vulnerabilities
   - detect-secrets for hardcoded credentials
   - retire.js for outdated libraries

3. **Configuration Review**
   - Environment variable analysis
   - Default configuration assessment
   - Secret handling evaluation

4. **Architecture Analysis**
   - Authentication flow review
   - Authorization boundary assessment
   - Data encryption audit

---

## Appendix A: Tools Used

- **bandit** - Python security linter
- **detect-secrets** - Secret detection in code
- **retire.js** - Vulnerable JavaScript library detection
- **npm audit** - Node.js dependency vulnerability scanner
- **Custom TypeScript security scanner** - Pattern-based vulnerability detection

---

## Appendix B: References

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

## Disclaimer

This security audit report is provided as-is and represents findings at a specific point in time. Security is an ongoing process, and new vulnerabilities may be discovered after this audit. Regular security assessments are recommended.

---

**Report Generated:** December 2024  
**Next Audit Recommended:** March 2025
