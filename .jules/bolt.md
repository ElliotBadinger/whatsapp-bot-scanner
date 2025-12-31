## 2025-02-24 - URL Parsing Optimization

**Learning:** Hot paths like `isSuspiciousTld` and `extractUrls` were re-creating large `Set` and `RegExp` objects on every call, causing unnecessary GC pressure and CPU cycles.
**Action:** Hoisted static data structures (sets, regexes) to module scope. Added caching for environment variable parsing in `isForbiddenHostname`. Always check for re-initialization of static data in frequently called utility functions.
