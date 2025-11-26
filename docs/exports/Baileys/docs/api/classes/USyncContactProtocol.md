# Source: https://baileys.wiki/docs/api/classes/USyncContactProtocol

<!-- Scraped from https://baileys.wiki/docs/api/classes/USyncContactProtocol -->

[Skip to main content](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#__docusaurus_skipToContent_fallback)
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
  * Class: USyncContactProtocol


On this page
# Class: USyncContactProtocol
Defined in: [src/WAUSync/Protocols/USyncContactProtocol.ts:5](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/WAUSync/Protocols/USyncContactProtocol.ts#L5)
## Implements[​](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#implements "Direct link to Implements")
  * `USyncQueryProtocol`


## Constructors[​](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#constructors "Direct link to Constructors")
### new USyncContactProtocol()[​](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#new-usynccontactprotocol "Direct link to new USyncContactProtocol\(\)")
> **new USyncContactProtocol**(): [`USyncContactProtocol`](https://baileys.wiki/docs/api/classes/USyncContactProtocol)
#### Returns[​](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#returns "Direct link to Returns")
[`USyncContactProtocol`](https://baileys.wiki/docs/api/classes/USyncContactProtocol)
## Properties[​](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#properties "Direct link to Properties")
### name[​](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#name "Direct link to name")
> **name** : `string` = `'contact'`
Defined in: [src/WAUSync/Protocols/USyncContactProtocol.ts:6](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/WAUSync/Protocols/USyncContactProtocol.ts#L6)
The name of the protocol
#### Implementation of[​](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#implementation-of "Direct link to Implementation of")
`USyncQueryProtocol.name`
## Methods[​](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#methods "Direct link to Methods")
### getQueryElement()[​](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#getqueryelement "Direct link to getQueryElement\(\)")
> **getQueryElement**(): [`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)
Defined in: [src/WAUSync/Protocols/USyncContactProtocol.ts:8](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/WAUSync/Protocols/USyncContactProtocol.ts#L8)
Defines what goes inside the query part of a USyncQuery
#### Returns[​](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#returns-1 "Direct link to Returns")
[`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)
#### Implementation of[​](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#implementation-of-1 "Direct link to Implementation of")
`USyncQueryProtocol.getQueryElement`
* * *
### getUserElement()[​](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#getuserelement "Direct link to getUserElement\(\)")
> **getUserElement**(`user`): [`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)
Defined in: [src/WAUSync/Protocols/USyncContactProtocol.ts:15](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/WAUSync/Protocols/USyncContactProtocol.ts#L15)
Defines what goes inside the user part of a USyncQuery
#### Parameters[​](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#parameters "Direct link to Parameters")
##### user[​](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#user "Direct link to user")
[`USyncUser`](https://baileys.wiki/docs/api/classes/USyncUser)
#### Returns[​](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#returns-2 "Direct link to Returns")
[`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)
#### Implementation of[​](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#implementation-of-2 "Direct link to Implementation of")
`USyncQueryProtocol.getUserElement`
* * *
### parser()[​](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#parser "Direct link to parser\(\)")
> **parser**(`node`): `boolean`
Defined in: [src/WAUSync/Protocols/USyncContactProtocol.ts:24](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/WAUSync/Protocols/USyncContactProtocol.ts#L24)
Parse the result of the query
#### Parameters[​](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#parameters-1 "Direct link to Parameters")
##### node[​](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#node "Direct link to node")
[`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)
#### Returns[​](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#returns-3 "Direct link to Returns")
`boolean`
Whatever the protocol is supposed to return
#### Implementation of[​](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#implementation-of-3 "Direct link to Implementation of")
`USyncQueryProtocol.parser`
[](https://github.com/WhiskeySockets/baileys.wiki-site/tree/main/docs/api/classes/USyncContactProtocol.md)
[Previous Class: MessageRetryManager](https://baileys.wiki/docs/api/classes/MessageRetryManager)[Next Class: USyncDeviceProtocol](https://baileys.wiki/docs/api/classes/USyncDeviceProtocol)
  * [Implements](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#implements)
  * [Constructors](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#constructors)
    * [new USyncContactProtocol()](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#new-usynccontactprotocol)
  * [Properties](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#properties)
    * [name](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#name)
  * [Methods](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#methods)
    * [getQueryElement()](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#getqueryelement)
    * [getUserElement()](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#getuserelement)
    * [parser()](https://baileys.wiki/docs/api/classes/USyncContactProtocol/#parser)


Docs
  * [Tutorial](https://baileys.wiki/docs/intro)


More
  * [GitHub](https://github.com/WhiskeySockets/Baileys)


![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)
Copyright © 2025 Rajeh Taher, WhiskeySockets.
