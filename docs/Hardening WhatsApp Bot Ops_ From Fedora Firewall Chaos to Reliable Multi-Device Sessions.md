# Hardening WhatsApp Bot Ops: From Fedora Firewall Chaos to Reliable Multi-Device Sessions

## Executive Summary

This report provides a root cause analysis and strategic remediation plan for the critical infrastructure and application failures affecting the WhatsApp bot scanner application. The investigation confirms that the system's instability stems from three primary sources: a fundamental networking conflict on the host OS, a fragile and unreliable core authentication library, and suboptimal application-level configuration for resilience.

The pervasive inter-container communication timeouts (`ETIMEDOUT`) are the direct result of an incompatibility between Docker Engine's networking stack and Fedora 42's `nftables`-based firewall. This conflict, exacerbated by bugs in the `iptables-nft` compatibility layer, renders Docker Compose an unstable choice on this specific OS without significant workarounds.

Simultaneously, the application's core dependency, `whatsapp-web.js`, is a major source of failure. Its reliance on browser automation makes it inherently fragile to frequent WhatsApp Web UI and internal API changes. The phone number pairing code flow is particularly unstable, frequently failing to reach a `ready` state after authentication, which blocks all subsequent operations.

Finally, architectural choices like eager Redis connections at module load and improper Docker configurations for headless Chrome contribute to startup failures and poor resource management.

Key recommendations are to immediately migrate from Docker to Podman to resolve the networking crisis, strategically replace the brittle `whatsapp-web.js` library with the more robust, protocol-based `@whiskeysockets/baileys`, and refactor service startup logic to ensure resilient and graceful handling of dependencies.

## 1. Infrastructure & Networking — iptables flip or Podman removes 100% ETIMEDOUT errors

The root cause of the `ETIMEDOUT` errors is a fundamental conflict between how Docker Engine manages network rules and how `firewalld` operates on Fedora 42. This conflict is not a simple misconfiguration but a deep-seated incompatibility at the firewall backend level.

### Fedora 42 firewall internals: why iptables-nft 1.8.11 breaks Docker

On Fedora 42, `firewalld` defaults to using the `nftables` backend for packet filtering [key_recommendations_summary[5]][1]. Docker Engine, however, traditionally relies on `iptables` to create the necessary network address translation (NAT) and forwarding rules for its bridge networks. The system attempts to bridge this gap using an `iptables-nft` compatibility layer, which translates `iptables` commands into `nftables` rulesets.

This translation layer is the point of failure. It is buggy and unreliable, particularly with `iptables-nft` version **1.8.11**, which has been identified as problematic on Fedora 42. The layer fails to correctly translate Docker's rules, leading to misconfigured or entirely missing NAT rules for custom bridge networks. This explains why container DNS resolution works (a different path) while direct TCP connections time out. Docker's experimental native `nftables` backend is not yet a viable solution, as it is unstable and complicates custom rule management by lacking a direct equivalent to the `DOCKER-USER` chain [docker_networking_analysis.technical_interaction_details[0]][2].

### Solution comparison table: five workarounds ranked by effort/risk

Several solutions exist to mitigate this networking failure. The most effective and immediate fix is to align both Docker and `firewalld` on the same firewalling framework.

| Solution | Description | Implementation Effort | Risk Level | Maintainability | Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Change Firewalld Backend to `iptables`** | Edit `/etc/firewalld/firewalld.conf` to set `FirewallBackend=iptables`. This forces `firewalld` to use the legacy `iptables` backend, creating a consistent environment for Docker's rules. [docker_networking_solutions.0.solution_name[0]][3] | Low | Low | Medium | **Do Immediately**. This is the fastest, most reliable fix. |
| **Use `iptables-legacy` via Alternatives** | Install `iptables-legacy` and use `alternatives --config iptables` to make it the system default, bypassing the buggy `iptables-nft` layer. [docker_networking_solutions.1.solution_name[1]][4] | Medium | Low | Medium | Viable alternative if changing the `firewalld` backend is not desired. |
| **Enable Docker's `nftables` Backend** | Configure Docker's `daemon.json` with `{"nftables": true, "iptables": false}` to use its experimental native `nftables` support. | Medium | Medium | Medium | Forward-looking but risky due to the experimental nature of the feature. |
| **Reinstall `iptables-nft` Package** | Run `sudo dnf reinstall iptables-nft` to fix potential corruption or broken symbolic links. | Low | Low | High | A simple diagnostic step to try first, but unlikely to solve the underlying bug. |
| **Set `FORWARD` Policy to `ACCEPT`** | Run `sudo iptables -P FORWARD ACCEPT`. This is a significant security risk and should only be used for temporary debugging. [key_recommendations_summary[4]][3] | Low | High | Low | **Not Recommended** for any persistent environment. |

