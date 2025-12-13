# Source: https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter

<!-- Scraped from https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter -->

[Skip to main content](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#__docusaurus_skipToContent_fallback)
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
- Interface: BaileysEventEmitter

On this page

# Interface: BaileysEventEmitter

Defined in: [src/Types/Events.ts:127](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Events.ts#L127)

## Methods[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#methods "Direct link to Methods")

### emit()[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#emit "Direct link to emit()")

> **emit** <`T`>(`event`, `arg`): `boolean`
> Defined in: [src/Types/Events.ts:131](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Events.ts#L131)

#### Type Parameters[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#type-parameters "Direct link to Type Parameters")

• **T** _extends_ keyof [`BaileysEventMap`](https://baileys.wiki/docs/api/type-aliases/BaileysEventMap)

#### Parameters[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#parameters "Direct link to Parameters")

##### event[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#event "Direct link to event")

`T`

##### arg[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#arg "Direct link to arg")

[`BaileysEventMap`](https://baileys.wiki/docs/api/type-aliases/BaileysEventMap)[`T`]

#### Returns[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#returns "Direct link to Returns")

`boolean`

---

### off()[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#off "Direct link to off()")

> **off** <`T`>(`event`, `listener`): `void`
> Defined in: [src/Types/Events.ts:129](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Events.ts#L129)

#### Type Parameters[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#type-parameters-1 "Direct link to Type Parameters")

• **T** _extends_ keyof [`BaileysEventMap`](https://baileys.wiki/docs/api/type-aliases/BaileysEventMap)

#### Parameters[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#parameters-1 "Direct link to Parameters")

##### event[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#event-1 "Direct link to event")

`T`

##### listener[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#listener "Direct link to listener")

(`arg`) => `void`

#### Returns[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#returns-1 "Direct link to Returns")

`void`

---

### on()[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#on "Direct link to on()")

> **on** <`T`>(`event`, `listener`): `void`
> Defined in: [src/Types/Events.ts:128](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Events.ts#L128)

#### Type Parameters[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#type-parameters-2 "Direct link to Type Parameters")

• **T** _extends_ keyof [`BaileysEventMap`](https://baileys.wiki/docs/api/type-aliases/BaileysEventMap)

#### Parameters[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#parameters-2 "Direct link to Parameters")

##### event[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#event-2 "Direct link to event")

`T`

##### listener[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#listener-1 "Direct link to listener")

(`arg`) => `void`

#### Returns[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#returns-2 "Direct link to Returns")

`void`

---

### removeAllListeners()[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#removealllisteners "Direct link to removeAllListeners()")

> **removeAllListeners** <`T`>(`event`): `void`
> Defined in: [src/Types/Events.ts:130](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Events.ts#L130)

#### Type Parameters[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#type-parameters-3 "Direct link to Type Parameters")

• **T** _extends_ keyof [`BaileysEventMap`](https://baileys.wiki/docs/api/type-aliases/BaileysEventMap)

#### Parameters[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#parameters-3 "Direct link to Parameters")

##### event[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#event-3 "Direct link to event")

`T`

#### Returns[​](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#returns-3 "Direct link to Returns")

`void`
[](https://github.com/WhiskeySockets/baileys.wiki-site/tree/main/docs/api/interfaces/BaileysEventEmitter.md)
[Previous baileys](https://baileys.wiki/docs/api/)[Next Interface: Contact](https://baileys.wiki/docs/api/interfaces/Contact)

- [Methods](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#methods)
  - [emit()](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#emit)
  - [off()](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#off)
  - [on()](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#on)
  - [removeAllListeners()](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter/#removealllisteners)

Docs

- [Tutorial](https://baileys.wiki/docs/intro)

More

- [GitHub](https://github.com/WhiskeySockets/Baileys)

![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)
Copyright © 2025 Rajeh Taher, WhiskeySockets.
