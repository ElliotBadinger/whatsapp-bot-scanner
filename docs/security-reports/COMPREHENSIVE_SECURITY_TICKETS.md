# Comprehensive Security Tickets Document

**Generated:** 2025-11-27T22:57:21.961Z
**Total Findings:** 1712 (across 570 rules)

This document aggregates all findings from DeepSource and SonarQube, organized by severity.

## 📊 Executive Summary

### By Source
| Source | Findings |
|--------|----------|
| DeepSource | 1216 |
| SonarQube | 496 |

### By Severity
| Severity | Findings |
|----------|----------|
| BLOCKER | 4 |
| CRITICAL | 231 |
| LOW | 48 |
| MAJOR | 523 |
| MEDIUM | 16 |
| MINOR | 890 |

### By Category
| Category | Findings |
|----------|----------|
| ANTI_PATTERN | 640 |
| BUG_RISK | 465 |
| Bug | 9 |
| Code Smell | 415 |
| PERFORMANCE | 99 |
| SECURITY | 12 |
| Security Hotspot | 64 |
| Vulnerability | 8 |

---

## BLOCKER Priority Issues (4)

### [SonarQube] Make sure this PostgreSQL database password gets changed and removed from the code. (secrets:S6698)

**Category:** Vulnerability
**Description:**
Make sure this PostgreSQL database password gets changed and removed from the code.

**Total Locations:** 4

**Locations:**
- [ ] `docker-compose.yml:43` - Make sure this PostgreSQL database password gets changed and removed from the code.
- [ ] `docker-compose.yml:65` - Make sure this PostgreSQL database password gets changed and removed from the code.
- [ ] `docker-compose.yml:95` - Make sure this PostgreSQL database password gets changed and removed from the code.
- [ ] `docker-compose.yml:120` - Make sure this PostgreSQL database password gets changed and removed from the code.

---

## CRITICAL Priority Issues (59)

### [DeepSource] Certificate validation is disabled in TLS connection (JS-S1017)

**Category:** SECURITY
**Description:**
Certificate validation is an important aspect of Transport Layer Security (TLS) connections as it helps to ensure the authenticity and integrity of the data being transmitted.
Disabling certificate validation can lead to several security risks, including Man-in-the-Middle Attacks.
Without certificate validation, it is possible for an attacker to intercept the communication and present a fake certificate to the client.
This allows the attacker to read and potentially modify the data being transmitted.

Setting the `rejectUnauthorized` option to `false` is one such way of disabling certificate validation when initiating a TLS connection using `http`, `https` or `tls` modules.
By default, `rejectUnauthorized` is always `true`.

### Bad Practice

```js
import tls from 'tls'
tls.connect(
  {
    rejectUnauthorized: false
  },
  response => {}
)
```

### Recommended

```js
import tls from 'tls'
tls.connect(
  {
    rejectUnauthorized: true // alternatively: Do not set `rejectUnauthorized`, as it is configured correctly by default.
  },
  response => {}
)
```

