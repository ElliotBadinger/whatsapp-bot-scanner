# Source: https://baileys.wiki/docs/api/classes/USyncStatusProtocol

<!-- Scraped from https://baileys.wiki/docs/api/classes/USyncStatusProtocol -->

[Skip to main content](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#__docusaurus_skipToContent_fallback)
[ ![WhiskeySo ckets Logo](https://baileys.wiki/img/WhiskeySockets-colorful.png)![WhiskeySo ckets Logo](https://baileys.wiki/img/WhiskeySockets-colorful.png) **Baileys**](https://baileys.wiki/)[Docs](https://baileys.wiki/docs/intro)[API Reference](https://baileys.wiki/docs/api/classes/BinaryInfo)
[Sponsor](https://purpshell.dev/sponsor "Sponsor")[Discord](https://whiskey.so/discord "Discord")[GitHub](https://github.com/WhiskeySockets/Baileys "GitHub")
  * [classes](https://baileys.wiki/docs/api/classes/BinaryInfo)
    * [Class: BinaryInfo](https://baileys.wiki/docs/api/classes/BinaryInfo)
    * [Class: MessageRetryManager](https://baileys.wiki/docs/api/classes/MessageRetryManager)
    * [Class: USyncContactProtocol](https://baileys.wiki/docs/api/classes/USyncContactProtocol)
    * [Class: USyncDeviceProtocol](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol)
    * [Class: USyncDisappearingModeProtocol](https://baileys.wiki/docs/api/classes/USyncDisappearingModeProtocol)
    * [Class: USyncQuery](https://baileys.wiki/docs/api/classes/USyncQuery)
    * [Class: USyncStatusProtocol](https://baileys.wiki/docs/api/classes/USyncStatusProtocol)
    * [Class: USyncUser](https://baileys.wiki/docs/api/classes/USyncUser)
  * [enumerations](https://baileys.wiki/docs/api/enumerations/DisconnectReason)
  * [functions](https://baileys.wiki/docs/api/functions/addTransactionCapability)
  * [baileys](https://baileys.wiki/docs/api/)
  * [interfaces](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter)
  * [namespaces](https://baileys.wiki/docs/api/namespaces/proto/)
  * [type-aliases](https://baileys.wiki/docs/api/type-aliases/AccountSettings)
  * [variables](https://baileys.wiki/docs/api/variables/ALL_WA_PATCH_NAMES)


  * [](https://baileys.wiki/)
  * classes
  * Class: USyncStatusProtocol


On this page
# Class: USyncStatusProtocol
Defined in: [src/WAUSync/Protocols/USyncStatusProtocol.ts:9](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/WAUSync/Protocols/USyncStatusProtocol.ts#L9)
## Implements[​](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#implements "Direct link to Implements")
  * `USyncQueryProtocol`


## Constructors[​](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#constructors "Direct link to Constructors")
### new USyncStatusProtocol()[​](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#new-usyncstatusprotocol "Direct link to new USyncStatusProtocol\(\)")
> **new USyncStatusProtocol**(): [`USyncStatusProtocol`](https://baileys.wiki/docs/api/classes/USyncStatusProtocol)
#### Returns[​](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#returns "Direct link to Returns")
[`USyncStatusProtocol`](https://baileys.wiki/docs/api/classes/USyncStatusProtocol)
## Properties[​](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#properties "Direct link to Properties")
### name[​](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#name "Direct link to name")
> **name** : `string` = `'status'`
Defined in: [src/WAUSync/Protocols/USyncStatusProtocol.ts:10](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/WAUSync/Protocols/USyncStatusProtocol.ts#L10)
The name of the protocol
#### Implementation of[​](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#implementation-of "Direct link to Implementation of")
`USyncQueryProtocol.name`
## Methods[​](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#methods "Direct link to Methods")
### getQueryElement()[​](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#getqueryelement "Direct link to getQueryElement\(\)")
> **getQueryElement**(): [`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)
Defined in: [src/WAUSync/Protocols/USyncStatusProtocol.ts:12](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/WAUSync/Protocols/USyncStatusProtocol.ts#L12)
Defines what goes inside the query part of a USyncQuery
#### Returns[​](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#returns-1 "Direct link to Returns")
[`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)
#### Implementation of[​](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#implementation-of-1 "Direct link to Implementation of")
`USyncQueryProtocol.getQueryElement`
* * *
### getUserElement()[​](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#getuserelement "Direct link to getUserElement\(\)")
> **getUserElement**(): `null`
Defined in: [src/WAUSync/Protocols/USyncStatusProtocol.ts:19](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/WAUSync/Protocols/USyncStatusProtocol.ts#L19)
Defines what goes inside the user part of a USyncQuery
#### Returns[​](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#returns-2 "Direct link to Returns")
`null`
#### Implementation of[​](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#implementation-of-2 "Direct link to Implementation of")
`USyncQueryProtocol.getUserElement`
* * *
### parser()[​](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#parser "Direct link to parser\(\)")
> **parser**(`node`): `undefined` | [`StatusData`](https://baileys.wiki/docs/api/type-aliases/StatusData)
Defined in: [src/WAUSync/Protocols/USyncStatusProtocol.ts:23](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/WAUSync/Protocols/USyncStatusProtocol.ts#L23)
Parse the result of the query
#### Parameters[​](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#parameters "Direct link to Parameters")
##### node[​](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#node "Direct link to node")
[`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)
#### Returns[​](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#returns-3 "Direct link to Returns")
`undefined` | [`StatusData`](https://baileys.wiki/docs/api/type-aliases/StatusData)
Whatever the protocol is supposed to return
#### Implementation of[​](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#implementation-of-3 "Direct link to Implementation of")
`USyncQueryProtocol.parser`
[](https://github.com/WhiskeySockets/baileys.wiki-site/tree/main/docs/api/classes/USyncStatusProtocol.md)
[Previous Class: USyncQuery](https://baileys.wiki/docs/api/classes/USyncQuery)[Next Class: USyncUser](https://baileys.wiki/docs/api/classes/USyncUser)
  * [Implements](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#implements)
  * [Constructors](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#constructors)
    * [new USyncStatusProtocol()](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#new-usyncstatusprotocol)
  * [Properties](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#properties)
    * [name](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#name)
  * [Methods](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#methods)
    * [getQueryElement()](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#getqueryelement)
    * [getUserElement()](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#getuserelement)
    * [parser()](https://baileys.wiki/docs/api/classes/USyncStatusProtocol/#parser)


Docs
  * [Tutorial](https://baileys.wiki/docs/intro)


More
  * [GitHub](https://github.com/WhiskeySockets/Baileys)


![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)
Copyright © 2025 Rajeh Taher, WhiskeySockets.