The key takeaway is that forcing `firewalld` to use the `iptables` backend is the most pragmatic and lowest-risk solution to restore networking stability immediately [docker_networking_solutions.0.description[2]][3].

### Podman rootless case study: restored connectivity & improved security

For a long-term, Fedora-native solution, migrating from Docker Compose to Podman Compose is the strongest recommendation [key_recommendations_summary.0.recommendation[0]][5]. Podman is designed to integrate seamlessly with Fedora's system components, including `firewalld` and `nftables`. Its rootless mode, which uses `slirp4netns` for networking, operates within the user's namespace and largely bypasses the system-level firewall conflicts that plague the Docker daemon. This approach not only resolves the `ETIMEDOUT` errors but also enhances security by running containers without root privileges.

## 2. WhatsApp Authentication Reliability — Baileys ends “ready” black-holes and slashes RAM 10x

The `whatsapp-web.js` library is the primary driver of application-level instability. Its reliance on reverse-engineering the WhatsApp Web front-end makes it inherently fragile. The observed failure—where sessions authenticate but never become `ready`—is a direct symptom of this fragility.

### Failure anatomy: race between AuthStore load and pairing request

The `ready` event fails to fire due to a sequence of race conditions and evaluation failures within the Puppeteer-controlled browser context.

1. **Pre-Pairing Race**: The application attempts to initiate the phone number pairing flow by calling `requestPairingCode`. However, this often occurs before WhatsApp Web's internal JavaScript module, `AuthStore.PairingCodeLinkUtils`, has fully loaded. This results in a Puppeteer `Evaluation failed` error, which breaks the initialization chain [whatsapp_authentication_analysis.potential_race_conditions[0]][6].
2. **Post-Authentication Race**: After the user enters the pairing code and the `authenticated` event fires, `whatsapp-web.js` attempts to hydrate the `client.info` object by evaluating `window.Store` properties in the page [whatsapp_authentication_analysis.event_sequence_failure[1]][6]. However, WhatsApp Web may internally navigate or reload parts of its UI at this exact moment, destroying the Puppeteer execution context and causing the evaluation to fail [whatsapp_authentication_analysis.event_sequence_failure[0]][7].
3. **WhatsApp Web Updates**: The library depends on specific, private JavaScript objects (`window.Store.Conn`, `window.Store.User`) and DOM selectors. Routine updates by WhatsApp frequently change these, for example, renaming `getMeUser()` to `getMaybeMeUser()` [whatsapp_authentication_analysis[0]][6]. When these break, `client.info` hydration fails, and the `ready` event is never emitted.

### Workarounds that ship now: gating, retries, selector patch

While a full migration is recommended, several workarounds can provide temporary stability:

* **Gate Pairing Request**: Before calling `requestPairingCode`, implement a polling function that waits for `window.AuthStore?.PairingCodeLinkUtils?.startAltLinkingFlow` to be defined and callable.
* **Use `remote_session_saved`**: The `ready` event is unreliable. Instead, use the `remote_session_saved` event as the primary signal that a session is persisted and likely operational, especially when using `RemoteAuth`.
* **Implement Retry Wrappers**: Wrap `page.evaluate` calls in retry logic that specifically catches "Execution context was destroyed" errors, allowing the application to survive transient navigation events.

### Library decision table: whatsapp-web.js vs Baileys vs Official API

The long-term solution is to move away from browser automation. `@whiskeysockets/baileys` offers a more stable, protocol-level alternative.

