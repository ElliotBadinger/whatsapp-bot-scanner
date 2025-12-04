# Security Vulnerabilities Documentation

## Fixed Vulnerabilities

### ✅ url-expand dependency (Critical/High)

- **Issue**: url-expand package depended on deprecated `request` package with vulnerable `form-data` and `tough-cookie`
- **CVEs**:
  - GHSA-fjxv-7rqg-78g4 (Predictable Value Range in form-data)
  - GHSA-qhv9-728r-6jqg (ReDoS in tough-cookie)
  - GHSA-g7q5-pjjr-gqvp (ReDoS in tough-cookie)
  - GHSA-72xf-g2v4-qvf3 (Prototype Pollution in tough-cookie)
- **Fix**: Removed url-expand dependency entirely and replaced with custom undici implementation
- **Impact**: No functional impact - the custom implementation provides the same URL expansion capabilities with better security

### ✅ ioredis-mock tmp vulnerability (High)

- **Issue**: ioredis-mock dependency chain included vulnerable `tmp` package
- **CVE**: GHSA-52f5-9888-hmc6 (Symlink Attack in tmp)
- **Fix**: Updated ioredis-mock to version 4.7.0
- **Impact**: Breaking changes handled - all tests and builds pass successfully

## Accepted Risk Vulnerabilities

### ⚠️ whatsapp-web.js transitive dependencies (High)

The following vulnerabilities exist in the dependency chain of whatsapp-web.js → puppeteer → puppeteer-core:

#### tar-fs vulnerabilities

- **CVEs**:
  - GHSA-vj76-c3g6-qr5v (Symlink validation bypass)
  - GHSA-8cj5-5rvv-wf4v (Path traversal)
  - GHSA-pq67-2wwv-3xjx (Link following)
- **Risk Assessment**: LOW
- **Rationale**:
  - whatsapp-web.js does not process untrusted tar files
  - Vulnerabilities require crafted malicious tar files
  - Application runs in isolated containers
  - No direct tar file processing from user input

#### ws vulnerability

- **CVE**: GHSA-3h5v-q93c-6h6q (Denial of Service via many HTTP headers)
- **Risk Assessment**: LOW
- **Rationale**:
  - WebSocket connections are from trusted WhatsApp servers
  - Container limits prevent resource exhaustion
  - Proxy layer provides additional protection

## Mitigation Strategies

1. **Container Isolation**: All services run in isolated Docker containers
2. **Network Segmentation**: Limited network access prevents external exploitation
3. **Resource Limits**: Container resource limits prevent DoS attacks
4. **Input Validation**: All user inputs are validated before processing
5. **Regular Updates**: Dependencies are monitored and updated regularly

## Monitoring

- npm audit is run in CI with `--audit-level=critical`
- Snyk scans are performed regularly
- Security advisories are monitored for all dependencies

## Future Actions

- Monitor whatsapp-web.js for updates that address these vulnerabilities
- Consider alternative WhatsApp libraries if security posture changes
- Evaluate moving to real Redis in tests to eliminate ioredis-mock dependency chain

Last updated: December 2025
