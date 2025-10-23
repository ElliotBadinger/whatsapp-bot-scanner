whatsapp-web.js 1.34.1 &raquo; Class: GroupChat

        [whatsapp-web.js 1.34.1](index.html)

            class
            # GroupChat

            Source: [structures/GroupChat.js:17](structures_GroupChat.js.html#source-line-17)

              Represents a Group Chat on WhatsApp

              ## Properties

                    [archived](GroupChat.html#archived)

                    [createdAt](GroupChat.html#createdAt)

                    [description](GroupChat.html#description)

                    [id](GroupChat.html#id)

                    [isGroup](GroupChat.html#isGroup)

                    [isMuted](GroupChat.html#isMuted)

                    [isReadOnly](GroupChat.html#isReadOnly)

                    [lastMessage](GroupChat.html#lastMessage)

                    [muteExpiration](GroupChat.html#muteExpiration)

                    [name](GroupChat.html#name)

                    [owner](GroupChat.html#owner)

                    [participants](GroupChat.html#participants)

                    [pinned](GroupChat.html#pinned)

                    [timestamp](GroupChat.html#timestamp)

                    [unreadCount](GroupChat.html#unreadCount)

              ## Methods

                    [addOrEditCustomerNote(note)](GroupChat.html#addOrEditCustomerNote)

                    [addParticipants(participantIds, options)](GroupChat.html#addParticipants)

                    [approveGroupMembershipRequests(options)](GroupChat.html#approveGroupMembershipRequests)

                    [archive()](GroupChat.html#archive)

                    [changeLabels(labelIds)](GroupChat.html#changeLabels)

                    [clearMessages()](GroupChat.html#clearMessages)

                    [clearState()](GroupChat.html#clearState)

                    [delete()](GroupChat.html#delete)

                    [deletePicture()](GroupChat.html#deletePicture)

                    [demoteParticipants(participantIds)](GroupChat.html#demoteParticipants)

                    [fetchMessages(searchOptions)](GroupChat.html#fetchMessages)

                    [getContact()](GroupChat.html#getContact)

                    [getCustomerNote()](GroupChat.html#getCustomerNote)

                    [getGroupMembershipRequests()](GroupChat.html#getGroupMembershipRequests)

                    [getInviteCode()](GroupChat.html#getInviteCode)

                    [getLabels()](GroupChat.html#getLabels)

                    [getPinnedMessages()](GroupChat.html#getPinnedMessages)

                    [leave()](GroupChat.html#leave)

                    [markUnread()](GroupChat.html#markUnread)

                    [mute(unmuteDate)](GroupChat.html#mute)

                    [pin()](GroupChat.html#pin)

                    [promoteParticipants(participantIds)](GroupChat.html#promoteParticipants)

                    [rejectGroupMembershipRequests(options)](GroupChat.html#rejectGroupMembershipRequests)

                    [removeParticipants(participantIds)](GroupChat.html#removeParticipants)

                    [revokeInvite()](GroupChat.html#revokeInvite)

                    [sendMessage(content[, options])](GroupChat.html#sendMessage)

                    [sendSeen()](GroupChat.html#sendSeen)

                    [sendStateRecording()](GroupChat.html#sendStateRecording)

                    [sendStateTyping()](GroupChat.html#sendStateTyping)

                    [setAddMembersAdminsOnly([adminsOnly])](GroupChat.html#setAddMembersAdminsOnly)

                    [setDescription(description)](GroupChat.html#setDescription)

                    [setInfoAdminsOnly([adminsOnly])](GroupChat.html#setInfoAdminsOnly)

                    [setMessagesAdminsOnly([adminsOnly])](GroupChat.html#setMessagesAdminsOnly)

                    [setPicture(media)](GroupChat.html#setPicture)

                    [setSubject(subject)](GroupChat.html#setSubject)

                    [syncHistory()](GroupChat.html#syncHistory)

                    [unarchive()](GroupChat.html#unarchive)

                    [unmute()](GroupChat.html#unmute)

                    [unpin()](GroupChat.html#unpin)

            ## new&nbsp;GroupChat()

              Extends
              [Chat](Chat.html)

            ## Properties

              archived
                  &nbsp;unknown
              Indicates if the Chat is archived

                Inherited from
                [Chat#archived](Chat.html#archived)
              
              createdAt
                  &nbsp;date
              Gets the date at which the group was created

              description
                  &nbsp;string
              Gets the group description

              id
                  &nbsp;unknown
              ID that represents the chat

                Inherited from
                [Chat#id](Chat.html#id)
              
              isGroup
                  &nbsp;unknown
              Indicates if the Chat is a Group Chat

                Inherited from
                [Chat#isGroup](Chat.html#isGroup)
              
              isMuted
                  &nbsp;unknown
              Indicates if the chat is muted or not

                Inherited from
                [Chat#isMuted](Chat.html#isMuted)
              
              isReadOnly
                  &nbsp;unknown
              Indicates if the Chat is readonly

                Inherited from
                [Chat#isReadOnly](Chat.html#isReadOnly)
              
              lastMessage
                  &nbsp;unknown
              Last message fo chat

                Inherited from
                [Chat#lastMessage](Chat.html#lastMessage)
              
              muteExpiration
                  &nbsp;unknown
              Unix timestamp for when the mute expires

                Inherited from
                [Chat#muteExpiration](Chat.html#muteExpiration)
              
              name
                  &nbsp;unknown
              Title of the chat

                Inherited from
                [Chat#name](Chat.html#name)
              
              owner
                  &nbsp;[ContactId](global.html#ContactId)
              Gets the group owner

              participants
                  &nbsp;Array of [GroupParticipant](global.html#GroupParticipant)
              Gets the group participants

              pinned
                  &nbsp;unknown
              Indicates if the Chat is pinned

                Inherited from
                [Chat#pinned](Chat.html#pinned)
              
              timestamp
                  &nbsp;unknown
              Unix timestamp for when the last activity occurred

                Inherited from
                [Chat#timestamp](Chat.html#timestamp)
              
              unreadCount
                  &nbsp;unknown
              Amount of messages unread

                Inherited from
                [Chat#unreadCount](Chat.html#unreadCount)

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

                        &nbsp;

                        &nbsp;

                        The note to add

                Inherited from
                [Chat#addOrEditCustomerNote](Chat.html#addOrEditCustomerNote)
                See also
                [https://faq.whatsapp.com/1433099287594476](https://faq.whatsapp.com/1433099287594476)
                Returns

              async
              ### addParticipants(participantIds, options)&nbsp;&rarr;  Promise containing (Object with [AddParticipantsResult](global.html#AddParticipantsResult) properties or string)

              Adds a list of participants by ID to the group

                #### Parameters

                      Name
                      Type
                      Optional
                      Description

                        participantIds

                        (string or Array of string)

                        &nbsp;

                        options

                        [AddParticipnatsOptions](global.html#AddParticipnatsOptions)

                        &nbsp;

                        An object thay handles options for adding participants

                Returns
                
                  `Promise containing (Object with [AddParticipantsResult](global.html#AddParticipantsResult) properties or string)` 
                  Returns an object with the resulting data or an error message as a string

              async
              ### approveGroupMembershipRequests(options)&nbsp;&rarr;  Promise containing Array of [MembershipRequestActionResult](global.html#MembershipRequestActionResult)

              Approves membership requests if any

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        options

                        [MembershipRequestActionOptions](global.html#MembershipRequestActionOptions)

                        &nbsp;

                        Options for performing a membership request action

                Returns
                
                  `Promise containing Array of [MembershipRequestActionResult](global.html#MembershipRequestActionResult)` 
                  Returns an array of requester IDs whose membership requests were approved and an error for each requester, if any occurred during the operation. If there are no requests, an empty array will be returned

              async
              ### archive()

              Archives this chat

                Inherited from
                [Chat#archive](Chat.html#archive)
              
              async
              ### changeLabels(labelIds)&nbsp;&rarr;  Promise containing void

              Add or remove labels to this Chat

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        labelIds

                        &nbsp;

                        &nbsp;

                Inherited from
                [Chat#changeLabels](Chat.html#changeLabels)
                Returns

              async
              ### clearMessages()&nbsp;&rarr;  Promise containing boolean

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
              ### delete()&nbsp;&rarr;  Promise containing Boolean

              Deletes the chat

                Inherited from
                [Chat#delete](Chat.html#delete)
                Returns
                
                  result

              async
              ### deletePicture()&nbsp;&rarr;  Promise containing boolean

              Deletes the group's picture.

                Returns
                
                  `Promise containing boolean` 
                  Returns true if the picture was properly deleted. This can return false if the user does not have the necessary permissions.

              async
              ### demoteParticipants(participantIds)&nbsp;&rarr;  Promise containing {status: number}

              Demotes participants by IDs to regular users

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        participantIds

                        Array of string

                        &nbsp;

                Returns
                
                  `Promise containing {status: number}` 
                  Object with status code indicating if the operation was successful

              async
              ### fetchMessages(searchOptions)&nbsp;&rarr;  Promise containing Array of [Message](Message.html)

              Loads chat messages, sorted from earliest to latest.

                #### Parameters

                      Name
                      Type
                      Optional
                      Description

                        searchOptions

                        &nbsp;

                        &nbsp;

                        Options for searching messages. Right now only limit and fromMe is supported.

                        Values in `searchOptions` have the following properties:

                              Name
                              Type
                              Optional
                              Description

                                limit

                                &nbsp;

                                Yes

                                The amount of messages to return. If no limit is specified, the available messages will be returned. Note that the actual number of returned messages may be smaller if there aren't enough messages in the conversation. Set this to Infinity to load all messages.

                                fromMe

                                &nbsp;

                                Yes

                                Return only messages from the bot number or vise versa. To get all messages, leave the option undefined.

                Inherited from
                [Chat#fetchMessages](Chat.html#fetchMessages)
                Returns

              async
              ### getContact()&nbsp;&rarr;  Promise containing [Contact](Contact.html)

              Returns the Contact that corresponds to this Chat.

                Inherited from
                [Chat#getContact](Chat.html#getContact)
                Returns

              async
              ### getCustomerNote()&nbsp;&rarr;  Promise containing {chatId: string, content: string, createdAt: number, id: string, modifiedAt: number, type: string}

              Get a customer note

                Inherited from
                [Chat#getCustomerNote](Chat.html#getCustomerNote)
                See also
                [https://faq.whatsapp.com/1433099287594476](https://faq.whatsapp.com/1433099287594476)
                Returns

              async
              ### getGroupMembershipRequests()&nbsp;&rarr;  Promise containing Array of [GroupMembershipRequest](global.html#GroupMembershipRequest)

              Gets an array of membership requests

                Returns
                
                  `Promise containing Array of [GroupMembershipRequest](global.html#GroupMembershipRequest)` 
                  An array of membership requests

              async
              ### getInviteCode()&nbsp;&rarr;  Promise containing string

              Gets the invite code for a specific group

                Returns
                
                  `Promise containing string` 
                  Group's invite code

              async
              ### getLabels()&nbsp;&rarr;  Promise containing Array of [Label](Label.html)

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
              ### leave()&nbsp;&rarr;  Promise

              Makes the bot leave the group

                Returns
                
                  `Promise` 

              async
              ### markUnread()

              Mark this chat as unread

                Inherited from
                [Chat#markUnread](Chat.html#markUnread)
              
              async
              ### mute(unmuteDate)&nbsp;&rarr;  Promise containing {isMuted: boolean, muteExpiration: number}

              Mutes this chat forever, unless a date is specified

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        unmuteDate

                        &nbsp;

                        &nbsp;

                        Date when the chat will be unmuted, don't provide a value to mute forever

                        Value can be null.

                Inherited from
                [Chat#mute](Chat.html#mute)
                Returns

              async
              ### pin()&nbsp;&rarr;  Promise containing boolean

              Pins this chat

                Inherited from
                [Chat#pin](Chat.html#pin)
                Returns
                
                  New pin state. Could be false if the max number of pinned chats was reached.

              async
              ### promoteParticipants(participantIds)&nbsp;&rarr;  Promise containing {status: number}

              Promotes participants by IDs to admins

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        participantIds

                        Array of string

                        &nbsp;

                Returns
                
                  `Promise containing {status: number}` 
                  Object with status code indicating if the operation was successful

              async
              ### rejectGroupMembershipRequests(options)&nbsp;&rarr;  Promise containing Array of [MembershipRequestActionResult](global.html#MembershipRequestActionResult)

              Rejects membership requests if any

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        options

                        [MembershipRequestActionOptions](global.html#MembershipRequestActionOptions)

                        &nbsp;

                        Options for performing a membership request action

                Returns
                
                  `Promise containing Array of [MembershipRequestActionResult](global.html#MembershipRequestActionResult)` 
                  Returns an array of requester IDs whose membership requests were rejected and an error for each requester, if any occurred during the operation. If there are no requests, an empty array will be returned

              async
              ### removeParticipants(participantIds)&nbsp;&rarr;  Promise containing {status: number}

              Removes a list of participants by ID to the group

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        participantIds

                        Array of string

                        &nbsp;

                Returns
                
                  `Promise containing {status: number}` 

              async
              ### revokeInvite()&nbsp;&rarr;  Promise containing string

              Invalidates the current group invite code and generates a new one

                Returns
                
                  `Promise containing string` 
                  New invite code

              async
              ### sendMessage(content[, options])&nbsp;&rarr;  Promise containing [Message](Message.html)

              Send a message to this chat

                #### Parameters

                      Name
                      Type
                      Optional
                      Description

                        content

                        &nbsp;

                        &nbsp;

                        options

                        &nbsp;

                        Yes

                Inherited from
                [Chat#sendMessage](Chat.html#sendMessage)
                Returns
                
                  Message that was just sent

              async
              ### sendSeen()&nbsp;&rarr;  Promise containing Boolean

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
              ### setAddMembersAdminsOnly([adminsOnly])&nbsp;&rarr;  Promise containing boolean

              Updates the group setting to allow only admins to add members to the group.

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        adminsOnly

                        boolean

                        Yes

                        Enable or disable this option

                        Defaults to `true`.

                Returns
                
                  `Promise containing boolean` 
                  Returns true if the setting was properly updated. This can return false if the user does not have the necessary permissions.

              async
              ### setDescription(description)&nbsp;&rarr;  Promise containing boolean

              Updates the group description

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        description

                        string

                        &nbsp;

                Returns
                
                  `Promise containing boolean` 
                  Returns true if the description was properly updated. This can return false if the user does not have the necessary permissions.

              async
              ### setInfoAdminsOnly([adminsOnly])&nbsp;&rarr;  Promise containing boolean

              Updates the group settings to only allow admins to edit group info (title, description, photo).

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        adminsOnly

                        boolean

                        Yes

                        Enable or disable this option

                        Defaults to `true`.

                Returns
                
                  `Promise containing boolean` 
                  Returns true if the setting was properly updated. This can return false if the user does not have the necessary permissions.

              async
              ### setMessagesAdminsOnly([adminsOnly])&nbsp;&rarr;  Promise containing boolean

              Updates the group settings to only allow admins to send messages.

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        adminsOnly

                        boolean

                        Yes

                        Enable or disable this option

                        Defaults to `true`.

                Returns
                
                  `Promise containing boolean` 
                  Returns true if the setting was properly updated. This can return false if the user does not have the necessary permissions.

              async
              ### setPicture(media)&nbsp;&rarr;  Promise containing boolean

              Sets the group's picture.

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        media

                        [MessageMedia](MessageMedia.html)

                        &nbsp;

                Returns
                
                  `Promise containing boolean` 
                  Returns true if the picture was properly updated. This can return false if the user does not have the necessary permissions.

              async
              ### setSubject(subject)&nbsp;&rarr;  Promise containing boolean

              Updates the group subject

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        subject

                        string

                        &nbsp;

                Returns
                
                  `Promise containing boolean` 
                  Returns true if the subject was properly updated. This can return false if the user does not have the necessary permissions.

              async
              ### syncHistory()&nbsp;&rarr;  Promise containing boolean

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
              ### unmute()&nbsp;&rarr;  Promise containing {isMuted: boolean, muteExpiration: number}

              Unmutes this chat

                Inherited from
                [Chat#unmute](Chat.html#unmute)
                Returns

              async
              ### unpin()&nbsp;&rarr;  Promise containing boolean

              Unpins this chat

                Inherited from
                [Chat#unpin](Chat.html#unpin)
                Returns
                
                  New pin state

        Generated by [JSDoc](https://github.com/jsdoc3/jsdoc) 3.6.11 on October 23, 2025.