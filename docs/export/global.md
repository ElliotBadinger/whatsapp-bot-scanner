whatsapp-web.js 1.34.1 &raquo; Globals

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
              ChatTypes
                  &nbsp;string
              Chat types

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        SOLO

                        &nbsp;

                        &nbsp;

                        GROUP

                        &nbsp;

                        &nbsp;

                        UNKNOWN

                        &nbsp;

                        &nbsp;

              read-only
              Events
                  &nbsp;string
              Events that can be emitted by the client

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        AUTHENTICATED

                        &nbsp;

                        &nbsp;

                        AUTHENTICATION_FAILURE

                        &nbsp;

                        &nbsp;

                        READY

                        &nbsp;

                        &nbsp;

                        CHAT_REMOVED

                        &nbsp;

                        &nbsp;

                        CHAT_ARCHIVED

                        &nbsp;

                        &nbsp;

                        MESSAGE_RECEIVED

                        &nbsp;

                        &nbsp;

                        MESSAGE_CIPHERTEXT

                        &nbsp;

                        &nbsp;

                        MESSAGE_CREATE

                        &nbsp;

                        &nbsp;

                        MESSAGE_REVOKED_EVERYONE

                        &nbsp;

                        &nbsp;

                        MESSAGE_REVOKED_ME

                        &nbsp;

                        &nbsp;

                        MESSAGE_ACK

                        &nbsp;

                        &nbsp;

                        MESSAGE_EDIT

                        &nbsp;

                        &nbsp;

                        UNREAD_COUNT

                        &nbsp;

                        &nbsp;

                        MESSAGE_REACTION

                        &nbsp;

                        &nbsp;

                        MEDIA_UPLOADED

                        &nbsp;

                        &nbsp;

                        CONTACT_CHANGED

                        &nbsp;

                        &nbsp;

                        GROUP_JOIN

                        &nbsp;

                        &nbsp;

                        GROUP_LEAVE

                        &nbsp;

                        &nbsp;

                        GROUP_ADMIN_CHANGED

                        &nbsp;

                        &nbsp;

                        GROUP_MEMBERSHIP_REQUEST

                        &nbsp;

                        &nbsp;

                        GROUP_UPDATE

                        &nbsp;

                        &nbsp;

                        QR_RECEIVED

                        &nbsp;

                        &nbsp;

                        CODE_RECEIVED

                        &nbsp;

                        &nbsp;

                        LOADING_SCREEN

                        &nbsp;

                        &nbsp;

                        DISCONNECTED

                        &nbsp;

                        &nbsp;

                        STATE_CHANGED

                        &nbsp;

                        &nbsp;

                        BATTERY_CHANGED

                        &nbsp;

                        &nbsp;

                        INCOMING_CALL

                        &nbsp;

                        &nbsp;

                        REMOTE_SESSION_SAVED

                        &nbsp;

                        &nbsp;

                        VOTE_UPDATE

                        &nbsp;

                        &nbsp;

              read-only
              GroupNotificationTypes
                  &nbsp;string
              Group notification types

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        ADD

                        &nbsp;

                        &nbsp;

                        INVITE

                        &nbsp;

                        &nbsp;

                        REMOVE

                        &nbsp;

                        &nbsp;

                        LEAVE

                        &nbsp;

                        &nbsp;

                        SUBJECT

                        &nbsp;

                        &nbsp;

                        DESCRIPTION

                        &nbsp;

                        &nbsp;

                        PICTURE

                        &nbsp;

                        &nbsp;

                        ANNOUNCE

                        &nbsp;

                        &nbsp;

                        RESTRICT

                        &nbsp;

                        &nbsp;

              read-only
              MessageAck
                  &nbsp;number
              Message ACK

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        ACK_ERROR

                        &nbsp;

                        &nbsp;

                        ACK_PENDING

                        &nbsp;

                        &nbsp;

                        ACK_SERVER

                        &nbsp;

                        &nbsp;

                        ACK_DEVICE

                        &nbsp;

                        &nbsp;

                        ACK_READ

                        &nbsp;

                        &nbsp;

                        ACK_PLAYED

                        &nbsp;

                        &nbsp;

              read-only
              MessageTypes
                  &nbsp;string
              Message types

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        TEXT

                        &nbsp;

                        &nbsp;

                        AUDIO

                        &nbsp;

                        &nbsp;

                        VOICE

                        &nbsp;

                        &nbsp;

                        IMAGE

                        &nbsp;

                        &nbsp;

                        VIDEO

                        &nbsp;

                        &nbsp;

                        DOCUMENT

                        &nbsp;

                        &nbsp;

                        STICKER

                        &nbsp;

                        &nbsp;

                        LOCATION

                        &nbsp;

                        &nbsp;

                        CONTACT_CARD

                        &nbsp;

                        &nbsp;

                        CONTACT_CARD_MULTI

                        &nbsp;

                        &nbsp;

                        ORDER

                        &nbsp;

                        &nbsp;

                        REVOKED

                        &nbsp;

                        &nbsp;

                        PRODUCT

                        &nbsp;

                        &nbsp;

                        UNKNOWN

                        &nbsp;

                        &nbsp;

                        GROUP_INVITE

                        &nbsp;

                        &nbsp;

                        LIST

                        &nbsp;

                        &nbsp;

                        LIST_RESPONSE

                        &nbsp;

                        &nbsp;

                        BUTTONS_RESPONSE

                        &nbsp;

                        &nbsp;

                        PAYMENT

                        &nbsp;

                        &nbsp;

                        BROADCAST_NOTIFICATION

                        &nbsp;

                        &nbsp;

                        CALL_LOG

                        &nbsp;

                        &nbsp;

                        CIPHERTEXT

                        &nbsp;

                        &nbsp;

                        DEBUG

                        &nbsp;

                        &nbsp;

                        E2E_NOTIFICATION

                        &nbsp;

                        &nbsp;

                        GP2

                        &nbsp;

                        &nbsp;

                        GROUP_NOTIFICATION

                        &nbsp;

                        &nbsp;

                        HSM

                        &nbsp;

                        &nbsp;

                        INTERACTIVE

                        &nbsp;

                        &nbsp;

                        NATIVE_FLOW

                        &nbsp;

                        &nbsp;

                        NOTIFICATION

                        &nbsp;

                        &nbsp;

                        NOTIFICATION_TEMPLATE

                        &nbsp;

                        &nbsp;

                        OVERSIZED

                        &nbsp;

                        &nbsp;

                        PROTOCOL

                        &nbsp;

                        &nbsp;

                        REACTION

                        &nbsp;

                        &nbsp;

                        TEMPLATE_BUTTON_REPLY

                        &nbsp;

                        &nbsp;

                        POLL_CREATION

                        &nbsp;

                        &nbsp;

                        SCHEDULED_EVENT_CREATION

                        &nbsp;

                        &nbsp;

              read-only
              Status
                  &nbsp;number
              Client status

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        INITIALIZING

                        &nbsp;

                        &nbsp;

                        AUTHENTICATING

                        &nbsp;

                        &nbsp;

                        READY

                        &nbsp;

                        &nbsp;

              read-only
              WAState
                  &nbsp;string
              WhatsApp state

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        CONFLICT

                        &nbsp;

                        &nbsp;

                        CONNECTED

                        &nbsp;

                        &nbsp;

                        DEPRECATED_VERSION

                        &nbsp;

                        &nbsp;

                        OPENING

                        &nbsp;

                        &nbsp;

                        PAIRING

                        &nbsp;

                        &nbsp;

                        PROXYBLOCK

                        &nbsp;

                        &nbsp;

                        SMB_TOS_BLOCK

                        &nbsp;

                        &nbsp;

                        TIMEOUT

                        &nbsp;

                        &nbsp;

                        TOS_BLOCK

                        &nbsp;

                        &nbsp;

                        UNLAUNCHED

                        &nbsp;

                        &nbsp;

                        UNPAIRED

                        &nbsp;

                        &nbsp;

                        UNPAIRED_IDLE

                        &nbsp;

                        &nbsp;

            ## Method

              async
              ### exposeFunctionIfAbsent(page, name, fn)

              Expose a function to the page if it does not exist

              NOTE:
                Rewrite it to 'upsertFunction' after updating Puppeteer to 20.6 or higher
                using page.removeExposedFunction
                https://pptr.dev/api/puppeteer.page.removeExposedFunction
              
                #### Parameters

                      Name
                      Type
                      Optional
                      Description

                        page

                        &nbsp;

                        &nbsp;

                        name

                        string

                        &nbsp;

                        fn

                        function()

                        &nbsp;

            ## Abstract types

              AddParticipantsResult
                  &nbsp;Object
              An object that handles the result for `addParticipants` method

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        code

                        number

                        &nbsp;

                        The code of the result

                        message

                        string

                        &nbsp;

                        The result message

                        isInviteV4Sent

                        boolean

                        &nbsp;

                        Indicates if the inviteV4 was sent to the partitipant

              AddParticipnatsOptions
                  &nbsp;Object
              An object that handles options for adding participants

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        sleep

                        (Array of number or number)

                        Yes

                        The number of milliseconds to wait before adding the next participant. If it is an array, a random sleep time between the sleep[0] and sleep[1] values will be added (the difference must be >=100 ms, otherwise, a random sleep time between sleep[1] and sleep[1] + 100 will be added). If sleep is a number, a sleep time equal to its value will be added. By default, sleep is an array with a value of [250, 500]

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

              ButtonSpec
                  &nbsp;Object
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

                        &nbsp;

                        The text to show on the button.

              ChannelId
                  &nbsp;Object
              Channel ID structure

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        server

                        string

                        &nbsp;

                        user

                        string

                        &nbsp;

                        _serialized

                        string

                        &nbsp;

              ContactId
                  &nbsp;Object
              ID that represents a contact

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        server

                        string

                        &nbsp;

                        user

                        string

                        &nbsp;

                        _serialized

                        string

                        &nbsp;

              CreateChannelOptions
                  &nbsp;Object
              Options for the channel creation

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        description

                        string

                        &nbsp;

                        The channel description

                        Value can be null.

                        picture

                        [MessageMedia](MessageMedia.html)

                        &nbsp;

                        The channel profile picture

                        Value can be null.

              CreateChannelResult
                  &nbsp;Object
              An object that handles the result for `createChannel` method

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        title

                        string

                        &nbsp;

                        A channel title

                        nid

                        ChatId

                        &nbsp;

                        An object that handels the newly created channel ID

                        Values in `nid` have the following properties:

                              Name
                              Type
                              Optional
                              Description

                                server

                                string

                                &nbsp;

                                'newsletter'

                                user

                                string

                                &nbsp;

                                'XXXXXXXXXX'

                                _serialized

                                string

                                &nbsp;

                                'XXXXXXXXXX@newsletter'

                        inviteLink

                        string

                        &nbsp;

                        The channel invite link, starts with 'https://whatsapp.com/channel/'

                        createdAtTs

                        number

                        &nbsp;

                        The timestamp the channel was created at

              CreateGroupOptions
                  &nbsp;Object
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

                        &nbsp;

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

              CreateGroupResult
                  &nbsp;Object
              An object that handles the result for `createGroup` method

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        title

                        string

                        &nbsp;

                        A group title

                        gid

                        Object

                        &nbsp;

                        An object that handles the newly created group ID

                        Values in `gid` have the following properties:

                              Name
                              Type
                              Optional
                              Description

                                server

                                string

                                &nbsp;

                                user

                                string

                                &nbsp;

                                _serialized

                                string

                                &nbsp;

                        participants

                        Object with [ParticipantResult](global.html#ParticipantResult) properties

                        &nbsp;

                        An object that handles the result value for each added to the group participant

              FormattedButtonSpec
                  &nbsp;Object
              
                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        buttonId

                        string

                        &nbsp;

                        type

                        number

                        &nbsp;

                        buttonText

                        Object

                        &nbsp;

              GroupMembershipRequest
                  &nbsp;Object
              An object that handles the information about the group membership request

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        id

                        Object

                        &nbsp;

                        The wid of a user who requests to enter the group

                        addedBy

                        Object

                        &nbsp;

                        The wid of a user who created that request

                        parentGroupId

                        (Object or null)

                        &nbsp;

                        The wid of a community parent group to which the current group is linked

                        requestMethod

                        string

                        &nbsp;

                        The method used to create the request: NonAdminAdd/InviteLink/LinkedGroupJoin

                        t

                        number

                        &nbsp;

                        The timestamp the request was created at

              GroupMembershipRequest
                  &nbsp;Object
              An object that handles the information about the group membership request

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        id

                        Object

                        &nbsp;

                        The wid of a user who requests to enter the group

                        addedBy

                        Object

                        &nbsp;

                        The wid of a user who created that request

                        parentGroupId

                        (Object or null)

                        &nbsp;

                        The wid of a community parent group to which the current group is linked

                        requestMethod

                        string

                        &nbsp;

                        The method used to create the request: NonAdminAdd/InviteLink/LinkedGroupJoin

                        t

                        number

                        &nbsp;

                        The timestamp the request was created at

              GroupMention
                  &nbsp;Object
              An object representing mentions of groups

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        subject

                        string

                        &nbsp;

                        The name of a group to mention (can be custom)

                        id

                        string

                        &nbsp;

                        The group ID, e.g.: 'XXXXXXXXXX@g.us'

              GroupMention
                  &nbsp;Object
              
                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        groupSubject

                        string

                        &nbsp;

                        The name of the group

                        groupJid

                        string

                        &nbsp;

                        The group ID

              GroupParticipant
                  &nbsp;Object
              Group participant information

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        id

                        [ContactId](global.html#ContactId)

                        &nbsp;

                        isAdmin

                        boolean

                        &nbsp;

                        isSuperAdmin

                        boolean

                        &nbsp;

              LocationSendOptions
                  &nbsp;Object
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

              MembershipRequestActionOptions
                  &nbsp;Object
              An object that handles options for `approveGroupMembershipRequests` and `rejectGroupMembershipRequests` methods

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        requesterIds

                        (Array of string, string, or null)

                        &nbsp;

                        User ID/s who requested to join the group, if no value is provided, the method will search for all membership requests for that group

                        sleep

                        (Array of number, number, or null)

                        &nbsp;

                        The number of milliseconds to wait before performing an operation for the next requester. If it is an array, a random sleep time between the sleep[0] and sleep[1] values will be added (the difference must be >=100 ms, otherwise, a random sleep time between sleep[1] and sleep[1] + 100 will be added). If sleep is a number, a sleep time equal to its value will be added. By default, sleep is an array with a value of [250, 500]

              MembershipRequestActionOptions
                  &nbsp;Object
              An object that handles options for `approveGroupMembershipRequests` and `rejectGroupMembershipRequests` methods

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        requesterIds

                        (Array of string, string, or null)

                        &nbsp;

                        User ID/s who requested to join the group, if no value is provided, the method will search for all membership requests for that group

                        sleep

                        (Array of number, number, or null)

                        &nbsp;

                        The number of milliseconds to wait before performing an operation for the next requester. If it is an array, a random sleep time between the sleep[0] and sleep[1] values will be added (the difference must be >=100 ms, otherwise, a random sleep time between sleep[1] and sleep[1] + 100 will be added). If sleep is a number, a sleep time equal to its value will be added. By default, sleep is an array with a value of [250, 500]

              MembershipRequestActionResult
                  &nbsp;Object
              An object that handles the result for membership request action

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        requesterId

                        string

                        &nbsp;

                        User ID whos membership request was approved/rejected

                        error

                        (number or undefined)

                        &nbsp;

                        An error code that occurred during the operation for the participant

                        message

                        string

                        &nbsp;

                        A message with a result of membership request action

              MembershipRequestActionResult
                  &nbsp;Object
              An object that handles the result for membership request action

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        requesterId

                        string

                        &nbsp;

                        User ID whos membership request was approved/rejected

                        error

                        number

                        &nbsp;

                        An error code that occurred during the operation for the participant

                        message

                        string

                        &nbsp;

                        A message with a result of membership request action

              MessageInfo
                  &nbsp;Object
              Message Info

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        delivery

                        Array of {id: [ContactId](global.html#ContactId), t: number}

                        &nbsp;

                        Contacts to which the message has been delivered to

                        deliveryRemaining

                        number

                        &nbsp;

                        Amount of people to whom the message has not been delivered to

                        played

                        Array of {id: [ContactId](global.html#ContactId), t: number}

                        &nbsp;

                        Contacts who have listened to the voice message

                        playedRemaining

                        number

                        &nbsp;

                        Amount of people who have not listened to the message

                        read

                        Array of {id: [ContactId](global.html#ContactId), t: number}

                        &nbsp;

                        Contacts who have read the message

                        readRemaining

                        number

                        &nbsp;

                        Amount of people who have not read the message

              MessageSendOptions
                  &nbsp;Object
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

              MessageSendOptions
                  &nbsp;Object
              Message options

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        caption

                        string

                        &nbsp;

                        Image or video caption

                        Value can be null.

                        mentions

                        Array of string

                        &nbsp;

                        User IDs of user that will be mentioned in the message

                        Value can be null.

                        media

                        [MessageMedia](MessageMedia.html)

                        &nbsp;

                        Image or video to be sent

                        Value can be null.

              ParticipantResult
                  &nbsp;Object
              An object that represents the result for a participant added to a group

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        statusCode

                        number

                        &nbsp;

                        The status code of the result

                        message

                        string

                        &nbsp;

                        The result message

                        isGroupCreator

                        boolean

                        &nbsp;

                        Indicates if the participant is a group creator

                        isInviteV4Sent

                        boolean

                        &nbsp;

                        Indicates if the inviteV4 was sent to the participant

              PollSendOptions
                  &nbsp;Object
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

                        &nbsp;

                        The custom message secret, can be used as a poll ID. NOTE: it has to be a unique vector with a length of 32

                        Value can be null.

              ReactionList
                  &nbsp;Object
              Reaction List

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        id

                        string

                        &nbsp;

                        Original emoji

                        aggregateEmoji

                        string

                        &nbsp;

                        aggregate emoji

                        hasReactionByMe

                        boolean

                        &nbsp;

                        Flag who sent the reaction

                        senders

                        Array of [Reaction](Reaction.html)

                        &nbsp;

                        Reaction senders, to this message

              ScheduledEventSendOptions
                  &nbsp;Object
              ScheduledEvent send options

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        description

                        string

                        &nbsp;

                        The scheduled event description

                        Value can be null.

                        endTime

                        Date

                        &nbsp;

                        The end time of the event

                        Value can be null.

                        location

                        string

                        &nbsp;

                        The location of the event

                        Value can be null.

                        callType

                        string

                        &nbsp;

                        The type of a WhatsApp call link to generate, valid values are: `video` | `voice`

                        Value can be null.

                        isEventCanceled

                        boolean

                        Yes

                        Indicates if a scheduled event should be sent as an already canceled

                        Defaults to `false`.

                        messageSecret

                        Array of number

                        &nbsp;

                        The custom message secret, can be used as an event ID. NOTE: it has to be a unique vector with a length of 32

                        Value can be null.

              SelectedPollOption
                  &nbsp;Object
              Selected poll option structure

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        id

                        number

                        &nbsp;

                        The local selected or deselected option ID

                        name

                        string

                        &nbsp;

                        The option name

              SendChannelAdminInviteOptions
                  &nbsp;Object
              
                #### Property

                      Name
                      Type
                      Optional
                      Description

                        comment

                        string

                        &nbsp;

                        The comment to be added to an invitation

                        Value can be null.

              SendChannelAdminInviteOptions
                  &nbsp;Object
              
                #### Property

                      Name
                      Type
                      Optional
                      Description

                        comment

                        string

                        &nbsp;

                        The comment to be added to an invitation

                        Value can be null.

              StickerMetadata
                  &nbsp;Object
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

              TargetOptions
                  &nbsp;Object
              Target options object description

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        module

                        (string or number)

                        &nbsp;

                        The name or a key of the target module to search

                        index

                        number

                        &nbsp;

                        The index value of the target module

                        function

                        string

                        &nbsp;

                        The function name to get from a module

              TargetOptions
                  &nbsp;Object
              Target options object description

                #### Properties

                      Name
                      Type
                      Optional
                      Description

                        module

                        (string or number)

                        &nbsp;

                        The target module

                        function

                        string

                        &nbsp;

                        The function name to get from a module

              TransferChannelOwnershipOptions
                  &nbsp;Object
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

              TransferChannelOwnershipOptions
                  &nbsp;Object
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

              UnsubscribeOptions
                  &nbsp;Object
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

        Generated by [JSDoc](https://github.com/jsdoc3/jsdoc) 3.6.11 on October 23, 2025.