## References
- [OWASP A07:2021 - Identification and Authentication Failures](https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/)
- [CWE-295: Improper Certificate Validation](https://cwe.mitre.org/data/definitions/295.html)

**Autofix Available:** Yes

**Total Locations:** 1

**Locations:**
- [ ] `packages/shared/src/reputation/certificate-intelligence.ts:50` - The value of `rejectUnauthorized` should not be set to `false`

---

### [DeepSource] Detected usage of the `any` type (JS-0323)

**Category:** ANTI_PATTERN
**Description:**
The `any` type can sometimes leak into your codebase. TypeScript compiler skips the type checking of the `any` typed variables, so it creates a potential safety hole, and source of bugs in your codebase. We recommend using `unknown` or `never` type variable.

<!--more-->

In TypeScript, every type is assignable to `any`. This makes `any` a top type (also known as a universal supertype) of the type system.
The `any` type is essentially an escape hatch from the type system. As developers, this gives us a ton of freedom: TypeScript lets us perform any operation we want on values of type `any` without having to perform any checking beforehand.
The developers should not assign `any` typed value to variables and properties, which can be hard to pick up on, especially from the external library; instead, developers can use the `never` or `unknown` type variable.

### Bad Practice
```js
const age: any = 'seventeen';

const ages: any[] = ['seventeen'];

const ages: Array<any> = ['seventeen'];

function greet(): any {}

function greet(): any[] {}

function greet(): Array<any> {}

function greet(): Array<Array<any>> {}

function greet(param: Array<any>): string {}

function greet(param: Array<any>): Array<any> {}
```

### Recommended
```ts
const age: number = 17;

const ages: number[] = [17];

const ages: Array<number> = [17];

function greet(): string {}

function greet(): string[] {}

function greet(): Array<string> {}

function greet(): Array<Array<string>> {}

function greet(param: Array<string>): string {}

function greet(param: Array<string>): Array<string> {}
```

**Total Locations:** 146

**Breakdown by Directory:**

#### 📂 packages/shared/__tests__/reputation (1)
- [ ] `packages/shared/__tests__/reputation/local-threat-db.test.ts:5` - Unexpected any. Specify a different type

#### 📂 packages/shared/src/__tests__ (6)
- [ ] `packages/shared/src/__tests__/url.test.ts:124` - Unexpected any. Specify a different type
- [ ] `packages/shared/src/__tests__/url.test.ts:56` - Unexpected any. Specify a different type
- [ ] `packages/shared/src/__tests__/url.test.ts:48` - Unexpected any. Specify a different type
- [ ] `packages/shared/src/__tests__/ssrf.test.ts:9` - Unexpected any. Specify a different type
- [ ] `packages/shared/src/__tests__/circuit-breaker.test.ts:103` - Unexpected any. Specify a different type
- [ ] `packages/shared/src/__tests__/circuit-breaker.test.ts:86` - Unexpected any. Specify a different type

#### 📂 services/control-plane/src (1)
- [ ] `services/control-plane/src/database.ts:16` - Unexpected any. Specify a different type

#### 📂 services/control-plane/src/__tests__ (10)
- [ ] `services/control-plane/src/__tests__/routes.test.ts:193` - Unexpected any. Specify a different type
- [ ] `services/control-plane/src/__tests__/routes.test.ts:173` - Unexpected any. Specify a different type
- [ ] `services/control-plane/src/__tests__/routes.test.ts:171` - Unexpected any. Specify a different type
- [ ] `services/control-plane/src/__tests__/routes.test.ts:169` - Unexpected any. Specify a different type
- [ ] `services/control-plane/src/__tests__/routes.test.ts:111` - Unexpected any. Specify a different type
- [ ] `services/control-plane/src/__tests__/routes.test.ts:58` - Unexpected any. Specify a different type
- [ ] `services/control-plane/src/__tests__/routes.test.ts:57` - Unexpected any. Specify a different type
- [ ] `services/control-plane/src/__tests__/routes.test.ts:56` - Unexpected any. Specify a different type
- [ ] `services/control-plane/src/__tests__/routes.test.ts:39` - Unexpected any. Specify a different type
- [ ] `services/control-plane/src/__tests__/routes.test.ts:39` - Unexpected any. Specify a different type

#### 📂 services/scan-orchestrator/src (1)
- [ ] `services/scan-orchestrator/src/database.ts:16` - Unexpected any. Specify a different type

#### 📂 services/wa-client/__tests__/functional (18)
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:205` - Unexpected any. Specify a different type
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:204` - Unexpected any. Specify a different type
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:202` - Unexpected any. Specify a different type
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:196` - Unexpected any. Specify a different type
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:193` - Unexpected any. Specify a different type
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:180` - Unexpected any. Specify a different type
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:159` - Unexpected any. Specify a different type
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:158` - Unexpected any. Specify a different type
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:156` - Unexpected any. Specify a different type
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:128` - Unexpected any. Specify a different type
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:127` - Unexpected any. Specify a different type
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:125` - Unexpected any. Specify a different type
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:118` - Unexpected any. Specify a different type
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:115` - Unexpected any. Specify a different type
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:96` - Unexpected any. Specify a different type
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:46` - Unexpected any. Specify a different type
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:41` - Unexpected any. Specify a different type
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:39` - Unexpected any. Specify a different type

#### 📂 services/wa-client/src/__tests__ (32)
- [ ] `services/wa-client/src/__tests__/sessionCleanup.test.ts:65` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/sessionCleanup.test.ts:30` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/session-cleanup.test.ts:11` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/selfRevoke.test.ts:95` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/selfRevoke.test.ts:90` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/selfRevoke.test.ts:74` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/selfRevoke.test.ts:68` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/selfRevoke.test.ts:65` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/selfRevoke.test.ts:53` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/selfRevoke.test.ts:47` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/selfRevoke.test.ts:33` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/selfRevoke.test.ts:28` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/message-store.test.ts:6` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/message-revoke.test.ts:38` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/message-revoke.test.ts:32` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/message-revoke.test.ts:24` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/message-revoke.test.ts:18` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/message-revoke.test.ts:10` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/commands.test.ts:156` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/commands.test.ts:131` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/commands.test.ts:106` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/commands.test.ts:73` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/commands.test.ts:46` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/commands.test.ts:21` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/commands.test.ts:21` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/chatLookup.test.ts:66` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/chatLookup.test.ts:63` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/chatLookup.test.ts:50` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/chatLookup.test.ts:47` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/chatLookup.test.ts:29` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/chatLookup.test.ts:26` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/chat-resolver.test.ts:5` - Unexpected any. Specify a different type

#### 📂 services/wa-client/src/__tests__/functional (7)
- [ ] `services/wa-client/src/__tests__/functional/session-flow.test.ts:138` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/functional/session-flow.test.ts:134` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/functional/session-flow.test.ts:120` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/functional/session-flow.test.ts:90` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/functional/session-flow.test.ts:86` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/functional/session-flow.test.ts:63` - Unexpected any. Specify a different type
- [ ] `services/wa-client/src/__tests__/functional/session-flow.test.ts:19` - Unexpected any. Specify a different type

#### 📂 tests/e2e (24)
- [ ] `tests/e2e/control-plane.test.ts:177` - Unexpected any. Specify a different type
- [ ] `tests/e2e/control-plane.test.ts:177` - Unexpected any. Specify a different type
- [ ] `tests/e2e/control-plane.test.ts:175` - Unexpected any. Specify a different type
- [ ] `tests/e2e/control-plane.test.ts:162` - Unexpected any. Specify a different type
- [ ] `tests/e2e/control-plane.test.ts:161` - Unexpected any. Specify a different type
- [ ] `tests/e2e/control-plane.test.ts:158` - Unexpected any. Specify a different type
- [ ] `tests/e2e/control-plane.test.ts:138` - Unexpected any. Specify a different type
- [ ] `tests/e2e/control-plane.test.ts:137` - Unexpected any. Specify a different type
- [ ] `tests/e2e/control-plane.test.ts:126` - Unexpected any. Specify a different type
- [ ] `tests/e2e/control-plane.test.ts:99` - Unexpected any. Specify a different type
- [ ] `tests/e2e/control-plane.test.ts:89` - Unexpected any. Specify a different type
- [ ] `tests/e2e/control-plane.test.ts:88` - Unexpected any. Specify a different type
- [ ] `tests/e2e/control-plane.test.ts:53` - Unexpected any. Specify a different type
- [ ] `tests/e2e/control-plane.test.ts:52` - Unexpected any. Specify a different type
- [ ] `tests/e2e/control-plane.test.ts:36` - Unexpected any. Specify a different type
- [ ] `tests/e2e/control-plane.test.ts:24` - Unexpected any. Specify a different type
- [ ] `tests/e2e/control-plane.test.ts:24` - Unexpected any. Specify a different type
- [ ] `tests/e2e/admin-commands.test.ts:71` - Unexpected any. Specify a different type
- [ ] `tests/e2e/admin-commands.test.ts:64` - Unexpected any. Specify a different type
- [ ] `tests/e2e/admin-commands.test.ts:57` - Unexpected any. Specify a different type
- [ ] `tests/e2e/admin-commands.test.ts:50` - Unexpected any. Specify a different type
- [ ] `tests/e2e/admin-commands.test.ts:48` - Unexpected any. Specify a different type
- [ ] `tests/e2e/admin-commands.test.ts:21` - Unexpected any. Specify a different type
- [ ] `tests/e2e/admin-commands.test.ts:14` - Unexpected any. Specify a different type

#### 📂 tests/integration (41)
- [ ] `tests/integration/whois-quota.test.ts:26` - Unexpected any. Specify a different type
- [ ] `tests/integration/vt-throttling.test.ts:67` - Unexpected any. Specify a different type
- [ ] `tests/integration/vt-throttling.test.ts:45` - Unexpected any. Specify a different type
- [ ] `tests/integration/vt-throttling.test.ts:40` - Unexpected any. Specify a different type
- [ ] `tests/integration/vt-throttling.test.ts:16` - Unexpected any. Specify a different type
- [ ] `tests/integration/vt-throttling.test.ts:15` - Unexpected any. Specify a different type
- [ ] `tests/integration/vt-rate-limit.test.ts:60` - Unexpected any. Specify a different type
- [ ] `tests/integration/vt-rate-limit.test.ts:36` - Unexpected any. Specify a different type
- [ ] `tests/integration/vt-rate-limit.test.ts:31` - Unexpected any. Specify a different type
- [ ] `tests/integration/vt-rate-limit.test.ts:24` - Unexpected any. Specify a different type
- [ ] `tests/integration/shortener-fallback.test.ts:224` - Unexpected any. Specify a different type
- [ ] `tests/integration/shortener-fallback.test.ts:220` - Unexpected any. Specify a different type
- [ ] `tests/integration/shortener-fallback.test.ts:203` - Unexpected any. Specify a different type
- [ ] `tests/integration/shortener-fallback.test.ts:202` - Unexpected any. Specify a different type
- [ ] `tests/integration/shortener-fallback.test.ts:201` - Unexpected any. Specify a different type
- [ ] `tests/integration/shortener-fallback.test.ts:199` - Unexpected any. Specify a different type
- [ ] `tests/integration/shortener-fallback.test.ts:171` - Unexpected any. Specify a different type
- [ ] `tests/integration/shortener-fallback.test.ts:169` - Unexpected any. Specify a different type
- [ ] `tests/integration/shortener-fallback.test.ts:168` - Unexpected any. Specify a different type
- [ ] `tests/integration/shortener-fallback.test.ts:166` - Unexpected any. Specify a different type
- [ ] `tests/integration/shortener-fallback.test.ts:140` - Unexpected any. Specify a different type
- [ ] `tests/integration/shortener-fallback.test.ts:138` - Unexpected any. Specify a different type
- [ ] `tests/integration/shortener-fallback.test.ts:137` - Unexpected any. Specify a different type
- [ ] `tests/integration/shortener-fallback.test.ts:136` - Unexpected any. Specify a different type
- [ ] `tests/integration/shortener-fallback.test.ts:134` - Unexpected any. Specify a different type
- [ ] `tests/integration/shortener-fallback.test.ts:108` - Unexpected any. Specify a different type
- [ ] `tests/integration/shortener-fallback.test.ts:107` - Unexpected any. Specify a different type
- [ ] `tests/integration/shortener-fallback.test.ts:89` - Unexpected any. Specify a different type
- [ ] `tests/integration/shortener-fallback.test.ts:88` - Unexpected any. Specify a different type
- [ ] `tests/integration/shortener-fallback.test.ts:71` - Unexpected any. Specify a different type
- [ ] `tests/integration/shortener-fallback.test.ts:70` - Unexpected any. Specify a different type
- [ ] `tests/integration/redis-cache.test.ts:77` - Unexpected any. Specify a different type
- [ ] `tests/integration/redis-cache.test.ts:56` - Unexpected any. Specify a different type
- [ ] `tests/integration/redis-cache.test.ts:35` - Unexpected any. Specify a different type
- [ ] `tests/integration/postgres-persistence.test.ts:32` - Unexpected any. Specify a different type
- [ ] `tests/integration/postgres-persistence.test.ts:31` - Unexpected any. Specify a different type
- [ ] `tests/integration/postgres-persistence.test.ts:30` - Unexpected any. Specify a different type
- [ ] `tests/integration/pipeline.test.ts:38` - Unexpected any. Specify a different type
- [ ] `tests/integration/gsb-mock.test.ts:50` - Unexpected any. Specify a different type
- [ ] `tests/integration/gsb-mock.test.ts:29` - Unexpected any. Specify a different type
- [ ] `tests/integration/enhanced-security.test.ts:5` - Unexpected any. Specify a different type

#### 📂 tests/integration/stubs (4)
- [ ] `tests/integration/stubs/bottleneck.ts:36` - Unexpected any. Specify a different type
- [ ] `tests/integration/stubs/bottleneck.ts:13` - Unexpected any. Specify a different type
- [ ] `tests/integration/stubs/bottleneck.ts:12` - Unexpected any. Specify a different type
- [ ] `tests/integration/stubs/bottleneck.ts:3` - Unexpected any. Specify a different type

#### 📂 tests/stubs (1)
- [ ] `tests/stubs/bottleneck.ts:9` - Unexpected any. Specify a different type


---

### [DeepSource] Audit: Unsanitized user input passed to server logs (JS-A1004)

**Category:** SECURITY
**Description:**
Logs serve as important records that are used by monitoring services and developers to investigate incidents.
Logging unsanitized user input to the server allows the user to forge custom server logs.

In some more serious scenarios, it opens the application up to attacks like [spoofing](https://en.wikipedia.org/wiki/Spoofing_attack).
The attacker may insert a line break in the request object, and make the second line of their log look like a log from a different user, or an info message displayed by the server.

### Bad Practice

```js
import http from "http"
import url from "url"

http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true)
  // Vulnerable! user can inject special characters in the terminal
  console.log(parsedUrl.query.username);
})
```

### Recommended

```js
import http from "http"
import url from "url"

http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true)

  // NOTE: Ideally, stronger sanitization functions should be used.
  // String#replace is only used as an example.
  const username = parsedUrl.query.username.replace(/\n|\r/g, "")
  console.log(parsedUrl.username);
})
```

## References
- [OWASP: Log injection](https://owasp.org/www-community/attacks/Log_Injection)
- [OWASP A09:2021 - Security Logging and Monitoring Failures](https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/)
- [OWASP A10:2017 - Insufficient Logging & Monitoring](https://owasp.org/www-project-top-ten/2017/A10_2017-Insufficient_Logging%2526Monitoring)
- [CWE-117: Improper Output Neutralization for Logs](https://cwe.mitre.org/data/definitions/117.html)

**Total Locations:** 1

**Locations:**
- [ ] `scripts/export-wwebjs-docs.mjs:70` - Sanitize input before logging to console

---

### [DeepSource] Invalid variable usage (JS-0043)

**Category:** ANTI_PATTERN
**Description:**
Variables should be used inside of their binding context.
This helps avoid difficult bugs with variable hoisting.
It is a bad practice to use `var` declarations because variables declared using `var` can be accessed in a function-wide scope.
They can even be accessed before declaration.
In such cases, their value would be `undefined` because only declarations and not initializations are hoisted.

### Bad Practice

```js
function doIf() {
    if (cond()) {
        var build = true;
    }
    console.log(build);
}

function doIfElse() {
    if (cond()) {
        var build = true;
    } else {
        var build = false;
    }
    console.log(build)
}
```

### Recommended

```js
function doIf() {
    let build;
    if (cond()) {
        build = true;
    }
    console.log(build);
}
```

**Total Locations:** 22

**Breakdown by Directory:**

#### 📂 whatsapp-web.js/src/authStrategies (22)
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:212` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:197` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:191` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:188` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:184` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:177` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:171` - 'unzipper' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:169` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:151` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:149` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:148` - 'archiver' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:138` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:128` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:114` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:113` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:83` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:29` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:29` - 'archiver' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:29` - 'unzipper' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:11` - 'archiver' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:10` - 'unzipper' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:9` - 'fs' used outside of binding context


---

### [DeepSource] Found the usage of undeclared variables (JS-0125)

**Category:** BUG_RISK
**Description:**
Variables that aren't defined, but accessed may throw reference errors at runtime.

> **NOTE**: In browser applications, DeepSource recommends the use of ESModules over regular `text/javascript` scripts.
> Using variables that are injected by scripts included in an HTML file is currently not supported.

<!--more-->

Potential `ReferenceError`s may result from misspellings of variable and parameter names, or accidental implicit globals (for example, forgetting the `var` keyword in a `for` loop initializer).
Any reference to an undeclared variable causes a warning, unless the variable is explicitly mentioned in a `/*global ...*/` comment, or specified in the globals key in the configuration file.
A common use case for these is if you intentionally use globals that are defined elsewhere (e.g. in a script sourced from HTML).

### Bad Practice

```js
const foo = someFunction(); // `someFunction` is not defined
const bar = baz + 1; // 'baz' is undeclared
```

### Recommended

```js
import { someFunction } from 'some-file';

const baz = Math.random();
const foo = someFunction();
const bar = baz + 1;
```

**Total Locations:** 7

**Locations:**
- [ ] `whatsapp-web.js/docs/scripts/jsdoc-toc.js:17` - 'jQuery' is not defined To fix this, add jquery in `environment` array of  `.deepsource.toml`. Read more in our documentation https://deepsource.io/docs/analyzer/javascript
- [ ] `scripts/jest-env-setup.js:27` - 'jest' is not defined To fix this, add jest in `environment` array of  `.deepsource.toml`. Read more in our documentation https://deepsource.io/docs/analyzer/javascript
- [ ] `scripts/jest-env-setup.js:25` - 'jest' is not defined To fix this, add jest in `environment` array of  `.deepsource.toml`. Read more in our documentation https://deepsource.io/docs/analyzer/javascript
- [ ] `scripts/jest-env-setup.js:23` - 'jest' is not defined To fix this, add jest in `environment` array of  `.deepsource.toml`. Read more in our documentation https://deepsource.io/docs/analyzer/javascript
- [ ] `scripts/jest-env-setup.js:22` - 'jest' is not defined To fix this, add jest in `environment` array of  `.deepsource.toml`. Read more in our documentation https://deepsource.io/docs/analyzer/javascript
- [ ] `scripts/jest-env-setup.js:21` - 'jest' is not defined To fix this, add jest in `environment` array of  `.deepsource.toml`. Read more in our documentation https://deepsource.io/docs/analyzer/javascript
- [ ] `scripts/jest-env-setup.js:12` - 'jest' is not defined To fix this, add jest in `environment` array of  `.deepsource.toml`. Read more in our documentation https://deepsource.io/docs/analyzer/javascript

---

### [SonarQube] Enable server hostname verification on this SSL/TLS connection. (typescript:S5527)

**Category:** Vulnerability
**Description:**
Enable server hostname verification on this SSL/TLS connection.

**Total Locations:** 2

**Locations:**
- [ ] `packages/shared/src/reputation/certificate-intelligence.ts:48` - Enable server hostname verification on this SSL/TLS connection.
- [ ] `packages/shared/src/reputation/certificate-intelligence.ts:undefined` - Enable server hostname verification on this SSL/TLS connection.

---

### [SonarQube] Enable server certificate validation on this SSL/TLS connection. (typescript:S4830)

**Category:** Vulnerability
**Description:**
Enable server certificate validation on this SSL/TLS connection.

**Total Locations:** 2

**Locations:**
- [ ] `packages/shared/src/reputation/certificate-intelligence.ts:48` - Enable server certificate validation on this SSL/TLS connection.
- [ ] `packages/shared/src/reputation/certificate-intelligence.ts:undefined` - Enable server certificate validation on this SSL/TLS connection.

---

### [SonarQube] Refactor this function to reduce its Cognitive Complexity from 26 to the 15 allowed. (typescript:S3776)

**Category:** Code Smell
**Description:**
Refactor this function to reduce its Cognitive Complexity from 26 to the 15 allowed.

**Total Locations:** 21

**Breakdown by Directory:**

#### 📂 packages/shared/src (4)
- [ ] `packages/shared/src/url-shortener.ts:132` - Refactor this function to reduce its Cognitive Complexity from 23 to the 15 allowed.
- [ ] `packages/shared/src/url-shortener.ts:193` - Refactor this function to reduce its Cognitive Complexity from 37 to the 15 allowed.
- [ ] `packages/shared/src/scoring.ts:39` - Refactor this function to reduce its Cognitive Complexity from 42 to the 15 allowed.
- [ ] `packages/shared/src/url-shortener.ts:265` - Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed.

#### 📂 packages/shared/src/reputation (3)
- [ ] `packages/shared/src/reputation/certificate-intelligence.ts:23` - Refactor this function to reduce its Cognitive Complexity from 26 to the 15 allowed.
- [ ] `packages/shared/src/reputation/dns-intelligence.ts:31` - Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed.
- [ ] `packages/shared/src/reputation/http-fingerprint.ts:24` - Refactor this function to reduce its Cognitive Complexity from 25 to the 15 allowed.

#### 📂 services/control-plane/src (1)
- [ ] `services/control-plane/src/index.ts:284` - Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed.

#### 📂 services/scan-orchestrator/src (3)
- [ ] `services/scan-orchestrator/src/index.ts:983` - Refactor this function to reduce its Cognitive Complexity from 89 to the 15 allowed.
- [ ] `services/scan-orchestrator/src/index.ts:274` - Refactor this function to reduce its Cognitive Complexity from 28 to the 15 allowed.
- [ ] `services/scan-orchestrator/src/index.ts:894` - Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed.

#### 📂 services/wa-client/src (8)
- [ ] `services/wa-client/src/index.ts:2074` - Refactor this function to reduce its Cognitive Complexity from 80 to the 15 allowed.
- [ ] `services/wa-client/src/pairingOrchestrator.ts:211` - Refactor this function to reduce its Cognitive Complexity from 23 to the 15 allowed.
- [ ] `services/wa-client/src/index.ts:523` - Refactor this function to reduce its Cognitive Complexity from 27 to the 15 allowed.
- [ ] `services/wa-client/src/index.ts:undefined` - Refactor this function to reduce its Cognitive Complexity from 50 to the 15 allowed.
- [ ] `services/wa-client/src/index.ts:867` - Refactor this function to reduce its Cognitive Complexity from 43 to the 15 allowed.
- [ ] `services/wa-client/src/index.ts:468` - Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed.
- [ ] `services/wa-client/src/index.ts:1438` - Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed.
- [ ] `services/wa-client/src/index.ts:1542` - Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed.

#### 📂 services/wa-client/src/state (2)
- [ ] `services/wa-client/src/state/messageStore.ts:61` - Refactor this function to reduce its Cognitive Complexity from 26 to the 15 allowed.
- [ ] `services/wa-client/src/state/messageStore.ts:192` - Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed.


---

### [SonarQube] Refactor this function to reduce its Cognitive Complexity from 21 to the 15 allowed. (javascript:S3776)

**Category:** Code Smell
**Description:**
Refactor this function to reduce its Cognitive Complexity from 21 to the 15 allowed.

**Total Locations:** 7

**Locations:**
- [ ] `scripts/run-migrations.js:7` - Refactor this function to reduce its Cognitive Complexity from 21 to the 15 allowed.
- [ ] `scripts/setup/orchestrator.mjs:914` - Refactor this function to reduce its Cognitive Complexity from 38 to the 15 allowed.
- [ ] `scripts/probe-deepsource.js:273` - Refactor this function to reduce its Cognitive Complexity from 35 to the 15 allowed.
- [ ] `scripts/setup/orchestrator.mjs:1408` - Refactor this function to reduce its Cognitive Complexity from 43 to the 15 allowed.
- [ ] `scripts/setup/orchestrator.mjs:1157` - Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed.
- [ ] `scripts/setup/core/flags.mjs:21` - Refactor this function to reduce its Cognitive Complexity from 28 to the 15 allowed.
- [ ] `scripts/ui/prompt-runner.mjs:216` - Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed.

---

### [SonarQube] Refactor this asynchronous operation outside of the constructor. (typescript:S7059)

**Category:** Code Smell
**Description:**
Refactor this asynchronous operation outside of the constructor.

**Total Locations:** 1

**Locations:**
- [ ] `services/wa-client/src/pairingOrchestrator.ts:86` - Refactor this asynchronous operation outside of the constructor.

---

### [SonarQube] Unexpected iterable of non-Promise (non-"Thenable") values passed to promise aggregator. (typescript:S4123)

**Category:** Code Smell
**Description:**
Unexpected iterable of non-Promise (non-"Thenable") values passed to promise aggregator.

**Total Locations:** 2

**Locations:**
- [ ] `services/scan-orchestrator/src/enhanced-security.ts:undefined` - Unexpected iterable of non-Promise (non-"Thenable") values passed to promise aggregator.
- [ ] `services/wa-client/src/media.ts:35` - Unexpected `await` of a non-Promise (non-"Thenable") value.

---

### [SonarQube] Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed. (python:S3776)

**Category:** Code Smell
**Description:**
Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed.

**Total Locations:** 4

**Locations:**
- [ ] `scripts/agent_orchestrator/mcp_server.py:114` - Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed.
- [ ] `scripts/agent_orchestrator/mcp_server.py:325` - Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed.
- [ ] `scripts/agent_orchestrator/main.py:268` - Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed.
- [ ] `scripts/agent_orchestrator/main.py:307` - Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed.

---

### [SonarQube] Refactor this code to not nest functions more than 4 levels deep. (typescript:S2004)

**Category:** Code Smell
**Description:**
Refactor this code to not nest functions more than 4 levels deep.

**Total Locations:** 4

**Locations:**
- [ ] `services/wa-client/src/index.ts:undefined` - Refactor this code to not nest functions more than 4 levels deep.
- [ ] `services/wa-client/src/index.ts:983` - Refactor this code to not nest functions more than 4 levels deep.
- [ ] `services/control-plane/src/__tests__/routes.test.ts:177` - Refactor this code to not nest functions more than 4 levels deep.
- [ ] `tests/e2e/control-plane.test.ts:109` - Refactor this code to not nest functions more than 4 levels deep.

---

### [SonarQube] Unexpected empty method 'on'. (typescript:S1186)

**Category:** Code Smell
**Description:**
Unexpected empty method 'on'.

**Total Locations:** 5

**Locations:**
- [ ] `services/control-plane/src/index.ts:129` - Unexpected empty method 'on'.
- [ ] `services/scan-orchestrator/src/index.ts:186` - Unexpected empty method 'on'.
- [ ] `services/wa-client/src/index.ts:152` - Unexpected empty method 'on'.
- [ ] `tests/e2e/control-plane.test.ts:22` - Unexpected empty method 'on'.
- [ ] `services/wa-client/src/__tests__/commands.test.ts:19` - Unexpected empty method 'on'.

---

### [SonarQube] Remove this use of the "void" operator. (typescript:S3735)

**Category:** Code Smell
**Description:**
Remove this use of the "void" operator.

**Total Locations:** 6

**Locations:**
- [ ] `packages/shared/src/url-shortener.ts:172` - Remove this use of the "void" operator.
- [ ] `packages/shared/src/url-shortener.ts:222` - Remove this use of the "void" operator.
- [ ] `packages/shared/src/url-shortener.ts:229` - Remove this use of the "void" operator.
- [ ] `packages/shared/src/url-shortener.ts:238` - Remove this use of the "void" operator.
- [ ] `packages/shared/src/url-shortener.ts:241` - Remove this use of the "void" operator.
- [ ] `packages/shared/src/url-shortener.ts:246` - Remove this use of the "void" operator.

---

## MAJOR Priority Issues (212)

### [DeepSource] Suggest correct usage of shebang (JS-0271)

**Category:** BUG_RISK
**Description:**
The issue checks for incorrect or missing shebang in files mentioned in the `bin` field of the `package.json`.
When creating a CLI tool with Node.js, it is necessary to add a shebang to the file that serves as the entry point for the application.
As the NPM docs say, the file(s) referenced in `bin` must start with `#!/usr/bin/env node`, or the scripts won't be run with the Node.js executable.

<!--more-->
The `bin` field in package.json is used to specify JS files which run as tools when launched with the Node.js launcher.

### Bad Practice

Incorrect shebang:

```js
// /user/bin/env node
console.log("App launched");
```

No shebang in a file referenced in package.json's `bin` field:

```js
console.log("App launched")
```

### Recommended

The following code snippet is assumed to be in a file that is referenced in the `bin` field:

```js
#!/usr/bin/env node
console.log("App launched");
```

## References

- [`bin` - npm](https://docs.npmjs.com/cli/v7/configuring-npm/package-json#bin)
- [shebang](https://en.wikipedia.org/wiki/Shebang_(Unix))

**Autofix Available:** Yes

**Total Locations:** 12

**Locations:**
- [ ] `tests/load/http-load.js:15` - This file needs no shebang
- [ ] `scripts/watch-pairing-code.js:8` - This file needs no shebang
- [ ] `scripts/validate-config.js:2` - This file needs no shebang
- [ ] `scripts/setup-wizard.mjs:3` - This file needs no shebang
- [ ] `scripts/run-seeds.js:2` - This file needs no shebang
- [ ] `scripts/run-migrations.js:2` - This file needs no shebang
- [ ] `scripts/replay-test-messages.ts:11` - This file needs no shebang
- [ ] `scripts/probe-deepsource.js:9` - This file needs no shebang
- [ ] `scripts/init-sqlite.js:10` - This file needs no shebang
- [ ] `scripts/fetch-security-reports.js:21` - This file needs no shebang
- [ ] `scripts/explore-deepsource-schema.js:10` - This file needs no shebang
- [ ] `scripts/deepsource-api.js:20` - This file needs no shebang

---

### [DeepSource] Consider decorating method with `@staticmethod` (PYL-R0201)

**Category:** PERFORMANCE
**Description:**
The method doesn't use its bound instance. Decorate this method with `@staticmethod` decorator, so that Python does not have to instantiate a bound method for every instance of this class thereby saving memory and computation. Read more about staticmethods [here](https://docs.python.org/3/library/functions.html#staticmethod).

**Autofix Available:** Yes

**Total Locations:** 7

**Locations:**
- [ ] `scripts/agent_orchestrator/tests/test_orchestrator.py:109` - Method doesn't use the class instance and could be converted into a static method
- [ ] `scripts/agent_orchestrator/tests/test_orchestrator.py:106` - Method doesn't use the class instance and could be converted into a static method
- [ ] `scripts/agent_orchestrator/tests/test_orchestrator.py:101` - Method doesn't use the class instance and could be converted into a static method
- [ ] `scripts/agent_orchestrator/tests/test_orchestrator.py:98` - Method doesn't use the class instance and could be converted into a static method
- [ ] `scripts/agent_orchestrator/tests/test_orchestrator.py:95` - Method doesn't use the class instance and could be converted into a static method
- [ ] `scripts/agent_orchestrator/tests/test_orchestrator.py:92` - Method doesn't use the class instance and could be converted into a static method
- [ ] `scripts/agent_orchestrator/main.py:182` - Method doesn't use the class instance and could be converted into a static method

---

### [DeepSource] Unnecessary `delete` statement in a local scope (PTC-W0043)

**Category:** ANTI_PATTERN
**Description:**
Passing a local variable to a `del` statement results in that variable being removed from the local namespace.
When exiting a function all local variables are deleted, so it is unnecessary to explicitly delete variables in such cases.

It is recommended to remove this `del` statement.

Not preferred:
```python
def my_func():
    task = do_some_task()
    evaluate_task(task)
    del task  # This is unnecessary.
```

Preferred:
```python
def my_func():
    task = do_some_task()
    evaluate_task(task)
```

**Autofix Available:** Yes

**Total Locations:** 2

**Locations:**
- [ ] `scripts/agent_orchestrator/cli_agents.py:108` - Unnecessary `del` statement in a local scope
- [ ] `scripts/agent_orchestrator/cli_agents.py:62` - Unnecessary `del` statement in a local scope

---

### [DeepSource] Imported name is not used anywhere in the module (PY-W2000)

**Category:** ANTI_PATTERN
**Description:**
An object has been imported but is not used anywhere in the file.
It should either be used or the import should be removed.
<!--more-->

### Bad practice
```python
import os

def example():
    print("This snippet is not using the `os` import anywhere.")
```

### Recommended
```python
def example():
    print("This looks good now!")
```

### But this import is used by other modules!

One major reason why this issue can cause confusion is when it's raised for
imports that are meant to be exported, for use in other places.

For example, consider this file, `mypackage/__init__.py`:

```python
from mypackage.foo import is_foo
from mypackage.bar import bar_function
```

This is a very common pattern to export common functionality from modules, to
the top level of a package. But there is a major problem with this approach.
Consider this file, `mypackage/foo.py`:

```python
import os

def is_foo(item):
    return os.path.exists(item)
```

Since `os` is imported inside `foo.py`, you can actually do this:

```python
>>> from mypackage.foo import os
```

Although weird, Python automatically exports all imports in a file. In practice
however, it is ill-advised to rely on this behaviour.

If you want to explicitly export an imported item in a file, add it to the
special variable named `__all__`:

```python
from mypackage.foo import is_foo
from mypackage.bar import bar_function

__all__ = ['is_foo', 'bar_function']  # Notice that these are strings!
```

DeepSource won't raise an issue if the imported item is present in `__all__`.

**Autofix Available:** Yes

**Total Locations:** 1

**Locations:**
- [ ] `scrape_baileys.py:9` - Unused import os

---

### [DeepSource] Found explicit type declarations (JS-0331)

**Category:** ANTI_PATTERN
**Description:**
Explicit types where they can be easily inferred may add unnecessary verbosity for variables or parameters initialized to a number, string, or boolean

### Bad Practice
```ts
const a: bigint = 10n;
const a: bigint = -10n;
const a: bigint = BigInt(10);
const a: bigint = -BigInt(10);
const a: boolean = false;
const a: boolean = true;
const a: boolean = Boolean(null);
const a: boolean = !0;
const a: number = -10;
const a: number = Number('1');
const a: number = +Number('1');
const a: number = -Number('1');
const a: null = null;
const a: RegExp = /a/;
const a: RegExp = RegExp('a');
const a: RegExp = new RegExp('a');
const a: string = 'str';
const a: string = String(1);
const a: symbol = Symbol('a');
const a: undefined = void someValue;

class Foo {
  prop: number = 5;
}

function fn(a: number = 5, b: boolean = true) {}
```

### Recommended
```ts
const a = 10n;
const a = -10n;
const a = BigInt(10);
const a = -BigInt(10);
const a = false;
const a = true;
const a = Boolean(null);
const a = !0;
const a = 10;
const a = +10;
const a = -Number('1');
const a = null;
const a = /a/;
const a = RegExp('a');
const a = 'str';
const a = String(1);
const a = Symbol('a');
const a = void someValue;

class Foo {
  prop = 5;
}

function fn(a = 5, b = true) {}

function fn(a: number, b: boolean, c: string) {}
```

**Autofix Available:** Yes

**Total Locations:** 1

**Locations:**
- [ ] `packages/shared/src/circuit-breaker.ts:19` - Type number trivially inferred from a number literal, remove type annotation

---

### [DeepSource] Consider using `let` or `const` instead of `var` (JS-0239)

**Category:** ANTI_PATTERN
**Description:**
It is recommended to use `let` or `const` over `var`.
This will help prevent re-declaration of variables that are in the global scope when using `var`.

<!--more-->

ES6 allows programmers to create variables with block scope instead of function scope using the `let` and `const` keywords.
Block scope is common in many other programming languages and helps programmers avoid mistakes such as this one:

```js
var count = people.length;
var enoughFood = count > sandwiches.length;

if (enoughFood) {
    var count = sandwiches.length; // accidentally overriding the count variable
    console.log("We have " + count + " sandwiches for everyone. Plenty for all!");
}

// our count variable is no longer accurate
console.log("We have " + count + " people and " + sandwiches.length + " sandwiches!");
```

Block scoped variables shadow outer declarations instead of writing to them.

**NOTE:**
There are certain edge cases where users might want to consider var.
Consider this example:

```js
var lib = lib || { run: () => {} }
```

Here, `lib` might be a library that is exposed to an HTML file using a `<script>` tag.
The `var` keyword helps avoid re-writing `lib` if it has already been declared via an injected script that was executed before this one.
Ideally, you should let bundlers worry about cases like this.
But if you want to use `var` anyway, consider using a [skipcq comment](https://docs.deepsource.com/docs/issues-ignore-rules), or [disabling the issue](https://docs.deepsource.com/docs/repository-view-issues#ignoring-issues) altogether.

### Bad Practice

```js
var x = "y";
var CONFIG = {};
```

### Recommended
```js
let x = "y";
const CONFIG = {};
```

**Total Locations:** 14

**Locations:**
- [ ] `whatsapp-web.js/src/util/Util.js:23` - Unexpected var, use let or const instead
- [ ] `whatsapp-web.js/src/util/Util.js:22` - Unexpected var, use let or const instead
- [ ] `whatsapp-web.js/src/util/Util.js:21` - Unexpected var, use let or const instead
- [ ] `whatsapp-web.js/src/util/Util.js:20` - Unexpected var, use let or const instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:714` - Unexpected var, use let or const instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:713` - Unexpected var, use let or const instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:712` - Unexpected var, use let or const instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:711` - Unexpected var, use let or const instead
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:169` - Unexpected var, use let or const instead
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:98` - Unexpected var, use let or const instead
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:7` - Unexpected var, use let or const instead
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:6` - Unexpected var, use let or const instead
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:5` - Unexpected var, use let or const instead
- [ ] `whatsapp-web.js/docs/scripts/jsdoc-toc.js:3` - Unexpected var, use let or const instead

---

### [DeepSource] Detected the use of process.exit() (JS-0263)

**Category:** BUG_RISK
**Description:**
The process.exit() method in Node.js is used to immediately stop the Node.js process and exit. This is a dangerous operation because it can occur in any method at any point in time, potentially stopping a Node.js application completely when an error occurs. For example:
```
if (somethingBadHappened) {
    console.error("Something bad happened!");
    process.exit(1);
}
```
This code could appear in any module and will stop the entire application when somethingBadHappened is truthy. This doesn't give the application any chance to respond to the error. It's usually better to throw an error and allow the application to handle it appropriately:
```
if (somethingBadHappened) {
    throw new Error("Something bad happened!");
}
```
By throwing an error in this way, other parts of the application have an opportunity to handle the error rather than stopping the application altogether. If the error bubbles all the way up to the process without being handled, then the process will exit and a non-zero exit code will returned, so the end result is the same.

If you are using process.exit() only for specifying the exit code, you can set process.exitCode (introduced in Node.js 0.11.8) instead.

### Bad Practice

```js
process.exit(1);
process.exit(0);
```


### Recommended

```js
Process.exit();
var exit = process.exit;
```

**Total Locations:** 30

**Breakdown by Directory:**

#### 📂 packages/shared/src (1)
- [ ] `packages/shared/src/config.ts:309` - Don't use process.exit(); throw an error instead

#### 📂 scripts (15)
- [ ] `scripts/watch-pairing-code.js:219` - Don't use process.exit(); throw an error instead
- [ ] `scripts/watch-pairing-code.js:214` - Don't use process.exit(); throw an error instead
- [ ] `scripts/watch-pairing-code.js:159` - Don't use process.exit(); throw an error instead
- [ ] `scripts/validate-config.js:26` - Don't use process.exit(); throw an error instead
- [ ] `scripts/validate-config.js:9` - Don't use process.exit(); throw an error instead
- [ ] `scripts/setup-wizard.mjs:7` - Don't use process.exit(); throw an error instead
- [ ] `scripts/run-seeds.js:35` - Don't use process.exit(); throw an error instead
- [ ] `scripts/run-migrations.js:124` - Don't use process.exit(); throw an error instead
- [ ] `scripts/replay-test-messages.ts:108` - Don't use process.exit(); throw an error instead
- [ ] `scripts/replay-test-messages.ts:102` - Don't use process.exit(); throw an error instead
- [ ] `scripts/probe-deepsource.js:428` - Don't use process.exit(); throw an error instead
- [ ] `scripts/init-sqlite.js:51` - Don't use process.exit(); throw an error instead
- [ ] `scripts/fetch-security-reports.js:549` - Don't use process.exit(); throw an error instead
- [ ] `scripts/deepsource-api.js:329` - Don't use process.exit(); throw an error instead
- [ ] `scripts/deepsource-api.js:325` - Don't use process.exit(); throw an error instead

#### 📂 scripts/setup (2)
- [ ] `scripts/setup/orchestrator.mjs:336` - Don't use process.exit(); throw an error instead
- [ ] `scripts/setup/orchestrator.mjs:285` - Don't use process.exit(); throw an error instead

#### 📂 scripts/setup/core (1)
- [ ] `scripts/setup/core/flags.mjs:72` - Don't use process.exit(); throw an error instead

#### 📂 scripts/setup/ui (2)
- [ ] `scripts/setup/ui/hotkeys.mjs:74` - Don't use process.exit(); throw an error instead
- [ ] `scripts/setup/ui/hotkeys.mjs:41` - Don't use process.exit(); throw an error instead

#### 📂 services/control-plane/src (1)
- [ ] `services/control-plane/src/index.ts:360` - Don't use process.exit(); throw an error instead

#### 📂 services/scan-orchestrator/src (2)
- [ ] `services/scan-orchestrator/src/index.ts:1631` - Don't use process.exit(); throw an error instead
- [ ] `services/scan-orchestrator/src/index.ts:1623` - Don't use process.exit(); throw an error instead

#### 📂 services/wa-client/src (3)
- [ ] `services/wa-client/src/index.ts:2276` - Don't use process.exit(); throw an error instead
- [ ] `services/wa-client/src/index.ts:1397` - Don't use process.exit(); throw an error instead
- [ ] `services/wa-client/src/index.ts:1322` - Don't use process.exit(); throw an error instead

#### 📂 tests/load (3)
- [ ] `tests/load/http-load.js:145` - Don't use process.exit(); throw an error instead
- [ ] `tests/load/http-load.js:47` - Don't use process.exit(); throw an error instead
- [ ] `tests/load/http-load.js:42` - Don't use process.exit(); throw an error instead


---

### [DeepSource] Detected deprecated APIs (JS-0272)

**Category:** BUG_RISK
**Description:**
Since its inception, NodeJS has deprecated many APIs for one of the following reasons:
  - Use of the API is unsafe.
  - An improved version of the API was introduced later.
  - The API may have breaking changes in a future version of Node.

This issue prevents the use of deprecated Node APIs in favor of modern ones.

### Bad Practice

```js
const fs = require("fs");
function fetchData(fileName) {
  // 'fs.exists' was deprecated since v4.
  // Use 'fs.stat()' or 'fs.access()' instead.
  if (fs.exists(fileName)) {
    // ... 
  }
}
```

### Recommended

```js
async function fetchData(fileName) {
  fs.access(fileName, (error) => {
    if (error) {
      // Handle the error
    } else {
      // ...
    }
  })
}
```

**Total Locations:** 1

**Locations:**
- [ ] `packages/shared/src/homoglyph.ts:2` - 'punycode' module was deprecated since v7.0.0. Use 'https://www.npmjs.com/package/punycode' instead

---

### [DeepSource] Found non-null assertions (JS-0339)

**Category:** ANTI_PATTERN
**Description:**
Using non-null assertions cancels out the benefits of strict null-checking, and introduces the possibility of runtime errors.
Avoid non-null assertions unless absolutely necessary.
If you still need to use one, write a [skipcq comment](https://docs.deepsource.com/docs/issues-ignore-rules) to explain why it is safe.

Ideally, you want to have a validation function that confirms a value isn't null, with a return type like this:

```ts
type AccentedColor = `${Color}-${Accent}`
function isColorValid(name: string): name is AccentedColor {
  // ...
}
```

### Bad Practice

```ts
// a user named "injuly" may not exist in the DB
const injuly: User | null = db.getUserByName("injuly");

// Using the non-null assertion operator will bypass null-checking
const pfp = injuly!.profilePicture;
```

### Recommended

```ts
const injuly: User | null = db.getUserByName("injuly");
const pfp = injuly?.profilePicture; // pfp: Image | undefined

// OR:

const pfp_ = injuly ? injuly.pfp : defaultPfp; // pfp: Image
```

Alternatively:

```ts
function isUserValid(userObj: User | null | undefined ): userObj is User {
  return Boolean(userObj) && validate(userObj);
}

const injuly = db.getUserByName("injuly")
if (isUserValid(injuly)) {
  const pfp = injuly.profilePicture;
  // ...
}
```

**Total Locations:** 7

**Locations:**
- [ ] `tests/integration/pipeline.test.ts:63` - Forbidden non-null assertion
- [ ] `tests/integration/pipeline.test.ts:61` - Forbidden non-null assertion
- [ ] `tests/e2e/message-flow.test.ts:38` - Forbidden non-null assertion
- [ ] `tests/e2e/message-flow.test.ts:21` - Forbidden non-null assertion
- [ ] `services/wa-client/src/verdictTracker.ts:63` - Forbidden non-null assertion
- [ ] `services/wa-client/src/__tests__/remoteAuthStore.test.ts:18` - Forbidden non-null assertion
- [ ] `packages/shared/src/__tests__/url.test.ts:34` - Forbidden non-null assertion

---

### [DeepSource] Found unused variables in TypeScript code (JS-0356)

**Category:** PERFORMANCE
**Description:**
Unused variables are generally considered a code smell and should be avoided.

<!--more-->

Removing unused references
- It prevents unused modules from being loaded at runtime, improving performance, and preventing the compiler from loading metadata that will never be used.
- It prevents conflicts that may occur when trying to reference another variable.

**NOTE:** If you have intentionally left a variable unused, we suggest you to prefix the variable name with a `_` to prevent them from being flagged by DeepSource.

### Bad Practice
```ts
import fs from 'fs' // <- unused
import { readFileSync } from 'fs'

const text = readFileSync('declaration_of_independence.txt', 'utf-8')
console.log(text)
```

### Recommended

```ts
import { readFileSync } from 'fs'

const text = readFileSync('declaration_of_independence.txt', 'utf-8')
console.log(text)
```

**Total Locations:** 2

**Locations:**
- [ ] `tests/e2e/full_flow.test.ts:1` - 'afterAll' is defined but never used
- [ ] `services/wa-client/src/__tests__/functional/session-flow.test.ts:45` - 'result' is assigned a value but never used

---

### [DeepSource] Detected the use of variables before they are defined (JS-0357)

**Category:** ANTI_PATTERN
**Description:**
Variables, functions and types should always be used *after* they've been defined.
This issue will flag any code snippets that use variables or types before definition.

<!-- more -->

Sometimes, the code will run just fine even when the variable is declared after use.
Consider the following example:

```ts
const ram: Resource = { type: "memory", limit: 1024 ** 3 }
type Resource = {
  type: string;
  limit: number;
}
```

Here, `Resource` is used in the annotation before it has been defined.
Similarly, it is possible to hoist function declarations and variables declared with the `var` keyword:

```js
const four = twice(2);
function twice(n: number) {
  return n * 2;
}
```

However, it makes the code harder to follow when variables or types are declared *after* being used.

### Bad Practice

```ts
const knight: Radiant = {
  order: "SurgeBinder"
  strength: 30
}

interface Radiant {
  order: string;
  strength: number;
}
```

### Recommended

```ts
interface Radiant {
  order: string;
  strength: number;
}

const knight: Radiant = {
  order: "SurgeBinder"
  strength: 30
}
```

**Total Locations:** 9

**Locations:**
- [ ] `services/wa-client/src/index.ts:1290` - 'replayCachedQr' was used before it was defined
- [ ] `services/wa-client/src/index.ts:1193` - 'replayCachedQr' was used before it was defined
- [ ] `services/wa-client/src/index.ts:1119` - 'requestPairingCodeWithRetry' was used before it was defined
- [ ] `services/wa-client/src/index.ts:907` - 'consecutiveAutoRefreshes' was used before it was defined
- [ ] `services/wa-client/src/index.ts:212` - 'maskPhone' was used before it was defined
- [ ] `services/wa-client/src/index.ts:201` - 'maskPhone' was used before it was defined
- [ ] `services/wa-client/src/index.ts:191` - 'maskPhone' was used before it was defined
- [ ] `services/wa-client/src/index.ts:177` - 'maskPhone' was used before it was defined
- [ ] `services/wa-client/src/index.ts:174` - 'PHONE_PAIRING_CODE_TTL_MS' was used before it was defined

---

### [DeepSource] Detected the use of require statements except in import statements (JS-0359)

**Category:** ANTI_PATTERN
**Description:**
In other words, the use of forms such as `var foo = require("foo")` are banned. Instead use `ES6` style imports or `import foo = require("foo")` imports.

### Bad Practice

```ts
var foo = require('foo');
const foo = require('foo');
let foo = require('foo');
```


### Recommended

```ts
import foo = require('foo');
require('foo');
import foo from 'foo';
```

**Total Locations:** 5

**Locations:**
- [ ] `tests/integration/vitest.setup.ts:14` - Require statement not part of import statement
- [ ] `services/control-plane/src/__tests__/routes.test.ts:110` - Require statement not part of import statement
- [ ] `packages/shared/src/__tests__/config.test.ts:67` - Require statement not part of import statement
- [ ] `packages/shared/src/__tests__/config.test.ts:55` - Require statement not part of import statement
- [ ] `packages/shared/src/__tests__/config.test.ts:16` - Require statement not part of import statement

---

### [DeepSource] Private members should be marked as `readonly` (JS-0368)

**Category:** ANTI_PATTERN
**Description:**
Private members are marked as `readonly` if they're never modified outside of the constructor.

### Bad Practice

```ts
class Container {
  // These member variables could be marked as readonly
  private neverModifiedMember = true;
  private onlyModifiedInConstructor: number;

  public constructor(
    onlyModifiedInConstructor: number,
    // Private parameter properties can also be marked as readonly
    private neverModifiedParameter: string,
  ) {
    this.onlyModifiedInConstructor = onlyModifiedInConstructor;
  }
}
```


### Recommended

```ts
class Container {
  // Public members might be modified externally
  public publicMember: boolean;

  // Protected members might be modified by child classes
  protected protectedMember: number;

  // This is modified later on by the class
  private modifiedLater = 'unchanged';

  public mutate() {
    this.modifiedLater = 'mutated';
  }
}
```

**Total Locations:** 1

**Locations:**
- [ ] `tests/stubs/bottleneck.ts:5` - Member 'reservoir' is never reassigned; mark it as `readonly`

---

### [DeepSource] Unused return value from `Array`/`Object` prototype method (JS-D008)

**Category:** BUG_RISK
**Description:**
Many built-in functions defined on prototypes for `Object` and `Array` are pure, and return modified versions of their inputs.
If the return values from these functions aren't used, the function call is essentially a no-op and might as well be removed.

```js
// These calls do not modify the array, instead they
// return new arrays with the desired properties.
xs.map(x => x.prop)
xs.filter(x => x.prop === 'value')
xs.concat(ys)
xs.reduce((x, y) => (x.value + y.value))
```
<!-- more -->

Perhaps, you're using `map` to iterate over an array and induce some side-effect, like logging to the console as shown here:

```js
xs.map((x, i) => console.log(`element #${i}:`, x))
```
This use of `map` is however misleading.
The `map`/`filter`/`concat` methods should only ever be used to produce new arrays that are used elsewhere.
Instead, you should use the `forEach` method:

```js
xs.forEach((x, i) => console.log(`element #${i}:`, x))
```

### Bad Practice

```js
const characters = [
  { name: 'Paul Atreides', age: 15 },
  { name: 'Kaladin Stormblessed', age: 19 },
  { name: 'Miss Kobayashi', age: 25 },
  { name: 'Eren Yeager', age: 14 },
  { name: 'Illidan Stormrage', age: 3000 }
]

characters.map(character => character.name);

// characters array is not modified by the call to `map`.
console.log(characters) 
```

### Recommended
```js
const characters = [
  { name: 'Paul Atreides', age: 15 },
  { name: 'Kaladin Stormblessed', age: 19 },
  { name: 'Miss Kobayashi', age: 25 },
  { name: 'Eren Yeager', age: 14 },
  { name: 'Illidan Stormrage', age: 3000 }
]

// array returned by call to `map` is now stored.
const characterNames = characters.map(character=> character.name);
console.log(characterNames)
//  [ 'Paul Atreides', 'Kaladin Stormblessed', 'Miss Kobayashi', 'Eren Yeager', 'Illidan Stormrage' ]
```

**Total Locations:** 2

**Locations:**
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:113` - Return value from 'map' method is unused
- [ ] `whatsapp-web.js/src/Client.js:1661` - Return value from 'map' method is unused

---

### [DeepSource] Found complex boolean return (JS-W1041)

**Category:** ANTI_PATTERN
**Description:**
The following pattern:

```javascript
if (condition) {
  return true
}
return false
```

can be refactored to:

```javascript
return condition
```

When `condition` is not a boolean value,
it can be cast into one using the `Boolean` constructor.

### Bad Practice

```typescript
function isEven(num: number) {
  if (num % 2 === 0) return true
  return false
}

async function userExists(name: string) {
  if (await db.getUser(name)) return true
  return false
}
```

### Recommended

```typescript
function isEven(num: number) {
  return num % 2 === 0
}

async function userExists(name: string) {
  return Boolean(await db.getUser(name))
}
```

**Total Locations:** 3

**Locations:**
- [ ] `whatsapp-web.js/src/structures/Chat.js:198` - Boolean return can be simplified
- [ ] `whatsapp-web.js/src/structures/Channel.js:295` - Boolean return can be simplified
- [ ] `services/scan-orchestrator/src/blocklists.ts:40` - Boolean return can be simplified

---

### [DeepSource] Found constant expressions in conditions (JS-0003)

**Category:** BUG_RISK
**Description:**
A constant expression such as a literal when used as a condition in an `if`/ `for` / `while` or `do...while` statement can cause errors in a production environment.

<!--more-->

Usage of such constructs in a development environment for debugging triggers is common, but it's not a good practice to push them to VCS.

### Bad Practice

```js
if (false) {
    doSomethingUnfinished();
}

if (void x) {
    doSomethingUnfinished();
}

for (;-2;) {
    doSomethingForever();
}

while (typeof x) {
    doSomethingForever();
}

do {
    doSomethingForever();
} while (x = -1);

const result = 0 ? a : b;
```

### Recommended

```js
if (foo()) {
    doSomethingUnfinished();
}

for (let i = 0; i < foo; ++i) {
    doSomethingForever();
}

while (true) {
    doSomethingForever();
}

do {
    doSomethingForever();
} while (x == -1);

const result = cond() ? a : b;
```

**Total Locations:** 1

**Locations:**
- [ ] `packages/shared/src/circuit-breaker.ts:98` - Unexpected constant condition

---

### [DeepSource] Found control characters in regular expressions (JS-0004)

**Category:** BUG_RISK
**Description:**
Control characters are special, invisible characters in the ASCII range 0-31.
These characters are rarely used in JavaScript strings, so a regular expression containing these characters is most likely a mistake.

<!--more-->

### Bad Practice

```js
const pattern1 = /\x1f/;
const pattern2 = new RegExp("\x1f");
```

### Recommended

```js
const pattern1 = /\x20/;
const pattern2 = new RegExp("\x20");
```

**Total Locations:** 2

**Locations:**
- [ ] `packages/shared/src/reputation/advanced-heuristics.ts:188` - Unexpected control character(s) in regular expression: \x00
- [ ] `packages/shared/src/homoglyph.ts:25` - Unexpected control character(s) in regular expression: \x00

---

### [DeepSource] `eval()` should not be used (JS-0060)

**Category:** SECURITY
**Description:**
JavaScript's `eval()` function is potentially dangerous and is often misused.
Using `eval()` on untrusted code can open a program up to several different injection attacks.
The use of `eval()` in most contexts can be substituted for a better, alternative approach to the problem.

<!--more-->

### Bad Practice

```js
const obj = { x: "foo" }
const key = "x"
const value = eval("obj." + key);

(0, eval)("var a = 0");

const foo = eval;
foo("var a = 0");

// This `this` is the global object.
this.eval("var a = 0");
```

### Recommended

```js
const obj = { x: "foo" },
    key = "x",
    value = obj[key];

class A {
    foo() {
        // This is a user-defined method.
        this.eval("var a = 0");
    }

    eval() { /* ... * / }
}
```

## References
- [OWASP A03:2021 - Injection](https://owasp.org/Top10/A03_2021-Injection/)
- [OWASP Direct Dynamic Code Evaluation - Eval Injection](https://owasp.org/www-community/attacks/Direct_Dynamic_Code_Evaluation_Eval%20Injection)

**Total Locations:** 1

**Locations:**
- [ ] `whatsapp-web.js/src/util/Injected/AuthStore/LegacyAuthStore.js:6` - eval can be harmful

---

### [DeepSource] Unit test class with no tests (PTC-W0046)

**Category:** ANTI_PATTERN
**Description:**
Test methods should always start with the `test`. If there are no such methods,
the class overriding `unittest.TestCase` won't run any test.

Not preferred:
```python
import unittest

def Tests(unittest.TestCase):
    def my_test(self, arg1, arg2):
        self.assertEquals(arg1, arg2)
```

Preferred:
```python
import unittest

def Tests(unittest.TestCase):
    def test_something(self, arg1, arg2):
        self.assertEquals(arg1, arg2)
```

**Total Locations:** 1

**Locations:**
- [ ] `scripts/agent_orchestrator/tests/test_orchestrator.py:74` - Unittest class `BaseOrchestratorTest` contains no test methods

---

### [DeepSource] Use double quote to prevent globbing and word splitting (SH-2086)

**Category:** BUG_RISK
**Description:**
## Problematic code:

```sh
echo $1
for i in $*; do :; done # this one and the next one also apply to expanding arrays.
for i in $@; do :; done
```

## Correct code:

```sh
echo "$1"
for i in "$@"; do :; done # or, 'for i; do'
```
## Rationale

The first line in the problematic example looks like "print the first argument". In reality, it does a number of things:

* Split the first argument by IFS (spaces, tabs and line feeds). 
* Expand each of the resulting strings as if it were a glob. 
* Join all the resulting strings with spaces. 
* Print the result.

The second line looks like "iterate through all arguments". This line is actually shorthand for the following steps:

* Join all the arguments by the first character of IFS (space)
* Split them by IFS
* Expand each of them as globs
* Iterate on the resulting list. 

The third line skips the joining part.

Quoting variables prevents word splitting and glob expansion, and prevents the script from breaking when input contains spaces, line feeds, glob characters and such.

Strictly speaking, only expansions themselves need to be quoted, but for stylistic reasons, entire arguments with multiple variable and literal parts are often quoted as one:

```sh
$HOME/$dir/dist/bin/$file        # Unquoted (bad)
"$HOME"/"$dir"/dist/bin/"$file"  # Minimal quoting (good)
"$HOME/$dir/dist/bin/$file"      # Canonical quoting (good)
```

When quoting composite arguments, make sure to exclude globs and brace expansions, which lose their special meaning in double quotes: `"$HOME/$dir/src/*.c"` will not expand, but `"$HOME/$dir/src"/*.c` will.

Note that `$( )` starts a new context, and variables in it have to be quoted independently:

```sh
echo "This $variable is quoted $(but this $variable is not)"
echo "This $variable is quoted $(and now this "$variable" is too)"
```

### Exceptions
Sometimes you want to split on spaces, like when building a command line:

```sh
options="-j 5 -B"
make $options file
```

Just quoting this doesn't work. Instead, you should have used an array (`bash`, `ksh`, `zsh`):

```bash
options=(-j 5 -B) # ksh: set -A options -- -j 5 -B
make "${options[@]}" file
```

or a function (`POSIX`):

```sh
make_with_flags() { make -j 5 -B "$@"; }
make_with_flags file
```

To split on spaces but not perform glob expansion, `POSIX` has a `set -f` to disable globbing. You can disable word splitting by setting `IFS=''`.

Similarly, you might want an optional argument:

```sh
debug=""
[[ $1 == "--trace-commands" ]] && debug="-x"
bash $debug script
```

Quoting this doesn't work, since in the default case, `"$debug"` would expand to one empty argument while `$debug` would expand into zero arguments. In this case, you can use an array with zero or one elements as outlined above, or you can use an unquoted expansion with an alternate value:

```sh
debug=""
[[ $1 == "--trace-commands" ]] && debug="yes"
bash ${debug:+"-x"} script
```

This is better than an unquoted value because the alternative value can be properly quoted, e.g. `wget ${output:+ -o "$output"}`.

---

Here are two common cases where this warning seems unnecessary but may still be beneficial:

```sh
cmd <<< $var         # Requires quoting on Bash 3 (but not 4+)
: ${var=default}     # Should be quoted to avoid DoS when var='*/*/*/*/*/*'
```

---

**Total Locations:** 134

**Breakdown by Directory:**

#### 📂 scripts (134)
- [ ] `scripts/validate-compilation.sh:323` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:322` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:321` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:320` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:319` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:318` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:317` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:316` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:315` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:313` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:309` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:308` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:307` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:306` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:305` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:304` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:303` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:302` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:301` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:299` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:296` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:295` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:286` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:284` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:267` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:263` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:251` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:245` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:241` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:237` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:221` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:219` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:217` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:211` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:209` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:204` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:202` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:200` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:195` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:191` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:186` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:178` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:175` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:171` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:169` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:161` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:157` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:155` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:147` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:143` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:133` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:128` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:124` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:117` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:113` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:107` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:94` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:90` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:82` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:78` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:69` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:65` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:56` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:55` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:25` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:24` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation.sh:23` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:320` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:319` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:318` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:317` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:316` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:315` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:314` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:313` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:312` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:310` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:306` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:305` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:304` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:303` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:302` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:301` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:300` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:299` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:298` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:296` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:293` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:292` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:283` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:281` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:264` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:260` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:248` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:242` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:238` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:234` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:218` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:216` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:214` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:208` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:206` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:201` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:199` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:197` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:192` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:188` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:183` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:175` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:172` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:168` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:166` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:158` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:154` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:152` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:144` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:140` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:130` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:125` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:121` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:114` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:110` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:104` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:91` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:87` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:79` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:75` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:66` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:62` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:53` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:52` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:28` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:27` - Double quote to prevent globbing and word splitting
- [ ] `scripts/validate-compilation-debug.sh:26` - Double quote to prevent globbing and word splitting


---

### [DeepSource] Consider using a `( subshell )` to avoid having to `cd` back (SH-2103)

**Category:** BUG_RISK
**Description:**
When specifying a command such as `cd dir; somestuff; cd ..`, `cd dir` can fail when permissions are lacking, if `dir` was deleted, or if `dir` is actually a file.
<!--more-->
In this case, `somestuff` will run in the wrong directory and `cd ..` will thus leave you in the parent directory, which is most certainly not intended.
In a loop, this will likely cause the next `cd` to fail as well, propagating this error and running these commands far away from the intended directories.

Check `cd`s exit status and/or use subshells to limit the effects of `cd` when it fails.

### Bad Practice
```sh
for dir in */
do
  cd "$dir"
  convert index.png index.jpg
  cd ..
done
```

### Recommended:
```sh
for dir in */
do
  (
  cd "$dir" || exit
  convert index.png index.jpg
  )
done
```

or

```sh
for dir in */
do
  cd "$dir" || exit
  convert index.png index.jpg
  cd ..
done
```

## Exceptions
If you set variables that you can't use in a subshell, you will probably need to use this method. In such a case, you should definitely check the exit status of `cd`. This will also silence this suggestion.

**Total Locations:** 1

**Locations:**
- [ ] `scripts/validate-compilation-debug.sh:222` - Use a ( subshell ) to avoid having to cd back

---

### [DeepSource] Function contains unused argument (PYL-W0613)

**Category:** ANTI_PATTERN
**Description:**
An unused argument can lead to confusions. It should be removed. If this variable is necessary, name the variable `_` or start the name with `unused` or `_unused`.

<!--more-->
### Bad practice
```python
def square(x, y=1):
    return x * x

class MySubClass(MyClass):
    def __init__(self, number):
        self.value = 42  # argument `number` remains unused
```
### Preferred:
```python
def square(x):
    return x * x

class MySubClass(MyClass):
    def __init__(self, _):
        self.value = 42
```

**Total Locations:** 3

**Locations:**
- [ ] `scripts/port-blocker.py:17` - Unused argument 'frame'
- [ ] `scripts/port-blocker.py:17` - Unused argument 'sig'
- [ ] `scrape_baileys.py:20` - Unused argument 'base_url'

---

### [DeepSource] Re-defined variable from outer scope (PYL-W0621)

**Category:** ANTI_PATTERN
**Description:**
The local variable name hides the variable defined in the outer scope, making it inaccessible and might confuse.

<!--more-->

### Bad practice

```python
filename = 'myfile.txt'

def read_file(filename):  # This shadows the global `filename`
    with open(filename) as file:
        return file.readlines()
```

### Preferred:

```python
FILENAME = 'myfile.txt'  # renamed global to UPPER_CASE as convention

def read_file(filename):
    with open(filename) as file:
        return file.readlines()
```

### Bad practice

Another usual suspect of this is when you use the same parameter name inside a function as the global variable you are using. For example:

```python
def run_app(app):
    # This `app` shadows the global app...
    app.run()

if __name__ == '__main__':
    app = MyApp()  # This is a global variable!
    run_app(app)
```

### Preferred:

To avoid this re-defining of a global, consider not defining `app` as a global, but inside a `main()` function instead:

```python
def run_app(app):
    # There is no longer a global `app` variable.
    app.run()

def main():
    app = MyApp()
    run_app(app)

if __name__ == '__main__':
    main()
```

**Total Locations:** 2

**Locations:**
- [ ] `scripts/port-blocker.py:8` - Redefining name 'duration' from outer scope (line 38)
- [ ] `scripts/port-blocker.py:8` - Redefining name 'port' from outer scope (line 37)

---

### [DeepSource] Unnecessary `return await` function found (JS-0111)

**Category:** PERFORMANCE
**Description:**
Returning an awaited value (like with `return await f()`) has two problems:

 - It queues an extra microtask, blocking the callstack until `return` is executed.

 - `try` blocks only catch a rejected promise if its *`await`ed*. `return await` may introduce unexpected hidden control-flow when handling errors.

### Bad Practice

```js
async function getUserByName(name: string) {
  // find() returns a Promise<User | null >.
  // This promise should be `await`ed by the caller of `getUserByName`.
  return await db.users.find({ userName: name })
}
```

### Recommended

```js
async function getUserByName(name: string) {
  // find() returns a Promise<User | null >.
  return db.users.find({ userName: name })
}

// OR:

async function getUserByName(name: string) {
  // If we must `await` the return-value in this function
  // it's better to do it this way. This is more performant:
  const user = await db.users.find({ userName: name })
  return user;
}
```

### References

- [Return await promise vs Return promise in JavaScript](https://dmitripavlutin.com/return-await-promise-javascript/)
- [ESLint - no-return-await](https://eslint.org/docs/latest/rules/no-return-await)

**Total Locations:** 90

**Breakdown by Directory:**

#### 📂 scripts/setup (1)
- [ ] `scripts/setup/orchestrator.mjs:995` - Redundant use of `await` on a return value

#### 📂 whatsapp-web.js/src (54)
- [ ] `whatsapp-web.js/src/Client.js:2400` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:2375` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:2356` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:2353` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:2343` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:2342` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:2325` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:2324` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:2305` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:2290` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:2262` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:2247` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:2229` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:2157` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:2155` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:2144` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:2142` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:2116` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:2114` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:2094` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1949` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1938` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1899` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1857` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1838` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1837` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1820` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1819` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1775` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1663` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1614` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1601` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1584` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1411` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1399` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1389` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1380` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1370` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1345` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1335` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1312` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1293` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1275` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1263` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1251` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1239` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1164` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1143` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1130` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1118` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:1080` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:903` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:878` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/Client.js:368` - Redundant use of `await` on a return value

#### 📂 whatsapp-web.js/src/structures (30)
- [ ] `whatsapp-web.js/src/structures/Message.js:750` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Message.js:565` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Message.js:564` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Message.js:555` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Message.js:554` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Message.js:424` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Message.js:362` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Message.js:362` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Message.js:354` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Message.js:354` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/GroupNotification.js:88` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/GroupNotification.js:88` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:469` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:460` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:436` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:234` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:215` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:196` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:79` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Contact.js:203` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Contact.js:147` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Contact.js:136` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Contact.js:128` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Contact.js:120` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/ClientInfo.js:64` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Chat.js:262` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Channel.js:368` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Channel.js:339` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Channel.js:144` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Channel.js:103` - Redundant use of `await` on a return value

#### 📂 whatsapp-web.js/src/util (2)
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:93` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:82` - Redundant use of `await` on a return value

#### 📂 whatsapp-web.js/src/util/Injected (3)
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:575` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:569` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:533` - Redundant use of `await` on a return value


---

### [DeepSource] Should not have unused variables (JS-0128)

**Category:** BUG_RISK
**Description:**
Found variables that are declared but not used anywhere.

> **NOTE**: In browser applications, DeepSource recommends the use of ESModules over regular `text/javascript` scripts.
> Currently, we don't support variables that are not explicitly exported,
> and are injected into other scripts by being included in an HTML file

<!--more-->

Unused variables are most often the result of incomplete refactoring.
They can lead to confusing code and minor performance hitches.

**NOTE:** If you have intentionally left a variable unused, we suggest you to prefix the variable name with a `_` to prevent them from being flagged by DeepSource.

### Bad Practice

```js
// Write-only variables are not considered as used.
let y = 10;
y = 5;

// A variable that modifies only itself isn't considered used.
let z = 0;
z = z + 1;

// Unused argument
(function(x) {
    return 5;
})();

// Unused recursive functions also raise this issue.
function fact(n) {
    if (n < 2) return 1;
    return n * fact(n - 1);
}

// When a function definition destructures an array,
// unused entries from the array also cause warnings.
function getY([x, y]) {
    return y;
}
```

### Recommended

```js
let x = 10;
alert(x);

((arg1) => {
    return arg1;
})();

let myFunc;
myFunc = (n) => {
    // this is legal
    if (n < 0) myFunc();
};

// this is also considered legal
console.log(declaredLater);
var declaredLater;

// Only the second argument from the descructured array is used.
function getY([, y]) {
    return y;
}
```

**Total Locations:** 4

**Locations:**
- [ ] `scripts/setup/orchestrator.mjs:500` - 'redisUrl' is assigned a value but never used
- [ ] `scripts/setup/orchestrator.mjs:445` - 'runtime' is defined but never used
- [ ] `scripts/setup/core/env-file.mjs:3` - 'path' is defined but never used
- [ ] `scripts/generate-comprehensive-report.js:144` - 'index' is defined but never used

---

### [DeepSource] Variable used before definition (JS-0129)

**Category:** BUG_RISK
**Description:**
It is recommended to use a variable only after it is defined as it might produce errors at runtime.

<!--more-->

In JavaScript, prior to ES6, variable and function declarations are hoisted to the top of a scope, so it's possible to use identifiers before their formal declarations in code. This can be confusing and some believe it is best to always declare variables and functions before using them.

In ES6, block-level bindings (`let` and `const`) introduce a "temporal dead zone" where a `ReferenceError` will be thrown with any attempt to access the variable before its declaration.

### Bad Practice

```js
alert(a);
var a = 10;

f();
function f() {}

function g() {
    return b;
}
var b = 1;

{
    alert(c);
    let c = 1;
}
```

### Recommended

```js
var a;
a = 10;
alert(a);

function f() {}
f(1);

var b = 1;
function g() {
    return b;
}

{
    let c;
    c++;
}
```

**Total Locations:** 1

**Locations:**
- [ ] `scripts/watch-pairing-code.js:158` - 'shutdown' was used before it was defined

---

### [DeepSource] Found duplicate module imports (JS-0232)

**Category:** ANTI_PATTERN
**Description:**
Using a single `import` statement per module will make the code clearer because you can see everything being imported from that module on one line.

In the following example the `module` import on line 1 is repeated on line 3. These can be combined to make the list of imports more succinct.
```
import { merge } from 'module';
import something from 'another-module';
import { find } from 'module';
```

### Bad Practice

```js
import { merge } from 'module';
import something from 'another-module';
import { find } from 'module';
```

### Recommended

```js
import { merge, find } from 'module';
import something from 'another-module';
```

**Total Locations:** 1

**Locations:**
- [ ] `scripts/setup/orchestrator.mjs:178` - './ui/hotkeys.mjs' import is duplicated

---

### [SonarQube] Remove this control character. (typescript:S6324)

**Category:** Bug
**Description:**
Remove this control character.

**Total Locations:** 2

**Locations:**
- [ ] `packages/shared/src/reputation/advanced-heuristics.ts:188` - Remove this control character.
- [ ] `packages/shared/src/homoglyph.ts:25` - Remove this control character.

---

### [SonarQube] Use an asynchronous file API instead of synchronous open() in this async function. (python:S7493)

**Category:** Bug
**Description:**
Use an asynchronous file API instead of synchronous open() in this async function.

**Total Locations:** 1

**Locations:**
- [ ] `scrape_baileys.py:76` - Use an asynchronous file API instead of synchronous open() in this async function.

---

### [SonarQube] Do not perform equality checks with floating point values. (python:S1244)

**Category:** Bug
**Description:**
Do not perform equality checks with floating point values.

**Total Locations:** 1

**Locations:**
- [ ] `scripts/agent_orchestrator/mcp_server.py:252` - Do not perform equality checks with floating point values.

---

### [SonarQube] This conditional operation returns the same value whether the condition is "true" or "false". (typescript:S3923)

**Category:** Bug
**Description:**
This conditional operation returns the same value whether the condition is "true" or "false".

**Total Locations:** 2

**Locations:**
- [ ] `services/control-plane/src/__tests__/routes.test.ts:178` - This conditional operation returns the same value whether the condition is "true" or "false".
- [ ] `tests/e2e/control-plane.test.ts:110` - This conditional operation returns the same value whether the condition is "true" or "false".

---

### [SonarQube] Either remove this useless object instantiation of "Worker" or use it. (typescript:S1848)

**Category:** Bug
**Description:**
Either remove this useless object instantiation of "Worker" or use it.

**Total Locations:** 3

**Locations:**
- [ ] `services/scan-orchestrator/src/index.ts:983` - Either remove this useless object instantiation of "Worker" or use it.
- [ ] `services/scan-orchestrator/src/index.ts:1553` - Either remove this useless object instantiation of "Worker" or use it.
- [ ] `services/wa-client/src/index.ts:1983` - Either remove this useless object instantiation of "Worker" or use it.

---

### [SonarQube] Prefer using an optional chain expression instead, as it's more concise and easier to read. (typescript:S6582)

**Category:** Code Smell
**Description:**
Prefer using an optional chain expression instead, as it's more concise and easier to read.

**Total Locations:** 10

**Locations:**
- [ ] `packages/shared/src/reputation/http-fingerprint.ts:123` - Prefer using an optional chain expression instead, as it's more concise and easier to read.
- [ ] `packages/shared/src/reputation/local-threat-db.ts:103` - Prefer using an optional chain expression instead, as it's more concise and easier to read.
- [ ] `services/control-plane/src/database.ts:146` - Prefer using an optional chain expression instead, as it's more concise and easier to read.
- [ ] `services/control-plane/src/database.ts:156` - Prefer using an optional chain expression instead, as it's more concise and easier to read.
- [ ] `services/scan-orchestrator/src/database.ts:166` - Prefer using an optional chain expression instead, as it's more concise and easier to read.
- [ ] `services/scan-orchestrator/src/database.ts:176` - Prefer using an optional chain expression instead, as it's more concise and easier to read.
- [ ] `packages/shared/src/reputation/dns-intelligence.ts:undefined` - Prefer using an optional chain expression instead, as it's more concise and easier to read.
- [ ] `services/wa-client/src/index.ts:2140` - Prefer using an optional chain expression instead, as it's more concise and easier to read.
- [ ] `services/wa-client/src/index.ts:2112` - Prefer using an optional chain expression instead, as it's more concise and easier to read.
- [ ] `services/wa-client/src/index.ts:2115` - Prefer using an optional chain expression instead, as it's more concise and easier to read.

---

### [SonarQube] Member 'options' is never reassigned; mark it as `readonly`. (typescript:S2933)

**Category:** Code Smell
**Description:**
Member 'options' is never reassigned; mark it as `readonly`.

**Total Locations:** 36

**Breakdown by Directory:**

#### 📂 packages/shared/src (4)
- [ ] `packages/shared/src/database.ts:12` - Member 'db' is never reassigned; mark it as `readonly`.
- [ ] `packages/shared/src/database.ts:13` - Member 'logger' is never reassigned; mark it as `readonly`.
- [ ] `packages/shared/src/verdict-cache.ts:24` - Member 'cache' is never reassigned; mark it as `readonly`.
- [ ] `packages/shared/src/verdict-cache.ts:25` - Member 'logger' is never reassigned; mark it as `readonly`.

#### 📂 packages/shared/src/reputation (4)
- [ ] `packages/shared/src/reputation/local-threat-db.ts:19` - Member 'options' is never reassigned; mark it as `readonly`.
- [ ] `packages/shared/src/reputation/local-threat-db.ts:18` - Member 'redis' is never reassigned; mark it as `readonly`.
- [ ] `packages/shared/src/reputation/local-threat-db.ts:undefined` - Member 'feedUrl' is never reassigned; mark it as `readonly`.
- [ ] `packages/shared/src/reputation/local-threat-db.ts:undefined` - Member 'updateIntervalMs' is never reassigned; mark it as `readonly`.

#### 📂 services/control-plane/src (9)
- [ ] `services/control-plane/src/database.ts:89` - Member 'pool' is never reassigned; mark it as `readonly`.
- [ ] `services/control-plane/src/database.ts:90` - Member 'logger' is never reassigned; mark it as `readonly`.
- [ ] `services/control-plane/src/database.ts:20` - Member 'db' is never reassigned; mark it as `readonly`.
- [ ] `services/control-plane/src/database.ts:21` - Member 'logger' is never reassigned; mark it as `readonly`.
- [ ] `services/control-plane/src/index.ts:18` - Member 'store' is never reassigned; mark it as `readonly`.
- [ ] `services/control-plane/src/index.ts:19` - Member 'ttlStore' is never reassigned; mark it as `readonly`.
- [ ] `services/control-plane/src/index.ts:20` - Member 'setStore' is never reassigned; mark it as `readonly`.
- [ ] `services/control-plane/src/index.ts:21` - Member 'hashStore' is never reassigned; mark it as `readonly`.
- [ ] `services/control-plane/src/index.ts:22` - Member 'listStore' is never reassigned; mark it as `readonly`.

#### 📂 services/scan-orchestrator/src (10)
- [ ] `services/scan-orchestrator/src/database.ts:89` - Member 'pool' is never reassigned; mark it as `readonly`.
- [ ] `services/scan-orchestrator/src/database.ts:90` - Member 'logger' is never reassigned; mark it as `readonly`.
- [ ] `services/scan-orchestrator/src/database.ts:20` - Member 'db' is never reassigned; mark it as `readonly`.
- [ ] `services/scan-orchestrator/src/database.ts:21` - Member 'logger' is never reassigned; mark it as `readonly`.
- [ ] `services/scan-orchestrator/src/enhanced-security.ts:64` - Member 'localThreatDb' is never reassigned; mark it as `readonly`.
- [ ] `services/scan-orchestrator/src/index.ts:55` - Member 'store' is never reassigned; mark it as `readonly`.
- [ ] `services/scan-orchestrator/src/index.ts:56` - Member 'ttlStore' is never reassigned; mark it as `readonly`.
- [ ] `services/scan-orchestrator/src/index.ts:57` - Member 'setStore' is never reassigned; mark it as `readonly`.
- [ ] `services/scan-orchestrator/src/index.ts:58` - Member 'hashStore' is never reassigned; mark it as `readonly`.
- [ ] `services/scan-orchestrator/src/index.ts:59` - Member 'listStore' is never reassigned; mark it as `readonly`.

#### 📂 services/wa-client/src (5)
- [ ] `services/wa-client/src/index.ts:41` - Member 'store' is never reassigned; mark it as `readonly`.
- [ ] `services/wa-client/src/index.ts:42` - Member 'ttlStore' is never reassigned; mark it as `readonly`.
- [ ] `services/wa-client/src/index.ts:43` - Member 'setStore' is never reassigned; mark it as `readonly`.
- [ ] `services/wa-client/src/index.ts:44` - Member 'hashStore' is never reassigned; mark it as `readonly`.
- [ ] `services/wa-client/src/index.ts:45` - Member 'listStore' is never reassigned; mark it as `readonly`.

#### 📂 services/wa-client/src/session (2)
- [ ] `services/wa-client/src/session/sessionManager.ts:10` - Member 'redis: Redis' is never reassigned; mark it as `readonly`.
- [ ] `services/wa-client/src/session/sessionManager.ts:11` - Member 'logger: Logger' is never reassigned; mark it as `readonly`.

#### 📂 tests/integration/stubs (2)
- [ ] `tests/integration/stubs/bottleneck.ts:17` - Member 'intervalRef' is never reassigned; mark it as `readonly`.
- [ ] `tests/integration/stubs/bottleneck.ts:13` - Member 'queue' is never reassigned; mark it as `readonly`.


---

### [SonarQube] Remove this useless assignment to variable "redisUrl". (javascript:S1854)

**Category:** Code Smell
**Description:**
Remove this useless assignment to variable "redisUrl".

**Total Locations:** 1

**Locations:**
- [ ] `scripts/setup/orchestrator.mjs:500` - Remove this useless assignment to variable "redisUrl".

---

### [SonarQube] Use an object spread instead of `Object.assign` eg: `{ ...foo }`. (typescript:S6661)

**Category:** Code Smell
**Description:**
Use an object spread instead of `Object.assign` eg: `{ ...foo }`.

**Total Locations:** 2

**Locations:**
- [ ] `services/wa-client/src/index.ts:1053` - Use an object spread instead of `Object.assign` eg: `{ ...foo }`.
- [ ] `services/wa-client/src/index.ts:undefined` - Use an object spread instead of `Object.assign` eg: `{ ...foo }`.

---

### [SonarQube] Extract this nested ternary operation into an independent statement. (typescript:S3358)

**Category:** Code Smell
**Description:**
Extract this nested ternary operation into an independent statement.

**Total Locations:** 6

**Locations:**
- [ ] `services/wa-client/src/index.ts:1174` - Extract this nested ternary operation into an independent statement.
- [ ] `services/scan-orchestrator/src/index.ts:1528` - Extract this nested ternary operation into an independent statement.
- [ ] `services/wa-client/src/index.ts:1878` - Extract this nested ternary operation into an independent statement.
- [ ] `packages/shared/src/url-shortener.ts:136` - Extract this nested ternary operation into an independent statement.
- [ ] `packages/shared/src/url-shortener.ts:138` - Extract this nested ternary operation into an independent statement.
- [ ] `packages/shared/src/scoring.ts:173` - Extract this nested ternary operation into an independent statement.

---

### [SonarQube] Prefer top-level await over an async function `main` call. (javascript:S7785)

**Category:** Code Smell
**Description:**
Prefer top-level await over an async function `main` call.

**Total Locations:** 10

**Locations:**
- [ ] `scripts/explore-deepsource-schema.js:249` - Prefer top-level await over an async function `main` call.
- [ ] `scripts/fetch-security-reports.js:555` - Prefer top-level await over an async function `main` call.
- [ ] `scripts/init-sqlite.js:56` - Prefer top-level await over an async function `initSQLite` call.
- [ ] `scripts/probe-deepsource.js:433` - Prefer top-level await over an async function `probe` call.
- [ ] `scripts/deepsource-api.js:335` - Prefer top-level await over an async function `main` call.
- [ ] `scripts/setup-wizard.mjs:5` - Prefer top-level await over using a promise chain.
- [ ] `scripts/export-wwebjs-docs.mjs:214` - Prefer top-level await over using a promise chain.
- [ ] `scripts/run-migrations.js:122` - Prefer top-level await over using a promise chain.
- [ ] `scripts/run-seeds.js:33` - Prefer top-level await over using a promise chain.
- [ ] `tests/load/http-load.js:143` - Prefer top-level await over using a promise chain.

---

### [SonarQube] Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich. (shelldre:S7688)

**Category:** Code Smell
**Description:**
Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.

**Total Locations:** 49

**Breakdown by Directory:**

#### 📂 . (5)
- [ ] `setup.sh:29` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `setup.sh:31` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `setup.sh:42` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `setup.sh:8` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `setup.sh:22` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.

#### 📂 scripts (44)
- [ ] `scripts/pre-commit.sh:13` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-setup.sh:10` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-types.sh:45` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-types.sh:51` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-types.sh:57` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-types.sh:68` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/deploy-deepsource.sh:21` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/deploy-deepsource.sh:27` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/deploy-deepsource.sh:72` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/deploy-deepsource.sh:90` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/test-wa-auth.sh:32` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/test-wa-auth.sh:196` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/test-wa-auth.sh:207` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/test-wa-auth.sh:223` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation-debug.sh:38` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation-debug.sh:86` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation-debug.sh:109` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation-debug.sh:120` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation-debug.sh:198` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation-debug.sh:204` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation-debug.sh:231` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation-debug.sh:233` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation-debug.sh:247` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation-debug.sh:272` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation-debug.sh:274` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation-debug.sh:280` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation-debug.sh:295` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation.sh:35` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation.sh:89` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation.sh:112` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation.sh:123` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation.sh:201` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation.sh:207` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation.sh:234` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation.sh:236` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation.sh:250` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation.sh:275` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation.sh:277` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation.sh:283` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/validate-compilation.sh:298` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/install-wbscanner-mcp.sh:30` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/install-wbscanner-mcp.sh:85` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/install-wbscanner-mcp.sh:17` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.
- [ ] `scripts/install-wbscanner-mcp.sh:25` - Use '[[' instead of '[' for conditional tests. The '[[' construct is safer and more feature-rich.


---

### [SonarQube] Prefer top-level await over using a promise chain. (typescript:S7785)

**Category:** Code Smell
**Description:**
Prefer top-level await over using a promise chain.

**Total Locations:** 4

**Locations:**
- [ ] `scripts/replay-test-messages.ts:106` - Prefer top-level await over using a promise chain.
- [ ] `services/control-plane/src/index.ts:360` - Prefer top-level await over using a promise chain.
- [ ] `services/scan-orchestrator/src/index.ts:1631` - Prefer top-level await over using a promise chain.
- [ ] `services/wa-client/src/index.ts:2274` - Prefer top-level await over using a promise chain.

---

### [SonarQube] Add an explicit return statement at the end of the function. (shelldre:S7682)

**Category:** Code Smell
**Description:**
Add an explicit return statement at the end of the function.

**Total Locations:** 14

**Locations:**
- [ ] `scripts/validate-types.sh:19` - Add an explicit return statement at the end of the function.
- [ ] `scripts/validate-compilation-debug.sh:17` - Add an explicit return statement at the end of the function.
- [ ] `scripts/validate-compilation-debug.sh:24` - Add an explicit return statement at the end of the function.
- [ ] `scripts/validate-compilation-debug.sh:32` - Add an explicit return statement at the end of the function.
- [ ] `scripts/validate-compilation-debug.sh:37` - Add an explicit return statement at the end of the function.
- [ ] `scripts/validate-compilation-debug.sh:47` - Add an explicit return statement at the end of the function.
- [ ] `scripts/validate-compilation.sh:14` - Add an explicit return statement at the end of the function.
- [ ] `scripts/validate-compilation.sh:21` - Add an explicit return statement at the end of the function.
- [ ] `scripts/validate-compilation.sh:29` - Add an explicit return statement at the end of the function.
- [ ] `scripts/validate-compilation.sh:34` - Add an explicit return statement at the end of the function.
- [ ] `scripts/validate-compilation.sh:50` - Add an explicit return statement at the end of the function.
- [ ] `scripts/install-wbscanner-mcp.sh:8` - Add an explicit return statement at the end of the function.
- [ ] `scripts/railway-smoke-test.sh:4` - Add an explicit return statement at the end of the function.
- [ ] `scripts/railway-smoke-test.sh:68` - Add an explicit return statement at the end of the function.

---

### [SonarQube] Redirect this error message to stderr (>&2). (shelldre:S7677)

**Category:** Code Smell
**Description:**
Redirect this error message to stderr (>&2).

**Total Locations:** 3

**Locations:**
- [ ] `capture_docker_errors.sh:7` - Redirect this error message to stderr (>&2).
- [ ] `scripts/deploy-deepsource.sh:22` - Redirect this error message to stderr (>&2).
- [ ] `scripts/deploy-deepsource.sh:28` - Redirect this error message to stderr (>&2).

---

### [SonarQube] Remove the unused function parameter "base_url". (python:S1172)

**Category:** Code Smell
**Description:**
Remove the unused function parameter "base_url".

**Total Locations:** 1

**Locations:**
- [ ] `scrape_baileys.py:20` - Remove the unused function parameter "base_url".

---

### [SonarQube] Assign this positional parameter to a local variable. (shelldre:S7679)

**Category:** Code Smell
**Description:**
Assign this positional parameter to a local variable.

**Total Locations:** 8

**Locations:**
- [ ] `scripts/validate-compilation-debug.sh:27` - Assign this positional parameter to a local variable.
- [ ] `scripts/validate-compilation-debug.sh:33` - Assign this positional parameter to a local variable.
- [ ] `scripts/validate-compilation-debug.sh:38` - Assign this positional parameter to a local variable.
- [ ] `scripts/validate-compilation.sh:24` - Assign this positional parameter to a local variable.
- [ ] `scripts/validate-compilation.sh:30` - Assign this positional parameter to a local variable.
- [ ] `scripts/validate-compilation.sh:35` - Assign this positional parameter to a local variable.
- [ ] `scripts/install-wbscanner-mcp.sh:9` - Assign this positional parameter to a local variable.
- [ ] `scripts/railway-smoke-test.sh:77` - Assign this positional parameter to a local variable.

---

### [SonarQube] Extract this nested ternary operation into an independent statement. (javascript:S3358)

**Category:** Code Smell
**Description:**
Extract this nested ternary operation into an independent statement.

**Total Locations:** 4

**Locations:**
- [ ] `scripts/deepsource-api.js:241` - Extract this nested ternary operation into an independent statement.
- [ ] `scripts/ui/prompt-runner.mjs:184` - Extract this nested ternary operation into an independent statement.
- [ ] `scripts/ui/prompt-runner.mjs:197` - Extract this nested ternary operation into an independent statement.
- [ ] `scripts/ui/prompt-runner.mjs:250` - Extract this nested ternary operation into an independent statement.

---

### [SonarQube] Unexpected lexical declaration in case block. (javascript:S6836)

**Category:** Code Smell
**Description:**
Unexpected lexical declaration in case block.

**Total Locations:** 4

**Locations:**
- [ ] `scripts/deepsource-api.js:291` - Unexpected lexical declaration in case block.
- [ ] `scripts/deepsource-api.js:296` - Unexpected lexical declaration in case block.
- [ ] `scripts/deepsource-api.js:301` - Unexpected lexical declaration in case block.
- [ ] `scripts/deepsource-api.js:306` - Unexpected lexical declaration in case block.

---

### [SonarQube] Refactor this code to not use nested template literals. (javascript:S4624)

**Category:** Code Smell
**Description:**
Refactor this code to not use nested template literals.

**Total Locations:** 3

**Locations:**
- [ ] `scripts/setup/artifacts/transcript.mjs:76` - Refactor this code to not use nested template literals.
- [ ] `scripts/setup/orchestrator.mjs:641` - Refactor this code to not use nested template literals.
- [ ] `scripts/setup/ui/output.mjs:37` - Refactor this code to not use nested template literals.

---

### [SonarQube] Remove this useless assignment to variable "result". (typescript:S1854)

**Category:** Code Smell
**Description:**
Remove this useless assignment to variable "result".

**Total Locations:** 1

**Locations:**
- [ ] `services/wa-client/src/__tests__/functional/session-flow.test.ts:45` - Remove this useless assignment to variable "result".

---

### [SonarQube] Merge this if statement with the enclosing one. (shelldre:S1066)

**Category:** Code Smell
**Description:**
Merge this if statement with the enclosing one.

**Total Locations:** 1

**Locations:**
- [ ] `scripts/install-wbscanner-mcp.sh:86` - Merge this if statement with the enclosing one.

---

### [SonarQube] Replace the type hint "list[str]" with "Optional[list[str]]" or don't assign "None" to "test_commands" (python:S5890)

**Category:** Code Smell
**Description:**
Replace the type hint "list[str]" with "Optional[list[str]]" or don't assign "None" to "test_commands"

**Total Locations:** 1

**Locations:**
- [ ] `scripts/agent_orchestrator/config.py:17` - Replace the type hint "list[str]" with "Optional[list[str]]" or don't assign "None" to "test_commands"

---

### [SonarQube] This always evaluates to truthy. Consider refactoring this code. (typescript:S2589)

**Category:** Code Smell
**Description:**
This always evaluates to truthy. Consider refactoring this code.

**Total Locations:** 1

**Locations:**
- [ ] `services/wa-client/src/index.ts:undefined` - This always evaluates to truthy. Consider refactoring this code.

---

### [SonarQube] WORKDIR instruction should be used instead of "cd" command. (docker:S6597)

**Category:** Code Smell
**Description:**
WORKDIR instruction should be used instead of "cd" command.

**Total Locations:** 9

**Locations:**
- [ ] `services/control-plane/Dockerfile:10` - WORKDIR instruction should be used instead of "cd" command.
- [ ] `services/control-plane/Dockerfile:16` - WORKDIR instruction should be used instead of "cd" command.
- [ ] `services/control-plane/Dockerfile:21` - WORKDIR instruction should be used instead of "cd" command.
- [ ] `services/scan-orchestrator/Dockerfile:10` - WORKDIR instruction should be used instead of "cd" command.
- [ ] `services/scan-orchestrator/Dockerfile:16` - WORKDIR instruction should be used instead of "cd" command.
- [ ] `services/scan-orchestrator/Dockerfile:22` - WORKDIR instruction should be used instead of "cd" command.
- [ ] `services/wa-client/Dockerfile:14` - WORKDIR instruction should be used instead of "cd" command.
- [ ] `services/wa-client/Dockerfile:21` - WORKDIR instruction should be used instead of "cd" command.
- [ ] `services/wa-client/Dockerfile:26` - WORKDIR instruction should be used instead of "cd" command.

---

### [SonarQube] Prefer `return value` over `return Promise.resolve(value)`. (typescript:S7746)

**Category:** Code Smell
**Description:**
Prefer `return value` over `return Promise.resolve(value)`.

**Total Locations:** 1

**Locations:**
- [ ] `services/scan-orchestrator/src/index.ts:188` - Prefer `return value` over `return Promise.resolve(value)`.

---

### [SonarQube] Review this redundant assignment: "j" already holds the assigned value along all execution paths. (typescript:S4165)

**Category:** Code Smell
**Description:**
Review this redundant assignment: "j" already holds the assigned value along all execution paths.

**Total Locations:** 1

**Locations:**
- [ ] `packages/shared/src/homoglyph.ts:241` - Review this redundant assignment: "j" already holds the assigned value along all execution paths.

---

### [SonarQube] Move function 'isWithinArtifactRoot' to the outer scope. (typescript:S7721)

**Category:** Code Smell
**Description:**
Move function 'isWithinArtifactRoot' to the outer scope.

**Total Locations:** 1

**Locations:**
- [ ] `services/control-plane/src/index.ts:278` - Move function 'isWithinArtifactRoot' to the outer scope.

---

### [SonarQube] Either use this collection's contents or remove the collection. (typescript:S4030)

**Category:** Code Smell
**Description:**
Either use this collection's contents or remove the collection.

**Total Locations:** 1

**Locations:**
- [ ] `packages/shared/src/__tests__/circuit-breaker.test.ts:76` - Either use this collection's contents or remove the collection.

---

### [SonarQube] Unnecessary escape character: \[. (typescript:S6535)

**Category:** Code Smell
**Description:**
Unnecessary escape character: \[.

**Total Locations:** 1

**Locations:**
- [ ] `packages/shared/src/url.ts:13` - Unnecessary escape character: \[.

---

### [SonarQube] Replace this character class by the character itself. (javascript:S6397)

**Category:** Code Smell
**Description:**
Replace this character class by the character itself.

**Total Locations:** 1

**Locations:**
- [ ] `scripts/export-wwebjs-docs.mjs:36` - Replace this character class by the character itself.

---

### [SonarQube] Unnecessary escape character: \/. (javascript:S6535)

**Category:** Code Smell
**Description:**
Unnecessary escape character: \/.

**Total Locations:** 1

**Locations:**
- [ ] `scripts/export-wwebjs-docs.mjs:36` - Unnecessary escape character: \/.

---

### [SonarQube] Refactor this code to not use nested template literals. (typescript:S4624)

**Category:** Code Smell
**Description:**
Refactor this code to not use nested template literals.

**Total Locations:** 1

**Locations:**
- [ ] `services/wa-client/src/index.ts:2071` - Refactor this code to not use nested template literals.

---

## MEDIUM Priority Issues (16)

### [SonarQube] Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service. (typescript:S5852)

**Category:** Security Hotspot
**Description:**
Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.

**Total Locations:** 8

**Locations:**
- [ ] `packages/shared/src/url-shortener.ts:103` - Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.
- [ ] `services/scan-orchestrator/src/__tests__/fallback.test.ts:141` - Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.
- [ ] `services/scan-orchestrator/src/index.ts:492` - Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.
- [ ] `services/scan-orchestrator/src/index.ts:527` - Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.
- [ ] `services/scan-orchestrator/src/index.ts:916` - Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.
- [ ] `services/scan-orchestrator/src/urlscan-artifacts.ts:52` - Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.
- [ ] `services/wa-client/src/index.ts:792` - Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.
- [ ] `services/wa-client/src/remoteAuthStore.ts:33` - Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.

---

### [SonarQube] The "node" image runs with "root" as the default user. Make sure it is safe here. (docker:S6471)

**Category:** Security Hotspot
**Description:**
The "node" image runs with "root" as the default user. Make sure it is safe here.

**Total Locations:** 1

**Locations:**
- [ ] `scripts/Dockerfile.migrate:1` - The "node" image runs with "root" as the default user. Make sure it is safe here.

---

### [SonarQube] Make sure granting write access to others is safe here. (docker:S2612)

**Category:** Security Hotspot
**Description:**
Make sure granting write access to others is safe here.

**Total Locations:** 1

**Locations:**
- [ ] `scripts/Dockerfile.migrate:24` - Make sure granting write access to others is safe here.

---

### [SonarQube] Make sure that using this pseudorandom number generator is safe here. (javascript:S2245)

**Category:** Security Hotspot
**Description:**
Make sure that using this pseudorandom number generator is safe here.

**Total Locations:** 1

**Locations:**
- [ ] `scripts/watch-pairing-code.js:162` - Make sure that using this pseudorandom number generator is safe here.

---

### [SonarQube] Make sure that using this pseudorandom number generator is safe here. (typescript:S2245)

**Category:** Security Hotspot
**Description:**
Make sure that using this pseudorandom number generator is safe here.

**Total Locations:** 5

**Locations:**
- [ ] `packages/shared/src/reputation/virustotal.ts:100` - Make sure that using this pseudorandom number generator is safe here.
- [ ] `services/wa-client/src/index.ts:849` - Make sure that using this pseudorandom number generator is safe here.
- [ ] `services/wa-client/src/index.ts:977` - Make sure that using this pseudorandom number generator is safe here.
- [ ] `services/wa-client/src/index.ts:1008` - Make sure that using this pseudorandom number generator is safe here.
- [ ] `services/wa-client/src/index.ts:2001` - Make sure that using this pseudorandom number generator is safe here.

---

## MINOR Priority Issues (231)

### [DeepSource] Subprocess run with ignored non-zero exit (PYL-W1510)

**Category:** BUG_RISK
**Description:**
`subprocess.run` uses a default of `check=False`, which means that a nonzero exit code will be
ignored by default, instead of raising an exception.

You can ignore this issue if this behaviour is intended.

<!--more-->

### Bad practice
```python
# Nonzero exit code will be ignored here
subprocess.run(['notify-send', '-u', 'critical', msg])
```

### Recommended
```python
# Exception will be raised for nonzero exit code
subprocess.run(['notify-send', '-u', 'critical', msg], check=True) # some comment
```

**Autofix Available:** Yes

**Total Locations:** 8

**Locations:**
- [ ] `scripts/agent_orchestrator/main.py:515` - 'subprocess.run' used without explicitly defining the value for 'check'.
- [ ] `scripts/agent_orchestrator/main.py:506` - 'subprocess.run' used without explicitly defining the value for 'check'.
- [ ] `scripts/agent_orchestrator/main.py:497` - 'subprocess.run' used without explicitly defining the value for 'check'.
- [ ] `scripts/agent_orchestrator/main.py:481` - 'subprocess.run' used without explicitly defining the value for 'check'.
- [ ] `scripts/agent_orchestrator/main.py:465` - 'subprocess.run' used without explicitly defining the value for 'check'.
- [ ] `scripts/agent_orchestrator/main.py:418` - 'subprocess.run' used without explicitly defining the value for 'check'.
- [ ] `scripts/agent_orchestrator/agents.py:111` - 'subprocess.run' used without explicitly defining the value for 'check'.
- [ ] `scripts/agent_orchestrator/agents.py:55` - 'subprocess.run' used without explicitly defining the value for 'check'.

---

### [DeepSource] Found unused expressions (JS-0093)

**Category:** BUG_RISK
**Description:**
An unused expression that does not affect the state of the program indicates a logic error.

<!--more-->

For example, if a programmer wants to increment the value of a variable `a` by one, and intends to do so through this code:

```js
let a = 0
a = a + 1
console.log(a) // output 1
```

But because of a typo, writes the following:

```js
let a = 0
a + 1
console.log(a)
```

Here, the expression `a + 1` does nothing meaningful in the program's runtime.
The expression is thus considered "unused" and should be removed.

### Bad Practice

```js
0

if(0) 0

{0}

f(0), {}

a, b()

c = a, b;

a() && function namedFunctionInExpressionContext () {f();}

(function anIncompleteIIFE () {});

injectGlobal`body{ color: red; }`

```


### Recommended

```js
{} // In this context, this is a block statement, not an object literal

{myLabel: someVar} // In this context, this is a block statement with a label and expression, not an object literal

function namedFunctionDeclaration () {}

(function aGenuineIIFE () {}());

f()

a = 0

new C

delete a.b

void a
```

**Autofix Available:** Yes

**Total Locations:** 27

**Breakdown by Directory:**

#### 📂 packages/shared/src/__tests__ (1)
- [ ] `packages/shared/src/__tests__/config.test.ts:70` - Found unused expression

#### 📂 whatsapp-web.js/src (9)
- [ ] `whatsapp-web.js/src/Client.js:1935` - Found unused expression
- [ ] `whatsapp-web.js/src/Client.js:1931` - Found unused expression
- [ ] `whatsapp-web.js/src/Client.js:1869` - Found unused expression
- [ ] `whatsapp-web.js/src/Client.js:1710` - Found unused expression
- [ ] `whatsapp-web.js/src/Client.js:1688` - Found unused expression
- [ ] `whatsapp-web.js/src/Client.js:1660` - Found unused expression
- [ ] `whatsapp-web.js/src/Client.js:971` - Found unused expression
- [ ] `whatsapp-web.js/src/Client.js:964` - Found unused expression
- [ ] `whatsapp-web.js/src/Client.js:884` - Found unused expression

#### 📂 whatsapp-web.js/src/structures (10)
- [ ] `whatsapp-web.js/src/structures/Message.js:683` - Found unused expression
- [ ] `whatsapp-web.js/src/structures/Message.js:676` - Found unused expression
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:310` - Found unused expression
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:180` - Found unused expression
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:124` - Found unused expression
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:83` - Found unused expression
- [ ] `whatsapp-web.js/src/structures/Channel.js:168` - Found unused expression
- [ ] `whatsapp-web.js/src/structures/Channel.js:134` - Found unused expression
- [ ] `whatsapp-web.js/src/structures/Channel.js:123` - Found unused expression
- [ ] `whatsapp-web.js/src/structures/Channel.js:106` - Found unused expression

#### 📂 whatsapp-web.js/src/util/Injected (7)
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:1078` - Found unused expression
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:1030` - Found unused expression
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:1007` - Found unused expression
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:655` - Found unused expression
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:612` - Found unused expression
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:84` - Found unused expression
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:48` - Found unused expression


---

### [DeepSource] Found trailing undefined in function call (JS-W1042)

**Category:** ANTI_PATTERN
**Description:**
When an argument is omitted from a function call, it will default to `undefined`.
It is therefore redundant to explicitly pass an `undefined` literal as the last argument.

### Bad Practice

```typescript
function hasOptionalParam(a: number, b?: number) {
  // ...
}

hasOptionalParam(1, undefined)
```

### Recommended

```typescript
function hasOptionalParam(a: number, b?: number) {
  // ...
}

hasOptionalParam(1)
hasOptionalParam(1, 2)
```

**Autofix Available:** Yes

**Total Locations:** 3

**Locations:**
- [ ] `whatsapp-web.js/tests/structures/group.js:42` - Remove redundant `undefined` from function call
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:922` - Remove redundant `undefined` from function call
- [ ] `scripts/jest-env-setup.js:22` - Remove redundant `undefined` from function call

---

### [DeepSource] Logical operator can be refactored to optional chain (JS-W1044)

**Category:** ANTI_PATTERN
**Description:**
The [optional chaining](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining)
operator can be used to perform null checks before accessing a property, or calling a function.

Using `&&` for this purpose is no longer required.

### Bad Practice

```typescript
function getUsernameFromId(id: number): string | undefined {
  const user = db.getUser(id)
  return user && user.name
}

someFunc && someFunc()
//        ^~~~ not necessary

maybeArray && maybeArray[index]
//          ^~~~ not necessary
```

### Recommended

```typescript
function getUsernameFromId(id: number): string | undefined {
  const user = db.getUser(id)
  return user?.name
}

someFunc?.()

maybeArray?.[index]
```

**Autofix Available:** Yes

**Total Locations:** 42

**Breakdown by Directory:**

#### 📂 packages/shared/src/reputation (2)
- [ ] `packages/shared/src/reputation/local-threat-db.ts:103` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `packages/shared/src/reputation/http-fingerprint.ts:123` - Prefer using an optional chain expression instead, as it's more concise and easier to read

#### 📂 scripts (10)
- [ ] `scripts/validate-config.js:19` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `scripts/run-migrations.js:8` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `scripts/probe-deepsource.js:395` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `scripts/probe-deepsource.js:380` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `scripts/probe-deepsource.js:313` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `scripts/probe-deepsource.js:287` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `scripts/export-wwebjs-docs.mjs:144` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `scripts/export-wwebjs-docs.mjs:137` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `scripts/export-wwebjs-docs.mjs:26` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `scripts/explore-deepsource-schema.js:111` - Prefer using an optional chain expression instead, as it's more concise and easier to read

#### 📂 scripts/setup (5)
- [ ] `scripts/setup/orchestrator.mjs:1171` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `scripts/setup/orchestrator.mjs:787` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `scripts/setup/orchestrator.mjs:760` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `scripts/setup/orchestrator.mjs:730` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `scripts/setup/orchestrator.mjs:692` - Prefer using an optional chain expression instead, as it's more concise and easier to read

#### 📂 scripts/ui (1)
- [ ] `scripts/ui/prompt-runner.mjs:14` - Prefer using an optional chain expression instead, as it's more concise and easier to read

#### 📂 services/control-plane/src (2)
- [ ] `services/control-plane/src/database.ts:156` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `services/control-plane/src/database.ts:146` - Prefer using an optional chain expression instead, as it's more concise and easier to read

#### 📂 services/scan-orchestrator/src (2)
- [ ] `services/scan-orchestrator/src/database.ts:176` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `services/scan-orchestrator/src/database.ts:166` - Prefer using an optional chain expression instead, as it's more concise and easier to read

#### 📂 services/wa-client/src (3)
- [ ] `services/wa-client/src/index.ts:2140` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `services/wa-client/src/index.ts:2115` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `services/wa-client/src/index.ts:2112` - Prefer using an optional chain expression instead, as it's more concise and easier to read

#### 📂 whatsapp-web.js/src (3)
- [ ] `whatsapp-web.js/src/Client.js:2249` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `whatsapp-web.js/src/Client.js:1206` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `whatsapp-web.js/src/Client.js:858` - Prefer using an optional chain expression instead, as it's more concise and easier to read

#### 📂 whatsapp-web.js/src/authStrategies (1)
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:119` - Prefer using an optional chain expression instead, as it's more concise and easier to read

#### 📂 whatsapp-web.js/src/structures (1)
- [ ] `whatsapp-web.js/src/structures/Message.js:287` - Prefer using an optional chain expression instead, as it's more concise and easier to read

#### 📂 whatsapp-web.js/src/util/Injected (12)
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:820` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:608` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:491` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:245` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:180` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `whatsapp-web.js/src/util/Injected/LegacyStore.js:110` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `whatsapp-web.js/src/util/Injected/LegacyStore.js:35` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `whatsapp-web.js/src/util/Injected/LegacyStore.js:34` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `whatsapp-web.js/src/util/Injected/LegacyStore.js:24` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `whatsapp-web.js/src/util/Injected/LegacyStore.js:23` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `whatsapp-web.js/src/util/Injected/LegacyStore.js:11` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `whatsapp-web.js/src/util/Injected/LegacyStore.js:7` - Prefer using an optional chain expression instead, as it's more concise and easier to read


---

### [DeepSource] Useless template literal found (JS-R1004)

**Category:** ANTI_PATTERN
**Description:**
Template literals are useful when you need:

1. [Interpolated strings](https://en.wikipedia.org/wiki/String_interpolation).

2. Strings that have unescaped double quotes **and** single quotes.

3. Strings that need line breaks in them.

If neither of these three conditions is met,
you can replace the template expression with a regular string literal.

### Bad Practice

```js
const dialogue = `"Journey before destination", said Dalinar.`
const dialogue2 = `What is a 'Kwisatz Haderach'?`
```

### Recommended

```js
const dialogue = '"Journey before destination", said Dalinar.'
const dialogue2 = "What is a 'Kwisatz Haderach'?"
const dialogue3 = `"${getLine()}", said ${getChararcter()}`
```

**Autofix Available:** Yes

**Total Locations:** 19

**Breakdown by Directory:**

#### 📂 scripts (6)
- [ ] `scripts/generate-comprehensive-report.js:156` - Template string can be replaced with regular string literal
- [ ] `scripts/generate-comprehensive-report.js:149` - Template string can be replaced with regular string literal
- [ ] `scripts/generate-comprehensive-report.js:107` - Template string can be replaced with regular string literal
- [ ] `scripts/generate-comprehensive-report.js:106` - Template string can be replaced with regular string literal
- [ ] `scripts/generate-comprehensive-report.js:103` - Template string can be replaced with regular string literal
- [ ] `scripts/fetch-security-reports.js:516` - Template string can be replaced with regular string literal

#### 📂 scripts/setup/artifacts (10)
- [ ] `scripts/setup/artifacts/transcript.mjs:104` - Template string can be replaced with regular string literal
- [ ] `scripts/setup/artifacts/transcript.mjs:100` - Template string can be replaced with regular string literal
- [ ] `scripts/setup/artifacts/transcript.mjs:99` - Template string can be replaced with regular string literal
- [ ] `scripts/setup/artifacts/transcript.mjs:97` - Template string can be replaced with regular string literal
- [ ] `scripts/setup/artifacts/transcript.mjs:96` - Template string can be replaced with regular string literal
- [ ] `scripts/setup/artifacts/transcript.mjs:92` - Template string can be replaced with regular string literal
- [ ] `scripts/setup/artifacts/transcript.mjs:91` - Template string can be replaced with regular string literal
- [ ] `scripts/setup/artifacts/transcript.mjs:77` - Template string can be replaced with regular string literal
- [ ] `scripts/setup/artifacts/transcript.mjs:70` - Template string can be replaced with regular string literal
- [ ] `scripts/setup/artifacts/transcript.mjs:69` - Template string can be replaced with regular string literal

#### 📂 services/scan-orchestrator/src (2)
- [ ] `services/scan-orchestrator/src/index.ts:1604` - Template string can be replaced with regular string literal
- [ ] `services/scan-orchestrator/src/index.ts:1591` - Template string can be replaced with regular string literal

#### 📂 services/wa-client/src (1)
- [ ] `services/wa-client/src/index.ts:2252` - Template string can be replaced with regular string literal


---

### [DeepSource] Prefer adding `u` flag in regular expressions (JS-0117)

**Category:** ANTI_PATTERN
**Description:**
It is recommended to use the `u` flag with regular expressions.

<!--more-->

The `u` flag has two effects:
- It enables correct handling of  UTF-16 surrogate pairs.
- It ensures the correct behavior of regex character ranges.

```js
/^[👍]$/.test("👍") //→ false
/^[👍]$/u.test("👍") //→ true
```

For historical reasons, JavaScript regular expressions tolerate syntax errors.
For example, `/\w{1, 2/` is a regex that would throw a syntax error, but JavaScript chooses not to.
It matches strings such as `"a{1, 2"` instead.
This behaviour is defined in Annex B of the Javascript specification.

The `u` flag disables the recovering logic `Annex B` of the Javascript specification.
This way, you can find errors early.
It can therefore be thought of as a "strict mode" for RegEx literals.

This issue is raised when:
- A regular expression contains unicode property escapes i.e `\p{<property-name>}`
- A regular expression contains 4 bytes characters like emojis or some special characters

### Bad Practice

```js
const a = /aaa/
const b = /bbb/gi
const c = new RegExp("ccc")
const d = new RegExp("ddd", "gi")
```

### Recommended

```js
const a = /aaa/u
const b = /bbb/giu
const c = new RegExp("ccc", "u")
const d = new RegExp("ddd", "giu")

// This rule ignores RegExp calls if the flags are not a compile time constant.
function f(flags) {
    return new RegExp("eee", flags)
}
```


## References

- [Regular Expressions Patterns](https://www.ecma-international.org/ecma-262/6.0/#sec-regular-expressions-patterns)
- [JavaScript strict mode](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode)
- [Unicode properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions/Unicode_Property_Escapes)

**Autofix Available:** Yes

**Total Locations:** 3

**Locations:**
- [ ] `packages/shared/src/url.ts:13` - Use the 'u' flag with regular expressions
- [ ] `packages/shared/src/reputation/advanced-heuristics.ts:188` - Use the 'u' flag with regular expressions
- [ ] `packages/shared/src/homoglyph.ts:25` - Use the 'u' flag with regular expressions

---

### [DeepSource] Unnecessary calls to `.bind()` (JS-0062)

**Category:** ANTI_PATTERN
**Description:**
The bind() method is used to create functions with specific `this` values and, optionally, binds arguments to specific values.
When used to specify the value of `this`, it's important that the function actually uses `this` in its function body.

### Bad Practice

```
// useless bind
const boundGetName = (function getName() {
    return "ESLint"; // correct way -> return this.name;
}).bind({ name: "ESLint" });

console.log(boundGetName());      // "ESLint"
```

```js
let x = function () {
    foo();
}.bind(bar);

x = (() => foo()).bind(bar);
x = (() => this.foo()).bind(bar);

x = function () {
    (function () {
      this.foo();
    }());
}.bind(bar);

x = function () {
    function foo() {
      this.bar();
    }
}.bind(baz);
```

### Recommended

```js
let x = (function () {
    this.foo();
}).bind({ foo() { console.log("foo") }  } );

// no uneccessary `bind`s
function f(a) {
    return a + 1;
}
```

**Autofix Available:** Yes

**Total Locations:** 3

**Locations:**
- [ ] `whatsapp-web.js/src/Client.js:810` - The function binding is unnecessary
- [ ] `whatsapp-web.js/src/Client.js:796` - The function binding is unnecessary
- [ ] `whatsapp-web.js/src/Client.js:763` - The function binding is unnecessary

---

### [DeepSource] Found leading or trailing decimal points in numeric literals (JS-0065)

**Category:** ANTI_PATTERN
**Description:**
`Float` values in JavaScript contain a decimal point, and there is no requirement that the decimal point be preceded or followed by a number.
For example, the following are all valid JavaScript numbers:

```js
let num = .5;
num = 2.;
num = -.7;
```
Although not a syntax error, this format for numbers can make it difficult to distinguish between true decimal numbers and the dot operator.
For this reason, some recommend that you should always include a number before and after a decimal point to make it clear the intent is to create a decimal number.

### Bad Practice
```js
let num = .5;
num = 2.;
num = -.7;
```

### Recommended
```js
let num = 0.5;
num = 2.0;
num = -0.7;
```

**Autofix Available:** Yes

**Total Locations:** 1

**Locations:**
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:851` - A leading decimal point can be confused with a dot

---

### [DeepSource] Found shorthand type coercions (JS-0066)

**Category:** ANTI_PATTERN
**Description:**
Prefer using explicit casts by calling `Number`, `Boolean`, or `String` over using operators like `+`, `!!` or `"" +`.
This is considered best practice as it improves readability.

### Bad Practice
```js
const b = !!foo;
// The `+` operator does not change the value of its operand
// unless it's already a number.
let n = +foo;
n = 1 * foo;
const s = "" + foo;
```

### Recommended

```js
const b = Boolean(foo);
const n = Number(foo);
const s = String(foo);
```

**Autofix Available:** Yes

**Total Locations:** 15

**Locations:**
- [ ] `whatsapp-web.js/src/util/Puppeteer.js:15` - use `Boolean(window[name])` instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:1065` - use `Number(error)` instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:988` - use `Number(code)` instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:983` - use `Number(code)` instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:976` - use `Number(code)` instead
- [ ] `whatsapp-web.js/src/structures/Chat.js:64` - use `Boolean(data.pin)` instead
- [ ] `services/wa-client/src/index.ts:1884` - use `Boolean(botWid)` instead
- [ ] `packages/shared/src/url.ts:79` - use `Boolean(t.publicSuffix)` instead
- [ ] `packages/shared/src/reputation/http-fingerprint.ts:70` - use `Boolean(headers['x-content-type-options'])` instead
- [ ] `packages/shared/src/reputation/http-fingerprint.ts:69` - use `Boolean(headers['x-frame-options'])` instead
- [ ] `packages/shared/src/reputation/http-fingerprint.ts:68` - use `Boolean(headers['content-security-policy'])` instead
- [ ] `packages/shared/src/reputation/http-fingerprint.ts:67` - use `Boolean(headers['strict-transport-security'])` instead
- [ ] `packages/shared/src/config.ts:94` - use `Boolean(process.env.PHISHTANK_APP_KEY)` instead
- [ ] `packages/shared/src/config.ts:84` - use `Boolean(process.env.GSB_API_KEY)` instead
- [ ] `packages/shared/src/config.ts:77` - use `Boolean(process.env.VT_API_KEY)` instead

---

### [DeepSource] Use shorthand property syntax for object literals (JS-0240)

**Category:** ANTI_PATTERN
**Description:**
ECMAScript 6 provides a concise form for defining object literal methods and properties.
This syntax can make defining complex object literals much cleaner.

Here are a few common examples using the ES5 syntax:
```
const x = 1, y = 2, z = 3;
// properties
const foo = {
    x: x,
    y: y,
    z: z,
};

// methods
const foo = {
    a: function() {},
    b: function() {}
};
```

The ES6 equivalent syntax is::
```
// properties
const foo = {x, y, z};

// methods
const bar = {
    a() { return 1 },
    b() { return 2 }
};
```

**NOTE:** The shorthand properties are equivalent to function expressions.
Meaning that they do not bind their own `this` inside their bodies.
It is still possible to access properties from the object inside a shorthand member function:

```js
const object = {
    x: 1,
    getX() {
        return this.x // valid
    }
}
```

### Bad Practice

```js
const foo = {
    bar: function () { return 1 }
};
```

### Recommended

```js
const foo = {
    bar() { return 1 }
}
```

**Total Locations:** 23

**Breakdown by Directory:**

#### 📂 packages/shared/src/reputation (1)
- [ ] `packages/shared/src/reputation/whodat.ts:99` - Expected property shorthand

#### 📂 whatsapp-web.js/src (10)
- [ ] `whatsapp-web.js/src/Client.js:1924` - Expected property shorthand
- [ ] `whatsapp-web.js/src/Client.js:1923` - Expected property shorthand
- [ ] `whatsapp-web.js/src/Client.js:1922` - Expected property shorthand
- [ ] `whatsapp-web.js/src/Client.js:1805` - Expected property shorthand
- [ ] `whatsapp-web.js/src/Client.js:1795` - Expected property shorthand
- [ ] `whatsapp-web.js/src/Client.js:1794` - Expected property shorthand
- [ ] `whatsapp-web.js/src/Client.js:1745` - Expected property shorthand
- [ ] `whatsapp-web.js/src/Client.js:1732` - Expected property shorthand
- [ ] `whatsapp-web.js/src/Client.js:1729` - Expected property shorthand
- [ ] `whatsapp-web.js/src/Client.js:1700` - Expected property shorthand

#### 📂 whatsapp-web.js/src/structures (3)
- [ ] `whatsapp-web.js/src/structures/Message.js:729` - Expected property shorthand
- [ ] `whatsapp-web.js/src/structures/Message.js:512` - Expected property shorthand
- [ ] `whatsapp-web.js/src/structures/Contact.js:189` - Expected property shorthand

#### 📂 whatsapp-web.js/src/util (2)
- [ ] `whatsapp-web.js/src/util/Util.js:127` - Expected property shorthand
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:54` - Expected property shorthand

#### 📂 whatsapp-web.js/src/util/Injected (7)
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:533` - Expected property shorthand
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:302` - Expected property shorthand
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:253` - Expected property shorthand
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:250` - Expected property shorthand
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:206` - Expected property shorthand
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:103` - Expected property shorthand
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:102` - Expected property shorthand


---

### [DeepSource] Use `const` declarations for variables that are never reassigned (JS-0242)

**Category:** ANTI_PATTERN
**Description:**
Variables that are never re-assigned a new value after their initial declaration should be declared with the `const` keyword.
This prevents the programmer from erroneously re-assigning to a read-only variable, and informs those reading the code that a variable is a constant value.

### Bad Practice

```js
let pi = Math.PI

for (let x of xs) {
  use(x);
}

let { a, b } = object;
use(a, b);
```

### Recommended

```js
const pi = Math.PI

for (const x of xs) {
  use(x);
}

const { a, b } = object;
use(a, b);
```

**Total Locations:** 69

**Breakdown by Directory:**

#### 📂 scripts/setup (1)
- [ ] `scripts/setup/orchestrator.mjs:629` - 'removedLogs' is never reassigned. Use 'const' instead

#### 📂 tests/load (1)
- [ ] `tests/load/http-load.js:54` - 'statusCodes' is never reassigned. Use 'const' instead

#### 📂 whatsapp-web.js (16)
- [ ] `whatsapp-web.js/example.js:596` - 'rejectCalls' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/example.js:469` - 'deviceCount' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/example.js:399` - 'labels' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/example.js:365` - 'list' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/example.js:362` - 'sections' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/example.js:359` - 'button' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/example.js:218` - 'info' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/example.js:201` - 'chat' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/example.js:114` - 'chat' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/example.js:107` - 'newDescription' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/example.js:105` - 'chat' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/example.js:92` - 'newSubject' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/example.js:90` - 'chat' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/example.js:84` - 'chat' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/example.js:82` - 'message' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/example.js:81` - 'messageIndex' is never reassigned. Use 'const' instead

#### 📂 whatsapp-web.js/src (19)
- [ ] `whatsapp-web.js/src/Client.js:2430` - 'pollVotes' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/Client.js:2407` - 'serialized' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/Client.js:2084` - 'actions' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/Client.js:2037` - 'chatIds' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/Client.js:1499` - 'chat' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/Client.js:1447` - 'chat' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/Client.js:1431` - 'maxPinned' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/Client.js:1424` - 'chat' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/Client.js:1412` - 'chat' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/Client.js:1400` - 'chat' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/Client.js:1334` - 'userWid' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/Client.js:1333` - 'groupId' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/Client.js:1333` - 'fromId' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/Client.js:1333` - 'inviteCode' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/Client.js:1333` - 'inviteCodeExp' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/Client.js:1205` - 'messagesObject' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/Client.js:1190` - 'contact' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/Client.js:1177` - 'contacts' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/Client.js:973` - 'internalOptions' is never reassigned. Use 'const' instead

#### 📂 whatsapp-web.js/src/authStrategies (1)
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:81` - 'pathExists' is never reassigned. Use 'const' instead

#### 📂 whatsapp-web.js/src/structures (11)
- [ ] `whatsapp-web.js/src/structures/Product.js:55` - 'result' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/structures/Message.js:699` - 'canEdit' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/structures/Message.js:685` - 'internalOptions' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/structures/Message.js:542` - 'chat' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/structures/Message.js:529` - 'chat' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/structures/Message.js:161` - 'splitted' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:278` - 'newId' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:277` - 'descId' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:103` - 'groupParticipants' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/structures/Chat.js:193` - 'messages' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/structures/Channel.js:290` - 'messages' is never reassigned. Use 'const' instead

#### 📂 whatsapp-web.js/src/util (5)
- [ ] `whatsapp-web.js/src/util/Util.js:167` - 'exif' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Util.js:166` - 'jsonBuffer' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Util.js:165` - 'exifAttr' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:40` - 'chat' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:29` - 'chat' is never reassigned. Use 'const' instead

#### 📂 whatsapp-web.js/src/util/Injected (15)
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:1000` - 'result' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:829` - 'userId' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:819` - 'product' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:818` - 'sellerId' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:791` - 'res' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:762` - 'chat' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:753` - 'chat' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:705` - 'buffer' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:650` - 'contact' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:623` - 'res' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:387` - 'mediaKey' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:386` - 'filehash' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:152` - 'vcards' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:151` - 'contacts' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:143` - 'contact' is never reassigned. Use 'const' instead


---

### [DeepSource] Require template literals instead of string concatenation (JS-0246)

**Category:** ANTI_PATTERN
**Description:**
In ES2015 (ES6), we can use template literals instead of string concatenation.
```
var str = `Hello, ${name}!`;
```

### Bad Practice

```js
var str = "Hello, " + name + "!";
var str = "Time: " + (12 * 60 * 60 * 1000);
```

### Recommended

```js
var str = "Hello World!";
var str = `Hello, ${name}!`;
var str = `Time: ${12 * 60 * 60 * 1000}`;

var str = "Hello, " + "World!";
```

**Total Locations:** 10

**Locations:**
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:829` - Unexpected string concatenation
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:828` - Unexpected string concatenation
- [ ] `whatsapp-web.js/src/util/Injected/AuthStore/LegacyAuthStore.js:6` - Unexpected string concatenation
- [ ] `whatsapp-web.js/src/Client.js:335` - Unexpected string concatenation
- [ ] `whatsapp-web.js/src/Client.js:185` - Unexpected string concatenation
- [ ] `whatsapp-web.js/example.js:286` - Unexpected string concatenation
- [ ] `whatsapp-web.js/example.js:286` - Unexpected string concatenation
- [ ] `whatsapp-web.js/example.js:282` - Unexpected string concatenation
- [ ] `whatsapp-web.js/example.js:62` - Unexpected string concatenation
- [ ] `whatsapp-web.js/example.js:59` - Unexpected string concatenation

---

### [DeepSource] Detected the `delete` operator with computed key expressions (JS-0320)

**Category:** ANTI_PATTERN
**Description:**
Deleting dynamically computed keys can be dangerous and in some cases not well optimized.

<!-- more -->
Using the `delete` operator on keys that aren't runtime constants could be a sign that you're using the wrong data structures.
Using `Objects` with added and removed keys can cause occasional edge case bugs, such as if a key is named `"hasOwnProperty"`.
Consider using a `Map` or `Set` if you’re storing collections of objects.

### Bad Practice
```ts
// Can be replaced with the constant equivalents, such as container.aaa
delete container['aaa'];
delete container['Infinity'];

// Dynamic, difficult-to-reason-about lookups
const name = 'name';
delete container[name];
delete container[name.toUpperCase()];
```

### Recommended
```ts
const container: { [i: string]: number } = {
  /* ... */
};

// Constant runtime lookups by string index
delete container.aaa;

// Constants that must be accessed by []
delete container[7];
delete container['-Infinity'];
```

**Total Locations:** 1

**Locations:**
- [ ] `services/wa-client/src/state/messageStore.ts:182` - Do not delete dynamically computed property keys

---

### [DeepSource] Detected empty functions (JS-0321)

**Category:** ANTI_PATTERN
**Description:**
Having empty functions hurts readability, and is considered a code-smell.
There's almost always a way to avoid using them.
If you must use one, consider adding a comment to inform the reader of its purpose.

### Bad Practice

```ts
getUser('SwaGaLisTiQuE', () => {})
```

### Recommended

```ts
getUser('SwaGaLisTiQuE', () => {
    // empty because <reason>
})
```

**Total Locations:** 9

**Locations:**
- [ ] `tests/e2e/control-plane.test.ts:22` - Unexpected empty method 'on'
- [ ] `services/wa-client/src/index.ts:152` - Unexpected empty method 'on'
- [ ] `services/wa-client/src/__tests__/sessionCleanup.test.ts:15` - Unexpected empty arrow function
- [ ] `services/wa-client/src/__tests__/sessionCleanup.test.ts:12` - Unexpected empty arrow function
- [ ] `services/wa-client/src/__tests__/commands.test.ts:19` - Unexpected empty method 'on'
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:36` - Unexpected empty arrow function
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:35` - Unexpected empty arrow function
- [ ] `services/scan-orchestrator/src/index.ts:186` - Unexpected empty method 'on'
- [ ] `services/control-plane/src/index.ts:129` - Unexpected empty method 'on'

---

### [DeepSource] Invalid `async` keyword (JS-0376)

**Category:** ANTI_PATTERN
**Description:**
A function that does not contain any `await` expressions should not be `async` (except for some edge cases
in TypeScript which are discussed below).
Asynchronous functions in JavaScript behave differently than other functions in two important ways:

- The return value is always a `Promise`.
- You can use the `await` operator inside them.

Functions are made `async` so that we can use the `await` operator inside them.
Consider this example:

```js
async function fetchData(processDataItem) {
    const response = await fetch(DATA_URL);
    const data = await response.json();

    return data.map(processDataItem);
}
```

Asynchronous functions that don't use `await` might be an unintentional result of refactoring.

Note: This issue ignores async generator functions.
Generators `yield` rather than `return` a value and `async` generators might yield all the values of another async generator without ever actually needing to use `await`.

In TypeScript, one might feel the need to make a function `async` to comply with type signatures defined by an interface.
Ideally, the code should be refactored to get rid of such restrictions, but sometimes that isn't feasible
(For example, when we are implementing an interface defined in a 3rd party library like Next.js).

This situation can easily be circumvented by returning the value with a call to `Promise.resolve`:

```ts
interface HasAsyncFunc {
  getNum: () => Promise<number>
}

// Not recommended:
const o: HasAsyncFunc = {
  async getNum() { return 1 }
}

// Recommended:
const o: HasAsyncFunc = {
  // We only use `Promise.resolve` to adhere to the type
  // of the surrounding object.
  getNum() { return Promise.resolve(1) }
}
```

It is also advised to add a comment near the redundant promise to make the intent clear.

### Bad Practice

```ts
async function promise1() {
  return 1
}

async function fetchJSON(url: string) {
  return axios.get(url)
}
```

### Recommended

```ts
function promise1() {
  return Promise.resolve(1);
}

async function fetchJSON(url: string) {
  const data = await axios.get(url)
  return data.payload;
}
```

**Total Locations:** 1

**Locations:**
- [ ] `tests/stubs/bottleneck.ts:17` - Async method 'currentReservoir' has no 'await' expression

---

### [DeepSource] Found short variable name (JS-C1002)

**Category:** ANTI_PATTERN
**Description:**
Short variable names affect code readability and complicate code refactoring, because of the difficulty in searching and replacing such short characters.
<!--more-->

This issue will not be raised for certain special identifiers, such as `i`, `j` or `n`. It will also not be reported for the parameters used in `for` and `while` loops.

### Bad Practice

```js
var a;
const l = 90
```

### Recommended

```js
var age;
const limit = 90;


for(let o = 2; o < 10; o++){
    sum += o
}
```

**Total Locations:** 15

**Locations:**
- [ ] `services/wa-client/src/index.ts:1505` - Variable name is too small
- [ ] `services/scan-orchestrator/src/index.ts:1007` - Variable name is too small
- [ ] `services/scan-orchestrator/src/index.ts:531` - Variable name is too small
- [ ] `scripts/ui/prompt-runner.mjs:7` - Variable name is too small
- [ ] `scripts/export-wwebjs-docs.mjs:132` - Variable name is too small
- [ ] `scripts/export-wwebjs-docs.mjs:106` - Variable name is too small
- [ ] `packages/shared/src/url.ts:77` - Variable name is too small
- [ ] `packages/shared/src/url.ts:53` - Variable name is too small
- [ ] `packages/shared/src/url.ts:20` - Variable name is too small
- [ ] `packages/shared/src/reputation/dns-intelligence.ts:147` - Variable name is too small
- [ ] `packages/shared/src/reputation/advanced-heuristics.ts:116` - Variable name is too small
- [ ] `packages/shared/src/__tests__/url.test.ts:99` - Variable name is too small
- [ ] `packages/shared/src/__tests__/url.test.ts:94` - Variable name is too small
- [ ] `packages/shared/src/__tests__/url.test.ts:33` - Variable name is too small
- [ ] `packages/shared/src/__tests__/url.test.ts:28` - Variable name is too small

---

### [DeepSource] Avoid using wildcard imports (JS-C1003)

**Category:** ANTI_PATTERN
**Description:**
Wildcard imports are easier to write,
but make it harder to pick out the specific functions or objects from a dependency that are used in a file.

```typescript
import * from 'module';

// there is no clear way to tell if 
// `someFunction` has been imported
// from 'module'.
someFunction();
```

Therefore, it is recommended to explicit imports wherever possible.

**NOTE:** Some libraries do not expose themselves as ESModules.
In cases like these, it is recommended to use a [skipcq](https://deepsource.com/docs/setup-analysis/#ignore-rules) comment
to suppress this issue.

### Bad Practice

```javascript
import * as axios from 'axios'
import * as Sentry from '@sentry/node'

try {
  const result = await axios.get();
  // ...
} catch (err) {
  Sentry.captureException(err);
}
```

### Recommended

```javascript
import axios from 'axios'
// skipcq: JS-C1003 - sentry does not expose itself as an ES Module.
import * as Sentry from '@sentry/node'

try {
  const result = await axios.get();
  // ...
} catch (err) {
  Sentry.captureException(err);
}
```

**Total Locations:** 4

**Locations:**
- [ ] `services/scan-orchestrator/src/database.ts:2` - Explicitly import the specific method needed
- [ ] `services/scan-orchestrator/src/database.ts:1` - Explicitly import the specific method needed
- [ ] `services/control-plane/src/database.ts:2` - Explicitly import the specific method needed
- [ ] `services/control-plane/src/database.ts:1` - Explicitly import the specific method needed

---

### [DeepSource] Found unused objects (JS-R1002)

**Category:** ANTI_PATTERN
**Description:**
Class constructors being invoked and then dropped immediately is an anti-pattern and should be avoided.
<!--more-->
Objects instantiated with `new` should always be useful in some way (passed as a function argument, stored in a variable for later use, etc).
If the object is instantiated only to invoke some side effect in the constructor, then the side effect should be refactored out into it's own function.

### Bad Practice

```js
new Foo()
```

### Recommended

```js
const myFoo = new Foo()
```

**Total Locations:** 3

**Locations:**
- [ ] `services/wa-client/src/index.ts:1983` - Avoid instantiating unused object 'new Worker(config.queues.scanVerdict, async (job) => {
    const queueName = config.queues.scanVerdict;
    const started = Date.now();
    const waitSeconds = Math.max(0, (started - (job.timestamp ?? started)) / 1000);
    metrics.queueJobWait.labels(queueName).observe(waitSeconds);
    const data = job.data as VerdictJobData & { decidedAt?: number; redirectChain?: string[]; shortener?: { provider: string; chain: string[] } | null };
    const payload: VerdictJobData = {
      chatId: data.chatId,
      messageId: data.messageId,
      verdict: data.verdict,
      reasons: data.reasons,
      url: data.url,
      urlHash: data.urlHash,
      decidedAt: data.decidedAt,
      redirectChain: data.redirectChain,
      shortener: data.shortener ?? null,
    };
    try {
      const delay = Math.floor(800 + Math.random() * 1200);
      await new Promise<void>((resolve) => {
        setTimeout(async () => {
          try {
            try {
              await groupLimiter.consume(payload.chatId);
              await groupHourlyLimiter.consume(payload.chatId);
            } catch {
              metrics.waMessagesDropped.labels('verdict_rate_limited').inc();
              return;
            }
            const key = `verdict:${payload.chatId}:${payload.urlHash}`;
            const nx = await redis.set(key, '1', 'EX', 3600, 'NX');
            if (nx === null) {
              metrics.waMessagesDropped.labels('verdict_duplicate').inc();
              return;
            }
            const context: VerdictContext = {
              chatId: payload.chatId,
              messageId: payload.messageId,
              urlHash: payload.urlHash,
            };
            await deliverVerdictMessage(client, payload, context);
          } finally {
            const verdictLatencySeconds = Math.max(0, (Date.now() - (payload.decidedAt ?? started)) / 1000);
            metrics.waVerdictLatency.observe(verdictLatencySeconds);
            const processingSeconds = (Date.now() - started) / 1000;
            metrics.queueProcessingDuration.labels(queueName).observe(processingSeconds);
            metrics.queueCompleted.labels(queueName).inc();
            if (job.attemptsMade > 0) {
              metrics.queueRetries.labels(queueName).inc(job.attemptsMade);
            }
            resolve();
          }
        }, delay);
      });
    } catch (err) {
      metrics.queueFailures.labels(queueName).inc();
      metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
      throw err;
    }
  }, { connection: redis })'
- [ ] `services/scan-orchestrator/src/index.ts:1553` - Avoid instantiating unused object 'new Worker(config.queues.urlscan, async (job) => {
      const queueName = config.queues.urlscan;
      const started = Date.now();
      const waitSeconds = Math.max(0, (started - (job.timestamp ?? started)) / 1000);
      metrics.queueJobWait.labels(queueName).observe(waitSeconds);
      const { url, urlHash: urlHashValue } = job.data as { url: string; urlHash: string };
      try {
        const submission: UrlscanSubmissionResponse = await urlscanCircuit.execute(() =>
          withRetry(
            () =>
              submitUrlscan(url, {
                callbackUrl: config.urlscan.callbackUrl || undefined,
                visibility: config.urlscan.visibility,
                tags: config.urlscan.tags,
              }),
            {
              retries: 2,
              baseDelayMs: 1000,
              factor: 2,
              retryable: shouldRetry,
            }
          )
        );
        recordLatency(CIRCUIT_LABELS.urlscan, submission.latencyMs);
        if (submission.uuid) {
          await redis.set(
            `${URLSCAN_UUID_PREFIX}${submission.uuid}`,
            urlHashValue,
            'EX',
            config.urlscan.uuidTtlSeconds
          );
          await redis.set(
            `${URLSCAN_SUBMITTED_PREFIX}${urlHashValue}`,
            submission.uuid,
            'EX',
            config.urlscan.uuidTtlSeconds
          );
          await dbClient.query(
            `UPDATE scans SET urlscan_uuid=?, urlscan_status=?, urlscan_submitted_at=datetime('now'), urlscan_result_url=? WHERE url_hash=?`,
            [submission.uuid, 'submitted', submission.result ?? null, urlHashValue]
          );
        }
        metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
        metrics.queueCompleted.labels(queueName).inc();
        if (job.attemptsMade > 0) {
          metrics.queueRetries.labels(queueName).inc(job.attemptsMade);
        }
      } catch (err) {
        recordError(CIRCUIT_LABELS.urlscan, err);
        logger.error({ err, url }, 'urlscan submission failed');
        await dbClient.query(
          `UPDATE scans SET urlscan_status=?, urlscan_completed_at=datetime('now') WHERE url_hash=?`,
          ['failed', urlHashValue]
        ).catch(() => undefined);
        metrics.queueFailures.labels(queueName).inc();
        metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
        throw err;
      } finally {
        await refreshQueueMetrics(urlscanQueue, queueName).catch(() => undefined);
      }
    }, { connection: redis, concurrency: config.urlscan.concurrency })'
- [ ] `services/scan-orchestrator/src/index.ts:983` - Avoid instantiating unused object 'new Worker(config.queues.scanRequest, async (job) => {
    const queueName = config.queues.scanRequest;
    const started = Date.now();
    const waitSeconds = Math.max(0, (started - (job.timestamp ?? started)) / 1000);
    metrics.queueJobWait.labels(queueName).observe(waitSeconds);
    const { chatId, messageId, url, timestamp, rescan } = job.data as {
      chatId?: string;
      messageId?: string;
      url: string;
      timestamp?: number;
      rescan?: boolean;
    };
    const ingestionTimestamp = typeof timestamp === 'number' ? timestamp : job.timestamp ?? started;
    const hasChatContext = typeof chatId === 'string' && typeof messageId === 'string';
    try {
      const norm = normalizeUrl(url);
      if (!norm) {
        metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
        metrics.queueCompleted.labels(queueName).inc();
        if (job.attemptsMade > 0) {
          metrics.queueRetries.labels(queueName).inc(job.attemptsMade);
        }
        return;
      }
      const h = urlHash(norm);
      const cacheKey = `scan:${h}`;

      interface CachedVerdict {
        verdict: string;
        score: number;
        reasons: string[];
        cacheTtl?: number;
        decidedAt?: number;
        [key: string]: unknown;
      }

      let cachedVerdict: CachedVerdict | null = null;
      let cachedTtl = -1;
      const cacheStop = metrics.cacheLookupDuration.labels(CACHE_LABELS.verdict).startTimer();
      const cachedRaw = await redis.get(cacheKey);
      cacheStop();
      if (cachedRaw) {
        recordCacheOutcome(CACHE_LABELS.verdict, 'hit');
        metrics.cacheHit.inc();
        metrics.cacheEntryBytes.labels(CACHE_LABELS.verdict).set(Buffer.byteLength(cachedRaw));
        cachedTtl = await redis.ttl(cacheKey);
        if (cachedTtl >= 0) {
          metrics.cacheEntryTtl.labels(CACHE_LABELS.verdict).set(cachedTtl);
        }
        try {
          cachedVerdict = JSON.parse(cachedRaw) as CachedVerdict;
        } catch {
          metrics.cacheStaleTotal.labels(CACHE_LABELS.verdict).inc();
        }
        if (
          cachedVerdict &&
          typeof cachedVerdict.cacheTtl === 'number' &&
          cachedTtl >= 0 &&
          cachedTtl < Math.max(1, Math.floor(cachedVerdict.cacheTtl * 0.2))
        ) {
          metrics.cacheStaleTotal.labels(CACHE_LABELS.verdict).inc();
        }
      } else {
        recordCacheOutcome(CACHE_LABELS.verdict, 'miss');
        metrics.cacheMiss.inc();
        metrics.cacheEntryTtl.labels(CACHE_LABELS.verdict).set(0);
      }

      if (cachedVerdict) {
        const verdictLatencySeconds = Math.max(0, (Date.now() - ingestionTimestamp) / 1000);
        metrics.verdictLatency.observe(verdictLatencySeconds);
        metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
        metrics.queueCompleted.labels(queueName).inc();
        if (job.attemptsMade > 0) {
          metrics.queueRetries.labels(queueName).inc(job.attemptsMade);
        }

        if (hasChatContext) {
          const resolvedMessageId = messageId ?? '';
          await scanVerdictQueue.add(
            'verdict',
            {
              chatId,
              messageId: resolvedMessageId,
              ...cachedVerdict,
              decidedAt: cachedVerdict.decidedAt ?? Date.now(),
            },
            { removeOnComplete: true }
          );
        } else {
          logger.info({ url: norm, jobId: job.id, rescan: Boolean(rescan) }, 'Skipping verdict dispatch without chat context');
        }
        return;
      }

      const shortenerInfo = await resolveShortenerWithCache(norm, h);
      const preExpansionUrl = shortenerInfo?.finalUrl ?? norm;
      const exp = await expandUrl(preExpansionUrl, config.orchestrator.expansion);
      const finalUrl = exp.finalUrl;
      const finalUrlObj = new URL(finalUrl);
      const redirectChain = [...(shortenerInfo?.chain ?? []), ...exp.chain.filter((item: string) => !(shortenerInfo?.chain ?? []).includes(item))];
      const heurSignals = extraHeuristics(finalUrlObj);
      const wasShortened = Boolean(shortenerInfo?.wasShortened);
      const finalUrlMismatch = wasShortened && new URL(norm).hostname !== finalUrlObj.hostname;

      const homoglyphResult = detectHomoglyphs(finalUrlObj.hostname);
      if (homoglyphResult.detected) {
        metrics.homoglyphDetections.labels(homoglyphResult.riskLevel).inc();
        logger.info({ hostname: finalUrlObj.hostname, risk: homoglyphResult.riskLevel, confusables: homoglyphResult.confusableChars }, 'Homoglyph detection');
      }

      const enhancedSecurityResult = await enhancedSecurity.analyze(finalUrl, h);

      if (enhancedSecurityResult.verdict === 'malicious' && enhancedSecurityResult.confidence === 'high' && enhancedSecurityResult.skipExternalAPIs) {
        logger.info({ url: finalUrl, score: enhancedSecurityResult.score, reasons: enhancedSecurityResult.reasons }, 'Tier 1 high-confidence threat detected, skipping external APIs');

        const signals = {
          gsbThreatTypes: [],
          phishtankVerified: false,
          urlhausListed: false,
          vtMalicious: undefined,
          vtSuspicious: undefined,
          vtHarmless: undefined,
          domainAgeDays: undefined,
          redirectCount: redirectChain.length,
          wasShortened,
          finalUrlMismatch,
          manualOverride: null,
          homoglyph: homoglyphResult,
          ...heurSignals,
          enhancedSecurityScore: enhancedSecurityResult.score,
          enhancedSecurityReasons: enhancedSecurityResult.reasons,
        };

        const verdictResult = scoreFromSignals(signals);
        const verdict = 'malicious';
        const { score, reasons } = verdictResult;
        const enhancedReasons = [...reasons, ...enhancedSecurityResult.reasons];

        const cacheTtl = config.orchestrator.cacheTtl.malicious;
        const verdictPayload = {
          url: norm,
          finalUrl,
          verdict,
          score,
          reasons: enhancedReasons,
          cacheTtl,
          redirectChain,
          wasShortened,
          finalUrlMismatch,
          homoglyph: homoglyphResult,
          enhancedSecurity: {
            tier1Score: enhancedSecurityResult.score,
            confidence: enhancedSecurityResult.confidence,
          },
          decidedAt: Date.now(),
        };

        await setJsonCache(CACHE_LABELS.verdict, cacheKey, verdictPayload, cacheTtl);

        try {
          await dbClient.transaction(async () => {
            // Insert or update scan record
            // Note: Using INSERT OR REPLACE is SQLite specific. For Postgres compatibility we should use ON CONFLICT or separate logic.
            // However, since we are abstracting, we'll stick to standard SQL or handle it in the query method if needed.
            // But here we are using raw SQL.
            // For now, let's assume the query method handles parameter conversion.
            // Using CURRENT_TIMESTAMP for SQL standard compatibility (SQLite and Postgres)
            // Original approach used datetime('now') which is SQLite-specific
            // CURRENT_TIMESTAMP works for both SQLite and Postgres

            const standardSql = `
              INSERT INTO scans (url_hash, url, final_url, verdict, score, reasons, cache_ttl, redirect_chain, was_shortened, final_url_mismatch, homoglyph_detected, homoglyph_risk_level, first_seen_at, last_seen_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              ON CONFLICT(url_hash) DO UPDATE SET
                url=excluded.url,
                final_url=excluded.final_url,
                verdict=excluded.verdict,
                score=excluded.score,
                reasons=excluded.reasons,
                cache_ttl=excluded.cache_ttl,
                redirect_chain=excluded.redirect_chain,
                was_shortened=excluded.was_shortened,
                final_url_mismatch=excluded.final_url_mismatch,
                homoglyph_detected=excluded.homoglyph_detected,
                homoglyph_risk_level=excluded.homoglyph_risk_level,
                last_seen_at=CURRENT_TIMESTAMP
            `;

            await dbClient.query(standardSql, [
              h, norm, finalUrl, verdict, score, JSON.stringify(enhancedReasons), cacheTtl, JSON.stringify(redirectChain), wasShortened, finalUrlMismatch, homoglyphResult.detected, homoglyphResult.riskLevel
            ]);
          });
        } catch (err) {
          logger.error({ err, url: norm }, 'failed to persist enhanced security verdict');
        }

        metrics.verdictScore.observe(score);
        for (const reason of enhancedReasons) {
          metrics.verdictReasons.labels(normalizeVerdictReason(reason)).inc();
        }

        const verdictLatencySeconds = Math.max(0, (Date.now() - ingestionTimestamp) / 1000);
        metrics.verdictLatency.observe(verdictLatencySeconds);
        metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
        metrics.queueCompleted.labels(queueName).inc();

        if (hasChatContext) {
          await scanVerdictQueue.add('verdict', {
            chatId,
            messageId,
            ...verdictPayload,
          }, { removeOnComplete: true });
        }

        await enhancedSecurity.recordVerdict(finalUrl, 'malicious', enhancedSecurityResult.score / 3.0);
        return;
      }

      const [blocklistResult, domainIntel, manualOverride] = await Promise.all([
        checkBlocklistsWithRedundancy({
          finalUrl,
          hash: h,
          fallbackLatencyMs: config.gsb.fallbackLatencyMs,
          gsbApiKeyPresent: Boolean(config.gsb.apiKey),
          phishtankEnabled: config.phishtank.enabled,
          fetchGsbAnalysis,
          fetchPhishtank,
        }),
        fetchDomainIntel(finalUrlObj.hostname, h),
        loadManualOverride(dbClient, h, finalUrlObj.hostname),
      ]);

      if (manualOverride) {
        metrics.manualOverrideApplied.labels(manualOverride).inc();
      }

      const domainAgeDays = domainIntel.ageDays;
      const gsbMatches = blocklistResult.gsbMatches;
      const gsbHit = gsbMatches.length > 0;
      if (gsbHit) metrics.gsbHits.inc();

      const phishtankResult = blocklistResult.phishtankResult;
      const phishtankHit = Boolean(phishtankResult?.verified);

      let vtStats: VtStats | undefined;
      let vtQuotaExceeded = false;
      let vtError: Error | null = null;
      if (!gsbHit && !phishtankHit) {
        const vtResponse = await fetchVirusTotal(finalUrl, h);
        vtStats = vtResponse.stats;
        vtQuotaExceeded = vtResponse.quotaExceeded;
        vtError = vtResponse.error;
        if (!vtResponse.fromCache && !vtResponse.error) {
          metrics.vtSubmissions.inc();
        }
      }

      let urlhausResult: UrlhausResult | null = null;
      let urlhausError: Error | null = null;
      let urlhausConsulted = false;
      const shouldQueryUrlhaus =
        !gsbHit && (
          !config.vt.apiKey ||
          vtQuotaExceeded ||
          vtError !== null ||
          !vtStats
        );
      if (shouldQueryUrlhaus) {
        urlhausConsulted = true;
        const urlhausResponse = await fetchUrlhaus(finalUrl, h);
        urlhausResult = urlhausResponse.result;
        urlhausError = urlhausResponse.error;
      }

      const summarizeReason = (input?: string | null) => {
        if (!input) return 'unavailable';
        const trimmed = input.trim();
        if (trimmed.length === 0) return 'unavailable';
        return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
      };

      type ProviderState = {
        key: string;
        name: string;
        consulted: boolean;
        available: boolean;
        reason?: string;
      };

      const providerStates: ProviderState[] = [
        {
          key: 'gsb',
          name: 'Google Safe Browsing',
          consulted: true,
          available: !blocklistResult.gsbResult.error,
          reason: blocklistResult.gsbResult.error ? summarizeReason(blocklistResult.gsbResult.error.message) : undefined,
        },
      ];

      if (blocklistResult.phishtankNeeded) {
        providerStates.push({
          key: 'phishtank',
          name: 'Phishtank',
          consulted: true,
          available: !blocklistResult.phishtankError,
          reason: blocklistResult.phishtankError ? summarizeReason(blocklistResult.phishtankError.message) : undefined,
        });
      }

      const vtConsulted = !gsbHit && !phishtankHit && Boolean(config.vt.apiKey);
      if (vtConsulted) {
        let vtReason: string | undefined;
        if (!vtStats) {
          vtReason = vtQuotaExceeded ? 'quota_exhausted' : summarizeReason(vtError?.message ?? null);
        }
        providerStates.push({
          key: 'virustotal',
          name: 'VirusTotal',
          consulted: true,
          available: Boolean(vtStats) || (!vtError && !vtQuotaExceeded),
          reason: vtStats ? undefined : vtReason,
        });
      }

      if (urlhausConsulted) {
        providerStates.push({
          key: 'urlhaus',
          name: 'URLhaus',
          consulted: true,
          available: !urlhausError,
          reason: urlhausError ? summarizeReason(urlhausError.message) : undefined,
        });
      }

      const consultedProviders = providerStates.filter((state) => state.consulted);
      const availableProviders = consultedProviders.filter((state) => state.available);
      const degradedProviders = consultedProviders.filter((state) => !state.available);
      const degradedMode = consultedProviders.length > 0 && availableProviders.length === 0
        ? {
          providers: degradedProviders.map((state) => ({
            name: state.name,
            reason: state.reason ?? 'unavailable',
          })),
        }
        : undefined;

      if (degradedMode) {
        metrics.degradedModeEvents.inc();
        metrics.externalScannersDegraded.set(1);
        logger.warn({ url: finalUrl, urlHash: h, providers: degradedMode.providers }, 'Operating in degraded mode with no external providers available');
      } else {
        metrics.externalScannersDegraded.set(0);
      }

      const heuristicsOnly = degradedMode !== undefined;
      const signals = {
        gsbThreatTypes: gsbMatches.map((m: GsbThreatMatch) => m.threatType),
        phishtankVerified: Boolean(phishtankResult?.verified),
        urlhausListed: Boolean(urlhausResult?.listed),
        vtMalicious: vtStats?.malicious,
        vtSuspicious: vtStats?.suspicious,
        vtHarmless: vtStats?.harmless,
        domainAgeDays,
        redirectCount: redirectChain.length,
        wasShortened,
        finalUrlMismatch,
        manualOverride,
        homoglyph: homoglyphResult,
        ...heurSignals,
        enhancedSecurityScore: enhancedSecurityResult.score,
        enhancedSecurityReasons: enhancedSecurityResult.reasons,
        heuristicsOnly,
      };
      const verdictResult = scoreFromSignals(signals);
      const verdict = verdictResult.level;
      let { score, reasons } = verdictResult;

      if (enhancedSecurityResult.reasons.length > 0) {
        reasons = [...reasons, ...enhancedSecurityResult.reasons];
      }
      const baselineVerdict = scoreFromSignals({ ...signals, manualOverride: null }).level;

      metrics.verdictScore.observe(score);
      for (const reason of reasons) {
        metrics.verdictReasons.labels(normalizeVerdictReason(reason)).inc();
      }
      if (baselineVerdict !== verdict) {
        metrics.verdictEscalations.labels(baselineVerdict, verdict).inc();
      }
      if (gsbMatches.length > 0) {
        metrics.verdictSignals.labels('gsb_match').inc(gsbMatches.length);
      }
      if (phishtankHit) {
        metrics.verdictSignals.labels('phishtank_verified').inc();
      }
      if (urlhausResult?.listed) {
        metrics.verdictSignals.labels('urlhaus_listed').inc();
      }
      if ((vtStats?.malicious ?? 0) > 0) {
        metrics.verdictSignals.labels('vt_malicious').inc(vtStats?.malicious ?? 0);
      }
      if ((vtStats?.suspicious ?? 0) > 0) {
        metrics.verdictSignals.labels('vt_suspicious').inc(vtStats?.suspicious ?? 0);
      }
      if (wasShortened) {
        metrics.verdictSignals.labels('shortener').inc();
      }
      if (finalUrlMismatch) {
        metrics.verdictSignals.labels('redirect_mismatch').inc();
      }
      if (redirectChain.length > 0) {
        metrics.verdictSignals.labels('redirect_chain').inc(redirectChain.length);
      }
      if (homoglyphResult.detected) {
        metrics.verdictSignals.labels(`homoglyph_${homoglyphResult.riskLevel}`).inc();
      }
      if (typeof domainAgeDays === 'number') {
        metrics.verdictSignals.labels('domain_age').inc();
      }
      if (signals.manualOverride) {
        metrics.verdictSignals.labels(`override_${signals.manualOverride}`).inc();
      }

      const blocklistHit = gsbHit || phishtankHit || Boolean(urlhausResult?.listed);

      let enqueuedUrlscan = false;
      if (config.urlscan.enabled && config.urlscan.apiKey && verdict === 'suspicious') {
        const queued = await redis.set(
          `${URLSCAN_QUEUED_PREFIX}${h}`,
          '1',
          'EX',
          config.urlscan.uuidTtlSeconds,
          'NX'
        );
        if (queued) {
          enqueuedUrlscan = true;
          await urlscanQueue.add(
            'submit',
            {
              url: finalUrl,
              urlHash: h,
            },
            {
              removeOnComplete: true,
              removeOnFail: 500,
              attempts: 1,
            }
          );
        }
      }

      const ttlByLevel = config.orchestrator.cacheTtl as Record<string, number>;
      const ttl = ttlByLevel[verdict] ?? verdictResult.cacheTtl ?? 3600;

      metrics.verdictCacheTtl.observe(ttl);

      const decidedAt = Date.now();
      const res = {
        messageId,
        chatId,
        url: finalUrl,
        normalizedUrl: finalUrl,
        urlHash: h,
        verdict,
        score,
        reasons,
        gsb: { matches: gsbMatches },
        phishtank: phishtankResult,
        urlhaus: urlhausResult,
        vt: vtStats,
        urlscan: enqueuedUrlscan ? { status: 'queued' } : undefined,
        whois: domainIntel,
        domainAgeDays,
        redirectChain,
        ttlLevel: verdict,
        cacheTtl: ttl,
        shortener: shortenerInfo ? { provider: shortenerInfo.provider, chain: shortenerInfo.chain } : undefined,
        finalUrlMismatch,
        decidedAt,
        degradedMode,
      };
      await setJsonCache(CACHE_LABELS.verdict, cacheKey, res, ttl);

      try {
        await dbClient.transaction(async () => {
          // Insert or update scan record
          const scanSql = `
            INSERT INTO scans (
              url_hash, normalized_url, verdict, score, reasons, vt_stats,
              gsafebrowsing_hit, domain_age_days, redirect_chain_summary, cache_ttl,
              source_kind, urlscan_status, whois_source, whois_registrar, shortener_provider,
              first_seen_at, last_seen_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(url_hash) DO UPDATE SET
              normalized_url=excluded.normalized_url,
              verdict=excluded.verdict,
              score=excluded.score,
              reasons=excluded.reasons,
              vt_stats=excluded.vt_stats,
              gsafebrowsing_hit=excluded.gsafebrowsing_hit,
              domain_age_days=excluded.domain_age_days,
              redirect_chain_summary=excluded.redirect_chain_summary,
              cache_ttl=excluded.cache_ttl,
              source_kind=excluded.source_kind,
              urlscan_status=excluded.urlscan_status,
              whois_source=excluded.whois_source,
              whois_registrar=excluded.whois_registrar,
              shortener_provider=excluded.shortener_provider,
              last_seen_at=CURRENT_TIMESTAMP
          `;

          await dbClient.query(scanSql, [
            h, finalUrl, verdict, score, JSON.stringify(reasons), JSON.stringify(vtStats || {}),
            blocklistHit, domainAgeDays ?? null, JSON.stringify(redirectChain), ttl,
            'wa', enqueuedUrlscan ? 'queued' : null,
            domainIntel.source === 'none' ? null : domainIntel.source,
            domainIntel.registrar ?? null, shortenerInfo?.provider ?? null
          ]);

          if (enqueuedUrlscan) {
            await dbClient.query('UPDATE scans SET urlscan_status=? WHERE url_hash=?', ['queued', h]);
          }

          if (chatId && messageId) {
            const messageSql = `
              INSERT INTO messages (chat_id, message_id, url_hash, verdict, posted_at)
              VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(chat_id, message_id) DO NOTHING
            `;
            await dbClient.query(messageSql, [chatId, messageId, h, verdict]);
          }
        });
      } catch (err) {
        logger.warn({ err, chatId, messageId }, 'failed to persist message metadata for scan');
      }

      if (chatId && messageId) {
        await scanVerdictQueue.add('verdict', { ...res, chatId, messageId }, { removeOnComplete: true });
      } else {
        logger.info({ url: finalUrl, jobId: job.id, rescan: Boolean(rescan) }, 'Completed scan without chat context; skipping messaging flow');
      }

      await enhancedSecurity.recordVerdict(
        finalUrl,
        verdict === 'malicious' ? 'malicious' : verdict === 'suspicious' ? 'suspicious' : 'benign',
        score / 15.0
      ).catch((err) => {
        logger.warn({ err, url: finalUrl }, 'failed to record verdict for collaborative learning');
      });

      metrics.verdictCounter.labels(verdict).inc();
      const totalProcessingSeconds = (Date.now() - started) / 1000;
      metrics.verdictLatency.observe(Math.max(0, (Date.now() - ingestionTimestamp) / 1000));
      metrics.scanLatency.observe(totalProcessingSeconds);
      metrics.queueProcessingDuration.labels(queueName).observe(totalProcessingSeconds);
      metrics.queueCompleted.labels(queueName).inc();
      if (job.attemptsMade > 0) {
        metrics.queueRetries.labels(queueName).inc(job.attemptsMade);
      }
    } catch (e) {
      metrics.queueFailures.labels(queueName).inc();
      metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
      logger.error(e, 'scan worker error');
    } finally {
      await refreshQueueMetrics(scanRequestQueue, queueName).catch(() => undefined);
    }
  }, { connection: redis, concurrency: config.orchestrator.concurrency })'

---

### [DeepSource] Function with cyclomatic complexity higher than threshold (JS-R1005)

**Category:** ANTI_PATTERN
**Description:**
A function with high cyclomatic complexity can be hard to understand and
maintain. Cyclomatic complexity is a software metric that measures the number of
independent paths through a function. A higher cyclomatic complexity indicates
that the function has more decision points and is more complex.

<!--more-->

Functions with high cyclomatic complexity are more likely to have bugs and be
harder to test. They may lead to reduced code maintainability and increased
development time.

To reduce the cyclomatic complexity of a function, you can:

- Break the function into smaller, more manageable functions.
- Refactor complex logic into separate functions or classes.
- Avoid multiple return paths and deeply nested control expressions.

### Bad Practice

```js
// When `cyclomatic_complexity_threshold` is set to `low`, by default it is `high`
function getCapitalCity(countryName) {
  if (countryName === 'India') {
    return 'New Delhi'
  } else if (countryName === 'China') {
    return 'Beijing'
  } else if (countryName === 'France') {
    return 'Paris'
  } else if (countryName === 'Germany') {
    return 'Berlin'
  } else if (countryName === 'Italy') {
    return 'Rome'
  }
}
```

### Recommended

```js
function getCapitalCity(countryName) {
  const capitalCities = {
    India: 'New Delhi',
    China: 'Beijing',
    France: 'Paris',
    Germany: 'Berlin',
    Italy: 'Rome'
  }

  return capitalCities[countryName]
}
```

### Issue configuration

Cyclomatic complexity threshold can be configured using the
`cyclomatic_complexity_threshold` [meta field](https://docs.deepsource.com/docs/analyzers-javascript#cyclomatic_complexity_threshold) in the
`.deepsource.toml` config file.

Configuring this is optional. If you don't provide a value, the Analyzer will
raise issues for functions with complexity higher than the default threshold,
which is `high`(only raises for issues >25) for the JavaScript Analyzer.

Here's the mapping of the risk category to the cyclomatic complexity score to
help you configure this better:

| Risk category | Cyclomatic complexity range |                                             Recommended action                                             |
| :-----------: | :-------------------------: | :--------------------------------------------------------------------------------------------------------: |
|      low      |             1-5             |                                             No action needed.                                              |
|    medium     |            6-15             |                                            Review and monitor.                                             |
|     high      |            16-25            | Review and refactor. Recommended to add comments if the function is absolutely needed to be kept as it is. |
|   very-high   |            26-50            |                                     Refactor to reduce the complexity.                                     |
|   critical    |             >50             |          Must refactor this. This can make the code untestable and very difficult to understand.           |

**Total Locations:** 8

**Locations:**
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:23` - Function has a cyclomatic complexity of 59 with "critical" risk
- [ ] `whatsapp-web.js/src/structures/Message.js:24` - `_patch` has a cyclomatic complexity of 45 with "very-high" risk
- [ ] `whatsapp-web.js/src/Client.js:949` - `sendMessage` has a cyclomatic complexity of 28 with "very-high" risk
- [ ] `whatsapp-web.js/example.js:67` - Function has a cyclomatic complexity of 72 with "critical" risk
- [ ] `services/wa-client/src/index.ts:2074` - `handleAdminCommand` has a cyclomatic complexity of 63 with "critical" risk
- [ ] `services/wa-client/src/index.ts:867` - `main` has a cyclomatic complexity of 28 with "very-high" risk
- [ ] `services/scan-orchestrator/src/index.ts:983` - Function has a cyclomatic complexity of 92 with "critical" risk
- [ ] `packages/shared/src/scoring.ts:39` - `scoreFromSignals` has a cyclomatic complexity of 36 with "very-high" risk

---

### [DeepSource] Found duplicate assignments (JS-W1032)

**Category:** BUG_RISK
**Description:**
Consecutively reassigning to the same variable or property is a code smell and should be avoided.
<!--more-->
It is likely that this is the result of some undeleted code and can have unexpected side effects.
The first assignment is rendered useless by the second and can therefore be removed without observing any changes to the value of the assignment target.

### Bad Practice

```js
a[1] = 'something'
a[1] = 'some other thing'
```

### Recommended

```js
a[1] = 'something'
if (condition()) {
  a[1] = 'some other thing'
}
```

**Total Locations:** 3

**Locations:**
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:336` - Duplicate assignment statement found
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:69` - Duplicate assignment statement found
- [ ] `packages/shared/src/url.ts:22` - Duplicate assignment statement found

---

### [DeepSource] Found control characters in regular expression (JS-W1035)

**Category:** BUG_RISK
**Description:**
ASCII character codes between 0 and 32 are reserved for [non-printing characters](https://en.wikipedia.org/wiki/Non-printing_character_in_word_processors).
Such characters are unlikely to be present in JavaScript strings, and matching them with a Regular expression is most likely a mistake.
Even when you do want to match them, it is recommended to use the character literals for better clarity:

```js
const tabsAndSpaces = / \t/
const tabsSpacesAndNewLines = /\s/
```

<!-- more -->

If you find yourself needing to match the hex values for some reason,
consider adding a [skipcq comment](https://docs.deepsource.com/docs/issues-ignore-rules) to inform readers about the use-case.
This will also prevent DeepSource from raising the issue.

### Bad Practice

```js
const rSpaces = /\x1a/;
// A regex like this one is rarely useful:
const regExp  = new RegExp("\x12");
```

### Recommended

```js
const rSpaces = / /;
const regExp  = new RegExp("[\sa-z]+no-control-chars-here");
```

**Total Locations:** 2

**Locations:**
- [ ] `packages/shared/src/reputation/advanced-heuristics.ts:188` - Regular expression contains non-printing character
- [ ] `packages/shared/src/homoglyph.ts:25` - Regular expression contains non-printing character

---

### [DeepSource] Found empty block statements (JS-0009)

**Category:** ANTI_PATTERN
**Description:**
Empty block statements, while not technically errors, usually occur due to refactoring that wasn't completed.
They can mislead the reader.

<!--more-->

If you still want to keep an empty block, add a comment saying `empty` inside the block.

### Bad Practice

```js
if (someCheck) {}

while (someCheck) {}

try {
    doSomething();
} catch(err) {
} finally {
}
```

### Recommended

```js
if (someCheck) {
    // empty
}

while (someCheck) {
    /* empty */
}

try {
    doSomething();
} catch (err) {
    // continue regardless of error
}

try {
    doSomething();
} finally {
    /* continue regardless of error */
}
```

**Total Locations:** 1

**Locations:**
- [ ] `tests/integration/vt-throttling.test.ts:13` - Empty block statement

---

### [DeepSource] Either all code paths should have explicit returns, or none of them (JS-0045)

**Category:** ANTI_PATTERN
**Description:**
Any code paths that do not have explicit returns will return `undefined`.
It is recommended to replace any implicit dead-ends that return `undefined` with a `return null` statement.

As a convention, `undefined` signals that an unexpected value has been produced as the
result of a logical error in the program.
A `null` return, on the other hand, signals that the input to a function was incorrect,
or a value was 'not found'.

Having this distinction in code helps you figure out if something was caused because of a logical error,
or malformed input to a function call.

### Bad Practice

```js
function getUser(name) {
    if (userExists(name)) {
        return userDb.get(name);
    }
    // whoops! Implicit undefined return
}

function readFile(fileName) {
    if (fs.existsSync(fileName)) {
        return fs.readFileSync(fileName, 'utf-8');
    }

    return; // Implicit undefined return.
}
```

### Recommended

```js
function getUser(name) {
    if (userExists(name)) {
        return userDb.get(name);
    }

    // `null` indicates there is no such user.
    return null;
}

function readFile(fileName) {
    if (fs.existsSync(fileName)) {
        return fs.readFileSync(fileName, 'utf-8');
    }

    // `null` indicates there is no such file.
    return null;
}
```

### References

- [Stack Overflow: When is null or undefined used in JavaScript?](https://stackoverflow.com/questions/6429225/when-is-null-or-undefined-used-in-javascript)

**Total Locations:** 12

**Locations:**
- [ ] `whatsapp-web.js/tests/helper.js:19` - Expected to return a value at the end of function 'getSessionFromEnv'
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:908` - Async arrow function expected no return value
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:906` - Async arrow function expected no return value
- [ ] `whatsapp-web.js/src/structures/Message.js:539` - Expected to return a value at the end of async arrow function
- [ ] `whatsapp-web.js/src/structures/Message.js:526` - Expected to return a value at the end of async arrow function
- [ ] `whatsapp-web.js/src/structures/Message.js:410` - Expected to return a value at the end of async arrow function
- [ ] `whatsapp-web.js/src/structures/Chat.js:307` - Async method 'addOrEditCustomerNote' expected no return value
- [ ] `whatsapp-web.js/src/Client.js:2378` - Async arrow function expected no return value
- [ ] `whatsapp-web.js/src/Client.js:1198` - Expected to return a value at the end of async arrow function
- [ ] `whatsapp-web.js/src/Client.js:857` - Expected to return a value at the end of arrow function
- [ ] `whatsapp-web.js/src/Client.js:143` - Async method 'inject' expected a return value
- [ ] `whatsapp-web.js/src/Client.js:97` - Expected to return a value at the end of async method 'inject'

---

### [DeepSource] Avoid use of `==` and `!=` (JS-0050)

**Category:** ANTI_PATTERN
**Description:**
It is considered good practice to use the type-safe equality operators `===` and `!==` instead of their regular counterparts `==` and `!=`.

<!--more-->

The strict equality operators (`===` and `!==`) use the strict equality comparison algorithm to compare two operands.

- If the operands are of different types, return `false`.
- If both operands are objects, return `true` only if they refer to the same object.
- If both operands are `null` or both operands are `undefined`, return `true`.
- If either operand is `NaN`, return `false`.
- Otherwise, compare the two operand's values:
    - Numbers must have the same numeric values. `+0` and `-0` are considered to be the same value.
    - Strings must have the same characters in the same order.
    - Booleans must be both `true` or both `false`.

The most notable difference between this operator and the equality (`==`) operator is that if the operands are of different types, the `==` operator attempts to convert them to the same type before comparing.

### Bad Practice
```js
a == b
foo == true
bananas != 1
value == undefined
typeof foo == 'undefined'
'hello' != 'world'
0 == 0
true == true
foo == null
```

### Recommended
```js
a === b
foo === true
bananas !== 1
value === undefined
typeof foo === 'undefined'
'hello' !== 'world'
0 === 0
true === true
foo === null
```

**Total Locations:** 14

**Locations:**
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:369` - Expected '===' and instead saw '=='
- [ ] `whatsapp-web.js/src/structures/Message.js:455` - Expected '!==' and instead saw '!='
- [ ] `whatsapp-web.js/src/Client.js:2426` - Expected '!==' and instead saw '!='
- [ ] `whatsapp-web.js/src/Client.js:2088` - Expected '===' and instead saw '=='
- [ ] `whatsapp-web.js/src/Client.js:2081` - Expected '===' and instead saw '=='
- [ ] `whatsapp-web.js/src/Client.js:1710` - Expected '===' and instead saw '=='
- [ ] `whatsapp-web.js/src/Client.js:1331` - Expected '===' and instead saw '=='
- [ ] `whatsapp-web.js/src/Client.js:1230` - Expected '===' and instead saw '=='
- [ ] `whatsapp-web.js/src/Client.js:381` - Expected '!==' and instead saw '!='
- [ ] `whatsapp-web.js/src/Client.js:381` - Expected '!==' and instead saw '!='
- [ ] `whatsapp-web.js/src/Client.js:194` - Expected '===' and instead saw '=='
- [ ] `whatsapp-web.js/src/Client.js:125` - Expected '===' and instead saw '=='
- [ ] `whatsapp-web.js/src/Client.js:125` - Expected '===' and instead saw '=='
- [ ] `whatsapp-web.js/example.js:569` - Expected '===' and instead saw '=='

---

### [DeepSource] Prefer that `for-in` loops should include an `if` statement (JS-0051)

**Category:** ANTI_PATTERN
**Description:**
Looping over objects with a `for in` loop will include properties that are inherited through the prototype chain.
This behavior can lead to unexpected keys in your for loop.

### Bad Practice
```js
for (const key in foo) {
    doSomething(key);
}
```

### Recommended
```js
for (const key in foo) {
    if (Object.prototype.hasOwnProperty.call(foo, key)) {
        doSomething(key);
    }
}

for (const key of Object.keys(foo)) {
    doSomething(key);
}
```

**Total Locations:** 2

**Locations:**
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:119` - Wrap the body of a for-in loop in an if statement with a hasOwnProperty guard
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:106` - Wrap the body of a for-in loop in an if statement with a hasOwnProperty guard

---

### [DeepSource] Avoid using lexical declarations in case clauses (JS-0054)

**Category:** ANTI_PATTERN
**Description:**
Declarations in switch cases are visible to all blocks.
It is recommended not to have such declarations.

<!--more-->

Writing lexical declarations (`let`, `const`, `function` and `class`) within `case`/`default` clauses is not a good practice.
Such declarations are hoisted into the scope of the entire switch expression, meaning they are visible to all `case` clauses in that `switch` block.
Though the declaration is visible to all cases, it is only initialized in the clause that it was declared in.
It will be `undefined` if used in any other clause.

To ensure that the lexical declaration only applies to the current case clause, wrap your clauses in blocks.

### Bad Practice

```js
switch (points) {
    case 1:
        let x = 1;
        break;
    case 2:
        const y = 2;
        break;
    case 3:
        function f() {}
        break;
    default:
        class C {}
}
```

### Recommended

```js
// Declarations outside switch-statements are valid
const a = 0;

switch (points) {
    // The following case clauses are wrapped into blocks using brackets
    case 1: {
        let x = 1;
        break;
    }
    case 2: {
        const y = 2;
        break;
    }
    case 3: {
        function f() {}
        break;
    }
    case 4:
        // Declarations using var without brackets are valid due to function-scope hoisting
        var z = 4;
        break;
    default: {
        class C {}
    }
}
```

**Total Locations:** 4

**Locations:**
- [ ] `scripts/deepsource-api.js:306` - Unexpected lexical declaration in case block
- [ ] `scripts/deepsource-api.js:301` - Unexpected lexical declaration in case block
- [ ] `scripts/deepsource-api.js:296` - Unexpected lexical declaration in case block
- [ ] `scripts/deepsource-api.js:291` - Unexpected lexical declaration in case block

---

### [DeepSource] Found empty functions (JS-0057)

**Category:** ANTI_PATTERN
**Description:**
Having empty functions hurts readability, and is considered a code-smell.
There's almost always a way to avoid using them.
If you must use one, consider adding a comment to inform the reader of its purpose.

### Bad Practice

```ts
getUser('SwaGaLisTiQuE', () => {})

function f() {}
```

### Recommended

```ts
getUser('SwaGaLisTiQuE', () => {
    // empty because <reason>
})

function f() {
    // intentionally empty. <reason>
}
```

**Total Locations:** 22

**Breakdown by Directory:**

#### 📂 scripts/setup/ui (1)
- [ ] `scripts/setup/ui/hotkeys.mjs:31` - Unexpected empty arrow function

#### 📂 scripts/ui (3)
- [ ] `scripts/ui/prompt-runner.mjs:218` - Unexpected empty arrow function
- [ ] `scripts/ui/prompt-runner.mjs:145` - Unexpected empty arrow function
- [ ] `scripts/ui/prompt-runner.mjs:76` - Unexpected empty arrow function

#### 📂 tests/setup-cli (3)
- [ ] `tests/setup-cli/setup-wizard.test.mjs:122` - Unexpected empty method 'heading'
- [ ] `tests/setup-cli/setup-wizard.test.mjs:121` - Unexpected empty method 'note'
- [ ] `tests/setup-cli/setup-wizard.test.mjs:120` - Unexpected empty method 'info'

#### 📂 whatsapp-web.js/src/authStrategies (14)
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:197` - Unexpected empty arrow function
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:195` - Unexpected empty arrow function
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:151` - Unexpected empty arrow function
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:132` - Unexpected empty arrow function
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:118` - Unexpected empty arrow function
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:87` - Unexpected empty arrow function
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:24` - Unexpected empty async method 'logout'
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:23` - Unexpected empty async method 'destroy'
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:22` - Unexpected empty async method 'disconnect'
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:21` - Unexpected empty async method 'afterAuthReady'
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:20` - Unexpected empty async method 'getAuthEventPayload'
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:12` - Unexpected empty async method 'afterBrowserInitialized'
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:11` - Unexpected empty async method 'beforeBrowserInitialized'
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:7` - Unexpected empty constructor

#### 📂 whatsapp-web.js/src/webCache (1)
- [ ] `whatsapp-web.js/src/webCache/WebCache.js:6` - Unexpected empty async method 'persist'


---

### [DeepSource] Usage of comma operators should be avoided (JS-0090)

**Category:** ANTI_PATTERN
**Description:**
The comma operator includes multiple expressions where only one is expected. It evaluates each operand from left to right and returns the value of the last operand. However, this frequently obscures side effects, and its use is often an accident. Here are some examples of sequences:

<!--more-->

### Bad Practice

```js
let a = (3, 5); // a = 5
a = b += 5, a + b;
while (a = next(), a && a.length);
(0, eval)("doSomething();");
res = doSomething(), val;
0, eval("doSomething();");
do {} while (doSomething(), !!test);
for (; doSomething(), !!test; );
if (doSomething(), !!test);
switch (val = func(), val) {}
while (val = func(), val < 42);
with (doSomething(), val) {}
```

### Recommended

```js
res = (doSomething(), val);
(0, eval)("doSomething();");
do {} while ((doSomething(), !!test));
for (i = 0, j = 10; i < j; i++, j--);
if ((doSomething(), !!test));
switch ((val = func(), val)) {}
while ((val = func(), val < 42));
with ((doSomething(), val)) {}
```

**Total Locations:** 2

**Locations:**
- [ ] `whatsapp-web.js/src/Client.js:1000` - Unexpected use of comma operator
- [ ] `whatsapp-web.js/src/Client.js:995` - Unexpected use of comma operator

---

### [DeepSource] Audit: Starting a process with a partial executable path (BAN-B607)

**Category:** SECURITY
**Description:**
Python possesses many mechanisms to invoke an external executable. If the desired executable path is not fully qualified relative to the filesystem root then this may present a potential security risk.

<!--more-->
In POSIX environments, the PATH environment variable is used to specify a set of standard locations that will be searched for the first matching named executable. While convenient, this behavior may allow a malicious actor to exert control over a system. If they are able to adjust the contents of the PATH variable, or manipulate the file system, then a bogus executable may be discovered in place of the desired one. This executable will be invoked with the user privileges of the Python process that spawned it, potentially a highly privileged user.

This test will scan the parameters of all configured Python methods, looking for paths that do not start at the filesystem root, that is, do not have a leading ‘/’ character.

### Bad practice
```python
import subprocess

subprocess.run(['calculator', '-u', 'critical', msg], check=True) # Sensitive, Path not qualified from root
```

### Recommended
```python
import subprocess

subprocess.run(['/usr/bin/calculator', '-u', 'critical', msg], check=True) # Path qualified from root
```

## References:
- [Bandit B607](https://bandit.readthedocs.io/en/latest/plugins/b607_start_process_with_partial_path.html#b607-start-process-with-partial-path)
- OWASP Top 10 2021 Category A03 - [Injection](https://owasp.org/Top10/A03_2021-Injection/)

**Total Locations:** 9

**Locations:**
- [ ] `scripts/agent_orchestrator/main.py:515` - Starting a process with a partial executable path
- [ ] `scripts/agent_orchestrator/main.py:506` - Starting a process with a partial executable path
- [ ] `scripts/agent_orchestrator/main.py:497` - Starting a process with a partial executable path
- [ ] `scripts/agent_orchestrator/main.py:481` - Starting a process with a partial executable path
- [ ] `scripts/agent_orchestrator/main.py:465` - Starting a process with a partial executable path
- [ ] `scripts/agent_orchestrator/main.py:452` - Starting a process with a partial executable path
- [ ] `scripts/agent_orchestrator/main.py:446` - Starting a process with a partial executable path
- [ ] `scripts/agent_orchestrator/main.py:441` - Starting a process with a partial executable path
- [ ] `scripts/agent_orchestrator/main.py:418` - Starting a process with a partial executable path

---

### [DeepSource] Avoid square-bracket notation when accessing properties (JS-0049)

**Category:** ANTI_PATTERN
**Description:**
In JavaScript, there are two ways to access the properties of an object:

- dot-notation `(object.property)` ( Recommended )
- square-bracket notation `(object["property"])` ( Bad Practice )

The dot notation is preferred because it is easier to read, less verbose, and works better with aggressive JavaScript minimizers.

<!--more-->

### Bad Practice
```js
const x = object["property"];
```

### Recommended
```js
const x = object.property;
x = object[y];
```

**Total Locations:** 2

**Locations:**
- [ ] `tests/load/http-load.js:86` - ["error"] is better written in dot notation
- [ ] `tests/load/http-load.js:86` - ["error"] is better written in dot notation

---

### [DeepSource] Variables should not be initialized to `undefined` (JS-0126)

**Category:** ANTI_PATTERN
**Description:**
In JavaScript, a variable that is declared and not initialized to any value automatically gets the value of undefined. For example:
```js
var foo;

console.log(foo === undefined);     // true
```
It's therefore unnecessary to initialize a variable to `undefined`, such as:
```js
var foo = undefined;
```
It's considered a best practice to avoid initializing variables to `undefined`.

### Bad Practice

```js
var foo = undefined;
let bar = undefined;
```

### Recommended

```js
var foo;
let bar;
const baz = undefined;
```

**Total Locations:** 1

**Locations:**
- [ ] `services/wa-client/src/index.ts:343` - It's not necessary to initialize 'remotePhone: string | undefined' to undefined

---

### [DeepSource] Use `WORKDIR` to switch to a directory (DOK-DL3003)

**Category:** ANTI_PATTERN
**Description:**
Only use `cd` in a subshell. Most commands can work with absolute paths and in most cases, it is not necessary to change directories. Docker provides the `WORKDIR` instruction if you really need to change the current working directory. 

<!--more-->

Also note that any changes to the environment or working directory within a `RUN` command will not stay in effect in subsequent lines.

### Bad Practice

```dockerfile
FROM debian:buster
RUN cd /usr/src/app && git clone git@github.com:lukasmartinelli/hadolint.git
```

### Recommended

```dockerfile
FROM debian:buster
WORKDIR /usr/src/app
RUN git clone git@github.com:lukasmartinelli/hadolint.git
```

**Total Locations:** 9

**Locations:**
- [ ] `services/wa-client/Dockerfile:26` - Use WORKDIR to switch to a directory
- [ ] `services/wa-client/Dockerfile:21` - Use WORKDIR to switch to a directory
- [ ] `services/wa-client/Dockerfile:14` - Use WORKDIR to switch to a directory
- [ ] `services/scan-orchestrator/Dockerfile:22` - Use WORKDIR to switch to a directory
- [ ] `services/scan-orchestrator/Dockerfile:16` - Use WORKDIR to switch to a directory
- [ ] `services/scan-orchestrator/Dockerfile:10` - Use WORKDIR to switch to a directory
- [ ] `services/control-plane/Dockerfile:21` - Use WORKDIR to switch to a directory
- [ ] `services/control-plane/Dockerfile:16` - Use WORKDIR to switch to a directory
- [ ] `services/control-plane/Dockerfile:10` - Use WORKDIR to switch to a directory

---

### [DeepSource] Found redundant return statement (JS-W1045)

**Category:** ANTI_PATTERN
**Description:**
Return statements are unnecessary if the control flow will naturally exit a function.

### Bad Practice

```typescript
function writeToFile(file: string, content: string) {
  if (fileExists(file)) {
    fs.writeFileSync(file, content)
    return // <-- this is not necessary
  }
}
```

### Recommended

```typescript
function writeToFile(file: string, content: string) {
    if (fileExists(file)) {
        fs.writeFileSync(file, content);
    }
```

**Total Locations:** 1

**Locations:**
- [ ] `services/wa-client/src/index.ts:1037` - This return statement can be removed

---

### [DeepSource] Throwing literals as exceptions is not recommended (JS-0091)

**Category:** ANTI_PATTERN
**Description:**
It is considered good practice to only `throw` the `Error` object itself or an object using the `Error` object as base objects for user-defined exceptions.
The benefit of `Error` objects is that they automatically keep track of where they were built and originated.
This rule restricts what can be thrown as an exception.

### Bad Practice
```js
throw "error";

throw 0;

throw undefined;

throw null;

var err = new Error();
throw "an " + err;
// err is recast to a string literal

var err = new Error();
throw `${err}`
```

### Recommended

```js
throw new Error();

throw new Error("error");

var e = new Error("error");
throw e;

try {
    throw new Error("error");
} catch (e) {
    throw e;
}
```

**Total Locations:** 12

**Locations:**
- [ ] `whatsapp-web.js/tests/helper.js:17` - Expected an error object to be thrown
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:784` - Expected an error object to be thrown
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:214` - Expected an error object to be thrown
- [ ] `whatsapp-web.js/src/structures/List.js:66` - Expected an error object to be thrown
- [ ] `whatsapp-web.js/src/structures/List.js:62` - Expected an error object to be thrown
- [ ] `whatsapp-web.js/src/structures/List.js:60` - Expected an error object to be thrown
- [ ] `whatsapp-web.js/src/structures/List.js:59` - Expected an error object to be thrown
- [ ] `whatsapp-web.js/src/structures/Buttons.js:61` - Expected an error object to be thrown
- [ ] `whatsapp-web.js/src/Client.js:2426` - Expected an error object to be thrown
- [ ] `whatsapp-web.js/src/Client.js:2079` - Expected an error object to be thrown
- [ ] `whatsapp-web.js/src/Client.js:1331` - Expected an error object to be thrown
- [ ] `whatsapp-web.js/src/Client.js:1330` - Expected an error object to be thrown

---

### [DeepSource] Found unnecessary escape characters (JS-0097)

**Category:** ANTI_PATTERN
**Description:**
Escaping non-special characters in strings, template literals, and regular expressions doesn't have any effect.

<!--more-->

### Bad Practice

```js
"\'";
'\"';
"\#";
"\e";
`\"`;
`\"${foo}\"`;
`\#{foo}`;
/\!/;
/\@/;
```

### Recommended

```js
"\"";
'\'';
"\x12";
"\u00a9";
"\371";
"xs\u2111";
`\``;
`\${${foo}}`;
`$\{${foo}}`;
/\/g;
/\t/g;
/\w\$\*\^\./;
```

**Total Locations:** 2

**Locations:**
- [ ] `scripts/export-wwebjs-docs.mjs:36` - Unnecessary escape character: \/
- [ ] `packages/shared/src/url.ts:13` - Unnecessary escape character: \[

---

### [DeepSource] Void operators found (JS-0098)

**Category:** ANTI_PATTERN
**Description:**
The void operator takes an operand and returns undefined. It can be used to ignore the value produced by an expression. 
However, this can lead to code that is difficult to understand and maintain. 
Historically, the void operator was used to get a "pure" undefined value, as the undefined variable was mutable prior to ES5. 
Nowadays, this is no longer necessary as undefined is immutable in modern JavaScript.

### Bad Practice

```js
// will always return undefined
(function(){
    return void 0;
})();
```

### Recommended

```js
// Use explicit undefined
(function(){
    return undefined;
})();
```

**Total Locations:** 14

**Locations:**
- [ ] `tests/integration/stubs/bottleneck.ts:28` - Expected 'undefined' and instead saw 'void'
- [ ] `services/wa-client/src/pairingOrchestrator.ts:278` - Expected 'undefined' and instead saw 'void'
- [ ] `services/wa-client/src/pairingOrchestrator.ts:266` - Expected 'undefined' and instead saw 'void'
- [ ] `services/wa-client/src/pairingOrchestrator.ts:240` - Expected 'undefined' and instead saw 'void'
- [ ] `services/wa-client/src/pairingOrchestrator.ts:86` - Expected 'undefined' and instead saw 'void'
- [ ] `services/wa-client/src/index.ts:1351` - Expected 'undefined' and instead saw 'void'
- [ ] `services/wa-client/src/index.ts:1157` - Expected 'undefined' and instead saw 'void'
- [ ] `services/wa-client/src/index.ts:973` - Expected 'undefined' and instead saw 'void'
- [ ] `packages/shared/src/url-shortener.ts:246` - Expected 'undefined' and instead saw 'void'
- [ ] `packages/shared/src/url-shortener.ts:241` - Expected 'undefined' and instead saw 'void'
- [ ] `packages/shared/src/url-shortener.ts:238` - Expected 'undefined' and instead saw 'void'
- [ ] `packages/shared/src/url-shortener.ts:229` - Expected 'undefined' and instead saw 'void'
- [ ] `packages/shared/src/url-shortener.ts:222` - Expected 'undefined' and instead saw 'void'
- [ ] `packages/shared/src/url-shortener.ts:172` - Expected 'undefined' and instead saw 'void'

---

### [DeepSource] Prefer var declarations be placed at the top of their scope (JS-0102)

**Category:** ANTI_PATTERN
**Description:**
Declare variables at the top of their scope as it improves code readability, performance and also helps in code navigation.

<!--more-->

The `vars-on-top` rule generates warnings when variable declarations are not used serially at the top of a function scope or the top of a program. By default variable declarations are always moved (“hoisted”) invisibly to the top of their containing scope by the JavaScript interpreter. This rule forces the programmer to represent that behavior by manually moving the variable declaration to the top of its containing scope.

### Bad Practice
```js
// Variable declarations in a block:
function doSomething() {
    var first;
    if (true) {
        first = true;
    }
    var second;
}

// Variable declaration in for initializer:
function doSomething() {
    for (var i=0; i<10; i++) {}
}
```

### Recommended
```js
function doSomething() {
    var first;
    var second; //multiple declarations are allowed at the top
    if (true) {
        first = true;
    }
}

function doSomething() {
    var i;
    for (i=0; i<10; i++) {}
}
```

**Total Locations:** 6

**Locations:**
- [ ] `whatsapp-web.js/src/util/Util.js:23` - All 'var' declarations must be at the top of the function scope
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:714` - All 'var' declarations must be at the top of the function scope
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:98` - All 'var' declarations must be at the top of the function scope
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:7` - All 'var' declarations must be at the top of the function scope
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:6` - All 'var' declarations must be at the top of the function scope
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:5` - All 'var' declarations must be at the top of the function scope

---

### [DeepSource] Class methods should utilize `this` (JS-0105)

**Category:** ANTI_PATTERN
**Description:**
If a class method does not use `this`, it can sometimes be made into a static function. If you do convert the method into a static function, instances of the class that call that particular method have to be converted to a static call as well `(MyClass.callStaticMethod())`

### Bad Practice

```javascript
class Person {
  sayHi() {
    const greeting = document.createElement("div");
    greeting.innerText = "Hello!";
    document.appendChild();
  }
}

const person = new Person();
person.sayHi();
```

### Recommended

```javascript
class Person {
  static sayHi() {
    const greeting = document.createElement("div");
    greeting.innerText = "Hello!";
    document.appendChild();
  }
}

Person.sayHi();
```

**Total Locations:** 47

**Breakdown by Directory:**

#### 📂 packages/shared/src/reputation (1)
- [ ] `packages/shared/src/reputation/local-threat-db.ts:175` - Expected 'this' to be used by class method 'normalizeUrl'

#### 📂 services/control-plane/src (3)
- [ ] `services/control-plane/src/index.ts:131` - Expected 'this' to be used by class method 'quit'
- [ ] `services/control-plane/src/index.ts:129` - Expected 'this' to be used by class method 'on'
- [ ] `services/control-plane/src/database.ts:129` - Expected 'this' to be used by class async method 'transaction'

#### 📂 services/control-plane/src/__tests__ (3)
- [ ] `services/control-plane/src/__tests__/routes.test.ts:39` - Expected 'this' to be used by class method 'schedule'
- [ ] `services/control-plane/src/__tests__/routes.test.ts:36` - Expected 'this' to be used by class async method 'currentReservoir'
- [ ] `services/control-plane/src/__tests__/routes.test.ts:33` - Expected 'this' to be used by class method 'on'

#### 📂 services/scan-orchestrator/src (7)
- [ ] `services/scan-orchestrator/src/index.ts:187` - Expected 'this' to be used by class async method 'close'
- [ ] `services/scan-orchestrator/src/index.ts:186` - Expected 'this' to be used by class method 'on'
- [ ] `services/scan-orchestrator/src/index.ts:183` - Expected 'this' to be used by class async method 'getWaitingCount'
- [ ] `services/scan-orchestrator/src/index.ts:180` - Expected 'this' to be used by class async method 'getJobCounts'
- [ ] `services/scan-orchestrator/src/index.ts:170` - Expected 'this' to be used by class method 'quit'
- [ ] `services/scan-orchestrator/src/index.ts:166` - Expected 'this' to be used by class method 'on'
- [ ] `services/scan-orchestrator/src/database.ts:129` - Expected 'this' to be used by class async method 'transaction'

#### 📂 services/wa-client/src (7)
- [ ] `services/wa-client/src/pairingOrchestrator.ts:295` - Expected 'this' to be used by class method 'extractMessage'
- [ ] `services/wa-client/src/message-store.ts:95` - Expected 'this' to be used by class method 'serializeContext'
- [ ] `services/wa-client/src/message-store.ts:91` - Expected 'this' to be used by class method 'verdictMappingKey'
- [ ] `services/wa-client/src/message-store.ts:87` - Expected 'this' to be used by class method 'messageKey'
- [ ] `services/wa-client/src/index.ts:154` - Expected 'this' to be used by class method 'quit'
- [ ] `services/wa-client/src/index.ts:152` - Expected 'this' to be used by class method 'on'
- [ ] `services/wa-client/src/group-store.ts:20` - Expected 'this' to be used by class method 'key'

#### 📂 services/wa-client/src/__tests__ (4)
- [ ] `services/wa-client/src/__tests__/commands.test.ts:21` - Expected 'this' to be used by class method 'schedule'
- [ ] `services/wa-client/src/__tests__/commands.test.ts:20` - Expected 'this' to be used by class async method 'currentReservoir'
- [ ] `services/wa-client/src/__tests__/commands.test.ts:19` - Expected 'this' to be used by class method 'on'
- [ ] `services/wa-client/src/__tests__/commands.test.ts:7` - Expected 'this' to be used by class async method 'consume'

#### 📂 tests/e2e (3)
- [ ] `tests/e2e/control-plane.test.ts:24` - Expected 'this' to be used by class method 'schedule'
- [ ] `tests/e2e/control-plane.test.ts:23` - Expected 'this' to be used by class async method 'currentReservoir'
- [ ] `tests/e2e/control-plane.test.ts:22` - Expected 'this' to be used by class method 'on'

#### 📂 tests/stubs (2)
- [ ] `tests/stubs/bottleneck.ts:13` - Expected 'this' to be used by class async method 'schedule'
- [ ] `tests/stubs/bottleneck.ts:9` - Expected 'this' to be used by class method 'on'

#### 📂 whatsapp-web.js/src/authStrategies (10)
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:219` - Expected 'this' to be used by class async method 'delay'
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:210` - Expected 'this' to be used by class async method 'isValidPath'
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:24` - Expected 'this' to be used by class async method 'logout'
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:23` - Expected 'this' to be used by class async method 'destroy'
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:22` - Expected 'this' to be used by class async method 'disconnect'
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:21` - Expected 'this' to be used by class async method 'afterAuthReady'
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:20` - Expected 'this' to be used by class async method 'getAuthEventPayload'
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:13` - Expected 'this' to be used by class async method 'onAuthenticationNeeded'
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:12` - Expected 'this' to be used by class async method 'afterBrowserInitialized'
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:11` - Expected 'this' to be used by class async method 'beforeBrowserInitialized'

#### 📂 whatsapp-web.js/src/structures (4)
- [ ] `whatsapp-web.js/src/structures/ScheduledEvent.js:54` - Expected 'this' to be used by class method '_validateInputs'
- [ ] `whatsapp-web.js/src/structures/List.js:58` - Expected 'this' to be used by class method '_format'
- [ ] `whatsapp-web.js/src/structures/Buttons.js:73` - Expected 'this' to be used by class method '_format'
- [ ] `whatsapp-web.js/src/structures/Base.js:19` - Expected 'this' to be used by class method '_patch'

#### 📂 whatsapp-web.js/src/webCache (3)
- [ ] `whatsapp-web.js/src/webCache/WebCache.js:6` - Expected 'this' to be used by class async method 'persist'
- [ ] `whatsapp-web.js/src/webCache/WebCache.js:5` - Expected 'this' to be used by class async method 'resolve'
- [ ] `whatsapp-web.js/src/webCache/RemoteWebCache.js:35` - Expected 'this' to be used by class async method 'persist'


---

### [DeepSource] `async function` should have `await` expression (JS-0116)

**Category:** BUG_RISK
**Description:**
A function that does not contain any `await` expressions should not be `async` (except for some edge cases
in TypeScript which are discussed below).
Asynchronous functions in JavaScript behave differently than other functions in two important ways:

- The return value is always a `Promise`.
- You can use the `await` operator inside them.

Functions are made `async` so that we can use the `await` operator inside them.
Consider this example:

```js
async function fetchData(processDataItem) {
    const response = await fetch(DATA_URL);
    const data = await response.json();

    return data.map(processDataItem);
}
```

Asynchronous functions that don't use `await` might be an unintentional result of refactoring.

Note: This issue ignores async generator functions.
Generators `yield` rather than `return` a value and `async` generators might yield all the values of another async generator without ever actually needing to use `await`.

In TypeScript, one might feel the need to make a function `async` to comply with type signatures defined by an interface.
Ideally, the code should be refactored to get rid of such restrictions, but sometimes that isn't feasible
(For example, when we are implementing an interface defined in a 3rd party library like Next.js).

This situation can easily be circumvented by returning the value with a call to `Promise.resolve`:

```ts
interface HasAsyncFunc {
  getNum: () => Promise<number>
}

// Not recommended:
const o: HasAsyncFunc = {
  async getNum() { return 1 }
}

// Recommended:
const o: HasAsyncFunc = {
  // We only use `Promise.resolve` to adhere to the type
  // of the surrounding object.
  getNum() { return Promise.resolve(1) }
}
```

It is also advised to add a comment near the redundant promise to make the intent clear.

### Bad Practice

```js
async function fetchData(): string {
    // `readFileSync` is a synchronous function that blocks
    // the main thread, and thus does not need to be `await`ed
    return fs.readFileSync("data.txt", "utf-8");
}

performAction(async () => { console.log("no awaits in here") });
```

### Recommended

```js
async function fetchDataAsync(): Promise<string> {
  return await fs.readFile("data.txt", "utf-8")
}

performAction(async () => { await writeToFile(data) });

// Allow empty functions.
async function no_op() {}
```

**Total Locations:** 95

**Breakdown by Directory:**

#### 📂 scripts (16)
- [ ] `scripts/run-seeds.js:5` - Found `async` function without any `await` expressions
- [ ] `scripts/probe-deepsource.js:236` - Found `async` function without any `await` expressions
- [ ] `scripts/probe-deepsource.js:203` - Found `async` function without any `await` expressions
- [ ] `scripts/probe-deepsource.js:184` - Found `async` function without any `await` expressions
- [ ] `scripts/probe-deepsource.js:108` - Found `async` function without any `await` expressions
- [ ] `scripts/probe-deepsource.js:82` - Found `async` function without any `await` expressions
- [ ] `scripts/probe-deepsource.js:67` - Found `async` function without any `await` expressions
- [ ] `scripts/probe-deepsource.js:17` - Found `async` function without any `await` expressions
- [ ] `scripts/fetch-security-reports.js:97` - Found `async` function without any `await` expressions
- [ ] `scripts/fetch-security-reports.js:43` - Found `async` function without any `await` expressions
- [ ] `scripts/explore-deepsource-schema.js:15` - Found `async` function without any `await` expressions
- [ ] `scripts/deepsource-api.js:168` - Found `async` function without any `await` expressions
- [ ] `scripts/deepsource-api.js:134` - Found `async` function without any `await` expressions
- [ ] `scripts/deepsource-api.js:101` - Found `async` function without any `await` expressions
- [ ] `scripts/deepsource-api.js:84` - Found `async` function without any `await` expressions
- [ ] `scripts/deepsource-api.js:30` - Found `async` function without any `await` expressions

#### 📂 scripts/setup (5)
- [ ] `scripts/setup/orchestrator.mjs:893` - Found `async` function without any `await` expressions
- [ ] `scripts/setup/orchestrator.mjs:801` - Found `async` function without any `await` expressions
- [ ] `scripts/setup/orchestrator.mjs:791` - Found `async` function without any `await` expressions
- [ ] `scripts/setup/orchestrator.mjs:531` - Found `async` function without any `await` expressions
- [ ] `scripts/setup/orchestrator.mjs:242` - Found `async` function without any `await` expressions

#### 📂 scripts/ui (1)
- [ ] `scripts/ui/mode-manager.mjs:72` - Found `async` function without any `await` expressions

#### 📂 tests/setup-cli (6)
- [ ] `tests/setup-cli/setup-wizard.test.mjs:130` - Found `async` function without any `await` expressions
- [ ] `tests/setup-cli/setup-wizard.test.mjs:129` - Found `async` function without any `await` expressions
- [ ] `tests/setup-cli/setup-wizard.test.mjs:80` - Found `async` function without any `await` expressions
- [ ] `tests/setup-cli/setup-orchestrator.test.mjs:80` - Found `async` function without any `await` expressions
- [ ] `tests/setup-cli/setup-orchestrator.test.mjs:80` - Found `async` function without any `await` expressions
- [ ] `tests/setup-cli/setup-orchestrator.test.mjs:80` - Found `async` function without any `await` expressions

#### 📂 whatsapp-web.js (4)
- [ ] `whatsapp-web.js/example.js:683` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/example.js:553` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/example.js:545` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/example.js:35` - Found `async` function without any `await` expressions

#### 📂 whatsapp-web.js/src (21)
- [ ] `whatsapp-web.js/src/Client.js:2375` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/Client.js:2075` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/Client.js:2017` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/Client.js:2004` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/Client.js:1991` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/Client.js:1979` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/Client.js:1967` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/Client.js:1614` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/Client.js:1601` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/Client.js:1483` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/Client.js:1472` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/Client.js:1462` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/Client.js:1445` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/Client.js:1422` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/Client.js:1329` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/Client.js:903` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/Client.js:824` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/Client.js:255` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/Client.js:208` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/Client.js:193` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/Client.js:148` - Found `async` function without any `await` expressions

#### 📂 whatsapp-web.js/src/authStrategies (4)
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:219` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:74` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/authStrategies/LocalAuth.js:28` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:13` - Found `async` function without any `await` expressions

#### 📂 whatsapp-web.js/src/structures (32)
- [ ] `whatsapp-web.js/src/structures/Message.js:436` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Message.js:391` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Label.js:44` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/GroupNotification.js:98` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Contact.js:187` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Chat.js:322` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Chat.js:304` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Chat.js:294` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Chat.js:286` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Chat.js:278` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Chat.js:269` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Chat.js:250` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Chat.js:240` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Chat.js:230` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Chat.js:181` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Chat.js:151` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Chat.js:143` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Chat.js:135` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Chat.js:128` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Chat.js:119` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Chat.js:109` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Chat.js:101` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Chat.js:93` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Channel.js:328` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Channel.js:278` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Channel.js:261` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Channel.js:252` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Channel.js:243` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Channel.js:235` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Channel.js:220` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Channel.js:212` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Call.js:69` - Found `async` function without any `await` expressions

#### 📂 whatsapp-web.js/src/util (1)
- [ ] `whatsapp-web.js/src/util/Util.js:55` - Found `async` function without any `await` expressions

#### 📂 whatsapp-web.js/src/util/Injected (2)
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:812` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:710` - Found `async` function without any `await` expressions

#### 📂 whatsapp-web.js/src/webCache (3)
- [ ] `whatsapp-web.js/src/webCache/WebCache.js:5` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/webCache/LocalWebCache.js:32` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/webCache/LocalWebCache.js:20` - Found `async` function without any `await` expressions


---

### [DeepSource] Initialization in variable declarations against recommended approach (JS-0119)

**Category:** ANTI_PATTERN
**Description:**
In JavaScript, variables can be assigned during declaration, or at any point afterwards using an assignment statement. For example, in the following code, `foo` is initialized during declaration, while `bar` is initialized later.

```js
var foo = 1;
var bar;

if (foo) {
    bar = 1;
} else {
    bar = 2;
}
```

### Bad Practice

```js
function foo() {
    var bar;
    let baz;
}
```

### Recommended

```js
function foo() {
    var bar = 1;
    let baz = 2;
    const qux = 3;
}
```

**Total Locations:** 38

**Breakdown by Directory:**

#### 📂 scripts (3)
- [ ] `scripts/watch-pairing-code.js:178` - Variable 'parsed' should be initialized on declaration
- [ ] `scripts/watch-pairing-code.js:101` - Variable 'inputStream' should be initialized on declaration
- [ ] `scripts/watch-pairing-code.js:100` - Variable 'docker' should be initialized on declaration

#### 📂 scripts/setup (1)
- [ ] `scripts/setup/orchestrator.mjs:532` - Variable 'enquirer' should be initialized on declaration

#### 📂 tests/setup-cli (4)
- [ ] `tests/setup-cli/setup-wizard.test.mjs:95` - Variable 'context' should be initialized on declaration
- [ ] `tests/setup-cli/setup-wizard.test.mjs:53` - Variable 'root' should be initialized on declaration
- [ ] `tests/setup-cli/setup-wizard.test.mjs:31` - Variable 'root' should be initialized on declaration
- [ ] `tests/setup-cli/setup-orchestrator.test.mjs:14` - Variable 'originalFetch' should be initialized on declaration

#### 📂 whatsapp-web.js/src (8)
- [ ] `whatsapp-web.js/src/Client.js:1776` - Variable 'response' should be initialized on declaration
- [ ] `whatsapp-web.js/src/Client.js:1671` - Variable 'parentGroupWid' should be initialized on declaration
- [ ] `whatsapp-web.js/src/Client.js:1671` - Variable 'createGroupResult' should be initialized on declaration
- [ ] `whatsapp-web.js/src/Client.js:1157` - Variable 'channelMetadata' should be initialized on declaration
- [ ] `whatsapp-web.js/src/Client.js:468` - Variable 'revoked_msg' should be initialized on declaration
- [ ] `whatsapp-web.js/src/Client.js:462` - Variable 'last_message' should be initialized on declaration
- [ ] `whatsapp-web.js/src/Client.js:290` - Variable 'page' should be initialized on declaration
- [ ] `whatsapp-web.js/src/Client.js:286` - Variable 'browser' should be initialized on declaration

#### 📂 whatsapp-web.js/src/structures (2)
- [ ] `whatsapp-web.js/src/structures/Message.js:159` - Variable 'description' should be initialized on declaration
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:159` - Variable 'userChat' should be initialized on declaration

#### 📂 whatsapp-web.js/src/util (1)
- [ ] `whatsapp-web.js/src/util/Util.js:148` - Variable 'webpMedia' should be initialized on declaration

#### 📂 whatsapp-web.js/src/util/Injected (7)
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:999` - Variable 'response' should be initialized on declaration
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:998` - Variable 'membershipRequests' should be initialized on declaration
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:954` - Variable 'resultArgs' should be initialized on declaration
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:954` - Variable 'rpcResult' should be initialized on declaration
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:516` - Variable 'chat' should be initialized on declaration
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:242` - Variable 'participant' should be initialized on declaration
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:191` - Variable 'caption' should be initialized on declaration

#### 📂 whatsapp-web.js/tests (3)
- [ ] `whatsapp-web.js/tests/client.js:655` - Variable 'previousStatus' should be initialized on declaration
- [ ] `whatsapp-web.js/tests/client.js:655` - Variable 'me' should be initialized on declaration
- [ ] `whatsapp-web.js/tests/client.js:278` - Variable 'client' should be initialized on declaration

#### 📂 whatsapp-web.js/tests/structures (9)
- [ ] `whatsapp-web.js/tests/structures/message.js:51` - Variable 'replyMsg' should be initialized on declaration
- [ ] `whatsapp-web.js/tests/structures/message.js:12` - Variable 'message' should be initialized on declaration
- [ ] `whatsapp-web.js/tests/structures/message.js:11` - Variable 'chat' should be initialized on declaration
- [ ] `whatsapp-web.js/tests/structures/message.js:10` - Variable 'client' should be initialized on declaration
- [ ] `whatsapp-web.js/tests/structures/group.js:195` - Variable 'code' should be initialized on declaration
- [ ] `whatsapp-web.js/tests/structures/group.js:8` - Variable 'group' should be initialized on declaration
- [ ] `whatsapp-web.js/tests/structures/group.js:7` - Variable 'client' should be initialized on declaration
- [ ] `whatsapp-web.js/tests/structures/chat.js:12` - Variable 'chat' should be initialized on declaration
- [ ] `whatsapp-web.js/tests/structures/chat.js:11` - Variable 'client' should be initialized on declaration


---

### [DeepSource] Local variable name shadows variable in outer scope (JS-0123)

**Category:** BUG_RISK
**Description:**
Two variables can have the same name if they're declared in different scopes.
In the example below, the parameter `x` is said to "shadow" the variable `x` declared above it.
The outer `x` can no longer be accessed inside the `sum` function.

```js
const x = 1
function add(x, y) {
    return x + y
}
```

While shadowing does not cause any problems most of the time, it does make the code harder to read and understand.
We highly recommend against shadowing.
However, if you want to shadow some variable name and don't want DeepSource to flag it, add a [skipcq comment](https://docs.deepsource.com/docs/issues-ignore-rules) alongside an explanation:

```js
const x = 1
function add(x, y) { // skipcq: JS-0123 - `x` can be safely shadowed
    return x + y
}
```

If you want to disable this issue project-wide, you can add it to the list of disabled issues in the project dashboard.

### Bad Practice

```js
const file = "data.txt"

function readFile(file) {
    // The parameter `file` shadows the toplevel variable `file`.
    if (fs.existsSync(file)) {
        return fs.readFileSync(file)
    }
    return null
}
```

### Recommended

```js
// Prefer variable names that are distinct and convey as much
// meaning as possible.
const dataFile = "data.txt"

function readFile(filePath) {
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath)
    }
    return null
}
```

Alternatively:

```js
const file = "data.txt"

function readFile(file) { // skipcq: JS-0123 - Shadowing is safe here
    // ...
}
```

**Total Locations:** 135

**Breakdown by Directory:**

#### 📂 scripts (1)
- [ ] `scripts/export-wwebjs-docs.mjs:149` - 'main' is already declared in the upper scope on line 181 column 16

#### 📂 whatsapp-web.js (1)
- [ ] `whatsapp-web.js/example.js:314` - 'msg' is already declared in the upper scope on line 67 column 28

#### 📂 whatsapp-web.js/src (87)
- [ ] `whatsapp-web.js/src/Client.js:2430` - 'pollVotes' is already declared in the upper scope on line 2428 column 15
- [ ] `whatsapp-web.js/src/Client.js:2428` - 'msg' is already declared in the upper scope on line 2424 column 15
- [ ] `whatsapp-web.js/src/Client.js:2400` - 'userId' is already declared in the upper scope on line 2399 column 27
- [ ] `whatsapp-web.js/src/Client.js:2375` - 'userId' is already declared in the upper scope on line 2374 column 33
- [ ] `whatsapp-web.js/src/Client.js:2375` - 'note' is already declared in the upper scope on line 2374 column 41
- [ ] `whatsapp-web.js/src/Client.js:2353` - 'userIds' is already declared in the upper scope on line 2352 column 33
- [ ] `whatsapp-web.js/src/Client.js:2342` - 'phoneNumber' is already declared in the upper scope on line 2340 column 36
- [ ] `whatsapp-web.js/src/Client.js:2324` - 'phoneNumber' is already declared in the upper scope on line 2322 column 40
- [ ] `whatsapp-web.js/src/Client.js:2324` - 'firstName' is already declared in the upper scope on line 2322 column 53
- [ ] `whatsapp-web.js/src/Client.js:2324` - 'syncToAddressbook' is already declared in the upper scope on line 2322 column 74
- [ ] `whatsapp-web.js/src/Client.js:2324` - 'lastName' is already declared in the upper scope on line 2322 column 64
- [ ] `whatsapp-web.js/src/Client.js:2305` - 'response' is already declared in the upper scope on line 2302 column 40
- [ ] `whatsapp-web.js/src/Client.js:2290` - 'callType' is already declared in the upper scope on line 2281 column 37
- [ ] `whatsapp-web.js/src/Client.js:2262` - 'chatId' is already declared in the upper scope on line 2261 column 23
- [ ] `whatsapp-web.js/src/Client.js:2247` - 'userId' is already declared in the upper scope on line 2246 column 33
- [ ] `whatsapp-web.js/src/Client.js:2229` - 'flag' is already declared in the upper scope on line 2228 column 29
- [ ] `whatsapp-web.js/src/Client.js:2212` - 'flag' is already declared in the upper scope on line 2211 column 33
- [ ] `whatsapp-web.js/src/Client.js:2197` - 'flag' is already declared in the upper scope on line 2196 column 33
- [ ] `whatsapp-web.js/src/Client.js:2182` - 'flag' is already declared in the upper scope on line 2181 column 36
- [ ] `whatsapp-web.js/src/Client.js:2167` - 'flag' is already declared in the upper scope on line 2166 column 32
- [ ] `whatsapp-web.js/src/Client.js:2155` - 'options' is already declared in the upper scope on line 2154 column 50
- [ ] `whatsapp-web.js/src/Client.js:2155` - 'groupId' is already declared in the upper scope on line 2154 column 41
- [ ] `whatsapp-web.js/src/Client.js:2142` - 'groupId' is already declared in the upper scope on line 2141 column 42
- [ ] `whatsapp-web.js/src/Client.js:2142` - 'options' is already declared in the upper scope on line 2141 column 51
- [ ] `whatsapp-web.js/src/Client.js:2114` - 'groupId' is already declared in the upper scope on line 2113 column 38
- [ ] `whatsapp-web.js/src/Client.js:2077` - 'chatIds' is already declared in the upper scope on line 2075 column 39
- [ ] `whatsapp-web.js/src/Client.js:2077` - 'labelIds' is already declared in the upper scope on line 2075 column 29
- [ ] `whatsapp-web.js/src/Client.js:2050` - 'media' is already declared in the upper scope on line 2049 column 29
- [ ] `whatsapp-web.js/src/Client.js:2017` - 'labelId' is already declared in the upper scope on line 2016 column 29
- [ ] `whatsapp-web.js/src/Client.js:2004` - 'chatId' is already declared in the upper scope on line 2003 column 25
- [ ] `whatsapp-web.js/src/Client.js:1991` - 'labelId' is already declared in the upper scope on line 1990 column 24
- [ ] `whatsapp-web.js/src/Client.js:1949` - 'channelId' is already declared in the upper scope on line 1948 column 25
- [ ] `whatsapp-web.js/src/Client.js:1857` - 'options' is already declared in the upper scope on line 1856 column 59
- [ ] `whatsapp-web.js/src/Client.js:1857` - 'newOwnerId' is already declared in the upper scope on line 1856 column 47
- [ ] `whatsapp-web.js/src/Client.js:1857` - 'channelId' is already declared in the upper scope on line 1856 column 36
- [ ] `whatsapp-web.js/src/Client.js:1837` - 'options' is already declared in the upper scope on line 1836 column 45
- [ ] `whatsapp-web.js/src/Client.js:1837` - 'channelId' is already declared in the upper scope on line 1836 column 34
- [ ] `whatsapp-web.js/src/Client.js:1819` - 'channelId' is already declared in the upper scope on line 1818 column 30
- [ ] `whatsapp-web.js/src/Client.js:1775` - 'title' is already declared in the upper scope on line 1774 column 25
- [ ] `whatsapp-web.js/src/Client.js:1775` - 'options' is already declared in the upper scope on line 1774 column 32
- [ ] `whatsapp-web.js/src/Client.js:1663` - 'title' is already declared in the upper scope on line 1659 column 23
- [ ] `whatsapp-web.js/src/Client.js:1663` - 'participants' is already declared in the upper scope on line 1659 column 30
- [ ] `whatsapp-web.js/src/Client.js:1663` - 'options' is already declared in the upper scope on line 1659 column 49
- [ ] `whatsapp-web.js/src/Client.js:1584` - 'number' is already declared in the upper scope on line 1579 column 23
- [ ] `whatsapp-web.js/src/Client.js:1531` - 'contactId' is already declared in the upper scope on line 1530 column 27
- [ ] `whatsapp-web.js/src/Client.js:1510` - 'contactId' is already declared in the upper scope on line 1509 column 28
- [ ] `whatsapp-web.js/src/Client.js:1498` - 'chatId' is already declared in the upper scope on line 1497 column 26
- [ ] `whatsapp-web.js/src/Client.js:1484` - 'chatId' is already declared in the upper scope on line 1483 column 28
- [ ] `whatsapp-web.js/src/Client.js:1484` - 'action' is already declared in the upper scope on line 1483 column 36
- [ ] `whatsapp-web.js/src/Client.js:1484` - 'unmuteDateTs' is already declared in the upper scope on line 1483 column 44
- [ ] `whatsapp-web.js/src/Client.js:1446` - 'chatId' is already declared in the upper scope on line 1445 column 21
- [ ] `whatsapp-web.js/src/Client.js:1423` - 'chatId' is already declared in the upper scope on line 1422 column 19
- [ ] `whatsapp-web.js/src/Client.js:1411` - 'chatId' is already declared in the upper scope on line 1410 column 25
- [ ] `whatsapp-web.js/src/Client.js:1399` - 'chatId' is already declared in the upper scope on line 1398 column 23
- [ ] `whatsapp-web.js/src/Client.js:1356` - 'displayName' is already declared in the upper scope on line 1355 column 26
- [ ] `whatsapp-web.js/src/Client.js:1344` - 'status' is already declared in the upper scope on line 1343 column 21
- [ ] `whatsapp-web.js/src/Client.js:1332` - 'inviteInfo' is already declared in the upper scope on line 1329 column 31
- [ ] `whatsapp-web.js/src/Client.js:1312` - 'userId' is already declared in the upper scope on line 1311 column 41
- [ ] `whatsapp-web.js/src/Client.js:1312` - 'channelId' is already declared in the upper scope on line 1311 column 30
- [ ] `whatsapp-web.js/src/Client.js:1293` - 'channelId' is already declared in the upper scope on line 1292 column 36
- [ ] `whatsapp-web.js/src/Client.js:1293` - 'userId' is already declared in the upper scope on line 1292 column 47
- [ ] `whatsapp-web.js/src/Client.js:1275` - 'channelId' is already declared in the upper scope on line 1274 column 36
- [ ] `whatsapp-web.js/src/Client.js:1262` - 'inviteCode' is already declared in the upper scope on line 1261 column 24
- [ ] `whatsapp-web.js/src/Client.js:1251` - 'inviteCode' is already declared in the upper scope on line 1250 column 25
- [ ] `whatsapp-web.js/src/Client.js:1228` - 'pinnedMsgs' is already declared in the upper scope on line 1221 column 15
- [ ] `whatsapp-web.js/src/Client.js:1221` - 'chatId' is already declared in the upper scope on line 1220 column 29
- [ ] `whatsapp-web.js/src/Client.js:1199` - 'msg' is already declared in the upper scope on line 1198 column 15
- [ ] `whatsapp-web.js/src/Client.js:1198` - 'messageId' is already declared in the upper scope on line 1197 column 26
- [ ] `whatsapp-web.js/src/Client.js:1190` - 'contactId' is already declared in the upper scope on line 1189 column 26
- [ ] `whatsapp-web.js/src/Client.js:1156` - 'inviteCode' is already declared in the upper scope on line 1155 column 34
- [ ] `whatsapp-web.js/src/Client.js:1142` - 'chatId' is already declared in the upper scope on line 1141 column 23
- [ ] `whatsapp-web.js/src/Client.js:1105` - 'messages' is already declared in the upper scope on line 1104 column 15
- [ ] `whatsapp-web.js/src/Client.js:1104` - 'query' is already declared in the upper scope on line 1103 column 26
- [ ] `whatsapp-web.js/src/Client.js:1071` - 'chatId' is already declared in the upper scope on line 1070 column 34
- [ ] `whatsapp-web.js/src/Client.js:1071` - 'channelId' is already declared in the upper scope on line 1070 column 42
- [ ] `whatsapp-web.js/src/Client.js:1071` - 'options' is already declared in the upper scope on line 1070 column 53
- [ ] `whatsapp-web.js/src/Client.js:1038` - 'chatId' is already declared in the upper scope on line 949 column 23
- [ ] `whatsapp-web.js/src/Client.js:1038` - 'content' is already declared in the upper scope on line 949 column 31
- [ ] `whatsapp-web.js/src/Client.js:1038` - 'sendSeen' is already declared in the upper scope on line 991 column 15
- [ ] `whatsapp-web.js/src/Client.js:1038` - 'options' is already declared in the upper scope on line 949 column 40
- [ ] `whatsapp-web.js/src/Client.js:903` - 'chatId' is already declared in the upper scope on line 902 column 20
- [ ] `whatsapp-web.js/src/Client.js:884` - 'browserName' is already declared in the upper scope on line 883 column 37
- [ ] `whatsapp-web.js/src/Client.js:884` - 'deviceName' is already declared in the upper scope on line 883 column 25
- [ ] `whatsapp-web.js/src/Client.js:368` - 'intervalMs' is already declared in the upper scope on line 367 column 68
- [ ] `whatsapp-web.js/src/Client.js:368` - 'phoneNumber' is already declared in the upper scope on line 367 column 30
- [ ] `whatsapp-web.js/src/Client.js:368` - 'showNotification' is already declared in the upper scope on line 367 column 43
- [ ] `whatsapp-web.js/src/Client.js:116` - 'state' is already declared in the upper scope on line 111 column 17

#### 📂 whatsapp-web.js/src/authStrategies (1)
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:210` - 'path' is already declared in the upper scope on line 14 column 7

#### 📂 whatsapp-web.js/src/structures (30)
- [ ] `whatsapp-web.js/src/structures/MessageMedia.js:77` - 'mime' is already declared in the upper scope on line 5 column 7
- [ ] `whatsapp-web.js/src/structures/MessageMedia.js:74` - 'options' is already declared in the upper scope on line 67 column 31
- [ ] `whatsapp-web.js/src/structures/MessageMedia.js:74` - 'url' is already declared in the upper scope on line 67 column 26
- [ ] `whatsapp-web.js/src/structures/Message.js:723` - 'editedEventObject' is already declared in the upper scope on line 718 column 30
- [ ] `whatsapp-web.js/src/structures/Message.js:695` - 'options' is already declared in the upper scope on line 674 column 25
- [ ] `whatsapp-web.js/src/structures/Message.js:621` - 'msg' is already declared in the upper scope on line 620 column 19
- [ ] `whatsapp-web.js/src/structures/Message.js:554` - 'duration' is already declared in the upper scope on line 553 column 15
- [ ] `whatsapp-web.js/src/structures/Message.js:503` - 'everyone' is already declared in the upper scope on line 502 column 18
- [ ] `whatsapp-web.js/src/structures/Message.js:503` - 'clearMedia' is already declared in the upper scope on line 502 column 28
- [ ] `whatsapp-web.js/src/structures/Message.js:436` - 'chatId' is already declared in the upper scope on line 434 column 15
- [ ] `whatsapp-web.js/src/structures/Message.js:410` - 'reaction' is already declared in the upper scope on line 409 column 17
- [ ] `whatsapp-web.js/src/structures/Message.js:374` - 'quotedMsg' is already declared in the upper scope on line 372 column 15
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:378` - 'media' is already declared in the upper scope on line 377 column 22
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:343` - 'adminsOnly' is already declared in the upper scope on line 342 column 29
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:320` - 'adminsOnly' is already declared in the upper scope on line 319 column 33
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:299` - 'adminsOnly' is already declared in the upper scope on line 298 column 35
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:275` - 'description' is already declared in the upper scope on line 274 column 26
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:253` - 'subject' is already declared in the upper scope on line 252 column 22
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:234` - 'participantIds' is already declared in the upper scope on line 233 column 30
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:215` - 'participantIds' is already declared in the upper scope on line 214 column 31
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:196` - 'participantIds' is already declared in the upper scope on line 195 column 30
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:117` - 'sleep' is already declared in the upper scope on line 80 column 21
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:79` - 'options' is already declared in the upper scope on line 78 column 43
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:79` - 'participantIds' is already declared in the upper scope on line 78 column 27
- [ ] `whatsapp-web.js/src/structures/Chat.js:193` - 'searchOptions' is already declared in the upper scope on line 192 column 25
- [ ] `whatsapp-web.js/src/structures/Channel.js:368` - 'action' is already declared in the upper scope on line 367 column 30
- [ ] `whatsapp-web.js/src/structures/Channel.js:339` - 'property' is already declared in the upper scope on line 338 column 38
- [ ] `whatsapp-web.js/src/structures/Channel.js:339` - 'value' is already declared in the upper scope on line 338 column 31
- [ ] `whatsapp-web.js/src/structures/Channel.js:290` - 'searchOptions' is already declared in the upper scope on line 289 column 25
- [ ] `whatsapp-web.js/src/structures/Channel.js:103` - 'limit' is already declared in the upper scope on line 102 column 26

#### 📂 whatsapp-web.js/src/util (11)
- [ ] `whatsapp-web.js/src/util/Util.js:181` - 'path' is already declared in the upper scope on line 3 column 7
- [ ] `whatsapp-web.js/src/util/Util.js:63` - 'media' is already declared in the upper scope on line 55 column 43
- [ ] `whatsapp-web.js/src/util/Puppeteer.js:14` - 'name' is already declared in the upper scope on line 13 column 45
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:117` - 'features' is already declared in the upper scope on line 116 column 27
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:104` - 'features' is already declared in the upper scope on line 103 column 26
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:93` - 'feature' is already declared in the upper scope on line 92 column 30
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:63` - 'msgId' is already declared in the upper scope on line 62 column 29
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:50` - 'msgId' is already declared in the upper scope on line 49 column 28
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:39` - 'chatId' is already declared in the upper scope on line 38 column 26
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:28` - 'chatId' is already declared in the upper scope on line 27 column 26
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:17` - 'chatId' is already declared in the upper scope on line 16 column 26

#### 📂 whatsapp-web.js/src/util/Injected (2)
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:1023` - 'sleep' is already declared in the upper scope on line 994 column 83
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:854` - 'img' is already declared in the upper scope on line 853 column 15

#### 📂 whatsapp-web.js/tests (1)
- [ ] `whatsapp-web.js/tests/client.js:354` - 'expectedModules' is already declared in the upper scope on line 306 column 23

#### 📂 whatsapp-web.js/tests/structures (1)
- [ ] `whatsapp-web.js/tests/structures/message.js:31` - 'chat' is already declared in the upper scope on line 11 column 9


---

### [DeepSource] Found unnecessary constructors (JS-0237)

**Category:** ANTI_PATTERN
**Description:**
ES2015 provides a default class constructor if one is not specified. As such, it is unnecessary to provide an empty constructor or one that simply delegates into its parent class, as in the following examples:
```
class A {
    constructor () {
    }
}

class B extends A {
    constructor (value) {
      super(value);
    }
}
```

### Bad Practice

```js
class A {
    constructor () {
    }
}

class B extends A {
    constructor (...args) {
      super(...args);
    }
}
```

### Recommended

```js
class A { }

class A {
    constructor () {
        doSomething();
    }
}

class B extends A {
    constructor() {
        super('foo');
    }
}

class B extends A {
    constructor() {
        super();
        doSomething();
    }
}
```

**Total Locations:** 4

**Locations:**
- [ ] `whatsapp-web.js/src/structures/ScheduledEvent.js:63` - Useless constructor
- [ ] `whatsapp-web.js/src/structures/ScheduledEvent.js:57` - Useless constructor
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:7` - Useless constructor
- [ ] `whatsapp-web.js/src/Client.js:2284` - Useless constructor

---

### [SonarQube] Prefer `Number.parseInt` over `parseInt`. (typescript:S7773)

**Category:** Code Smell
**Description:**
Prefer `Number.parseInt` over `parseInt`.

**Total Locations:** 33

**Breakdown by Directory:**

#### 📂 packages/shared/src (33)
- [ ] `packages/shared/src/config.ts:161` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:162` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:139` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:168` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:172` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:178` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:182` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:185` - Prefer `Number.parseFloat` over `parseFloat`.
- [ ] `packages/shared/src/config.ts:undefined` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:79` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:86` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:87` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:91` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:97` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:101` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:111` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:112` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:113` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:114` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:115` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:132` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:143` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:144` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:147` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:149` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:150` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:151` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:154` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:155` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:156` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:189` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/config.ts:207` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `packages/shared/src/scoring.ts:173` - Prefer `Number.parseInt` over `parseInt`.


---

### [SonarQube] Prefer `node:tls` over `tls`. (typescript:S7772)

**Category:** Code Smell
**Description:**
Prefer `node:tls` over `tls`.

**Total Locations:** 13

**Locations:**
- [ ] `packages/shared/src/reputation/certificate-intelligence.ts:3` - Prefer `node:tls` over `tls`.
- [ ] `packages/shared/src/reputation/dns-intelligence.ts:2` - Prefer `node:dns/promises` over `dns/promises`.
- [ ] `packages/shared/src/database.ts:3` - Prefer `node:fs` over `fs`.
- [ ] `packages/shared/src/database.ts:4` - Prefer `node:path` over `path`.
- [ ] `services/control-plane/src/database.ts:1` - Prefer `node:fs` over `fs`.
- [ ] `services/control-plane/src/database.ts:2` - Prefer `node:path` over `path`.
- [ ] `services/scan-orchestrator/src/database.ts:1` - Prefer `node:fs` over `fs`.
- [ ] `services/scan-orchestrator/src/database.ts:2` - Prefer `node:path` over `path`.
- [ ] `packages/shared/src/reputation/certificate-intelligence.ts:undefined` - Prefer `node:tls` over `tls`.
- [ ] `packages/shared/src/reputation/certificate-intelligence.ts:undefined` - Prefer `node:https` over `https`.
- [ ] `packages/shared/src/reputation/dns-intelligence.ts:undefined` - Prefer `node:dns` over `dns`.
- [ ] `packages/shared/src/reputation/http-fingerprint.ts:undefined` - Prefer `node:https` over `https`.
- [ ] `packages/shared/src/reputation/local-threat-db.ts:undefined` - Prefer `node:crypto` over `crypto`.

---

### [SonarQube] Handle this exception or don't catch it at all. (typescript:S2486)

**Category:** Code Smell
**Description:**
Handle this exception or don't catch it at all.

**Total Locations:** 7

**Locations:**
- [ ] `packages/shared/src/reputation/certificate-intelligence.ts:163` - Handle this exception or don't catch it at all.
- [ ] `packages/shared/src/reputation/dns-intelligence.ts:123` - Handle this exception or don't catch it at all.
- [ ] `packages/shared/src/reputation/dns-intelligence.ts:134` - Handle this exception or don't catch it at all.
- [ ] `packages/shared/src/reputation/dns-intelligence.ts:156` - Handle this exception or don't catch it at all.
- [ ] `packages/shared/src/reputation/http-fingerprint.ts:113` - Handle this exception or don't catch it at all.
- [ ] `packages/shared/src/reputation/local-threat-db.ts:182` - Handle this exception or don't catch it at all.
- [ ] `tests/e2e/full_flow.test.ts:23` - Handle this exception or don't catch it at all.

---

### [SonarQube] The catch parameter `_err` should be named `error_`. (typescript:S7718)

**Category:** Code Smell
**Description:**
The catch parameter `_err` should be named `error_`.

**Total Locations:** 8

**Locations:**
- [ ] `packages/shared/src/reputation/certificate-intelligence.ts:163` - The catch parameter `_err` should be named `error_`.
- [ ] `packages/shared/src/reputation/dns-intelligence.ts:123` - The catch parameter `_err` should be named `error_`.
- [ ] `packages/shared/src/reputation/dns-intelligence.ts:134` - The catch parameter `_err` should be named `error_`.
- [ ] `packages/shared/src/reputation/dns-intelligence.ts:156` - The catch parameter `_err` should be named `error_`.
- [ ] `packages/shared/src/reputation/http-fingerprint.ts:113` - The catch parameter `_err` should be named `error_`.
- [ ] `packages/shared/src/reputation/local-threat-db.ts:78` - The catch parameter `_err` should be named `error_`.
- [ ] `packages/shared/src/reputation/local-threat-db.ts:182` - The catch parameter `_err` should be named `error_`.
- [ ] `services/wa-client/src/index.ts:1863` - The catch parameter `sendErr` should be named `error_`.

---

### [SonarQube] Don't use a zero fraction in the number. (typescript:S7748)

**Category:** Code Smell
**Description:**
Don't use a zero fraction in the number.

**Total Locations:** 10

**Locations:**
- [ ] `packages/shared/src/reputation/dns-intelligence.ts:58` - Don't use a zero fraction in the number.
- [ ] `packages/shared/src/reputation/http-fingerprint.ts:48` - Don't use a zero fraction in the number.
- [ ] `packages/shared/src/reputation/local-threat-db.ts:65` - Don't use a zero fraction in the number.
- [ ] `services/scan-orchestrator/src/index.ts:1198` - Don't use a zero fraction in the number.
- [ ] `services/scan-orchestrator/src/index.ts:1529` - Don't use a zero fraction in the number.
- [ ] `packages/shared/src/reputation/advanced-heuristics.ts:undefined` - Don't use a zero fraction in the number.
- [ ] `services/scan-orchestrator/src/enhanced-security.ts:22` - Don't use a zero fraction in the number.
- [ ] `services/scan-orchestrator/src/enhanced-security.ts:22` - Don't use a zero fraction in the number.
- [ ] `services/scan-orchestrator/src/enhanced-security.ts:22` - Don't use a zero fraction in the number.
- [ ] `services/scan-orchestrator/src/enhanced-security.ts:132` - Don't use a zero fraction in the number.

---

### [SonarQube] Use concise character class syntax '\d' instead of '[0-9]'. (typescript:S6353)

**Category:** Code Smell
**Description:**
Use concise character class syntax '\d' instead of '[0-9]'.

**Total Locations:** 3

**Locations:**
- [ ] `packages/shared/src/reputation/http-fingerprint.ts:153` - Use concise character class syntax '\d' instead of '[0-9]'.
- [ ] `packages/shared/src/reputation/http-fingerprint.ts:undefined` - Use concise character class syntax '\d' instead of '[0-9]'.
- [ ] `packages/shared/src/reputation/http-fingerprint.ts:undefined` - Use concise character class syntax '\d' instead of '[0-9]'.

---

### [SonarQube] Prefer `node:path` over `path`. (javascript:S7772)

**Category:** Code Smell
**Description:**
Prefer `node:path` over `path`.

**Total Locations:** 16

**Breakdown by Directory:**

#### 📂 scripts (16)
- [ ] `scripts/run-seeds.js:2` - Prefer `node:path` over `path`.
- [ ] `scripts/run-seeds.js:9` - Prefer `node:fs` over `fs`.
- [ ] `scripts/explore-deepsource-schema.js:10` - Prefer `node:https` over `https`.
- [ ] `scripts/fetch-security-reports.js:21` - Prefer `node:https` over `https`.
- [ ] `scripts/fetch-security-reports.js:22` - Prefer `node:http` over `http`.
- [ ] `scripts/fetch-security-reports.js:23` - Prefer `node:fs` over `fs`.
- [ ] `scripts/fetch-security-reports.js:24` - Prefer `node:path` over `path`.
- [ ] `scripts/fetch-security-reports.js:25` - Prefer `node:url` over `url`.
- [ ] `scripts/generate-comprehensive-report.js:1` - Prefer `node:fs` over `fs`.
- [ ] `scripts/generate-comprehensive-report.js:2` - Prefer `node:path` over `path`.
- [ ] `scripts/probe-deepsource.js:9` - Prefer `node:https` over `https`.
- [ ] `scripts/deepsource-api.js:20` - Prefer `node:https` over `https`.
- [ ] `scripts/run-migrations.js:2` - Prefer `node:fs` over `fs`.
- [ ] `scripts/run-migrations.js:3` - Prefer `node:path` over `path`.
- [ ] `scripts/validate-config.js:2` - Prefer `node:fs` over `fs`.
- [ ] `scripts/validate-config.js:3` - Prefer `node:path` over `path`.


---

### [SonarQube] Prefer `String#replaceAll()` over `String#replace()`. (javascript:S7781)

**Category:** Code Smell
**Description:**
Prefer `String#replaceAll()` over `String#replace()`.

**Total Locations:** 5

**Locations:**
- [ ] `scripts/setup/orchestrator.mjs:495` - Prefer `String#replaceAll()` over `String#replace()`.
- [ ] `scripts/fetch-security-reports.js:38` - Prefer `String#replaceAll()` over `String#replace()`.
- [ ] `scripts/setup/artifacts/transcript.mjs:64` - Prefer `String#replaceAll()` over `String#replace()`.
- [ ] `scripts/setup/orchestrator.mjs:undefined` - Prefer `String#replaceAll()` over `String#replace()`.
- [ ] `scripts/export-wwebjs-docs.mjs:48` - Prefer `String#replaceAll()` over `String#replace()`.

---

### [SonarQube] Remove the declaration of the unused 'redisUrl' variable. (javascript:S1481)

**Category:** Code Smell
**Description:**
Remove the declaration of the unused 'redisUrl' variable.

**Total Locations:** 1

**Locations:**
- [ ] `scripts/setup/orchestrator.mjs:500` - Remove the declaration of the unused 'redisUrl' variable.

---

### [SonarQube] Prefer `Number.parseInt` over `parseInt`. (javascript:S7773)

**Category:** Code Smell
**Description:**
Prefer `Number.parseInt` over `parseInt`.

**Total Locations:** 3

**Locations:**
- [ ] `scripts/setup/orchestrator.mjs:924` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `scripts/run-migrations.js:undefined` - Prefer `Number.parseInt` over `parseInt`.
- [ ] `scripts/run-seeds.js:undefined` - Prefer `Number.parseInt` over `parseInt`.

---

### [SonarQube] Unexpected negated condition. (javascript:S7735)

**Category:** Code Smell
**Description:**
Unexpected negated condition.

**Total Locations:** 5

**Locations:**
- [ ] `scripts/setup/orchestrator.mjs:1126` - Unexpected negated condition.
- [ ] `scripts/setup/orchestrator.mjs:1331` - Unexpected negated condition.
- [ ] `scripts/generate-comprehensive-report.js:133` - Unexpected negated condition.
- [ ] `scripts/setup/orchestrator.mjs:1455` - Unexpected negated condition.
- [ ] `scripts/setup/orchestrator.mjs:1464` - Unexpected negated condition.

---

### [SonarQube] `new Error()` is too unspecific for a type check. Use `new TypeError()` instead. (typescript:S7786)

**Category:** Code Smell
**Description:**
`new Error()` is too unspecific for a type check. Use `new TypeError()` instead.

**Total Locations:** 1

**Locations:**
- [ ] `services/wa-client/src/index.ts:1018` - `new Error()` is too unspecific for a type check. Use `new TypeError()` instead.

---

### [SonarQube] Remove this redundant jump. (typescript:S3626)

**Category:** Code Smell
**Description:**
Remove this redundant jump.

**Total Locations:** 1

**Locations:**
- [ ] `services/wa-client/src/index.ts:1037` - Remove this redundant jump.

---

### [SonarQube] 'err ?? 'unknown'' will use Object's default stringification format ('[object Object]') when stringified. (typescript:S6551)

**Category:** Code Smell
**Description:**
'err ?? 'unknown'' will use Object's default stringification format ('[object Object]') when stringified.

**Total Locations:** 1

**Locations:**
- [ ] `services/wa-client/src/index.ts:1062` - 'err ?? 'unknown'' will use Object's default stringification format ('[object Object]') when stringified.

---

### [SonarQube] This assertion is unnecessary since the receiver accepts the original type of the expression. (typescript:S4325)

**Category:** Code Smell
**Description:**
This assertion is unnecessary since the receiver accepts the original type of the expression.

**Total Locations:** 18

**Breakdown by Directory:**

#### 📂 packages/shared/src (1)
- [ ] `packages/shared/src/config.ts:237` - This assertion is unnecessary since it does not change the type of the expression.

#### 📂 services/control-plane/src (6)
- [ ] `services/control-plane/src/database.ts:58` - This assertion is unnecessary since it does not change the type of the expression.
- [ ] `services/control-plane/src/database.ts:63` - This assertion is unnecessary since it does not change the type of the expression.
- [ ] `services/control-plane/src/index.ts:undefined` - This assertion is unnecessary since it does not change the type of the expression.
- [ ] `services/control-plane/src/index.ts:undefined` - This assertion is unnecessary since it does not change the type of the expression.
- [ ] `services/control-plane/src/index.ts:undefined` - This assertion is unnecessary since it does not change the type of the expression.
- [ ] `services/control-plane/src/index.ts:undefined` - This assertion is unnecessary since it does not change the type of the expression.

#### 📂 services/scan-orchestrator/src (4)
- [ ] `services/scan-orchestrator/src/database.ts:58` - This assertion is unnecessary since it does not change the type of the expression.
- [ ] `services/scan-orchestrator/src/database.ts:63` - This assertion is unnecessary since it does not change the type of the expression.
- [ ] `services/scan-orchestrator/src/index.ts:undefined` - This assertion is unnecessary since it does not change the type of the expression.
- [ ] `services/scan-orchestrator/src/index.ts:undefined` - This assertion is unnecessary since it does not change the type of the expression.

#### 📂 services/wa-client/src (2)
- [ ] `services/wa-client/src/index.ts:1029` - This assertion is unnecessary since it does not change the type of the expression.
- [ ] `services/wa-client/src/verdictTracker.ts:63` - This assertion is unnecessary since the receiver accepts the original type of the expression.

#### 📂 services/wa-client/src/utils (2)
- [ ] `services/wa-client/src/utils/historySync.ts:53` - This assertion is unnecessary since it does not change the type of the expression.
- [ ] `services/wa-client/src/utils/historySync.ts:54` - This assertion is unnecessary since it does not change the type of the expression.

#### 📂 tests/e2e (3)
- [ ] `tests/e2e/message-flow.test.ts:21` - This assertion is unnecessary since the receiver accepts the original type of the expression.
- [ ] `tests/e2e/message-flow.test.ts:38` - This assertion is unnecessary since the receiver accepts the original type of the expression.
- [ ] `tests/e2e/control-plane.test.ts:177` - This assertion is unnecessary since it does not change the type of the expression.


---

### [SonarQube] Prefer `String#replaceAll()` over `String#replace()`. (typescript:S7781)

**Category:** Code Smell
**Description:**
Prefer `String#replaceAll()` over `String#replace()`.

**Total Locations:** 8

**Locations:**
- [ ] `services/control-plane/src/database.ts:53` - Prefer `String#replaceAll()` over `String#replace()`.
- [ ] `services/control-plane/src/database.ts:117` - Prefer `String#replaceAll()` over `String#replace()`.
- [ ] `services/scan-orchestrator/src/database.ts:53` - Prefer `String#replaceAll()` over `String#replace()`.
- [ ] `services/scan-orchestrator/src/database.ts:117` - Prefer `String#replaceAll()` over `String#replace()`.
- [ ] `packages/shared/src/config.ts:233` - Prefer `String#replaceAll()` over `String#replace()`.
- [ ] `services/wa-client/src/index.ts:773` - Prefer `String#replaceAll()` over `String#replace()`.
- [ ] `packages/shared/src/url.ts:36` - Prefer `String#replaceAll()` over `String#replace()`.
- [ ] `services/wa-client/src/index.ts:2061` - Prefer `String#replaceAll()` over `String#replace()`.

---

### [SonarQube] Remove this unused import of 'afterAll'. (typescript:S1128)

**Category:** Code Smell
**Description:**
Remove this unused import of 'afterAll'.

**Total Locations:** 5

**Locations:**
- [ ] `tests/e2e/full_flow.test.ts:1` - Remove this unused import of 'afterAll'.
- [ ] `services/wa-client/src/index.ts:undefined` - Remove this unused import of 'VerdictAttemptPayload'.
- [ ] `packages/shared/src/scoring.ts:undefined` - Remove this unused import of 'GsbThreatMatch'.
- [ ] `services/scan-orchestrator/src/index.ts:undefined` - Remove this unused import of 'rateLimiterDelay'.
- [ ] `services/scan-orchestrator/src/index.ts:undefined` - Remove this unused import of 'WhoisXmlResponse'.

---

### [SonarQube] Prefer using nullish coalescing operator (`??=`) instead of an assignment expression, as it is simpler to read. (typescript:S6606)

**Category:** Code Smell
**Description:**
Prefer using nullish coalescing operator (`??=`) instead of an assignment expression, as it is simpler to read.

**Total Locations:** 1

**Locations:**
- [ ] `packages/shared/src/database.ts:82` - Prefer using nullish coalescing operator (`??=`) instead of an assignment expression, as it is simpler to read.

---

### [SonarQube] Unexpected negated condition. (typescript:S7735)

**Category:** Code Smell
**Description:**
Unexpected negated condition.

**Total Locations:** 9

**Locations:**
- [ ] `packages/shared/src/verdict-cache.ts:74` - Unexpected negated condition.
- [ ] `packages/shared/src/verdict-cache.ts:141` - Unexpected negated condition.
- [ ] `services/wa-client/src/index.ts:1360` - Unexpected negated condition.
- [ ] `services/wa-client/src/index.ts:1361` - Unexpected negated condition.
- [ ] `services/wa-client/src/message-store.ts:259` - Unexpected negated condition.
- [ ] `services/control-plane/src/__tests__/routes.test.ts:190` - Unexpected negated condition.
- [ ] `services/scan-orchestrator/src/blocklists.ts:78` - Unexpected negated condition.
- [ ] `services/scan-orchestrator/src/blocklists.ts:101` - Unexpected negated condition.
- [ ] `tests/e2e/control-plane.test.ts:123` - Unexpected negated condition.

---

### [SonarQube] Use asynchronous features in this function or remove the `async` keyword. (python:S7503)

**Category:** Code Smell
**Description:**
Use asynchronous features in this function or remove the `async` keyword.

**Total Locations:** 1

**Locations:**
- [ ] `scrape_baileys.py:55` - Use asynchronous features in this function or remove the `async` keyword.

---

### [SonarQube] Sort these package names alphanumerically. (docker:S7018)

**Category:** Code Smell
**Description:**
Sort these package names alphanumerically.

**Total Locations:** 1

**Locations:**
- [ ] `scripts/Dockerfile.migrate:4` - Sort these package names alphanumerically.

---

### [SonarQube] Merge this RUN instruction with the consecutive ones. (docker:S7031)

**Category:** Code Smell
**Description:**
Merge this RUN instruction with the consecutive ones.

**Total Locations:** 4

**Locations:**
- [ ] `scripts/Dockerfile.migrate:13` - Merge this RUN instruction with the consecutive ones.
- [ ] `services/control-plane/Dockerfile:21` - Merge this RUN instruction with the consecutive ones.
- [ ] `services/scan-orchestrator/Dockerfile:22` - Merge this RUN instruction with the consecutive ones.
- [ ] `services/wa-client/Dockerfile:26` - Merge this RUN instruction with the consecutive ones.

---

### [SonarQube] Replace this union type with a type alias. (typescript:S4323)

**Category:** Code Smell
**Description:**
Replace this union type with a type alias.

**Total Locations:** 1

**Locations:**
- [ ] `packages/shared/src/reputation/http-fingerprint.ts:undefined` - Replace this union type with a type alias.

---

### [SonarQube] Prefer `globalThis` over `global`. (javascript:S7764)

**Category:** Code Smell
**Description:**
Prefer `globalThis` over `global`.

**Total Locations:** 3

**Locations:**
- [ ] `tests/setup-cli/setup-orchestrator.test.mjs:79` - Prefer `globalThis` over `global`.
- [ ] `tests/setup-cli/setup-orchestrator.test.mjs:80` - Prefer `globalThis` over `global`.
- [ ] `tests/setup-cli/setup-orchestrator.test.mjs:88` - Prefer `globalThis` over `global`.

---

### [SonarQube] Remove this unused import of 'path'. (javascript:S1128)

**Category:** Code Smell
**Description:**
Remove this unused import of 'path'.

**Total Locations:** 1

**Locations:**
- [ ] `scripts/setup/core/env-file.mjs:3` - Remove this unused import of 'path'.

---

### [SonarQube] '/tmp/clone15697736802664054052/scripts/setup/ui/hotkeys.mjs' imported multiple times. (javascript:S3863)

**Category:** Code Smell
**Description:**
'/tmp/clone15697736802664054052/scripts/setup/ui/hotkeys.mjs' imported multiple times.

**Total Locations:** 2

**Locations:**
- [ ] `scripts/setup/orchestrator.mjs:19` - '/tmp/clone15697736802664054052/scripts/setup/ui/hotkeys.mjs' imported multiple times.
- [ ] `scripts/setup/orchestrator.mjs:178` - '/tmp/clone15697736802664054052/scripts/setup/ui/hotkeys.mjs' imported multiple times.

---

### [SonarQube] `new Error()` is too unspecific for a type check. Use `new TypeError()` instead. (javascript:S7786)

**Category:** Code Smell
**Description:**
`new Error()` is too unspecific for a type check. Use `new TypeError()` instead.

**Total Locations:** 1

**Locations:**
- [ ] `scripts/setup/orchestrator.mjs:248` - `new Error()` is too unspecific for a type check. Use `new TypeError()` instead.

---

### [SonarQube] Do not use an object literal as default for parameter `group`. (typescript:S7737)

**Category:** Code Smell
**Description:**
Do not use an object literal as default for parameter `group`.

**Total Locations:** 2

**Locations:**
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:39` - Do not use an object literal as default for parameter `group`.
- [ ] `packages/shared/src/circuit-breaker.ts:94` - Do not use an object literal as default for parameter `options`.

---

### [SonarQube] Prefer `globalThis` over `window`. (typescript:S7764)

**Category:** Code Smell
**Description:**
Prefer `globalThis` over `window`.

**Total Locations:** 12

**Locations:**
- [ ] `services/wa-client/src/index.ts:984` - Prefer `globalThis` over `window`.
- [ ] `tests/e2e/admin-commands.test.ts:6` - Prefer `globalThis` over `global`.
- [ ] `tests/e2e/admin-commands.test.ts:30` - Prefer `globalThis` over `global`.
- [ ] `tests/e2e/admin-commands.test.ts:33` - Prefer `globalThis` over `global`.
- [ ] `tests/e2e/admin-commands.test.ts:48` - Prefer `globalThis` over `global`.
- [ ] `tests/e2e/control-plane.test.ts:158` - Prefer `globalThis` over `global`.
- [ ] `services/wa-client/src/__tests__/commands.test.ts:83` - Prefer `globalThis` over `global`.
- [ ] `services/wa-client/src/__tests__/commands.test.ts:90` - Prefer `globalThis` over `global`.
- [ ] `services/wa-client/src/__tests__/commands.test.ts:26` - Prefer `globalThis` over `global`.
- [ ] `services/wa-client/src/__tests__/commands.test.ts:31` - Prefer `globalThis` over `global`.
- [ ] `services/wa-client/src/__tests__/commands.test.ts:35` - Prefer `globalThis` over `global`.
- [ ] `services/wa-client/src/__tests__/commands.test.ts:58` - Prefer `globalThis` over `global`.

---

### [SonarQube] 'any' overrides all other types in this union type. (typescript:S6571)

**Category:** Code Smell
**Description:**
'any' overrides all other types in this union type.

**Total Locations:** 2

**Locations:**
- [ ] `services/scan-orchestrator/src/index.ts:undefined` - 'any' overrides all other types in this union type.
- [ ] `packages/shared/src/reputation/virustotal.ts:undefined` - 'any' overrides all other types in this union type.

---

### [SonarQube] Do not call `Array#push()` multiple times. (typescript:S7778)

**Category:** Code Smell
**Description:**
Do not call `Array#push()` multiple times.

**Total Locations:** 1

**Locations:**
- [ ] `services/wa-client/src/index.ts:493` - Do not call `Array#push()` multiple times.

---

### [SonarQube] Prefer negative index over length minus index for `slice`. (typescript:S7771)

**Category:** Code Smell
**Description:**
Prefer negative index over length minus index for `slice`.

**Total Locations:** 4

**Locations:**
- [ ] `services/wa-client/src/message-store.ts:204` - Prefer negative index over length minus index for `slice`.
- [ ] `services/wa-client/src/message-store.ts:218` - Prefer negative index over length minus index for `slice`.
- [ ] `services/wa-client/src/message-store.ts:232` - Prefer negative index over length minus index for `slice`.
- [ ] `services/wa-client/src/message-store.ts:335` - Prefer negative index over length minus index for `slice`.

---

### [SonarQube] Handle this exception or don't catch it at all. (javascript:S2486)

**Category:** Code Smell
**Description:**
Handle this exception or don't catch it at all.

**Total Locations:** 4

**Locations:**
- [ ] `packages/confusable/index.js:23` - Handle this exception or don't catch it at all.
- [ ] `packages/confusable/index.js:35` - Handle this exception or don't catch it at all.
- [ ] `scripts/export-wwebjs-docs.mjs:60` - Handle this exception or don't catch it at all.
- [ ] `tests/load/http-load.js:84` - Handle this exception or don't catch it at all.

---

### [SonarQube] `String.raw` should be used to avoid escaping `\`. (javascript:S7780)

**Category:** Code Smell
**Description:**
`String.raw` should be used to avoid escaping `\`.

**Total Locations:** 1

**Locations:**
- [ ] `packages/shared/jest.config.js:5` - `String.raw` should be used to avoid escaping `\`.

---

### [SonarQube] arrow function is equivalent to `Boolean`. Use `Boolean` directly. (javascript:S7770)

**Category:** Code Smell
**Description:**
arrow function is equivalent to `Boolean`. Use `Boolean` directly.

**Total Locations:** 1

**Locations:**
- [ ] `scripts/export-wwebjs-docs.mjs:84` - arrow function is equivalent to `Boolean`. Use `Boolean` directly.

---

## LOW Priority Issues (48)

### [SonarQube] Using http protocol is insecure. Use https instead. (typescript:S5332)

**Category:** Security Hotspot
**Description:**
Using http protocol is insecure. Use https instead.

**Total Locations:** 17

**Breakdown by Directory:**

#### 📂 packages/shared/src (1)
- [ ] `packages/shared/src/config.ts:138` - Using http protocol is insecure. Use https instead.

#### 📂 packages/shared/src/__tests__ (2)
- [ ] `packages/shared/src/__tests__/url.test.ts:94` - Using http protocol is insecure. Use https instead.
- [ ] `packages/shared/src/__tests__/url.test.ts:95` - Using http protocol is insecure. Use https instead.

#### 📂 scripts (2)
- [ ] `scripts/replay-test-messages.ts:29` - Using http protocol is insecure. Use https instead.
- [ ] `scripts/replay-test-messages.ts:34` - Using http protocol is insecure. Use https instead.

#### 📂 services/wa-client/src (1)
- [ ] `services/wa-client/src/index.ts:769` - Using http protocol is insecure. Use https instead.

#### 📂 tests/e2e (2)
- [ ] `tests/e2e/admin-commands.test.ts:24` - Using http protocol is insecure. Use https instead.
- [ ] `tests/e2e/control-plane.test.ts:154` - Using http protocol is insecure. Use https instead.

#### 📂 tests/integration (9)
- [ ] `tests/integration/shortener-fallback.test.ts:78` - Using http protocol is insecure. Use https instead.
- [ ] `tests/integration/shortener-fallback.test.ts:96` - Using http protocol is insecure. Use https instead.
- [ ] `tests/integration/shortener-fallback.test.ts:118` - Using http protocol is insecure. Use https instead.
- [ ] `tests/integration/shortener-fallback.test.ts:155` - Using http protocol is insecure. Use https instead.
- [ ] `tests/integration/shortener-fallback.test.ts:189` - Using http protocol is insecure. Use https instead.
- [ ] `tests/integration/shortener-fallback.test.ts:203` - Using http protocol is insecure. Use https instead.
- [ ] `tests/integration/shortener-fallback.test.ts:210` - Using http protocol is insecure. Use https instead.
- [ ] `tests/integration/shortener-fallback.test.ts:224` - Using http protocol is insecure. Use https instead.
- [ ] `tests/integration/shortener-fallback.test.ts:231` - Using http protocol is insecure. Use https instead.


---

### [SonarQube] Make sure using a hardcoded IP address 10.0.0.1 is safe here. (typescript:S1313)

**Category:** Security Hotspot
**Description:**
Make sure using a hardcoded IP address 10.0.0.1 is safe here.

**Total Locations:** 19

**Breakdown by Directory:**

#### 📂 packages/shared/src (6)
- [ ] `packages/shared/src/ssrf.ts:5` - Make sure using a hardcoded IP address 10.0.0.0/8 is safe here.
- [ ] `packages/shared/src/ssrf.ts:6` - Make sure using a hardcoded IP address 172.16.0.0/12 is safe here.
- [ ] `packages/shared/src/ssrf.ts:7` - Make sure using a hardcoded IP address 192.168.0.0/16 is safe here.
- [ ] `packages/shared/src/ssrf.ts:9` - Make sure using a hardcoded IP address 169.254.0.0/16 is safe here.
- [ ] `packages/shared/src/ssrf.ts:11` - Make sure using a hardcoded IP address fc00::/7 is safe here.
- [ ] `packages/shared/src/ssrf.ts:12` - Make sure using a hardcoded IP address fe80::/10 is safe here.

#### 📂 packages/shared/src/__tests__ (8)
- [ ] `packages/shared/src/__tests__/ssrf.test.ts:18` - Make sure using a hardcoded IP address 10.0.0.1 is safe here.
- [ ] `packages/shared/src/__tests__/ssrf.test.ts:19` - Make sure using a hardcoded IP address 172.16.5.2 is safe here.
- [ ] `packages/shared/src/__tests__/ssrf.test.ts:20` - Make sure using a hardcoded IP address 192.168.1.10 is safe here.
- [ ] `packages/shared/src/__tests__/ssrf.test.ts:21` - Make sure using a hardcoded IP address 8.8.8.8 is safe here.
- [ ] `packages/shared/src/__tests__/ssrf.test.ts:26` - Make sure using a hardcoded IP address fc00::1 is safe here.
- [ ] `packages/shared/src/__tests__/ssrf.test.ts:27` - Make sure using a hardcoded IP address 2001:4860:4860::8888 is safe here.
- [ ] `packages/shared/src/__tests__/ssrf.test.ts:31` - Make sure using a hardcoded IP address 192.168.1.5 is safe here.
- [ ] `packages/shared/src/__tests__/ssrf.test.ts:34` - Make sure using a hardcoded IP address 8.8.8.8 is safe here.

#### 📂 tests/integration (5)
- [ ] `tests/integration/shortener-fallback.test.ts:32` - Make sure using a hardcoded IP address 93.184.216.34 is safe here.
- [ ] `tests/integration/shortener-fallback.test.ts:52` - Make sure using a hardcoded IP address 93.184.216.34 is safe here.
- [ ] `tests/integration/shortener-fallback.test.ts:62` - Make sure using a hardcoded IP address 93.184.216.34 is safe here.
- [ ] `tests/integration/shortener-fallback.test.ts:113` - Make sure using a hardcoded IP address 93.184.216.34 is safe here.
- [ ] `tests/integration/shortener-fallback.test.ts:184` - Make sure using a hardcoded IP address 93.184.216.34 is safe here.


---

### [SonarQube] Make sure the "PATH" variable only contains fixed, unwriteable directories. (javascript:S4036)

**Category:** Security Hotspot
**Description:**
Make sure the "PATH" variable only contains fixed, unwriteable directories.

**Total Locations:** 3

**Locations:**
- [ ] `scripts/watch-pairing-code.js:62` - Make sure the "PATH" variable only contains fixed, unwriteable directories.
- [ ] `scripts/watch-pairing-code.js:64` - Make sure the "PATH" variable only contains fixed, unwriteable directories.
- [ ] `scripts/watch-pairing-code.js:107` - Make sure the "PATH" variable only contains fixed, unwriteable directories.

---

### [SonarQube] Make sure the "PATH" variable only contains fixed, unwriteable directories. (typescript:S4036)

**Category:** Security Hotspot
**Description:**
Make sure the "PATH" variable only contains fixed, unwriteable directories.

**Total Locations:** 1

**Locations:**
- [ ] `tests/integration/setup-wizard.test.ts:10` - Make sure the "PATH" variable only contains fixed, unwriteable directories.

---

### [SonarQube] Omitting "--ignore-scripts" can lead to the execution of shell scripts. Make sure it is safe here. (docker:S6505)

**Category:** Security Hotspot
**Description:**
Omitting "--ignore-scripts" can lead to the execution of shell scripts. Make sure it is safe here.

**Total Locations:** 8

**Locations:**
- [ ] `services/control-plane/Dockerfile:11` - Omitting "--ignore-scripts" can lead to the execution of shell scripts. Make sure it is safe here.
- [ ] `services/control-plane/Dockerfile:17` - Omitting "--ignore-scripts" can lead to the execution of shell scripts. Make sure it is safe here.
- [ ] `services/control-plane/Dockerfile:18` - Omitting "--ignore-scripts" can lead to the execution of shell scripts. Make sure it is safe here.
- [ ] `services/scan-orchestrator/Dockerfile:11` - Omitting "--ignore-scripts" can lead to the execution of shell scripts. Make sure it is safe here.
- [ ] `services/scan-orchestrator/Dockerfile:17` - Omitting "--ignore-scripts" can lead to the execution of shell scripts. Make sure it is safe here.
- [ ] `services/wa-client/Dockerfile:15` - Omitting "--ignore-scripts" can lead to the execution of shell scripts. Make sure it is safe here.
- [ ] `services/wa-client/Dockerfile:22` - Omitting "--ignore-scripts" can lead to the execution of shell scripts. Make sure it is safe here.
- [ ] `services/wa-client/Dockerfile:23` - Omitting "--ignore-scripts" can lead to the execution of shell scripts. Make sure it is safe here.

---

