# Source: https://baileys.wiki/docs/api/classes/MessageRetryManager

<!-- Scraped from https://baileys.wiki/docs/api/classes/MessageRetryManager -->

[Skip to main content](https://baileys.wiki/docs/api/classes/MessageRetryManager/#__docusaurus_skipToContent_fallback)
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
  * Class: MessageRetryManager


On this page
# Class: MessageRetryManager
Defined in: [src/Utils/message-retry-manager.ts:42](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Utils/message-retry-manager.ts#L42)
## Constructors[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#constructors "Direct link to Constructors")
### new MessageRetryManager()[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#new-messageretrymanager "Direct link to new MessageRetryManager\(\)")
> **new MessageRetryManager**(`logger`, `maxMsgRetryCount`): [`MessageRetryManager`](https://baileys.wiki/docs/api/classes/MessageRetryManager)
Defined in: [src/Utils/message-retry-manager.ts:76](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Utils/message-retry-manager.ts#L76)
#### Parameters[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#parameters "Direct link to Parameters")
##### logger[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#logger "Direct link to logger")
`ILogger`
##### maxMsgRetryCount[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#maxmsgretrycount "Direct link to maxMsgRetryCount")
`number`
#### Returns[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#returns "Direct link to Returns")
[`MessageRetryManager`](https://baileys.wiki/docs/api/classes/MessageRetryManager)
## Methods[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#methods "Direct link to Methods")
### addRecentMessage()[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#addrecentmessage "Direct link to addRecentMessage\(\)")
> **addRecentMessage**(`to`, `id`, `message`): `void`
Defined in: [src/Utils/message-retry-manager.ts:86](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Utils/message-retry-manager.ts#L86)
Add a recent message to the cache for retry handling
#### Parameters[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#parameters-1 "Direct link to Parameters")
##### to[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#to "Direct link to to")
`string`
##### id[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#id "Direct link to id")
`string`
##### message[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#message "Direct link to message")
[`IMessage`](https://baileys.wiki/docs/api/namespaces/proto/interfaces/IMessage)
#### Returns[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#returns-1 "Direct link to Returns")
`void`
* * *
### cancelPendingPhoneRequest()[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#cancelpendingphonerequest "Direct link to cancelPendingPhoneRequest\(\)")
> **cancelPendingPhoneRequest**(`messageId`): `void`
Defined in: [src/Utils/message-retry-manager.ts:207](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Utils/message-retry-manager.ts#L207)
Cancel pending phone request
#### Parameters[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#parameters-2 "Direct link to Parameters")
##### messageId[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#messageid "Direct link to messageId")
`string`
#### Returns[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#returns-2 "Direct link to Returns")
`void`
* * *
### getRecentMessage()[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#getrecentmessage "Direct link to getRecentMessage\(\)")
> **getRecentMessage**(`to`, `id`): `undefined` | [`RecentMessage`](https://baileys.wiki/docs/api/interfaces/RecentMessage)
Defined in: [src/Utils/message-retry-manager.ts:103](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Utils/message-retry-manager.ts#L103)
Get a recent message from the cache
#### Parameters[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#parameters-3 "Direct link to Parameters")
##### to[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#to-1 "Direct link to to")
`string`
##### id[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#id-1 "Direct link to id")
`string`
#### Returns[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#returns-3 "Direct link to Returns")
`undefined` | [`RecentMessage`](https://baileys.wiki/docs/api/interfaces/RecentMessage)
* * *
### getRetryCount()[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#getretrycount "Direct link to getRetryCount\(\)")
> **getRetryCount**(`messageId`): `number`
Defined in: [src/Utils/message-retry-manager.ts:156](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Utils/message-retry-manager.ts#L156)
Get retry count for a message
#### Parameters[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#parameters-4 "Direct link to Parameters")
##### messageId[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#messageid-1 "Direct link to messageId")
`string`
#### Returns[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#returns-4 "Direct link to Returns")
`number`
* * *
### hasExceededMaxRetries()[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#hasexceededmaxretries "Direct link to hasExceededMaxRetries\(\)")
> **hasExceededMaxRetries**(`messageId`): `boolean`
Defined in: [src/Utils/message-retry-manager.ts:163](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Utils/message-retry-manager.ts#L163)
Check if message has exceeded maximum retry attempts
#### Parameters[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#parameters-5 "Direct link to Parameters")
##### messageId[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#messageid-2 "Direct link to messageId")
`string`
#### Returns[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#returns-5 "Direct link to Returns")
`boolean`
* * *
### incrementRetryCount()[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#incrementretrycount "Direct link to incrementRetryCount\(\)")
> **incrementRetryCount**(`messageId`): `number`
Defined in: [src/Utils/message-retry-manager.ts:147](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Utils/message-retry-manager.ts#L147)
Increment retry counter for a message
#### Parameters[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#parameters-6 "Direct link to Parameters")
##### messageId[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#messageid-3 "Direct link to messageId")
`string`
#### Returns[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#returns-6 "Direct link to Returns")
`number`
* * *
### markRetryFailed()[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#markretryfailed "Direct link to markRetryFailed\(\)")
> **markRetryFailed**(`messageId`): `void`
Defined in: [src/Utils/message-retry-manager.ts:181](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Utils/message-retry-manager.ts#L181)
Mark retry as failed
#### Parameters[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#parameters-7 "Direct link to Parameters")
##### messageId[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#messageid-4 "Direct link to messageId")
`string`
#### Returns[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#returns-7 "Direct link to Returns")
`void`
* * *
### markRetrySuccess()[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#markretrysuccess "Direct link to markRetrySuccess\(\)")
> **markRetrySuccess**(`messageId`): `void`
Defined in: [src/Utils/message-retry-manager.ts:170](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Utils/message-retry-manager.ts#L170)
Mark retry as successful
#### Parameters[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#parameters-8 "Direct link to Parameters")
##### messageId[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#messageid-5 "Direct link to messageId")
`string`
#### Returns[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#returns-8 "Direct link to Returns")
`void`
* * *
### schedulePhoneRequest()[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#schedulephonerequest "Direct link to schedulePhoneRequest\(\)")
> **schedulePhoneRequest**(`messageId`, `callback`, `delay`): `void`
Defined in: [src/Utils/message-retry-manager.ts:191](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Utils/message-retry-manager.ts#L191)
Schedule a phone request with delay
#### Parameters[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#parameters-9 "Direct link to Parameters")
##### messageId[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#messageid-6 "Direct link to messageId")
`string`
##### callback[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#callback "Direct link to callback")
() => `void`
##### delay[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#delay "Direct link to delay")
`number` = `PHONE_REQUEST_DELAY`
#### Returns[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#returns-9 "Direct link to Returns")
`void`
* * *
### shouldRecreateSession()[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#shouldrecreatesession "Direct link to shouldRecreateSession\(\)")
> **shouldRecreateSession**(`jid`, `retryCount`, `hasSession`): `object`
Defined in: [src/Utils/message-retry-manager.ts:112](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Utils/message-retry-manager.ts#L112)
Check if a session should be recreated based on retry count and history
#### Parameters[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#parameters-10 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#jid "Direct link to jid")
`string`
##### retryCount[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#retrycount "Direct link to retryCount")
`number`
##### hasSession[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#hassession "Direct link to hasSession")
`boolean`
#### Returns[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#returns-10 "Direct link to Returns")
`object`
##### reason[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#reason "Direct link to reason")
> **reason** : `string`
##### recreate[​](https://baileys.wiki/docs/api/classes/MessageRetryManager/#recreate "Direct link to recreate")
> **recreate** : `boolean`
[](https://github.com/WhiskeySockets/baileys.wiki-site/tree/main/docs/api/classes/MessageRetryManager.md)
[Previous Class: BinaryInfo](https://baileys.wiki/docs/api/classes/BinaryInfo)[Next Class: USyncContactProtocol](https://baileys.wiki/docs/api/classes/USyncContactProtocol)
  * [Constructors](https://baileys.wiki/docs/api/classes/MessageRetryManager/#constructors)
    * [new MessageRetryManager()](https://baileys.wiki/docs/api/classes/MessageRetryManager/#new-messageretrymanager)
  * [Methods](https://baileys.wiki/docs/api/classes/MessageRetryManager/#methods)
    * [addRecentMessage()](https://baileys.wiki/docs/api/classes/MessageRetryManager/#addrecentmessage)
    * [cancelPendingPhoneRequest()](https://baileys.wiki/docs/api/classes/MessageRetryManager/#cancelpendingphonerequest)
    * [getRecentMessage()](https://baileys.wiki/docs/api/classes/MessageRetryManager/#getrecentmessage)
    * [getRetryCount()](https://baileys.wiki/docs/api/classes/MessageRetryManager/#getretrycount)
    * [hasExceededMaxRetries()](https://baileys.wiki/docs/api/classes/MessageRetryManager/#hasexceededmaxretries)
    * [incrementRetryCount()](https://baileys.wiki/docs/api/classes/MessageRetryManager/#incrementretrycount)
    * [markRetryFailed()](https://baileys.wiki/docs/api/classes/MessageRetryManager/#markretryfailed)
    * [markRetrySuccess()](https://baileys.wiki/docs/api/classes/MessageRetryManager/#markretrysuccess)
    * [schedulePhoneRequest()](https://baileys.wiki/docs/api/classes/MessageRetryManager/#schedulephonerequest)
    * [shouldRecreateSession()](https://baileys.wiki/docs/api/classes/MessageRetryManager/#shouldrecreatesession)


Docs
  * [Tutorial](https://baileys.wiki/docs/intro)


More
  * [GitHub](https://github.com/WhiskeySockets/Baileys)


![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)
Copyright © 2025 Rajeh Taher, WhiskeySockets.
