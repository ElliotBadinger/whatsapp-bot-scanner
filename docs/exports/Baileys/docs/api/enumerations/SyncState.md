# Source: https://baileys.wiki/docs/api/enumerations/SyncState

<!-- Scraped from https://baileys.wiki/docs/api/enumerations/SyncState -->

[Skip to main content](https://baileys.wiki/docs/api/enumerations/SyncState/#__docusaurus_skipToContent_fallback)
[ ![WhiskeySo ckets Logo](https://baileys.wiki/img/WhiskeySockets-colorful.png)![WhiskeySo ckets Logo](https://baileys.wiki/img/WhiskeySockets-colorful.png) **Baileys**](https://baileys.wiki/)[Docs](https://baileys.wiki/docs/intro)[API Reference](https://baileys.wiki/docs/api/classes/BinaryInfo)
[Sponsor](https://purpshell.dev/sponsor "Sponsor")[Discord](https://whiskey.so/discord "Discord")[GitHub](https://github.com/WhiskeySockets/Baileys "GitHub")
  * [classes](https://baileys.wiki/docs/api/classes/BinaryInfo)
  * [enumerations](https://baileys.wiki/docs/api/enumerations/DisconnectReason)
    * [Enumeration: DisconnectReason](https://baileys.wiki/docs/api/enumerations/DisconnectReason)
    * [Enumeration: QueryIds](https://baileys.wiki/docs/api/enumerations/QueryIds)
    * [Enumeration: SyncState](https://baileys.wiki/docs/api/enumerations/SyncState)
    * [Enumeration: WAJIDDomains](https://baileys.wiki/docs/api/enumerations/WAJIDDomains)
    * [Enumeration: WAMessageAddressingMode](https://baileys.wiki/docs/api/enumerations/WAMessageAddressingMode)
    * [Enumeration: XWAPaths](https://baileys.wiki/docs/api/enumerations/XWAPaths)
  * [functions](https://baileys.wiki/docs/api/functions/addTransactionCapability)
  * [baileys](https://baileys.wiki/docs/api/)
  * [interfaces](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter)
  * [namespaces](https://baileys.wiki/docs/api/namespaces/proto/)
  * [type-aliases](https://baileys.wiki/docs/api/type-aliases/AccountSettings)
  * [variables](https://baileys.wiki/docs/api/variables/ALL_WA_PATCH_NAMES)


  * [](https://baileys.wiki/)
  * enumerations
  * Enumeration: SyncState


On this page
# Enumeration: SyncState
Defined in: [src/Types/State.ts:4](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/State.ts#L4)
## Enumeration Members[​](https://baileys.wiki/docs/api/enumerations/SyncState/#enumeration-members "Direct link to Enumeration Members")
### AwaitingInitialSync[​](https://baileys.wiki/docs/api/enumerations/SyncState/#awaitinginitialsync "Direct link to AwaitingInitialSync")
> **AwaitingInitialSync** : `1`
Defined in: [src/Types/State.ts:8](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/State.ts#L8)
Pending notifications received. Buffering events until we decide whether to sync or not.
* * *
### Connecting[​](https://baileys.wiki/docs/api/enumerations/SyncState/#connecting "Direct link to Connecting")
> **Connecting** : `0`
Defined in: [src/Types/State.ts:6](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/State.ts#L6)
The socket is connecting, but we haven't received pending notifications yet.
* * *
### Online[​](https://baileys.wiki/docs/api/enumerations/SyncState/#online "Direct link to Online")
> **Online** : `3`
Defined in: [src/Types/State.ts:12](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/State.ts#L12)
Initial sync is complete, or was skipped. The socket is fully operational and events are processed in real-time.
* * *
### Syncing[​](https://baileys.wiki/docs/api/enumerations/SyncState/#syncing "Direct link to Syncing")
> **Syncing** : `2`
Defined in: [src/Types/State.ts:10](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/State.ts#L10)
The initial app state sync (history, etc.) is in progress. Buffering continues.
[](https://github.com/WhiskeySockets/baileys.wiki-site/tree/main/docs/api/enumerations/SyncState.md)
[Previous Enumeration: QueryIds](https://baileys.wiki/docs/api/enumerations/QueryIds)[Next Enumeration: WAJIDDomains](https://baileys.wiki/docs/api/enumerations/WAJIDDomains)
  * [Enumeration Members](https://baileys.wiki/docs/api/enumerations/SyncState/#enumeration-members)
    * [AwaitingInitialSync](https://baileys.wiki/docs/api/enumerations/SyncState/#awaitinginitialsync)
    * [Connecting](https://baileys.wiki/docs/api/enumerations/SyncState/#connecting)
    * [Online](https://baileys.wiki/docs/api/enumerations/SyncState/#online)
    * [Syncing](https://baileys.wiki/docs/api/enumerations/SyncState/#syncing)


Docs
  * [Tutorial](https://baileys.wiki/docs/intro)


More
  * [GitHub](https://github.com/WhiskeySockets/Baileys)


![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)
Copyright © 2025 Rajeh Taher, WhiskeySockets.
