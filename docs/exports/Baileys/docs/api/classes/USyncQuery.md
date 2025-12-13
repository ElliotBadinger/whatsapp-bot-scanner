# Source: https://baileys.wiki/docs/api/classes/USyncQuery

<!-- Scraped from https://baileys.wiki/docs/api/classes/USyncQuery -->

[Skip to main content](https://baileys.wiki/docs/api/classes/USyncQuery/#__docusaurus_skipToContent_fallback)
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
- Class: USyncQuery

On this page

# Class: USyncQuery

Defined in: [src/WAUSync/USyncQuery.ts:20](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/USyncQuery.ts#L20)

## Constructors[​](https://baileys.wiki/docs/api/classes/USyncQuery/#constructors "Direct link to Constructors")

### new USyncQuery()[​](https://baileys.wiki/docs/api/classes/USyncQuery/#new-usyncquery "Direct link to new USyncQuery()")

> **new USyncQuery**(): [`USyncQuery`](https://baileys.wiki/docs/api/classes/USyncQuery)
> Defined in: [src/WAUSync/USyncQuery.ts:26](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/USyncQuery.ts#L26)

#### Returns[​](https://baileys.wiki/docs/api/classes/USyncQuery/#returns "Direct link to Returns")

[`USyncQuery`](https://baileys.wiki/docs/api/classes/USyncQuery)

## Properties[​](https://baileys.wiki/docs/api/classes/USyncQuery/#properties "Direct link to Properties")

### context[​](https://baileys.wiki/docs/api/classes/USyncQuery/#context "Direct link to context")

> **context** : `string`
> Defined in: [src/WAUSync/USyncQuery.ts:23](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/USyncQuery.ts#L23)

---

### mode[​](https://baileys.wiki/docs/api/classes/USyncQuery/#mode "Direct link to mode")

> **mode** : `string`
> Defined in: [src/WAUSync/USyncQuery.ts:24](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/USyncQuery.ts#L24)

---

### protocols[​](https://baileys.wiki/docs/api/classes/USyncQuery/#protocols "Direct link to protocols")

> **protocols** : `USyncQueryProtocol`[]
> Defined in: [src/WAUSync/USyncQuery.ts:21](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/USyncQuery.ts#L21)

---

### users[​](https://baileys.wiki/docs/api/classes/USyncQuery/#users "Direct link to users")

> **users** : [`USyncUser`](https://baileys.wiki/docs/api/classes/USyncUser)[]
> Defined in: [src/WAUSync/USyncQuery.ts:22](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/USyncQuery.ts#L22)

## Methods[​](https://baileys.wiki/docs/api/classes/USyncQuery/#methods "Direct link to Methods")

### parseUSyncQueryResult()[​](https://baileys.wiki/docs/api/classes/USyncQuery/#parseusyncqueryresult "Direct link to parseUSyncQueryResult()")

> **parseUSyncQueryResult**(`result`): `undefined` | [`USyncQueryResult`](https://baileys.wiki/docs/api/type-aliases/USyncQueryResult)
> Defined in: [src/WAUSync/USyncQuery.ts:48](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/USyncQuery.ts#L48)

#### Parameters[​](https://baileys.wiki/docs/api/classes/USyncQuery/#parameters "Direct link to Parameters")

##### result[​](https://baileys.wiki/docs/api/classes/USyncQuery/#result "Direct link to result")

`undefined` | [`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)

#### Returns[​](https://baileys.wiki/docs/api/classes/USyncQuery/#returns-1 "Direct link to Returns")

`undefined` | [`USyncQueryResult`](https://baileys.wiki/docs/api/type-aliases/USyncQueryResult)

---

### withBotProfileProtocol()[​](https://baileys.wiki/docs/api/classes/USyncQuery/#withbotprofileprotocol "Direct link to withBotProfileProtocol()")

> **withBotProfileProtocol**(): [`USyncQuery`](https://baileys.wiki/docs/api/classes/USyncQuery)
> Defined in: [src/WAUSync/USyncQuery.ts:124](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/USyncQuery.ts#L124)

#### Returns[​](https://baileys.wiki/docs/api/classes/USyncQuery/#returns-2 "Direct link to Returns")

[`USyncQuery`](https://baileys.wiki/docs/api/classes/USyncQuery)

---

### withContactProtocol()[​](https://baileys.wiki/docs/api/classes/USyncQuery/#withcontactprotocol "Direct link to withContactProtocol()")

> **withContactProtocol**(): [`USyncQuery`](https://baileys.wiki/docs/api/classes/USyncQuery)
> Defined in: [src/WAUSync/USyncQuery.ts:109](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/USyncQuery.ts#L109)

#### Returns[​](https://baileys.wiki/docs/api/classes/USyncQuery/#returns-3 "Direct link to Returns")

[`USyncQuery`](https://baileys.wiki/docs/api/classes/USyncQuery)

---

### withContext()[​](https://baileys.wiki/docs/api/classes/USyncQuery/#withcontext "Direct link to withContext()")

> **withContext**(`context`): [`USyncQuery`](https://baileys.wiki/docs/api/classes/USyncQuery)
> Defined in: [src/WAUSync/USyncQuery.ts:38](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/USyncQuery.ts#L38)

#### Parameters[​](https://baileys.wiki/docs/api/classes/USyncQuery/#parameters-1 "Direct link to Parameters")

##### context[​](https://baileys.wiki/docs/api/classes/USyncQuery/#context-1 "Direct link to context")

`string`

#### Returns[​](https://baileys.wiki/docs/api/classes/USyncQuery/#returns-4 "Direct link to Returns")

[`USyncQuery`](https://baileys.wiki/docs/api/classes/USyncQuery)

---

### withDeviceProtocol()[​](https://baileys.wiki/docs/api/classes/USyncQuery/#withdeviceprotocol "Direct link to withDeviceProtocol()")

> **withDeviceProtocol**(): [`USyncQuery`](https://baileys.wiki/docs/api/classes/USyncQuery)
> Defined in: [src/WAUSync/USyncQuery.ts:104](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/USyncQuery.ts#L104)

#### Returns[​](https://baileys.wiki/docs/api/classes/USyncQuery/#returns-5 "Direct link to Returns")

[`USyncQuery`](https://baileys.wiki/docs/api/classes/USyncQuery)

---

### withDisappearingModeProtocol()[​](https://baileys.wiki/docs/api/classes/USyncQuery/#withdisappearingmodeprotocol "Direct link to withDisappearingModeProtocol()")

> **withDisappearingModeProtocol**(): [`USyncQuery`](https://baileys.wiki/docs/api/classes/USyncQuery)
> Defined in: [src/WAUSync/USyncQuery.ts:119](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/USyncQuery.ts#L119)

#### Returns[​](https://baileys.wiki/docs/api/classes/USyncQuery/#returns-6 "Direct link to Returns")

[`USyncQuery`](https://baileys.wiki/docs/api/classes/USyncQuery)

---

### withLIDProtocol()[​](https://baileys.wiki/docs/api/classes/USyncQuery/#withlidprotocol "Direct link to withLIDProtocol()")

> **withLIDProtocol**(): [`USyncQuery`](https://baileys.wiki/docs/api/classes/USyncQuery)
> Defined in: [src/WAUSync/USyncQuery.ts:129](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/USyncQuery.ts#L129)

#### Returns[​](https://baileys.wiki/docs/api/classes/USyncQuery/#returns-7 "Direct link to Returns")

[`USyncQuery`](https://baileys.wiki/docs/api/classes/USyncQuery)

---

### withMode()[​](https://baileys.wiki/docs/api/classes/USyncQuery/#withmode "Direct link to withMode()")

> **withMode**(`mode`): [`USyncQuery`](https://baileys.wiki/docs/api/classes/USyncQuery)
> Defined in: [src/WAUSync/USyncQuery.ts:33](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/USyncQuery.ts#L33)

#### Parameters[​](https://baileys.wiki/docs/api/classes/USyncQuery/#parameters-2 "Direct link to Parameters")

##### mode[​](https://baileys.wiki/docs/api/classes/USyncQuery/#mode-1 "Direct link to mode")

`string`

#### Returns[​](https://baileys.wiki/docs/api/classes/USyncQuery/#returns-8 "Direct link to Returns")

[`USyncQuery`](https://baileys.wiki/docs/api/classes/USyncQuery)

---

### withStatusProtocol()[​](https://baileys.wiki/docs/api/classes/USyncQuery/#withstatusprotocol "Direct link to withStatusProtocol()")

> **withStatusProtocol**(): [`USyncQuery`](https://baileys.wiki/docs/api/classes/USyncQuery)
> Defined in: [src/WAUSync/USyncQuery.ts:114](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/USyncQuery.ts#L114)

#### Returns[​](https://baileys.wiki/docs/api/classes/USyncQuery/#returns-9 "Direct link to Returns")

[`USyncQuery`](https://baileys.wiki/docs/api/classes/USyncQuery)

---

### withUser()[​](https://baileys.wiki/docs/api/classes/USyncQuery/#withuser "Direct link to withUser()")

> **withUser**(`user`): [`USyncQuery`](https://baileys.wiki/docs/api/classes/USyncQuery)
> Defined in: [src/WAUSync/USyncQuery.ts:43](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/WAUSync/USyncQuery.ts#L43)

#### Parameters[​](https://baileys.wiki/docs/api/classes/USyncQuery/#parameters-3 "Direct link to Parameters")

##### user[​](https://baileys.wiki/docs/api/classes/USyncQuery/#user "Direct link to user")

[`USyncUser`](https://baileys.wiki/docs/api/classes/USyncUser)

#### Returns[​](https://baileys.wiki/docs/api/classes/USyncQuery/#returns-10 "Direct link to Returns")

[`USyncQuery`](https://baileys.wiki/docs/api/classes/USyncQuery)
[](https://github.com/WhiskeySockets/baileys.wiki-site/tree/main/docs/api/classes/USyncQuery.md)
[Previous Class: USyncDisappearingModeProtocol](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol)[Next Class: USyncStatusProtocol](https://baileys.wiki/docs/api/classes/USyncStatusProtocol)

- [Constructors](https://baileys.wiki/docs/api/classes/USyncQuery/#constructors)
  - [new USyncQuery()](https://baileys.wiki/docs/api/classes/USyncQuery/#new-usyncquery)
- [Properties](https://baileys.wiki/docs/api/classes/USyncQuery/#properties)
  - [context](https://baileys.wiki/docs/api/classes/USyncQuery/#context)
  - [mode](https://baileys.wiki/docs/api/classes/USyncQuery/#mode)
  - [protocols](https://baileys.wiki/docs/api/classes/USyncQuery/#protocols)
  - [users](https://baileys.wiki/docs/api/classes/USyncQuery/#users)
- [Methods](https://baileys.wiki/docs/api/classes/USyncQuery/#methods)
  - [parseUSyncQueryResult()](https://baileys.wiki/docs/api/classes/USyncQuery/#parseusyncqueryresult)
  - [withBotProfileProtocol()](https://baileys.wiki/docs/api/classes/USyncQuery/#withbotprofileprotocol)
  - [withContactProtocol()](https://baileys.wiki/docs/api/classes/USyncQuery/#withcontactprotocol)
  - [withContext()](https://baileys.wiki/docs/api/classes/USyncQuery/#withcontext)
  - [withDeviceProtocol()](https://baileys.wiki/docs/api/classes/USyncQuery/#withdeviceprotocol)
  - [withDisappearingModeProtocol()](https://baileys.wiki/docs/api/classes/USyncQuery/#withdisappearingmodeprotocol)
  - [withLIDProtocol()](https://baileys.wiki/docs/api/classes/USyncQuery/#withlidprotocol)
  - [withMode()](https://baileys.wiki/docs/api/classes/USyncQuery/#withmode)
  - [withStatusProtocol()](https://baileys.wiki/docs/api/classes/USyncQuery/#withstatusprotocol)
  - [withUser()](https://baileys.wiki/docs/api/classes/USyncQuery/#withuser)

Docs

- [Tutorial](https://baileys.wiki/docs/intro)

More

- [GitHub](https://github.com/WhiskeySockets/Baileys)

![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)
Copyright © 2025 Rajeh Taher, WhiskeySockets.
