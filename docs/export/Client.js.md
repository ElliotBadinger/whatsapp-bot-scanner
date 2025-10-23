whatsapp-web.js 1.34.1 &raquo; Source: Client.js

        [whatsapp-web.js 1.34.1](index.html)

            # Source: Client.js

            ```
&#x27;use strict&#x27;;

const EventEmitter &#x3D; require(&#x27;events&#x27;);
const puppeteer &#x3D; require(&#x27;puppeteer&#x27;);
const moduleRaid &#x3D; require(&#x27;@pedroslopez/moduleraid/moduleraid&#x27;);

const Util &#x3D; require(&#x27;./util/Util&#x27;);
const InterfaceController &#x3D; require(&#x27;./util/InterfaceController&#x27;);
const { WhatsWebURL, DefaultOptions, Events, WAState } &#x3D; require(&#x27;./util/Constants&#x27;);
const { ExposeAuthStore } &#x3D; require(&#x27;./util/Injected/AuthStore/AuthStore&#x27;);
const { ExposeStore } &#x3D; require(&#x27;./util/Injected/Store&#x27;);
const { ExposeLegacyAuthStore } &#x3D; require(&#x27;./util/Injected/AuthStore/LegacyAuthStore&#x27;);
const { ExposeLegacyStore } &#x3D; require(&#x27;./util/Injected/LegacyStore&#x27;);
const { LoadUtils } &#x3D; require(&#x27;./util/Injected/Utils&#x27;);
const ChatFactory &#x3D; require(&#x27;./factories/ChatFactory&#x27;);
const ContactFactory &#x3D; require(&#x27;./factories/ContactFactory&#x27;);
const WebCacheFactory &#x3D; require(&#x27;./webCache/WebCacheFactory&#x27;);
const { ClientInfo, Message, MessageMedia, Contact, Location, Poll, PollVote, GroupNotification, Label, Call, Buttons, List, Reaction, Broadcast, ScheduledEvent } &#x3D; require(&#x27;./structures&#x27;);
const NoAuth &#x3D; require(&#x27;./authStrategies/NoAuth&#x27;);
const {exposeFunctionIfAbsent} &#x3D; require(&#x27;./util/Puppeteer&#x27;);

/**
 * Starting point for interacting with the WhatsApp Web API
 * @extends {EventEmitter}
 * @param {object} options - Client options
 * @param {AuthStrategy} options.authStrategy - Determines how to save and restore sessions. Will use LegacySessionAuth if options.session is set. Otherwise, NoAuth will be used.
 * @param {string} options.webVersion - The version of WhatsApp Web to use. Use options.webVersionCache to configure how the version is retrieved.
 * @param {object} options.webVersionCache - Determines how to retrieve the WhatsApp Web version. Defaults to a local cache (LocalWebCache) that falls back to latest if the requested version is not found.
 * @param {number} options.authTimeoutMs - Timeout for authentication selector in puppeteer
 * @param {object} options.puppeteer - Puppeteer launch options. View docs here: https://github.com/puppeteer/puppeteer/
 * @param {number} options.qrMaxRetries - How many times should the qrcode be refreshed before giving up
 * @param {string} options.restartOnAuthFail  - @deprecated This option should be set directly on the LegacySessionAuth.
 * @param {object} options.session - @deprecated Only here for backwards-compatibility. You should move to using LocalAuth, or set the authStrategy to LegacySessionAuth explicitly. 
 * @param {number} options.takeoverOnConflict - If another whatsapp web session is detected (another browser), take over the session in the current browser
 * @param {number} options.takeoverTimeoutMs - How much time to wait before taking over the session
 * @param {string} options.userAgent - User agent to use in puppeteer
 * @param {string} options.ffmpegPath - Ffmpeg path to use when formatting videos to webp while sending stickers 
 * @param {boolean} options.bypassCSP - Sets bypassing of page&#x27;s Content-Security-Policy.
 * @param {string} options.deviceName - Sets the device name of a current linked device., i.e.: &#x27;TEST&#x27;.
 * @param {string} options.browserName - Sets the browser name of a current linked device, i.e.: &#x27;Firefox&#x27;.
 * @param {object} options.proxyAuthentication - Proxy Authentication object.
 * 
 * @fires Client#qr
 * @fires Client#authenticated
 * @fires Client#auth_failure
 * @fires Client#ready
 * @fires Client#message
 * @fires Client#message_ack
 * @fires Client#message_create
 * @fires Client#message_revoke_me
 * @fires Client#message_revoke_everyone
 * @fires Client#message_ciphertext
 * @fires Client#message_edit
 * @fires Client#media_uploaded
 * @fires Client#group_join
 * @fires Client#group_leave
 * @fires Client#group_update
 * @fires Client#disconnected
 * @fires Client#change_state
 * @fires Client#contact_changed
 * @fires Client#group_admin_changed
 * @fires Client#group_membership_request
 * @fires Client#vote_update
 */
class Client extends EventEmitter {
    constructor(options &#x3D; {}) {
        super();

        this.options &#x3D; Util.mergeDefault(DefaultOptions, options);
        
        if(!this.options.authStrategy) {
            this.authStrategy &#x3D; new NoAuth();
        } else {
            this.authStrategy &#x3D; this.options.authStrategy;
        }

        this.authStrategy.setup(this);

        /**
         * @type {puppeteer.Browser}
         */
        this.pupBrowser &#x3D; null;
        /**
         * @type {puppeteer.Page}
         */
        this.pupPage &#x3D; null;

        this.currentIndexHtml &#x3D; null;
        this.lastLoggedOut &#x3D; false;

        Util.setFfmpegPath(this.options.ffmpegPath);
    }
    /**
     * Injection logic
     * Private function
     */
    async inject() {
        await this.pupPage.waitForFunction(&#x27;window.Debug?.VERSION !&#x3D; undefined&#x27;, {timeout: this.options.authTimeoutMs});
        await this.setDeviceName(this.options.deviceName, this.options.browserName);
        const pairWithPhoneNumber &#x3D; this.options.pairWithPhoneNumber;
        const version &#x3D; await this.getWWebVersion();
        const isCometOrAbove &#x3D; parseInt(version.split(&#x27;.&#x27;)?.[1]) >&#x3D; 3000;

        if (isCometOrAbove) {
            await this.pupPage.evaluate(ExposeAuthStore);
        } else {
            await this.pupPage.evaluate(ExposeLegacyAuthStore, moduleRaid.toString());
        }

        const needAuthentication &#x3D; await this.pupPage.evaluate(async () &#x3D;> {
            let state &#x3D; window.AuthStore.AppState.state;

            if (state &#x3D;&#x3D;&#x3D; &#x27;OPENING&#x27; || state &#x3D;&#x3D;&#x3D; &#x27;UNLAUNCHED&#x27; || state &#x3D;&#x3D;&#x3D; &#x27;PAIRING&#x27;) {
                // wait till state changes
                await new Promise(r &#x3D;> {
                    window.AuthStore.AppState.on(&#x27;change:state&#x27;, function waitTillInit(_AppState, state) {
                        if (state !&#x3D;&#x3D; &#x27;OPENING&#x27; &amp;&amp; state !&#x3D;&#x3D; &#x27;UNLAUNCHED&#x27; &amp;&amp; state !&#x3D;&#x3D; &#x27;PAIRING&#x27;) {
                            window.AuthStore.AppState.off(&#x27;change:state&#x27;, waitTillInit);
                            r();
                        } 
                    });
                }); 
            }
            state &#x3D; window.AuthStore.AppState.state;
            return state &#x3D;&#x3D; &#x27;UNPAIRED&#x27; || state &#x3D;&#x3D; &#x27;UNPAIRED_IDLE&#x27;;
        });

        if (needAuthentication) {
            const { failed, failureEventPayload, restart } &#x3D; await this.authStrategy.onAuthenticationNeeded();

            if(failed) {
                /**
                 * Emitted when there has been an error while trying to restore an existing session
                 * @event Client#auth_failure
                 * @param {string} message
                 */
                this.emit(Events.AUTHENTICATION_FAILURE, failureEventPayload);
                await this.destroy();
                if (restart) {
                    // session restore failed so try again but without session to force new authentication
                    return this.initialize();
                }
                return;
            }

            // Register qr/code events
            if (pairWithPhoneNumber.phoneNumber) {
                await exposeFunctionIfAbsent(this.pupPage, &#x27;onCodeReceivedEvent&#x27;, async (code) &#x3D;> {
                    /**
                    * Emitted when a pairing code is received
                    * @event Client#code
                    * @param {string} code Code
                    * @returns {string} Code that was just received
                    */
                    this.emit(Events.CODE_RECEIVED, code);
                    return code;
                });
                this.requestPairingCode(pairWithPhoneNumber.phoneNumber, pairWithPhoneNumber.showNotification, pairWithPhoneNumber.intervalMs);
            } else {
                let qrRetries &#x3D; 0;
                await exposeFunctionIfAbsent(this.pupPage, &#x27;onQRChangedEvent&#x27;, async (qr) &#x3D;> {
                    /**
                    * Emitted when a QR code is received
                    * @event Client#qr
                    * @param {string} qr QR Code
                    */
                    this.emit(Events.QR_RECEIVED, qr);
                    if (this.options.qrMaxRetries > 0) {
                        qrRetries++;
                        if (qrRetries > this.options.qrMaxRetries) {
                            this.emit(Events.DISCONNECTED, &#x27;Max qrcode retries reached&#x27;);
                            await this.destroy();
                        }
                    }
                });

                await this.pupPage.evaluate(async () &#x3D;> {
                    const registrationInfo &#x3D; await window.AuthStore.RegistrationUtils.waSignalStore.getRegistrationInfo();
                    const noiseKeyPair &#x3D; await window.AuthStore.RegistrationUtils.waNoiseInfo.get();
                    const staticKeyB64 &#x3D; window.AuthStore.Base64Tools.encodeB64(noiseKeyPair.staticKeyPair.pubKey);
                    const identityKeyB64 &#x3D; window.AuthStore.Base64Tools.encodeB64(registrationInfo.identityKeyPair.pubKey);
                    const advSecretKey &#x3D; await window.AuthStore.RegistrationUtils.getADVSecretKey();
                    const platform &#x3D; window.AuthStore.RegistrationUtils.DEVICE_PLATFORM;
                    const getQR &#x3D; (ref) &#x3D;> ref + &#x27;,&#x27; + staticKeyB64 + &#x27;,&#x27; + identityKeyB64 + &#x27;,&#x27; + advSecretKey + &#x27;,&#x27; + platform;

                    window.onQRChangedEvent(getQR(window.AuthStore.Conn.ref)); // initial qr
                    window.AuthStore.Conn.on(&#x27;change:ref&#x27;, (_, ref) &#x3D;> { window.onQRChangedEvent(getQR(ref)); }); // future QR changes
                });
            }
        }

        await exposeFunctionIfAbsent(this.pupPage, &#x27;onAuthAppStateChangedEvent&#x27;, async (state) &#x3D;> {
            if (state &#x3D;&#x3D; &#x27;UNPAIRED_IDLE&#x27; &amp;&amp; !pairWithPhoneNumber.phoneNumber) {
                // refresh qr code
                window.Store.Cmd.refreshQR();
            }
        });

        await exposeFunctionIfAbsent(this.pupPage, &#x27;onAppStateHasSyncedEvent&#x27;, async () &#x3D;> {
            const authEventPayload &#x3D; await this.authStrategy.getAuthEventPayload();
            /**
                 * Emitted when authentication is successful
                 * @event Client#authenticated
                 */
            this.emit(Events.AUTHENTICATED, authEventPayload);

            const injected &#x3D; await this.pupPage.evaluate(async () &#x3D;> {
                return typeof window.Store !&#x3D;&#x3D; &#x27;undefined&#x27; &amp;&amp; typeof window.WWebJS !&#x3D;&#x3D; &#x27;undefined&#x27;;
            });

            if (!injected) {
                if (this.options.webVersionCache.type &#x3D;&#x3D;&#x3D; &#x27;local&#x27; &amp;&amp; this.currentIndexHtml) {
                    const { type: webCacheType, ...webCacheOptions } &#x3D; this.options.webVersionCache;
                    const webCache &#x3D; WebCacheFactory.createWebCache(webCacheType, webCacheOptions);
            
                    await webCache.persist(this.currentIndexHtml, version);
                }

                if (isCometOrAbove) {
                    await this.pupPage.evaluate(ExposeStore);
                } else {
                    // make sure all modules are ready before injection
                    // 2 second delay after authentication makes sense and does not need to be made dyanmic or removed
                    await new Promise(r &#x3D;> setTimeout(r, 2000)); 
                    await this.pupPage.evaluate(ExposeLegacyStore);
                }

                // Check window.Store Injection
                await this.pupPage.waitForFunction(&#x27;window.Store !&#x3D; undefined&#x27;);
            
                /**
                     * Current connection information
                     * @type {ClientInfo}
                     */
                this.info &#x3D; new ClientInfo(this, await this.pupPage.evaluate(() &#x3D;> {
                    return { ...window.Store.Conn.serialize(), wid: window.Store.User.getMaybeMePnUser() || window.Store.User.getMaybeMeLidUser() };
                }));

                this.interface &#x3D; new InterfaceController(this);

                //Load util functions (serializers, helper functions)
                await this.pupPage.evaluate(LoadUtils);

                await this.attachEventListeners();
            }
            /**
                 * Emitted when the client has initialized and is ready to receive messages.
                 * @event Client#ready
                 */
            this.emit(Events.READY);
            this.authStrategy.afterAuthReady();
        });
        let lastPercent &#x3D; null;
        await exposeFunctionIfAbsent(this.pupPage, &#x27;onOfflineProgressUpdateEvent&#x27;, async (percent) &#x3D;> {
            if (lastPercent !&#x3D;&#x3D; percent) {
                lastPercent &#x3D; percent;
                this.emit(Events.LOADING_SCREEN, percent, &#x27;WhatsApp&#x27;); // Message is hardcoded as &quot;WhatsApp&quot; for now
            }
        });
        await exposeFunctionIfAbsent(this.pupPage, &#x27;onLogoutEvent&#x27;, async () &#x3D;> {
            this.lastLoggedOut &#x3D; true;
            await this.pupPage.waitForNavigation({waitUntil: &#x27;load&#x27;, timeout: 5000}).catch((_) &#x3D;> _);
        });
        await this.pupPage.evaluate(() &#x3D;> {
            window.AuthStore.AppState.on(&#x27;change:state&#x27;, (_AppState, state) &#x3D;> { window.onAuthAppStateChangedEvent(state); });
            window.AuthStore.AppState.on(&#x27;change:hasSynced&#x27;, () &#x3D;> { window.onAppStateHasSyncedEvent(); });
            window.AuthStore.Cmd.on(&#x27;offline_progress_update&#x27;, () &#x3D;> {
                window.onOfflineProgressUpdateEvent(window.AuthStore.OfflineMessageHandler.getOfflineDeliveryProgress()); 
            });
            window.AuthStore.Cmd.on(&#x27;logout&#x27;, async () &#x3D;> {
                await window.onLogoutEvent();
            });
        });
    }

    /**
     * Sets up events and requirements, kicks off authentication request
     */
    async initialize() {

        let 
            /**
             * @type {puppeteer.Browser}
             */
            browser, 
            /**
             * @type {puppeteer.Page}
             */
            page;

        browser &#x3D; null;
        page &#x3D; null;

        await this.authStrategy.beforeBrowserInitialized();

        const puppeteerOpts &#x3D; this.options.puppeteer;
        if (puppeteerOpts &amp;&amp; (puppeteerOpts.browserWSEndpoint || puppeteerOpts.browserURL)) {
            browser &#x3D; await puppeteer.connect(puppeteerOpts);
            page &#x3D; await browser.newPage();
        } else {
            const browserArgs &#x3D; [...(puppeteerOpts.args || [])];
            if(!browserArgs.find(arg &#x3D;> arg.includes(&#x27;--user-agent&#x27;))) {
                browserArgs.push(&#x60;--user-agent&#x3D;${this.options.userAgent}&#x60;);
            }
            // navigator.webdriver fix
            browserArgs.push(&#x27;--disable-blink-features&#x3D;AutomationControlled&#x27;);

            browser &#x3D; await puppeteer.launch({...puppeteerOpts, args: browserArgs});
            page &#x3D; (await browser.pages())[0];
        }

        if (this.options.proxyAuthentication !&#x3D;&#x3D; undefined) {
            await page.authenticate(this.options.proxyAuthentication);
        }
      
        await page.setUserAgent(this.options.userAgent);
        if (this.options.bypassCSP) await page.setBypassCSP(true);

        this.pupBrowser &#x3D; browser;
        this.pupPage &#x3D; page;

        await this.authStrategy.afterBrowserInitialized();
        await this.initWebVersionCache();

        // ocVersion (isOfficialClient patch)
        // remove after 2.3000.x hard release
        await page.evaluateOnNewDocument(() &#x3D;> {
            const originalError &#x3D; Error;
            window.originalError &#x3D; originalError;
            //eslint-disable-next-line no-global-assign
            Error &#x3D; function (message) {
                const error &#x3D; new originalError(message);
                const originalStack &#x3D; error.stack;
                if (error.stack.includes(&#x27;moduleRaid&#x27;)) error.stack &#x3D; originalStack + &#x27;\n    at https://web.whatsapp.com/vendors~lazy_loaded_low_priority_components.05e98054dbd60f980427.js:2:44&#x27;;
                return error;
            };
        });
        
        await page.goto(WhatsWebURL, {
            waitUntil: &#x27;load&#x27;,
            timeout: 0,
            referer: &#x27;https://whatsapp.com/&#x27;
        });

        await this.inject();

        this.pupPage.on(&#x27;framenavigated&#x27;, async (frame) &#x3D;> {
            if(frame.url().includes(&#x27;post_logout&#x3D;1&#x27;) || this.lastLoggedOut) {
                this.emit(Events.DISCONNECTED, &#x27;LOGOUT&#x27;);
                await this.authStrategy.logout();
                await this.authStrategy.beforeBrowserInitialized();
                await this.authStrategy.afterBrowserInitialized();
                this.lastLoggedOut &#x3D; false;
            }
            await this.inject();
        });
    }

    /**
     * Request authentication via pairing code instead of QR code
     * @param {string} phoneNumber - Phone number in international, symbol-free format (e.g. 12025550108 for US, 551155501234 for Brazil)
     * @param {boolean} [showNotification &#x3D; true] - Show notification to pair on phone number
     * @param {number} [intervalMs &#x3D; 180000] - The interval in milliseconds on how frequent to generate pairing code (WhatsApp default to 3 minutes)
     * @returns {Promise&lt;string>} - Returns a pairing code in format &quot;ABCDEFGH&quot;
     */
    async requestPairingCode(phoneNumber, showNotification &#x3D; true, intervalMs &#x3D; 180000) {
        return await this.pupPage.evaluate(async (phoneNumber, showNotification, intervalMs) &#x3D;> {
            const getCode &#x3D; async () &#x3D;> {
                while (!window.AuthStore.PairingCodeLinkUtils) {
                    await new Promise(resolve &#x3D;> setTimeout(resolve, 250));
                }
                window.AuthStore.PairingCodeLinkUtils.setPairingType(&#x27;ALT_DEVICE_LINKING&#x27;);
                await window.AuthStore.PairingCodeLinkUtils.initializeAltDeviceLinking();
                return window.AuthStore.PairingCodeLinkUtils.startAltLinkingFlow(phoneNumber, showNotification);
            };
            if (window.codeInterval) {
                clearInterval(window.codeInterval); // remove existing interval
            }
            window.codeInterval &#x3D; setInterval(async () &#x3D;> {
                if (window.AuthStore.AppState.state !&#x3D; &#x27;UNPAIRED&#x27; &amp;&amp; window.AuthStore.AppState.state !&#x3D; &#x27;UNPAIRED_IDLE&#x27;) {
                    clearInterval(window.codeInterval);
                    return;
                }
                window.onCodeReceivedEvent(await getCode());
            }, intervalMs);
            return window.onCodeReceivedEvent(await getCode());
        }, phoneNumber, showNotification, intervalMs);
    }

    /**
     * Attach event listeners to WA Web
     * Private function
     * @property {boolean} reinject is this a reinject?
     */
    async attachEventListeners() {
        await exposeFunctionIfAbsent(this.pupPage, &#x27;onAddMessageEvent&#x27;, msg &#x3D;> {
            if (msg.type &#x3D;&#x3D;&#x3D; &#x27;gp2&#x27;) {
                const notification &#x3D; new GroupNotification(this, msg);
                if ([&#x27;add&#x27;, &#x27;invite&#x27;, &#x27;linked_group_join&#x27;].includes(msg.subtype)) {
                    /**
                         * Emitted when a user joins the chat via invite link or is added by an admin.
                         * @event Client#group_join
                         * @param {GroupNotification} notification GroupNotification with more information about the action
                         */
                    this.emit(Events.GROUP_JOIN, notification);
                } else if (msg.subtype &#x3D;&#x3D;&#x3D; &#x27;remove&#x27; || msg.subtype &#x3D;&#x3D;&#x3D; &#x27;leave&#x27;) {
                    /**
                         * Emitted when a user leaves the chat or is removed by an admin.
                         * @event Client#group_leave
                         * @param {GroupNotification} notification GroupNotification with more information about the action
                         */
                    this.emit(Events.GROUP_LEAVE, notification);
                } else if (msg.subtype &#x3D;&#x3D;&#x3D; &#x27;promote&#x27; || msg.subtype &#x3D;&#x3D;&#x3D; &#x27;demote&#x27;) {
                    /**
                         * Emitted when a current user is promoted to an admin or demoted to a regular user.
                         * @event Client#group_admin_changed
                         * @param {GroupNotification} notification GroupNotification with more information about the action
                         */
                    this.emit(Events.GROUP_ADMIN_CHANGED, notification);
                } else if (msg.subtype &#x3D;&#x3D;&#x3D; &#x27;membership_approval_request&#x27;) {
                    /**
                         * Emitted when some user requested to join the group
                         * that has the membership approval mode turned on
                         * @event Client#group_membership_request
                         * @param {GroupNotification} notification GroupNotification with more information about the action
                         * @param {string} notification.chatId The group ID the request was made for
                         * @param {string} notification.author The user ID that made a request
                         * @param {number} notification.timestamp The timestamp the request was made at
                         */
                    this.emit(Events.GROUP_MEMBERSHIP_REQUEST, notification);
                } else {
                    /**
                         * Emitted when group settings are updated, such as subject, description or picture.
                         * @event Client#group_update
                         * @param {GroupNotification} notification GroupNotification with more information about the action
                         */
                    this.emit(Events.GROUP_UPDATE, notification);
                }
                return;
            }

            const message &#x3D; new Message(this, msg);

            /**
                 * Emitted when a new message is created, which may include the current user&#x27;s own messages.
                 * @event Client#message_create
                 * @param {Message} message The message that was created
                 */
            this.emit(Events.MESSAGE_CREATE, message);

            if (msg.id.fromMe) return;

            /**
                 * Emitted when a new message is received.
                 * @event Client#message
                 * @param {Message} message The message that was received
                 */
            this.emit(Events.MESSAGE_RECEIVED, message);
        });

        let last_message;

        await exposeFunctionIfAbsent(this.pupPage, &#x27;onChangeMessageTypeEvent&#x27;, (msg) &#x3D;> {

            if (msg.type &#x3D;&#x3D;&#x3D; &#x27;revoked&#x27;) {
                const message &#x3D; new Message(this, msg);
                let revoked_msg;
                if (last_message &amp;&amp; msg.id.id &#x3D;&#x3D;&#x3D; last_message.id.id) {
                    revoked_msg &#x3D; new Message(this, last_message);

                    if (message.protocolMessageKey)
                        revoked_msg.id &#x3D; { ...message.protocolMessageKey };                    
                }

                /**
                     * Emitted when a message is deleted for everyone in the chat.
                     * @event Client#message_revoke_everyone
                     * @param {Message} message The message that was revoked, in its current state. It will not contain the original message&#x27;s data.
                     * @param {?Message} revoked_msg The message that was revoked, before it was revoked. It will contain the message&#x27;s original data. 
                     * Note that due to the way this data is captured, it may be possible that this param will be undefined.
                     */
                this.emit(Events.MESSAGE_REVOKED_EVERYONE, message, revoked_msg);
            }

        });

        await exposeFunctionIfAbsent(this.pupPage, &#x27;onChangeMessageEvent&#x27;, (msg) &#x3D;> {

            if (msg.type !&#x3D;&#x3D; &#x27;revoked&#x27;) {
                last_message &#x3D; msg;
            }

            /**
                 * The event notification that is received when one of
                 * the group participants changes their phone number.
                 */
            const isParticipant &#x3D; msg.type &#x3D;&#x3D;&#x3D; &#x27;gp2&#x27; &amp;&amp; msg.subtype &#x3D;&#x3D;&#x3D; &#x27;modify&#x27;;

            /**
                 * The event notification that is received when one of
                 * the contacts changes their phone number.
                 */
            const isContact &#x3D; msg.type &#x3D;&#x3D;&#x3D; &#x27;notification_template&#x27; &amp;&amp; msg.subtype &#x3D;&#x3D;&#x3D; &#x27;change_number&#x27;;

            if (isParticipant || isContact) {
                /** @type {GroupNotification} object does not provide enough information about this event, so a @type {Message} object is used. */
                const message &#x3D; new Message(this, msg);

                const newId &#x3D; isParticipant ? msg.recipients[0] : msg.to;
                const oldId &#x3D; isParticipant ? msg.author : msg.templateParams.find(id &#x3D;> id !&#x3D;&#x3D; newId);

                /**
                     * Emitted when a contact or a group participant changes their phone number.
                     * @event Client#contact_changed
                     * @param {Message} message Message with more information about the event.
                     * @param {String} oldId The user&#x27;s id (an old one) who changed their phone number
                     * and who triggered the notification.
                     * @param {String} newId The user&#x27;s new id after the change.
                     * @param {Boolean} isContact Indicates if a contact or a group participant changed their phone number.
                     */
                this.emit(Events.CONTACT_CHANGED, message, oldId, newId, isContact);
            }
        });

        await exposeFunctionIfAbsent(this.pupPage, &#x27;onRemoveMessageEvent&#x27;, (msg) &#x3D;> {

            if (!msg.isNewMsg) return;

            const message &#x3D; new Message(this, msg);

            /**
                 * Emitted when a message is deleted by the current user.
                 * @event Client#message_revoke_me
                 * @param {Message} message The message that was revoked
                 */
            this.emit(Events.MESSAGE_REVOKED_ME, message);

        });

        await exposeFunctionIfAbsent(this.pupPage, &#x27;onMessageAckEvent&#x27;, (msg, ack) &#x3D;> {

            const message &#x3D; new Message(this, msg);

            /**
                 * Emitted when an ack event occurrs on message type.
                 * @event Client#message_ack
                 * @param {Message} message The message that was affected
                 * @param {MessageAck} ack The new ACK value
                 */
            this.emit(Events.MESSAGE_ACK, message, ack);

        });

        await exposeFunctionIfAbsent(this.pupPage, &#x27;onChatUnreadCountEvent&#x27;, async (data) &#x3D;>{
            const chat &#x3D; await this.getChatById(data.id);
                
            /**
                 * Emitted when the chat unread count changes
                 */
            this.emit(Events.UNREAD_COUNT, chat);
        });

        await exposeFunctionIfAbsent(this.pupPage, &#x27;onMessageMediaUploadedEvent&#x27;, (msg) &#x3D;> {

            const message &#x3D; new Message(this, msg);

            /**
                 * Emitted when media has been uploaded for a message sent by the client.
                 * @event Client#media_uploaded
                 * @param {Message} message The message with media that was uploaded
                 */
            this.emit(Events.MEDIA_UPLOADED, message);
        });

        await exposeFunctionIfAbsent(this.pupPage, &#x27;onAppStateChangedEvent&#x27;, async (state) &#x3D;> {
            /**
                 * Emitted when the connection state changes
                 * @event Client#change_state
                 * @param {WAState} state the new connection state
                 */
            this.emit(Events.STATE_CHANGED, state);

            const ACCEPTED_STATES &#x3D; [WAState.CONNECTED, WAState.OPENING, WAState.PAIRING, WAState.TIMEOUT];

            if (this.options.takeoverOnConflict) {
                ACCEPTED_STATES.push(WAState.CONFLICT);

                if (state &#x3D;&#x3D;&#x3D; WAState.CONFLICT) {
                    setTimeout(() &#x3D;> {
                        this.pupPage.evaluate(() &#x3D;> window.Store.AppState.takeover());
                    }, this.options.takeoverTimeoutMs);
                }
            }

            if (!ACCEPTED_STATES.includes(state)) {
                /**
                     * Emitted when the client has been disconnected
                     * @event Client#disconnected
                     * @param {WAState|&quot;LOGOUT&quot;} reason reason that caused the disconnect
                     */
                await this.authStrategy.disconnect();
                this.emit(Events.DISCONNECTED, state);
                this.destroy();
            }
        });

        await exposeFunctionIfAbsent(this.pupPage, &#x27;onBatteryStateChangedEvent&#x27;, (state) &#x3D;> {
            const { battery, plugged } &#x3D; state;

            if (battery &#x3D;&#x3D;&#x3D; undefined) return;

            /**
                 * Emitted when the battery percentage for the attached device changes. Will not be sent if using multi-device.
                 * @event Client#change_battery
                 * @param {object} batteryInfo
                 * @param {number} batteryInfo.battery - The current battery percentage
                 * @param {boolean} batteryInfo.plugged - Indicates if the phone is plugged in (true) or not (false)
                 * @deprecated
                 */
            this.emit(Events.BATTERY_CHANGED, { battery, plugged });
        });

        await exposeFunctionIfAbsent(this.pupPage, &#x27;onIncomingCall&#x27;, (call) &#x3D;> {
            /**
                 * Emitted when a call is received
                 * @event Client#incoming_call
                 * @param {object} call
                 * @param {number} call.id - Call id
                 * @param {string} call.peerJid - Who called
                 * @param {boolean} call.isVideo - if is video
                 * @param {boolean} call.isGroup - if is group
                 * @param {boolean} call.canHandleLocally - if we can handle in waweb
                 * @param {boolean} call.outgoing - if is outgoing
                 * @param {boolean} call.webClientShouldHandle - If Waweb should handle
                 * @param {object} call.participants - Participants
                 */
            const cll &#x3D; new Call(this, call);
            this.emit(Events.INCOMING_CALL, cll);
        });

        await exposeFunctionIfAbsent(this.pupPage, &#x27;onReaction&#x27;, (reactions) &#x3D;> {
            for (const reaction of reactions) {
                /**
                     * Emitted when a reaction is sent, received, updated or removed
                     * @event Client#message_reaction
                     * @param {object} reaction
                     * @param {object} reaction.id - Reaction id
                     * @param {number} reaction.orphan - Orphan
                     * @param {?string} reaction.orphanReason - Orphan reason
                     * @param {number} reaction.timestamp - Timestamp
                     * @param {string} reaction.reaction - Reaction
                     * @param {boolean} reaction.read - Read
                     * @param {object} reaction.msgId - Parent message id
                     * @param {string} reaction.senderId - Sender id
                     * @param {?number} reaction.ack - Ack
                     */

                this.emit(Events.MESSAGE_REACTION, new Reaction(this, reaction));
            }
        });

        await exposeFunctionIfAbsent(this.pupPage, &#x27;onRemoveChatEvent&#x27;, async (chat) &#x3D;> {
            const _chat &#x3D; await this.getChatById(chat.id);

            /**
                 * Emitted when a chat is removed
                 * @event Client#chat_removed
                 * @param {Chat} chat
                 */
            this.emit(Events.CHAT_REMOVED, _chat);
        });
            
        await exposeFunctionIfAbsent(this.pupPage, &#x27;onArchiveChatEvent&#x27;, async (chat, currState, prevState) &#x3D;> {
            const _chat &#x3D; await this.getChatById(chat.id);
                
            /**
                 * Emitted when a chat is archived/unarchived
                 * @event Client#chat_archived
                 * @param {Chat} chat
                 * @param {boolean} currState
                 * @param {boolean} prevState
                 */
            this.emit(Events.CHAT_ARCHIVED, _chat, currState, prevState);
        });

        await exposeFunctionIfAbsent(this.pupPage, &#x27;onEditMessageEvent&#x27;, (msg, newBody, prevBody) &#x3D;> {
                
            if(msg.type &#x3D;&#x3D;&#x3D; &#x27;revoked&#x27;){
                return;
            }
            /**
                 * Emitted when messages are edited
                 * @event Client#message_edit
                 * @param {Message} message
                 * @param {string} newBody
                 * @param {string} prevBody
                 */
            this.emit(Events.MESSAGE_EDIT, new Message(this, msg), newBody, prevBody);
        });
            
        await exposeFunctionIfAbsent(this.pupPage, &#x27;onAddMessageCiphertextEvent&#x27;, msg &#x3D;> {
                
            /**
                 * Emitted when messages are edited
                 * @event Client#message_ciphertext
                 * @param {Message} message
                 */
            this.emit(Events.MESSAGE_CIPHERTEXT, new Message(this, msg));
        });

        await exposeFunctionIfAbsent(this.pupPage, &#x27;onPollVoteEvent&#x27;, (votes) &#x3D;> {
            for (const vote of votes) {
                /**
                 * Emitted when some poll option is selected or deselected,
                 * shows a user&#x27;s current selected option(s) on the poll
                 * @event Client#vote_update
                 */
                this.emit(Events.VOTE_UPDATE, new PollVote(this, vote));
            }
        });

        await this.pupPage.evaluate(() &#x3D;> {
            window.Store.Msg.on(&#x27;change&#x27;, (msg) &#x3D;> { window.onChangeMessageEvent(window.WWebJS.getMessageModel(msg)); });
            window.Store.Msg.on(&#x27;change:type&#x27;, (msg) &#x3D;> { window.onChangeMessageTypeEvent(window.WWebJS.getMessageModel(msg)); });
            window.Store.Msg.on(&#x27;change:ack&#x27;, (msg, ack) &#x3D;> { window.onMessageAckEvent(window.WWebJS.getMessageModel(msg), ack); });
            window.Store.Msg.on(&#x27;change:isUnsentMedia&#x27;, (msg, unsent) &#x3D;> { if (msg.id.fromMe &amp;&amp; !unsent) window.onMessageMediaUploadedEvent(window.WWebJS.getMessageModel(msg)); });
            window.Store.Msg.on(&#x27;remove&#x27;, (msg) &#x3D;> { if (msg.isNewMsg) window.onRemoveMessageEvent(window.WWebJS.getMessageModel(msg)); });
            window.Store.Msg.on(&#x27;change:body change:caption&#x27;, (msg, newBody, prevBody) &#x3D;> { window.onEditMessageEvent(window.WWebJS.getMessageModel(msg), newBody, prevBody); });
            window.Store.AppState.on(&#x27;change:state&#x27;, (_AppState, state) &#x3D;> { window.onAppStateChangedEvent(state); });
            window.Store.Conn.on(&#x27;change:battery&#x27;, (state) &#x3D;> { window.onBatteryStateChangedEvent(state); });
            window.Store.Call.on(&#x27;add&#x27;, (call) &#x3D;> { window.onIncomingCall(call); });
            window.Store.Chat.on(&#x27;remove&#x27;, async (chat) &#x3D;> { window.onRemoveChatEvent(await window.WWebJS.getChatModel(chat)); });
            window.Store.Chat.on(&#x27;change:archive&#x27;, async (chat, currState, prevState) &#x3D;> { window.onArchiveChatEvent(await window.WWebJS.getChatModel(chat), currState, prevState); });
            window.Store.Msg.on(&#x27;add&#x27;, (msg) &#x3D;> { 
                if (msg.isNewMsg) {
                    if(msg.type &#x3D;&#x3D;&#x3D; &#x27;ciphertext&#x27;) {
                        // defer message event until ciphertext is resolved (type changed)
                        msg.once(&#x27;change:type&#x27;, (_msg) &#x3D;> window.onAddMessageEvent(window.WWebJS.getMessageModel(_msg)));
                        window.onAddMessageCiphertextEvent(window.WWebJS.getMessageModel(msg));
                    } else {
                        window.onAddMessageEvent(window.WWebJS.getMessageModel(msg)); 
                    }
                }
            });
            window.Store.Chat.on(&#x27;change:unreadCount&#x27;, (chat) &#x3D;> {window.onChatUnreadCountEvent(chat);});

            if (window.compareWwebVersions(window.Debug.VERSION, &#x27;>&#x3D;&#x27;, &#x27;2.3000.1014111620&#x27;)) {
                const module &#x3D; window.Store.AddonReactionTable;
                const ogMethod &#x3D; module.bulkUpsert;
                module.bulkUpsert &#x3D; ((...args) &#x3D;> {
                    window.onReaction(args[0].map(reaction &#x3D;> {
                        const msgKey &#x3D; reaction.id;
                        const parentMsgKey &#x3D; reaction.reactionParentKey;
                        const timestamp &#x3D; reaction.reactionTimestamp / 1000;
                        const sender &#x3D; reaction.author ?? reaction.from;
                        const senderUserJid &#x3D; sender._serialized;

                        return {...reaction, msgKey, parentMsgKey, senderUserJid, timestamp };
                    }));

                    return ogMethod(...args);
                }).bind(module);

                const pollVoteModule &#x3D; window.Store.AddonPollVoteTable;
                const ogPollVoteMethod &#x3D; pollVoteModule.bulkUpsert;

                pollVoteModule.bulkUpsert &#x3D; (async (...args) &#x3D;> {
                    const votes &#x3D; await Promise.all(args[0].map(async vote &#x3D;> {
                        const msgKey &#x3D; vote.id;
                        const parentMsgKey &#x3D; vote.pollUpdateParentKey;
                        const timestamp &#x3D; vote.t / 1000;
                        const sender &#x3D; vote.author ?? vote.from;
                        const senderUserJid &#x3D; sender._serialized;

                        let parentMessage &#x3D; window.Store.Msg.get(parentMsgKey._serialized);
                        if (!parentMessage) {
                            const fetched &#x3D; await window.Store.Msg.getMessagesById([parentMsgKey._serialized]);
                            parentMessage &#x3D; fetched?.messages?.[0] || null;
                        }

                        return {
                            ...vote,
                            msgKey,
                            sender,
                            parentMsgKey,
                            senderUserJid,
                            timestamp,
                            parentMessage
                        };
                    }));

                    window.onPollVoteEvent(votes);

                    return ogPollVoteMethod.apply(pollVoteModule, args);
                }).bind(pollVoteModule);
            } else {
                const module &#x3D; window.Store.createOrUpdateReactionsModule;
                const ogMethod &#x3D; module.createOrUpdateReactions;
                module.createOrUpdateReactions &#x3D; ((...args) &#x3D;> {
                    window.onReaction(args[0].map(reaction &#x3D;> {
                        const msgKey &#x3D; window.Store.MsgKey.fromString(reaction.msgKey);
                        const parentMsgKey &#x3D; window.Store.MsgKey.fromString(reaction.parentMsgKey);
                        const timestamp &#x3D; reaction.timestamp / 1000;

                        return {...reaction, msgKey, parentMsgKey, timestamp };
                    }));

                    return ogMethod(...args);
                }).bind(module);
            }
        });
    }    

    async initWebVersionCache() {
        const { type: webCacheType, ...webCacheOptions } &#x3D; this.options.webVersionCache;
        const webCache &#x3D; WebCacheFactory.createWebCache(webCacheType, webCacheOptions);

        const requestedVersion &#x3D; this.options.webVersion;
        const versionContent &#x3D; await webCache.resolve(requestedVersion);

        if(versionContent) {
            await this.pupPage.setRequestInterception(true);
            this.pupPage.on(&#x27;request&#x27;, async (req) &#x3D;> {
                if(req.url() &#x3D;&#x3D;&#x3D; WhatsWebURL) {
                    req.respond({
                        status: 200,
                        contentType: &#x27;text/html&#x27;,
                        body: versionContent
                    }); 
                } else {
                    req.continue();
                }
            });
        } else {
            this.pupPage.on(&#x27;response&#x27;, async (res) &#x3D;> {
                if(res.ok() &amp;&amp; res.url() &#x3D;&#x3D;&#x3D; WhatsWebURL) {
                    const indexHtml &#x3D; await res.text();
                    this.currentIndexHtml &#x3D; indexHtml;
                }
            });
        }
    }

    /**
     * Closes the client
     */
    async destroy() {
        await this.pupBrowser.close();
        await this.authStrategy.destroy();
    }

    /**
     * Logs out the client, closing the current session
     */
    async logout() {
        await this.pupPage.evaluate(() &#x3D;> {
            if (window.Store &amp;&amp; window.Store.AppState &amp;&amp; typeof window.Store.AppState.logout &#x3D;&#x3D;&#x3D; &#x27;function&#x27;) {
                return window.Store.AppState.logout();
            }
        });
        await this.pupBrowser.close();
        
        let maxDelay &#x3D; 0;
        while (this.pupBrowser.isConnected() &amp;&amp; (maxDelay &lt; 10)) { // waits a maximum of 1 second before calling the AuthStrategy
            await new Promise(resolve &#x3D;> setTimeout(resolve, 100));
            maxDelay++; 
        }
        
        await this.authStrategy.logout();
    }

    /**
     * Returns the version of WhatsApp Web currently being run
     * @returns {Promise&lt;string>}
     */
    async getWWebVersion() {
        return await this.pupPage.evaluate(() &#x3D;> {
            return window.Debug.VERSION;
        });
    }

    async setDeviceName(deviceName, browserName) {
        (deviceName || browserName) &amp;&amp; await this.pupPage.evaluate((deviceName, browserName) &#x3D;> {
            const func &#x3D; window.require(&#x27;WAWebMiscBrowserUtils&#x27;).info;
            window.require(&#x27;WAWebMiscBrowserUtils&#x27;).info &#x3D; () &#x3D;> {
                return {
                    ...func(),
                    ...(deviceName ? { os: deviceName } : {}),
                    ...(browserName ? { name: browserName } : {})
                };
            };
        }, deviceName, browserName);
    }

    /**
     * Mark as seen for the Chat
     *  @param {string} chatId
     *  @returns {Promise&lt;boolean>} result
     * 
     */
    async sendSeen(chatId) {
        return await this.pupPage.evaluate(async (chatId) &#x3D;> {
            return window.WWebJS.sendSeen(chatId);
        }, chatId);
    }

    /**
     * An object representing mentions of groups
     * @typedef {Object} GroupMention
     * @property {string} subject - The name of a group to mention (can be custom)
     * @property {string} id - The group ID, e.g.: &#x27;XXXXXXXXXX@g.us&#x27;
     */

    /**
     * Message options.
     * @typedef {Object} MessageSendOptions
     * @property {boolean} [linkPreview&#x3D;true] - Show links preview. Has no effect on multi-device accounts.
     * @property {boolean} [sendAudioAsVoice&#x3D;false] - Send audio as voice message with a generated waveform
     * @property {boolean} [sendVideoAsGif&#x3D;false] - Send video as gif
     * @property {boolean} [sendMediaAsSticker&#x3D;false] - Send media as a sticker
     * @property {boolean} [sendMediaAsDocument&#x3D;false] - Send media as a document
     * @property {boolean} [sendMediaAsHd&#x3D;false] - Send image as quality HD
     * @property {boolean} [isViewOnce&#x3D;false] - Send photo/video as a view once message
     * @property {boolean} [parseVCards&#x3D;true] - Automatically parse vCards and send them as contacts
     * @property {string} [caption] - Image or video caption
     * @property {string} [quotedMessageId] - Id of the message that is being quoted (or replied to)
     * @property {GroupMention[]} [groupMentions] - An array of object that handle group mentions
     * @property {string[]} [mentions] - User IDs to mention in the message
     * @property {boolean} [sendSeen&#x3D;true] - Mark the conversation as seen after sending the message
     * @property {string} [invokedBotWid&#x3D;undefined] - Bot Wid when doing a bot mention like @Meta AI
     * @property {string} [stickerAuthor&#x3D;undefined] - Sets the author of the sticker, (if sendMediaAsSticker is true).
     * @property {string} [stickerName&#x3D;undefined] - Sets the name of the sticker, (if sendMediaAsSticker is true).
     * @property {string[]} [stickerCategories&#x3D;undefined] - Sets the categories of the sticker, (if sendMediaAsSticker is true). Provide emoji char array, can be null.
     * @property {boolean} [ignoreQuoteErrors &#x3D; true] - Should the bot send a quoted message without the quoted message if it fails to get the quote?
     * @property {boolean} [waitUntilMsgSent &#x3D; false] - Should the bot wait for the message send result?
     * @property {MessageMedia} [media] - Media to be sent
     * @property {any} [extra] - Extra options
     */
    
    /**
     * Send a message to a specific chatId
     * @param {string} chatId
     * @param {string|MessageMedia|Location|Poll|Contact|Array&lt;Contact>|Buttons|List} content
     * @param {MessageSendOptions} [options] - Options used when sending the message
     * 
     * @returns {Promise&lt;Message>} Message that was just sent
     */
    async sendMessage(chatId, content, options &#x3D; {}) {
        const isChannel &#x3D; /@\w*newsletter\b/.test(chatId);

        if (isChannel &amp;&amp; [
            options.sendMediaAsDocument, options.quotedMessageId, 
            options.parseVCards, options.isViewOnce,
            content instanceof Location, content instanceof Contact,
            content instanceof Buttons, content instanceof List,
            Array.isArray(content) &amp;&amp; content.length > 0 &amp;&amp; content[0] instanceof Contact
        ].includes(true)) {
            console.warn(&#x27;The message type is currently not supported for sending in channels,\nthe supported message types are: text, image, sticker, gif, video, voice and poll.&#x27;);
            return null;
        }
    
        if (options.mentions) {
            !Array.isArray(options.mentions) &amp;&amp; (options.mentions &#x3D; [options.mentions]);
            if (options.mentions.some((possiblyContact) &#x3D;> possiblyContact instanceof Contact)) {
                console.warn(&#x27;Mentions with an array of Contact are now deprecated. See more at https://github.com/pedroslopez/whatsapp-web.js/pull/2166.&#x27;);
                options.mentions &#x3D; options.mentions.map((a) &#x3D;> a.id._serialized);
            }
        }

        options.groupMentions &amp;&amp; !Array.isArray(options.groupMentions) &amp;&amp; (options.groupMentions &#x3D; [options.groupMentions]);
        
        let internalOptions &#x3D; {
            linkPreview: options.linkPreview &#x3D;&#x3D;&#x3D; false ? undefined : true,
            sendAudioAsVoice: options.sendAudioAsVoice,
            sendVideoAsGif: options.sendVideoAsGif,
            sendMediaAsSticker: options.sendMediaAsSticker,
            sendMediaAsDocument: options.sendMediaAsDocument,
            sendMediaAsHd: options.sendMediaAsHd,
            caption: options.caption,
            quotedMessageId: options.quotedMessageId,
            parseVCards: options.parseVCards !&#x3D;&#x3D; false,
            mentionedJidList: options.mentions || [],
            groupMentions: options.groupMentions,
            invokedBotWid: options.invokedBotWid,
            ignoreQuoteErrors: options.ignoreQuoteErrors !&#x3D;&#x3D; false,
            waitUntilMsgSent: options.waitUntilMsgSent || false,
            extraOptions: options.extra
        };

        const sendSeen &#x3D; options.sendSeen !&#x3D;&#x3D; false;

        if (content instanceof MessageMedia) {
            internalOptions.media &#x3D; content;
            internalOptions.isViewOnce &#x3D; options.isViewOnce,
            content &#x3D; &#x27;&#x27;;
        } else if (options.media instanceof MessageMedia) {
            internalOptions.media &#x3D; options.media;
            internalOptions.caption &#x3D; content;
            internalOptions.isViewOnce &#x3D; options.isViewOnce,
            content &#x3D; &#x27;&#x27;;
        } else if (content instanceof Location) {
            internalOptions.location &#x3D; content;
            content &#x3D; &#x27;&#x27;;
        } else if (content instanceof Poll) {
            internalOptions.poll &#x3D; content;
            content &#x3D; &#x27;&#x27;;
        } else if (content instanceof ScheduledEvent) {
            internalOptions.event &#x3D; content;
            content &#x3D; &#x27;&#x27;;
        } else if (content instanceof Contact) {
            internalOptions.contactCard &#x3D; content.id._serialized;
            content &#x3D; &#x27;&#x27;;
        } else if (Array.isArray(content) &amp;&amp; content.length > 0 &amp;&amp; content[0] instanceof Contact) {
            internalOptions.contactCardList &#x3D; content.map(contact &#x3D;> contact.id._serialized);
            content &#x3D; &#x27;&#x27;;
        } else if (content instanceof Buttons) {
            console.warn(&#x27;Buttons are now deprecated. See more at https://www.youtube.com/watch?v&#x3D;hv1R1rLeVVE.&#x27;);
            if (content.type !&#x3D;&#x3D; &#x27;chat&#x27;) { internalOptions.attachment &#x3D; content.body; }
            internalOptions.buttons &#x3D; content;
            content &#x3D; &#x27;&#x27;;
        } else if (content instanceof List) {
            console.warn(&#x27;Lists are now deprecated. See more at https://www.youtube.com/watch?v&#x3D;hv1R1rLeVVE.&#x27;);
            internalOptions.list &#x3D; content;
            content &#x3D; &#x27;&#x27;;
        }

        if (internalOptions.sendMediaAsSticker &amp;&amp; internalOptions.media) {
            internalOptions.media &#x3D; await Util.formatToWebpSticker(
                internalOptions.media, {
                    name: options.stickerName,
                    author: options.stickerAuthor,
                    categories: options.stickerCategories
                }, this.pupPage
            );
        }

        const sentMsg &#x3D; await this.pupPage.evaluate(async (chatId, content, options, sendSeen) &#x3D;> {
            const chat &#x3D; await window.WWebJS.getChat(chatId, { getAsModel: false });

            if (!chat) return null;

            if (sendSeen) {
                await window.WWebJS.sendSeen(chatId);
            }

            const msg &#x3D; await window.WWebJS.sendMessage(chat, content, options);
            return msg
                ? window.WWebJS.getMessageModel(msg)
                : undefined;
        }, chatId, content, internalOptions, sendSeen);

        return sentMsg
            ? new Message(this, sentMsg)
            : undefined;
    }

    /**
     * @typedef {Object} SendChannelAdminInviteOptions
     * @property {?string} comment The comment to be added to an invitation
     */

    /**
     * Sends a channel admin invitation to a user, allowing them to become an admin of the channel
     * @param {string} chatId The ID of a user to send the channel admin invitation to
     * @param {string} channelId The ID of a channel for which the invitation is being sent
     * @param {SendChannelAdminInviteOptions} options 
     * @returns {Promise&lt;boolean>} Returns true if an invitation was sent successfully, false otherwise
     */
    async sendChannelAdminInvite(chatId, channelId, options &#x3D; {}) {
        const response &#x3D; await this.pupPage.evaluate(async (chatId, channelId, options) &#x3D;> {
            const channelWid &#x3D; window.Store.WidFactory.createWid(channelId);
            const chatWid &#x3D; window.Store.WidFactory.createWid(chatId);
            const chat &#x3D; window.Store.Chat.get(chatWid) || (await window.Store.Chat.find(chatWid));

            if (!chatWid.isUser()) {
                return false;
            }
            
            return await window.Store.SendChannelMessage.sendNewsletterAdminInviteMessage(
                chat,
                {
                    newsletterWid: channelWid,
                    invitee: chatWid,
                    inviteMessage: options.comment,
                    base64Thumb: await window.WWebJS.getProfilePicThumbToBase64(channelWid)
                }
            );
        }, chatId, channelId, options);

        return response.messageSendResult &#x3D;&#x3D;&#x3D; &#x27;OK&#x27;;
    }
    
    /**
     * Searches for messages
     * @param {string} query
     * @param {Object} [options]
     * @param {number} [options.page]
     * @param {number} [options.limit]
     * @param {string} [options.chatId]
     * @returns {Promise&lt;Message[]>}
     */
    async searchMessages(query, options &#x3D; {}) {
        const messages &#x3D; await this.pupPage.evaluate(async (query, page, count, remote) &#x3D;> {
            const { messages } &#x3D; await window.Store.Msg.search(query, page, count, remote);
            return messages.map(msg &#x3D;> window.WWebJS.getMessageModel(msg));
        }, query, options.page, options.limit, options.chatId);

        return messages.map(msg &#x3D;> new Message(this, msg));
    }

    /**
     * Get all current chat instances
     * @returns {Promise&lt;Array&lt;Chat>>}
     */
    async getChats() {
        const chats &#x3D; await this.pupPage.evaluate(async () &#x3D;> {
            return await window.WWebJS.getChats();
        });

        return chats.map(chat &#x3D;> ChatFactory.create(this, chat));
    }

    /**
     * Gets all cached {@link Channel} instance
     * @returns {Promise&lt;Array&lt;Channel>>}
     */
    async getChannels() {
        const channels &#x3D; await this.pupPage.evaluate(async () &#x3D;> {
            return await window.WWebJS.getChannels();
        });

        return channels.map((channel) &#x3D;> ChatFactory.create(this, channel));
    }

    /**
     * Gets chat or channel instance by ID
     * @param {string} chatId 
     * @returns {Promise&lt;Chat|Channel>}
     */
    async getChatById(chatId) {
        const chat &#x3D; await this.pupPage.evaluate(async chatId &#x3D;> {
            return await window.WWebJS.getChat(chatId);
        }, chatId);
        return chat
            ? ChatFactory.create(this, chat)
            : undefined;
    }

    /**
     * Gets a {@link Channel} instance by invite code
     * @param {string} inviteCode The code that comes after the &#x27;https://whatsapp.com/channel/&#x27;
     * @returns {Promise&lt;Channel>}
     */
    async getChannelByInviteCode(inviteCode) {
        const channel &#x3D; await this.pupPage.evaluate(async (inviteCode) &#x3D;> {
            let channelMetadata;
            try {
                channelMetadata &#x3D; await window.WWebJS.getChannelMetadata(inviteCode);
            } catch (err) {
                if (err.name &#x3D;&#x3D;&#x3D; &#x27;ServerStatusCodeError&#x27;) return null;
                throw err;
            }
            return await window.WWebJS.getChat(channelMetadata.id);
        }, inviteCode);

        return channel
            ? ChatFactory.create(this, channel)
            : undefined;
    }

    /**
     * Get all current contact instances
     * @returns {Promise&lt;Array&lt;Contact>>}
     */
    async getContacts() {
        let contacts &#x3D; await this.pupPage.evaluate(() &#x3D;> {
            return window.WWebJS.getContacts();
        });

        return contacts.map(contact &#x3D;> ContactFactory.create(this, contact));
    }

    /**
     * Get contact instance by ID
     * @param {string} contactId
     * @returns {Promise&lt;Contact>}
     */
    async getContactById(contactId) {
        let contact &#x3D; await this.pupPage.evaluate(contactId &#x3D;> {
            return window.WWebJS.getContact(contactId);
        }, contactId);

        return ContactFactory.create(this, contact);
    }
    
    async getMessageById(messageId) {
        const msg &#x3D; await this.pupPage.evaluate(async messageId &#x3D;> {
            let msg &#x3D; window.Store.Msg.get(messageId);
            if(msg) return window.WWebJS.getMessageModel(msg);

            const params &#x3D; messageId.split(&#x27;_&#x27;);
            if (params.length !&#x3D;&#x3D; 3 &amp;&amp; params.length !&#x3D;&#x3D; 4) throw new Error(&#x27;Invalid serialized message id specified&#x27;);

            let messagesObject &#x3D; await window.Store.Msg.getMessagesById([messageId]);
            if (messagesObject &amp;&amp; messagesObject.messages.length) msg &#x3D; messagesObject.messages[0];
            
            if(msg) return window.WWebJS.getMessageModel(msg);
        }, messageId);

        if(msg) return new Message(this, msg);
        return null;
    }

    /**
     * Gets instances of all pinned messages in a chat
     * @param {string} chatId The chat ID
     * @returns {Promise&lt;[Message]|[]>}
     */
    async getPinnedMessages(chatId) {
        const pinnedMsgs &#x3D; await this.pupPage.evaluate(async (chatId) &#x3D;> {
            const chatWid &#x3D; window.Store.WidFactory.createWid(chatId);
            const chat &#x3D; window.Store.Chat.get(chatWid) ?? await window.Store.Chat.find(chatWid);
            if (!chat) return [];
            
            const msgs &#x3D; await window.Store.PinnedMsgUtils.getTable().equals([&#x27;chatId&#x27;], chatWid.toString());

            const pinnedMsgs &#x3D; (
                await Promise.all(
                    msgs.filter(msg &#x3D;> msg.pinType &#x3D;&#x3D; 1).map(async (msg) &#x3D;> {
                        const res &#x3D; await window.Store.Msg.getMessagesById([msg.parentMsgKey]);
                        return res?.messages?.[0];
                    })
                )
            ).filter(Boolean);

            return !pinnedMsgs.length
                ? []
                : await Promise.all(pinnedMsgs.map((msg) &#x3D;> window.WWebJS.getMessageModel(msg)));
        }, chatId);

        return pinnedMsgs.map((msg) &#x3D;> new Message(this, msg));
    }

    /**
     * Returns an object with information about the invite code&#x27;s group
     * @param {string} inviteCode 
     * @returns {Promise&lt;object>} Invite information
     */
    async getInviteInfo(inviteCode) {
        return await this.pupPage.evaluate(inviteCode &#x3D;> {
            return window.Store.GroupInvite.queryGroupInvite(inviteCode);
        }, inviteCode);
    }

    /**
     * Accepts an invitation to join a group
     * @param {string} inviteCode Invitation code
     * @returns {Promise&lt;string>} Id of the joined Chat
     */
    async acceptInvite(inviteCode) {
        const res &#x3D; await this.pupPage.evaluate(async inviteCode &#x3D;> {
            return await window.Store.GroupInvite.joinGroupViaInvite(inviteCode);
        }, inviteCode);

        return res.gid._serialized;
    }

    /**
     * Accepts a channel admin invitation and promotes the current user to a channel admin
     * @param {string} channelId The channel ID to accept the admin invitation from
     * @returns {Promise&lt;boolean>} Returns true if the operation completed successfully, false otherwise
     */
    async acceptChannelAdminInvite(channelId) {
        return await this.pupPage.evaluate(async (channelId) &#x3D;> {
            try {
                await window.Store.ChannelUtils.acceptNewsletterAdminInvite(channelId);
                return true;
            } catch (err) {
                if (err.name &#x3D;&#x3D;&#x3D; &#x27;ServerStatusCodeError&#x27;) return false;
                throw err;
            }
        }, channelId);
    }

    /**
     * Revokes a channel admin invitation sent to a user by a channel owner
     * @param {string} channelId The channel ID an invitation belongs to
     * @param {string} userId The user ID the invitation was sent to
     * @returns {Promise&lt;boolean>} Returns true if the operation completed successfully, false otherwise
     */
    async revokeChannelAdminInvite(channelId, userId) {
        return await this.pupPage.evaluate(async (channelId, userId) &#x3D;> {
            try {
                const userWid &#x3D; window.Store.WidFactory.createWid(userId);
                await window.Store.ChannelUtils.revokeNewsletterAdminInvite(channelId, userWid);
                return true;
            } catch (err) {
                if (err.name &#x3D;&#x3D;&#x3D; &#x27;ServerStatusCodeError&#x27;) return false;
                throw err;
            }
        }, channelId, userId);
    }

    /**
     * Demotes a channel admin to a regular subscriber (can be used also for self-demotion)
     * @param {string} channelId The channel ID to demote an admin in
     * @param {string} userId The user ID to demote
     * @returns {Promise&lt;boolean>} Returns true if the operation completed successfully, false otherwise
     */
    async demoteChannelAdmin(channelId, userId) {
        return await this.pupPage.evaluate(async (channelId, userId) &#x3D;> {
            try {
                const userWid &#x3D; window.Store.WidFactory.createWid(userId);
                await window.Store.ChannelUtils.demoteNewsletterAdmin(channelId, userWid);
                return true;
            } catch (err) {
                if (err.name &#x3D;&#x3D;&#x3D; &#x27;ServerStatusCodeError&#x27;) return false;
                throw err;
            }
        }, channelId, userId);
    }

    /**
     * Accepts a private invitation to join a group
     * @param {object} inviteInfo Invite V4 Info
     * @returns {Promise&lt;Object>}
     */
    async acceptGroupV4Invite(inviteInfo) {
        if (!inviteInfo.inviteCode) throw &#x27;Invalid invite code, try passing the message.inviteV4 object&#x27;;
        if (inviteInfo.inviteCodeExp &#x3D;&#x3D; 0) throw &#x27;Expired invite code&#x27;;
        return this.pupPage.evaluate(async inviteInfo &#x3D;> {
            let { groupId, fromId, inviteCode, inviteCodeExp } &#x3D; inviteInfo;
            let userWid &#x3D; window.Store.WidFactory.createWid(fromId);
            return await window.Store.GroupInviteV4.joinGroupViaInviteV4(inviteCode, String(inviteCodeExp), groupId, userWid);
        }, inviteInfo);
    }

    /**
     * Sets the current user&#x27;s status message
     * @param {string} status New status message
     */
    async setStatus(status) {
        await this.pupPage.evaluate(async status &#x3D;> {
            return await window.Store.StatusUtils.setMyStatus(status);
        }, status);
    }

    /**
     * Sets the current user&#x27;s display name. 
     * This is the name shown to WhatsApp users that have not added you as a contact beside your number in groups and in your profile.
     * @param {string} displayName New display name
     * @returns {Promise&lt;Boolean>}
     */
    async setDisplayName(displayName) {
        const couldSet &#x3D; await this.pupPage.evaluate(async displayName &#x3D;> {
            if(!window.Store.Conn.canSetMyPushname()) return false;
            await window.Store.Settings.setPushname(displayName);
            return true;
        }, displayName);

        return couldSet;
    }
    
    /**
     * Gets the current connection state for the client
     * @returns {WAState} 
     */
    async getState() {
        return await this.pupPage.evaluate(() &#x3D;> {
            if(!window.Store) return null;
            return window.Store.AppState.state;
        });
    }

    /**
     * Marks the client as online
     */
    async sendPresenceAvailable() {
        return await this.pupPage.evaluate(() &#x3D;> {
            return window.Store.PresenceUtils.sendPresenceAvailable();
        });
    }

    /**
     * Marks the client as unavailable
     */
    async sendPresenceUnavailable() {
        return await this.pupPage.evaluate(() &#x3D;> {
            return window.Store.PresenceUtils.sendPresenceUnavailable();
        });
    }

    /**
     * Enables and returns the archive state of the Chat
     * @returns {boolean}
     */
    async archiveChat(chatId) {
        return await this.pupPage.evaluate(async chatId &#x3D;> {
            let chat &#x3D; await window.WWebJS.getChat(chatId, { getAsModel: false });
            await window.Store.Cmd.archiveChat(chat, true);
            return true;
        }, chatId);
    }

    /**
     * Changes and returns the archive state of the Chat
     * @returns {boolean}
     */
    async unarchiveChat(chatId) {
        return await this.pupPage.evaluate(async chatId &#x3D;> {
            let chat &#x3D; await window.WWebJS.getChat(chatId, { getAsModel: false });
            await window.Store.Cmd.archiveChat(chat, false);
            return false;
        }, chatId);
    }

    /**
     * Pins the Chat
     * @returns {Promise&lt;boolean>} New pin state. Could be false if the max number of pinned chats was reached.
     */
    async pinChat(chatId) {
        return this.pupPage.evaluate(async chatId &#x3D;> {
            let chat &#x3D; await window.WWebJS.getChat(chatId, { getAsModel: false });
            if (chat.pin) {
                return true;
            }
            const MAX_PIN_COUNT &#x3D; 3;
            const chatModels &#x3D; window.Store.Chat.getModelsArray();
            if (chatModels.length > MAX_PIN_COUNT) {
                let maxPinned &#x3D; chatModels[MAX_PIN_COUNT - 1].pin;
                if (maxPinned) {
                    return false;
                }
            }
            await window.Store.Cmd.pinChat(chat, true);
            return true;
        }, chatId);
    }

    /**
     * Unpins the Chat
     * @returns {Promise&lt;boolean>} New pin state
     */
    async unpinChat(chatId) {
        return this.pupPage.evaluate(async chatId &#x3D;> {
            let chat &#x3D; await window.WWebJS.getChat(chatId, { getAsModel: false });
            if (!chat.pin) {
                return false;
            }
            await window.Store.Cmd.pinChat(chat, false);
            return false;
        }, chatId);
    }

    /**
     * Mutes this chat forever, unless a date is specified
     * @param {string} chatId ID of the chat that will be muted
     * @param {?Date} unmuteDate Date when the chat will be unmuted, don&#x27;t provide a value to mute forever
     * @returns {Promise&lt;{isMuted: boolean, muteExpiration: number}>}
     */
    async muteChat(chatId, unmuteDate) {
        unmuteDate &#x3D; unmuteDate ? Math.floor(unmuteDate.getTime() / 1000) : -1;
        return this._muteUnmuteChat(chatId, &#x27;MUTE&#x27;, unmuteDate);
    }

    /**
     * Unmutes the Chat
     * @param {string} chatId ID of the chat that will be unmuted
     * @returns {Promise&lt;{isMuted: boolean, muteExpiration: number}>}
     */
    async unmuteChat(chatId) {
        return this._muteUnmuteChat(chatId, &#x27;UNMUTE&#x27;);
    }

    /**
     * Internal method to mute or unmute the chat
     * @param {string} chatId ID of the chat that will be muted/unmuted
     * @param {string} action The action: &#x27;MUTE&#x27; or &#x27;UNMUTE&#x27;
     * @param {number} unmuteDateTs Timestamp at which the chat will be unmuted
     * @returns {Promise&lt;{isMuted: boolean, muteExpiration: number}>}
     */
    async _muteUnmuteChat (chatId, action, unmuteDateTs) {
        return this.pupPage.evaluate(async (chatId, action, unmuteDateTs) &#x3D;> {
            const chat &#x3D; window.Store.Chat.get(chatId) ?? await window.Store.Chat.find(chatId);
            action &#x3D;&#x3D;&#x3D; &#x27;MUTE&#x27;
                ? await chat.mute.mute({ expiration: unmuteDateTs, sendDevice: true })
                : await chat.mute.unmute({ sendDevice: true });
            return { isMuted: chat.mute.expiration !&#x3D;&#x3D; 0, muteExpiration: chat.mute.expiration };
        }, chatId, action, unmuteDateTs || -1);
    }

    /**
     * Mark the Chat as unread
     * @param {string} chatId ID of the chat that will be marked as unread
     */
    async markChatUnread(chatId) {
        await this.pupPage.evaluate(async chatId &#x3D;> {
            let chat &#x3D; await window.WWebJS.getChat(chatId, { getAsModel: false });
            await window.Store.Cmd.markChatUnread(chat, true);
        }, chatId);
    }

    /**
     * Returns the contact ID&#x27;s profile picture URL, if privacy settings allow it
     * @param {string} contactId the whatsapp user&#x27;s ID
     * @returns {Promise&lt;string>}
     */
    async getProfilePicUrl(contactId) {
        const profilePic &#x3D; await this.pupPage.evaluate(async contactId &#x3D;> {
            try {
                const chatWid &#x3D; window.Store.WidFactory.createWid(contactId);
                return window.compareWwebVersions(window.Debug.VERSION, &#x27;&lt;&#x27;, &#x27;2.3000.0&#x27;)
                    ? await window.Store.ProfilePic.profilePicFind(chatWid)
                    : await window.Store.ProfilePic.requestProfilePicFromServer(chatWid);
            } catch (err) {
                if(err.name &#x3D;&#x3D;&#x3D; &#x27;ServerStatusCodeError&#x27;) return undefined;
                throw err;
            }
        }, contactId);
        
        return profilePic ? profilePic.eurl : undefined;
    }

    /**
     * Gets the Contact&#x27;s common groups with you. Returns empty array if you don&#x27;t have any common group.
     * @param {string} contactId the whatsapp user&#x27;s ID (_serialized format)
     * @returns {Promise&lt;WAWebJS.ChatId[]>}
     */
    async getCommonGroups(contactId) {
        const commonGroups &#x3D; await this.pupPage.evaluate(async (contactId) &#x3D;> {
            let contact &#x3D; window.Store.Contact.get(contactId);
            if (!contact) {
                const wid &#x3D; window.Store.WidFactory.createUserWid(contactId);
                const chatConstructor &#x3D; window.Store.Contact.getModelsArray().find(c&#x3D;>!c.isGroup).constructor;
                contact &#x3D; new chatConstructor({id: wid});
            }

            if (contact.commonGroups) {
                return contact.commonGroups.serialize();
            }
            const status &#x3D; await window.Store.findCommonGroups(contact);
            if (status) {
                return contact.commonGroups.serialize();
            }
            return [];
        }, contactId);
        const chats &#x3D; [];
        for (const group of commonGroups) {
            chats.push(group.id);
        }
        return chats;
    }

    /**
     * Force reset of connection state for the client
    */
    async resetState() {
        await this.pupPage.evaluate(() &#x3D;> {
            window.Store.AppState.reconnect(); 
        });
    }

    /**
     * Check if a given ID is registered in whatsapp
     * @param {string} id the whatsapp user&#x27;s ID
     * @returns {Promise&lt;Boolean>}
     */
    async isRegisteredUser(id) {
        return Boolean(await this.getNumberId(id));
    }

    /**
     * Get the registered WhatsApp ID for a number. 
     * Will return null if the number is not registered on WhatsApp.
     * @param {string} number Number or ID (&quot;@c.us&quot; will be automatically appended if not specified)
     * @returns {Promise&lt;Object|null>}
     */
    async getNumberId(number) {
        if (!number.endsWith(&#x27;@c.us&#x27;)) {
            number +&#x3D; &#x27;@c.us&#x27;;
        }

        return await this.pupPage.evaluate(async number &#x3D;> {
            const wid &#x3D; window.Store.WidFactory.createWid(number);
            const result &#x3D; await window.Store.QueryExist(wid);
            if (!result || result.wid &#x3D;&#x3D;&#x3D; undefined) return null;
            return result.wid;
        }, number);
    }

    /**
     * Get the formatted number of a WhatsApp ID.
     * @param {string} number Number or ID
     * @returns {Promise&lt;string>}
     */
    async getFormattedNumber(number) {
        if (!number.endsWith(&#x27;@s.whatsapp.net&#x27;)) number &#x3D; number.replace(&#x27;c.us&#x27;, &#x27;s.whatsapp.net&#x27;);
        if (!number.includes(&#x27;@s.whatsapp.net&#x27;)) number &#x3D; &#x60;${number}@s.whatsapp.net&#x60;;

        return await this.pupPage.evaluate(async numberId &#x3D;> {
            return window.Store.NumberInfo.formattedPhoneNumber(numberId);
        }, number);
    }

    /**
     * Get the country code of a WhatsApp ID.
     * @param {string} number Number or ID
     * @returns {Promise&lt;string>}
     */
    async getCountryCode(number) {
        number &#x3D; number.replace(&#x27; &#x27;, &#x27;&#x27;).replace(&#x27;+&#x27;, &#x27;&#x27;).replace(&#x27;@c.us&#x27;, &#x27;&#x27;);

        return await this.pupPage.evaluate(async numberId &#x3D;> {
            return window.Store.NumberInfo.findCC(numberId);
        }, number);
    }

    /**
     * An object that represents the result for a participant added to a group
     * @typedef {Object} ParticipantResult
     * @property {number} statusCode The status code of the result
     * @property {string} message The result message
     * @property {boolean} isGroupCreator Indicates if the participant is a group creator
     * @property {boolean} isInviteV4Sent Indicates if the inviteV4 was sent to the participant
     */

    /**
     * An object that handles the result for {@link createGroup} method
     * @typedef {Object} CreateGroupResult
     * @property {string} title A group title
     * @property {Object} gid An object that handles the newly created group ID
     * @property {string} gid.server
     * @property {string} gid.user
     * @property {string} gid._serialized
     * @property {Object.&lt;string, ParticipantResult>} participants An object that handles the result value for each added to the group participant
     */

    /**
     * An object that handles options for group creation
     * @typedef {Object} CreateGroupOptions
     * @property {number} [messageTimer &#x3D; 0] The number of seconds for the messages to disappear in the group (0 by default, won&#x27;t take an effect if the group is been creating with myself only)
     * @property {string|undefined} parentGroupId The ID of a parent community group to link the newly created group with (won&#x27;t take an effect if the group is been creating with myself only)
     * @property {boolean} [autoSendInviteV4 &#x3D; true] If true, the inviteV4 will be sent to those participants who have restricted others from being automatically added to groups, otherwise the inviteV4 won&#x27;t be sent (true by default)
     * @property {string} [comment &#x3D; &#x27;&#x27;] The comment to be added to an inviteV4 (empty string by default)
     * @property {boolean} [memberAddMode &#x3D; false] If true, only admins can add members to the group (false by default)
     * @property {boolean} [membershipApprovalMode &#x3D; false] If true, group admins will be required to approve anyone who wishes to join the group (false by default)
     * @property {boolean} [isRestrict &#x3D; true] If true, only admins can change group group info (true by default)
     * @property {boolean} [isAnnounce &#x3D; false] If true, only admins can send messages (false by default)
     */

    /**
     * Creates a new group
     * @param {string} title Group title
     * @param {string|Contact|Array&lt;Contact|string>|undefined} participants A single Contact object or an ID as a string or an array of Contact objects or contact IDs to add to the group
     * @param {CreateGroupOptions} options An object that handles options for group creation
     * @returns {Promise&lt;CreateGroupResult|string>} Object with resulting data or an error message as a string
     */
    async createGroup(title, participants &#x3D; [], options &#x3D; {}) {
        !Array.isArray(participants) &amp;&amp; (participants &#x3D; [participants]);
        participants.map(p &#x3D;> (p instanceof Contact) ? p.id._serialized : p);

        return await this.pupPage.evaluate(async (title, participants, options) &#x3D;> {
            const {
                messageTimer &#x3D; 0,
                parentGroupId,
                autoSendInviteV4 &#x3D; true,
                comment &#x3D; &#x27;&#x27;,
            } &#x3D; options;
            const participantData &#x3D; {}, participantWids &#x3D; [], failedParticipants &#x3D; [];
            let createGroupResult, parentGroupWid;

            const addParticipantResultCodes &#x3D; {
                default: &#x27;An unknown error occupied while adding a participant&#x27;,
                200: &#x27;The participant was added successfully&#x27;,
                403: &#x27;The participant can be added by sending private invitation only&#x27;,
                404: &#x27;The phone number is not registered on WhatsApp&#x27;
            };

            for (const participant of participants) {
                const pWid &#x3D; window.Store.WidFactory.createWid(participant);
                if ((await window.Store.QueryExist(pWid))?.wid) {
                    participantWids.push({ phoneNumber: pWid });
                }
                else failedParticipants.push(participant);
            }

            parentGroupId &amp;&amp; (parentGroupWid &#x3D; window.Store.WidFactory.createWid(parentGroupId));

            try {
                createGroupResult &#x3D; await window.Store.GroupUtils.createGroup(
                    {
                        &#x27;addressingModeOverride&#x27;: &#x27;lid&#x27;,
                        &#x27;memberAddMode&#x27;: options.memberAddMode ?? false,
                        &#x27;membershipApprovalMode&#x27;: options.membershipApprovalMode ?? false,
                        &#x27;announce&#x27;: options.announce ?? false,
                        &#x27;restrict&#x27;: options.isRestrict !&#x3D;&#x3D; undefined ? !options.isRestrict : false,
                        &#x27;ephemeralDuration&#x27;: messageTimer,
                        &#x27;parentGroupId&#x27;: parentGroupWid,
                        &#x27;title&#x27;: title,
                    },
                    participantWids
                );
            } catch (err) {
                return &#x27;CreateGroupError: An unknown error occupied while creating a group&#x27;;
            }

            for (const participant of createGroupResult.participants) {
                let isInviteV4Sent &#x3D; false;
                participant.wid.server &#x3D;&#x3D; &#x27;lid&#x27; &amp;&amp; (participant.wid &#x3D; window.Store.LidUtils.getPhoneNumber(participant.wid));
                const participantId &#x3D; participant.wid._serialized;
                const statusCode &#x3D; participant.error || 200;

                if (autoSendInviteV4 &amp;&amp; statusCode &#x3D;&#x3D;&#x3D; 403) {
                    window.Store.Contact.gadd(participant.wid, { silent: true });
                    const addParticipantResult &#x3D; await window.Store.GroupInviteV4.sendGroupInviteMessage(
                        window.Store.Chat.get(participant.wid) || await window.Store.Chat.find(participant.wid),
                        createGroupResult.wid._serialized,
                        createGroupResult.subject,
                        participant.invite_code,
                        participant.invite_code_exp,
                        comment,
                        await window.WWebJS.getProfilePicThumbToBase64(createGroupResult.wid)
                    );
                    isInviteV4Sent &#x3D; addParticipantResult.messageSendResult &#x3D;&#x3D;&#x3D; &#x27;OK&#x27;;
                }

                participantData[participantId] &#x3D; {
                    statusCode: statusCode,
                    message: addParticipantResultCodes[statusCode] || addParticipantResultCodes.default,
                    isGroupCreator: participant.type &#x3D;&#x3D;&#x3D; &#x27;superadmin&#x27;,
                    isInviteV4Sent: isInviteV4Sent
                };
            }

            for (const f of failedParticipants) {
                participantData[f] &#x3D; {
                    statusCode: 404,
                    message: addParticipantResultCodes[404],
                    isGroupCreator: false,
                    isInviteV4Sent: false
                };
            }

            return { title: title, gid: createGroupResult.wid, participants: participantData };
        }, title, participants, options);
    }

    /**
     * An object that handles the result for {@link createChannel} method
     * @typedef {Object} CreateChannelResult
     * @property {string} title A channel title
     * @property {ChatId} nid An object that handels the newly created channel ID
     * @property {string} nid.server &#x27;newsletter&#x27;
     * @property {string} nid.user &#x27;XXXXXXXXXX&#x27;
     * @property {string} nid._serialized &#x27;XXXXXXXXXX@newsletter&#x27;
     * @property {string} inviteLink The channel invite link, starts with &#x27;https://whatsapp.com/channel/&#x27;
     * @property {number} createdAtTs The timestamp the channel was created at
     */

    /**
     * Options for the channel creation
     * @typedef {Object} CreateChannelOptions
     * @property {?string} description The channel description
     * @property {?MessageMedia} picture The channel profile picture
     */

    /**
     * Creates a new channel
     * @param {string} title The channel name
     * @param {CreateChannelOptions} options 
     * @returns {Promise&lt;CreateChannelResult|string>} Returns an object that handles the result for the channel creation or an error message as a string
     */
    async createChannel(title, options &#x3D; {}) {
        return await this.pupPage.evaluate(async (title, options) &#x3D;> {
            let response, { description &#x3D; null, picture &#x3D; null } &#x3D; options;

            if (!window.Store.ChannelUtils.isNewsletterCreationEnabled()) {
                return &#x27;CreateChannelError: A channel creation is not enabled&#x27;;
            }

            if (picture) {
                picture &#x3D; await window.WWebJS.cropAndResizeImage(picture, {
                    asDataUrl: true,
                    mimetype: &#x27;image/jpeg&#x27;,
                    size: 640,
                    quality: 1
                });
            }

            try {
                response &#x3D; await window.Store.ChannelUtils.createNewsletterQuery({
                    name: title,
                    description: description,
                    picture: picture,
                });
            } catch (err) {
                if (err.name &#x3D;&#x3D;&#x3D; &#x27;ServerStatusCodeError&#x27;) {
                    return &#x27;CreateChannelError: An error occupied while creating a channel&#x27;;
                }
                throw err;
            }

            return {
                title: title,
                nid: window.Store.JidToWid.newsletterJidToWid(response.idJid),
                inviteLink: &#x60;https://whatsapp.com/channel/${response.newsletterInviteLinkMetadataMixin.inviteCode}&#x60;,
                createdAtTs: response.newsletterCreationTimeMetadataMixin.creationTimeValue
            };
        }, title, options);
    }

    /**
     * Subscribe to channel
     * @param {string} channelId The channel ID
     * @returns {Promise&lt;boolean>} Returns true if the operation completed successfully, false otherwise
     */
    async subscribeToChannel(channelId) {
        return await this.pupPage.evaluate(async (channelId) &#x3D;> {
            return await window.WWebJS.subscribeToUnsubscribeFromChannel(channelId, &#x27;Subscribe&#x27;);
        }, channelId);
    }

    /**
     * Options for unsubscribe from a channel
     * @typedef {Object} UnsubscribeOptions
     * @property {boolean} [deleteLocalModels &#x3D; false] If true, after an unsubscription, it will completely remove a channel from the channel collection making it seem like the current user have never interacted with it. Otherwise it will only remove a channel from the list of channels the current user is subscribed to and will set the membership type for that channel to GUEST
     */

    /**
     * Unsubscribe from channel
     * @param {string} channelId The channel ID
     * @param {UnsubscribeOptions} options
     * @returns {Promise&lt;boolean>} Returns true if the operation completed successfully, false otherwise
     */
    async unsubscribeFromChannel(channelId, options) {
        return await this.pupPage.evaluate(async (channelId, options) &#x3D;> {
            return await window.WWebJS.subscribeToUnsubscribeFromChannel(channelId, &#x27;Unsubscribe&#x27;, options);
        }, channelId, options);
    }

    /**
     * Options for transferring a channel ownership to another user
     * @typedef {Object} TransferChannelOwnershipOptions
     * @property {boolean} [shouldDismissSelfAsAdmin &#x3D; false] If true, after the channel ownership is being transferred to another user, the current user will be dismissed as a channel admin and will become to a channel subscriber.
     */

    /**
     * Transfers a channel ownership to another user.
     * Note: the user you are transferring the channel ownership to must be a channel admin.
     * @param {string} channelId
     * @param {string} newOwnerId
     * @param {TransferChannelOwnershipOptions} options
     * @returns {Promise&lt;boolean>} Returns true if the operation completed successfully, false otherwise
     */
    async transferChannelOwnership(channelId, newOwnerId, options &#x3D; {}) {
        return await this.pupPage.evaluate(async (channelId, newOwnerId, options) &#x3D;> {
            const channel &#x3D; await window.WWebJS.getChat(channelId, { getAsModel: false });
            const newOwner &#x3D; window.Store.Contact.get(newOwnerId) || (await window.Store.Contact.find(newOwnerId));
            if (!channel.newsletterMetadata) {
                await window.Store.NewsletterMetadataCollection.update(channel.id);
            }

            try {
                await window.Store.ChannelUtils.changeNewsletterOwnerAction(channel, newOwner);

                if (options.shouldDismissSelfAsAdmin) {
                    const meContact &#x3D; window.Store.ContactCollection.getMeContact();
                    meContact &amp;&amp; (await window.Store.ChannelUtils.demoteNewsletterAdminAction(channel, meContact));
                }
            } catch (error) {
                return false;
            }

            return true;
        }, channelId, newOwnerId, options);
    }

    /**
     * Searches for channels based on search criteria, there are some notes:
     * 1. The method finds only channels you are not subscribed to currently
     * 2. If you have never been subscribed to a found channel
     * or you have unsubscribed from it with {@link UnsubscribeOptions.deleteLocalModels} set to &#x27;true&#x27;,
     * the lastMessage property of a found channel will be &#x27;null&#x27;
     *
     * @param {Object} searchOptions Search options
     * @param {string} [searchOptions.searchText &#x3D; &#x27;&#x27;] Text to search
     * @param {Array&lt;string>} [searchOptions.countryCodes &#x3D; [your local region]] Array of country codes in &#x27;ISO 3166-1 alpha-2&#x27; standart (@see https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) to search for channels created in these countries
     * @param {boolean} [searchOptions.skipSubscribedNewsletters &#x3D; false] If true, channels that user is subscribed to won&#x27;t appear in found channels
     * @param {number} [searchOptions.view &#x3D; 0] View type, makes sense only when the searchText is empty. Valid values to provide are:
     * 0 for RECOMMENDED channels
     * 1 for TRENDING channels
     * 2 for POPULAR channels
     * 3 for NEW channels
     * @param {number} [searchOptions.limit &#x3D; 50] The limit of found channels to be appear in the returnig result
     * @returns {Promise&lt;Array&lt;Channel>|[]>} Returns an array of Channel objects or an empty array if no channels were found
     */
    async searchChannels(searchOptions &#x3D; {}) {
        return await this.pupPage.evaluate(async ({
            searchText &#x3D; &#x27;&#x27;,
            countryCodes &#x3D; [window.Store.ChannelUtils.currentRegion],
            skipSubscribedNewsletters &#x3D; false,
            view &#x3D; 0,
            limit &#x3D; 50
        }) &#x3D;> {
            searchText &#x3D; searchText.trim();
            const currentRegion &#x3D; window.Store.ChannelUtils.currentRegion;
            if (![0, 1, 2, 3].includes(view)) view &#x3D; 0;

            countryCodes &#x3D; countryCodes.length &#x3D;&#x3D;&#x3D; 1 &amp;&amp; countryCodes[0] &#x3D;&#x3D;&#x3D; currentRegion
                ? countryCodes
                : countryCodes.filter((code) &#x3D;> Object.keys(window.Store.ChannelUtils.countryCodesIso).includes(code));

            const viewTypeMapping &#x3D; {
                0: &#x27;RECOMMENDED&#x27;,
                1: &#x27;TRENDING&#x27;,
                2: &#x27;POPULAR&#x27;,
                3: &#x27;NEW&#x27;
            };

            searchOptions &#x3D; {
                searchText: searchText,
                countryCodes: countryCodes,
                skipSubscribedNewsletters: skipSubscribedNewsletters,
                view: viewTypeMapping[view],
                categories: [],
                cursorToken: &#x27;&#x27;
            };
            
            const originalFunction &#x3D; window.Store.ChannelUtils.getNewsletterDirectoryPageSize;
            limit !&#x3D;&#x3D; 50 &amp;&amp; (window.Store.ChannelUtils.getNewsletterDirectoryPageSize &#x3D; () &#x3D;> limit);

            const channels &#x3D; (await window.Store.ChannelUtils.fetchNewsletterDirectories(searchOptions)).newsletters;

            limit !&#x3D;&#x3D; 50 &amp;&amp; (window.Store.ChannelUtils.getNewsletterDirectoryPageSize &#x3D; originalFunction);

            return channels
                ? await Promise.all(channels.map((channel) &#x3D;> window.WWebJS.getChatModel(channel, { isChannel: true })))
                : [];
        }, searchOptions);
    }

    /**
     * Deletes the channel you created
     * @param {string} channelId The ID of a channel to delete
     * @returns {Promise&lt;boolean>} Returns true if the operation completed successfully, false otherwise
     */
    async deleteChannel(channelId) {
        return await this.client.pupPage.evaluate(async (channelId) &#x3D;> {
            const channel &#x3D; await window.WWebJS.getChat(channelId, { getAsModel: false });
            if (!channel) return false;
            try {
                await window.Store.ChannelUtils.deleteNewsletterAction(channel);
                return true;
            } catch (err) {
                if (err.name &#x3D;&#x3D;&#x3D; &#x27;ServerStatusCodeError&#x27;) return false;
                throw err;
            }
        }, channelId);
    }

    /**
     * Get all current Labels
     * @returns {Promise&lt;Array&lt;Label>>}
     */
    async getLabels() {
        const labels &#x3D; await this.pupPage.evaluate(async () &#x3D;> {
            return window.WWebJS.getLabels();
        });

        return labels.map(data &#x3D;> new Label(this, data));
    }
    
    /**
     * Get all current Broadcast
     * @returns {Promise&lt;Array&lt;Broadcast>>}
     */
    async getBroadcasts() {
        const broadcasts &#x3D; await this.pupPage.evaluate(async () &#x3D;> {
            return window.WWebJS.getAllStatuses();
        });
        return broadcasts.map(data &#x3D;> new Broadcast(this, data));
    }

    /**
     * Get Label instance by ID
     * @param {string} labelId
     * @returns {Promise&lt;Label>}
     */
    async getLabelById(labelId) {
        const label &#x3D; await this.pupPage.evaluate(async (labelId) &#x3D;> {
            return window.WWebJS.getLabel(labelId);
        }, labelId);

        return new Label(this, label);
    }

    /**
     * Get all Labels assigned to a chat 
     * @param {string} chatId
     * @returns {Promise&lt;Array&lt;Label>>}
     */
    async getChatLabels(chatId) {
        const labels &#x3D; await this.pupPage.evaluate(async (chatId) &#x3D;> {
            return window.WWebJS.getChatLabels(chatId);
        }, chatId);

        return labels.map(data &#x3D;> new Label(this, data));
    }

    /**
     * Get all Chats for a specific Label
     * @param {string} labelId
     * @returns {Promise&lt;Array&lt;Chat>>}
     */
    async getChatsByLabelId(labelId) {
        const chatIds &#x3D; await this.pupPage.evaluate(async (labelId) &#x3D;> {
            const label &#x3D; window.Store.Label.get(labelId);
            const labelItems &#x3D; label.labelItemCollection.getModelsArray();
            return labelItems.reduce((result, item) &#x3D;> {
                if (item.parentType &#x3D;&#x3D;&#x3D; &#x27;Chat&#x27;) {
                    result.push(item.parentId);
                }
                return result;
            }, []);
        }, labelId);

        return Promise.all(chatIds.map(id &#x3D;> this.getChatById(id)));
    }

    /**
     * Gets all blocked contacts by host account
     * @returns {Promise&lt;Array&lt;Contact>>}
     */
    async getBlockedContacts() {
        const blockedContacts &#x3D; await this.pupPage.evaluate(() &#x3D;> {
            let chatIds &#x3D; window.Store.Blocklist.getModelsArray().map(a &#x3D;> a.id._serialized);
            return Promise.all(chatIds.map(id &#x3D;> window.WWebJS.getContact(id)));
        });

        return blockedContacts.map(contact &#x3D;> ContactFactory.create(this.client, contact));
    }

    /**
     * Sets the current user&#x27;s profile picture.
     * @param {MessageMedia} media
     * @returns {Promise&lt;boolean>} Returns true if the picture was properly updated.
     */
    async setProfilePicture(media) {
        const success &#x3D; await this.pupPage.evaluate((chatid, media) &#x3D;> {
            return window.WWebJS.setPicture(chatid, media);
        }, this.info.wid._serialized, media);

        return success;
    }

    /**
     * Deletes the current user&#x27;s profile picture.
     * @returns {Promise&lt;boolean>} Returns true if the picture was properly deleted.
     */
    async deleteProfilePicture() {
        const success &#x3D; await this.pupPage.evaluate((chatid) &#x3D;> {
            return window.WWebJS.deletePicture(chatid);
        }, this.info.wid._serialized);

        return success;
    }
    
    /**
     * Change labels in chats
     * @param {Array&lt;number|string>} labelIds
     * @param {Array&lt;string>} chatIds
     * @returns {Promise&lt;void>}
     */
    async addOrRemoveLabels(labelIds, chatIds) {

        return this.pupPage.evaluate(async (labelIds, chatIds) &#x3D;> {
            if ([&#x27;smba&#x27;, &#x27;smbi&#x27;].indexOf(window.Store.Conn.platform) &#x3D;&#x3D;&#x3D; -1) {
                throw &#x27;[LT01] Only Whatsapp business&#x27;;
            }
            const labels &#x3D; window.WWebJS.getLabels().filter(e &#x3D;> labelIds.find(l &#x3D;> l &#x3D;&#x3D; e.id) !&#x3D;&#x3D; undefined);
            const chats &#x3D; window.Store.Chat.filter(e &#x3D;> chatIds.includes(e.id._serialized));

            let actions &#x3D; labels.map(label &#x3D;> ({id: label.id, type: &#x27;add&#x27;}));

            chats.forEach(chat &#x3D;> {
                (chat.labels || []).forEach(n &#x3D;> {
                    if (!actions.find(e &#x3D;> e.id &#x3D;&#x3D; n)) {
                        actions.push({id: n, type: &#x27;remove&#x27;});
                    }
                });
            });

            return await window.Store.Label.addOrRemoveLabels(actions, chats);
        }, labelIds, chatIds);
    }

    /**
     * An object that handles the information about the group membership request
     * @typedef {Object} GroupMembershipRequest
     * @property {Object} id The wid of a user who requests to enter the group
     * @property {Object} addedBy The wid of a user who created that request
     * @property {Object|null} parentGroupId The wid of a community parent group to which the current group is linked
     * @property {string} requestMethod The method used to create the request: NonAdminAdd/InviteLink/LinkedGroupJoin
     * @property {number} t The timestamp the request was created at
     */

    /**
     * Gets an array of membership requests
     * @param {string} groupId The ID of a group to get membership requests for
     * @returns {Promise&lt;Array&lt;GroupMembershipRequest>>} An array of membership requests
     */
    async getGroupMembershipRequests(groupId) {
        return await this.pupPage.evaluate(async (groupId) &#x3D;> {
            const groupWid &#x3D; window.Store.WidFactory.createWid(groupId);
            return await window.Store.MembershipRequestUtils.getMembershipApprovalRequests(groupWid);
        }, groupId);
    }

    /**
     * An object that handles the result for membership request action
     * @typedef {Object} MembershipRequestActionResult
     * @property {string} requesterId User ID whos membership request was approved/rejected
     * @property {number|undefined} error An error code that occurred during the operation for the participant
     * @property {string} message A message with a result of membership request action
     */

    /**
     * An object that handles options for {@link approveGroupMembershipRequests} and {@link rejectGroupMembershipRequests} methods
     * @typedef {Object} MembershipRequestActionOptions
     * @property {Array&lt;string>|string|null} requesterIds User ID/s who requested to join the group, if no value is provided, the method will search for all membership requests for that group
     * @property {Array&lt;number>|number|null} sleep The number of milliseconds to wait before performing an operation for the next requester. If it is an array, a random sleep time between the sleep[0] and sleep[1] values will be added (the difference must be >&#x3D;100 ms, otherwise, a random sleep time between sleep[1] and sleep[1] + 100 will be added). If sleep is a number, a sleep time equal to its value will be added. By default, sleep is an array with a value of [250, 500]
     */

    /**
     * Approves membership requests if any
     * @param {string} groupId The group ID to get the membership request for
     * @param {MembershipRequestActionOptions} options Options for performing a membership request action
     * @returns {Promise&lt;Array&lt;MembershipRequestActionResult>>} Returns an array of requester IDs whose membership requests were approved and an error for each requester, if any occurred during the operation. If there are no requests, an empty array will be returned
     */
    async approveGroupMembershipRequests(groupId, options &#x3D; {}) {
        return await this.pupPage.evaluate(async (groupId, options) &#x3D;> {
            const { requesterIds &#x3D; null, sleep &#x3D; [250, 500] } &#x3D; options;
            return await window.WWebJS.membershipRequestAction(groupId, &#x27;Approve&#x27;, requesterIds, sleep);
        }, groupId, options);
    }

    /**
     * Rejects membership requests if any
     * @param {string} groupId The group ID to get the membership request for
     * @param {MembershipRequestActionOptions} options Options for performing a membership request action
     * @returns {Promise&lt;Array&lt;MembershipRequestActionResult>>} Returns an array of requester IDs whose membership requests were rejected and an error for each requester, if any occurred during the operation. If there are no requests, an empty array will be returned
     */
    async rejectGroupMembershipRequests(groupId, options &#x3D; {}) {
        return await this.pupPage.evaluate(async (groupId, options) &#x3D;> {
            const { requesterIds &#x3D; null, sleep &#x3D; [250, 500] } &#x3D; options;
            return await window.WWebJS.membershipRequestAction(groupId, &#x27;Reject&#x27;, requesterIds, sleep);
        }, groupId, options);
    }

    /**
     * Setting  autoload download audio
     * @param {boolean} flag true/false
     */
    async setAutoDownloadAudio(flag) {
        await this.pupPage.evaluate(async flag &#x3D;> {
            const autoDownload &#x3D; window.Store.Settings.getAutoDownloadAudio();
            if (autoDownload &#x3D;&#x3D;&#x3D; flag) {
                return flag;
            }
            await window.Store.Settings.setAutoDownloadAudio(flag);
            return flag;
        }, flag);
    }

    /**
     * Setting  autoload download documents
     * @param {boolean} flag true/false
     */
    async setAutoDownloadDocuments(flag) {
        await this.pupPage.evaluate(async flag &#x3D;> {
            const autoDownload &#x3D; window.Store.Settings.getAutoDownloadDocuments();
            if (autoDownload &#x3D;&#x3D;&#x3D; flag) {
                return flag;
            }
            await window.Store.Settings.setAutoDownloadDocuments(flag);
            return flag;
        }, flag);
    }

    /**
     * Setting  autoload download photos
     * @param {boolean} flag true/false
     */
    async setAutoDownloadPhotos(flag) {
        await this.pupPage.evaluate(async flag &#x3D;> {
            const autoDownload &#x3D; window.Store.Settings.getAutoDownloadPhotos();
            if (autoDownload &#x3D;&#x3D;&#x3D; flag) {
                return flag;
            }
            await window.Store.Settings.setAutoDownloadPhotos(flag);
            return flag;
        }, flag);
    }

    /**
     * Setting  autoload download videos
     * @param {boolean} flag true/false
     */
    async setAutoDownloadVideos(flag) {
        await this.pupPage.evaluate(async flag &#x3D;> {
            const autoDownload &#x3D; window.Store.Settings.getAutoDownloadVideos();
            if (autoDownload &#x3D;&#x3D;&#x3D; flag) {
                return flag;
            }
            await window.Store.Settings.setAutoDownloadVideos(flag);
            return flag;
        }, flag);
    }

    /**
     * Setting background synchronization.
     * NOTE: this action will take effect after you restart the client.
     * @param {boolean} flag true/false
     * @returns {Promise&lt;boolean>}
     */
    async setBackgroundSync(flag) {
        return await this.pupPage.evaluate(async flag &#x3D;> {
            const backSync &#x3D; window.Store.Settings.getGlobalOfflineNotifications();
            if (backSync &#x3D;&#x3D;&#x3D; flag) {
                return flag;
            }
            await window.Store.Settings.setGlobalOfflineNotifications(flag);
            return flag;
        }, flag);
    }
    
    /**
     * Get user device count by ID
     * Each WaWeb Connection counts as one device, and the phone (if exists) counts as one
     * So for a non-enterprise user with one WaWeb connection it should return &quot;2&quot;
     * @param {string} userId
     * @returns {Promise&lt;number>}
     */
    async getContactDeviceCount(userId) {
        return await this.pupPage.evaluate(async (userId) &#x3D;> {
            const devices &#x3D; await window.Store.DeviceList.getDeviceIds([window.Store.WidFactory.createWid(userId)]);
            if (devices &amp;&amp; devices.length &amp;&amp; devices[0] !&#x3D; null &amp;&amp; typeof devices[0].devices &#x3D;&#x3D; &#x27;object&#x27;) {
                return devices[0].devices.length;
            }
            return 0;
        }, userId);
    }

    /**
     * Sync chat history conversation
     * @param {string} chatId
     * @return {Promise&lt;boolean>} True if operation completed successfully, false otherwise.
     */
    async syncHistory(chatId) {
        return await this.pupPage.evaluate(async (chatId) &#x3D;> {
            const chatWid &#x3D; window.Store.WidFactory.createWid(chatId);
            const chat &#x3D; window.Store.Chat.get(chatWid) ?? (await window.Store.Chat.find(chatWid));
            if (chat?.endOfHistoryTransferType &#x3D;&#x3D;&#x3D; 0) {
                await window.Store.HistorySync.sendPeerDataOperationRequest(3, {
                    chatId: chat.id
                });
                return true;
            }
            return false;
        }, chatId);
    }
  
    /**
     * Generates a WhatsApp call link (video call or voice call)
     * @param {Date} startTime The start time of the call
     * @param {string} callType The type of a WhatsApp call link to generate, valid values are: &#x60;video&#x60; | &#x60;voice&#x60;
     * @returns {Promise&lt;string>} The WhatsApp call link (https://call.whatsapp.com/video/XxXxXxXxXxXxXx) or an empty string if a generation failed.
     */
    async createCallLink(startTime, callType) {
        if (![&#x27;video&#x27;, &#x27;voice&#x27;].includes(callType)) {
            throw new class CreateCallLinkError extends Error {
                constructor(m) { super(m); }
            }(&#x27;Invalid \&#x27;callType\&#x27; parameter value is provided. Valid values are: \&#x27;voice\&#x27; | \&#x27;video\&#x27;.&#x27;);
        }

        startTime &#x3D; Math.floor(startTime.getTime() / 1000);
        
        return await this.pupPage.evaluate(async (startTimeTs, callType) &#x3D;> {
            const response &#x3D; await window.Store.ScheduledEventMsgUtils.createEventCallLink(startTimeTs, callType);
            return response ?? &#x27;&#x27;;
        }, startTime, callType);
    }

    /**
     * Sends a response to the scheduled event message, indicating whether a user is going to attend the event or not
     * @param {number} response The response code to the scheduled event message. Valid values are: &#x60;0&#x60; for NONE response (removes a previous response) | &#x60;1&#x60; for GOING | &#x60;2&#x60; for NOT GOING | &#x60;3&#x60; for MAYBE going
     * @param {string} eventMessageId The scheduled event message ID
     * @returns {Promise&lt;boolean>}
     */
    async sendResponseToScheduledEvent(response, eventMessageId) {
        if (![0, 1, 2, 3].includes(response)) return false;

        return await this.pupPage.evaluate(async (response, msgId) &#x3D;> {
            const eventMsg &#x3D; window.Store.Msg.get(msgId) || (await window.Store.Msg.getMessagesById([msgId]))?.messages?.[0];
            if (!eventMsg) return false;

            await window.Store.ScheduledEventMsgUtils.sendEventResponseMsg(response, eventMsg);
            return true;
        }, response, eventMessageId);
    }
  
    /**
     * Save new contact to user&#x27;s addressbook or edit the existing one
     * @param {string} phoneNumber The contact&#x27;s phone number in a format &quot;17182222222&quot;, where &quot;1&quot; is a country code
     * @param {string} firstName 
     * @param {string} lastName 
     * @param {boolean} [syncToAddressbook &#x3D; false] If set to true, the contact will also be saved to the user&#x27;s address book on their phone. False by default
     * @returns {Promise&lt;import(&#x27;..&#x27;).ChatId>} Object in a wid format
     */
    async saveOrEditAddressbookContact(phoneNumber, firstName, lastName, syncToAddressbook &#x3D; false)
    {
        return await this.pupPage.evaluate(async (phoneNumber, firstName, lastName, syncToAddressbook) &#x3D;> {
            return await window.Store.AddressbookContactUtils.saveContactAction(
                phoneNumber,
                null,
                firstName,
                lastName,
                syncToAddressbook
            );
        }, phoneNumber, firstName, lastName, syncToAddressbook);
    }

    /**
     * Deletes the contact from user&#x27;s addressbook
     * @param {string} phoneNumber The contact&#x27;s phone number in a format &quot;17182222222&quot;, where &quot;1&quot; is a country code
     * @returns {Promise&lt;void>}
     */
    async deleteAddressbookContact(phoneNumber)
    {
        return await this.pupPage.evaluate(async (phoneNumber) &#x3D;> {
            return await window.Store.AddressbookContactUtils.deleteContactAction(phoneNumber);
        }, phoneNumber);
    }

    /**
     * Get lid and phone number for multiple users
     * @param {string[]} userIds - Array of user IDs
     * @returns {Promise&lt;Array&lt;{ lid: string, pn: string }>>}
     */
    async getContactLidAndPhone(userIds) {
        return await this.pupPage.evaluate(async (userIds) &#x3D;> {
            if (!Array.isArray(userIds)) userIds &#x3D; [userIds];

            return await Promise.all(userIds.map(async (userId) &#x3D;> {
                const { lid, phone } &#x3D; await window.WWebJS.enforceLidAndPnRetrieval(userId);

                return {
                    lid: lid?._serialized,
                    pn: phone?._serialized
                };
            }));
        }, userIds);
    }

    /**
     * Add or edit a customer note
     * @see https://faq.whatsapp.com/1433099287594476
     * @param {string} userId The ID of a customer to add a note to
     * @param {string} note The note to add
     * @returns {Promise&lt;void>}
     */
    async addOrEditCustomerNote(userId, note) {
        return await this.pupPage.evaluate(async (userId, note) &#x3D;> {
            if (!window.Store.BusinessGatingUtils.smbNotesV1Enabled()) return;

            return window.Store.CustomerNoteUtils.noteAddAction(
                &#x27;unstructured&#x27;,
                window.Store.WidToJid.widToUserJid(window.Store.WidFactory.createWid(userId)),
                note
            );
        }, userId, note);
    }

    /**
     * Get a customer note
     * @see https://faq.whatsapp.com/1433099287594476
     * @param {string} userId The ID of a customer to get a note from
     * @returns {Promise&lt;{
     *    chatId: string,
     *    content: string,
     *    createdAt: number,
     *    id: string,
     *    modifiedAt: number,
     *    type: string
     * }>}
     */
    async getCustomerNote(userId) {
        return await this.pupPage.evaluate(async (userId) &#x3D;> {
            if (!window.Store.BusinessGatingUtils.smbNotesV1Enabled()) return null;

            const note &#x3D; await window.Store.CustomerNoteUtils.retrieveOnlyNoteForChatJid(
                window.Store.WidToJid.widToUserJid(window.Store.WidFactory.createWid(userId))
            );

            let serialized &#x3D; note?.serialize();

            if (!serialized) return null;

            serialized.chatId &#x3D; window.Store.JidToWid.userJidToUserWid(serialized.chatJid)._serialized;
            delete serialized.chatJid;

            return serialized;
        }, userId);
    }
    
    /**
     * Get Poll Votes
     * @param {string} messageId
     * @return {Promise&lt;Array&lt;PollVote>>} 
     */
    async getPollVotes(messageId) {
        const msg &#x3D; await this.getMessageById(messageId);
        if (!msg) return [];
        if (msg.type !&#x3D; &#x27;poll_creation&#x27;) throw &#x27;Invalid usage! Can only be used with a pollCreation message&#x27;;

        const pollVotes &#x3D; await this.pupPage.evaluate( async (msg) &#x3D;> {
            const msgKey &#x3D; window.Store.MsgKey.fromString(msg.id._serialized);
            let pollVotes &#x3D; await window.Store.PollsVotesSchema.getTable().equals([&#x27;parentMsgKey&#x27;], msgKey.toString());
            
            return pollVotes.map(item &#x3D;> {
                const typedArray &#x3D; new Uint8Array(item.selectedOptionLocalIds);
                return {
                    ...item,
                    selectedOptionLocalIds: Array.from(typedArray)
                };
            });
        }, msg);

        return pollVotes.map((pollVote) &#x3D;> new PollVote(this.client, {...pollVote, parentMessage: msg}));
    }
}

module.exports &#x3D; Client;

```

        Generated by [JSDoc](https://github.com/jsdoc3/jsdoc) 3.6.11 on October 23, 2025.