---
source: https://docs.wwebjs.dev/Client.html
captured_at: 2025-10-23T16:01:17.932Z
---

[whatsapp-web.js 1.34.1](index.html)

class

# Client

Source: [Client.js:65](Client.js.html#source-line-65)

Starting point for interacting with the WhatsApp Web API

## Properties

[info](Client.html#info)

[pupBrowser](Client.html#pupBrowser)

[pupPage](Client.html#pupPage)

## Methods

[\_muteUnmuteChat(chatId, action, unmuteDateTs)](Client.html#_muteUnmuteChat)

[acceptChannelAdminInvite(channelId)](Client.html#acceptChannelAdminInvite)

[acceptGroupV4Invite(inviteInfo)](Client.html#acceptGroupV4Invite)

[acceptInvite(inviteCode)](Client.html#acceptInvite)

[addOrRemoveLabels(labelIds, chatIds)](Client.html#addOrRemoveLabels)

[approveGroupMembershipRequests(groupId, options)](Client.html#approveGroupMembershipRequests)

[archiveChat()](Client.html#archiveChat)

[attachEventListeners()](Client.html#attachEventListeners)

[createCallLink(startTime, callType)](Client.html#createCallLink)

[createChannel(title, options)](Client.html#createChannel)

[createGroup(title, participants, options)](Client.html#createGroup)

[deleteAddressbookContact(phoneNumber)](Client.html#deleteAddressbookContact)

[deleteChannel(channelId)](Client.html#deleteChannel)

[deleteProfilePicture()](Client.html#deleteProfilePicture)

[demoteChannelAdmin(channelId, userId)](Client.html#demoteChannelAdmin)

[destroy()](Client.html#destroy)

[getBlockedContacts()](Client.html#getBlockedContacts)

[getBroadcasts()](Client.html#getBroadcasts)

[getChannelByInviteCode(inviteCode)](Client.html#getChannelByInviteCode)

[getChannels()](Client.html#getChannels)

[getChatById(chatId)](Client.html#getChatById)

[getChatLabels(chatId)](Client.html#getChatLabels)

[getChats()](Client.html#getChats)

[getChatsByLabelId(labelId)](Client.html#getChatsByLabelId)

[getCommonGroups(contactId)](Client.html#getCommonGroups)

[getContactById(contactId)](Client.html#getContactById)

[getContactDeviceCount(userId)](Client.html#getContactDeviceCount)

[getContactLidAndPhone(userIds)](Client.html#getContactLidAndPhone)

[getContacts()](Client.html#getContacts)

[getCountryCode(number)](Client.html#getCountryCode)

[getFormattedNumber(number)](Client.html#getFormattedNumber)

[getGroupMembershipRequests(groupId)](Client.html#getGroupMembershipRequests)

[getInviteInfo(inviteCode)](Client.html#getInviteInfo)

[getLabelById(labelId)](Client.html#getLabelById)

[getLabels()](Client.html#getLabels)

[getNumberId(number)](Client.html#getNumberId)

[getPinnedMessages(chatId)](Client.html#getPinnedMessages)

[getProfilePicUrl(contactId)](Client.html#getProfilePicUrl)

[getState()](Client.html#getState)

[getWWebVersion()](Client.html#getWWebVersion)

[initialize()](Client.html#initialize)

[inject()](Client.html#inject)

[isRegisteredUser(id)](Client.html#isRegisteredUser)

[logout()](Client.html#logout)

[markChatUnread(chatId)](Client.html#markChatUnread)

[muteChat(chatId, unmuteDate)](Client.html#muteChat)

[pinChat()](Client.html#pinChat)

[rejectGroupMembershipRequests(groupId, options)](Client.html#rejectGroupMembershipRequests)

[requestPairingCode(phoneNumber\[, showNotification\]\[, intervalMs\])](Client.html#requestPairingCode)

[resetState()](Client.html#resetState)

[revokeChannelAdminInvite(channelId, userId)](Client.html#revokeChannelAdminInvite)

[saveOrEditAddressbookContact(phoneNumber, firstName, lastName\[, syncToAddressbook\])](Client.html#saveOrEditAddressbookContact)

[searchChannels(searchOptions)](Client.html#searchChannels)

[searchMessages(query\[, options\])](Client.html#searchMessages)

[sendChannelAdminInvite(chatId, channelId, options)](Client.html#sendChannelAdminInvite)

[sendMessage(chatId, content\[, options\])](Client.html#sendMessage)

[sendPresenceAvailable()](Client.html#sendPresenceAvailable)

[sendPresenceUnavailable()](Client.html#sendPresenceUnavailable)

[sendResponseToScheduledEvent(response, eventMessageId)](Client.html#sendResponseToScheduledEvent)

[sendSeen(chatId)](Client.html#sendSeen)

[setAutoDownloadAudio(flag)](Client.html#setAutoDownloadAudio)

[setAutoDownloadDocuments(flag)](Client.html#setAutoDownloadDocuments)

[setAutoDownloadPhotos(flag)](Client.html#setAutoDownloadPhotos)

[setAutoDownloadVideos(flag)](Client.html#setAutoDownloadVideos)

[setBackgroundSync(flag)](Client.html#setBackgroundSync)

[setDisplayName(displayName)](Client.html#setDisplayName)

[setProfilePicture(media)](Client.html#setProfilePicture)

[setStatus(status)](Client.html#setStatus)

[subscribeToChannel(channelId)](Client.html#subscribeToChannel)

[syncHistory(chatId)](Client.html#syncHistory)

[transferChannelOwnership(channelId, newOwnerId, options)](Client.html#transferChannelOwnership)

[unarchiveChat()](Client.html#unarchiveChat)

[unmuteChat(chatId)](Client.html#unmuteChat)

[unpinChat()](Client.html#unpinChat)

[unsubscribeFromChannel(channelId, options)](Client.html#unsubscribeFromChannel)

## Events

[auth_failure](Client.html#event:auth_failure)

[authenticated](Client.html#event:authenticated)

[change_battery](Client.html#event:change_battery)

[change_state](Client.html#event:change_state)

[chat_archived](Client.html#event:chat_archived)

[chat_removed](Client.html#event:chat_removed)

[code](Client.html#event:code)

[contact_changed](Client.html#event:contact_changed)

[disconnected](Client.html#event:disconnected)

[group_admin_changed](Client.html#event:group_admin_changed)

[group_join](Client.html#event:group_join)

[group_leave](Client.html#event:group_leave)

[group_membership_request](Client.html#event:group_membership_request)

[group_update](Client.html#event:group_update)

[incoming_call](Client.html#event:incoming_call)

[media_uploaded](Client.html#event:media_uploaded)

[message](Client.html#event:message)

[message_ack](Client.html#event:message_ack)

[message_ciphertext](Client.html#event:message_ciphertext)

[message_create](Client.html#event:message_create)

[message_edit](Client.html#event:message_edit)

[message_reaction](Client.html#event:message_reaction)

[message_revoke_everyone](Client.html#event:message_revoke_everyone)

[message_revoke_me](Client.html#event:message_revoke_me)

[qr](Client.html#event:qr)

[ready](Client.html#event:ready)

[vote_update](Client.html#event:vote_update)

## new Client(options)

### Parameters

Name

Type

Optional

Description

options

Client options

Values in `options` have the following properties:

Name

Type

Optional

Description

authStrategy

Determines how to save and restore sessions. Will use LegacySessionAuth if options.session is set. Otherwise, NoAuth will be used.

webVersion

The version of WhatsApp Web to use. Use options.webVersionCache to configure how the version is retrieved.

webVersionCache

Determines how to retrieve the WhatsApp Web version. Defaults to a local cache (LocalWebCache) that falls back to latest if the requested version is not found.

authTimeoutMs

Timeout for authentication selector in puppeteer

puppeteer

Puppeteer launch options. View docs here: https://github.com/puppeteer/puppeteer/

qrMaxRetries

How many times should the qrcode be refreshed before giving up

restartOnAuthFail

@deprecated This option should be set directly on the LegacySessionAuth.

session

@deprecated Only here for backwards-compatibility. You should move to using LocalAuth, or set the authStrategy to LegacySessionAuth explicitly.

takeoverOnConflict

If another whatsapp web session is detected (another browser), take over the session in the current browser

takeoverTimeoutMs

How much time to wait before taking over the session

userAgent

User agent to use in puppeteer

ffmpegPath

Ffmpeg path to use when formatting videos to webp while sending stickers

bypassCSP

Sets bypassing of page's Content-Security-Policy.

deviceName

Sets the device name of a current linked device., i.e.: 'TEST'.

browserName

Sets the browser name of a current linked device, i.e.: 'Firefox'.

proxyAuthentication

Proxy Authentication object.

Extends

EventEmitter

Fires

[Client#event:qr](Client.html#event:qr)

[Client#event:authenticated](Client.html#event:authenticated)

[Client#event:auth_failure](Client.html#event:auth_failure)

[Client#event:ready](Client.html#event:ready)

[Client#event:message](Client.html#event:message)

[Client#event:message_ack](Client.html#event:message_ack)

[Client#event:message_create](Client.html#event:message_create)

[Client#event:message_revoke_me](Client.html#event:message_revoke_me)

[Client#event:message_revoke_everyone](Client.html#event:message_revoke_everyone)

[Client#event:message_ciphertext](Client.html#event:message_ciphertext)

[Client#event:message_edit](Client.html#event:message_edit)

[Client#event:media_uploaded](Client.html#event:media_uploaded)

[Client#event:group_join](Client.html#event:group_join)

[Client#event:group_leave](Client.html#event:group_leave)

[Client#event:group_update](Client.html#event:group_update)

[Client#event:disconnected](Client.html#event:disconnected)

[Client#event:change_state](Client.html#event:change_state)

[Client#event:contact_changed](Client.html#event:contact_changed)

[Client#event:group_admin_changed](Client.html#event:group_admin_changed)

[Client#event:group_membership_request](Client.html#event:group_membership_request)

[Client#event:vote_update](Client.html#event:vote_update)

## Properties

### info  [ClientInfo](ClientInfo.html)

Current connection information

### pupBrowser  puppeteer.Browser

### pupPage  puppeteer.Page

## Methods

async

### \_muteUnmuteChat(chatId, action, unmuteDateTs) → Promise containing {isMuted: boolean, muteExpiration: number}

Internal method to mute or unmute the chat

#### Parameters

Name

Type

Optional

Description

chatId

string

ID of the chat that will be muted/unmuted

action

string

The action: 'MUTE' or 'UNMUTE'

unmuteDateTs

number

Timestamp at which the chat will be unmuted

Returns

`Promise containing {isMuted: boolean, muteExpiration: number}` 

async

### acceptChannelAdminInvite(channelId) → Promise containing boolean

Accepts a channel admin invitation and promotes the current user to a channel admin

#### Parameter

Name

Type

Optional

Description

channelId

string

The channel ID to accept the admin invitation from

Returns

`Promise containing boolean` 

Returns true if the operation completed successfully, false otherwise

async

### acceptGroupV4Invite(inviteInfo) → Promise containing Object

Accepts a private invitation to join a group

#### Parameter

Name

Type

Optional

Description

inviteInfo

object

Invite V4 Info

Returns

`Promise containing Object` 

async

### acceptInvite(inviteCode) → Promise containing string

Accepts an invitation to join a group

#### Parameter

Name

Type

Optional

Description

inviteCode

string

Invitation code

Returns

`Promise containing string` 

Id of the joined Chat

async

### addOrRemoveLabels(labelIds, chatIds) → Promise containing void

Change labels in chats

#### Parameters

Name

Type

Optional

Description

labelIds

Array of (number or string)

chatIds

Array of string

Returns

`Promise containing void` 

async

### approveGroupMembershipRequests(groupId, options) → Promise containing Array of [MembershipRequestActionResult](global.html#MembershipRequestActionResult)

Approves membership requests if any

#### Parameters

Name

Type

Optional

Description

groupId

string

The group ID to get the membership request for

options

[MembershipRequestActionOptions](global.html#MembershipRequestActionOptions)

Options for performing a membership request action

Returns

`Promise containing Array of [MembershipRequestActionResult](global.html#MembershipRequestActionResult)` 

Returns an array of requester IDs whose membership requests were approved and an error for each requester, if any occurred during the operation. If there are no requests, an empty array will be returned

async

### archiveChat() → boolean

Enables and returns the archive state of the Chat

Returns

`boolean` 

async

### attachEventListeners()

Attach event listeners to WA Web Private function

#### Property

Name

Type

Optional

Description

reinject

boolean

is this a reinject?

async

### createCallLink(startTime, callType) → Promise containing string

Generates a WhatsApp call link (video call or voice call)

#### Parameters

Name

Type

Optional

Description

startTime

Date

The start time of the call

callType

string

The type of a WhatsApp call link to generate, valid values are: `video` | `voice`

Returns

`Promise containing string` 

The WhatsApp call link (https://call.whatsapp.com/video/XxXxXxXxXxXxXx) or an empty string if a generation failed.

async

### createChannel(title, options) → Promise containing ([CreateChannelResult](global.html#CreateChannelResult) or string)

Creates a new channel

#### Parameters

Name

Type

Optional

Description

title

string

The channel name

options

[CreateChannelOptions](global.html#CreateChannelOptions)

Returns

`Promise containing ([CreateChannelResult](global.html#CreateChannelResult) or string)` 

Returns an object that handles the result for the channel creation or an error message as a string

async

### createGroup(title, participants, options) → Promise containing ([CreateGroupResult](global.html#CreateGroupResult) or string)

Creates a new group

#### Parameters

Name

Type

Optional

Description

title

string

Group title

participants

(string, [Contact](Contact.html), Array of ([Contact](Contact.html) or string), or undefined)

A single Contact object or an ID as a string or an array of Contact objects or contact IDs to add to the group

options

[CreateGroupOptions](global.html#CreateGroupOptions)

An object that handles options for group creation

Returns

`Promise containing ([CreateGroupResult](global.html#CreateGroupResult) or string)` 

Object with resulting data or an error message as a string

async

### deleteAddressbookContact(phoneNumber) → Promise containing void

Deletes the contact from user's addressbook

#### Parameter

Name

Type

Optional

Description

phoneNumber

string

The contact's phone number in a format "17182222222", where "1" is a country code

Returns

`Promise containing void` 

async

### deleteChannel(channelId) → Promise containing boolean

Deletes the channel you created

#### Parameter

Name

Type

Optional

Description

channelId

string

The ID of a channel to delete

Returns

`Promise containing boolean` 

Returns true if the operation completed successfully, false otherwise

async

### deleteProfilePicture() → Promise containing boolean

Deletes the current user's profile picture.

Returns

`Promise containing boolean` 

Returns true if the picture was properly deleted.

async

### demoteChannelAdmin(channelId, userId) → Promise containing boolean

Demotes a channel admin to a regular subscriber (can be used also for self-demotion)

#### Parameters

Name

Type

Optional

Description

channelId

string

The channel ID to demote an admin in

userId

string

The user ID to demote

Returns

`Promise containing boolean` 

Returns true if the operation completed successfully, false otherwise

async

### destroy()

Closes the client

async

### getBlockedContacts() → Promise containing Array of [Contact](Contact.html)

Gets all blocked contacts by host account

Returns

`Promise containing Array of [Contact](Contact.html)` 

async

### getBroadcasts() → Promise containing Array of [Broadcast](Broadcast.html)

Get all current Broadcast

Returns

`Promise containing Array of [Broadcast](Broadcast.html)` 

async

### getChannelByInviteCode(inviteCode) → Promise containing [Channel](Channel.html)

Gets a [`Channel`](Channel.html) instance by invite code

#### Parameter

Name

Type

Optional

Description

inviteCode

string

The code that comes after the 'https://whatsapp.com/channel/'

Returns

`Promise containing [Channel](Channel.html)` 

async

### getChannels() → Promise containing Array of [Channel](Channel.html)

Gets all cached [`Channel`](Channel.html) instance

Returns

`Promise containing Array of [Channel](Channel.html)` 

async

### getChatById(chatId) → Promise containing ([Chat](Chat.html) or [Channel](Channel.html))

Gets chat or channel instance by ID

#### Parameter

Name

Type

Optional

Description

chatId

string

Returns

`Promise containing ([Chat](Chat.html) or [Channel](Channel.html))` 

async

### getChatLabels(chatId) → Promise containing Array of [Label](Label.html)

Get all Labels assigned to a chat

#### Parameter

Name

Type

Optional

Description

chatId

string

Returns

`Promise containing Array of [Label](Label.html)` 

async

### getChats() → Promise containing Array of [Chat](Chat.html)

Get all current chat instances

Returns

`Promise containing Array of [Chat](Chat.html)` 

async

### getChatsByLabelId(labelId) → Promise containing Array of [Chat](Chat.html)

Get all Chats for a specific Label

#### Parameter

Name

Type

Optional

Description

labelId

string

Returns

`Promise containing Array of [Chat](Chat.html)` 

async

### getCommonGroups(contactId) → Promise containing Array of WAWebJS.ChatId

Gets the Contact's common groups with you. Returns empty array if you don't have any common group.

#### Parameter

Name

Type

Optional

Description

contactId

string

the whatsapp user's ID (\_serialized format)

Returns

`Promise containing Array of WAWebJS.ChatId` 

async

### getContactById(contactId) → Promise containing [Contact](Contact.html)

Get contact instance by ID

#### Parameter

Name

Type

Optional

Description

contactId

string

Returns

`Promise containing [Contact](Contact.html)` 

async

### getContactDeviceCount(userId) → Promise containing number

Get user device count by ID Each WaWeb Connection counts as one device, and the phone (if exists) counts as one So for a non-enterprise user with one WaWeb connection it should return "2"

#### Parameter

Name

Type

Optional

Description

userId

string

Returns

`Promise containing number` 

async

### getContactLidAndPhone(userIds) → Promise containing Array of {lid: string, pn: string}

Get lid and phone number for multiple users

#### Parameter

Name

Type

Optional

Description

userIds

Array of string

Array of user IDs

Returns

`Promise containing Array of {lid: string, pn: string}` 

async

### getContacts() → Promise containing Array of [Contact](Contact.html)

Get all current contact instances

Returns

`Promise containing Array of [Contact](Contact.html)` 

async

### getCountryCode(number) → Promise containing string

Get the country code of a WhatsApp ID.

#### Parameter

Name

Type

Optional

Description

number

string

Number or ID

Returns

`Promise containing string` 

async

### getFormattedNumber(number) → Promise containing string

Get the formatted number of a WhatsApp ID.

#### Parameter

Name

Type

Optional

Description

number

string

Number or ID

Returns

`Promise containing string` 

async

### getGroupMembershipRequests(groupId) → Promise containing Array of [GroupMembershipRequest](global.html#GroupMembershipRequest)

Gets an array of membership requests

#### Parameter

Name

Type

Optional

Description

groupId

string

The ID of a group to get membership requests for

Returns

`Promise containing Array of [GroupMembershipRequest](global.html#GroupMembershipRequest)` 

An array of membership requests

async

### getInviteInfo(inviteCode) → Promise containing object

Returns an object with information about the invite code's group

#### Parameter

Name

Type

Optional

Description

inviteCode

string

Returns

`Promise containing object` 

Invite information

async

### getLabelById(labelId) → Promise containing [Label](Label.html)

Get Label instance by ID

#### Parameter

Name

Type

Optional

Description

labelId

string

Returns

`Promise containing [Label](Label.html)` 

async

### getLabels() → Promise containing Array of [Label](Label.html)

Get all current Labels

Returns

`Promise containing Array of [Label](Label.html)` 

async

### getNumberId(number) → Promise containing (Object or null)

Get the registered WhatsApp ID for a number. Will return null if the number is not registered on WhatsApp.

#### Parameter

Name

Type

Optional

Description

number

string

Number or ID ("@c.us" will be automatically appended if not specified)

Returns

`Promise containing (Object or null)` 

async

### getPinnedMessages(chatId)

Gets instances of all pinned messages in a chat

#### Parameter

Name

Type

Optional

Description

chatId

string

The chat ID

Returns

async

### getProfilePicUrl(contactId) → Promise containing string

Returns the contact ID's profile picture URL, if privacy settings allow it

#### Parameter

Name

Type

Optional

Description

contactId

string

the whatsapp user's ID

Returns

`Promise containing string` 

async

### getState() → [WAState](global.html#WAState)

Gets the current connection state for the client

Returns

`[WAState](global.html#WAState)` 

async

### getWWebVersion() → Promise containing string

Returns the version of WhatsApp Web currently being run

Returns

`Promise containing string` 

async

### initialize()

Sets up events and requirements, kicks off authentication request

async

### inject()

Injection logic Private function

async

### isRegisteredUser(id) → Promise containing Boolean

Check if a given ID is registered in whatsapp

#### Parameter

Name

Type

Optional

Description

id

string

the whatsapp user's ID

Returns

`Promise containing Boolean` 

async

### logout()

Logs out the client, closing the current session

async

### markChatUnread(chatId)

Mark the Chat as unread

#### Parameter

Name

Type

Optional

Description

chatId

string

ID of the chat that will be marked as unread

async

### muteChat(chatId, unmuteDate) → Promise containing {isMuted: boolean, muteExpiration: number}

Mutes this chat forever, unless a date is specified

#### Parameters

Name

Type

Optional

Description

chatId

string

ID of the chat that will be muted

unmuteDate

Date

Date when the chat will be unmuted, don't provide a value to mute forever

Value can be null.

Returns

`Promise containing {isMuted: boolean, muteExpiration: number}` 

async

### pinChat() → Promise containing boolean

Pins the Chat

Returns

`Promise containing boolean` 

New pin state. Could be false if the max number of pinned chats was reached.

async

### rejectGroupMembershipRequests(groupId, options) → Promise containing Array of [MembershipRequestActionResult](global.html#MembershipRequestActionResult)

Rejects membership requests if any

#### Parameters

Name

Type

Optional

Description

groupId

string

The group ID to get the membership request for

options

[MembershipRequestActionOptions](global.html#MembershipRequestActionOptions)

Options for performing a membership request action

Returns

`Promise containing Array of [MembershipRequestActionResult](global.html#MembershipRequestActionResult)` 

Returns an array of requester IDs whose membership requests were rejected and an error for each requester, if any occurred during the operation. If there are no requests, an empty array will be returned

async

### requestPairingCode(phoneNumber\[, showNotification\]\[, intervalMs\]) → Promise containing string

Request authentication via pairing code instead of QR code

#### Parameters

Name

Type

Optional

Description

phoneNumber

string

Phone number in international, symbol-free format (e.g. 12025550108 for US, 551155501234 for Brazil)

showNotification

boolean

Yes

Show notification to pair on phone number

Defaults to `true`.

intervalMs

number

Yes

The interval in milliseconds on how frequent to generate pairing code (WhatsApp default to 3 minutes)

Defaults to `180000`.

Returns

`Promise containing string` 

- Returns a pairing code in format "ABCDEFGH"

async

### resetState()

Force reset of connection state for the client

async

### revokeChannelAdminInvite(channelId, userId) → Promise containing boolean

Revokes a channel admin invitation sent to a user by a channel owner

#### Parameters

Name

Type

Optional

Description

channelId

string

The channel ID an invitation belongs to

userId

string

The user ID the invitation was sent to

Returns

`Promise containing boolean` 

Returns true if the operation completed successfully, false otherwise

async

### saveOrEditAddressbookContact(phoneNumber, firstName, lastName\[, syncToAddressbook\])

Save new contact to user's addressbook or edit the existing one

#### Parameters

Name

Type

Optional

Description

phoneNumber

string

The contact's phone number in a format "17182222222", where "1" is a country code

firstName

string

lastName

string

syncToAddressbook

boolean

Yes

If set to true, the contact will also be saved to the user's address book on their phone. False by default

Defaults to `false`.

Returns

async

### searchChannels(searchOptions)

Searches for channels based on search criteria, there are some notes:

1.  The method finds only channels you are not subscribed to currently
2.  If you have never been subscribed to a found channel or you have unsubscribed from it with `UnsubscribeOptions.deleteLocalModels` set to 'true', the lastMessage property of a found channel will be 'null'

#### Parameters

Name

Type

Optional

Description

searchOptions

Object

Search options

Values in `searchOptions` have the following properties:

Name

Type

Optional

Description

searchText

string

Yes

Text to search

Defaults to `''`.

countryCodes

Array of string

Yes

Array of country codes in 'ISO 3166-1 alpha-2' standart (@see https://en.wikipedia.org/wiki/ISO\_3166-1\_alpha-2) to search for channels created in these countries

Defaults to `[your local region]`.

skipSubscribedNewsletters

boolean

Yes

If true, channels that user is subscribed to won't appear in found channels

Defaults to `false`.

view

number

Yes

View type, makes sense only when the searchText is empty. Valid values to provide are: 0 for RECOMMENDED channels 1 for TRENDING channels 2 for POPULAR channels 3 for NEW channels

Defaults to `0`.

limit

number

Yes

The limit of found channels to be appear in the returnig result

Defaults to `50`.

Returns

async

### searchMessages(query\[, options\]) → Promise containing Array of [Message](Message.html)

Searches for messages

#### Parameters

Name

Type

Optional

Description

query

string

options

Object

Yes

Values in `options` have the following properties:

Name

Type

Optional

Description

page

number

Yes

limit

number

Yes

chatId

string

Yes

Returns

`Promise containing Array of [Message](Message.html)` 

async

### sendChannelAdminInvite(chatId, channelId, options) → Promise containing boolean

Sends a channel admin invitation to a user, allowing them to become an admin of the channel

#### Parameters

Name

Type

Optional

Description

chatId

string

The ID of a user to send the channel admin invitation to

channelId

string

The ID of a channel for which the invitation is being sent

options

[SendChannelAdminInviteOptions](global.html#SendChannelAdminInviteOptions)

Returns

`Promise containing boolean` 

Returns true if an invitation was sent successfully, false otherwise

async

### sendMessage(chatId, content\[, options\]) → Promise containing [Message](Message.html)

Send a message to a specific chatId

#### Parameters

Name

Type

Optional

Description

chatId

string

content

(string, [MessageMedia](MessageMedia.html), [Location](Location.html), [Poll](Poll.html), [Contact](Contact.html), Array of [Contact](Contact.html), [Buttons](Buttons.html), or [List](List.html))

options

[MessageSendOptions](global.html#MessageSendOptions)

Yes

Options used when sending the message

Returns

`Promise containing [Message](Message.html)` 

Message that was just sent

async

### sendPresenceAvailable()

Marks the client as online

async

### sendPresenceUnavailable()

Marks the client as unavailable

async

### sendResponseToScheduledEvent(response, eventMessageId) → Promise containing boolean

Sends a response to the scheduled event message, indicating whether a user is going to attend the event or not

#### Parameters

Name

Type

Optional

Description

response

number

The response code to the scheduled event message. Valid values are: `0` for NONE response (removes a previous response) | `1` for GOING | `2` for NOT GOING | `3` for MAYBE going

eventMessageId

string

The scheduled event message ID

Returns

`Promise containing boolean` 

async

### sendSeen(chatId) → Promise containing boolean

Mark as seen for the Chat

#### Parameter

Name

Type

Optional

Description

chatId

string

Returns

`Promise containing boolean` 

result

async

### setAutoDownloadAudio(flag)

Setting autoload download audio

#### Parameter

Name

Type

Optional

Description

flag

boolean

true/false

async

### setAutoDownloadDocuments(flag)

Setting autoload download documents

#### Parameter

Name

Type

Optional

Description

flag

boolean

true/false

async

### setAutoDownloadPhotos(flag)

Setting autoload download photos

#### Parameter

Name

Type

Optional

Description

flag

boolean

true/false

async

### setAutoDownloadVideos(flag)

Setting autoload download videos

#### Parameter

Name

Type

Optional

Description

flag

boolean

true/false

async

### setBackgroundSync(flag) → Promise containing boolean

Setting background synchronization. NOTE: this action will take effect after you restart the client.

#### Parameter

Name

Type

Optional

Description

flag

boolean

true/false

Returns

`Promise containing boolean` 

async

### setDisplayName(displayName) → Promise containing Boolean

Sets the current user's display name. This is the name shown to WhatsApp users that have not added you as a contact beside your number in groups and in your profile.

#### Parameter

Name

Type

Optional

Description

displayName

string

New display name

Returns

`Promise containing Boolean` 

async

### setProfilePicture(media) → Promise containing boolean

Sets the current user's profile picture.

#### Parameter

Name

Type

Optional

Description

media

[MessageMedia](MessageMedia.html)

Returns

`Promise containing boolean` 

Returns true if the picture was properly updated.

async

### setStatus(status)

Sets the current user's status message

#### Parameter

Name

Type

Optional

Description

status

string

New status message

async

### subscribeToChannel(channelId) → Promise containing boolean

Subscribe to channel

#### Parameter

Name

Type

Optional

Description

channelId

string

The channel ID

Returns

`Promise containing boolean` 

Returns true if the operation completed successfully, false otherwise

async

### syncHistory(chatId) → Promise containing boolean

Sync chat history conversation

#### Parameter

Name

Type

Optional

Description

chatId

string

Returns

`Promise containing boolean` 

True if operation completed successfully, false otherwise.

async

### transferChannelOwnership(channelId, newOwnerId, options) → Promise containing boolean

Transfers a channel ownership to another user. Note: the user you are transferring the channel ownership to must be a channel admin.

#### Parameters

Name

Type

Optional

Description

channelId

string

newOwnerId

string

options

[TransferChannelOwnershipOptions](global.html#TransferChannelOwnershipOptions)

Returns

`Promise containing boolean` 

Returns true if the operation completed successfully, false otherwise

async

### unarchiveChat() → boolean

Changes and returns the archive state of the Chat

Returns

`boolean` 

async

### unmuteChat(chatId) → Promise containing {isMuted: boolean, muteExpiration: number}

Unmutes the Chat

#### Parameter

Name

Type

Optional

Description

chatId

string

ID of the chat that will be unmuted

Returns

`Promise containing {isMuted: boolean, muteExpiration: number}` 

async

### unpinChat() → Promise containing boolean

Unpins the Chat

Returns

`Promise containing boolean` 

New pin state

async

### unsubscribeFromChannel(channelId, options) → Promise containing boolean

Unsubscribe from channel

#### Parameters

Name

Type

Optional

Description

channelId

string

The channel ID

options

[UnsubscribeOptions](global.html#UnsubscribeOptions)

Returns

`Promise containing boolean` 

Returns true if the operation completed successfully, false otherwise

## Events

### auth_failure

Emitted when there has been an error while trying to restore an existing session

#### Parameter

Name

Type

Optional

Description

message

string

### authenticated

Emitted when authentication is successful

### change_battery

Emitted when the battery percentage for the attached device changes. Will not be sent if using multi-device.

#### Parameters

Name

Type

Optional

Description

batteryInfo

object

Values in `batteryInfo` have the following properties:

Name

Type

Optional

Description

battery

number

The current battery percentage

plugged

boolean

Indicates if the phone is plugged in (true) or not (false)

Deprecated

### change_state

Emitted when the connection state changes

#### Parameter

Name

Type

Optional

Description

state

[WAState](global.html#WAState)

the new connection state

### chat_archived

Emitted when a chat is archived/unarchived

#### Parameters

Name

Type

Optional

Description

chat

[Chat](Chat.html)

currState

boolean

prevState

boolean

### chat_removed

Emitted when a chat is removed

#### Parameter

Name

Type

Optional

Description

chat

[Chat](Chat.html)

### code

Emitted when a pairing code is received

#### Parameter

Name

Type

Optional

Description

code

string

Code

Returns

`string` 

Code that was just received

### contact_changed

Emitted when a contact or a group participant changes their phone number.

#### Parameters

Name

Type

Optional

Description

message

[Message](Message.html)

Message with more information about the event.

oldId

String

The user's id (an old one) who changed their phone number and who triggered the notification.

newId

String

The user's new id after the change.

isContact

Boolean

Indicates if a contact or a group participant changed their phone number.

### disconnected

Emitted when the client has been disconnected

#### Parameter

Name

Type

Optional

Description

reason

([WAState](global.html#WAState) or "LOGOUT")

reason that caused the disconnect

### group_admin_changed

Emitted when a current user is promoted to an admin or demoted to a regular user.

#### Parameter

Name

Type

Optional

Description

notification

[GroupNotification](GroupNotification.html)

GroupNotification with more information about the action

### group_join

Emitted when a user joins the chat via invite link or is added by an admin.

#### Parameter

Name

Type

Optional

Description

notification

[GroupNotification](GroupNotification.html)

GroupNotification with more information about the action

### group_leave

Emitted when a user leaves the chat or is removed by an admin.

#### Parameter

Name

Type

Optional

Description

notification

[GroupNotification](GroupNotification.html)

GroupNotification with more information about the action

### group_membership_request

Emitted when some user requested to join the group that has the membership approval mode turned on

#### Parameters

Name

Type

Optional

Description

notification

[GroupNotification](GroupNotification.html)

GroupNotification with more information about the action

Values in `notification` have the following properties:

Name

Type

Optional

Description

chatId

string

The group ID the request was made for

author

string

The user ID that made a request

timestamp

number

The timestamp the request was made at

### group_update

Emitted when group settings are updated, such as subject, description or picture.

#### Parameter

Name

Type

Optional

Description

notification

[GroupNotification](GroupNotification.html)

GroupNotification with more information about the action

### incoming_call

Emitted when a call is received

#### Parameters

Name

Type

Optional

Description

call

object

Values in `call` have the following properties:

Name

Type

Optional

Description

id

number

Call id

peerJid

string

Who called

isVideo

boolean

if is video

isGroup

boolean

if is group

canHandleLocally

boolean

if we can handle in waweb

outgoing

boolean

if is outgoing

webClientShouldHandle

boolean

If Waweb should handle

participants

object

Participants

### media_uploaded

Emitted when media has been uploaded for a message sent by the client.

#### Parameter

Name

Type

Optional

Description

message

[Message](Message.html)

The message with media that was uploaded

### message

Emitted when a new message is received.

#### Parameter

Name

Type

Optional

Description

message

[Message](Message.html)

The message that was received

### message_ack

Emitted when an ack event occurrs on message type.

#### Parameters

Name

Type

Optional

Description

message

[Message](Message.html)

The message that was affected

ack

[MessageAck](global.html#MessageAck)

The new ACK value

### message_ciphertext

Emitted when messages are edited

#### Parameter

Name

Type

Optional

Description

message

[Message](Message.html)

### message_create

Emitted when a new message is created, which may include the current user's own messages.

#### Parameter

Name

Type

Optional

Description

message

[Message](Message.html)

The message that was created

### message_edit

Emitted when messages are edited

#### Parameters

Name

Type

Optional

Description

message

[Message](Message.html)

newBody

string

prevBody

string

### message_reaction

Emitted when a reaction is sent, received, updated or removed

#### Parameters

Name

Type

Optional

Description

reaction

object

Values in `reaction` have the following properties:

Name

Type

Optional

Description

id

object

Reaction id

orphan

number

Orphan

orphanReason

string

Orphan reason

Value can be null.

timestamp

number

Timestamp

reaction

string

Reaction

read

boolean

Read

msgId

object

Parent message id

senderId

string

Sender id

ack

number

Ack

Value can be null.

### message_revoke_everyone

Emitted when a message is deleted for everyone in the chat.

#### Parameters

Name

Type

Optional

Description

message

[Message](Message.html)

The message that was revoked, in its current state. It will not contain the original message's data.

revoked_msg

[Message](Message.html)

The message that was revoked, before it was revoked. It will contain the message's original data. Note that due to the way this data is captured, it may be possible that this param will be undefined.

Value can be null.

### message_revoke_me

Emitted when a message is deleted by the current user.

#### Parameter

Name

Type

Optional

Description

message

[Message](Message.html)

The message that was revoked

### qr

Emitted when a QR code is received

#### Parameter

Name

Type

Optional

Description

qr

string

QR Code

### ready

Emitted when the client has initialized and is ready to receive messages.

### vote_update

Emitted when some poll option is selected or deselected, shows a user's current selected option(s) on the poll

Generated by [JSDoc](https://github.com/jsdoc3/jsdoc) 3.6.11 on September 10, 2025.
