# Source: https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse

<!-- Scraped from https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse -->

[Skip to main content](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#__docusaurus_skipToContent_fallback)
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
  * Interface: NewsletterCreateResponse


On this page
# Interface: NewsletterCreateResponse
Defined in: [src/Types/Newsletter.ts:34](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Newsletter.ts#L34)
## Properties[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#properties "Direct link to Properties")
### id[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#id "Direct link to id")
> **id** : `string`
Defined in: [src/Types/Newsletter.ts:35](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Newsletter.ts#L35)
* * *
### state[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#state "Direct link to state")
> **state** : `object`
Defined in: [src/Types/Newsletter.ts:36](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Newsletter.ts#L36)
#### type[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#type "Direct link to type")
> **type** : `string`
* * *
### thread_metadata[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#thread_metadata "Direct link to thread_metadata")
> **thread_metadata** : `object`
Defined in: [src/Types/Newsletter.ts:37](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Newsletter.ts#L37)
#### creation_time[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#creation_time "Direct link to creation_time")
> **creation_time** : `string`
#### description[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#description "Direct link to description")
> **description** : `object`
##### description.id[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#descriptionid "Direct link to description.id")
> **id** : `string`
##### description.text[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#descriptiontext "Direct link to description.text")
> **text** : `string`
##### description.update_time[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#descriptionupdate_time "Direct link to description.update_time")
> **update_time** : `string`
#### handle[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#handle "Direct link to handle")
> **handle** : `null` | `string`
#### invite[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#invite "Direct link to invite")
> **invite** : `string`
#### name[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#name "Direct link to name")
> **name** : `object`
##### name.id[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#nameid "Direct link to name.id")
> **id** : `string`
##### name.text[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#nametext "Direct link to name.text")
> **text** : `string`
##### name.update_time[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#nameupdate_time "Direct link to name.update_time")
> **update_time** : `string`
#### picture[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#picture "Direct link to picture")
> **picture** : `object`
##### picture.direct_path[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#picturedirect_path "Direct link to picture.direct_path")
> **direct_path** : `string`
##### picture.id[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#pictureid "Direct link to picture.id")
> **id** : `string`
##### picture.type[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#picturetype "Direct link to picture.type")
> **type** : `string`
#### preview[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#preview "Direct link to preview")
> **preview** : `object`
##### preview.direct_path[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#previewdirect_path "Direct link to preview.direct_path")
> **direct_path** : `string`
##### preview.id[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#previewid "Direct link to preview.id")
> **id** : `string`
##### preview.type[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#previewtype "Direct link to preview.type")
> **type** : `string`
#### subscribers_count[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#subscribers_count "Direct link to subscribers_count")
> **subscribers_count** : `string`
#### verification[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#verification "Direct link to verification")
> **verification** : `"VERIFIED"` | `"UNVERIFIED"`
* * *
### viewer_metadata[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#viewer_metadata "Direct link to viewer_metadata")
> **viewer_metadata** : `object`
Defined in: [src/Types/Newsletter.ts:48](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/Newsletter.ts#L48)
#### mute[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#mute "Direct link to mute")
> **mute** : `"ON"` | `"OFF"`
#### role[​](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#role "Direct link to role")
> **role** : [`NewsletterViewRole`](https://baileys.wiki/docs/api/type-aliases/NewsletterViewRole)
[](https://github.com/WhiskeySockets/baileys.wiki-site/tree/main/docs/api/interfaces/NewsletterCreateResponse.md)
[Previous Interface: GroupModificationResponse](https://baileys.wiki/docs/api/interfaces/GroupModificationResponse)[Next Interface: NewsletterMetadata](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata)
  * [Properties](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#properties)
    * [id](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#id)
    * [state](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#state)
    * [thread_metadata](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#thread_metadata)
    * [viewer_metadata](https://baileys.wiki/docs/api/interfaces/NewsletterCreateResponse/#viewer_metadata)


Docs
  * [Tutorial](https://baileys.wiki/docs/intro)


More
  * [GitHub](https://github.com/WhiskeySockets/Baileys)


![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)
Copyright © 2025 Rajeh Taher, WhiskeySockets.
