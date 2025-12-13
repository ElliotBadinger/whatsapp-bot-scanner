# Source: https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol

<!-- Scraped from https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol -->

[Skip to main content](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#__docusaurus_skipToContent_fallback)
[ ![WhiskeySo ckets Logo](https://baileys.wiki/img/WhiskeySockets-colorful.png)![WhiskeySo ckets Logo](https://baileys.wiki/img/WhiskeySockets-colorful.png) **Baileys**](https://baileys.wiki/)[Docs](https://baileys.wiki/docs/intro)[API Reference](https://baileys.wiki/docs/api/classes/BinaryInfo)
[Sponsor](https://purpshell.dev/sponsor "Sponsor")[Discord](https://whiskey.so/discord "Discord")[GitHub](https://github.com/WhiskeySockets/Baileys "GitHub")

- [classes](https://baileys.wiki/docs/api/classes/BinaryInfo)
  - [Class: BinaryInfo](https://baileys.wiki/docs/api/classes/BinaryInfo)
  - [Class: MessageRetryManager](https://baileys.wiki/docs/api/classes/MessageRetryManager)
  - [Class: USyncContactProtocol](https://baileys.wiki/docs/api/classes/USyncContactProtocol)
  - [Class: USyncDeviceProtocol](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol)
  - [Class: USyncDisappearingModeProtocol](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol)
  - [Class: USyncQuery](https://baileys.wiki/docs/api/classes/USyncQuery)
  - [Class: USyncStatusProtocol](https://baileys.wiki/docs/api/classes/USyncStatusProtocol)
  - [Class: USyncUser](https://baileys.wiki/docs/api/classes/USyncUser)
- [enumerations](https://baileys.wiki/docs/api/enumerations/DisconnectReason)
- [functions](https://baileys.wiki/docs/api/functions/addTransactionCapability)
- [baileys](https://baileys.wiki/docs/api/)
- [interfaces](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter)
- [namespaces](https://baileys.wiki/docs/api/namespaces/proto/)
- [type-aliases](https://baileys.wiki/docs/api/type-aliases/AccountSettings)
- [variables](https://baileys.wiki/docs/api/variables/ALL_WA_PATCH_NAMES)

- [](https://baileys.wiki/)
- classes
- Class: USyncDisappearingModeProtocol

On this page

# Class: USyncDisappearingModeProtocol

Defined in: [src/WAUSync/Protocols/USyncDisappearingModeProtocol.ts:9](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/Protocols/USyncDisappearingModeProtocol.ts#L9)

## Implements[​](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#implements "Direct link to Implements")

- `USyncQueryProtocol`

## Constructors[​](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#constructors "Direct link to Constructors")

### new USyncDisappearingModeProtocol()[​](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#new-usyncdisappearingmodeprotocol "Direct link to new USyncDisappearingModeProtocol()")

> **new USyncDisappearingModeProtocol**(): [`USyncDisappearingModeProtocol`](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol)

#### Returns[​](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#returns "Direct link to Returns")

[`USyncDisappearingModeProtocol`](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol)

## Properties[​](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#properties "Direct link to Properties")

### name[​](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#name "Direct link to name")

> **name** : `string` = `'disappearing_mode'`
> Defined in: [src/WAUSync/Protocols/USyncDisappearingModeProtocol.ts:10](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/Protocols/USyncDisappearingModeProtocol.ts#L10)
> The name of the protocol

#### Implementation of[​](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#implementation-of "Direct link to Implementation of")

`USyncQueryProtocol.name`

## Methods[​](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#methods "Direct link to Methods")

### getQueryElement()[​](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#getqueryelement "Direct link to getQueryElement()")

> **getQueryElement**(): [`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)
> Defined in: [src/WAUSync/Protocols/USyncDisappearingModeProtocol.ts:12](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/Protocols/USyncDisappearingModeProtocol.ts#L12)
> Defines what goes inside the query part of a USyncQuery

#### Returns[​](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#returns-1 "Direct link to Returns")

[`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)

#### Implementation of[​](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#implementation-of-1 "Direct link to Implementation of")

`USyncQueryProtocol.getQueryElement`

---

### getUserElement()[​](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#getuserelement "Direct link to getUserElement()")

> **getUserElement**(): `null`
> Defined in: [src/WAUSync/Protocols/USyncDisappearingModeProtocol.ts:19](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/Protocols/USyncDisappearingModeProtocol.ts#L19)
> Defines what goes inside the user part of a USyncQuery

#### Returns[​](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#returns-2 "Direct link to Returns")

`null`

#### Implementation of[​](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#implementation-of-2 "Direct link to Implementation of")

`USyncQueryProtocol.getUserElement`

---

### parser()[​](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#parser "Direct link to parser()")

> **parser**(`node`): `undefined` | [`DisappearingModeData`](https://baileys.wiki/docs/api/type-aliases/DisappearingModeData)
> Defined in: [src/WAUSync/Protocols/USyncDisappearingModeProtocol.ts:23](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/Protocols/USyncDisappearingModeProtocol.ts#L23)
> Parse the result of the query

#### Parameters[​](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#parameters "Direct link to Parameters")

##### node[​](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#node "Direct link to node")

[`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)

#### Returns[​](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#returns-3 "Direct link to Returns")

`undefined` | [`DisappearingModeData`](https://baileys.wiki/docs/api/type-aliases/DisappearingModeData)
Whatever the protocol is supposed to return

#### Implementation of[​](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#implementation-of-3 "Direct link to Implementation of")

`USyncQueryProtocol.parser`
[](https://github.com/WhiskeySockets/baileys.wiki-site/tree/main/docs/api/classes/USyncDisappearingModeProtocol.md)
[Previous Class: USyncDeviceProtocol](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol)[Next Class: USyncQuery](https://baileys.wiki/docs/api/classes/USyncQuery)

- [Implements](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#implements)
- [Constructors](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#constructors)
  - [new USyncDisappearingModeProtocol()](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#new-usyncdisappearingmodeprotocol)
- [Properties](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#properties)
  - [name](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#name)
- [Methods](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#methods)
  - [getQueryElement()](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#getqueryelement)
  - [getUserElement()](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#getuserelement)
  - [parser()](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol/#parser)

Docs

- [Tutorial](https://baileys.wiki/docs/intro)

More

- [GitHub](https://github.com/WhiskeySockets/Baileys)

![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)
Copyright © 2025 Rajeh Taher, WhiskeySockets.
