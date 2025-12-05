# Source: https://baileys.wiki/docs/api/interfaces/WAUrlInfo

<!-- Scraped from https://baileys.wiki/docs/api/interfaces/WAUrlInfo -->

[Skip to main content](https://baileys.wiki/docs/api/interfaces/WAUrlInfo/#__docusaurus_skipToContent_fallback)
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
- Interface: WAUrlInfo

On this page

# Interface: WAUrlInfo

Defined in: [src/Types/Message.ts:102](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Message.ts#L102)

## Properties[​](https://baileys.wiki/docs/api/interfaces/WAUrlInfo/#properties "Direct link to Properties")

### canonical-url[​](https://baileys.wiki/docs/api/interfaces/WAUrlInfo/#canonical-url "Direct link to canonical-url")

> **canonical-url** : `string`
> Defined in: [src/Types/Message.ts:103](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Message.ts#L103)

---

### description?[​](https://baileys.wiki/docs/api/interfaces/WAUrlInfo/#description "Direct link to description?")

> `optional` **description** : `string`
> Defined in: [src/Types/Message.ts:106](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Message.ts#L106)

---

### highQualityThumbnail?[​](https://baileys.wiki/docs/api/interfaces/WAUrlInfo/#highqualitythumbnail "Direct link to highQualityThumbnail?")

> `optional` **highQualityThumbnail** : [`IImageMessage`](https://baileys.wiki/docs/api/namespaces/proto/namespaces/Message/interfaces/IImageMessage)
> Defined in: [src/Types/Message.ts:108](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Message.ts#L108)

---

### jpegThumbnail?[​](https://baileys.wiki/docs/api/interfaces/WAUrlInfo/#jpegthumbnail "Direct link to jpegThumbnail?")

> `optional` **jpegThumbnail** : `Buffer`<`ArrayBufferLike`>
> Defined in: [src/Types/Message.ts:107](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Message.ts#L107)

---

### matched-text[​](https://baileys.wiki/docs/api/interfaces/WAUrlInfo/#matched-text "Direct link to matched-text")

> **matched-text** : `string`
> Defined in: [src/Types/Message.ts:104](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Message.ts#L104)

---

### originalThumbnailUrl?[​](https://baileys.wiki/docs/api/interfaces/WAUrlInfo/#originalthumbnailurl "Direct link to originalThumbnailUrl?")

> `optional` **originalThumbnailUrl** : `string`
> Defined in: [src/Types/Message.ts:109](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Message.ts#L109)

---

### title[​](https://baileys.wiki/docs/api/interfaces/WAUrlInfo/#title "Direct link to title")

> **title** : `string`
> Defined in: [src/Types/Message.ts:105](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Message.ts#L105)
> [](https://github.com/WhiskeySockets/baileys.wiki-site/tree/main/docs/api/interfaces/WAUrlInfo.md)
> [Previous Interface: WAGroupCreateResponse](https://baileys.wiki/docs/api/interfaces/WAGroupCreateResponse)[Next proto](https://baileys.wiki/docs/api/namespaces/proto/)

- [Properties](https://baileys.wiki/docs/api/interfaces/WAUrlInfo/#properties)
  - [canonical-url](https://baileys.wiki/docs/api/interfaces/WAUrlInfo/#canonical-url)
  - [description?](https://baileys.wiki/docs/api/interfaces/WAUrlInfo/#description)
  - [highQualityThumbnail?](https://baileys.wiki/docs/api/interfaces/WAUrlInfo/#highqualitythumbnail)
  - [jpegThumbnail?](https://baileys.wiki/docs/api/interfaces/WAUrlInfo/#jpegthumbnail)
  - [matched-text](https://baileys.wiki/docs/api/interfaces/WAUrlInfo/#matched-text)
  - [originalThumbnailUrl?](https://baileys.wiki/docs/api/interfaces/WAUrlInfo/#originalthumbnailurl)
  - [title](https://baileys.wiki/docs/api/interfaces/WAUrlInfo/#title)

Docs

- [Tutorial](https://baileys.wiki/docs/intro)

More

- [GitHub](https://github.com/WhiskeySockets/Baileys)

![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)
Copyright © 2025 Rajeh Taher, WhiskeySockets.
