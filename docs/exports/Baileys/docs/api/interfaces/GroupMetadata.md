# Source: https://baileys.wiki/docs/api/interfaces/GroupMetadata

<!-- Scraped from https://baileys.wiki/docs/api/interfaces/GroupMetadata -->

[Skip to main content](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#__docusaurus_skipToContent_fallback)
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
  * Interface: GroupMetadata


On this page
# Interface: GroupMetadata
Defined in: [src/Types/GroupMetadata.ts:16](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L16)
## Properties[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#properties "Direct link to Properties")
### addressingMode?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#addressingmode "Direct link to addressingMode?")
> `optional` **addressingMode** : [`WAMessageAddressingMode`](https://baileys.wiki/docs/api/enumerations/WAMessageAddressingMode)
Defined in: [src/Types/GroupMetadata.ts:20](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L20)
group uses 'lid' or 'pn' to send messages
* * *
### announce?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#announce "Direct link to announce?")
> `optional` **announce** : `boolean`
Defined in: [src/Types/GroupMetadata.ts:41](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L41)
is set when the group only allows admins to write messages
* * *
### author?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#author "Direct link to author?")
> `optional` **author** : `string`
Defined in: [src/Types/GroupMetadata.ts:57](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L57)
the person who added you to group or changed some setting in group
* * *
### authorPn?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#authorpn "Direct link to authorPn?")
> `optional` **authorPn** : `string`
Defined in: [src/Types/GroupMetadata.ts:58](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L58)
* * *
### creation?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#creation "Direct link to creation?")
> `optional` **creation** : `number`
Defined in: [src/Types/GroupMetadata.ts:30](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L30)
* * *
### desc?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#desc "Direct link to desc?")
> `optional` **desc** : `string`
Defined in: [src/Types/GroupMetadata.ts:31](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L31)
* * *
### descId?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#descid "Direct link to descId?")
> `optional` **descId** : `string`
Defined in: [src/Types/GroupMetadata.ts:34](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L34)
* * *
### descOwner?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#descowner "Direct link to descOwner?")
> `optional` **descOwner** : `string`
Defined in: [src/Types/GroupMetadata.ts:32](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L32)
* * *
### descOwnerPn?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#descownerpn "Direct link to descOwnerPn?")
> `optional` **descOwnerPn** : `string`
Defined in: [src/Types/GroupMetadata.ts:33](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L33)
* * *
### descTime?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#desctime "Direct link to descTime?")
> `optional` **descTime** : `number`
Defined in: [src/Types/GroupMetadata.ts:35](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L35)
* * *
### ephemeralDuration?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#ephemeralduration "Direct link to ephemeralDuration?")
> `optional` **ephemeralDuration** : `number`
Defined in: [src/Types/GroupMetadata.ts:54](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L54)
* * *
### id[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#id "Direct link to id")
> **id** : `string`
Defined in: [src/Types/GroupMetadata.ts:17](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L17)
* * *
### inviteCode?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#invitecode "Direct link to inviteCode?")
> `optional` **inviteCode** : `string`
Defined in: [src/Types/GroupMetadata.ts:55](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L55)
* * *
### isCommunity?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#iscommunity "Direct link to isCommunity?")
> `optional` **isCommunity** : `boolean`
Defined in: [src/Types/GroupMetadata.ts:47](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L47)
is this a community
* * *
### isCommunityAnnounce?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#iscommunityannounce "Direct link to isCommunityAnnounce?")
> `optional` **isCommunityAnnounce** : `boolean`
Defined in: [src/Types/GroupMetadata.ts:49](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L49)
is this the announce of a community
* * *
### joinApprovalMode?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#joinapprovalmode "Direct link to joinApprovalMode?")
> `optional` **joinApprovalMode** : `boolean`
Defined in: [src/Types/GroupMetadata.ts:45](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L45)
Request approval to join the group
* * *
### linkedParent?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#linkedparent "Direct link to linkedParent?")
> `optional` **linkedParent** : `string`
Defined in: [src/Types/GroupMetadata.ts:37](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L37)
if this group is part of a community, it returns the jid of the community to which it belongs
* * *
### memberAddMode?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#memberaddmode "Direct link to memberAddMode?")
> `optional` **memberAddMode** : `boolean`
Defined in: [src/Types/GroupMetadata.ts:43](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L43)
is set when the group also allows members to add participants
* * *
### notify?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#notify "Direct link to notify?")
> `optional` **notify** : `string`
Defined in: [src/Types/GroupMetadata.ts:18](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L18)
* * *
### owner[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#owner "Direct link to owner")
> **owner** : `undefined` | `string`
Defined in: [src/Types/GroupMetadata.ts:21](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L21)
* * *
### owner_country_code?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#owner_country_code "Direct link to owner_country_code?")
> `optional` **owner_country_code** : `string`
Defined in: [src/Types/GroupMetadata.ts:23](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L23)
* * *
### ownerPn?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#ownerpn "Direct link to ownerPn?")
> `optional` **ownerPn** : `string`
Defined in: [src/Types/GroupMetadata.ts:22](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L22)
* * *
### participants[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#participants "Direct link to participants")
> **participants** : [`GroupParticipant`](https://baileys.wiki/docs/api/type-aliases/GroupParticipant)[]
Defined in: [src/Types/GroupMetadata.ts:53](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L53)
* * *
### restrict?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#restrict "Direct link to restrict?")
> `optional` **restrict** : `boolean`
Defined in: [src/Types/GroupMetadata.ts:39](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L39)
is set when the group only allows admins to change group settings
* * *
### size?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#size "Direct link to size?")
> `optional` **size** : `number`
Defined in: [src/Types/GroupMetadata.ts:51](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L51)
number of group participants
* * *
### subject[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#subject "Direct link to subject")
> **subject** : `string`
Defined in: [src/Types/GroupMetadata.ts:24](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L24)
* * *
### subjectOwner?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#subjectowner "Direct link to subjectOwner?")
> `optional` **subjectOwner** : `string`
Defined in: [src/Types/GroupMetadata.ts:26](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L26)
group subject owner
* * *
### subjectOwnerPn?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#subjectownerpn "Direct link to subjectOwnerPn?")
> `optional` **subjectOwnerPn** : `string`
Defined in: [src/Types/GroupMetadata.ts:27](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L27)
* * *
### subjectTime?[​](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#subjecttime "Direct link to subjectTime?")
> `optional` **subjectTime** : `number`
Defined in: [src/Types/GroupMetadata.ts:29](https://github.com/WhiskeySockets/Baileys/blob/cb8b3717aaede47460ba700651ee936f268c0ce4/src/Types/GroupMetadata.ts#L29)
group subject modification date
[](https://github.com/WhiskeySockets/baileys.wiki-site/tree/main/docs/api/interfaces/GroupMetadata.md)
[Previous Interface: Contact](https://baileys.wiki/docs/api/interfaces/Contact)[Next Interface: GroupModificationResponse](https://baileys.wiki/docs/api/interfaces/GroupModificationResponse)
  * [Properties](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#properties)
    * [addressingMode?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#addressingmode)
    * [announce?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#announce)
    * [author?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#author)
    * [authorPn?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#authorpn)
    * [creation?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#creation)
    * [desc?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#desc)
    * [descId?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#descid)
    * [descOwner?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#descowner)
    * [descOwnerPn?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#descownerpn)
    * [descTime?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#desctime)
    * [ephemeralDuration?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#ephemeralduration)
    * [id](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#id)
    * [inviteCode?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#invitecode)
    * [isCommunity?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#iscommunity)
    * [isCommunityAnnounce?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#iscommunityannounce)
    * [joinApprovalMode?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#joinapprovalmode)
    * [linkedParent?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#linkedparent)
    * [memberAddMode?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#memberaddmode)
    * [notify?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#notify)
    * [owner](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#owner)
    * [owner_country_code?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#owner_country_code)
    * [ownerPn?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#ownerpn)
    * [participants](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#participants)
    * [restrict?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#restrict)
    * [size?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#size)
    * [subject](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#subject)
    * [subjectOwner?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#subjectowner)
    * [subjectOwnerPn?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#subjectownerpn)
    * [subjectTime?](https://baileys.wiki/docs/api/interfaces/GroupMetadata/#subjecttime)


Docs
  * [Tutorial](https://baileys.wiki/docs/intro)


More
  * [GitHub](https://github.com/WhiskeySockets/Baileys)


![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)
Copyright © 2025 Rajeh Taher, WhiskeySockets.
