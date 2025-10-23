---
source: https://docs.wwebjs.dev/PrivateChat.html
captured_at: 2025-10-23T16:01:26.203Z
---
[whatsapp-web.js 1.34.1](index.html)

class

# PrivateChat

Source: [structures/PrivateChat.js:9](structures_PrivateChat.js.html#source-line-9)

Represents a Private Chat on WhatsApp

## Properties

[archived](PrivateChat.html#archived)

[id](PrivateChat.html#id)

[isGroup](PrivateChat.html#isGroup)

[isMuted](PrivateChat.html#isMuted)

[isReadOnly](PrivateChat.html#isReadOnly)

[lastMessage](PrivateChat.html#lastMessage)

[muteExpiration](PrivateChat.html#muteExpiration)

[name](PrivateChat.html#name)

[pinned](PrivateChat.html#pinned)

[timestamp](PrivateChat.html#timestamp)

[unreadCount](PrivateChat.html#unreadCount)

## Methods

[archive()](PrivateChat.html#archive)

[changeLabels(labelIds)](PrivateChat.html#changeLabels)

[clearMessages()](PrivateChat.html#clearMessages)

[clearState()](PrivateChat.html#clearState)

[delete()](PrivateChat.html#delete)

[fetchMessages(searchOptions)](PrivateChat.html#fetchMessages)

[getContact()](PrivateChat.html#getContact)

[getLabels()](PrivateChat.html#getLabels)

[getPinnedMessages()](PrivateChat.html#getPinnedMessages)

[markUnread()](PrivateChat.html#markUnread)

[mute(unmuteDate)](PrivateChat.html#mute)

[pin()](PrivateChat.html#pin)

[sendMessage(content\[, options\])](PrivateChat.html#sendMessage)

[sendSeen()](PrivateChat.html#sendSeen)

[sendStateRecording()](PrivateChat.html#sendStateRecording)

[sendStateTyping()](PrivateChat.html#sendStateTyping)

[syncHistory()](PrivateChat.html#syncHistory)

[unarchive()](PrivateChat.html#unarchive)

[unmute()](PrivateChat.html#unmute)

[unpin()](PrivateChat.html#unpin)

## new PrivateChat()

Extends

[Chat](Chat.html)

## Properties

### archived  unknown

Indicates if the Chat is archived

Inherited from

[Chat#archived](Chat.html#archived)

### id  unknown

ID that represents the chat

Inherited from

[Chat#id](Chat.html#id)

### isGroup  unknown

Indicates if the Chat is a Group Chat

Inherited from

[Chat#isGroup](Chat.html#isGroup)

### isMuted  unknown

Indicates if the chat is muted or not

Inherited from

[Chat#isMuted](Chat.html#isMuted)

### isReadOnly  unknown

Indicates if the Chat is readonly

Inherited from

[Chat#isReadOnly](Chat.html#isReadOnly)

### lastMessage  unknown

Last message fo chat

Inherited from

[Chat#lastMessage](Chat.html#lastMessage)

### muteExpiration  unknown

Unix timestamp for when the mute expires

Inherited from

[Chat#muteExpiration](Chat.html#muteExpiration)

### name  unknown

Title of the chat

Inherited from

[Chat#name](Chat.html#name)

### pinned  unknown

Indicates if the Chat is pinned

Inherited from

[Chat#pinned](Chat.html#pinned)

### timestamp  unknown

Unix timestamp for when the last activity occurred

Inherited from

[Chat#timestamp](Chat.html#timestamp)

### unreadCount  unknown

Amount of messages unread

Inherited from

[Chat#unreadCount](Chat.html#unreadCount)

## Methods

async

### archive()

Archives this chat

Inherited from

[Chat#archive](Chat.html#archive)

async

### changeLabels(labelIds) → Promise containing void

Add or remove labels to this Chat

#### Parameter

Name

Type

Optional

Description

labelIds

Inherited from

[Chat#changeLabels](Chat.html#changeLabels)

Returns

async

### clearMessages() → Promise containing boolean

Clears all messages from the chat

Inherited from

[Chat#clearMessages](Chat.html#clearMessages)

Returns

result

async

### clearState()

Stops typing or recording in chat immediately.

Inherited from

[Chat#clearState](Chat.html#clearState)

async

### delete() → Promise containing Boolean

Deletes the chat

Inherited from

[Chat#delete](Chat.html#delete)

Returns

result

async

### fetchMessages(searchOptions) → Promise containing Array of [Message](Message.html)

Loads chat messages, sorted from earliest to latest.

#### Parameters

Name

Type

Optional

Description

searchOptions

Options for searching messages. Right now only limit and fromMe is supported.

Values in `searchOptions` have the following properties:

Name

Type

Optional

Description

limit

Yes

The amount of messages to return. If no limit is specified, the available messages will be returned. Note that the actual number of returned messages may be smaller if there aren't enough messages in the conversation. Set this to Infinity to load all messages.

fromMe

Yes

Return only messages from the bot number or vise versa. To get all messages, leave the option undefined.

Inherited from

[Chat#fetchMessages](Chat.html#fetchMessages)

Returns

async

### getContact() → Promise containing [Contact](Contact.html)

Returns the Contact that corresponds to this Chat.

Inherited from

[Chat#getContact](Chat.html#getContact)

Returns

async

### getLabels() → Promise containing Array of [Label](Label.html)

Returns array of all Labels assigned to this Chat

Inherited from

[Chat#getLabels](Chat.html#getLabels)

Returns

async

### getPinnedMessages()

Gets instances of all pinned messages in a chat

Inherited from

[Chat#getPinnedMessages](Chat.html#getPinnedMessages)

Returns

async

### markUnread()

Mark this chat as unread

Inherited from

[Chat#markUnread](Chat.html#markUnread)

async

### mute(unmuteDate) → Promise containing {isMuted: boolean, muteExpiration: number}

Mutes this chat forever, unless a date is specified

#### Parameter

Name

Type

Optional

Description

unmuteDate

Date when the chat will be unmuted, don't provide a value to mute forever

Value can be null.

Inherited from

[Chat#mute](Chat.html#mute)

Returns

async

### pin() → Promise containing boolean

Pins this chat

Inherited from

[Chat#pin](Chat.html#pin)

Returns

New pin state. Could be false if the max number of pinned chats was reached.

async

### sendMessage(content\[, options\]) → Promise containing [Message](Message.html)

Send a message to this chat

#### Parameters

Name

Type

Optional

Description

content

options

Yes

Inherited from

[Chat#sendMessage](Chat.html#sendMessage)

Returns

Message that was just sent

async

### sendSeen() → Promise containing Boolean

Sets the chat as seen

Inherited from

[Chat#sendSeen](Chat.html#sendSeen)

Returns

result

async

### sendStateRecording()

Simulate recording audio in chat. This will last for 25 seconds.

Inherited from

[Chat#sendStateRecording](Chat.html#sendStateRecording)

async

### sendStateTyping()

Simulate typing in chat. This will last for 25 seconds.

Inherited from

[Chat#sendStateTyping](Chat.html#sendStateTyping)

async

### syncHistory() → Promise containing boolean

Sync chat history conversation

Inherited from

[Chat#syncHistory](Chat.html#syncHistory)

Returns

True if operation completed successfully, false otherwise.

async

### unarchive()

un-archives this chat

Inherited from

[Chat#unarchive](Chat.html#unarchive)

async

### unmute() → Promise containing {isMuted: boolean, muteExpiration: number}

Unmutes this chat

Inherited from

[Chat#unmute](Chat.html#unmute)

Returns

async

### unpin() → Promise containing boolean

Unpins this chat

Inherited from

[Chat#unpin](Chat.html#unpin)

Returns

New pin state

Generated by [JSDoc](https://github.com/jsdoc3/jsdoc) 3.6.11 on September 10, 2025.
