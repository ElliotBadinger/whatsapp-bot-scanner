# Source: https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore

<!-- Scraped from https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore -->

[Skip to main content](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#__docusaurus_skipToContent_fallback)
[ ![WhiskeySo ckets Logo](https://baileys.wiki/img/WhiskeySockets-colorful.png)![WhiskeySo ckets Logo](https://baileys.wiki/img/WhiskeySockets-colorful.png) **Baileys**](https://baileys.wiki/)[Docs](https://baileys.wiki/docs/intro)[API Reference](https://baileys.wiki/docs/api/classes/BinaryInfo)
[Sponsor](https://purpshell.dev/sponsor "Sponsor")[Discord](https://whiskey.so/discord "Discord")[GitHub](https://github.com/WhiskeySockets/Baileys "GitHub")
  * [classes](https://baileys.wiki/docs/api/classes/BinaryInfo)
  * [enumerations](https://baileys.wiki/docs/api/enumerations/DisconnectReason)
  * [functions](https://baileys.wiki/docs/api/functions/addTransactionCapability)
  * [baileys](https://baileys.wiki/docs/api/)
  * [interfaces](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter)
    * [Interface: BaileysEventEmitter](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter)
    * [Interface: Contact](https://baileys.wiki/docs/api/interfaces/Contact)
    * [Interface: GroupMetadata](https://baileys.wiki/docs/api/interfaces/GroupMetadata)
    * [Interface: GroupModificationResponse](https://baileys.wiki/docs/api/interfaces/GroupModificationResponse)
    * [Interface: NewsletterCreateResponse](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse)
    * [Interface: NewsletterMetadata](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata)
    * [Interface: PresenceData](https://baileys.wiki/docs/api/interfaces/PresenceData)
    * [Interface: RecentMessage](https://baileys.wiki/docs/api/interfaces/RecentMessage)
    * [Interface: RecentMessageKey](https://baileys.wiki/docs/api/interfaces/RecentMessageKey)
    * [Interface: RetryCounter](https://baileys.wiki/docs/api/interfaces/RetryCounter)
    * [Interface: RetryStatistics](https://baileys.wiki/docs/api/interfaces/RetryStatistics)
    * [Interface: SessionRecreateHistory](https://baileys.wiki/docs/api/interfaces/SessionRecreateHistory)
    * [Interface: SignalRepositoryWithLIDStore](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore)
    * [Interface: WAGroupCreateResponse](https://baileys.wiki/docs/api/interfaces/WAGroupCreateResponse)
    * [Interface: WAUrlInfo](https://baileys.wiki/docs/api/interfaces/WAUrlInfo)
  * [namespaces](https://baileys.wiki/docs/api/namespaces/proto/)
  * [type-aliases](https://baileys.wiki/docs/api/type-aliases/AccountSettings)
  * [variables](https://baileys.wiki/docs/api/variables/ALL_WA_PATCH_NAMES)


  * [](https://baileys.wiki/)
  * interfaces
  * Interface: SignalRepositoryWithLIDStore


On this page
# Interface: SignalRepositoryWithLIDStore
Defined in: [src/Types/Signal.ts:74](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Signal.ts#L74)
## Extends[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#extends "Direct link to Extends")
  * [`SignalRepository`](https://baileys.wiki/docs/api/type-aliases/SignalRepository)


## Properties[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#properties "Direct link to Properties")
### lidMapping[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#lidmapping "Direct link to lidMapping")
> **lidMapping** : `LIDMappingStore`
Defined in: [src/Types/Signal.ts:75](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Signal.ts#L75)
## Methods[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#methods "Direct link to Methods")
### decryptGroupMessage()[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#decryptgroupmessage "Direct link to decryptGroupMessage\(\)")
> **decryptGroupMessage**(`opts`): `Promise`<`Uint8Array`<`ArrayBufferLike`>>
Defined in: [src/Types/Signal.ts:54](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Signal.ts#L54)
#### Parameters[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#parameters "Direct link to Parameters")
##### opts[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#opts "Direct link to opts")
`DecryptGroupSignalOpts`
#### Returns[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#returns "Direct link to Returns")
`Promise`<`Uint8Array`<`ArrayBufferLike`>>
#### Inherited from[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#inherited-from "Direct link to Inherited from")
`SignalRepository.decryptGroupMessage`
* * *
### decryptMessage()[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#decryptmessage "Direct link to decryptMessage\(\)")
> **decryptMessage**(`opts`): `Promise`<`Uint8Array`<`ArrayBufferLike`>>
Defined in: [src/Types/Signal.ts:56](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Signal.ts#L56)
#### Parameters[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#parameters-1 "Direct link to Parameters")
##### opts[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#opts-1 "Direct link to opts")
`DecryptSignalProtoOpts`
#### Returns[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#returns-1 "Direct link to Returns")
`Promise`<`Uint8Array`<`ArrayBufferLike`>>
#### Inherited from[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#inherited-from-1 "Direct link to Inherited from")
`SignalRepository.decryptMessage`
* * *
### deleteSession()[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#deletesession "Direct link to deleteSession\(\)")
> **deleteSession**(`jids`): `Promise`<`void`>
Defined in: [src/Types/Signal.ts:70](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Signal.ts#L70)
#### Parameters[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#parameters-2 "Direct link to Parameters")
##### jids[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#jids "Direct link to jids")
`string`[]
#### Returns[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#returns-2 "Direct link to Returns")
`Promise`<`void`>
#### Inherited from[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#inherited-from-2 "Direct link to Inherited from")
`SignalRepository.deleteSession`
* * *
### encryptGroupMessage()[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#encryptgroupmessage "Direct link to encryptGroupMessage\(\)")
> **encryptGroupMessage**(`opts`): `Promise`<{ `ciphertext`: `Uint8Array`; `senderKeyDistributionMessage`: `Uint8Array`; }>
Defined in: [src/Types/Signal.ts:61](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Signal.ts#L61)
#### Parameters[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#parameters-3 "Direct link to Parameters")
##### opts[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#opts-2 "Direct link to opts")
`EncryptGroupMessageOpts`
#### Returns[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#returns-3 "Direct link to Returns")
`Promise`<{ `ciphertext`: `Uint8Array`; `senderKeyDistributionMessage`: `Uint8Array`; }>
#### Inherited from[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#inherited-from-3 "Direct link to Inherited from")
`SignalRepository.encryptGroupMessage`
* * *
### encryptMessage()[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#encryptmessage "Direct link to encryptMessage\(\)")
> **encryptMessage**(`opts`): `Promise`<{ `ciphertext`: `Uint8Array`; `type`: `"msg"` | `"pkmsg"`; }>
Defined in: [src/Types/Signal.ts:57](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Signal.ts#L57)
#### Parameters[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#parameters-4 "Direct link to Parameters")
##### opts[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#opts-3 "Direct link to opts")
`EncryptMessageOpts`
#### Returns[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#returns-4 "Direct link to Returns")
`Promise`<{ `ciphertext`: `Uint8Array`; `type`: `"msg"` | `"pkmsg"`; }>
#### Inherited from[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#inherited-from-4 "Direct link to Inherited from")
`SignalRepository.encryptMessage`
* * *
### injectE2ESession()[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#injecte2esession "Direct link to injectE2ESession\(\)")
> **injectE2ESession**(`opts`): `Promise`<`void`>
Defined in: [src/Types/Signal.ts:65](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Signal.ts#L65)
#### Parameters[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#parameters-5 "Direct link to Parameters")
##### opts[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#opts-4 "Direct link to opts")
`E2ESessionOpts`
#### Returns[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#returns-5 "Direct link to Returns")
`Promise`<`void`>
#### Inherited from[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#inherited-from-5 "Direct link to Inherited from")
`SignalRepository.injectE2ESession`
* * *
### jidToSignalProtocolAddress()[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#jidtosignalprotocoladdress "Direct link to jidToSignalProtocolAddress\(\)")
> **jidToSignalProtocolAddress**(`jid`): `string`
Defined in: [src/Types/Signal.ts:67](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Signal.ts#L67)
#### Parameters[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#parameters-6 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#jid "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#returns-6 "Direct link to Returns")
`string`
#### Inherited from[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#inherited-from-6 "Direct link to Inherited from")
`SignalRepository.jidToSignalProtocolAddress`
* * *
### migrateSession()[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#migratesession "Direct link to migrateSession\(\)")
> **migrateSession**(`fromJid`, `toJid`): `Promise`<{ `migrated`: `number`; `skipped`: `number`; `total`: `number`; }>
Defined in: [src/Types/Signal.ts:68](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Signal.ts#L68)
#### Parameters[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#parameters-7 "Direct link to Parameters")
##### fromJid[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#fromjid "Direct link to fromJid")
`string`
##### toJid[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#tojid "Direct link to toJid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#returns-7 "Direct link to Returns")
`Promise`<{ `migrated`: `number`; `skipped`: `number`; `total`: `number`; }>
#### Inherited from[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#inherited-from-7 "Direct link to Inherited from")
`SignalRepository.migrateSession`
* * *
### processSenderKeyDistributionMessage()[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#processsenderkeydistributionmessage "Direct link to processSenderKeyDistributionMessage\(\)")
> **processSenderKeyDistributionMessage**(`opts`): `Promise`<`void`>
Defined in: [src/Types/Signal.ts:55](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Signal.ts#L55)
#### Parameters[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#parameters-8 "Direct link to Parameters")
##### opts[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#opts-5 "Direct link to opts")
`ProcessSenderKeyDistributionMessageOpts`
#### Returns[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#returns-8 "Direct link to Returns")
`Promise`<`void`>
#### Inherited from[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#inherited-from-8 "Direct link to Inherited from")
`SignalRepository.processSenderKeyDistributionMessage`
* * *
### validateSession()[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#validatesession "Direct link to validateSession\(\)")
#### Call Signature[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#call-signature "Direct link to Call Signature")
> **validateSession**(`jid`): `Promise`<{ `exists`: `boolean`; `reason`: `string`; }>
Defined in: [src/Types/Signal.ts:66](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Signal.ts#L66)
##### Parameters[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#parameters-9 "Direct link to Parameters")
###### jid[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#jid-1 "Direct link to jid")
`string`
##### Returns[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#returns-9 "Direct link to Returns")
`Promise`<{ `exists`: `boolean`; `reason`: `string`; }>
##### Inherited from[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#inherited-from-9 "Direct link to Inherited from")
`SignalRepository.validateSession`
#### Call Signature[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#call-signature-1 "Direct link to Call Signature")
> **validateSession**(`jid`): `Promise`<{ `exists`: `boolean`; `reason`: `string`; }>
Defined in: [src/Types/Signal.ts:69](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Signal.ts#L69)
##### Parameters[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#parameters-10 "Direct link to Parameters")
###### jid[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#jid-2 "Direct link to jid")
`string`
##### Returns[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#returns-10 "Direct link to Returns")
`Promise`<{ `exists`: `boolean`; `reason`: `string`; }>
##### Inherited from[​](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#inherited-from-10 "Direct link to Inherited from")
`SignalRepository.validateSession`
[](https://github.com/WhiskeySockets/baileys.wiki-site/tree/main/docs/api/interfaces/SignalRepositoryWithLIDStore.md)
[Previous Interface: SessionRecreateHistory](https://baileys.wiki/docs/api/interfaces/SessionRecreateHistory)[Next Interface: WAGroupCreateResponse](https://baileys.wiki/docs/api/interfaces/WAGroupCreateResponse)
  * [Extends](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#extends)
  * [Properties](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#properties)
    * [lidMapping](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#lidmapping)
  * [Methods](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#methods)
    * [decryptGroupMessage()](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#decryptgroupmessage)
    * [decryptMessage()](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#decryptmessage)
    * [deleteSession()](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#deletesession)
    * [encryptGroupMessage()](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#encryptgroupmessage)
    * [encryptMessage()](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#encryptmessage)
    * [injectE2ESession()](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#injecte2esession)
    * [jidToSignalProtocolAddress()](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#jidtosignalprotocoladdress)
    * [migrateSession()](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#migratesession)
    * [processSenderKeyDistributionMessage()](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#processsenderkeydistributionmessage)
    * [validateSession()](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore/#validatesession)


Docs
  * [Tutorial](https://baileys.wiki/docs/intro)


More
  * [GitHub](https://github.com/WhiskeySockets/Baileys)


![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)
Copyright © 2025 Rajeh Taher, WhiskeySockets.