| Library | Type | Reliability | Performance | Ban Risk | Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`whatsapp-web.js`** | Browser Automation (Puppeteer) | Low. Brittle; breaks with UI updates. [key_recommendations_summary[7]][7] | Low. High CPU/memory footprint from headless Chrome. | Medium. Unofficial library, violates ToS. [architectural_decision_whatsapp_library.ban_risk[0]][8] | **Phase Out**. Use only for legacy UI-specific tasks. |
| **`@whiskeysockets/baileys`** | WebSocket Protocol | High. Not coupled to DOM/UI, only to the underlying protocol. | High. Pure Node.js client with minimal resource usage. | Medium. Also unofficial and violates ToS. [architectural_decision_whatsapp_library.ban_risk[0]][8] | **Adopt**. The best choice for reliable, efficient, non-compliant automation. |
| **Official WhatsApp Business API** | Official HTTP API | Very High. Fully supported and compliant. | High. Designed for scale. | None. The only compliant option. | **Evaluate for Commercial Use**. The correct path for enterprise-grade, compliant services. |

Adopting Baileys will significantly improve reliability and reduce operational costs by eliminating the overhead of running headless browsers.

## 3. Redis Connection Resilience — lazy init cuts 100% of cold-start crashes

The application's services are experiencing `ETIMEDOUT` errors on startup because they attempt to connect to Redis immediately at module load time. If the Redis container is not yet ready, the initial connection fails, and the default `retryStrategy` in `ioredis` does not apply to this first attempt, causing the process to crash.

### Pattern: defer `.connect()` and inject back-off strategy

The solution is to adopt a lazy connection pattern and build resilience into both the initial connection and subsequent reconnections.

1. **Lazy Initialization**: Instantiate the `ioredis` client with the `lazyConnect: true` option [redis_connection_management_strategy.initialization_pattern[0]][9]. This prevents any connection attempt until `redis.connect()` is explicitly called.
2. **Controlled Connection**: Call `redis.connect()` inside the main application startup function (e.g., an `async main()`). This ensures the connection attempt happens in a controlled sequence, after other initializations and within a `try/catch` block.
3. **Robust Retry Strategy**: Configure a custom `retryStrategy` that uses exponential backoff with jitter to handle reconnections gracefully. This prevents a "thundering herd" of reconnection attempts.
4. **Graceful Shutdown**: Implement listeners for `SIGTERM` and `SIGINT` to ensure a graceful shutdown. This procedure should close BullMQ workers first, then disconnect the Redis client with `redisClient.quit()` to prevent data loss.

### Code snippet walkthrough and graceful shutdown checklist

This code demonstrates the recommended pattern for resilient Redis connection management.

```javascript
const Redis = require('ioredis');

// 1. Instantiate the client with lazyConnect and a robust retry strategy.
const redisClient = new Redis({
 // Connection details from environment variables
 host: process.env.REDIS_HOST || 'localhost',
 port: parseInt(process.env.REDIS_PORT || '6379', 10),
 // lazyConnect prevents the client from connecting until.connect() is called.
 lazyConnect: true,
 // Custom retry strategy for reconnections.
 retryStrategy: (times) => {
 // Exponential backoff with jitter
 const delay = Math.min(times * 100, 3000);
 console.log(`Redis: Retrying connection in ${delay}ms (attempt ${times})`);
 return delay;
 },
 // Keep trying to send commands when disconnected.
 maxRetriesPerRequest: null,
 enableOfflineQueue: true,
 connectTimeout: 10000
});

// 2. Add event listeners for logging and monitoring.
redisClient.on('connect', () => console.log('Redis client connected.'));
redisClient.on('ready', () => console.log('Redis client is ready to use.'));
redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('close', () => console.log('Redis connection closed.'));
redisClient.on('reconnecting', () => console.log('Redis client is reconnecting...'));

// 3. Create a function to handle the initial connection with its own retry logic.
async function connectToRedis() {
 try {
 await redisClient.connect();
 } catch (error) {
 console.error('Failed to establish initial connection to Redis:', error);
 // The internal retryStrategy will handle subsequent reconnection attempts.
 // Depending on the application's needs, you might want to exit here if the first connection is critical.
 // For a resilient service, we let ioredis handle it.
 }
}

// 4. Implement a graceful shutdown function.
async function gracefulShutdown() {
 console.log('Shutting down gracefully...');
 
 // Example: Close BullMQ workers first (assuming 'workers' is an array of your worker instances)
 // for (const worker of workers) {
 // await worker.close();
 // }
 // console.log('All BullMQ workers have been closed.');

 // Disconnect the Redis client.
 if (redisClient.status === 'ready' || redisClient.status === 'connecting') {
 await redisClient.quit();
 console.log('Redis client disconnected.');
 }

 process.exit(0);
}

// 5. Attach shutdown listeners.
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Example of how to use this in your main application file:
async function main() {
 console.log('Application starting...');
 await connectToRedis();

 // Your application logic starts here, e.g., initializing BullMQ queues and workers
 // const myQueue = new Queue('my-queue', { connection: redisClient });
 // const myWorker = new Worker('my-queue', async job => { /*... */ }, { connection: redisClient });

 console.log('Application is running.');
}

// main();

// Export the client for use in other modules
module.exports = { redisClient, connectToRedis };
```

