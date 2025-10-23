whatsapp-web.js 1.34.1 &raquo; Class: PrivateContact

        [whatsapp-web.js 1.34.1](index.html)

            class
            # PrivateContact

            Source: [structures/PrivateContact.js:9](structures_PrivateContact.js.html#source-line-9)

              Represents a Private Contact on WhatsApp

              ## Properties

                    [id](PrivateContact.html#id)

                    [isBlocked](PrivateContact.html#isBlocked)

                    [isBusiness](PrivateContact.html#isBusiness)

                    [isEnterprise](PrivateContact.html#isEnterprise)

                    [isGroup](PrivateContact.html#isGroup)

                    [isMe](PrivateContact.html#isMe)

                    [isMyContact](PrivateContact.html#isMyContact)

                    [isUser](PrivateContact.html#isUser)

                    [isWAContact](PrivateContact.html#isWAContact)

                    [name](PrivateContact.html#name)

                    [number](PrivateContact.html#number)

                    [pushname](PrivateContact.html#pushname)

                    [shortName](PrivateContact.html#shortName)

              ## Methods

                    [block()](PrivateContact.html#block)

                    [getAbout()](PrivateContact.html#getAbout)

                    [getChat()](PrivateContact.html#getChat)

                    [getCommonGroups()](PrivateContact.html#getCommonGroups)

                    [getCountryCode()](PrivateContact.html#getCountryCode)

                    [getFormattedNumber()](PrivateContact.html#getFormattedNumber)

                    [getProfilePicUrl()](PrivateContact.html#getProfilePicUrl)

                    [unblock()](PrivateContact.html#unblock)

            ## new&nbsp;PrivateContact()

              Extends
              [Contact](Contact.html)

            ## Properties

              id
                  &nbsp;unknown
              ID that represents the contact

                Inherited from
                [Contact#id](Contact.html#id)
              
              isBlocked
                  &nbsp;unknown
              Indicates if you have blocked this contact

                Inherited from
                [Contact#isBlocked](Contact.html#isBlocked)
              
              isBusiness
                  &nbsp;unknown
              Indicates if the contact is a business contact

                Inherited from
                [Contact#isBusiness](Contact.html#isBusiness)
              
              isEnterprise
                  &nbsp;unknown
              Indicates if the contact is an enterprise contact

                Inherited from
                [Contact#isEnterprise](Contact.html#isEnterprise)
              
              isGroup
                  &nbsp;unknown
              Indicates if the contact is a group contact

                Inherited from
                [Contact#isGroup](Contact.html#isGroup)
              
              isMe
                  &nbsp;unknown
              Indicates if the contact is the current user's contact

                Inherited from
                [Contact#isMe](Contact.html#isMe)
              
              isMyContact
                  &nbsp;unknown
              Indicates if the number is saved in the current phone's contacts

                Inherited from
                [Contact#isMyContact](Contact.html#isMyContact)
              
              isUser
                  &nbsp;unknown
              Indicates if the contact is a user contact

                Inherited from
                [Contact#isUser](Contact.html#isUser)
              
              isWAContact
                  &nbsp;unknown
              Indicates if the number is registered on WhatsApp

                Inherited from
                [Contact#isWAContact](Contact.html#isWAContact)
              
              name
                  &nbsp;unknown
              The contact's name, as saved by the current user

                Inherited from
                [Contact#name](Contact.html#name)
              
              number
                  &nbsp;unknown
              Contact's phone number

                Inherited from
                [Contact#number](Contact.html#number)
              
              pushname
                  &nbsp;unknown
              The name that the contact has configured to be shown publically

                Inherited from
                [Contact#pushname](Contact.html#pushname)
              
              shortName
                  &nbsp;unknown
              A shortened version of name

                Inherited from
                [Contact#shortName](Contact.html#shortName)

            ## Methods

              async
              ### block()&nbsp;&rarr;  Promise containing boolean

              Blocks this contact from WhatsApp

                Inherited from
                [Contact#block](Contact.html#block)
                Returns

              async
              ### getAbout()&nbsp;&rarr;  Promise containing nullable string

              Gets the Contact's current &quot;about&quot; info. Returns null if you don't have permission to read their status.

                Inherited from
                [Contact#getAbout](Contact.html#getAbout)
                Returns

              async
              ### getChat()&nbsp;&rarr;  Promise containing [Chat](Chat.html)

              Returns the Chat that corresponds to this Contact.
                Will return null when getting chat for currently logged in user.
              
                Inherited from
                [Contact#getChat](Contact.html#getChat)
                Returns

              async
              ### getCommonGroups()&nbsp;&rarr;  Promise containing Array of WAWebJS.ChatId

              Gets the Contact's common groups with you. Returns empty array if you don't have any common group.

                Inherited from
                [Contact#getCommonGroups](Contact.html#getCommonGroups)
                Returns

              async
              ### getCountryCode()&nbsp;&rarr;  Promise containing string

              Returns the contact's countrycode, (1541859685@c.us) => (1)

                Inherited from
                [Contact#getCountryCode](Contact.html#getCountryCode)
                Returns

              async
              ### getFormattedNumber()&nbsp;&rarr;  Promise containing string

              Returns the contact's formatted phone number, (12345678901@c.us) => (+1 (234) 5678-901)

                Inherited from
                [Contact#getFormattedNumber](Contact.html#getFormattedNumber)
                Returns

              async
              ### getProfilePicUrl()&nbsp;&rarr;  Promise containing string

              Returns the contact's profile picture URL, if privacy settings allow it

                Inherited from
                [Contact#getProfilePicUrl](Contact.html#getProfilePicUrl)
                Returns

              async
              ### unblock()&nbsp;&rarr;  Promise containing boolean

              Unblocks this contact from WhatsApp

                Inherited from
                [Contact#unblock](Contact.html#unblock)
                Returns

        Generated by [JSDoc](https://github.com/jsdoc3/jsdoc) 3.6.11 on October 23, 2025.