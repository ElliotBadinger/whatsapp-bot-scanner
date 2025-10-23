whatsapp-web.js 1.34.1 &raquo; Class: Channel

        [whatsapp-web.js 1.34.1](index.html)

            class
            # Channel

            Source: [structures/Channel.js:18](structures_Channel.js.html#source-line-18)

              Represents a Channel on WhatsApp

              ## Properties

                    [description](Channel.html#description)

                    [id](Channel.html#id)

                    [isChannel](Channel.html#isChannel)

                    [isGroup](Channel.html#isGroup)

                    [isMuted](Channel.html#isMuted)

                    [isReadOnly](Channel.html#isReadOnly)

                    [lastMessage](Channel.html#lastMessage)

                    [muteExpiration](Channel.html#muteExpiration)

                    [name](Channel.html#name)

                    [timestamp](Channel.html#timestamp)

                    [unreadCount](Channel.html#unreadCount)

              ## Methods

                    [_muteUnmuteChannel(action)](Channel.html#_muteUnmuteChannel)

                    [_setChannelMetadata(value, property)](Channel.html#_setChannelMetadata)

                    [acceptChannelAdminInvite()](Channel.html#acceptChannelAdminInvite)

                    [deleteChannel()](Channel.html#deleteChannel)

                    [demoteChannelAdmin(userId)](Channel.html#demoteChannelAdmin)

                    [fetchMessages(searchOptions)](Channel.html#fetchMessages)

                    [getSubscribers(limit)](Channel.html#getSubscribers)

                    [mute()](Channel.html#mute)

                    [revokeChannelAdminInvite(userId)](Channel.html#revokeChannelAdminInvite)

                    [sendChannelAdminInvite(chatId, options)](Channel.html#sendChannelAdminInvite)

                    [sendMessage(content, options)](Channel.html#sendMessage)

                    [sendSeen()](Channel.html#sendSeen)

                    [setDescription(newDescription)](Channel.html#setDescription)

                    [setProfilePicture(newProfilePicture)](Channel.html#setProfilePicture)

                    [setReactionSetting(reactionCode)](Channel.html#setReactionSetting)

                    [setSubject(newSubject)](Channel.html#setSubject)

                    [transferChannelOwnership(newOwnerId, options)](Channel.html#transferChannelOwnership)

                    [unmute()](Channel.html#unmute)

            ## new&nbsp;Channel()

              Extends
              [Base](Base.html)

            ## Properties

              description
                  &nbsp;string
              The channel description

              id
                  &nbsp;[ChannelId](global.html#ChannelId)
              ID that represents the channel

              isChannel
                  &nbsp;boolean
              Indicates if it is a Channel

              isGroup
                  &nbsp;boolean
              Indicates if it is a Group

              isMuted
                  &nbsp;boolean
              Indicates if the channel is muted or not

              isReadOnly
                  &nbsp;boolean
              Indicates if the channel is readonly

              lastMessage
                  &nbsp;[Message](Message.html)
              Last message in the channel

              muteExpiration
                  &nbsp;number
              Unix timestamp for when the mute expires

              name
                  &nbsp;string
              Title of the channel

              timestamp
                  &nbsp;number
              Unix timestamp for when the last activity occurred

              unreadCount
                  &nbsp;number
              Amount of messages unread

            ## Methods

              async
              ### _muteUnmuteChannel(action)&nbsp;&rarr;  Promise containing boolean

              Internal method to mute or unmute the channel

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        action

                        string

                        &nbsp;

                        The action: 'MUTE' or 'UNMUTE'

                Returns
                
                  `Promise containing boolean` 
                  Returns true if the operation completed successfully, false otherwise

              async
              ### _setChannelMetadata(value, property)&nbsp;&rarr;  Promise containing boolean

              Internal method to change the channel metadata

                #### Parameters

                      Name
                      Type
                      Optional
                      Description

                        value

                        (string, number, or [MessageMedia](MessageMedia.html))

                        &nbsp;

                        The new value to set

                        property

                        string

                        &nbsp;

                        The property of a channel metadata to change

                Returns
                
                  `Promise containing boolean` 
                  Returns true if the operation completed successfully, false otherwise

              async
              ### acceptChannelAdminInvite()&nbsp;&rarr;  Promise containing boolean

              Accepts a channel admin invitation and promotes the current user to a channel admin

                Returns
                
                  `Promise containing boolean` 
                  Returns true if the operation completed successfully, false otherwise

              async
              ### deleteChannel()&nbsp;&rarr;  Promise containing boolean

              Deletes the channel you created

                Returns
                
                  `Promise containing boolean` 
                  Returns true if the operation completed successfully, false otherwise

              async
              ### demoteChannelAdmin(userId)&nbsp;&rarr;  Promise containing boolean

              Demotes a channel admin to a regular subscriber (can be used also for self-demotion)

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        userId

                        string

                        &nbsp;

                        The user ID to demote

                Returns
                
                  `Promise containing boolean` 
                  Returns true if the operation completed successfully, false otherwise

              async
              ### fetchMessages(searchOptions)&nbsp;&rarr;  Promise containing Array of [Message](Message.html)

              Loads channel messages, sorted from earliest to latest

                #### Parameters

                      Name
                      Type
                      Optional
                      Description

                        searchOptions

                        Object

                        &nbsp;

                        Options for searching messages. Right now only limit and fromMe is supported

                        Values in `searchOptions` have the following properties:

                              Name
                              Type
                              Optional
                              Description

                                limit

                                Number

                                Yes

                                The amount of messages to return. If no limit is specified, the available messages will be returned. Note that the actual number of returned messages may be smaller if there aren't enough messages in the conversation. Set this to Infinity to load all messages

                                fromMe

                                Boolean

                                Yes

                                Return only messages from the bot number or vise versa. To get all messages, leave the option undefined

                Returns
                
                  `Promise containing Array of [Message](Message.html)` 

              async
              ### getSubscribers(limit)

              Gets the subscribers of the channel (only those who are in your contact list)

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        limit

                        number

                        &nbsp;

                        Optional parameter to specify the limit of subscribers to retrieve

                        Value can be null.

                Returns

              async
              ### mute()&nbsp;&rarr;  Promise containing boolean

              Mutes the channel

                Returns
                
                  `Promise containing boolean` 
                  Returns true if the operation completed successfully, false otherwise

              async
              ### revokeChannelAdminInvite(userId)&nbsp;&rarr;  Promise containing boolean

              Revokes a channel admin invitation sent to a user by a channel owner

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        userId

                        string

                        &nbsp;

                        The user ID the invitation was sent to

                Returns
                
                  `Promise containing boolean` 
                  Returns true if the operation completed successfully, false otherwise

              async
              ### sendChannelAdminInvite(chatId, options)&nbsp;&rarr;  Promise containing boolean

              Sends a channel admin invitation to a user, allowing them to become an admin of the channel

                #### Parameters

                      Name
                      Type
                      Optional
                      Description

                        chatId

                        string

                        &nbsp;

                        The ID of a user to send the channel admin invitation to

                        options

                        [SendChannelAdminInviteOptions](global.html#SendChannelAdminInviteOptions)

                        &nbsp;

                Returns
                
                  `Promise containing boolean` 
                  Returns true if an invitation was sent successfully, false otherwise

              async
              ### sendMessage(content, options)&nbsp;&rarr;  Promise containing [Message](Message.html)

              Sends a message to this channel

                #### Parameters

                      Name
                      Type
                      Optional
                      Description

                        content

                        (string or [MessageMedia](MessageMedia.html))

                        &nbsp;

                        options

                        [MessageSendOptions](global.html#MessageSendOptions)

                        &nbsp;

                        Value can be null.

                Returns
                
                  `Promise containing [Message](Message.html)` 
                  Message that was just sent

              async
              ### sendSeen()&nbsp;&rarr;  Promise containing boolean

              Sets the channel as seen

                Returns
                
                  `Promise containing boolean` 

              async
              ### setDescription(newDescription)&nbsp;&rarr;  Promise containing boolean

              Updates the channel description

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        newDescription

                        string

                        &nbsp;

                Returns
                
                  `Promise containing boolean` 
                  Returns true if the operation completed successfully, false otherwise

              async
              ### setProfilePicture(newProfilePicture)&nbsp;&rarr;  Promise containing boolean

              Updates the channel profile picture

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        newProfilePicture

                        [MessageMedia](MessageMedia.html)

                        &nbsp;

                Returns
                
                  `Promise containing boolean` 
                  Returns true if the operation completed successfully, false otherwise

              async
              ### setReactionSetting(reactionCode)&nbsp;&rarr;  Promise containing boolean

              Updates available reactions to use in the channel

              Valid values for passing to the method are:
                0 for NONE reactions to be avaliable
                1 for BASIC reactions to be available: 👍, ❤️, 😂, 😮, 😢, 🙏
                2 for ALL reactions to be available
              
                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        reactionCode

                        number

                        &nbsp;

                Returns
                
                  `Promise containing boolean` 
                  Returns true if the operation completed successfully, false otherwise

              async
              ### setSubject(newSubject)&nbsp;&rarr;  Promise containing boolean

              Updates the channel subject

                #### Parameter

                      Name
                      Type
                      Optional
                      Description

                        newSubject

                        string

                        &nbsp;

                Returns
                
                  `Promise containing boolean` 
                  Returns true if the subject was properly updated. This can return false if the user does not have the necessary permissions.

              async
              ### transferChannelOwnership(newOwnerId, options)&nbsp;&rarr;  Promise containing boolean

              Transfers a channel ownership to another user.
                Note: the user you are transferring the channel ownership to must be a channel admin.
              
                #### Parameters

                      Name
                      Type
                      Optional
                      Description

                        newOwnerId

                        string

                        &nbsp;

                        options

                        [TransferChannelOwnershipOptions](global.html#TransferChannelOwnershipOptions)

                        &nbsp;

                Returns
                
                  `Promise containing boolean` 
                  Returns true if the operation completed successfully, false otherwise

              async
              ### unmute()&nbsp;&rarr;  Promise containing boolean

              Unmutes the channel

                Returns
                
                  `Promise containing boolean` 
                  Returns true if the operation completed successfully, false otherwise

        Generated by [JSDoc](https://github.com/jsdoc3/jsdoc) 3.6.11 on October 23, 2025.