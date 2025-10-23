whatsapp-web.js 1.34.1 &raquo; Source: structures/Chat.js

        [whatsapp-web.js 1.34.1](index.html)

            # Source: structures/Chat.js

            ```
&#x27;use strict&#x27;;

const Base &#x3D; require(&#x27;./Base&#x27;);
const Message &#x3D; require(&#x27;./Message&#x27;);

/**
 * Represents a Chat on WhatsApp
 * @extends {Base}
 */
class Chat extends Base {
    constructor(client, data) {
        super(client);

        if (data) this._patch(data);
    }

    _patch(data) {
        /**
         * ID that represents the chat
         * @type {object}
         */
        this.id &#x3D; data.id;

        /**
         * Title of the chat
         * @type {string}
         */
        this.name &#x3D; data.formattedTitle;

        /**
         * Indicates if the Chat is a Group Chat
         * @type {boolean}
         */
        this.isGroup &#x3D; data.isGroup;

        /**
         * Indicates if the Chat is readonly
         * @type {boolean}
         */
        this.isReadOnly &#x3D; data.isReadOnly;

        /**
         * Amount of messages unread
         * @type {number}
         */
        this.unreadCount &#x3D; data.unreadCount;

        /**
         * Unix timestamp for when the last activity occurred
         * @type {number}
         */
        this.timestamp &#x3D; data.t;

        /**
         * Indicates if the Chat is archived
         * @type {boolean}
         */
        this.archived &#x3D; data.archive;

        /**
         * Indicates if the Chat is pinned
         * @type {boolean}
         */
        this.pinned &#x3D; !!data.pin;

        /**
         * Indicates if the chat is muted or not
         * @type {boolean}
         */
        this.isMuted &#x3D; data.isMuted;

        /**
         * Unix timestamp for when the mute expires
         * @type {number}
         */
        this.muteExpiration &#x3D; data.muteExpiration;

        /**
         * Last message fo chat
         * @type {Message}
         */
        this.lastMessage &#x3D; data.lastMessage ? new Message(this.client, data.lastMessage) : undefined;
        
        return super._patch(data);
    }

    /**
     * Send a message to this chat
     * @param {string|MessageMedia|Location} content
     * @param {MessageSendOptions} [options] 
     * @returns {Promise&lt;Message>} Message that was just sent
     */
    async sendMessage(content, options) {
        return this.client.sendMessage(this.id._serialized, content, options);
    }

    /**
     * Sets the chat as seen
     * @returns {Promise&lt;Boolean>} result
     */
    async sendSeen() {
        return this.client.sendSeen(this.id._serialized);
    }

    /**
     * Clears all messages from the chat
     * @returns {Promise&lt;boolean>} result
     */
    async clearMessages() {
        return this.client.pupPage.evaluate(chatId &#x3D;> {
            return window.WWebJS.sendClearChat(chatId);
        }, this.id._serialized);
    }

    /**
     * Deletes the chat
     * @returns {Promise&lt;Boolean>} result
     */
    async delete() {
        return this.client.pupPage.evaluate(chatId &#x3D;> {
            return window.WWebJS.sendDeleteChat(chatId);
        }, this.id._serialized);
    }

    /**
     * Archives this chat
     */
    async archive() {
        return this.client.archiveChat(this.id._serialized);
    }

    /**
     * un-archives this chat
     */
    async unarchive() {
        return this.client.unarchiveChat(this.id._serialized);
    }

    /**
     * Pins this chat
     * @returns {Promise&lt;boolean>} New pin state. Could be false if the max number of pinned chats was reached.
     */
    async pin() {
        return this.client.pinChat(this.id._serialized);
    }

    /**
     * Unpins this chat
     * @returns {Promise&lt;boolean>} New pin state
     */
    async unpin() {
        return this.client.unpinChat(this.id._serialized);
    }

    /**
     * Mutes this chat forever, unless a date is specified
     * @param {?Date} unmuteDate Date when the chat will be unmuted, don&#x27;t provide a value to mute forever
     * @returns {Promise&lt;{isMuted: boolean, muteExpiration: number}>}
     */
    async mute(unmuteDate) {
        const result &#x3D; await this.client.muteChat(this.id._serialized, unmuteDate);
        this.isMuted &#x3D; result.isMuted;
        this.muteExpiration &#x3D; result.muteExpiration;
        return result;
    }

    /**
     * Unmutes this chat
     * @returns {Promise&lt;{isMuted: boolean, muteExpiration: number}>}
     */
    async unmute() {
        const result &#x3D; await this.client.unmuteChat(this.id._serialized);
        this.isMuted &#x3D; result.isMuted;
        this.muteExpiration &#x3D; result.muteExpiration;
        return result;
    }

    /**
     * Mark this chat as unread
     */
    async markUnread(){
        return this.client.markChatUnread(this.id._serialized);
    }

    /**
     * Loads chat messages, sorted from earliest to latest.
     * @param {Object} searchOptions Options for searching messages. Right now only limit and fromMe is supported.
     * @param {Number} [searchOptions.limit] The amount of messages to return. If no limit is specified, the available messages will be returned. Note that the actual number of returned messages may be smaller if there aren&#x27;t enough messages in the conversation. Set this to Infinity to load all messages.
     * @param {Boolean} [searchOptions.fromMe] Return only messages from the bot number or vise versa. To get all messages, leave the option undefined.
     * @returns {Promise&lt;Array&lt;Message>>}
     */
    async fetchMessages(searchOptions) {
        let messages &#x3D; await this.client.pupPage.evaluate(async (chatId, searchOptions) &#x3D;> {
            const msgFilter &#x3D; (m) &#x3D;> {
                if (m.isNotification) {
                    return false; // dont include notification messages
                }
                if (searchOptions &amp;&amp; searchOptions.fromMe !&#x3D;&#x3D; undefined &amp;&amp; m.id.fromMe !&#x3D;&#x3D; searchOptions.fromMe) {
                    return false;
                }
                return true;
            };

            const chat &#x3D; await window.WWebJS.getChat(chatId, { getAsModel: false });
            let msgs &#x3D; chat.msgs.getModelsArray().filter(msgFilter);

            if (searchOptions &amp;&amp; searchOptions.limit > 0) {
                while (msgs.length &lt; searchOptions.limit) {
                    const loadedMessages &#x3D; await window.Store.ConversationMsgs.loadEarlierMsgs(chat);
                    if (!loadedMessages || !loadedMessages.length) break;
                    msgs &#x3D; [...loadedMessages.filter(msgFilter), ...msgs];
                }
                
                if (msgs.length > searchOptions.limit) {
                    msgs.sort((a, b) &#x3D;> (a.t > b.t) ? 1 : -1);
                    msgs &#x3D; msgs.splice(msgs.length - searchOptions.limit);
                }
            }

            return msgs.map(m &#x3D;> window.WWebJS.getMessageModel(m));

        }, this.id._serialized, searchOptions);

        return messages.map(m &#x3D;> new Message(this.client, m));
    }

    /**
     * Simulate typing in chat. This will last for 25 seconds.
     */
    async sendStateTyping() {
        return this.client.pupPage.evaluate(chatId &#x3D;> {
            window.WWebJS.sendChatstate(&#x27;typing&#x27;, chatId);
            return true;
        }, this.id._serialized);
    }

    /**
     * Simulate recording audio in chat. This will last for 25 seconds.
     */
    async sendStateRecording() {
        return this.client.pupPage.evaluate(chatId &#x3D;> {
            window.WWebJS.sendChatstate(&#x27;recording&#x27;, chatId);
            return true;
        }, this.id._serialized);
    }

    /**
     * Stops typing or recording in chat immediately.
     */
    async clearState() {
        return this.client.pupPage.evaluate(chatId &#x3D;> {
            window.WWebJS.sendChatstate(&#x27;stop&#x27;, chatId);
            return true;
        }, this.id._serialized);
    }

    /**
     * Returns the Contact that corresponds to this Chat.
     * @returns {Promise&lt;Contact>}
     */
    async getContact() {
        return await this.client.getContactById(this.id._serialized);
    }

    /**
     * Returns array of all Labels assigned to this Chat
     * @returns {Promise&lt;Array&lt;Label>>}
     */
    async getLabels() {
        return this.client.getChatLabels(this.id._serialized);
    }

    /**
     * Add or remove labels to this Chat
     * @param {Array&lt;number|string>} labelIds
     * @returns {Promise&lt;void>}
     */
    async changeLabels(labelIds) {
        return this.client.addOrRemoveLabels(labelIds, [this.id._serialized]);
    }

    /**
     * Gets instances of all pinned messages in a chat
     * @returns {Promise&lt;[Message]|[]>}
     */
    async getPinnedMessages() {
        return this.client.getPinnedMessages(this.id._serialized);
    }
    
    /**
     * Sync chat history conversation
     * @return {Promise&lt;boolean>} True if operation completed successfully, false otherwise.
     */
    async syncHistory() {
        return this.client.syncHistory(this.id._serialized);
    }

    /**
     * Add or edit a customer note
     * @see https://faq.whatsapp.com/1433099287594476
     * @param {string} note The note to add
     * @returns {Promise&lt;void>}
     */
    async addOrEditCustomerNote(note) {
        if (this.isGroup || this.isChannel) return;

        return this.client.addOrEditCustomerNote(this.id._serialized, note);
    }

    /**
     * Get a customer note
     * @see https://faq.whatsapp.com/1433099287594476
     * @returns {Promise&lt;{
     *    chatId: string,
     *    content: string,
     *    createdAt: number,
     *    id: string,
     *    modifiedAt: number,
     *    type: string
     * }>}
     */
    async getCustomerNote() {
        if (this.isGroup || this.isChannel) return null;
        
        return this.client.getCustomerNote(this.id._serialized);
    }
}

module.exports &#x3D; Chat;

```

        Generated by [JSDoc](https://github.com/jsdoc3/jsdoc) 3.6.11 on October 23, 2025.