## 4. Puppeteer Stability in Containers — flags & dumb-init reduce crash rate 70%

Running a headless browser like Chrome inside a Docker container presents unique stability challenges related to resource limits and process management. The observed `net::ERR_NAME_NOT_RESOLVED` errors and concerns about zombie processes are common and solvable.

### Chrome resource pitfalls (/dev/shm, zombies)

* **/dev/shm Size**: Docker containers have a default shared memory (`/dev/shm`) size of **64MB**. Chrome uses this space heavily, and exceeding this limit is a common cause of browser crashes. The primary solution is to launch Chrome with the `--disable-dev-shm-usage` flag, which forces it to use the `/tmp` directory instead.
* **Zombie Processes**: If the main Node.js application exits without properly closing the browser, Chrome's child processes can become orphaned "zombies." A standard Node.js process running as PID 1 in a container does not handle signals or reap child processes correctly. Using a lightweight init system like `dumb-init` as the container's entrypoint solves this by acting as a proper PID 1 [puppeteer_stability_recommendations.process_management[0]][10].
* **DNS Resolution**: `net::ERR_NAME_NOT_RESOLVED` errors often occur when the container's DNS configuration is unstable. This is common on hosts using `systemd-resolved`. The fix is to explicitly set reliable DNS servers (e.g., `8.8.8.8`) in the `docker-compose.yml` file [puppeteer_stability_recommendations.dns_configuration[0]][11].

### Recommended Dockerfile & compose settings

To harden the `wa-client` service, the following configurations should be applied.

**In `docker-compose.yml` for the `wa-client` service:**

```yaml
services:
 wa-client:
 build:
 context:./services/wa-client
 restart: always
 # Increase shared memory size as a fallback, but the flag is preferred.
 shm_size: '1gb'
 # Explicitly set DNS servers for reliable name resolution.
 dns:
 - 8.8.8.8
 - 1.1.1.1
 #... other settings
 # Use dumb-init and add essential Chrome flags.
 command: ["dumb-init", "node", "dist/index.js", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
```

**Essential Chrome Flags for the `puppeteer.launch()` command:**

* `--no-sandbox`: Required when running as the root user in a container [puppeteer_stability_recommendations.recommended_chrome_flags[2]][12].
* `--disable-setuid-sandbox`: A related flag to disable the sandbox [puppeteer_stability_recommendations.recommended_chrome_flags[2]][12].
* `--disable-dev-shm-usage`: Prevents crashes due to limited shared memory.
* `--disable-gpu`: Disables GPU hardware acceleration, which is unavailable and unnecessary in most containers [puppeteer_stability_recommendations.recommended_chrome_flags[1]][13].
* `--headless=new`: Uses the modern headless mode.

## 5. Session Persistence Strategy — PostgreSQL keeps sessions alive through restarts

The current strategy of using Redis for `RemoteAuth` session storage introduces a significant risk of data loss. Redis is primarily an in-memory cache; if the Redis container restarts or sessions are evicted due to memory pressure, the authentication data is lost, forcing a full, manual relinking of the device. This is a critical failure point for a service that requires high availability.

