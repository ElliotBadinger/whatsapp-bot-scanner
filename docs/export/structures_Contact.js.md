whatsapp-web.js 1.34.1 &raquo; Source: structures/Contact.js

        [whatsapp-web.js 1.34.1](index.html)

            # Source: structures/Contact.js

            ```
&#x27;use strict&#x27;;

const Base &#x3D; require(&#x27;./Base&#x27;);

/**
 * ID that represents a contact
 * @typedef {Object} ContactId
 * @property {string} server
 * @property {string} user
 * @property {string} _serialized
 */

/**
 * Represents a Contact on WhatsApp
 * @extends {Base}
 */
class Contact extends Base {
    constructor(client, data) {
        super(client);

        if(data) this._patch(data);
    }

    _patch(data) {
        /**
         * ID that represents the contact
         * @type {ContactId}
         */
        this.id &#x3D; data.id;

        /**
         * Contact&#x27;s phone number
         * @type {string}
         */
        this.number &#x3D; data.userid;

        /**
         * Indicates if the contact is a business contact
         * @type {boolean}
         */
        this.isBusiness &#x3D; data.isBusiness;

        /**
         * Indicates if the contact is an enterprise contact
         * @type {boolean}
         */
        this.isEnterprise &#x3D; data.isEnterprise;

        this.labels &#x3D; data.labels;

        /**
         * The contact&#x27;s name, as saved by the current user
         * @type {?string}
         */
        this.name &#x3D; data.name;

        /**
         * The name that the contact has configured to be shown publically
         * @type {string}
         */
        this.pushname &#x3D; data.pushname;

        this.sectionHeader &#x3D; data.sectionHeader;

        /**
         * A shortened version of name
         * @type {?string}
         */
        this.shortName &#x3D; data.shortName;

        this.statusMute &#x3D; data.statusMute;
        this.type &#x3D; data.type;
        this.verifiedLevel &#x3D; data.verifiedLevel;
        this.verifiedName &#x3D; data.verifiedName;

        /**
         * Indicates if the contact is the current user&#x27;s contact
         * @type {boolean}
         */
        this.isMe &#x3D; data.isMe;

        /**
         * Indicates if the contact is a user contact
         * @type {boolean}
         */
        this.isUser &#x3D; data.isUser;

        /**
         * Indicates if the contact is a group contact
         * @type {boolean}
         */
        this.isGroup &#x3D; data.isGroup;

        /**
         * Indicates if the number is registered on WhatsApp
         * @type {boolean}
         */
        this.isWAContact &#x3D; data.isWAContact;

        /**
         * Indicates if the number is saved in the current phone&#x27;s contacts
         * @type {boolean}
         */
        this.isMyContact &#x3D; data.isMyContact;

        /**
         * Indicates if you have blocked this contact
         * @type {boolean}
         */
        this.isBlocked &#x3D; data.isBlocked;
        
        return super._patch(data);
    }

    /**
     * Returns the contact&#x27;s profile picture URL, if privacy settings allow it
     * @returns {Promise&lt;string>}
     */
    async getProfilePicUrl() {
        return await this.client.getProfilePicUrl(this.id._serialized);
    }

    /**
     * Returns the contact&#x27;s formatted phone number, (12345678901@c.us) &#x3D;> (+1 (234) 5678-901)
     * @returns {Promise&lt;string>}
     */
    async getFormattedNumber() {
        return await this.client.getFormattedNumber(this.id._serialized);
    }
    
    /**
     * Returns the contact&#x27;s countrycode, (1541859685@c.us) &#x3D;> (1)
     * @returns {Promise&lt;string>}
     */
    async getCountryCode() {
        return await this.client.getCountryCode(this.id._serialized);
    }
    
    /**
     * Returns the Chat that corresponds to this Contact. 
     * Will return null when getting chat for currently logged in user.
     * @returns {Promise&lt;Chat>}
     */
    async getChat() {
        if(this.isMe) return null;

        return await this.client.getChatById(this.id._serialized);
    }

    /**
     * Blocks this contact from WhatsApp
     * @returns {Promise&lt;boolean>}
     */
    async block() {
        if(this.isGroup) return false;

        await this.client.pupPage.evaluate(async (contactId) &#x3D;> {
            const contact &#x3D; window.Store.Contact.get(contactId);
            await window.Store.BlockContact.blockContact({contact});
        }, this.id._serialized);

        this.isBlocked &#x3D; true;
        return true;
    }

    /**
     * Unblocks this contact from WhatsApp
     * @returns {Promise&lt;boolean>}
     */
    async unblock() {
        if(this.isGroup) return false;

        await this.client.pupPage.evaluate(async (contactId) &#x3D;> {
            const contact &#x3D; window.Store.Contact.get(contactId);
            await window.Store.BlockContact.unblockContact(contact);
        }, this.id._serialized);

        this.isBlocked &#x3D; false;
        return true;
    }

    /**
     * Gets the Contact&#x27;s current &quot;about&quot; info. Returns null if you don&#x27;t have permission to read their status.
     * @returns {Promise&lt;?string>}
     */
    async getAbout() {
        const about &#x3D; await this.client.pupPage.evaluate(async (contactId) &#x3D;> {
            const wid &#x3D; window.Store.WidFactory.createWid(contactId);
            return window.Store.StatusUtils.getStatus({&#x27;token&#x27;:&#x27;&#x27;, &#x27;wid&#x27;: wid});
        }, this.id._serialized);

        if (typeof about.status !&#x3D;&#x3D; &#x27;string&#x27;)
            return null;

        return about.status;
    }

    /**
     * Gets the Contact&#x27;s common groups with you. Returns empty array if you don&#x27;t have any common group.
     * @returns {Promise&lt;WAWebJS.ChatId[]>}
     */
    async getCommonGroups() {
        return await this.client.getCommonGroups(this.id._serialized);
    }
    
}

module.exports &#x3D; Contact;

```

        Generated by [JSDoc](https://github.com/jsdoc3/jsdoc) 3.6.11 on October 23, 2025.