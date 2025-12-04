---
source: https://docs.wwebjs.dev/global.html
captured_at: 2025-10-23T16:01:30.999Z
---

[whatsapp-web.js 1.34.1](index.html)

# Globals

## Properties

[ChatTypes](global.html#ChatTypes)

[Events](global.html#Events)

[GroupNotificationTypes](global.html#GroupNotificationTypes)

[MessageAck](global.html#MessageAck)

[MessageTypes](global.html#MessageTypes)

[Status](global.html#Status)

[WAState](global.html#WAState)

## Method

[exposeFunctionIfAbsent(page, name, fn)](global.html#exposeFunctionIfAbsent)

## Abstract types

[AddParticipantsResult](global.html#AddParticipantsResult)

[AddParticipnatsOptions](global.html#AddParticipnatsOptions)

[ButtonSpec](global.html#ButtonSpec)

[ChannelId](global.html#ChannelId)

[ContactId](global.html#ContactId)

[CreateChannelOptions](global.html#CreateChannelOptions)

[CreateChannelResult](global.html#CreateChannelResult)

[CreateGroupOptions](global.html#CreateGroupOptions)

[CreateGroupResult](global.html#CreateGroupResult)

[FormattedButtonSpec](global.html#FormattedButtonSpec)

[GroupMembershipRequest](global.html#GroupMembershipRequest)

[GroupMembershipRequest](global.html#GroupMembershipRequest)

[GroupMention](global.html#GroupMention)

[GroupMention](global.html#GroupMention)

[GroupParticipant](global.html#GroupParticipant)

[LocationSendOptions](global.html#LocationSendOptions)

[MembershipRequestActionOptions](global.html#MembershipRequestActionOptions)

[MembershipRequestActionOptions](global.html#MembershipRequestActionOptions)

[MembershipRequestActionResult](global.html#MembershipRequestActionResult)

[MembershipRequestActionResult](global.html#MembershipRequestActionResult)

[MessageInfo](global.html#MessageInfo)

[MessageSendOptions](global.html#MessageSendOptions)

[MessageSendOptions](global.html#MessageSendOptions)

[ParticipantResult](global.html#ParticipantResult)

[PollSendOptions](global.html#PollSendOptions)

[ReactionList](global.html#ReactionList)

[ScheduledEventSendOptions](global.html#ScheduledEventSendOptions)

[SelectedPollOption](global.html#SelectedPollOption)

[SendChannelAdminInviteOptions](global.html#SendChannelAdminInviteOptions)

[SendChannelAdminInviteOptions](global.html#SendChannelAdminInviteOptions)

[StickerMetadata](global.html#StickerMetadata)

[TargetOptions](global.html#TargetOptions)

[TargetOptions](global.html#TargetOptions)

[TransferChannelOwnershipOptions](global.html#TransferChannelOwnershipOptions)

[TransferChannelOwnershipOptions](global.html#TransferChannelOwnershipOptions)

[UnsubscribeOptions](global.html#UnsubscribeOptions)

## Properties

read-only

### ChatTypes  string

Chat types

#### Properties

Name

Type

Optional

Description

SOLO

GROUP

UNKNOWN

read-only

### Events  string

Events that can be emitted by the client

#### Properties

Name

Type

Optional

Description

AUTHENTICATED

AUTHENTICATION_FAILURE

READY

CHAT_REMOVED

CHAT_ARCHIVED

MESSAGE_RECEIVED

MESSAGE_CIPHERTEXT

MESSAGE_CREATE

MESSAGE_REVOKED_EVERYONE

MESSAGE_REVOKED_ME

MESSAGE_ACK

MESSAGE_EDIT

UNREAD_COUNT

MESSAGE_REACTION

MEDIA_UPLOADED

CONTACT_CHANGED

GROUP_JOIN

GROUP_LEAVE

GROUP_ADMIN_CHANGED

GROUP_MEMBERSHIP_REQUEST

GROUP_UPDATE

QR_RECEIVED

CODE_RECEIVED

LOADING_SCREEN

DISCONNECTED

STATE_CHANGED

BATTERY_CHANGED

INCOMING_CALL

REMOTE_SESSION_SAVED

VOTE_UPDATE

read-only

### GroupNotificationTypes  string

Group notification types

#### Properties

Name

Type

Optional

Description

ADD

INVITE

REMOVE

LEAVE

SUBJECT

DESCRIPTION

PICTURE

ANNOUNCE

RESTRICT

read-only

### MessageAck  number

Message ACK

#### Properties

Name

Type

Optional

Description

ACK_ERROR

ACK_PENDING

ACK_SERVER

ACK_DEVICE

ACK_READ

ACK_PLAYED

read-only

### MessageTypes  string

Message types

#### Properties

Name

Type

Optional

Description

TEXT

AUDIO

VOICE

IMAGE

VIDEO

DOCUMENT

STICKER

LOCATION

CONTACT_CARD

CONTACT_CARD_MULTI

ORDER

REVOKED

PRODUCT

UNKNOWN

GROUP_INVITE

LIST

LIST_RESPONSE

BUTTONS_RESPONSE

PAYMENT

BROADCAST_NOTIFICATION

CALL_LOG

CIPHERTEXT

DEBUG

E2E_NOTIFICATION

GP2

GROUP_NOTIFICATION

HSM

INTERACTIVE

NATIVE_FLOW

NOTIFICATION

NOTIFICATION_TEMPLATE

OVERSIZED

PROTOCOL

REACTION

TEMPLATE_BUTTON_REPLY

POLL_CREATION

SCHEDULED_EVENT_CREATION

read-only

### Status  number

Client status

#### Properties

Name

Type

Optional

Description

INITIALIZING

AUTHENTICATING

READY

read-only

### WAState  string

WhatsApp state

#### Properties

Name

Type

Optional

Description

CONFLICT

CONNECTED

DEPRECATED_VERSION

OPENING

PAIRING

PROXYBLOCK

SMB_TOS_BLOCK

TIMEOUT

TOS_BLOCK

UNLAUNCHED

UNPAIRED

UNPAIRED_IDLE

## Method

async

### exposeFunctionIfAbsent(page, name, fn)

Expose a function to the page if it does not exist

NOTE: Rewrite it to 'upsertFunction' after updating Puppeteer to 20.6 or higher using page.removeExposedFunction https://pptr.dev/api/puppeteer.page.removeExposedFunction

#### Parameters

Name

Type

Optional

Description

page

name

string

fn

function()

## Abstract types

### AddParticipantsResult  Object

An object that handles the result for `addParticipants` method

#### Properties

Name

Type

Optional

Description

code

number

The code of the result

message

string

The result message

isInviteV4Sent

boolean

Indicates if the inviteV4 was sent to the partitipant

### AddParticipnatsOptions  Object

An object that handles options for adding participants

#### Properties

Name

Type

Optional

Description

sleep

(Array of number or number)

Yes

The number of milliseconds to wait before adding the next participant. If it is an array, a random sleep time between the sleep\[0\] and sleep\[1\] values will be added (the difference must be >=100 ms, otherwise, a random sleep time between sleep\[1\] and sleep\[1\] + 100 will be added). If sleep is a number, a sleep time equal to its value will be added. By default, sleep is an array with a value of \[250, 500\]

Defaults to `[250, 500]`.

autoSendInviteV4

boolean

Yes

If true, the inviteV4 will be sent to those participants who have restricted others from being automatically added to groups, otherwise the inviteV4 won't be sent (true by default)

Defaults to `true`.

comment

string

Yes

The comment to be added to an inviteV4 (empty string by default)

Defaults to `''`.

### ButtonSpec  Object

Button spec used in Buttons constructor

#### Properties

Name

Type

Optional

Description

id

string

Yes

Custom ID to set on the button. A random one will be generated if one is not passed.

body

string

The text to show on the button.

### ChannelId  Object

Channel ID structure

#### Properties

Name

Type

Optional

Description

server

string

user

string

\_serialized

string

### ContactId  Object

ID that represents a contact

#### Properties

Name

Type

Optional

Description

server

string

user

string

\_serialized

string

### CreateChannelOptions  Object

Options for the channel creation

#### Properties

Name

Type

Optional

Description

description

string

The channel description

Value can be null.

picture

[MessageMedia](MessageMedia.html)

The channel profile picture

Value can be null.

### CreateChannelResult  Object

An object that handles the result for `createChannel` method

#### Properties

Name

Type

Optional

Description

title

string

A channel title

nid

ChatId

An object that handels the newly created channel ID

Values in `nid` have the following properties:

Name

Type

Optional

Description

server

string

'newsletter'

user

string

'XXXXXXXXXX'

\_serialized

string

'XXXXXXXXXX@newsletter'

inviteLink

string

The channel invite link, starts with 'https://whatsapp.com/channel/'

createdAtTs

number

The timestamp the channel was created at

### CreateGroupOptions  Object

An object that handles options for group creation

#### Properties

Name

Type

Optional

Description

messageTimer

number

Yes

The number of seconds for the messages to disappear in the group (0 by default, won't take an effect if the group is been creating with myself only)

Defaults to `0`.

parentGroupId

(string or undefined)

The ID of a parent community group to link the newly created group with (won't take an effect if the group is been creating with myself only)

autoSendInviteV4

boolean

Yes

If true, the inviteV4 will be sent to those participants who have restricted others from being automatically added to groups, otherwise the inviteV4 won't be sent (true by default)

Defaults to `true`.

comment

string

Yes

The comment to be added to an inviteV4 (empty string by default)

Defaults to `''`.

memberAddMode

boolean

Yes

If true, only admins can add members to the group (false by default)

Defaults to `false`.

membershipApprovalMode

boolean

Yes

If true, group admins will be required to approve anyone who wishes to join the group (false by default)

Defaults to `false`.

isRestrict

boolean

Yes

If true, only admins can change group group info (true by default)

Defaults to `true`.

isAnnounce

boolean

Yes

If true, only admins can send messages (false by default)

Defaults to `false`.

### CreateGroupResult  Object

An object that handles the result for `createGroup` method

#### Properties

Name

Type

Optional

Description

title

string

A group title

gid

Object

An object that handles the newly created group ID

Values in `gid` have the following properties:

Name

Type

Optional

Description

server

string

user

string

\_serialized

string

participants

Object with [ParticipantResult](global.html#ParticipantResult) properties

An object that handles the result value for each added to the group participant

### FormattedButtonSpec  Object

#### Properties

Name

Type

Optional

Description

buttonId

string

type

number

buttonText

Object

### GroupMembershipRequest  Object

An object that handles the information about the group membership request

#### Properties

Name

Type

Optional

Description

id

Object

The wid of a user who requests to enter the group

addedBy

Object

The wid of a user who created that request

parentGroupId

(Object or null)

The wid of a community parent group to which the current group is linked

requestMethod

string

The method used to create the request: NonAdminAdd/InviteLink/LinkedGroupJoin

t

number

The timestamp the request was created at

### GroupMembershipRequest  Object

An object that handles the information about the group membership request

#### Properties

Name

Type

Optional

Description

id

Object

The wid of a user who requests to enter the group

addedBy

Object

The wid of a user who created that request

parentGroupId

(Object or null)

The wid of a community parent group to which the current group is linked

requestMethod

string

The method used to create the request: NonAdminAdd/InviteLink/LinkedGroupJoin

t

number

The timestamp the request was created at

### GroupMention  Object

An object representing mentions of groups

#### Properties

Name

Type

Optional

Description

subject

string

The name of a group to mention (can be custom)

id

string

The group ID, e.g.: '[\[email protected\]](https://docs.wwebjs.dev/cdn-cgi/l/email-protection)'

### GroupMention  Object

#### Properties

Name

Type

Optional

Description

groupSubject

string

The name of the group

groupJid

string

The group ID

### GroupParticipant  Object

Group participant information

#### Properties

Name

Type

Optional

Description

id

[ContactId](global.html#ContactId)

isAdmin

boolean

isSuperAdmin

boolean

### LocationSendOptions  Object

Location send options

#### Properties

Name

Type

Optional

Description

name

string

Yes

Location name

address

string

Yes

Location address

url

string

Yes

URL address to be shown within a location message

description

string

Yes

Location full description

### MembershipRequestActionOptions  Object

An object that handles options for `approveGroupMembershipRequests` and `rejectGroupMembershipRequests` methods

#### Properties

Name

Type

Optional

Description

requesterIds

(Array of string, string, or null)

User ID/s who requested to join the group, if no value is provided, the method will search for all membership requests for that group

sleep

(Array of number, number, or null)

The number of milliseconds to wait before performing an operation for the next requester. If it is an array, a random sleep time between the sleep\[0\] and sleep\[1\] values will be added (the difference must be >=100 ms, otherwise, a random sleep time between sleep\[1\] and sleep\[1\] + 100 will be added). If sleep is a number, a sleep time equal to its value will be added. By default, sleep is an array with a value of \[250, 500\]

### MembershipRequestActionOptions  Object

An object that handles options for `approveGroupMembershipRequests` and `rejectGroupMembershipRequests` methods

#### Properties

Name

Type

Optional

Description

requesterIds

(Array of string, string, or null)

User ID/s who requested to join the group, if no value is provided, the method will search for all membership requests for that group

sleep

(Array of number, number, or null)

The number of milliseconds to wait before performing an operation for the next requester. If it is an array, a random sleep time between the sleep\[0\] and sleep\[1\] values will be added (the difference must be >=100 ms, otherwise, a random sleep time between sleep\[1\] and sleep\[1\] + 100 will be added). If sleep is a number, a sleep time equal to its value will be added. By default, sleep is an array with a value of \[250, 500\]

### MembershipRequestActionResult  Object

An object that handles the result for membership request action

#### Properties

Name

Type

Optional

Description

requesterId

string

User ID whos membership request was approved/rejected

error

(number or undefined)

An error code that occurred during the operation for the participant

message

string

A message with a result of membership request action

### MembershipRequestActionResult  Object

An object that handles the result for membership request action

#### Properties

Name

Type

Optional

Description

requesterId

string

User ID whos membership request was approved/rejected

error

number

An error code that occurred during the operation for the participant

message

string

A message with a result of membership request action

### MessageInfo  Object

Message Info

#### Properties

Name

Type

Optional

Description

delivery

Array of {id: [ContactId](global.html#ContactId), t: number}

Contacts to which the message has been delivered to

deliveryRemaining

number

Amount of people to whom the message has not been delivered to

played

Array of {id: [ContactId](global.html#ContactId), t: number}

Contacts who have listened to the voice message

playedRemaining

number

Amount of people who have not listened to the message

read

Array of {id: [ContactId](global.html#ContactId), t: number}

Contacts who have read the message

readRemaining

number

Amount of people who have not read the message

### MessageSendOptions  Object

Message options.

#### Properties

Name

Type

Optional

Description

linkPreview

boolean

Yes

Show links preview. Has no effect on multi-device accounts.

Defaults to `true`.

sendAudioAsVoice

boolean

Yes

Send audio as voice message with a generated waveform

Defaults to `false`.

sendVideoAsGif

boolean

Yes

Send video as gif

Defaults to `false`.

sendMediaAsSticker

boolean

Yes

Send media as a sticker

Defaults to `false`.

sendMediaAsDocument

boolean

Yes

Send media as a document

Defaults to `false`.

sendMediaAsHd

boolean

Yes

Send image as quality HD

Defaults to `false`.

isViewOnce

boolean

Yes

Send photo/video as a view once message

Defaults to `false`.

parseVCards

boolean

Yes

Automatically parse vCards and send them as contacts

Defaults to `true`.

caption

string

Yes

Image or video caption

quotedMessageId

string

Yes

Id of the message that is being quoted (or replied to)

groupMentions

Array of [GroupMention](global.html#GroupMention)

Yes

An array of object that handle group mentions

mentions

Array of string

Yes

User IDs to mention in the message

sendSeen

boolean

Yes

Mark the conversation as seen after sending the message

Defaults to `true`.

invokedBotWid

string

Yes

Bot Wid when doing a bot mention like @Meta AI

stickerAuthor

string

Yes

Sets the author of the sticker, (if sendMediaAsSticker is true).

stickerName

string

Yes

Sets the name of the sticker, (if sendMediaAsSticker is true).

stickerCategories

Array of string

Yes

Sets the categories of the sticker, (if sendMediaAsSticker is true). Provide emoji char array, can be null.

ignoreQuoteErrors

boolean

Yes

Should the bot send a quoted message without the quoted message if it fails to get the quote?

Defaults to `true`.

waitUntilMsgSent

boolean

Yes

Should the bot wait for the message send result?

Defaults to `false`.

media

[MessageMedia](MessageMedia.html)

Yes

Media to be sent

extra

any

Yes

Extra options

### MessageSendOptions  Object

Message options

#### Properties

Name

Type

Optional

Description

caption

string

Image or video caption

Value can be null.

mentions

Array of string

User IDs of user that will be mentioned in the message

Value can be null.

media

[MessageMedia](MessageMedia.html)

Image or video to be sent

Value can be null.

### ParticipantResult  Object

An object that represents the result for a participant added to a group

#### Properties

Name

Type

Optional

Description

statusCode

number

The status code of the result

message

string

The result message

isGroupCreator

boolean

Indicates if the participant is a group creator

isInviteV4Sent

boolean

Indicates if the inviteV4 was sent to the participant

### PollSendOptions  Object

Poll send options

#### Properties

Name

Type

Optional

Description

allowMultipleAnswers

boolean

Yes

If false it is a single choice poll, otherwise it is a multiple choice poll (false by default)

Defaults to `false`.

messageSecret

Array of number

The custom message secret, can be used as a poll ID. NOTE: it has to be a unique vector with a length of 32

Value can be null.

### ReactionList  Object

Reaction List

#### Properties

Name

Type

Optional

Description

id

string

Original emoji

aggregateEmoji

string

aggregate emoji

hasReactionByMe

boolean

Flag who sent the reaction

senders

Array of [Reaction](Reaction.html)

Reaction senders, to this message

### ScheduledEventSendOptions  Object

ScheduledEvent send options

#### Properties

Name

Type

Optional

Description

description

string

The scheduled event description

Value can be null.

endTime

Date

The end time of the event

Value can be null.

location

string

The location of the event

Value can be null.

callType

string

The type of a WhatsApp call link to generate, valid values are: `video` | `voice`

Value can be null.

isEventCanceled

boolean

Yes

Indicates if a scheduled event should be sent as an already canceled

Defaults to `false`.

messageSecret

Array of number

The custom message secret, can be used as an event ID. NOTE: it has to be a unique vector with a length of 32

Value can be null.

### SelectedPollOption  Object

Selected poll option structure

#### Properties

Name

Type

Optional

Description

id

number

The local selected or deselected option ID

name

string

The option name

### SendChannelAdminInviteOptions  Object

#### Property

Name

Type

Optional

Description

comment

string

The comment to be added to an invitation

Value can be null.

### SendChannelAdminInviteOptions  Object

#### Property

Name

Type

Optional

Description

comment

string

The comment to be added to an invitation

Value can be null.

### StickerMetadata  Object

Sticker metadata.

#### Properties

Name

Type

Optional

Description

name

string

Yes

author

string

Yes

categories

Array of string

Yes

### TargetOptions  Object

Target options object description

#### Properties

Name

Type

Optional

Description

module

(string or number)

The name or a key of the target module to search

index

number

The index value of the target module

function

string

The function name to get from a module

### TargetOptions  Object

Target options object description

#### Properties

Name

Type

Optional

Description

module

(string or number)

The target module

function

string

The function name to get from a module

### TransferChannelOwnershipOptions  Object

Options for transferring a channel ownership to another user

#### Property

Name

Type

Optional

Description

shouldDismissSelfAsAdmin

boolean

Yes

If true, after the channel ownership is being transferred to another user, the current user will be dismissed as a channel admin and will become to a channel subscriber.

Defaults to `false`.

### TransferChannelOwnershipOptions  Object

Options for transferring a channel ownership to another user

#### Property

Name

Type

Optional

Description

shouldDismissSelfAsAdmin

boolean

Yes

If true, after the channel ownership is being transferred to another user, the current user will be dismissed as a channel admin and will become to a channel subscriber.

Defaults to `false`.

### UnsubscribeOptions  Object

Options for unsubscribe from a channel

#### Property

Name

Type

Optional

Description

deleteLocalModels

boolean

Yes

If true, after an unsubscription, it will completely remove a channel from the channel collection making it seem like the current user have never interacted with it. Otherwise it will only remove a channel from the list of channels the current user is subscribed to and will set the membership type for that channel to GUEST

Defaults to `false`.

Generated by [JSDoc](https://github.com/jsdoc3/jsdoc) 3.6.11 on September 10, 2025.
