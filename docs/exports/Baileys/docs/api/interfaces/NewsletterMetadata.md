# Source: https://baileys.wiki/docs/api/interfaces/NewsletterMetadata

<!-- Scraped from https://baileys.wiki/docs/api/interfaces/NewsletterMetadata -->

[Skip to main content](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#__docusaurus_skipToContent_fallback)
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
  * Interface: NewsletterMetadata


On this page
# Interface: NewsletterMetadata
Defined in: [src/Types/Newsletter.ts:73](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Types/Newsletter.ts#L73)
## Properties[​](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#properties "Direct link to Properties")
### creation_time?[​](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#creation_time "Direct link to creation_time?")
> `optional` **creation_time** : `number`
Defined in: [src/Types/Newsletter.ts:79](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Types/Newsletter.ts#L79)
* * *
### description?[​](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#description "Direct link to description?")
> `optional` **description** : `string`
Defined in: [src/Types/Newsletter.ts:77](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Types/Newsletter.ts#L77)
* * *
### id[​](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#id "Direct link to id")
> **id** : `string`
Defined in: [src/Types/Newsletter.ts:74](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Types/Newsletter.ts#L74)
* * *
### invite?[​](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#invite "Direct link to invite?")
> `optional` **invite** : `string`
Defined in: [src/Types/Newsletter.ts:78](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Types/Newsletter.ts#L78)
* * *
### mute_state?[​](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#mute_state "Direct link to mute_state?")
> `optional` **mute_state** : `"ON"` | `"OFF"`
Defined in: [src/Types/Newsletter.ts:92](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Types/Newsletter.ts#L92)
* * *
### name[​](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#name "Direct link to name")
> **name** : `string`
Defined in: [src/Types/Newsletter.ts:76](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Types/Newsletter.ts#L76)
* * *
### owner?[​](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#owner "Direct link to owner?")
> `optional` **owner** : `string`
Defined in: [src/Types/Newsletter.ts:75](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Types/Newsletter.ts#L75)
* * *
### picture?[​](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#picture "Direct link to picture?")
> `optional` **picture** : `object`
Defined in: [src/Types/Newsletter.ts:81](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Types/Newsletter.ts#L81)
#### directPath?[​](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#directpath "Direct link to directPath?")
> `optional` **directPath** : `string`
#### id?[​](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#id-1 "Direct link to id?")
> `optional` **id** : `string`
#### mediaKey?[​](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#mediakey "Direct link to mediaKey?")
> `optional` **mediaKey** : `string`
#### url?[​](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#url "Direct link to url?")
> `optional` **url** : `string`
* * *
### reaction_codes?[​](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#reaction_codes "Direct link to reaction_codes?")
> `optional` **reaction_codes** : `object`[]
Defined in: [src/Types/Newsletter.ts:88](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Types/Newsletter.ts#L88)
#### code[​](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#code "Direct link to code")
> **code** : `string`
#### count[​](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#count "Direct link to count")
> **count** : `number`
* * *
### subscribers?[​](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#subscribers "Direct link to subscribers?")
> `optional` **subscribers** : `number`
Defined in: [src/Types/Newsletter.ts:80](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Types/Newsletter.ts#L80)
* * *
### thread_metadata?[​](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#thread_metadata "Direct link to thread_metadata?")
> `optional` **thread_metadata** : `object`
Defined in: [src/Types/Newsletter.ts:93](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Types/Newsletter.ts#L93)
#### creation_time?[​](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#creation_time-1 "Direct link to creation_time?")
> `optional` **creation_time** : `number`
#### description?[​](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#description-1 "Direct link to description?")
> `optional` **description** : `string`
#### name?[​](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#name-1 "Direct link to name?")
> `optional` **name** : `string`
* * *
### verification?[​](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#verification "Direct link to verification?")
> `optional` **verification** : `"VERIFIED"` | `"UNVERIFIED"`
Defined in: [src/Types/Newsletter.ts:87](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Types/Newsletter.ts#L87)
[](https://github.com/WhiskeySockets/baileys.wiki-site/tree/main/docs/api/interfaces/NewsletterMetadata.md)
[Previous Interface: NewsletterCreateResponse](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse)[Next Interface: PresenceData](https://baileys.wiki/docs/api/interfaces/PresenceData)
  * [Properties](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#properties)
    * [creation_time?](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#creation_time)
    * [description?](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#description)
    * [id](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#id)
    * [invite?](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#invite)
    * [mute_state?](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#mute_state)
    * [name](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#name)
    * [owner?](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#owner)
    * [picture?](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#picture)
    * [reaction_codes?](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#reaction_codes)
    * [subscribers?](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#subscribers)
    * [thread_metadata?](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#thread_metadata)
    * [verification?](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata/#verification)


Docs
  * [Tutorial](https://baileys.wiki/docs/intro)


More
  * [GitHub](https://github.com/WhiskeySockets/Baileys)


![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)
Copyright © 2025 Rajeh Taher, WhiskeySockets.
