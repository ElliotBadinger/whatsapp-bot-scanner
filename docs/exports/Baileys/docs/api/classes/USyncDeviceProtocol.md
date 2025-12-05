# Source: https://baileys.wiki/docs/api/classes/USyncDeviceProtocol

<!-- Scraped from https://baileys.wiki/docs/api/classes/USyncDeviceProtocol -->

[Skip to main content](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#__docusaurus_skipToContent_fallback)
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
- Class: USyncDeviceProtocol

On this page

# Class: USyncDeviceProtocol

Defined in: [src/WAUSync/Protocols/USyncDeviceProtocol.ts:22](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/Protocols/USyncDeviceProtocol.ts#L22)

## Implements[​](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#implements "Direct link to Implements")

- `USyncQueryProtocol`

## Constructors[​](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#constructors "Direct link to Constructors")

### new USyncDeviceProtocol()[​](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#new-usyncdeviceprotocol "Direct link to new USyncDeviceProtocol()")

> **new USyncDeviceProtocol**(): [`USyncDeviceProtocol`](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol)

#### Returns[​](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#returns "Direct link to Returns")

[`USyncDeviceProtocol`](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol)

## Properties[​](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#properties "Direct link to Properties")

### name[​](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#name "Direct link to name")

> **name** : `string` = `'devices'`
> Defined in: [src/WAUSync/Protocols/USyncDeviceProtocol.ts:23](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/Protocols/USyncDeviceProtocol.ts#L23)
> The name of the protocol

#### Implementation of[​](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#implementation-of "Direct link to Implementation of")

`USyncQueryProtocol.name`

## Methods[​](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#methods "Direct link to Methods")

### getQueryElement()[​](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#getqueryelement "Direct link to getQueryElement()")

> **getQueryElement**(): [`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)
> Defined in: [src/WAUSync/Protocols/USyncDeviceProtocol.ts:25](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/Protocols/USyncDeviceProtocol.ts#L25)
> Defines what goes inside the query part of a USyncQuery

#### Returns[​](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#returns-1 "Direct link to Returns")

[`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)

#### Implementation of[​](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#implementation-of-1 "Direct link to Implementation of")

`USyncQueryProtocol.getQueryElement`

---

### getUserElement()[​](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#getuserelement "Direct link to getUserElement()")

> **getUserElement**(): `null` | [`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)
> Defined in: [src/WAUSync/Protocols/USyncDeviceProtocol.ts:34](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/Protocols/USyncDeviceProtocol.ts#L34)
> Defines what goes inside the user part of a USyncQuery

#### Returns[​](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#returns-2 "Direct link to Returns")

`null` | [`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)

#### Implementation of[​](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#implementation-of-2 "Direct link to Implementation of")

`USyncQueryProtocol.getUserElement`

---

### parser()[​](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#parser "Direct link to parser()")

> **parser**(`node`): [`ParsedDeviceInfo`](https://baileys.wiki/docs/api/type-aliases/ParsedDeviceInfo)
> Defined in: [src/WAUSync/Protocols/USyncDeviceProtocol.ts:41](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/Protocols/USyncDeviceProtocol.ts#L41)
> Parse the result of the query

#### Parameters[​](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#parameters "Direct link to Parameters")

##### node[​](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#node "Direct link to node")

[`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)

#### Returns[​](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#returns-3 "Direct link to Returns")

[`ParsedDeviceInfo`](https://baileys.wiki/docs/api/type-aliases/ParsedDeviceInfo)
Whatever the protocol is supposed to return

#### Implementation of[​](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#implementation-of-3 "Direct link to Implementation of")

`USyncQueryProtocol.parser`
[](https://github.com/WhiskeySockets/baileys.wiki-site/tree/main/docs/api/classes/USyncDeviceProtocol.md)
[Previous Class: USyncContactProtocol](https://baileys.wiki/docs/api/classes/USyncContactProtocol)[Next Class: USyncDisappearingModeProtocol](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol)

- [Implements](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#implements)
- [Constructors](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#constructors)
  - [new USyncDeviceProtocol()](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#new-usyncdeviceprotocol)
- [Properties](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#properties)
  - [name](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#name)
- [Methods](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#methods)
  - [getQueryElement()](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#getqueryelement)
  - [getUserElement()](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#getuserelement)
  - [parser()](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol/#parser)

Docs

- [Tutorial](https://baileys.wiki/docs/intro)

More

- [GitHub](https://github.com/WhiskeySockets/Baileys)

![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)
Copyright © 2025 Rajeh Taher, WhiskeySockets.
