# Source: https://baileys.wiki/docs/api/interfaces/Contact

<!-- Scraped from https://baileys.wiki/docs/api/interfaces/Contact -->

[Skip to main content](https://baileys.wiki/docs/api/interfaces/Contact/#__docusaurus_skipToContent_fallback)
[![WhiskeySo ckets Logo](https://baileys.wiki/img/WhiskeySockets-colorful.png) **Baileys**](https://baileys.wiki/)[Docs](https://baileys.wiki/docs/intro)[API Reference](https://baileys.wiki/docs/api/classes/BinaryInfo)
[Sponsor](https://purpshell.dev/sponsor "Sponsor")[Discord](https://whiskey.so/discord "Discord")[GitHub](https://github.com/WhiskeySockets/Baileys "GitHub")
  * [classes](https://baileys.wiki/docs/api/interfaces/Contact/)
  * [enumerations](https://baileys.wiki/docs/api/interfaces/Contact/)
  * [functions](https://baileys.wiki/docs/api/interfaces/Contact/)
  * [baileys](https://baileys.wiki/docs/api/)
  * [interfaces](https://baileys.wiki/docs/api/interfaces/Contact/)
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
  * [namespaces](https://baileys.wiki/docs/api/interfaces/Contact/)
  * [type-aliases](https://baileys.wiki/docs/api/interfaces/Contact/)
  * [variables](https://baileys.wiki/docs/api/interfaces/Contact/)


  * [](https://baileys.wiki/)
  * interfaces
  * Interface: Contact


On this page
# Interface: Contact
Defined in: [src/Types/Contact.ts:1](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Types/Contact.ts#L1)
## Properties[​](https://baileys.wiki/docs/api/interfaces/Contact/#properties "Direct link to Properties")
### id[​](https://baileys.wiki/docs/api/interfaces/Contact/#id "Direct link to id")
> **id** : `string`
Defined in: [src/Types/Contact.ts:3](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Types/Contact.ts#L3)
ID either in lid or jid format (preferred) *
* * *
### imgUrl?[​](https://baileys.wiki/docs/api/interfaces/Contact/#imgurl "Direct link to imgUrl?")
> `optional` **imgUrl** : `null` | `string`
Defined in: [src/Types/Contact.ts:22](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Types/Contact.ts#L22)
Url of the profile picture of the contact
'changed' => if the profile picture has changed null => if the profile picture has not been set (default profile picture) any other string => url of the profile picture
* * *
### lid?[​](https://baileys.wiki/docs/api/interfaces/Contact/#lid "Direct link to lid?")
> `optional` **lid** : `string`
Defined in: [src/Types/Contact.ts:5](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Types/Contact.ts#L5)
ID in LID format (@lid) *
* * *
### name?[​](https://baileys.wiki/docs/api/interfaces/Contact/#name "Direct link to name?")
> `optional` **name** : `string`
Defined in: [src/Types/Contact.ts:9](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Types/Contact.ts#L9)
name of the contact, you have saved on your WA
* * *
### notify?[​](https://baileys.wiki/docs/api/interfaces/Contact/#notify "Direct link to notify?")
> `optional` **notify** : `string`
Defined in: [src/Types/Contact.ts:11](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Types/Contact.ts#L11)
name of the contact, the contact has set on their own on WA
* * *
### phoneNumber?[​](https://baileys.wiki/docs/api/interfaces/Contact/#phonenumber "Direct link to phoneNumber?")
> `optional` **phoneNumber** : `string`
Defined in: [src/Types/Contact.ts:7](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Types/Contact.ts#L7)
ID in PN format (@s.whatsapp.net) *
* * *
### status?[​](https://baileys.wiki/docs/api/interfaces/Contact/#status "Direct link to status?")
> `optional` **status** : `string`
Defined in: [src/Types/Contact.ts:23](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Types/Contact.ts#L23)
* * *
### verifiedName?[​](https://baileys.wiki/docs/api/interfaces/Contact/#verifiedname "Direct link to verifiedName?")
> `optional` **verifiedName** : `string`
Defined in: [src/Types/Contact.ts:13](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Types/Contact.ts#L13)
I have no idea
[](https://github.com/WhiskeySockets/baileys.wiki-site/tree/main/docs/api/interfaces/Contact.md)
[Previous Interface: BaileysEventEmitter](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter)[Next Interface: GroupMetadata](https://baileys.wiki/docs/api/interfaces/GroupMetadata)
  * [Properties](https://baileys.wiki/docs/api/interfaces/Contact/#properties)
    * [id](https://baileys.wiki/docs/api/interfaces/Contact/#id)
    * [imgUrl?](https://baileys.wiki/docs/api/interfaces/Contact/#imgurl)
    * [lid?](https://baileys.wiki/docs/api/interfaces/Contact/#lid)
    * [name?](https://baileys.wiki/docs/api/interfaces/Contact/#name)
    * [notify?](https://baileys.wiki/docs/api/interfaces/Contact/#notify)
    * [phoneNumber?](https://baileys.wiki/docs/api/interfaces/Contact/#phonenumber)
    * [status?](https://baileys.wiki/docs/api/interfaces/Contact/#status)
    * [verifiedName?](https://baileys.wiki/docs/api/interfaces/Contact/#verifiedname)


Docs
  * [Tutorial](https://baileys.wiki/docs/intro)


More
  * [GitHub](https://github.com/WhiskeySockets/Baileys)


![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)
Copyright © 2025 Rajeh Taher, WhiskeySockets.