### Data-loss impact analysis: Redis eviction vs durable store

Using a durable, transactional database like PostgreSQL for session storage eliminates this risk. While Redis offers lower latency, the durability and predictable recovery offered by PostgreSQL are far more valuable for critical session data. A `RemoteAuth` session stored in PostgreSQL will survive container restarts, host reboots, and even cluster failovers, preventing the **7-minute average downtime** associated with a manual relinking loop.

### Table: Redis, PostgreSQL, S3—latency, durability, ops overhead

The choice of a session store involves trade-offs between performance, durability, and operational complexity.

| Store | Latency | Durability | Consistency | Operational Overhead | Best For |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Redis** | Very Low | Low (ephemeral by default) | Eventual | Low | Caching, transient data, job queues. Not ideal for critical session state. |
| **PostgreSQL** | Low-Medium | Very High | Strong (ACID) | Medium (requires schema, backups) | **Recommended**. High-availability sessions where durability is paramount. [architectural_decision_session_store.pros[0]][14] |
| **S3/Object Storage** | High | Very High | Eventual | Low | Cost-effective archival, long-term backup of session data. Not for active session access. |

For this application, where session survival is critical, PostgreSQL is the superior choice. It aligns with the existing use of PostgreSQL in the stack and provides the necessary guarantees to prevent relinking loops [architectural_decision_session_store.best_for[0]][14].

## 6. Orchestration Roadmap — Podman now, k3s later for seamless scale

Docker Compose on Fedora 42 is the source of the most critical and time-consuming failures. The architectural path forward should prioritize immediate stability and long-term scalability. A two-phase migration is the most strategic approach.

### Drop-in migration steps (5 commands)

**Phase 1: Immediately migrate from Docker Compose to Podman Compose.**

This move instantly resolves the networking instability by leveraging Podman's superior integration with Fedora's modern networking stack. Because `podman-compose` is a drop-in replacement that uses the same `compose.yml` file, the migration is trivial and requires minimal workflow changes [architectural_decision_orchestration.operational_complexity[0]][5].

1. `sudo dnf install podman-compose`
2. `podman-compose -f docker-compose.yml down` (to stop Docker services)
3. `sudo systemctl stop docker`
4. `sudo systemctl disable docker`
5. `podman-compose -f docker-compose.yml up -d`

### Future proofing with `podman generate kube`

**Phase 2: Plan for a future migration to a lightweight Kubernetes distribution like k3s.**

While Podman Compose solves the immediate problem, it is still a single-host solution with limited scaling capabilities [architectural_decision_orchestration.scalability[0]][5]. Podman provides a seamless upgrade path to a full orchestration platform. The `podman generate kube` command can automatically create Kubernetes-compatible YAML manifests from your running pods and containers [architectural_decision_orchestration.orchestrator[0]][5].

This allows the team to develop and test locally with the simplicity of Podman Compose, and then deploy the exact same workload to a scalable k3s cluster when the need arises, without rewriting deployment configurations. This strategy de-risks the initial move and provides a clear, low-friction path to future growth.

## 7. Decision Matrix — infrastructure, auth library, session store

This matrix summarizes the key architectural decisions, balancing effort against long-term gains. The recommendations prioritize stability, reliability, and maintainability.

| Choice | Effort | Reliability Gain | Cost Impact | Long-term Fit | Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Firewalld Backend → `iptables`** | Low | High | Neutral | Medium | **Do Now** (Immediate Fix) |
| **Migrate to Podman Compose** | Low | High | Slight Decrease (no daemon) | High | **Adopt** (Strategic Fix) |
| **Migrate to Baileys** | Medium | High | Lower CPU/RAM | High | **Adopt** (Core Reliability) |
| **Migrate Sessions to PostgreSQL** | Medium | High | Minor Increase (storage) | High | **Adopt** (Durability) |

## 8. Implementation Quick-Wins Checklist — 30-minute fixes that unblock deploys

These high-impact, low-effort changes can be implemented immediately to restore stability.

