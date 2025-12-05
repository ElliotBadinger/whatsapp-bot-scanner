# Source: https://baileys.wiki/docs/api/interfaces/RetryStatistics

<!-- Scraped from https://baileys.wiki/docs/api/interfaces/RetryStatistics -->

[Skip to main content](https://baileys.wiki/docs/api/interfaces/RetryStatistics/#__docusaurus_skipToContent_fallback)
[ ![WhiskeySo ckets Logo](https://baileys.wiki/img/WhiskeySockets-colorful.png)![WhiskeySo ckets Logo](https://baileys.wiki/img/WhiskeySockets-colorful.png) **Baileys**](https://baileys.wiki/)[Docs](https://baileys.wiki/docs/intro)[API Reference](https://baileys.wiki/docs/api/classes/BinaryInfo)
[Sponsor](https://purpshell.dev/sponsor "Sponsor")[Discord](https://whiskey.so/discord "Discord")[GitHub](https://github.com/WhiskeySockets/Baileys "GitHub")

- [classes](https://baileys.wiki/docs/api/classes/BinaryInfo)
- [enumerations](https://baileys.wiki/docs/api/enumerations/DisconnectReason)
- [functions](https://baileys.wiki/docs/api/functions/addTransactionCapability)
- [baileys](https://baileys.wiki/docs/api/)
- [interfaces](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter)
  - [Interface: BaileysEventEmitter](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter)
  - [Interface: Contact](https://baileys.wiki/docs/api/interfaces/Contact)
  - [Interface: GroupMetadata](https://baileys.wiki/docs/api/interfaces/GroupMetadata)
  - [Interface: GroupModificationResponse](https://baileys.wiki/docs/api/interfaces/GroupModificationResponse)
  - [Interface: NewsletterCreateResponse](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse)
  - [Interface: NewsletterMetadata](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata)
  - [Interface: PresenceData](https://baileys.wiki/docs/api/interfaces/PresenceData)
  - [Interface: RecentMessage](https://baileys.wiki/docs/api/interfaces/RecentMessage)
  - [Interface: RecentMessageKey](https://baileys.wiki/docs/api/interfaces/RecentMessageKey)
  - [Interface: RetryCounter](https://baileys.wiki/docs/api/interfaces/RetryCounter)
  - [Interface: RetryStatistics](https://baileys.wiki/docs/api/interfaces/RetryStatistics)
  - [Interface: SessionRecreateHistory](https://baileys.wiki/docs/api/interfaces/SessionRecreateHistory)
  - [Interface: SignalRepositoryWithLIDStore](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore)
  - [Interface: WAGroupCreateResponse](https://baileys.wiki/docs/api/interfaces/WAGroupCreateResponse)
  - [Interface: WAUrlInfo](https://baileys.wiki/docs/api/interfaces/WAUrlInfo)
- [namespaces](https://baileys.wiki/docs/api/namespaces/proto/)
- [type-aliases](https://baileys.wiki/docs/api/type-aliases/AccountSettings)
- [variables](https://baileys.wiki/docs/api/variables/ALL_WA_PATCH_NAMES)

- [](https://baileys.wiki/)
- interfaces
- Interface: RetryStatistics

On this page

# Interface: RetryStatistics

Defined in: [src/Utils/message-retry-manager.ts:33](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Utils/message-retry-manager.ts#L33)

## Properties[​](https://baileys.wiki/docs/api/interfaces/RetryStatistics/#properties "Direct link to Properties")

### failedRetries[​](https://baileys.wiki/docs/api/interfaces/RetryStatistics/#failedretries "Direct link to failedRetries")

> **failedRetries** : `number`
> Defined in: [src/Utils/message-retry-manager.ts:36](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Utils/message-retry-manager.ts#L36)

---

### mediaRetries[​](https://baileys.wiki/docs/api/interfaces/RetryStatistics/#mediaretries "Direct link to mediaRetries")

> **mediaRetries** : `number`
> Defined in: [src/Utils/message-retry-manager.ts:37](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Utils/message-retry-manager.ts#L37)

---

### phoneRequests[​](https://baileys.wiki/docs/api/interfaces/RetryStatistics/#phonerequests "Direct link to phoneRequests")

> **phoneRequests** : `number`
> Defined in: [src/Utils/message-retry-manager.ts:39](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Utils/message-retry-manager.ts#L39)

---

### sessionRecreations[​](https://baileys.wiki/docs/api/interfaces/RetryStatistics/#sessionrecreations "Direct link to sessionRecreations")

> **sessionRecreations** : `number`
> Defined in: [src/Utils/message-retry-manager.ts:38](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Utils/message-retry-manager.ts#L38)

---

### successfulRetries[​](https://baileys.wiki/docs/api/interfaces/RetryStatistics/#successfulretries "Direct link to successfulRetries")

> **successfulRetries** : `number`
> Defined in: [src/Utils/message-retry-manager.ts:35](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Utils/message-retry-manager.ts#L35)

---

### totalRetries[​](https://baileys.wiki/docs/api/interfaces/RetryStatistics/#totalretries "Direct link to totalRetries")

> **totalRetries** : `number`
> Defined in: [src/Utils/message-retry-manager.ts:34](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Utils/message-retry-manager.ts#L34)
> [](https://github.com/WhiskeySockets/baileys.wiki-site/tree/main/docs/api/interfaces/RetryStatistics.md)
> [Previous Interface: RetryCounter](https://baileys.wiki/docs/api/interfaces/RetryCounter)[Next Interface: SessionRecreateHistory](https://baileys.wiki/docs/api/interfaces/SessionRecreateHistory)

- [Properties](https://baileys.wiki/docs/api/interfaces/RetryStatistics/#properties)
  - [failedRetries](https://baileys.wiki/docs/api/interfaces/RetryStatistics/#failedretries)
  - [mediaRetries](https://baileys.wiki/docs/api/interfaces/RetryStatistics/#mediaretries)
  - [phoneRequests](https://baileys.wiki/docs/api/interfaces/RetryStatistics/#phonerequests)
  - [sessionRecreations](https://baileys.wiki/docs/api/interfaces/RetryStatistics/#sessionrecreations)
  - [successfulRetries](https://baileys.wiki/docs/api/interfaces/RetryStatistics/#successfulretries)
  - [totalRetries](https://baileys.wiki/docs/api/interfaces/RetryStatistics/#totalretries)

Docs

- [Tutorial](https://baileys.wiki/docs/intro)

More

- [GitHub](https://github.com/WhiskeySockets/Baileys)

![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)
Copyright © 2025 Rajeh Taher, WhiskeySockets.
