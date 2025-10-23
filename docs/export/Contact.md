whatsapp-web.js 1.34.1 &raquo; Class: Contact

        [whatsapp-web.js 1.34.1](index.html)

            class
            # Contact

            Source: [structures/Contact.js:17](structures_Contact.js.html#source-line-17)

              Represents a Contact on WhatsApp

              ## Properties

                    [id](Contact.html#id)

                    [isBlocked](Contact.html#isBlocked)

                    [isBusiness](Contact.html#isBusiness)

                    [isEnterprise](Contact.html#isEnterprise)

                    [isGroup](Contact.html#isGroup)

                    [isMe](Contact.html#isMe)

                    [isMyContact](Contact.html#isMyContact)

                    [isUser](Contact.html#isUser)

                    [isWAContact](Contact.html#isWAContact)

                    [name](Contact.html#name)

                    [number](Contact.html#number)

                    [pushname](Contact.html#pushname)

                    [shortName](Contact.html#shortName)

              ## Methods

                    [block()](Contact.html#block)

                    [getAbout()](Contact.html#getAbout)

                    [getChat()](Contact.html#getChat)

                    [getCommonGroups()](Contact.html#getCommonGroups)

                    [getCountryCode()](Contact.html#getCountryCode)

                    [getFormattedNumber()](Contact.html#getFormattedNumber)

                    [getProfilePicUrl()](Contact.html#getProfilePicUrl)

                    [unblock()](Contact.html#unblock)

            ## new&nbsp;Contact()

              Extends
              [Base](Base.html)

            ## Properties

              id
                  &nbsp;[ContactId](global.html#ContactId)
              ID that represents the contact

              isBlocked
                  &nbsp;boolean
              Indicates if you have blocked this contact

              isBusiness
                  &nbsp;boolean
              Indicates if the contact is a business contact

              isEnterprise
                  &nbsp;boolean
              Indicates if the contact is an enterprise contact

              isGroup
                  &nbsp;boolean
              Indicates if the contact is a group contact

              isMe
                  &nbsp;boolean
              Indicates if the contact is the current user's contact

              isMyContact
                  &nbsp;boolean
              Indicates if the number is saved in the current phone's contacts

              isUser
                  &nbsp;boolean
              Indicates if the contact is a user contact

              isWAContact
                  &nbsp;boolean
              Indicates if the number is registered on WhatsApp

              name
                  &nbsp;nullable string
              The contact's name, as saved by the current user

              number
                  &nbsp;string
              Contact's phone number

              pushname
                  &nbsp;string
              The name that the contact has configured to be shown publically

              shortName
                  &nbsp;nullable string
              A shortened version of name

            ## Methods

              async
              ### block()&nbsp;&rarr;  Promise containing boolean

              Blocks this contact from WhatsApp

                Returns
                
                  `Promise containing boolean` 

              async
              ### getAbout()&nbsp;&rarr;  Promise containing nullable string

              Gets the Contact's current &quot;about&quot; info. Returns null if you don't have permission to read their status.

                Returns
                
                  `Promise containing nullable string` 

              async
              ### getChat()&nbsp;&rarr;  Promise containing [Chat](Chat.html)

              Returns the Chat that corresponds to this Contact.
                Will return null when getting chat for currently logged in user.
              
                Returns
                
                  `Promise containing [Chat](Chat.html)` 

              async
              ### getCommonGroups()&nbsp;&rarr;  Promise containing Array of WAWebJS.ChatId

              Gets the Contact's common groups with you. Returns empty array if you don't have any common group.

                Returns
                
                  `Promise containing Array of WAWebJS.ChatId` 

              async
              ### getCountryCode()&nbsp;&rarr;  Promise containing string

              Returns the contact's countrycode, (1541859685@c.us) => (1)

                Returns
                
                  `Promise containing string` 

              async
              ### getFormattedNumber()&nbsp;&rarr;  Promise containing string

              Returns the contact's formatted phone number, (12345678901@c.us) => (+1 (234) 5678-901)

                Returns
                
                  `Promise containing string` 

              async
              ### getProfilePicUrl()&nbsp;&rarr;  Promise containing string

              Returns the contact's profile picture URL, if privacy settings allow it

                Returns
                
                  `Promise containing string` 

              async
              ### unblock()&nbsp;&rarr;  Promise containing boolean

              Unblocks this contact from WhatsApp

                Returns
                
                  `Promise containing boolean` 

        Generated by [JSDoc](https://github.com/jsdoc3/jsdoc) 3.6.11 on October 23, 2025.