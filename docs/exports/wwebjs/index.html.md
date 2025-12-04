---
source: https://docs.wwebjs.dev/index.html
captured_at: 2025-10-23T16:01:31.746Z
---

[whatsapp-web.js 1.34.1](index.html)

# whatsapp-web.js 1.34.1

[![WWebJS Website](https://github.com/wwebjs/logos/blob/main/4_Full%20Logo%20Lockup_Small/small_banner_blue.png?raw=true "whatsapp-web.js")](https://wwebjs.dev)

[![npm](https://img.shields.io/npm/v/whatsapp-web.js.svg)](https://www.npmjs.com/package/whatsapp-web.js) [![Depfu](https://badges.depfu.com/badges/4a65a0de96ece65fdf39e294e0c8dcba/overview.svg)](https://depfu.com/github/pedroslopez/whatsapp-web.js?project_id=9765) ![WhatsApp_Web 2.2346.52](https://img.shields.io/badge/WhatsApp_Web-2.3000.1017054665-brightgreen.svg) [![Discord server](https://img.shields.io/discord/698610475432411196.svg?logo=discord)](https://discord.gg/H7DqQs4)

## About

**A WhatsApp API client that connects through the WhatsApp Web browser app**

The library works by launching the WhatsApp Web browser application and managing it using Puppeteer to create an instance of WhatsApp Web, thereby mitigating the risk of being blocked. The WhatsApp API client connects through the WhatsApp Web browser app, accessing its internal functions. This grants you access to nearly all the features available on WhatsApp Web, enabling dynamic handling similar to any other Node.js application.

> \[!IMPORTANT\] **It is not guaranteed you will not be blocked by using this method. WhatsApp does not allow bots or unofficial clients on their platform, so this shouldn't be considered totally safe.**

## Links

- [Website](https://wwebjs.dev)
- [Guide](https://guide.wwebjs.dev/guide) ([source](https://github.com/wwebjs/wwebjs.dev/tree/main)) _(work in progress)_
- [Documentation](https://docs.wwebjs.dev/) ([source](https://github.com/pedroslopez/whatsapp-web.js/tree/main/docs))
- [WWebJS Discord](https://discord.gg/H7DqQs4)
- [GitHub](https://github.com/pedroslopez/whatsapp-web.js)
- [npm](https://npmjs.org/package/whatsapp-web.js)

## Installation

The module is now available on npm! `npm i whatsapp-web.js`

> \[!NOTE\] **Node `v18+` is required.**

## QUICK STEPS TO UPGRADE NODE

### Windows

#### Manual

Just get the latest LTS from the [official node website](https://nodejs.org/en/download/).

#### npm

```
sudo npm install -g n
sudo n stable
```

#### Choco

```
choco install nodejs-lts
```

#### Winget

```
winget install OpenJS.NodeJS.LTS
```

### Ubuntu / Debian

```
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - &&\
sudo apt-get install -y nodejs
```

## Example usage

```
const { Client } = require('whatsapp-web.js');

const client = new Client();

client.on('qr', (qr) => {
    // Generate and scan this code with your phone
    console.log('QR RECEIVED', qr);
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', msg => {
    if (msg.body == '!ping') {
        msg.reply('pong');
    }
});

client.initialize();
```

Take a look at [example.js](https://github.com/pedroslopez/whatsapp-web.js/blob/master/example.js) for another examples with additional use cases.  
For further details on saving and restoring sessions, explore the provided [Authentication Strategies](https://wwebjs.dev/guide/creating-your-bot/authentication.html).

## Supported features

Feature

Status

Multi Device

✅

Send messages

✅

Receive messages

✅

Send media (images/audio/documents)

✅

Send media (video)

✅ [(requires Google Chrome)](https://wwebjs.dev/guide/creating-your-bot/handling-attachments.html#caveat-for-sending-videos-and-gifs)

Send stickers

✅

Receive media (images/audio/video/documents)

✅

Send contact cards

✅

Send location

✅

Send buttons

❌ [(DEPRECATED)](https://www.youtube.com/watch?v=hv1R1rLeVVE)

Send lists

❌ [(DEPRECATED)](https://www.youtube.com/watch?v=hv1R1rLeVVE)

Receive location

✅

Message replies

✅

Join groups by invite

✅

Get invite for group

✅

Modify group info (subject, description)

✅

Modify group settings (send messages, edit info)

✅

Add group participants

✅

Kick group participants

✅

Promote/demote group participants

✅

Mention users

✅

Mention groups

✅

Mute/unmute chats

✅

Block/unblock contacts

✅

Get contact info

✅

Get profile pictures

✅

Set user status message

✅

React to messages

✅

Create polls

✅

Channels

✅

Vote in polls

🔜

Communities

🔜

Something missing? Make an issue and let us know!

## Contributing

Feel free to open pull requests; we welcome contributions! However, for significant changes, it's best to open an issue beforehand. Make sure to review our [contribution guidelines](https://github.com/pedroslopez/whatsapp-web.js/blob/main/CODE_OF_CONDUCT.md) before creating a pull request. Before creating your own issue or pull request, always check to see if one already exists!

## Supporting the project

You can support the maintainer of this project through the links below

- [Support via GitHub Sponsors](https://github.com/sponsors/pedroslopez)
- [Support via PayPal](https://www.paypal.me/psla/)
- [Sign up for DigitalOcean](https://m.do.co/c/73f906a36ed4) and get $200 in credit when you sign up (Referral)

## Disclaimer

This project is not affiliated, associated, authorized, endorsed by, or in any way officially connected with WhatsApp or any of its subsidiaries or its affiliates. The official WhatsApp website can be found at [whatsapp.com](https://whatsapp.com). "WhatsApp" as well as related names, marks, emblems and images are registered trademarks of their respective owners. Also it is not guaranteed you will not be blocked by using this method. WhatsApp does not allow bots or unofficial clients on their platform, so this shouldn't be considered totally safe.

## License

Copyright 2019 Pedro S Lopez

Licensed under the Apache License, Version 2.0 (the "License");  
you may not use this project except in compliance with the License.  
You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.

Unless required by applicable law or agreed to in writing, software  
distributed under the License is distributed on an "AS IS" BASIS,  
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  
See the License for the specific language governing permissions and  
limitations under the License.

## Base

[Base()](Base.html)

## BaseAuthStrategy

[BaseAuthStrategy()](BaseAuthStrategy.html)

## Broadcast

[Broadcast()](Broadcast.html)

[Broadcast#getChat()](Broadcast.html#getChat)

[Broadcast#getContact()](Broadcast.html#getContact)

[Broadcast#id](Broadcast.html#id)

[Broadcast#msgs](Broadcast.html#msgs)

[Broadcast#timestamp](Broadcast.html#timestamp)

[Broadcast#totalCount](Broadcast.html#totalCount)

[Broadcast#unreadCount](Broadcast.html#unreadCount)

## BusinessContact

[BusinessContact()](BusinessContact.html)

[BusinessContact#block()](BusinessContact.html#block)

[BusinessContact#businessProfile](BusinessContact.html#businessProfile)

[BusinessContact#getAbout()](BusinessContact.html#getAbout)

[BusinessContact#getChat()](BusinessContact.html#getChat)

[BusinessContact#getCommonGroups()](BusinessContact.html#getCommonGroups)

[BusinessContact#getCountryCode()](BusinessContact.html#getCountryCode)

[BusinessContact#getFormattedNumber()](BusinessContact.html#getFormattedNumber)

[BusinessContact#getProfilePicUrl()](BusinessContact.html#getProfilePicUrl)

[BusinessContact#id](BusinessContact.html#id)

[BusinessContact#isBlocked](BusinessContact.html#isBlocked)

[BusinessContact#isBusiness](BusinessContact.html#isBusiness)

[BusinessContact#isEnterprise](BusinessContact.html#isEnterprise)

[BusinessContact#isGroup](BusinessContact.html#isGroup)

[BusinessContact#isMe](BusinessContact.html#isMe)

[BusinessContact#isMyContact](BusinessContact.html#isMyContact)

[BusinessContact#isUser](BusinessContact.html#isUser)

[BusinessContact#isWAContact](BusinessContact.html#isWAContact)

[BusinessContact#name](BusinessContact.html#name)

[BusinessContact#number](BusinessContact.html#number)

[BusinessContact#pushname](BusinessContact.html#pushname)

[BusinessContact#shortName](BusinessContact.html#shortName)

[BusinessContact#unblock()](BusinessContact.html#unblock)

## Buttons

[Buttons(body, buttons, title, footer)](Buttons.html)

[Buttons#\_format(buttons)](Buttons.html#_format)

[Buttons#body](Buttons.html#body)

[Buttons#buttons](Buttons.html#buttons)

[Buttons#footer](Buttons.html#footer)

[Buttons#title](Buttons.html#title)

## Call

[Call()](Call.html)

[Call#canHandleLocally](Call.html#canHandleLocally)

[Call#from](Call.html#from)

[Call#fromMe](Call.html#fromMe)

[Call#id](Call.html#id)

[Call#isGroup](Call.html#isGroup)

[Call#isVideo](Call.html#isVideo)

[Call#participants](Call.html#participants)

[Call#reject()](Call.html#reject)

[Call#timestamp](Call.html#timestamp)

[Call#webClientShouldHandle](Call.html#webClientShouldHandle)

## Channel

[Channel()](Channel.html)

[Channel#\_muteUnmuteChannel(action)](Channel.html#_muteUnmuteChannel)

[Channel#\_setChannelMetadata(value, property)](Channel.html#_setChannelMetadata)

[Channel#acceptChannelAdminInvite()](Channel.html#acceptChannelAdminInvite)

[Channel#deleteChannel()](Channel.html#deleteChannel)

[Channel#demoteChannelAdmin(userId)](Channel.html#demoteChannelAdmin)

[Channel#description](Channel.html#description)

[Channel#fetchMessages(searchOptions)](Channel.html#fetchMessages)

[Channel#getSubscribers(limit)](Channel.html#getSubscribers)

[Channel#id](Channel.html#id)

[Channel#isChannel](Channel.html#isChannel)

[Channel#isGroup](Channel.html#isGroup)

[Channel#isMuted](Channel.html#isMuted)

[Channel#isReadOnly](Channel.html#isReadOnly)

[Channel#lastMessage](Channel.html#lastMessage)

[Channel#mute()](Channel.html#mute)

[Channel#muteExpiration](Channel.html#muteExpiration)

[Channel#name](Channel.html#name)

[Channel#revokeChannelAdminInvite(userId)](Channel.html#revokeChannelAdminInvite)

[Channel#sendChannelAdminInvite(chatId, options)](Channel.html#sendChannelAdminInvite)

[Channel#sendMessage(content, options)](Channel.html#sendMessage)

[Channel#sendSeen()](Channel.html#sendSeen)

[Channel#setDescription(newDescription)](Channel.html#setDescription)

[Channel#setProfilePicture(newProfilePicture)](Channel.html#setProfilePicture)

[Channel#setReactionSetting(reactionCode)](Channel.html#setReactionSetting)

[Channel#setSubject(newSubject)](Channel.html#setSubject)

[Channel#timestamp](Channel.html#timestamp)

[Channel#transferChannelOwnership(newOwnerId, options)](Channel.html#transferChannelOwnership)

[Channel#unmute()](Channel.html#unmute)

[Channel#unreadCount](Channel.html#unreadCount)

## Chat

[Chat()](Chat.html)

[Chat#archive()](Chat.html#archive)

[Chat#archived](Chat.html#archived)

[Chat#changeLabels(labelIds)](Chat.html#changeLabels)

[Chat#clearMessages()](Chat.html#clearMessages)

[Chat#clearState()](Chat.html#clearState)

[Chat#delete()](Chat.html#delete)

[Chat#fetchMessages(searchOptions)](Chat.html#fetchMessages)

[Chat#getContact()](Chat.html#getContact)

[Chat#getLabels()](Chat.html#getLabels)

[Chat#getPinnedMessages()](Chat.html#getPinnedMessages)

[Chat#id](Chat.html#id)

[Chat#isGroup](Chat.html#isGroup)

[Chat#isMuted](Chat.html#isMuted)

[Chat#isReadOnly](Chat.html#isReadOnly)

[Chat#lastMessage](Chat.html#lastMessage)

[Chat#markUnread()](Chat.html#markUnread)

[Chat#mute(unmuteDate)](Chat.html#mute)

[Chat#muteExpiration](Chat.html#muteExpiration)

[Chat#name](Chat.html#name)

[Chat#pin()](Chat.html#pin)

[Chat#pinned](Chat.html#pinned)

[Chat#sendMessage(content\[, options\])](Chat.html#sendMessage)

[Chat#sendSeen()](Chat.html#sendSeen)

[Chat#sendStateRecording()](Chat.html#sendStateRecording)

[Chat#sendStateTyping()](Chat.html#sendStateTyping)

[Chat#syncHistory()](Chat.html#syncHistory)

[Chat#timestamp](Chat.html#timestamp)

[Chat#unarchive()](Chat.html#unarchive)

[Chat#unmute()](Chat.html#unmute)

[Chat#unpin()](Chat.html#unpin)

[Chat#unreadCount](Chat.html#unreadCount)

## ChatTypes

[ChatTypes.GROUP](global.html#ChatTypes#.GROUP)

[ChatTypes.SOLO](global.html#ChatTypes#.SOLO)

[ChatTypes.UNKNOWN](global.html#ChatTypes#.UNKNOWN)

## Client

[Client(options)](Client.html)

[Client#\_muteUnmuteChat(chatId, action, unmuteDateTs)](Client.html#_muteUnmuteChat)

[Client#acceptChannelAdminInvite(channelId)](Client.html#acceptChannelAdminInvite)

[Client#acceptGroupV4Invite(inviteInfo)](Client.html#acceptGroupV4Invite)

[Client#acceptInvite(inviteCode)](Client.html#acceptInvite)

[Client#addOrRemoveLabels(labelIds, chatIds)](Client.html#addOrRemoveLabels)

[Client#approveGroupMembershipRequests(groupId, options)](Client.html#approveGroupMembershipRequests)

[Client#archiveChat()](Client.html#archiveChat)

[Client#attachEventListeners()](Client.html#attachEventListeners)

[Client#createCallLink(startTime, callType)](Client.html#createCallLink)

[Client#createChannel(title, options)](Client.html#createChannel)

[Client#createGroup(title, participants, options)](Client.html#createGroup)

[Client#deleteAddressbookContact(phoneNumber)](Client.html#deleteAddressbookContact)

[Client#deleteChannel(channelId)](Client.html#deleteChannel)

[Client#deleteProfilePicture()](Client.html#deleteProfilePicture)

[Client#demoteChannelAdmin(channelId, userId)](Client.html#demoteChannelAdmin)

[Client#destroy()](Client.html#destroy)

[Client#event:auth_failure](Client.html#event:auth_failure)

[Client#event:authenticated](Client.html#event:authenticated)

[Client#event:change_battery](Client.html#event:change_battery)

[Client#event:change_state](Client.html#event:change_state)

[Client#event:chat_archived](Client.html#event:chat_archived)

[Client#event:chat_removed](Client.html#event:chat_removed)

[Client#event:code](Client.html#event:code)

[Client#event:contact_changed](Client.html#event:contact_changed)

[Client#event:disconnected](Client.html#event:disconnected)

[Client#event:group_admin_changed](Client.html#event:group_admin_changed)

[Client#event:group_join](Client.html#event:group_join)

[Client#event:group_leave](Client.html#event:group_leave)

[Client#event:group_membership_request](Client.html#event:group_membership_request)

[Client#event:group_update](Client.html#event:group_update)

[Client#event:incoming_call](Client.html#event:incoming_call)

[Client#event:media_uploaded](Client.html#event:media_uploaded)

[Client#event:message](Client.html#event:message)

[Client#event:message_ack](Client.html#event:message_ack)

[Client#event:message_ciphertext](Client.html#event:message_ciphertext)

[Client#event:message_create](Client.html#event:message_create)

[Client#event:message_edit](Client.html#event:message_edit)

[Client#event:message_reaction](Client.html#event:message_reaction)

[Client#event:message_revoke_everyone](Client.html#event:message_revoke_everyone)

[Client#event:message_revoke_me](Client.html#event:message_revoke_me)

[Client#event:qr](Client.html#event:qr)

[Client#event:ready](Client.html#event:ready)

[Client#event:vote_update](Client.html#event:vote_update)

[Client#getBlockedContacts()](Client.html#getBlockedContacts)

[Client#getBroadcasts()](Client.html#getBroadcasts)

[Client#getChannelByInviteCode(inviteCode)](Client.html#getChannelByInviteCode)

[Client#getChannels()](Client.html#getChannels)

[Client#getChatById(chatId)](Client.html#getChatById)

[Client#getChatLabels(chatId)](Client.html#getChatLabels)

[Client#getChats()](Client.html#getChats)

[Client#getChatsByLabelId(labelId)](Client.html#getChatsByLabelId)

[Client#getCommonGroups(contactId)](Client.html#getCommonGroups)

[Client#getContactById(contactId)](Client.html#getContactById)

[Client#getContactDeviceCount(userId)](Client.html#getContactDeviceCount)

[Client#getContactLidAndPhone(userIds)](Client.html#getContactLidAndPhone)

[Client#getContacts()](Client.html#getContacts)

[Client#getCountryCode(number)](Client.html#getCountryCode)

[Client#getFormattedNumber(number)](Client.html#getFormattedNumber)

[Client#getGroupMembershipRequests(groupId)](Client.html#getGroupMembershipRequests)

[Client#getInviteInfo(inviteCode)](Client.html#getInviteInfo)

[Client#getLabelById(labelId)](Client.html#getLabelById)

[Client#getLabels()](Client.html#getLabels)

[Client#getNumberId(number)](Client.html#getNumberId)

[Client#getPinnedMessages(chatId)](Client.html#getPinnedMessages)

[Client#getProfilePicUrl(contactId)](Client.html#getProfilePicUrl)

[Client#getState()](Client.html#getState)

[Client#getWWebVersion()](Client.html#getWWebVersion)

[Client#info](Client.html#info)

[Client#initialize()](Client.html#initialize)

[Client#inject()](Client.html#inject)

[Client#isRegisteredUser(id)](Client.html#isRegisteredUser)

[Client#logout()](Client.html#logout)

[Client#markChatUnread(chatId)](Client.html#markChatUnread)

[Client#muteChat(chatId, unmuteDate)](Client.html#muteChat)

[Client#pinChat()](Client.html#pinChat)

[Client#pupBrowser](Client.html#pupBrowser)

[Client#pupPage](Client.html#pupPage)

[Client#rejectGroupMembershipRequests(groupId, options)](Client.html#rejectGroupMembershipRequests)

[Client#requestPairingCode(phoneNumber\[, showNotification\]\[, intervalMs\])](Client.html#requestPairingCode)

[Client#resetState()](Client.html#resetState)

[Client#revokeChannelAdminInvite(channelId, userId)](Client.html#revokeChannelAdminInvite)

[Client#saveOrEditAddressbookContact(phoneNumber, firstName, lastName\[, syncToAddressbook\])](Client.html#saveOrEditAddressbookContact)

[Client#searchChannels(searchOptions)](Client.html#searchChannels)

[Client#searchMessages(query\[, options\])](Client.html#searchMessages)

[Client#sendChannelAdminInvite(chatId, channelId, options)](Client.html#sendChannelAdminInvite)

[Client#sendMessage(chatId, content\[, options\])](Client.html#sendMessage)

[Client#sendPresenceAvailable()](Client.html#sendPresenceAvailable)

[Client#sendPresenceUnavailable()](Client.html#sendPresenceUnavailable)

[Client#sendResponseToScheduledEvent(response, eventMessageId)](Client.html#sendResponseToScheduledEvent)

[Client#sendSeen(chatId)](Client.html#sendSeen)

[Client#setAutoDownloadAudio(flag)](Client.html#setAutoDownloadAudio)

[Client#setAutoDownloadDocuments(flag)](Client.html#setAutoDownloadDocuments)

[Client#setAutoDownloadPhotos(flag)](Client.html#setAutoDownloadPhotos)

[Client#setAutoDownloadVideos(flag)](Client.html#setAutoDownloadVideos)

[Client#setBackgroundSync(flag)](Client.html#setBackgroundSync)

[Client#setDisplayName(displayName)](Client.html#setDisplayName)

[Client#setProfilePicture(media)](Client.html#setProfilePicture)

[Client#setStatus(status)](Client.html#setStatus)

[Client#subscribeToChannel(channelId)](Client.html#subscribeToChannel)

[Client#syncHistory(chatId)](Client.html#syncHistory)

[Client#transferChannelOwnership(channelId, newOwnerId, options)](Client.html#transferChannelOwnership)

[Client#unarchiveChat()](Client.html#unarchiveChat)

[Client#unmuteChat(chatId)](Client.html#unmuteChat)

[Client#unpinChat()](Client.html#unpinChat)

[Client#unsubscribeFromChannel(channelId, options)](Client.html#unsubscribeFromChannel)

## ClientInfo

[ClientInfo()](ClientInfo.html)

[ClientInfo#getBatteryStatus()](ClientInfo.html#getBatteryStatus)

[ClientInfo#me](ClientInfo.html#me)

[ClientInfo#phone](ClientInfo.html#phone)

[ClientInfo#platform](ClientInfo.html#platform)

[ClientInfo#pushname](ClientInfo.html#pushname)

[ClientInfo#wid](ClientInfo.html#wid)

## Contact

[Contact()](Contact.html)

[Contact#block()](Contact.html#block)

[Contact#getAbout()](Contact.html#getAbout)

[Contact#getChat()](Contact.html#getChat)

[Contact#getCommonGroups()](Contact.html#getCommonGroups)

[Contact#getCountryCode()](Contact.html#getCountryCode)

[Contact#getFormattedNumber()](Contact.html#getFormattedNumber)

[Contact#getProfilePicUrl()](Contact.html#getProfilePicUrl)

[Contact#id](Contact.html#id)

[Contact#isBlocked](Contact.html#isBlocked)

[Contact#isBusiness](Contact.html#isBusiness)

[Contact#isEnterprise](Contact.html#isEnterprise)

[Contact#isGroup](Contact.html#isGroup)

[Contact#isMe](Contact.html#isMe)

[Contact#isMyContact](Contact.html#isMyContact)

[Contact#isUser](Contact.html#isUser)

[Contact#isWAContact](Contact.html#isWAContact)

[Contact#name](Contact.html#name)

[Contact#number](Contact.html#number)

[Contact#pushname](Contact.html#pushname)

[Contact#shortName](Contact.html#shortName)

[Contact#unblock()](Contact.html#unblock)

## Events

[Events.AUTHENTICATED](global.html#Events#.AUTHENTICATED)

[Events.AUTHENTICATION_FAILURE](global.html#Events#.AUTHENTICATION_FAILURE)

[Events.BATTERY_CHANGED](global.html#Events#.BATTERY_CHANGED)

[Events.CHAT_ARCHIVED](global.html#Events#.CHAT_ARCHIVED)

[Events.CHAT_REMOVED](global.html#Events#.CHAT_REMOVED)

[Events.CODE_RECEIVED](global.html#Events#.CODE_RECEIVED)

[Events.CONTACT_CHANGED](global.html#Events#.CONTACT_CHANGED)

[Events.DISCONNECTED](global.html#Events#.DISCONNECTED)

[Events.GROUP_ADMIN_CHANGED](global.html#Events#.GROUP_ADMIN_CHANGED)

[Events.GROUP_JOIN](global.html#Events#.GROUP_JOIN)

[Events.GROUP_LEAVE](global.html#Events#.GROUP_LEAVE)

[Events.GROUP_MEMBERSHIP_REQUEST](global.html#Events#.GROUP_MEMBERSHIP_REQUEST)

[Events.GROUP_UPDATE](global.html#Events#.GROUP_UPDATE)

[Events.INCOMING_CALL](global.html#Events#.INCOMING_CALL)

[Events.LOADING_SCREEN](global.html#Events#.LOADING_SCREEN)

[Events.MEDIA_UPLOADED](global.html#Events#.MEDIA_UPLOADED)

[Events.MESSAGE_ACK](global.html#Events#.MESSAGE_ACK)

[Events.MESSAGE_CIPHERTEXT](global.html#Events#.MESSAGE_CIPHERTEXT)

[Events.MESSAGE_CREATE](global.html#Events#.MESSAGE_CREATE)

[Events.MESSAGE_EDIT](global.html#Events#.MESSAGE_EDIT)

[Events.MESSAGE_REACTION](global.html#Events#.MESSAGE_REACTION)

[Events.MESSAGE_RECEIVED](global.html#Events#.MESSAGE_RECEIVED)

[Events.MESSAGE_REVOKED_EVERYONE](global.html#Events#.MESSAGE_REVOKED_EVERYONE)

[Events.MESSAGE_REVOKED_ME](global.html#Events#.MESSAGE_REVOKED_ME)

[Events.QR_RECEIVED](global.html#Events#.QR_RECEIVED)

[Events.READY](global.html#Events#.READY)

[Events.REMOTE_SESSION_SAVED](global.html#Events#.REMOTE_SESSION_SAVED)

[Events.STATE_CHANGED](global.html#Events#.STATE_CHANGED)

[Events.UNREAD_COUNT](global.html#Events#.UNREAD_COUNT)

[Events.VOTE_UPDATE](global.html#Events#.VOTE_UPDATE)

## GroupChat

[GroupChat()](GroupChat.html)

[GroupChat#addParticipants(participantIds, options)](GroupChat.html#addParticipants)

[GroupChat#approveGroupMembershipRequests(options)](GroupChat.html#approveGroupMembershipRequests)

[GroupChat#archive()](GroupChat.html#archive)

[GroupChat#archived](GroupChat.html#archived)

[GroupChat#changeLabels(labelIds)](GroupChat.html#changeLabels)

[GroupChat#clearMessages()](GroupChat.html#clearMessages)

[GroupChat#clearState()](GroupChat.html#clearState)

[GroupChat#createdAt](GroupChat.html#createdAt)

[GroupChat#delete()](GroupChat.html#delete)

[GroupChat#deletePicture()](GroupChat.html#deletePicture)

[GroupChat#demoteParticipants(participantIds)](GroupChat.html#demoteParticipants)

[GroupChat#description](GroupChat.html#description)

[GroupChat#fetchMessages(searchOptions)](GroupChat.html#fetchMessages)

[GroupChat#getContact()](GroupChat.html#getContact)

[GroupChat#getGroupMembershipRequests()](GroupChat.html#getGroupMembershipRequests)

[GroupChat#getInviteCode()](GroupChat.html#getInviteCode)

[GroupChat#getLabels()](GroupChat.html#getLabels)

[GroupChat#getPinnedMessages()](GroupChat.html#getPinnedMessages)

[GroupChat#id](GroupChat.html#id)

[GroupChat#isGroup](GroupChat.html#isGroup)

[GroupChat#isMuted](GroupChat.html#isMuted)

[GroupChat#isReadOnly](GroupChat.html#isReadOnly)

[GroupChat#lastMessage](GroupChat.html#lastMessage)

[GroupChat#leave()](GroupChat.html#leave)

[GroupChat#markUnread()](GroupChat.html#markUnread)

[GroupChat#mute(unmuteDate)](GroupChat.html#mute)

[GroupChat#muteExpiration](GroupChat.html#muteExpiration)

[GroupChat#name](GroupChat.html#name)

[GroupChat#owner](GroupChat.html#owner)

[GroupChat#participants](GroupChat.html#participants)

[GroupChat#pin()](GroupChat.html#pin)

[GroupChat#pinned](GroupChat.html#pinned)

[GroupChat#promoteParticipants(participantIds)](GroupChat.html#promoteParticipants)

[GroupChat#rejectGroupMembershipRequests(options)](GroupChat.html#rejectGroupMembershipRequests)

[GroupChat#removeParticipants(participantIds)](GroupChat.html#removeParticipants)

[GroupChat#revokeInvite()](GroupChat.html#revokeInvite)

[GroupChat#sendMessage(content\[, options\])](GroupChat.html#sendMessage)

[GroupChat#sendSeen()](GroupChat.html#sendSeen)

[GroupChat#sendStateRecording()](GroupChat.html#sendStateRecording)

[GroupChat#sendStateTyping()](GroupChat.html#sendStateTyping)

[GroupChat#setAddMembersAdminsOnly(\[adminsOnly\])](GroupChat.html#setAddMembersAdminsOnly)

[GroupChat#setDescription(description)](GroupChat.html#setDescription)

[GroupChat#setInfoAdminsOnly(\[adminsOnly\])](GroupChat.html#setInfoAdminsOnly)

[GroupChat#setMessagesAdminsOnly(\[adminsOnly\])](GroupChat.html#setMessagesAdminsOnly)

[GroupChat#setPicture(media)](GroupChat.html#setPicture)

[GroupChat#setSubject(subject)](GroupChat.html#setSubject)

[GroupChat#syncHistory()](GroupChat.html#syncHistory)

[GroupChat#timestamp](GroupChat.html#timestamp)

[GroupChat#unarchive()](GroupChat.html#unarchive)

[GroupChat#unmute()](GroupChat.html#unmute)

[GroupChat#unpin()](GroupChat.html#unpin)

[GroupChat#unreadCount](GroupChat.html#unreadCount)

## GroupNotification

[GroupNotification()](GroupNotification.html)

[GroupNotification#author](GroupNotification.html#author)

[GroupNotification#body](GroupNotification.html#body)

[GroupNotification#chatId](GroupNotification.html#chatId)

[GroupNotification#getChat()](GroupNotification.html#getChat)

[GroupNotification#getContact()](GroupNotification.html#getContact)

[GroupNotification#getRecipients()](GroupNotification.html#getRecipients)

[GroupNotification#id](GroupNotification.html#id)

[GroupNotification#recipientIds](GroupNotification.html#recipientIds)

[GroupNotification#reply(content, options)](GroupNotification.html#reply)

[GroupNotification#timestamp](GroupNotification.html#timestamp)

[GroupNotification#type](GroupNotification.html#type)

## GroupNotificationTypes

[GroupNotificationTypes.ADD](global.html#GroupNotificationTypes#.ADD)

[GroupNotificationTypes.ANNOUNCE](global.html#GroupNotificationTypes#.ANNOUNCE)

[GroupNotificationTypes.DESCRIPTION](global.html#GroupNotificationTypes#.DESCRIPTION)

[GroupNotificationTypes.INVITE](global.html#GroupNotificationTypes#.INVITE)

[GroupNotificationTypes.LEAVE](global.html#GroupNotificationTypes#.LEAVE)

[GroupNotificationTypes.PICTURE](global.html#GroupNotificationTypes#.PICTURE)

[GroupNotificationTypes.REMOVE](global.html#GroupNotificationTypes#.REMOVE)

[GroupNotificationTypes.RESTRICT](global.html#GroupNotificationTypes#.RESTRICT)

[GroupNotificationTypes.SUBJECT](global.html#GroupNotificationTypes#.SUBJECT)

## InterfaceController

[InterfaceController()](InterfaceController.html)

[InterfaceController#checkFeatureStatus(feature)](InterfaceController.html#checkFeatureStatus)

[InterfaceController#closeRightDrawer()](InterfaceController.html#closeRightDrawer)

[InterfaceController#disableFeatures(features)](InterfaceController.html#disableFeatures)

[InterfaceController#enableFeatures(features)](InterfaceController.html#enableFeatures)

[InterfaceController#getFeatures()](InterfaceController.html#getFeatures)

[InterfaceController#openChatDrawer(chatId)](InterfaceController.html#openChatDrawer)

[InterfaceController#openChatSearch(chatId)](InterfaceController.html#openChatSearch)

[InterfaceController#openChatWindow(chatId)](InterfaceController.html#openChatWindow)

[InterfaceController#openChatWindowAt(msgId)](InterfaceController.html#openChatWindowAt)

[InterfaceController#openMessageDrawer(msgId)](InterfaceController.html#openMessageDrawer)

## Label

[Label(client, labelData)](Label.html)

[Label#getChats()](Label.html#getChats)

[Label#hexColor](Label.html#hexColor)

[Label#id](Label.html#id)

[Label#name](Label.html#name)

## List

[List(body, buttonText, sections, title, footer)](List.html)

[List#\_format(sections)](List.html#_format)

[List#buttonText](List.html#buttonText)

[List#description](List.html#description)

[List#footer](List.html#footer)

[List#sections](List.html#sections)

[List#title](List.html#title)

## LocalAuth

[LocalAuth(options)](LocalAuth.html)

## LocalWebCache

[LocalWebCache(options)](LocalWebCache.html)

## Location

[Location(latitude, longitude\[, options\])](Location.html)

[Location#address](Location.html#address)

[Location#description](Location.html#description)

[Location#latitude](Location.html#latitude)

[Location#longitude](Location.html#longitude)

[Location#name](Location.html#name)

[Location#url](Location.html#url)

## Message

[Message()](Message.html)

[Message#acceptGroupV4Invite()](Message.html#acceptGroupV4Invite)

[Message#ack](Message.html#ack)

[Message#author](Message.html#author)

[Message#body](Message.html#body)

[Message#broadcast](Message.html#broadcast)

[Message#delete(everyone\[, clearMedia\])](Message.html#delete)

[Message#deviceType](Message.html#deviceType)

[Message#downloadMedia()](Message.html#downloadMedia)

[Message#duration](Message.html#duration)

[Message#edit(content\[, options\])](Message.html#edit)

[Message#editScheduledEvent(editedEventObject)](Message.html#editScheduledEvent)

[Message#forward(chat)](Message.html#forward)

[Message#forwardingScore](Message.html#forwardingScore)

[Message#from](Message.html#from)

[Message#fromMe](Message.html#fromMe)

[Message#getChat()](Message.html#getChat)

[Message#getContact()](Message.html#getContact)

[Message#getGroupMentions()](Message.html#getGroupMentions)

[Message#getInfo()](Message.html#getInfo)

[Message#getMentions()](Message.html#getMentions)

[Message#getOrder()](Message.html#getOrder)

[Message#getPayment()](Message.html#getPayment)

[Message#getQuotedMessage()](Message.html#getQuotedMessage)

[Message#getReactions()](Message.html#getReactions)

[Message#groupMentions](Message.html#groupMentions)

[Message#hasMedia](Message.html#hasMedia)

[Message#hasQuotedMsg](Message.html#hasQuotedMsg)

[Message#hasReaction](Message.html#hasReaction)

[Message#id](Message.html#id)

[Message#inviteV4](Message.html#inviteV4)

[Message#isEphemeral](Message.html#isEphemeral)

[Message#isForwarded](Message.html#isForwarded)

[Message#isGif](Message.html#isGif)

[Message#isStarred](Message.html#isStarred)

[Message#isStatus](Message.html#isStatus)

[Message#links](Message.html#links)

[Message#location](Message.html#location)

[Message#mediaKey](Message.html#mediaKey)

[Message#mentionedIds](Message.html#mentionedIds)

[Message#orderId](Message.html#orderId)

[Message#pin(duration)](Message.html#pin)

[Message#rawData](Message.html#rawData)

[Message#react(reaction)](Message.html#react)

[Message#reload()](Message.html#reload)

[Message#reply(content\[, chatId\]\[, options\])](Message.html#reply)

[Message#star()](Message.html#star)

[Message#timestamp](Message.html#timestamp)

[Message#to](Message.html#to)

[Message#token](Message.html#token)

[Message#type](Message.html#type)

[Message#unpin()](Message.html#unpin)

[Message#unstar()](Message.html#unstar)

[Message#vCards](Message.html#vCards)

## MessageAck

[MessageAck.ACK_DEVICE](global.html#MessageAck#.ACK_DEVICE)

[MessageAck.ACK_ERROR](global.html#MessageAck#.ACK_ERROR)

[MessageAck.ACK_PENDING](global.html#MessageAck#.ACK_PENDING)

[MessageAck.ACK_PLAYED](global.html#MessageAck#.ACK_PLAYED)

[MessageAck.ACK_READ](global.html#MessageAck#.ACK_READ)

[MessageAck.ACK_SERVER](global.html#MessageAck#.ACK_SERVER)

## MessageMedia

[MessageMedia(mimetype, data, filename, filesize)](MessageMedia.html)

[MessageMedia.fromFilePath(filePath)](MessageMedia.html#.fromFilePath)

[MessageMedia.fromUrl(url\[, options\])](MessageMedia.html#.fromUrl)

[MessageMedia#data](MessageMedia.html#data)

[MessageMedia#filename](MessageMedia.html#filename)

[MessageMedia#filesize](MessageMedia.html#filesize)

[MessageMedia#mimetype](MessageMedia.html#mimetype)

## MessageTypes

[MessageTypes.AUDIO](global.html#MessageTypes#.AUDIO)

[MessageTypes.BROADCAST_NOTIFICATION](global.html#MessageTypes#.BROADCAST_NOTIFICATION)

[MessageTypes.BUTTONS_RESPONSE](global.html#MessageTypes#.BUTTONS_RESPONSE)

[MessageTypes.CALL_LOG](global.html#MessageTypes#.CALL_LOG)

[MessageTypes.CIPHERTEXT](global.html#MessageTypes#.CIPHERTEXT)

[MessageTypes.CONTACT_CARD](global.html#MessageTypes#.CONTACT_CARD)

[MessageTypes.CONTACT_CARD_MULTI](global.html#MessageTypes#.CONTACT_CARD_MULTI)

[MessageTypes.DEBUG](global.html#MessageTypes#.DEBUG)

[MessageTypes.DOCUMENT](global.html#MessageTypes#.DOCUMENT)

[MessageTypes.E2E_NOTIFICATION](global.html#MessageTypes#.E2E_NOTIFICATION)

[MessageTypes.GP2](global.html#MessageTypes#.GP2)

[MessageTypes.GROUP_INVITE](global.html#MessageTypes#.GROUP_INVITE)

[MessageTypes.GROUP_NOTIFICATION](global.html#MessageTypes#.GROUP_NOTIFICATION)

[MessageTypes.HSM](global.html#MessageTypes#.HSM)

[MessageTypes.IMAGE](global.html#MessageTypes#.IMAGE)

[MessageTypes.INTERACTIVE](global.html#MessageTypes#.INTERACTIVE)

[MessageTypes.LIST](global.html#MessageTypes#.LIST)

[MessageTypes.LIST_RESPONSE](global.html#MessageTypes#.LIST_RESPONSE)

[MessageTypes.LOCATION](global.html#MessageTypes#.LOCATION)

[MessageTypes.NATIVE_FLOW](global.html#MessageTypes#.NATIVE_FLOW)

[MessageTypes.NOTIFICATION](global.html#MessageTypes#.NOTIFICATION)

[MessageTypes.NOTIFICATION_TEMPLATE](global.html#MessageTypes#.NOTIFICATION_TEMPLATE)

[MessageTypes.ORDER](global.html#MessageTypes#.ORDER)

[MessageTypes.OVERSIZED](global.html#MessageTypes#.OVERSIZED)

[MessageTypes.PAYMENT](global.html#MessageTypes#.PAYMENT)

[MessageTypes.POLL_CREATION](global.html#MessageTypes#.POLL_CREATION)

[MessageTypes.PRODUCT](global.html#MessageTypes#.PRODUCT)

[MessageTypes.PROTOCOL](global.html#MessageTypes#.PROTOCOL)

[MessageTypes.REACTION](global.html#MessageTypes#.REACTION)

[MessageTypes.REVOKED](global.html#MessageTypes#.REVOKED)

[MessageTypes.SCHEDULED_EVENT_CREATION](global.html#MessageTypes#.SCHEDULED_EVENT_CREATION)

[MessageTypes.STICKER](global.html#MessageTypes#.STICKER)

[MessageTypes.TEMPLATE_BUTTON_REPLY](global.html#MessageTypes#.TEMPLATE_BUTTON_REPLY)

[MessageTypes.TEXT](global.html#MessageTypes#.TEXT)

[MessageTypes.UNKNOWN](global.html#MessageTypes#.UNKNOWN)

[MessageTypes.VIDEO](global.html#MessageTypes#.VIDEO)

[MessageTypes.VOICE](global.html#MessageTypes#.VOICE)

## NoAuth

[NoAuth()](NoAuth.html)

## Order

[Order()](Order.html)

[Order#createdAt](Order.html#createdAt)

[Order#currency](Order.html#currency)

[Order#subtotal](Order.html#subtotal)

[Order#total](Order.html#total)

## Payment

[Payment#id](Payment.html#id)

[Payment#paymentAmount1000](Payment.html#paymentAmount1000)

[Payment#paymentCurrency](Payment.html#paymentCurrency)

[Payment#paymentMessageReceiverJid](Payment.html#paymentMessageReceiverJid)

[Payment#paymentNote](Payment.html#paymentNote)

[Payment#paymentStatus](Payment.html#paymentStatus)

[Payment#paymentTransactionTimestamp](Payment.html#paymentTransactionTimestamp)

[Payment#paymentTxnStatus](Payment.html#paymentTxnStatus)

## Poll

[Poll(pollName, pollOptions, options)](Poll.html)

[Poll#options](Poll.html#options)

[Poll#pollName](Poll.html#pollName)

[Poll#pollOptions](Poll.html#pollOptions)

## PollVote

[PollVote()](PollVote.html)

[PollVote#interractedAtTs](PollVote.html#interractedAtTs)

[PollVote#parentMessage](PollVote.html#parentMessage)

[PollVote#parentMsgKey](PollVote.html#parentMsgKey)

[PollVote#voter](PollVote.html#voter)

## PrivateChat

[PrivateChat()](PrivateChat.html)

[PrivateChat#archive()](PrivateChat.html#archive)

[PrivateChat#archived](PrivateChat.html#archived)

[PrivateChat#changeLabels(labelIds)](PrivateChat.html#changeLabels)

[PrivateChat#clearMessages()](PrivateChat.html#clearMessages)

[PrivateChat#clearState()](PrivateChat.html#clearState)

[PrivateChat#delete()](PrivateChat.html#delete)

[PrivateChat#fetchMessages(searchOptions)](PrivateChat.html#fetchMessages)

[PrivateChat#getContact()](PrivateChat.html#getContact)

[PrivateChat#getLabels()](PrivateChat.html#getLabels)

[PrivateChat#getPinnedMessages()](PrivateChat.html#getPinnedMessages)

[PrivateChat#id](PrivateChat.html#id)

[PrivateChat#isGroup](PrivateChat.html#isGroup)

[PrivateChat#isMuted](PrivateChat.html#isMuted)

[PrivateChat#isReadOnly](PrivateChat.html#isReadOnly)

[PrivateChat#lastMessage](PrivateChat.html#lastMessage)

[PrivateChat#markUnread()](PrivateChat.html#markUnread)

[PrivateChat#mute(unmuteDate)](PrivateChat.html#mute)

[PrivateChat#muteExpiration](PrivateChat.html#muteExpiration)

[PrivateChat#name](PrivateChat.html#name)

[PrivateChat#pin()](PrivateChat.html#pin)

[PrivateChat#pinned](PrivateChat.html#pinned)

[PrivateChat#sendMessage(content\[, options\])](PrivateChat.html#sendMessage)

[PrivateChat#sendSeen()](PrivateChat.html#sendSeen)

[PrivateChat#sendStateRecording()](PrivateChat.html#sendStateRecording)

[PrivateChat#sendStateTyping()](PrivateChat.html#sendStateTyping)

[PrivateChat#syncHistory()](PrivateChat.html#syncHistory)

[PrivateChat#timestamp](PrivateChat.html#timestamp)

[PrivateChat#unarchive()](PrivateChat.html#unarchive)

[PrivateChat#unmute()](PrivateChat.html#unmute)

[PrivateChat#unpin()](PrivateChat.html#unpin)

[PrivateChat#unreadCount](PrivateChat.html#unreadCount)

## PrivateContact

[PrivateContact()](PrivateContact.html)

[PrivateContact#block()](PrivateContact.html#block)

[PrivateContact#getAbout()](PrivateContact.html#getAbout)

[PrivateContact#getChat()](PrivateContact.html#getChat)

[PrivateContact#getCommonGroups()](PrivateContact.html#getCommonGroups)

[PrivateContact#getCountryCode()](PrivateContact.html#getCountryCode)

[PrivateContact#getFormattedNumber()](PrivateContact.html#getFormattedNumber)

[PrivateContact#getProfilePicUrl()](PrivateContact.html#getProfilePicUrl)

[PrivateContact#id](PrivateContact.html#id)

[PrivateContact#isBlocked](PrivateContact.html#isBlocked)

[PrivateContact#isBusiness](PrivateContact.html#isBusiness)

[PrivateContact#isEnterprise](PrivateContact.html#isEnterprise)

[PrivateContact#isGroup](PrivateContact.html#isGroup)

[PrivateContact#isMe](PrivateContact.html#isMe)

[PrivateContact#isMyContact](PrivateContact.html#isMyContact)

[PrivateContact#isUser](PrivateContact.html#isUser)

[PrivateContact#isWAContact](PrivateContact.html#isWAContact)

[PrivateContact#name](PrivateContact.html#name)

[PrivateContact#number](PrivateContact.html#number)

[PrivateContact#pushname](PrivateContact.html#pushname)

[PrivateContact#shortName](PrivateContact.html#shortName)

[PrivateContact#unblock()](PrivateContact.html#unblock)

## Product

[Product()](Product.html)

[Product#currency](Product.html#currency)

[Product#data](Product.html#data)

[Product#id](Product.html#id)

[Product#name](Product.html#name)

[Product#price](Product.html#price)

[Product#quantity](Product.html#quantity)

[Product#thumbnailUrl](Product.html#thumbnailUrl)

## ProductMetadata

[ProductMetadata#description](ProductMetadata.html#description)

[ProductMetadata#id](ProductMetadata.html#id)

[ProductMetadata#name](ProductMetadata.html#name)

[ProductMetadata#retailer_id](ProductMetadata.html#retailer_id)

## Reaction

[Reaction()](Reaction.html)

[Reaction#ack](Reaction.html#ack)

[Reaction#id](Reaction.html#id)

[Reaction#msgId](Reaction.html#msgId)

[Reaction#orphan](Reaction.html#orphan)

[Reaction#orphanReason](Reaction.html#orphanReason)

[Reaction#reaction](Reaction.html#reaction)

[Reaction#read](Reaction.html#read)

[Reaction#senderId](Reaction.html#senderId)

[Reaction#timestamp](Reaction.html#timestamp)

## RemoteAuth

[RemoteAuth(options)](RemoteAuth.html)

## RemoteWebCache

[RemoteWebCache(options)](RemoteWebCache.html)

## ScheduledEvent

[ScheduledEvent(name, startTime, options)](ScheduledEvent.html)

[ScheduledEvent#\_validateInputs(propName, propValue)](ScheduledEvent.html#_validateInputs)

[ScheduledEvent#eventSendOptions](ScheduledEvent.html#eventSendOptions)

[ScheduledEvent#name](ScheduledEvent.html#name)

[ScheduledEvent#startTimeTs](ScheduledEvent.html#startTimeTs)

## Status

[Status.AUTHENTICATING](global.html#Status#.AUTHENTICATING)

[Status.INITIALIZING](global.html#Status#.INITIALIZING)

[Status.READY](global.html#Status#.READY)

## Util

[Util()](Util.html)

[Util.formatImageToWebpSticker(media)](Util.html#.formatImageToWebpSticker)

[Util.formatToWebpSticker(media, metadata)](Util.html#.formatToWebpSticker)

[Util.formatVideoToWebpSticker(media)](Util.html#.formatVideoToWebpSticker)

[Util.setFfmpegPath(path)](Util.html#.setFfmpegPath)

## WAState

[WAState.CONFLICT](global.html#WAState#.CONFLICT)

[WAState.CONNECTED](global.html#WAState#.CONNECTED)

[WAState.DEPRECATED_VERSION](global.html#WAState#.DEPRECATED_VERSION)

[WAState.OPENING](global.html#WAState#.OPENING)

[WAState.PAIRING](global.html#WAState#.PAIRING)

[WAState.PROXYBLOCK](global.html#WAState#.PROXYBLOCK)

[WAState.SMB_TOS_BLOCK](global.html#WAState#.SMB_TOS_BLOCK)

[WAState.TIMEOUT](global.html#WAState#.TIMEOUT)

[WAState.TOS_BLOCK](global.html#WAState#.TOS_BLOCK)

[WAState.UNLAUNCHED](global.html#WAState#.UNLAUNCHED)

[WAState.UNPAIRED](global.html#WAState#.UNPAIRED)

[WAState.UNPAIRED_IDLE](global.html#WAState#.UNPAIRED_IDLE)

## WebCache

[WebCache()](WebCache.html)

## window

[window.compareWwebVersions(lOperand, operator, rOperand)](window.html#.compareWwebVersions)

[window.injectToFunction(target, callback)](window.html#.injectToFunction)

Generated by [JSDoc](https://github.com/jsdoc3/jsdoc) 3.6.11 on September 10, 2025.
