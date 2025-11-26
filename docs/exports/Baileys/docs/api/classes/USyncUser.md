# Source: https://baileys.wiki/docs/api/classes/USyncUser

<!-- Scraped from https://baileys.wiki/docs/api/classes/USyncUser -->

[Skip to main content](https://baileys.wiki/docs/api/classes/USyncUser/#__docusaurus_skipToContent_fallback)
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
  * Class: USyncUser


On this page
# Class: USyncUser
Defined in: [src/WAUSync/USyncUser.ts:1](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/WAUSync/USyncUser.ts#L1)
## Constructors[​](https://baileys.wiki/docs/api/classes/USyncUser/#constructors "Direct link to Constructors")
### new USyncUser()[​](https://baileys.wiki/docs/api/classes/USyncUser/#new-usyncuser "Direct link to new USyncUser\(\)")
> **new USyncUser**(): [`USyncUser`](https://baileys.wiki/docs/api/classes/USyncUser)
#### Returns[​](https://baileys.wiki/docs/api/classes/USyncUser/#returns "Direct link to Returns")
[`USyncUser`](https://baileys.wiki/docs/api/classes/USyncUser)
## Properties[​](https://baileys.wiki/docs/api/classes/USyncUser/#properties "Direct link to Properties")
### id?[​](https://baileys.wiki/docs/api/classes/USyncUser/#id "Direct link to id?")
> `optional` **id** : `string`
Defined in: [src/WAUSync/USyncUser.ts:2](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/WAUSync/USyncUser.ts#L2)
* * *
### lid?[​](https://baileys.wiki/docs/api/classes/USyncUser/#lid "Direct link to lid?")
> `optional` **lid** : `string`
Defined in: [src/WAUSync/USyncUser.ts:3](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/WAUSync/USyncUser.ts#L3)
* * *
### personaId?[​](https://baileys.wiki/docs/api/classes/USyncUser/#personaid "Direct link to personaId?")
> `optional` **personaId** : `string`
Defined in: [src/WAUSync/USyncUser.ts:6](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/WAUSync/USyncUser.ts#L6)
* * *
### phone?[​](https://baileys.wiki/docs/api/classes/USyncUser/#phone "Direct link to phone?")
> `optional` **phone** : `string`
Defined in: [src/WAUSync/USyncUser.ts:4](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/WAUSync/USyncUser.ts#L4)
* * *
### type?[​](https://baileys.wiki/docs/api/classes/USyncUser/#type "Direct link to type?")
> `optional` **type** : `string`
Defined in: [src/WAUSync/USyncUser.ts:5](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/WAUSync/USyncUser.ts#L5)
## Methods[​](https://baileys.wiki/docs/api/classes/USyncUser/#methods "Direct link to Methods")
### withId()[​](https://baileys.wiki/docs/api/classes/USyncUser/#withid "Direct link to withId\(\)")
> **withId**(`id`): [`USyncUser`](https://baileys.wiki/docs/api/classes/USyncUser)
Defined in: [src/WAUSync/USyncUser.ts:8](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/WAUSync/USyncUser.ts#L8)
#### Parameters[​](https://baileys.wiki/docs/api/classes/USyncUser/#parameters "Direct link to Parameters")
##### id[​](https://baileys.wiki/docs/api/classes/USyncUser/#id-1 "Direct link to id")
`string`
#### Returns[​](https://baileys.wiki/docs/api/classes/USyncUser/#returns-1 "Direct link to Returns")
[`USyncUser`](https://baileys.wiki/docs/api/classes/USyncUser)
* * *
### withLid()[​](https://baileys.wiki/docs/api/classes/USyncUser/#withlid "Direct link to withLid\(\)")
> **withLid**(`lid`): [`USyncUser`](https://baileys.wiki/docs/api/classes/USyncUser)
Defined in: [src/WAUSync/USyncUser.ts:13](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/WAUSync/USyncUser.ts#L13)
#### Parameters[​](https://baileys.wiki/docs/api/classes/USyncUser/#parameters-1 "Direct link to Parameters")
##### lid[​](https://baileys.wiki/docs/api/classes/USyncUser/#lid-1 "Direct link to lid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/classes/USyncUser/#returns-2 "Direct link to Returns")
[`USyncUser`](https://baileys.wiki/docs/api/classes/USyncUser)
* * *
### withPersonaId()[​](https://baileys.wiki/docs/api/classes/USyncUser/#withpersonaid "Direct link to withPersonaId\(\)")
> **withPersonaId**(`personaId`): [`USyncUser`](https://baileys.wiki/docs/api/classes/USyncUser)
Defined in: [src/WAUSync/USyncUser.ts:28](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/WAUSync/USyncUser.ts#L28)
#### Parameters[​](https://baileys.wiki/docs/api/classes/USyncUser/#parameters-2 "Direct link to Parameters")
##### personaId[​](https://baileys.wiki/docs/api/classes/USyncUser/#personaid-1 "Direct link to personaId")
`string`
#### Returns[​](https://baileys.wiki/docs/api/classes/USyncUser/#returns-3 "Direct link to Returns")
[`USyncUser`](https://baileys.wiki/docs/api/classes/USyncUser)
* * *
### withPhone()[​](https://baileys.wiki/docs/api/classes/USyncUser/#withphone "Direct link to withPhone\(\)")
> **withPhone**(`phone`): [`USyncUser`](https://baileys.wiki/docs/api/classes/USyncUser)
Defined in: [src/WAUSync/USyncUser.ts:18](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/WAUSync/USyncUser.ts#L18)
#### Parameters[​](https://baileys.wiki/docs/api/classes/USyncUser/#parameters-3 "Direct link to Parameters")
##### phone[​](https://baileys.wiki/docs/api/classes/USyncUser/#phone-1 "Direct link to phone")
`string`
#### Returns[​](https://baileys.wiki/docs/api/classes/USyncUser/#returns-4 "Direct link to Returns")
[`USyncUser`](https://baileys.wiki/docs/api/classes/USyncUser)
* * *
### withType()[​](https://baileys.wiki/docs/api/classes/USyncUser/#withtype "Direct link to withType\(\)")
> **withType**(`type`): [`USyncUser`](https://baileys.wiki/docs/api/classes/USyncUser)
Defined in: [src/WAUSync/USyncUser.ts:23](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/WAUSync/USyncUser.ts#L23)
#### Parameters[​](https://baileys.wiki/docs/api/classes/USyncUser/#parameters-4 "Direct link to Parameters")
##### type[​](https://baileys.wiki/docs/api/classes/USyncUser/#type-1 "Direct link to type")
`string`
#### Returns[​](https://baileys.wiki/docs/api/classes/USyncUser/#returns-5 "Direct link to Returns")
[`USyncUser`](https://baileys.wiki/docs/api/classes/USyncUser)
[](https://github.com/WhiskeySockets/baileys.wiki-site/tree/main/docs/api/classes/USyncUser.md)
[Previous Class: USyncStatusProtocol](https://baileys.wiki/docs/api/classes/USyncStatusProtocol)[Next Enumeration: DisconnectReason](https://baileys.wiki/docs/api/enumerations/DisconnectReason)
  * [Constructors](https://baileys.wiki/docs/api/classes/USyncUser/#constructors)
    * [new USyncUser()](https://baileys.wiki/docs/api/classes/USyncUser/#new-usyncuser)
  * [Properties](https://baileys.wiki/docs/api/classes/USyncUser/#properties)
    * [id?](https://baileys.wiki/docs/api/classes/USyncUser/#id)
    * [lid?](https://baileys.wiki/docs/api/classes/USyncUser/#lid)
    * [personaId?](https://baileys.wiki/docs/api/classes/USyncUser/#personaid)
    * [phone?](https://baileys.wiki/docs/api/classes/USyncUser/#phone)
    * [type?](https://baileys.wiki/docs/api/classes/USyncUser/#type)
  * [Methods](https://baileys.wiki/docs/api/classes/USyncUser/#methods)
    * [withId()](https://baileys.wiki/docs/api/classes/USyncUser/#withid)
    * [withLid()](https://baileys.wiki/docs/api/classes/USyncUser/#withlid)
    * [withPersonaId()](https://baileys.wiki/docs/api/classes/USyncUser/#withpersonaid)
    * [withPhone()](https://baileys.wiki/docs/api/classes/USyncUser/#withphone)
    * [withType()](https://baileys.wiki/docs/api/classes/USyncUser/#withtype)


Docs
  * [Tutorial](https://baileys.wiki/docs/intro)


More
  * [GitHub](https://github.com/WhiskeySockets/Baileys)


![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)
Copyright © 2025 Rajeh Taher, WhiskeySockets.
