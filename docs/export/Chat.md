whatsapp-web.js 1.34.1 &raquo; Class: Chat

        [whatsapp-web.js 1.34.1](index.html)

            class
            # Chat

            Source: [structures/Chat.js:10](structures_Chat.js.html#source-line-10)

              Represents a Chat on WhatsApp

              ## Properties

                    [archived](Chat.html#archived)

                    [id](Chat.html#id)

                    [isGroup](Chat.html#isGroup)

                    [isMuted](Chat.html#isMuted)

                    [isReadOnly](Chat.html#isReadOnly)

                    [lastMessage](Chat.html#lastMessage)

                    [muteExpiration](Chat.html#muteExpiration)

                    [name](Chat.html#name)

                    [pinned](Chat.html#pinned)

                    [timestamp](Chat.html#timestamp)

                    [unreadCount](Chat.html#unreadCount)

              ## Methods

                    [addOrEditCustomerNote(note)](Chat.html#addOrEditCustomerNote)

                    [archive()](Chat.html#archive)

                    [changeLabels(labelIds)](Chat.html#changeLabels)

                    [clearMessages()](Chat.html#clearMessages)

                    [clearState()](Chat.html#clearState)

                    [delete()](Chat.html#delete)

                    [fetchMessages(searchOptions)](Chat.html#fetchMessages)

                    [getContact()](Chat.html#getContact)

                    [getCustomerNote()](Chat.html#getCustomerNote)

                    [getLabels()](Chat.html#getLabels)

                    [getPinnedMessages()](Chat.html#getPinnedMessages)

                    [markUnread()](Chat.html#markUnread)

                    [mute(unmuteDate)](Chat.html#mute)

                    [pin()](Chat.html#pin)

                    [sendMessage(content[, options])](Chat.html#sendMessage)

                    [sendSeen()](Chat.html#sendSeen)

                    [sendStateRecording()](Chat.html#sendStateRecording)

                    [sendStateTyping()](Chat.html#sendStateTyping)

                    [syncHistory()](Chat.html#syncHistory)

                    [unarchive()](Chat.html#unarchive)

                    [unmute()](Chat.html#unmute)

                    [unpin()](Chat.html#unpin)

            ## new&nbsp;Chat()

              Extends
              [Base](Base.html)

            ## Properties

              archived
                  &nbsp;boolean
              Indicates if the Chat is archived

              id
                  &nbsp;object
              ID that represents the chat

              isGroup
                  &nbsp;boolean
              Indicates if the Chat is a Group Chat

              isMuted
                  &nbsp;boolean
              Indicates if the chat is muted or not

              isReadOnly
                  &nbsp;boolean
              Indicates if the Chat is readonly

              lastMessage
                  &nbsp;[Message](Message.html)
              Last message fo chat

              muteExpiration
                  &nbsp;number
              Unix timestamp for when the mute expires

              name
                  &nbsp;string
              Title of the chat

              pinned
                  &nbsp;boolean
              Indicates if the Chat is pinned

              timestamp
                  &nbsp;number
              Unix timestamp for when the last activity occurred

              unreadCount
                  &nbsp;number
              Amount of messages unread

            ## Methods

              async
              ### addOrEditCustomerNote(note)&nbsp;&rarr;  Promise containing void

              Add or edit a customer note

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        note

                        string

                        &nbsp;

                        The note to add

                See also
                [https://faq.whatsapp.com/1433099287594476](https://faq.whatsapp.com/1433099287594476)
                Returns
                
                  `Promise containing void` 

              async
              ### archive()

              Archives this chat

              async
              ### changeLabels(labelIds)&nbsp;&rarr;  Promise containing void

              Add or remove labels to this Chat

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        labelIds

                        Array of (number or string)

                        &nbsp;

                Returns
                
                  `Promise containing void` 

              async
              ### clearMessages()&nbsp;&rarr;  Promise containing boolean

              Clears all messages from the chat

                Returns
                
                  `Promise containing boolean` 
                  result

              async
              ### clearState()

              Stops typing or recording in chat immediately.

              async
              ### delete()&nbsp;&rarr;  Promise containing Boolean

              Deletes the chat

                Returns
                
                  `Promise containing Boolean` 
                  result

              async
              ### fetchMessages(searchOptions)&nbsp;&rarr;  Promise containing Array of [Message](Message.html)

              Loads chat messages, sorted from earliest to latest.

                #### Parameters

                      Name
                      Type
                      Optional
                      Description

                        searchOptions

                        Object

                        &nbsp;

                        Options for searching messages. Right now only limit and fromMe is supported.

                        Values in `searchOptions` have the following properties:

                              Name
                              Type
                              Optional
                              Description

                                limit

                                Number

                                Yes

                                The amount of messages to return. If no limit is specified, the available messages will be returned. Note that the actual number of returned messages may be smaller if there aren't enough messages in the conversation. Set this to Infinity to load all messages.

                                fromMe

                                Boolean

                                Yes

                                Return only messages from the bot number or vise versa. To get all messages, leave the option undefined.

                Returns
                
                  `Promise containing Array of [Message](Message.html)` 

              async
              ### getContact()&nbsp;&rarr;  Promise containing [Contact](Contact.html)

              Returns the Contact that corresponds to this Chat.

                Returns
                
                  `Promise containing [Contact](Contact.html)` 

              async
              ### getCustomerNote()&nbsp;&rarr;  Promise containing {chatId: string, content: string, createdAt: number, id: string, modifiedAt: number, type: string}

              Get a customer note

                See also
                [https://faq.whatsapp.com/1433099287594476](https://faq.whatsapp.com/1433099287594476)
                Returns
                
                  `Promise containing {chatId: string, content: string, createdAt: number, id: string, modifiedAt: number, type: string}` 

              async
              ### getLabels()&nbsp;&rarr;  Promise containing Array of [Label](Label.html)

              Returns array of all Labels assigned to this Chat

                Returns
                
                  `Promise containing Array of [Label](Label.html)` 

              async
              ### getPinnedMessages()

              Gets instances of all pinned messages in a chat

                Returns

              async
              ### markUnread()

              Mark this chat as unread

              async
              ### mute(unmuteDate)&nbsp;&rarr;  Promise containing {isMuted: boolean, muteExpiration: number}

              Mutes this chat forever, unless a date is specified

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        unmuteDate

                        Date

                        &nbsp;

                        Date when the chat will be unmuted, don't provide a value to mute forever

                        Value can be null.

                Returns
                
                  `Promise containing {isMuted: boolean, muteExpiration: number}` 

              async
              ### pin()&nbsp;&rarr;  Promise containing boolean

              Pins this chat

                Returns
                
                  `Promise containing boolean` 
                  New pin state. Could be false if the max number of pinned chats was reached.

              async
              ### sendMessage(content[, options])&nbsp;&rarr;  Promise containing [Message](Message.html)

              Send a message to this chat

                #### Parameters

                      Name
                      Type
                      Optional
                      Description

                        content

                        (string, [MessageMedia](MessageMedia.html), or [Location](Location.html))

                        &nbsp;

                        options

                        [MessageSendOptions](global.html#MessageSendOptions)

                        Yes

                Returns
                
                  `Promise containing [Message](Message.html)` 
                  Message that was just sent

              async
              ### sendSeen()&nbsp;&rarr;  Promise containing Boolean

              Sets the chat as seen

                Returns
                
                  `Promise containing Boolean` 
                  result

              async
              ### sendStateRecording()

              Simulate recording audio in chat. This will last for 25 seconds.

              async
              ### sendStateTyping()

              Simulate typing in chat. This will last for 25 seconds.

              async
              ### syncHistory()&nbsp;&rarr;  Promise containing boolean

              Sync chat history conversation

                Returns
                
                  `Promise containing boolean` 
                  True if operation completed successfully, false otherwise.

              async
              ### unarchive()

              un-archives this chat

              async
              ### unmute()&nbsp;&rarr;  Promise containing {isMuted: boolean, muteExpiration: number}

              Unmutes this chat

                Returns
                
                  `Promise containing {isMuted: boolean, muteExpiration: number}` 

              async
              ### unpin()&nbsp;&rarr;  Promise containing boolean

              Unpins this chat

                Returns
                
                  `Promise containing boolean` 
                  New pin state

        Generated by [JSDoc](https://github.com/jsdoc3/jsdoc) 3.6.11 on October 23, 2025.