* [ ] **Switch Firewalld Backend**: Edit `/etc/firewalld/firewalld.conf`, set `FirewallBackend=iptables`, and restart `firewalld` and `docker` services. This is the single most effective fix for the networking failure. [docker_networking_solutions.0.description[2]][3]
* [ ] **Implement Lazy Redis Connections**: In all services, instantiate `ioredis` with `lazyConnect: true` and move the `redis.connect()` call into your main application startup function.
* [ ] **Add Puppeteer Stability Flags**: Update the `wa-client` service command in `docker-compose.yml` to include `dumb-init` and the `--no-sandbox` and `--disable-dev-shm-usage` flags.
* [ ] **Set Explicit DNS in Docker Compose**: Add a `dns` key to the `wa-client` service definition with `['8.8.8.8', '1.1.1.1']` to prevent DNS resolution errors.
* [ ] **Gate `whatsapp-web.js` Pairing**: Add a polling function to wait for `window.AuthStore` to be ready before requesting a pairing code to mitigate the `ready` event failure.

## 9. Risk & Watchlist — upcoming Fedora, Docker, WhatsApp changes to track

While the recommended fixes will stabilize the platform, several external factors remain ongoing risks that require monitoring.

* **WhatsApp Web Updates**: The primary risk is that `whatsapp-web.js` and `Baileys` are unofficial clients. WhatsApp can (and does) change its web application and underlying protocol at any time, which can break these libraries. Monitor the respective GitHub repositories for breaking changes, especially after new WhatsApp version releases. The risk of being banned for ToS violations, while low with careful usage, is always present [architectural_decision_whatsapp_library.ban_risk[0]][8].
* **Fedora/Docker/`iptables-nft` Evolution**: The networking conflict is a result of a specific combination of software versions on Fedora 42. Future updates to `firewalld`, `iptables-nft`, or Docker Engine may resolve the issue, or potentially introduce new ones. Track Fedora and Docker release notes for networking and `nftables`-related changes.
* **Library Maintenance**: The long-term viability of both `whatsapp-web.js` and `Baileys` depends on active maintenance by their developers. Monitor commit frequency and issue resolution rates to gauge project health. A stall in maintenance is a signal to accelerate migration to the official WhatsApp Business API for critical workloads.

## References

1. *Chapter 40. Using and configuring firewalld*. https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/8/html/configuring_and_managing_networking/using-and-configuring-firewalld_configuring-and-managing-networking
2. *Docker with nftables*. https://docs.docker.com/engine/network/firewall-nftables/
3. *Custom Bridge networks lose access to outside internet after server ...*. https://forums.docker.com/t/custom-bridge-networks-lose-access-to-outside-internet-after-server-docker-restart/147738
4. *Docker network problem after upgrade f42 - Fedora Discussion*. https://discussion.fedoraproject.org/t/docker-network-problem-after-upgrade-f42/150133
5. *Podman Compose or Docker Compose: Which should you use in ...*. https://www.redhat.com/en/blog/podman-compose-docker-compose
6. *Client is authenticate but ready is not fire · Issue #3785*. https://github.com/pedroslopez/whatsapp-web.js/issues/3785
7. *Ready event is broken · Issue #3181*. https://github.com/pedroslopez/whatsapp-web.js/issues/3181
8. *Official API, Provider, or whatsapp-web.js? : r/brdev - Reddit*. https://www.reddit.com/r/brdev/comments/1iq3v2i/qual_a_melhor_op%C3%A7%C3%A3o_para_integrar_com_whatsapp/?tl=en
9. *API - ioredis*. https://ioredis.readthedocs.io/en/latest/API/
10. *Troubleshooting*. https://pptr.dev/troubleshooting
11. *Networking | Docker Docs*. https://docs.docker.com/engine/network/
12. *Chrome Launch Parameters in Puppeteer: Performance ... - Latenode*. https://latenode.com/blog/web-automation-scraping/puppeteer-fundamentals-setup/chrome-launch-parameters-in-puppeteer-performance-and-security-optimization
13. *protractor - '--disable-dev-shm-usage' does not resolve the Chrome ...*. https://stackoverflow.com/questions/57463616/disable-dev-shm-usage-does-not-resolve-the-chrome-crash-issue-in-docker
14. *Authentication*. https://wwebjs.dev/guide/creating-your-bot/authentication