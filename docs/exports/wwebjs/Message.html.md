---
source: https://docs.wwebjs.dev/Message.html
captured_at: 2025-10-23T16:01:24.052Z
---
[whatsapp-web.js 1.34.1](index.html)

class

# Message

Source: [structures/Message.js:17](structures_Message.js.html#source-line-17)

Represents a Message on WhatsApp

## Properties

[ack](Message.html#ack)

[author](Message.html#author)

[body](Message.html#body)

[broadcast](Message.html#broadcast)

[deviceType](Message.html#deviceType)

[duration](Message.html#duration)

[forwardingScore](Message.html#forwardingScore)

[from](Message.html#from)

[fromMe](Message.html#fromMe)

[groupMentions](Message.html#groupMentions)

[hasMedia](Message.html#hasMedia)

[hasQuotedMsg](Message.html#hasQuotedMsg)

[hasReaction](Message.html#hasReaction)

[id](Message.html#id)

[inviteV4](Message.html#inviteV4)

[isEphemeral](Message.html#isEphemeral)

[isForwarded](Message.html#isForwarded)

[isGif](Message.html#isGif)

[isStarred](Message.html#isStarred)

[isStatus](Message.html#isStatus)

[links](Message.html#links)

[location](Message.html#location)

[mediaKey](Message.html#mediaKey)

[mentionedIds](Message.html#mentionedIds)

[orderId](Message.html#orderId)

[rawData](Message.html#rawData)

[timestamp](Message.html#timestamp)

[to](Message.html#to)

[token](Message.html#token)

[type](Message.html#type)

[vCards](Message.html#vCards)

## Methods

[acceptGroupV4Invite()](Message.html#acceptGroupV4Invite)

[delete(everyone\[, clearMedia\])](Message.html#delete)

[downloadMedia()](Message.html#downloadMedia)

[edit(content\[, options\])](Message.html#edit)

[editScheduledEvent(editedEventObject)](Message.html#editScheduledEvent)

[forward(chat)](Message.html#forward)

[getChat()](Message.html#getChat)

[getContact()](Message.html#getContact)

[getGroupMentions()](Message.html#getGroupMentions)

[getInfo()](Message.html#getInfo)

[getMentions()](Message.html#getMentions)

[getOrder()](Message.html#getOrder)

[getPayment()](Message.html#getPayment)

[getQuotedMessage()](Message.html#getQuotedMessage)

[getReactions()](Message.html#getReactions)

[pin(duration)](Message.html#pin)

[react(reaction)](Message.html#react)

[reload()](Message.html#reload)

[reply(content\[, chatId\]\[, options\])](Message.html#reply)

[star()](Message.html#star)

[unpin()](Message.html#unpin)

[unstar()](Message.html#unstar)

## new Message()

Extends

[Base](Base.html)

## Properties

### ack  [MessageAck](global.html#MessageAck)

ACK status for the message

### author  string

If the message was sent to a group, this field will contain the user that sent the message.

### body  string

Message content

### broadcast  boolean

Indicates if the message was a broadcast

### deviceType  string

String that represents from which device type the message was sent

### duration  string

Indicates the duration of the message in seconds

### forwardingScore  number

Indicates how many times the message was forwarded.

The maximum value is 127.

### from  string

ID for the Chat that this message was sent to, except if the message was sent by the current user.

### fromMe  boolean

Indicates if the message was sent by the current user

### groupMentions  Array of [GroupMention](global.html#GroupMention)

Indicates whether there are group mentions in the message body

### hasMedia  boolean

Indicates if the message has media available for download

### hasQuotedMsg  boolean

Indicates if the message was sent as a reply to another message.

### hasReaction  boolean

Indicates whether there are reactions to the message

### id  object

ID that represents the message

### inviteV4  object

Group Invite Data

### isEphemeral  boolean

Indicates if the message will disappear after it expires

### isForwarded  boolean

Indicates if the message was forwarded

### isGif  boolean

Indicates whether the message is a Gif

### isStarred  boolean

Indicates if the message was starred

### isStatus  boolean

Indicates if the message is a status update

### links  Array of {link: string, isSuspicious: boolean}

Links included in the message.

### location  [Location](Location.html)

Location information contained in the message, if the message is type "location"

### mediaKey  string

MediaKey that represents the sticker 'ID'

### mentionedIds  Array of string

Indicates the mentions in the message body.

### orderId  string

Order ID for message type ORDER

### rawData  Object

Returns message in a raw format

### timestamp  number

Unix timestamp for when the message was created

### to  string

ID for who this message is for.

If the message is sent by the current user, it will be the Chat to which the message is being sent. If the message is sent by another user, it will be the ID for the current user.

### token  string

Order Token for message type ORDER

### type  [MessageTypes](global.html#MessageTypes)

Message type

### vCards  Array of string

List of vCards contained in the message.

## Methods

async

### acceptGroupV4Invite() → Promise containing Object

Accept Group V4 Invite

Returns

`Promise containing Object` 

async

### delete(everyone\[, clearMedia\])

Deletes a message from the chat

#### Parameters

Name

Type

Optional

Description

everyone

boolean

If true and the message is sent by the current user or the user is an admin, will delete it for everyone in the chat.

Value can be null.

clearMedia

boolean

Yes

If true, any associated media will also be deleted from a device.

Value can be null. Defaults to `true`.

async

### downloadMedia() → Promise containing [MessageMedia](MessageMedia.html)

Downloads and returns the attatched message media

Returns

`Promise containing [MessageMedia](MessageMedia.html)` 

async

### edit(content\[, options\]) → Promise containing nullable [Message](Message.html)

Edits the current message.

#### Parameters

Name

Type

Optional

Description

content

string

options

MessageEditOptions

Yes

Options used when editing the message

Returns

`Promise containing nullable [Message](Message.html)` 

async

### editScheduledEvent(editedEventObject) → Promise containing nullable [Message](Message.html)

Edits the current ScheduledEvent message. Once the scheduled event is canceled, it can not be edited.

#### Parameter

Name

Type

Optional

Description

editedEventObject

[ScheduledEvent](ScheduledEvent.html)

Returns

`Promise containing nullable [Message](Message.html)` 

async

### forward(chat) → Promise

Forwards this message to another chat (that you chatted before, otherwise it will fail)

#### Parameter

Name

Type

Optional

Description

chat

(string or [Chat](Chat.html))

Chat model or chat ID to which the message will be forwarded

Returns

`Promise` 

### getChat() → Promise containing [Chat](Chat.html)

Returns the Chat this message was sent in

Returns

`Promise containing [Chat](Chat.html)` 

### getContact() → Promise containing [Contact](Contact.html)

Returns the Contact this message was sent from

Returns

`Promise containing [Contact](Contact.html)` 

async

### getGroupMentions()

Returns groups mentioned in this message

Returns

async

### getInfo() → Promise containing nullable [MessageInfo](global.html#MessageInfo)

Get information about message delivery status. May return null if the message does not exist or is not sent by you.

Returns

`Promise containing nullable [MessageInfo](global.html#MessageInfo)` 

async

### getMentions() → Promise containing Array of [Contact](Contact.html)

Returns the Contacts mentioned in this message

Returns

`Promise containing Array of [Contact](Contact.html)` 

async

### getOrder() → Promise containing [Order](Order.html)

Gets the order associated with a given message

Returns

`Promise containing [Order](Order.html)` 

async

### getPayment() → Promise containing [Payment](Payment.html)

Gets the payment details associated with a given message

Returns

`Promise containing [Payment](Payment.html)` 

async

### getQuotedMessage() → Promise containing [Message](Message.html)

Returns the quoted message, if any

Returns

`Promise containing [Message](Message.html)` 

async

### getReactions() → Promise containing Array of [ReactionList](global.html#ReactionList)

Gets the reactions associated with the given message

Returns

`Promise containing Array of [ReactionList](global.html#ReactionList)` 

async

### pin(duration) → Promise containing boolean

Pins the message (group admins can pin messages of all group members)

#### Parameter

Name

Type

Optional

Description

duration

number

The duration in seconds the message will be pinned in a chat

Returns

`Promise containing boolean` 

Returns true if the operation completed successfully, false otherwise

async

### react(reaction) → Promise

React to this message with an emoji

#### Parameter

Name

Type

Optional

Description

reaction

string

Emoji to react with. Send an empty string to remove the reaction.

Returns

`Promise` 

async

### reload() → Promise containing [Message](Message.html)

Reloads this Message object's data in-place with the latest values from WhatsApp Web. Note that the Message must still be in the web app cache for this to work, otherwise will return null.

Returns

`Promise containing [Message](Message.html)` 

async

### reply(content\[, chatId\]\[, options\]) → Promise containing [Message](Message.html)

Sends a message as a reply to this message. If chatId is specified, it will be sent through the specified Chat. If not, it will send the message in the same Chat as the original message was sent.

#### Parameters

Name

Type

Optional

Description

content

(string, [MessageMedia](MessageMedia.html), or [Location](Location.html))

chatId

string

Yes

options

[MessageSendOptions](global.html#MessageSendOptions)

Yes

Returns

`Promise containing [Message](Message.html)` 

async

### star()

Stars this message

async

### unpin() → Promise containing boolean

Unpins the message (group admins can unpin messages of all group members)

Returns

`Promise containing boolean` 

Returns true if the operation completed successfully, false otherwise

async

### unstar()

Unstars this message

Generated by [JSDoc](https://github.com/jsdoc3/jsdoc) 3.6.11 on September 10, 2025.
