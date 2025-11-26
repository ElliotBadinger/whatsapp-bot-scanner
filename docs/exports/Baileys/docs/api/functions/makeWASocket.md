# Source: https://baileys.wiki/docs/api/functions/makeWASocket

<!-- Scraped from https://baileys.wiki/docs/api/functions/makeWASocket -->

[Skip to main content](https://baileys.wiki/docs/api/functions/makeWASocket/#__docusaurus_skipToContent_fallback)
[ ![WhiskeySo ckets Logo](https://baileys.wiki/img/WhiskeySockets-colorful.png)![WhiskeySo ckets Logo](https://baileys.wiki/img/WhiskeySockets-colorful.png) **Baileys**](https://baileys.wiki/)[Docs](https://baileys.wiki/docs/intro)[API Reference](https://baileys.wiki/docs/api/classes/BinaryInfo)
[Sponsor](https://purpshell.dev/sponsor "Sponsor")[Discord](https://whiskey.so/discord "Discord")[GitHub](https://github.com/WhiskeySockets/Baileys "GitHub")
  * [classes](https://baileys.wiki/docs/api/classes/BinaryInfo)
  * [enumerations](https://baileys.wiki/docs/api/enumerations/DisconnectReason)
  * [functions](https://baileys.wiki/docs/api/functions/addTransactionCapability)
    * [Function: addTransactionCapability()](https://baileys.wiki/docs/api/functions/addTransactionCapability)
    * [Function: aesDecrypt()](https://baileys.wiki/docs/api/functions/aesDecrypt)
    * [Function: aesDecryptCTR()](https://baileys.wiki/docs/api/functions/aesDecryptCTR)
    * [Function: aesDecryptGCM()](https://baileys.wiki/docs/api/functions/aesDecryptGCM)
    * [Function: aesDecryptWithIV()](https://baileys.wiki/docs/api/functions/aesDecryptWithIV)
    * [Function: aesEncrypWithIV()](https://baileys.wiki/docs/api/functions/aesEncrypWithIV)
    * [Function: aesEncrypt()](https://baileys.wiki/docs/api/functions/aesEncrypt)
    * [Function: aesEncryptCTR()](https://baileys.wiki/docs/api/functions/aesEncryptCTR)
    * [Function: aesEncryptGCM()](https://baileys.wiki/docs/api/functions/aesEncryptGCM)
    * [Function: aggregateMessageKeysNotFromMe()](https://baileys.wiki/docs/api/functions/aggregateMessageKeysNotFromMe)
    * [Function: areJidsSameUser()](https://baileys.wiki/docs/api/functions/areJidsSameUser)
    * [Function: assertMediaContent()](https://baileys.wiki/docs/api/functions/assertMediaContent)
    * [Function: assertNodeErrorFree()](https://baileys.wiki/docs/api/functions/assertNodeErrorFree)
    * [Function: binaryNodeToString()](https://baileys.wiki/docs/api/functions/binaryNodeToString)
    * [Function: bindWaitForConnectionUpdate()](https://baileys.wiki/docs/api/functions/bindWaitForConnectionUpdate)
    * [Function: bindWaitForEvent()](https://baileys.wiki/docs/api/functions/bindWaitForEvent)
    * [Function: bytesToCrockford()](https://baileys.wiki/docs/api/functions/bytesToCrockford)
    * [Function: chatModificationToAppPatch()](https://baileys.wiki/docs/api/functions/chatModificationToAppPatch)
    * [Function: cleanMessage()](https://baileys.wiki/docs/api/functions/cleanMessage)
    * [Function: configureSuccessfulPairing()](https://baileys.wiki/docs/api/functions/configureSuccessfulPairing)
    * [Function: createSignalIdentity()](https://baileys.wiki/docs/api/functions/createSignalIdentity)
    * [Function: debouncedTimeout()](https://baileys.wiki/docs/api/functions/debouncedTimeout)
    * [Function: decodeBinaryNode()](https://baileys.wiki/docs/api/functions/decodeBinaryNode)
    * [Function: decodeDecompressedBinaryNode()](https://baileys.wiki/docs/api/functions/decodeDecompressedBinaryNode)
    * [Function: decodeMediaRetryNode()](https://baileys.wiki/docs/api/functions/decodeMediaRetryNode)
    * [Function: decodeMessageNode()](https://baileys.wiki/docs/api/functions/decodeMessageNode)
    * [Function: decodePatches()](https://baileys.wiki/docs/api/functions/decodePatches)
    * [Function: decodeSyncdMutations()](https://baileys.wiki/docs/api/functions/decodeSyncdMutations)
    * [Function: decodeSyncdPatch()](https://baileys.wiki/docs/api/functions/decodeSyncdPatch)
    * [Function: decodeSyncdSnapshot()](https://baileys.wiki/docs/api/functions/decodeSyncdSnapshot)
    * [Function: decompressingIfRequired()](https://baileys.wiki/docs/api/functions/decompressingIfRequired)
    * [Function: decryptEventResponse()](https://baileys.wiki/docs/api/functions/decryptEventResponse)
    * [Function: decryptMediaRetryData()](https://baileys.wiki/docs/api/functions/decryptMediaRetryData)
    * [Function: decryptMessageNode()](https://baileys.wiki/docs/api/functions/decryptMessageNode)
    * [Function: decryptPollVote()](https://baileys.wiki/docs/api/functions/decryptPollVote)
    * [Function: delay()](https://baileys.wiki/docs/api/functions/delay)
    * [Function: delayCancellable()](https://baileys.wiki/docs/api/functions/delayCancellable)
    * [Function: derivePairingCodeKey()](https://baileys.wiki/docs/api/functions/derivePairingCodeKey)
    * [Function: downloadAndProcessHistorySyncNotification()](https://baileys.wiki/docs/api/functions/downloadAndProcessHistorySyncNotification)
    * [Function: downloadContentFromMessage()](https://baileys.wiki/docs/api/functions/downloadContentFromMessage)
    * [Function: downloadEncryptedContent()](https://baileys.wiki/docs/api/functions/downloadEncryptedContent)
    * [Function: downloadExternalBlob()](https://baileys.wiki/docs/api/functions/downloadExternalBlob)
    * [Function: downloadExternalPatch()](https://baileys.wiki/docs/api/functions/downloadExternalPatch)
    * [Function: downloadHistory()](https://baileys.wiki/docs/api/functions/downloadHistory)
    * [Function: downloadMediaMessage()](https://baileys.wiki/docs/api/functions/downloadMediaMessage)
    * [Function: encodeBase64EncodedStringForUpload()](https://baileys.wiki/docs/api/functions/encodeBase64EncodedStringForUpload)
    * [Function: encodeBigEndian()](https://baileys.wiki/docs/api/functions/encodeBigEndian)
    * [Function: encodeBinaryNode()](https://baileys.wiki/docs/api/functions/encodeBinaryNode)
    * [Function: encodeNewsletterMessage()](https://baileys.wiki/docs/api/functions/encodeNewsletterMessage)
    * [Function: encodeSignedDeviceIdentity()](https://baileys.wiki/docs/api/functions/encodeSignedDeviceIdentity)
    * [Function: encodeSyncdPatch()](https://baileys.wiki/docs/api/functions/encodeSyncdPatch)
    * [Function: encodeWAM()](https://baileys.wiki/docs/api/functions/encodeWAM)
    * [Function: encodeWAMessage()](https://baileys.wiki/docs/api/functions/encodeWAMessage)
    * [Function: encryptMediaRetryRequest()](https://baileys.wiki/docs/api/functions/encryptMediaRetryRequest)
    * [Function: encryptedStream()](https://baileys.wiki/docs/api/functions/encryptedStream)
    * [Function: extensionForMediaMessage()](https://baileys.wiki/docs/api/functions/extensionForMediaMessage)
    * [Function: extractAddressingContext()](https://baileys.wiki/docs/api/functions/extractAddressingContext)
    * [Function: extractDeviceJids()](https://baileys.wiki/docs/api/functions/extractDeviceJids)
    * [Function: extractImageThumb()](https://baileys.wiki/docs/api/functions/extractImageThumb)
    * [Function: extractMessageContent()](https://baileys.wiki/docs/api/functions/extractMessageContent)
    * [Function: extractSyncdPatches()](https://baileys.wiki/docs/api/functions/extractSyncdPatches)
    * [Function: extractUrlFromText()](https://baileys.wiki/docs/api/functions/extractUrlFromText)
    * [Function: fetchLatestBaileysVersion()](https://baileys.wiki/docs/api/functions/fetchLatestBaileysVersion)
    * [Function: fetchLatestWaWebVersion()](https://baileys.wiki/docs/api/functions/fetchLatestWaWebVersion)
    * [Function: generateForwardMessageContent()](https://baileys.wiki/docs/api/functions/generateForwardMessageContent)
    * [Function: generateLinkPreviewIfRequired()](https://baileys.wiki/docs/api/functions/generateLinkPreviewIfRequired)
    * [Function: generateLoginNode()](https://baileys.wiki/docs/api/functions/generateLoginNode)
    * [Function: generateMdTagPrefix()](https://baileys.wiki/docs/api/functions/generateMdTagPrefix)
    * [Function: generateMessageID()](https://baileys.wiki/docs/api/functions/generateMessageID)
    * [Function: generateMessageIDV2()](https://baileys.wiki/docs/api/functions/generateMessageIDV2)
    * [Function: generateOrGetPreKeys()](https://baileys.wiki/docs/api/functions/generateOrGetPreKeys)
    * [Function: generateParticipantHashV2()](https://baileys.wiki/docs/api/functions/generateParticipantHashV2)
    * [Function: generateProfilePicture()](https://baileys.wiki/docs/api/functions/generateProfilePicture)
    * [Function: generateRegistrationId()](https://baileys.wiki/docs/api/functions/generateRegistrationId)
    * [Function: generateRegistrationNode()](https://baileys.wiki/docs/api/functions/generateRegistrationNode)
    * [Function: generateSignalPubKey()](https://baileys.wiki/docs/api/functions/generateSignalPubKey)
    * [Function: generateThumbnail()](https://baileys.wiki/docs/api/functions/generateThumbnail)
    * [Function: generateWAMessage()](https://baileys.wiki/docs/api/functions/generateWAMessage)
    * [Function: generateWAMessageContent()](https://baileys.wiki/docs/api/functions/generateWAMessageContent)
    * [Function: generateWAMessageFromContent()](https://baileys.wiki/docs/api/functions/generateWAMessageFromContent)
    * [Function: getAggregateResponsesInEventMessage()](https://baileys.wiki/docs/api/functions/getAggregateResponsesInEventMessage)
    * [Function: getAggregateVotesInPollMessage()](https://baileys.wiki/docs/api/functions/getAggregateVotesInPollMessage)
    * [Function: getAllBinaryNodeChildren()](https://baileys.wiki/docs/api/functions/getAllBinaryNodeChildren)
    * [Function: getAudioDuration()](https://baileys.wiki/docs/api/functions/getAudioDuration)
    * [Function: getAudioWaveform()](https://baileys.wiki/docs/api/functions/getAudioWaveform)
    * [Function: getBinaryNodeChild()](https://baileys.wiki/docs/api/functions/getBinaryNodeChild)
    * [Function: getBinaryNodeChildBuffer()](https://baileys.wiki/docs/api/functions/getBinaryNodeChildBuffer)
    * [Function: getBinaryNodeChildString()](https://baileys.wiki/docs/api/functions/getBinaryNodeChildString)
    * [Function: getBinaryNodeChildUInt()](https://baileys.wiki/docs/api/functions/getBinaryNodeChildUInt)
    * [Function: getBinaryNodeChildren()](https://baileys.wiki/docs/api/functions/getBinaryNodeChildren)
    * [Function: getBinaryNodeMessages()](https://baileys.wiki/docs/api/functions/getBinaryNodeMessages)
    * [Function: getCallStatusFromNode()](https://baileys.wiki/docs/api/functions/getCallStatusFromNode)
    * [Function: getChatId()](https://baileys.wiki/docs/api/functions/getChatId)
    * [Function: getCodeFromWSError()](https://baileys.wiki/docs/api/functions/getCodeFromWSError)
    * [Function: getContentType()](https://baileys.wiki/docs/api/functions/getContentType)
    * [Function: getDecryptionJid()](https://baileys.wiki/docs/api/functions/getDecryptionJid)
    * [Function: getDevice()](https://baileys.wiki/docs/api/functions/getDevice)
    * [Function: getErrorCodeFromStreamError()](https://baileys.wiki/docs/api/functions/getErrorCodeFromStreamError)
    * [Function: getHistoryMsg()](https://baileys.wiki/docs/api/functions/getHistoryMsg)
    * [Function: getHttpStream()](https://baileys.wiki/docs/api/functions/getHttpStream)
    * [Function: getKeyAuthor()](https://baileys.wiki/docs/api/functions/getKeyAuthor)
    * [Function: getMediaKeys()](https://baileys.wiki/docs/api/functions/getMediaKeys)
    * [Function: getNextPreKeys()](https://baileys.wiki/docs/api/functions/getNextPreKeys)
    * [Function: getNextPreKeysNode()](https://baileys.wiki/docs/api/functions/getNextPreKeysNode)
    * [Function: getPlatformId()](https://baileys.wiki/docs/api/functions/getPlatformId)
    * [Function: getPreKeys()](https://baileys.wiki/docs/api/functions/getPreKeys)
    * [Function: getRawMediaUploadData()](https://baileys.wiki/docs/api/functions/getRawMediaUploadData)
    * [Function: getServerFromDomainType()](https://baileys.wiki/docs/api/functions/getServerFromDomainType)
    * [Function: getStatusCodeForMediaRetry()](https://baileys.wiki/docs/api/functions/getStatusCodeForMediaRetry)
    * [Function: getStatusFromReceiptType()](https://baileys.wiki/docs/api/functions/getStatusFromReceiptType)
    * [Function: getStream()](https://baileys.wiki/docs/api/functions/getStream)
    * [Function: getUrlFromDirectPath()](https://baileys.wiki/docs/api/functions/getUrlFromDirectPath)
    * [Function: getUrlInfo()](https://baileys.wiki/docs/api/functions/getUrlInfo)
    * [Function: getWAUploadToServer()](https://baileys.wiki/docs/api/functions/getWAUploadToServer)
    * [Function: hkdf()](https://baileys.wiki/docs/api/functions/hkdf)
    * [Function: hkdfInfoKey()](https://baileys.wiki/docs/api/functions/hkdfInfoKey)
    * [Function: hmacSign()](https://baileys.wiki/docs/api/functions/hmacSign)
    * [Function: initAuthCreds()](https://baileys.wiki/docs/api/functions/initAuthCreds)
    * [Function: isHostedLidUser()](https://baileys.wiki/docs/api/functions/isHostedLidUser)
    * [Function: isHostedPnUser()](https://baileys.wiki/docs/api/functions/isHostedPnUser)
    * [Function: isJidBot()](https://baileys.wiki/docs/api/functions/isJidBot)
    * [Function: isJidBroadcast()](https://baileys.wiki/docs/api/functions/isJidBroadcast)
    * [Function: isJidGroup()](https://baileys.wiki/docs/api/functions/isJidGroup)
    * [Function: isJidMetaAI()](https://baileys.wiki/docs/api/functions/isJidMetaAI)
    * [Function: isJidNewsletter()](https://baileys.wiki/docs/api/functions/isJidNewsletter)
    * [Function: isJidStatusBroadcast()](https://baileys.wiki/docs/api/functions/isJidStatusBroadcast)
    * [Function: isLidUser()](https://baileys.wiki/docs/api/functions/isLidUser)
    * [Function: isPnUser()](https://baileys.wiki/docs/api/functions/isPnUser)
    * [Function: isRealMessage()](https://baileys.wiki/docs/api/functions/isRealMessage)
    * [Function: isWABusinessPlatform()](https://baileys.wiki/docs/api/functions/isWABusinessPlatform)
    * [Function: jidDecode()](https://baileys.wiki/docs/api/functions/jidDecode)
    * [Function: jidEncode()](https://baileys.wiki/docs/api/functions/jidEncode)
    * [Function: jidNormalizedUser()](https://baileys.wiki/docs/api/functions/jidNormalizedUser)
    * [Function: makeCacheableSignalKeyStore()](https://baileys.wiki/docs/api/functions/makeCacheableSignalKeyStore)
    * [Function: makeEventBuffer()](https://baileys.wiki/docs/api/functions/makeEventBuffer)
    * [Function: makeNoiseHandler()](https://baileys.wiki/docs/api/functions/makeNoiseHandler)
    * [Function: makeWASocket()](https://baileys.wiki/docs/api/functions/makeWASocket)
    * [Function: md5()](https://baileys.wiki/docs/api/functions/md5)
    * [Function: mediaMessageSHA256B64()](https://baileys.wiki/docs/api/functions/mediaMessageSHA256B64)
    * [Function: newLTHashState()](https://baileys.wiki/docs/api/functions/newLTHashState)
    * [Function: normalizeMessageContent()](https://baileys.wiki/docs/api/functions/normalizeMessageContent)
    * [Function: parseAndInjectE2ESessions()](https://baileys.wiki/docs/api/functions/parseAndInjectE2ESessions)
    * [Function: prepareDisappearingMessageSettingContent()](https://baileys.wiki/docs/api/functions/prepareDisappearingMessageSettingContent)
    * [Function: prepareWAMessageMedia()](https://baileys.wiki/docs/api/functions/prepareWAMessageMedia)
    * [Function: processHistoryMessage()](https://baileys.wiki/docs/api/functions/processHistoryMessage)
    * [Function: processSyncAction()](https://baileys.wiki/docs/api/functions/processSyncAction)
    * [Function: promiseTimeout()](https://baileys.wiki/docs/api/functions/promiseTimeout)
    * [Function: reduceBinaryNodeToDictionary()](https://baileys.wiki/docs/api/functions/reduceBinaryNodeToDictionary)
    * [Function: sha256()](https://baileys.wiki/docs/api/functions/sha256)
    * [Function: shouldIncrementChatUnread()](https://baileys.wiki/docs/api/functions/shouldIncrementChatUnread)
    * [Function: signedKeyPair()](https://baileys.wiki/docs/api/functions/signedKeyPair)
    * [Function: toBuffer()](https://baileys.wiki/docs/api/functions/toBuffer)
    * [Function: toNumber()](https://baileys.wiki/docs/api/functions/toNumber)
    * [Function: toReadable()](https://baileys.wiki/docs/api/functions/toReadable)
    * [Function: transferDevice()](https://baileys.wiki/docs/api/functions/transferDevice)
    * [Function: trimUndefined()](https://baileys.wiki/docs/api/functions/trimUndefined)
    * [Function: unixTimestampSeconds()](https://baileys.wiki/docs/api/functions/unixTimestampSeconds)
    * [Function: unpadRandomMax16()](https://baileys.wiki/docs/api/functions/unpadRandomMax16)
    * [Function: updateMessageWithEventResponse()](https://baileys.wiki/docs/api/functions/updateMessageWithEventResponse)
    * [Function: updateMessageWithPollUpdate()](https://baileys.wiki/docs/api/functions/updateMessageWithPollUpdate)
    * [Function: updateMessageWithReaction()](https://baileys.wiki/docs/api/functions/updateMessageWithReaction)
    * [Function: updateMessageWithReceipt()](https://baileys.wiki/docs/api/functions/updateMessageWithReceipt)
    * [Function: useMultiFileAuthState()](https://baileys.wiki/docs/api/functions/useMultiFileAuthState)
    * [Function: writeRandomPadMax16()](https://baileys.wiki/docs/api/functions/writeRandomPadMax16)
    * [Function: xmppPreKey()](https://baileys.wiki/docs/api/functions/xmppPreKey)
    * [Function: xmppSignedPreKey()](https://baileys.wiki/docs/api/functions/xmppSignedPreKey)
  * [baileys](https://baileys.wiki/docs/api/)
  * [interfaces](https://baileys.wiki/docs/api/interfaces/BaileysEventEmitter)
  * [namespaces](https://baileys.wiki/docs/api/namespaces/proto/)
  * [type-aliases](https://baileys.wiki/docs/api/type-aliases/AccountSettings)
  * [variables](https://baileys.wiki/docs/api/variables/ALL_WA_PATCH_NAMES)


  * [](https://baileys.wiki/)
  * functions
  * Function: makeWASocket()


On this page
# Function: makeWASocket()
> **makeWASocket**(`config`): `object`
Defined in: [src/Socket/index.ts:6](https://github.com/WhiskeySockets/Baileys/blob/9720ff49caf0dbee182a7577a96e3639011824e6/src/Socket/index.ts#L6)
## Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters "Direct link to Parameters")
### config[​](https://baileys.wiki/docs/api/functions/makeWASocket/#config "Direct link to config")
[`UserFacingSocketConfig`](https://baileys.wiki/docs/api/type-aliases/UserFacingSocketConfig)
## Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns "Direct link to Returns")
`object`
### addChatLabel()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#addchatlabel "Direct link to addChatLabel\(\)")
> **addChatLabel** : (`jid`, `labelId`) => `Promise`<`void`>
Adds label for the chats
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-1 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid "Direct link to jid")
`string`
##### labelId[​](https://baileys.wiki/docs/api/functions/makeWASocket/#labelid "Direct link to labelId")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-1 "Direct link to Returns")
`Promise`<`void`>
### addLabel()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#addlabel "Direct link to addLabel\(\)")
> **addLabel** : (`jid`, `labels`) => `Promise`<`void`>
Adds label
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-2 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-1 "Direct link to jid")
`string`
##### labels[​](https://baileys.wiki/docs/api/functions/makeWASocket/#labels "Direct link to labels")
`LabelActionBody`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-2 "Direct link to Returns")
`Promise`<`void`>
### addMessageLabel()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#addmessagelabel "Direct link to addMessageLabel\(\)")
> **addMessageLabel** : (`jid`, `messageId`, `labelId`) => `Promise`<`void`>
Adds label for the message
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-3 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-2 "Direct link to jid")
`string`
##### messageId[​](https://baileys.wiki/docs/api/functions/makeWASocket/#messageid "Direct link to messageId")
`string`
##### labelId[​](https://baileys.wiki/docs/api/functions/makeWASocket/#labelid-1 "Direct link to labelId")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-3 "Direct link to Returns")
`Promise`<`void`>
### addOrEditContact()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#addoreditcontact "Direct link to addOrEditContact\(\)")
> **addOrEditContact** : (`jid`, `contact`) => `Promise`<`void`>
Add or Edit Contact
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-4 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-3 "Direct link to jid")
`string`
##### contact[​](https://baileys.wiki/docs/api/functions/makeWASocket/#contact "Direct link to contact")
[`IContactAction`](https://baileys.wiki/docs/api/namespaces/proto/namespaces/SyncActionValue/interfaces/IContactAction)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-4 "Direct link to Returns")
`Promise`<`void`>
### addOrEditQuickReply()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#addoreditquickreply "Direct link to addOrEditQuickReply\(\)")
> **addOrEditQuickReply** : (`quickReply`) => `Promise`<`void`>
Add or Edit Quick Reply
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-5 "Direct link to Parameters")
##### quickReply[​](https://baileys.wiki/docs/api/functions/makeWASocket/#quickreply "Direct link to quickReply")
`QuickReplyAction`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-5 "Direct link to Returns")
`Promise`<`void`>
### appPatch()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#apppatch "Direct link to appPatch\(\)")
> **appPatch** : (`patchCreate`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-6 "Direct link to Parameters")
##### patchCreate[​](https://baileys.wiki/docs/api/functions/makeWASocket/#patchcreate "Direct link to patchCreate")
[`WAPatchCreate`](https://baileys.wiki/docs/api/type-aliases/WAPatchCreate)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-6 "Direct link to Returns")
`Promise`<`void`>
### assertSessions()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#assertsessions "Direct link to assertSessions\(\)")
> **assertSessions** : (`jids`, `force`?) => `Promise`<`boolean`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-7 "Direct link to Parameters")
##### jids[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jids "Direct link to jids")
`string`[]
##### force?[​](https://baileys.wiki/docs/api/functions/makeWASocket/#force "Direct link to force?")
`boolean`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-7 "Direct link to Returns")
`Promise`<`boolean`>
### authState[​](https://baileys.wiki/docs/api/functions/makeWASocket/#authstate "Direct link to authState")
> **authState** : `object`
#### authState.creds[​](https://baileys.wiki/docs/api/functions/makeWASocket/#authstatecreds "Direct link to authState.creds")
> **creds** : [`AuthenticationCreds`](https://baileys.wiki/docs/api/type-aliases/AuthenticationCreds)
#### authState.keys[​](https://baileys.wiki/docs/api/functions/makeWASocket/#authstatekeys "Direct link to authState.keys")
> **keys** : [`SignalKeyStoreWithTransaction`](https://baileys.wiki/docs/api/type-aliases/SignalKeyStoreWithTransaction)
### chatModify()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#chatmodify "Direct link to chatModify\(\)")
> **chatModify** : (`mod`, `jid`) => `Promise`<`void`>
modify a chat -- mark unread, read etc. lastMessages must be sorted in reverse chronologically requires the last messages till the last message received; required for archive & unread
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-8 "Direct link to Parameters")
##### mod[​](https://baileys.wiki/docs/api/functions/makeWASocket/#mod "Direct link to mod")
[`ChatModification`](https://baileys.wiki/docs/api/type-aliases/ChatModification)
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-4 "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-8 "Direct link to Returns")
`Promise`<`void`>
### cleanDirtyBits()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#cleandirtybits "Direct link to cleanDirtyBits\(\)")
> **cleanDirtyBits** : (`type`, `fromTimestamp`?) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-9 "Direct link to Parameters")
##### type[​](https://baileys.wiki/docs/api/functions/makeWASocket/#type "Direct link to type")
`"account_sync"` | `"groups"`
##### fromTimestamp?[​](https://baileys.wiki/docs/api/functions/makeWASocket/#fromtimestamp "Direct link to fromTimestamp?")
`string` | `number`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-9 "Direct link to Returns")
`Promise`<`void`>
### communityAcceptInvite()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communityacceptinvite "Direct link to communityAcceptInvite\(\)")
> **communityAcceptInvite** : (`code`) => `Promise`<`undefined` | `string`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-10 "Direct link to Parameters")
##### code[​](https://baileys.wiki/docs/api/functions/makeWASocket/#code "Direct link to code")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-10 "Direct link to Returns")
`Promise`<`undefined` | `string`>
### communityAcceptInviteV4()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communityacceptinvitev4 "Direct link to communityAcceptInviteV4\(\)")
> **communityAcceptInviteV4** : (...`args`) => `Promise`<`any`>
accept a CommunityInviteMessage
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-11 "Direct link to Parameters")
##### args[​](https://baileys.wiki/docs/api/functions/makeWASocket/#args "Direct link to args")
...[`string` | [`WAMessageKey`](https://baileys.wiki/docs/api/type-aliases/WAMessageKey), [`IGroupInviteMessage`](https://baileys.wiki/docs/api/namespaces/proto/namespaces/Message/interfaces/IGroupInviteMessage)]
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-11 "Direct link to Returns")
`Promise`<`any`>
### communityCreate()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communitycreate "Direct link to communityCreate\(\)")
> **communityCreate** : (`subject`, `body`) => `Promise`<`null` | [`GroupMetadata`](https://baileys.wiki/docs/api/interfaces/GroupMetadata)>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-12 "Direct link to Parameters")
##### subject[​](https://baileys.wiki/docs/api/functions/makeWASocket/#subject "Direct link to subject")
`string`
##### body[​](https://baileys.wiki/docs/api/functions/makeWASocket/#body "Direct link to body")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-12 "Direct link to Returns")
`Promise`<`null` | [`GroupMetadata`](https://baileys.wiki/docs/api/interfaces/GroupMetadata)>
### communityCreateGroup()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communitycreategroup "Direct link to communityCreateGroup\(\)")
> **communityCreateGroup** : (`subject`, `participants`, `parentCommunityJid`) => `Promise`<`null` | [`GroupMetadata`](https://baileys.wiki/docs/api/interfaces/GroupMetadata)>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-13 "Direct link to Parameters")
##### subject[​](https://baileys.wiki/docs/api/functions/makeWASocket/#subject-1 "Direct link to subject")
`string`
##### participants[​](https://baileys.wiki/docs/api/functions/makeWASocket/#participants "Direct link to participants")
`string`[]
##### parentCommunityJid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parentcommunityjid "Direct link to parentCommunityJid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-13 "Direct link to Returns")
`Promise`<`null` | [`GroupMetadata`](https://baileys.wiki/docs/api/interfaces/GroupMetadata)>
### communityFetchAllParticipating()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communityfetchallparticipating "Direct link to communityFetchAllParticipating\(\)")
> **communityFetchAllParticipating** : () => `Promise`<{}>
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-14 "Direct link to Returns")
`Promise`<{}>
### communityFetchLinkedGroups()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communityfetchlinkedgroups "Direct link to communityFetchLinkedGroups\(\)")
> **communityFetchLinkedGroups** : (`jid`) => `Promise`<{ `communityJid`: `string`; `isCommunity`: `boolean`; `linkedGroups`: `object`[]; }>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-14 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-5 "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-15 "Direct link to Returns")
`Promise`<{ `communityJid`: `string`; `isCommunity`: `boolean`; `linkedGroups`: `object`[]; }>
### communityGetInviteInfo()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communitygetinviteinfo "Direct link to communityGetInviteInfo\(\)")
> **communityGetInviteInfo** : (`code`) => `Promise`<[`GroupMetadata`](https://baileys.wiki/docs/api/interfaces/GroupMetadata)>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-15 "Direct link to Parameters")
##### code[​](https://baileys.wiki/docs/api/functions/makeWASocket/#code-1 "Direct link to code")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-16 "Direct link to Returns")
`Promise`<[`GroupMetadata`](https://baileys.wiki/docs/api/interfaces/GroupMetadata)>
### communityInviteCode()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communityinvitecode "Direct link to communityInviteCode\(\)")
> **communityInviteCode** : (`jid`) => `Promise`<`undefined` | `string`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-16 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-6 "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-17 "Direct link to Returns")
`Promise`<`undefined` | `string`>
### communityJoinApprovalMode()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communityjoinapprovalmode "Direct link to communityJoinApprovalMode\(\)")
> **communityJoinApprovalMode** : (`jid`, `mode`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-17 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-7 "Direct link to jid")
`string`
##### mode[​](https://baileys.wiki/docs/api/functions/makeWASocket/#mode "Direct link to mode")
`"on"` | `"off"`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-18 "Direct link to Returns")
`Promise`<`void`>
### communityLeave()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communityleave "Direct link to communityLeave\(\)")
> **communityLeave** : (`id`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-18 "Direct link to Parameters")
##### id[​](https://baileys.wiki/docs/api/functions/makeWASocket/#id "Direct link to id")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-19 "Direct link to Returns")
`Promise`<`void`>
### communityLinkGroup()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communitylinkgroup "Direct link to communityLinkGroup\(\)")
> **communityLinkGroup** : (`groupJid`, `parentCommunityJid`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-19 "Direct link to Parameters")
##### groupJid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#groupjid "Direct link to groupJid")
`string`
##### parentCommunityJid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parentcommunityjid-1 "Direct link to parentCommunityJid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-20 "Direct link to Returns")
`Promise`<`void`>
### communityMemberAddMode()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communitymemberaddmode "Direct link to communityMemberAddMode\(\)")
> **communityMemberAddMode** : (`jid`, `mode`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-20 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-8 "Direct link to jid")
`string`
##### mode[​](https://baileys.wiki/docs/api/functions/makeWASocket/#mode-1 "Direct link to mode")
`"all_member_add"` | `"admin_add"`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-21 "Direct link to Returns")
`Promise`<`void`>
### communityMetadata()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communitymetadata "Direct link to communityMetadata\(\)")
> **communityMetadata** : (`jid`) => `Promise`<[`GroupMetadata`](https://baileys.wiki/docs/api/interfaces/GroupMetadata)>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-21 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-9 "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-22 "Direct link to Returns")
`Promise`<[`GroupMetadata`](https://baileys.wiki/docs/api/interfaces/GroupMetadata)>
### communityParticipantsUpdate()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communityparticipantsupdate "Direct link to communityParticipantsUpdate\(\)")
> **communityParticipantsUpdate** : (`jid`, `participants`, `action`) => `Promise`<`object`[]>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-22 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-10 "Direct link to jid")
`string`
##### participants[​](https://baileys.wiki/docs/api/functions/makeWASocket/#participants-1 "Direct link to participants")
`string`[]
##### action[​](https://baileys.wiki/docs/api/functions/makeWASocket/#action "Direct link to action")
[`ParticipantAction`](https://baileys.wiki/docs/api/type-aliases/ParticipantAction)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-23 "Direct link to Returns")
`Promise`<`object`[]>
### communityRequestParticipantsList()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communityrequestparticipantslist "Direct link to communityRequestParticipantsList\(\)")
> **communityRequestParticipantsList** : (`jid`) => `Promise`<`object`[]>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-23 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-11 "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-24 "Direct link to Returns")
`Promise`<`object`[]>
### communityRequestParticipantsUpdate()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communityrequestparticipantsupdate "Direct link to communityRequestParticipantsUpdate\(\)")
> **communityRequestParticipantsUpdate** : (`jid`, `participants`, `action`) => `Promise`<`object`[]>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-24 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-12 "Direct link to jid")
`string`
##### participants[​](https://baileys.wiki/docs/api/functions/makeWASocket/#participants-2 "Direct link to participants")
`string`[]
##### action[​](https://baileys.wiki/docs/api/functions/makeWASocket/#action-1 "Direct link to action")
`"reject"` | `"approve"`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-25 "Direct link to Returns")
`Promise`<`object`[]>
### communityRevokeInvite()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communityrevokeinvite "Direct link to communityRevokeInvite\(\)")
> **communityRevokeInvite** : (`jid`) => `Promise`<`undefined` | `string`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-25 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-13 "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-26 "Direct link to Returns")
`Promise`<`undefined` | `string`>
### communityRevokeInviteV4()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communityrevokeinvitev4 "Direct link to communityRevokeInviteV4\(\)")
> **communityRevokeInviteV4** : (`communityJid`, `invitedJid`) => `Promise`<`boolean`>
revoke a v4 invite for someone
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-26 "Direct link to Parameters")
##### communityJid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communityjid "Direct link to communityJid")
`string`
community jid
##### invitedJid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#invitedjid "Direct link to invitedJid")
`string`
jid of person you invited
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-27 "Direct link to Returns")
`Promise`<`boolean`>
true if successful
### communitySettingUpdate()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communitysettingupdate "Direct link to communitySettingUpdate\(\)")
> **communitySettingUpdate** : (`jid`, `setting`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-27 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-14 "Direct link to jid")
`string`
##### setting[​](https://baileys.wiki/docs/api/functions/makeWASocket/#setting "Direct link to setting")
`"announcement"` | `"locked"` | `"not_announcement"` | `"unlocked"`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-28 "Direct link to Returns")
`Promise`<`void`>
### communityToggleEphemeral()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communitytoggleephemeral "Direct link to communityToggleEphemeral\(\)")
> **communityToggleEphemeral** : (`jid`, `ephemeralExpiration`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-28 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-15 "Direct link to jid")
`string`
##### ephemeralExpiration[​](https://baileys.wiki/docs/api/functions/makeWASocket/#ephemeralexpiration "Direct link to ephemeralExpiration")
`number`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-29 "Direct link to Returns")
`Promise`<`void`>
### communityUnlinkGroup()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communityunlinkgroup "Direct link to communityUnlinkGroup\(\)")
> **communityUnlinkGroup** : (`groupJid`, `parentCommunityJid`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-29 "Direct link to Parameters")
##### groupJid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#groupjid-1 "Direct link to groupJid")
`string`
##### parentCommunityJid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parentcommunityjid-2 "Direct link to parentCommunityJid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-30 "Direct link to Returns")
`Promise`<`void`>
### communityUpdateDescription()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communityupdatedescription "Direct link to communityUpdateDescription\(\)")
> **communityUpdateDescription** : (`jid`, `description`?) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-30 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-16 "Direct link to jid")
`string`
##### description?[​](https://baileys.wiki/docs/api/functions/makeWASocket/#description "Direct link to description?")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-31 "Direct link to Returns")
`Promise`<`void`>
### communityUpdateSubject()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#communityupdatesubject "Direct link to communityUpdateSubject\(\)")
> **communityUpdateSubject** : (`jid`, `subject`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-31 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-17 "Direct link to jid")
`string`
##### subject[​](https://baileys.wiki/docs/api/functions/makeWASocket/#subject-2 "Direct link to subject")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-32 "Direct link to Returns")
`Promise`<`void`>
### createCallLink()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#createcalllink "Direct link to createCallLink\(\)")
> **createCallLink** : (`type`, `event`?, `timeoutMs`?) => `Promise`<`undefined` | `string`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-32 "Direct link to Parameters")
##### type[​](https://baileys.wiki/docs/api/functions/makeWASocket/#type-1 "Direct link to type")
`"video"` | `"audio"`
##### event?[​](https://baileys.wiki/docs/api/functions/makeWASocket/#event "Direct link to event?")
###### startTime[​](https://baileys.wiki/docs/api/functions/makeWASocket/#starttime "Direct link to startTime")
`number`
##### timeoutMs?[​](https://baileys.wiki/docs/api/functions/makeWASocket/#timeoutms "Direct link to timeoutMs?")
`number`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-33 "Direct link to Returns")
`Promise`<`undefined` | `string`>
### createParticipantNodes()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#createparticipantnodes "Direct link to createParticipantNodes\(\)")
> **createParticipantNodes** : (`recipientJids`, `message`, `extraAttrs`?, `dsmMessage`?) => `Promise`<{ `nodes`: [`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)[]; `shouldIncludeDeviceIdentity`: `boolean`; }>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-33 "Direct link to Parameters")
##### recipientJids[​](https://baileys.wiki/docs/api/functions/makeWASocket/#recipientjids "Direct link to recipientJids")
`string`[]
##### message[​](https://baileys.wiki/docs/api/functions/makeWASocket/#message "Direct link to message")
[`IMessage`](https://baileys.wiki/docs/api/namespaces/proto/interfaces/IMessage)
##### extraAttrs?[​](https://baileys.wiki/docs/api/functions/makeWASocket/#extraattrs "Direct link to extraAttrs?")
##### dsmMessage?[​](https://baileys.wiki/docs/api/functions/makeWASocket/#dsmmessage "Direct link to dsmMessage?")
[`IMessage`](https://baileys.wiki/docs/api/namespaces/proto/interfaces/IMessage)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-34 "Direct link to Returns")
`Promise`<{ `nodes`: [`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)[]; `shouldIncludeDeviceIdentity`: `boolean`; }>
### digestKeyBundle()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#digestkeybundle "Direct link to digestKeyBundle\(\)")
> **digestKeyBundle** : () => `Promise`<`void`>
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-35 "Direct link to Returns")
`Promise`<`void`>
### end()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#end "Direct link to end\(\)")
> **end** : (`error`) => `void`
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-34 "Direct link to Parameters")
##### error[​](https://baileys.wiki/docs/api/functions/makeWASocket/#error "Direct link to error")
`undefined` | `Error`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-36 "Direct link to Returns")
`void`
### ev[​](https://baileys.wiki/docs/api/functions/makeWASocket/#ev "Direct link to ev")
> **ev** : `BaileysBufferableEventEmitter`
### executeUSyncQuery()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#executeusyncquery "Direct link to executeUSyncQuery\(\)")
> **executeUSyncQuery** : (`usyncQuery`) => `Promise`<`undefined` | [`USyncQueryResult`](https://baileys.wiki/docs/api/type-aliases/USyncQueryResult)>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-35 "Direct link to Parameters")
##### usyncQuery[​](https://baileys.wiki/docs/api/functions/makeWASocket/#usyncquery "Direct link to usyncQuery")
[`USyncQuery`](https://baileys.wiki/docs/api/classes/USyncQuery)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-37 "Direct link to Returns")
`Promise`<`undefined` | [`USyncQueryResult`](https://baileys.wiki/docs/api/type-aliases/USyncQueryResult)>
### fetchBlocklist()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#fetchblocklist "Direct link to fetchBlocklist\(\)")
> **fetchBlocklist** : () => `Promise`<(`undefined` | `string`)[]>
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-38 "Direct link to Returns")
`Promise`<(`undefined` | `string`)[]>
### fetchDisappearingDuration()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#fetchdisappearingduration "Direct link to fetchDisappearingDuration\(\)")
> **fetchDisappearingDuration** : (...`jids`) => `Promise`<`undefined` | [`USyncQueryResultList`](https://baileys.wiki/docs/api/type-aliases/USyncQueryResultList)[]>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-36 "Direct link to Parameters")
##### jids[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jids-1 "Direct link to jids")
...`string`[]
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-39 "Direct link to Returns")
`Promise`<`undefined` | [`USyncQueryResultList`](https://baileys.wiki/docs/api/type-aliases/USyncQueryResultList)[]>
### fetchMessageHistory()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#fetchmessagehistory "Direct link to fetchMessageHistory\(\)")
> **fetchMessageHistory** : (`count`, `oldestMsgKey`, `oldestMsgTimestamp`) => `Promise`<`string`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-37 "Direct link to Parameters")
##### count[​](https://baileys.wiki/docs/api/functions/makeWASocket/#count "Direct link to count")
`number`
##### oldestMsgKey[​](https://baileys.wiki/docs/api/functions/makeWASocket/#oldestmsgkey "Direct link to oldestMsgKey")
[`WAMessageKey`](https://baileys.wiki/docs/api/type-aliases/WAMessageKey)
##### oldestMsgTimestamp[​](https://baileys.wiki/docs/api/functions/makeWASocket/#oldestmsgtimestamp "Direct link to oldestMsgTimestamp")
`number` | `Long`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-40 "Direct link to Returns")
`Promise`<`string`>
### fetchPrivacySettings()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#fetchprivacysettings "Direct link to fetchPrivacySettings\(\)")
> **fetchPrivacySettings** : (`force`) => `Promise`<{}>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-38 "Direct link to Parameters")
##### force[​](https://baileys.wiki/docs/api/functions/makeWASocket/#force-1 "Direct link to force")
`boolean` = `false`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-41 "Direct link to Returns")
`Promise`<{}>
### fetchStatus()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#fetchstatus "Direct link to fetchStatus\(\)")
> **fetchStatus** : (...`jids`) => `Promise`<`undefined` | [`USyncQueryResultList`](https://baileys.wiki/docs/api/type-aliases/USyncQueryResultList)[]>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-39 "Direct link to Parameters")
##### jids[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jids-2 "Direct link to jids")
...`string`[]
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-42 "Direct link to Returns")
`Promise`<`undefined` | [`USyncQueryResultList`](https://baileys.wiki/docs/api/type-aliases/USyncQueryResultList)[]>
### generateMessageTag()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#generatemessagetag "Direct link to generateMessageTag\(\)")
> **generateMessageTag** : () => `string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-43 "Direct link to Returns")
`string`
### getBotListV2()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#getbotlistv2 "Direct link to getBotListV2\(\)")
> **getBotListV2** : () => `Promise`<[`BotListInfo`](https://baileys.wiki/docs/api/type-aliases/BotListInfo)[]>
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-44 "Direct link to Returns")
`Promise`<[`BotListInfo`](https://baileys.wiki/docs/api/type-aliases/BotListInfo)[]>
### getBusinessProfile()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#getbusinessprofile "Direct link to getBusinessProfile\(\)")
> **getBusinessProfile** : (`jid`) => `Promise`<`void` | [`WABusinessProfile`](https://baileys.wiki/docs/api/type-aliases/WABusinessProfile)>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-40 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-18 "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-45 "Direct link to Returns")
`Promise`<`void` | [`WABusinessProfile`](https://baileys.wiki/docs/api/type-aliases/WABusinessProfile)>
### getCatalog()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#getcatalog "Direct link to getCatalog\(\)")
> **getCatalog** : (`__namedParameters`) => `Promise`<{ `nextPageCursor`: `undefined` | `string`; `products`: [`Product`](https://baileys.wiki/docs/api/type-aliases/Product)[]; }>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-41 "Direct link to Parameters")
##### __namedParameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#__namedparameters "Direct link to __namedParameters")
[`GetCatalogOptions`](https://baileys.wiki/docs/api/type-aliases/GetCatalogOptions)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-46 "Direct link to Returns")
`Promise`<{ `nextPageCursor`: `undefined` | `string`; `products`: [`Product`](https://baileys.wiki/docs/api/type-aliases/Product)[]; }>
### getCollections()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#getcollections "Direct link to getCollections\(\)")
> **getCollections** : (`jid`?, `limit`) => `Promise`<{ `collections`: [`CatalogCollection`](https://baileys.wiki/docs/api/type-aliases/CatalogCollection)[]; }>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-42 "Direct link to Parameters")
##### jid?[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-19 "Direct link to jid?")
`string`
##### limit?[​](https://baileys.wiki/docs/api/functions/makeWASocket/#limit "Direct link to limit?")
`number` = `51`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-47 "Direct link to Returns")
`Promise`<{ `collections`: [`CatalogCollection`](https://baileys.wiki/docs/api/type-aliases/CatalogCollection)[]; }>
### getOrderDetails()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#getorderdetails "Direct link to getOrderDetails\(\)")
> **getOrderDetails** : (`orderId`, `tokenBase64`) => `Promise`<[`OrderDetails`](https://baileys.wiki/docs/api/type-aliases/OrderDetails)>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-43 "Direct link to Parameters")
##### orderId[​](https://baileys.wiki/docs/api/functions/makeWASocket/#orderid "Direct link to orderId")
`string`
##### tokenBase64[​](https://baileys.wiki/docs/api/functions/makeWASocket/#tokenbase64 "Direct link to tokenBase64")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-48 "Direct link to Returns")
`Promise`<[`OrderDetails`](https://baileys.wiki/docs/api/type-aliases/OrderDetails)>
### getPrivacyTokens()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#getprivacytokens "Direct link to getPrivacyTokens\(\)")
> **getPrivacyTokens** : (`jids`) => `Promise`<`any`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-44 "Direct link to Parameters")
##### jids[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jids-3 "Direct link to jids")
`string`[]
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-49 "Direct link to Returns")
`Promise`<`any`>
### getUSyncDevices()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#getusyncdevices "Direct link to getUSyncDevices\(\)")
> **getUSyncDevices** : (`jids`, `useCache`, `ignoreZeroDevices`) => `Promise`<`DeviceWithJid`[]>
Fetch all the devices we've to send a message to
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-45 "Direct link to Parameters")
##### jids[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jids-4 "Direct link to jids")
`string`[]
##### useCache[​](https://baileys.wiki/docs/api/functions/makeWASocket/#usecache "Direct link to useCache")
`boolean`
##### ignoreZeroDevices[​](https://baileys.wiki/docs/api/functions/makeWASocket/#ignorezerodevices "Direct link to ignoreZeroDevices")
`boolean`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-50 "Direct link to Returns")
`Promise`<`DeviceWithJid`[]>
### groupAcceptInvite()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#groupacceptinvite "Direct link to groupAcceptInvite\(\)")
> **groupAcceptInvite** : (`code`) => `Promise`<`undefined` | `string`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-46 "Direct link to Parameters")
##### code[​](https://baileys.wiki/docs/api/functions/makeWASocket/#code-2 "Direct link to code")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-51 "Direct link to Returns")
`Promise`<`undefined` | `string`>
### groupAcceptInviteV4()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#groupacceptinvitev4 "Direct link to groupAcceptInviteV4\(\)")
> **groupAcceptInviteV4** : (...`args`) => `Promise`<`any`>
accept a GroupInviteMessage
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-47 "Direct link to Parameters")
##### args[​](https://baileys.wiki/docs/api/functions/makeWASocket/#args-1 "Direct link to args")
...[`string` | [`WAMessageKey`](https://baileys.wiki/docs/api/type-aliases/WAMessageKey), [`IGroupInviteMessage`](https://baileys.wiki/docs/api/namespaces/proto/namespaces/Message/interfaces/IGroupInviteMessage)]
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-52 "Direct link to Returns")
`Promise`<`any`>
### groupCreate()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#groupcreate "Direct link to groupCreate\(\)")
> **groupCreate** : (`subject`, `participants`) => `Promise`<[`GroupMetadata`](https://baileys.wiki/docs/api/interfaces/GroupMetadata)>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-48 "Direct link to Parameters")
##### subject[​](https://baileys.wiki/docs/api/functions/makeWASocket/#subject-3 "Direct link to subject")
`string`
##### participants[​](https://baileys.wiki/docs/api/functions/makeWASocket/#participants-3 "Direct link to participants")
`string`[]
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-53 "Direct link to Returns")
`Promise`<[`GroupMetadata`](https://baileys.wiki/docs/api/interfaces/GroupMetadata)>
### groupFetchAllParticipating()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#groupfetchallparticipating "Direct link to groupFetchAllParticipating\(\)")
> **groupFetchAllParticipating** : () => `Promise`<{}>
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-54 "Direct link to Returns")
`Promise`<{}>
### groupGetInviteInfo()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#groupgetinviteinfo "Direct link to groupGetInviteInfo\(\)")
> **groupGetInviteInfo** : (`code`) => `Promise`<[`GroupMetadata`](https://baileys.wiki/docs/api/interfaces/GroupMetadata)>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-49 "Direct link to Parameters")
##### code[​](https://baileys.wiki/docs/api/functions/makeWASocket/#code-3 "Direct link to code")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-55 "Direct link to Returns")
`Promise`<[`GroupMetadata`](https://baileys.wiki/docs/api/interfaces/GroupMetadata)>
### groupInviteCode()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#groupinvitecode "Direct link to groupInviteCode\(\)")
> **groupInviteCode** : (`jid`) => `Promise`<`undefined` | `string`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-50 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-20 "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-56 "Direct link to Returns")
`Promise`<`undefined` | `string`>
### groupJoinApprovalMode()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#groupjoinapprovalmode "Direct link to groupJoinApprovalMode\(\)")
> **groupJoinApprovalMode** : (`jid`, `mode`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-51 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-21 "Direct link to jid")
`string`
##### mode[​](https://baileys.wiki/docs/api/functions/makeWASocket/#mode-2 "Direct link to mode")
`"on"` | `"off"`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-57 "Direct link to Returns")
`Promise`<`void`>
### groupLeave()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#groupleave "Direct link to groupLeave\(\)")
> **groupLeave** : (`id`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-52 "Direct link to Parameters")
##### id[​](https://baileys.wiki/docs/api/functions/makeWASocket/#id-1 "Direct link to id")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-58 "Direct link to Returns")
`Promise`<`void`>
### groupMemberAddMode()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#groupmemberaddmode "Direct link to groupMemberAddMode\(\)")
> **groupMemberAddMode** : (`jid`, `mode`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-53 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-22 "Direct link to jid")
`string`
##### mode[​](https://baileys.wiki/docs/api/functions/makeWASocket/#mode-3 "Direct link to mode")
`"all_member_add"` | `"admin_add"`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-59 "Direct link to Returns")
`Promise`<`void`>
### groupMetadata()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#groupmetadata "Direct link to groupMetadata\(\)")
> **groupMetadata** : (`jid`) => `Promise`<[`GroupMetadata`](https://baileys.wiki/docs/api/interfaces/GroupMetadata)>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-54 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-23 "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-60 "Direct link to Returns")
`Promise`<[`GroupMetadata`](https://baileys.wiki/docs/api/interfaces/GroupMetadata)>
### groupParticipantsUpdate()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#groupparticipantsupdate "Direct link to groupParticipantsUpdate\(\)")
> **groupParticipantsUpdate** : (`jid`, `participants`, `action`) => `Promise`<`object`[]>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-55 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-24 "Direct link to jid")
`string`
##### participants[​](https://baileys.wiki/docs/api/functions/makeWASocket/#participants-4 "Direct link to participants")
`string`[]
##### action[​](https://baileys.wiki/docs/api/functions/makeWASocket/#action-2 "Direct link to action")
[`ParticipantAction`](https://baileys.wiki/docs/api/type-aliases/ParticipantAction)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-61 "Direct link to Returns")
`Promise`<`object`[]>
### groupRequestParticipantsList()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#grouprequestparticipantslist "Direct link to groupRequestParticipantsList\(\)")
> **groupRequestParticipantsList** : (`jid`) => `Promise`<`object`[]>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-56 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-25 "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-62 "Direct link to Returns")
`Promise`<`object`[]>
### groupRequestParticipantsUpdate()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#grouprequestparticipantsupdate "Direct link to groupRequestParticipantsUpdate\(\)")
> **groupRequestParticipantsUpdate** : (`jid`, `participants`, `action`) => `Promise`<`object`[]>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-57 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-26 "Direct link to jid")
`string`
##### participants[​](https://baileys.wiki/docs/api/functions/makeWASocket/#participants-5 "Direct link to participants")
`string`[]
##### action[​](https://baileys.wiki/docs/api/functions/makeWASocket/#action-3 "Direct link to action")
`"reject"` | `"approve"`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-63 "Direct link to Returns")
`Promise`<`object`[]>
### groupRevokeInvite()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#grouprevokeinvite "Direct link to groupRevokeInvite\(\)")
> **groupRevokeInvite** : (`jid`) => `Promise`<`undefined` | `string`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-58 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-27 "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-64 "Direct link to Returns")
`Promise`<`undefined` | `string`>
### groupRevokeInviteV4()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#grouprevokeinvitev4 "Direct link to groupRevokeInviteV4\(\)")
> **groupRevokeInviteV4** : (`groupJid`, `invitedJid`) => `Promise`<`boolean`>
revoke a v4 invite for someone
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-59 "Direct link to Parameters")
##### groupJid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#groupjid-2 "Direct link to groupJid")
`string`
group jid
##### invitedJid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#invitedjid-1 "Direct link to invitedJid")
`string`
jid of person you invited
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-65 "Direct link to Returns")
`Promise`<`boolean`>
true if successful
### groupSettingUpdate()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#groupsettingupdate "Direct link to groupSettingUpdate\(\)")
> **groupSettingUpdate** : (`jid`, `setting`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-60 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-28 "Direct link to jid")
`string`
##### setting[​](https://baileys.wiki/docs/api/functions/makeWASocket/#setting-1 "Direct link to setting")
`"announcement"` | `"locked"` | `"not_announcement"` | `"unlocked"`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-66 "Direct link to Returns")
`Promise`<`void`>
### groupToggleEphemeral()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#grouptoggleephemeral "Direct link to groupToggleEphemeral\(\)")
> **groupToggleEphemeral** : (`jid`, `ephemeralExpiration`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-61 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-29 "Direct link to jid")
`string`
##### ephemeralExpiration[​](https://baileys.wiki/docs/api/functions/makeWASocket/#ephemeralexpiration-1 "Direct link to ephemeralExpiration")
`number`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-67 "Direct link to Returns")
`Promise`<`void`>
### groupUpdateDescription()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#groupupdatedescription "Direct link to groupUpdateDescription\(\)")
> **groupUpdateDescription** : (`jid`, `description`?) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-62 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-30 "Direct link to jid")
`string`
##### description?[​](https://baileys.wiki/docs/api/functions/makeWASocket/#description-1 "Direct link to description?")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-68 "Direct link to Returns")
`Promise`<`void`>
### groupUpdateSubject()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#groupupdatesubject "Direct link to groupUpdateSubject\(\)")
> **groupUpdateSubject** : (`jid`, `subject`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-63 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-31 "Direct link to jid")
`string`
##### subject[​](https://baileys.wiki/docs/api/functions/makeWASocket/#subject-4 "Direct link to subject")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-69 "Direct link to Returns")
`Promise`<`void`>
### logger[​](https://baileys.wiki/docs/api/functions/makeWASocket/#logger "Direct link to logger")
> **logger** : `ILogger` = `config.logger`
### logout()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#logout "Direct link to logout\(\)")
> **logout** : (`msg`?) => `Promise`<`void`>
logout & invalidate connection
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-64 "Direct link to Parameters")
##### msg?[​](https://baileys.wiki/docs/api/functions/makeWASocket/#msg "Direct link to msg?")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-70 "Direct link to Returns")
`Promise`<`void`>
### messageRetryManager[​](https://baileys.wiki/docs/api/functions/makeWASocket/#messageretrymanager "Direct link to messageRetryManager")
> **messageRetryManager** : `null` | [`MessageRetryManager`](https://baileys.wiki/docs/api/classes/MessageRetryManager)
### newsletterAdminCount()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletteradmincount "Direct link to newsletterAdminCount\(\)")
> **newsletterAdminCount** : (`jid`) => `Promise`<`number`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-65 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-32 "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-71 "Direct link to Returns")
`Promise`<`number`>
### newsletterChangeOwner()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterchangeowner "Direct link to newsletterChangeOwner\(\)")
> **newsletterChangeOwner** : (`jid`, `newOwnerJid`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-66 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-33 "Direct link to jid")
`string`
##### newOwnerJid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#newownerjid "Direct link to newOwnerJid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-72 "Direct link to Returns")
`Promise`<`void`>
### newsletterCreate()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#newslettercreate "Direct link to newsletterCreate\(\)")
> **newsletterCreate** : (`name`, `description`?) => `Promise`<[`NewsletterMetadata`](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata)>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-67 "Direct link to Parameters")
##### name[​](https://baileys.wiki/docs/api/functions/makeWASocket/#name "Direct link to name")
`string`
##### description?[​](https://baileys.wiki/docs/api/functions/makeWASocket/#description-2 "Direct link to description?")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-73 "Direct link to Returns")
`Promise`<[`NewsletterMetadata`](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata)>
### newsletterDelete()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterdelete "Direct link to newsletterDelete\(\)")
> **newsletterDelete** : (`jid`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-68 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-34 "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-74 "Direct link to Returns")
`Promise`<`void`>
### newsletterDemote()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterdemote "Direct link to newsletterDemote\(\)")
> **newsletterDemote** : (`jid`, `userJid`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-69 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-35 "Direct link to jid")
`string`
##### userJid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#userjid "Direct link to userJid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-75 "Direct link to Returns")
`Promise`<`void`>
### newsletterFetchMessages()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterfetchmessages "Direct link to newsletterFetchMessages\(\)")
> **newsletterFetchMessages** : (`jid`, `count`, `since`, `after`) => `Promise`<`any`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-70 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-36 "Direct link to jid")
`string`
##### count[​](https://baileys.wiki/docs/api/functions/makeWASocket/#count-1 "Direct link to count")
`number`
##### since[​](https://baileys.wiki/docs/api/functions/makeWASocket/#since "Direct link to since")
`number`
##### after[​](https://baileys.wiki/docs/api/functions/makeWASocket/#after "Direct link to after")
`number`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-76 "Direct link to Returns")
`Promise`<`any`>
### newsletterFollow()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterfollow "Direct link to newsletterFollow\(\)")
> **newsletterFollow** : (`jid`) => `Promise`<`unknown`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-71 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-37 "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-77 "Direct link to Returns")
`Promise`<`unknown`>
### newsletterMetadata()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#newslettermetadata "Direct link to newsletterMetadata\(\)")
> **newsletterMetadata** : (`type`, `key`) => `Promise`<`null` | [`NewsletterMetadata`](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata)>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-72 "Direct link to Parameters")
##### type[​](https://baileys.wiki/docs/api/functions/makeWASocket/#type-2 "Direct link to type")
`"invite"` | `"jid"`
##### key[​](https://baileys.wiki/docs/api/functions/makeWASocket/#key "Direct link to key")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-78 "Direct link to Returns")
`Promise`<`null` | [`NewsletterMetadata`](https://baileys.wiki/docs/api/interfaces/NewsletterMetadata)>
### newsletterMute()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#newslettermute "Direct link to newsletterMute\(\)")
> **newsletterMute** : (`jid`) => `Promise`<`unknown`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-73 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-38 "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-79 "Direct link to Returns")
`Promise`<`unknown`>
### newsletterReactMessage()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterreactmessage "Direct link to newsletterReactMessage\(\)")
> **newsletterReactMessage** : (`jid`, `serverId`, `reaction`?) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-74 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-39 "Direct link to jid")
`string`
##### serverId[​](https://baileys.wiki/docs/api/functions/makeWASocket/#serverid "Direct link to serverId")
`string`
##### reaction?[​](https://baileys.wiki/docs/api/functions/makeWASocket/#reaction "Direct link to reaction?")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-80 "Direct link to Returns")
`Promise`<`void`>
### newsletterRemovePicture()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterremovepicture "Direct link to newsletterRemovePicture\(\)")
> **newsletterRemovePicture** : (`jid`) => `Promise`<`unknown`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-75 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-40 "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-81 "Direct link to Returns")
`Promise`<`unknown`>
### newsletterSubscribers()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#newslettersubscribers "Direct link to newsletterSubscribers\(\)")
> **newsletterSubscribers** : (`jid`) => `Promise`<{ `subscribers`: `number`; }>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-76 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-41 "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-82 "Direct link to Returns")
`Promise`<{ `subscribers`: `number`; }>
### newsletterUnfollow()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterunfollow "Direct link to newsletterUnfollow\(\)")
> **newsletterUnfollow** : (`jid`) => `Promise`<`unknown`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-77 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-42 "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-83 "Direct link to Returns")
`Promise`<`unknown`>
### newsletterUnmute()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterunmute "Direct link to newsletterUnmute\(\)")
> **newsletterUnmute** : (`jid`) => `Promise`<`unknown`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-78 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-43 "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-84 "Direct link to Returns")
`Promise`<`unknown`>
### newsletterUpdate()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterupdate "Direct link to newsletterUpdate\(\)")
> **newsletterUpdate** : (`jid`, `updates`) => `Promise`<`unknown`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-79 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-44 "Direct link to jid")
`string`
##### updates[​](https://baileys.wiki/docs/api/functions/makeWASocket/#updates "Direct link to updates")
[`NewsletterUpdate`](https://baileys.wiki/docs/api/type-aliases/NewsletterUpdate)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-85 "Direct link to Returns")
`Promise`<`unknown`>
### newsletterUpdateDescription()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterupdatedescription "Direct link to newsletterUpdateDescription\(\)")
> **newsletterUpdateDescription** : (`jid`, `description`) => `Promise`<`unknown`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-80 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-45 "Direct link to jid")
`string`
##### description[​](https://baileys.wiki/docs/api/functions/makeWASocket/#description-3 "Direct link to description")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-86 "Direct link to Returns")
`Promise`<`unknown`>
### newsletterUpdateName()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterupdatename "Direct link to newsletterUpdateName\(\)")
> **newsletterUpdateName** : (`jid`, `name`) => `Promise`<`unknown`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-81 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-46 "Direct link to jid")
`string`
##### name[​](https://baileys.wiki/docs/api/functions/makeWASocket/#name-1 "Direct link to name")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-87 "Direct link to Returns")
`Promise`<`unknown`>
### newsletterUpdatePicture()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterupdatepicture "Direct link to newsletterUpdatePicture\(\)")
> **newsletterUpdatePicture** : (`jid`, `content`) => `Promise`<`unknown`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-82 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-47 "Direct link to jid")
`string`
##### content[​](https://baileys.wiki/docs/api/functions/makeWASocket/#content "Direct link to content")
[`WAMediaUpload`](https://baileys.wiki/docs/api/type-aliases/WAMediaUpload)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-88 "Direct link to Returns")
`Promise`<`unknown`>
### onUnexpectedError()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#onunexpectederror "Direct link to onUnexpectedError\(\)")
> **onUnexpectedError** : (`err`, `msg`) => `void`
log & process any unexpected errors
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-83 "Direct link to Parameters")
##### err[​](https://baileys.wiki/docs/api/functions/makeWASocket/#err "Direct link to err")
`Error` | `Boom`<`any`>
##### msg[​](https://baileys.wiki/docs/api/functions/makeWASocket/#msg-1 "Direct link to msg")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-89 "Direct link to Returns")
`void`
### onWhatsApp()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#onwhatsapp "Direct link to onWhatsApp\(\)")
> **onWhatsApp** : (...`phoneNumber`) => `Promise`<`undefined` | `object`[]>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-84 "Direct link to Parameters")
##### phoneNumber[​](https://baileys.wiki/docs/api/functions/makeWASocket/#phonenumber "Direct link to phoneNumber")
...`string`[]
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-90 "Direct link to Returns")
`Promise`<`undefined` | `object`[]>
### presenceSubscribe()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#presencesubscribe "Direct link to presenceSubscribe\(\)")
> **presenceSubscribe** : (`toJid`, `tcToken`?) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-85 "Direct link to Parameters")
##### toJid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#tojid "Direct link to toJid")
`string`
the jid to subscribe to
##### tcToken?[​](https://baileys.wiki/docs/api/functions/makeWASocket/#tctoken "Direct link to tcToken?")
`Buffer`<`ArrayBufferLike`>
token for subscription, use if present
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-91 "Direct link to Returns")
`Promise`<`void`>
### processingMutex[​](https://baileys.wiki/docs/api/functions/makeWASocket/#processingmutex "Direct link to processingMutex")
> **processingMutex** : `object`
#### processingMutex.mutex()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#processingmutexmutex "Direct link to processingMutex.mutex\(\)")
##### Type Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#type-parameters "Direct link to Type Parameters")
• **T**
##### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-86 "Direct link to Parameters")
###### code[​](https://baileys.wiki/docs/api/functions/makeWASocket/#code-4 "Direct link to code")
() => `T` | `Promise`<`T`>
##### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-92 "Direct link to Returns")
`Promise`<`T`>
### productCreate()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#productcreate "Direct link to productCreate\(\)")
> **productCreate** : (`create`) => `Promise`<[`Product`](https://baileys.wiki/docs/api/type-aliases/Product)>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-87 "Direct link to Parameters")
##### create[​](https://baileys.wiki/docs/api/functions/makeWASocket/#create "Direct link to create")
[`ProductCreate`](https://baileys.wiki/docs/api/type-aliases/ProductCreate)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-93 "Direct link to Returns")
`Promise`<[`Product`](https://baileys.wiki/docs/api/type-aliases/Product)>
### productDelete()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#productdelete "Direct link to productDelete\(\)")
> **productDelete** : (`productIds`) => `Promise`<{ `deleted`: `number`; }>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-88 "Direct link to Parameters")
##### productIds[​](https://baileys.wiki/docs/api/functions/makeWASocket/#productids "Direct link to productIds")
`string`[]
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-94 "Direct link to Returns")
`Promise`<{ `deleted`: `number`; }>
### productUpdate()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#productupdate "Direct link to productUpdate\(\)")
> **productUpdate** : (`productId`, `update`) => `Promise`<[`Product`](https://baileys.wiki/docs/api/type-aliases/Product)>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-89 "Direct link to Parameters")
##### productId[​](https://baileys.wiki/docs/api/functions/makeWASocket/#productid "Direct link to productId")
`string`
##### update[​](https://baileys.wiki/docs/api/functions/makeWASocket/#update "Direct link to update")
[`ProductUpdate`](https://baileys.wiki/docs/api/type-aliases/ProductUpdate)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-95 "Direct link to Returns")
`Promise`<[`Product`](https://baileys.wiki/docs/api/type-aliases/Product)>
### profilePictureUrl()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#profilepictureurl "Direct link to profilePictureUrl\(\)")
> **profilePictureUrl** : (`jid`, `type`, `timeoutMs`?) => `Promise`<`undefined` | `string`>
fetch the profile picture of a user/group type = "preview" for a low res picture type = "image for the high res picture"
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-90 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-48 "Direct link to jid")
`string`
##### type[​](https://baileys.wiki/docs/api/functions/makeWASocket/#type-3 "Direct link to type")
`"image"` | `"preview"`
##### timeoutMs?[​](https://baileys.wiki/docs/api/functions/makeWASocket/#timeoutms-1 "Direct link to timeoutMs?")
`number`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-96 "Direct link to Returns")
`Promise`<`undefined` | `string`>
### query()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#query "Direct link to query\(\)")
> **query** : (`node`, `timeoutMs`?) => `Promise`<`any`>
send a query, and wait for its response. auto-generates message ID if not provided
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-91 "Direct link to Parameters")
##### node[​](https://baileys.wiki/docs/api/functions/makeWASocket/#node "Direct link to node")
[`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)
##### timeoutMs?[​](https://baileys.wiki/docs/api/functions/makeWASocket/#timeoutms-2 "Direct link to timeoutMs?")
`number`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-97 "Direct link to Returns")
`Promise`<`any`>
### readMessages()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#readmessages "Direct link to readMessages\(\)")
> **readMessages** : (`keys`) => `Promise`<`void`>
Bulk read messages. Keys can be from different chats & participants
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-92 "Direct link to Parameters")
##### keys[​](https://baileys.wiki/docs/api/functions/makeWASocket/#keys "Direct link to keys")
[`WAMessageKey`](https://baileys.wiki/docs/api/type-aliases/WAMessageKey)[]
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-98 "Direct link to Returns")
`Promise`<`void`>
### refreshMediaConn()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#refreshmediaconn "Direct link to refreshMediaConn\(\)")
> **refreshMediaConn** : (`forceGet`) => `Promise`<[`MediaConnInfo`](https://baileys.wiki/docs/api/type-aliases/MediaConnInfo)>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-93 "Direct link to Parameters")
##### forceGet[​](https://baileys.wiki/docs/api/functions/makeWASocket/#forceget "Direct link to forceGet")
`boolean` = `false`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-99 "Direct link to Returns")
`Promise`<[`MediaConnInfo`](https://baileys.wiki/docs/api/type-aliases/MediaConnInfo)>
### rejectCall()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#rejectcall "Direct link to rejectCall\(\)")
> **rejectCall** : (`callId`, `callFrom`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-94 "Direct link to Parameters")
##### callId[​](https://baileys.wiki/docs/api/functions/makeWASocket/#callid "Direct link to callId")
`string`
##### callFrom[​](https://baileys.wiki/docs/api/functions/makeWASocket/#callfrom "Direct link to callFrom")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-100 "Direct link to Returns")
`Promise`<`void`>
### relayMessage()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#relaymessage "Direct link to relayMessage\(\)")
> **relayMessage** : (`jid`, `message`, `__namedParameters`) => `Promise`<`string`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-95 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-49 "Direct link to jid")
`string`
##### message[​](https://baileys.wiki/docs/api/functions/makeWASocket/#message-1 "Direct link to message")
[`IMessage`](https://baileys.wiki/docs/api/namespaces/proto/interfaces/IMessage)
##### __namedParameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#__namedparameters-1 "Direct link to __namedParameters")
[`MessageRelayOptions`](https://baileys.wiki/docs/api/type-aliases/MessageRelayOptions)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-101 "Direct link to Returns")
`Promise`<`string`>
### removeChatLabel()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#removechatlabel "Direct link to removeChatLabel\(\)")
> **removeChatLabel** : (`jid`, `labelId`) => `Promise`<`void`>
Removes label for the chat
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-96 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-50 "Direct link to jid")
`string`
##### labelId[​](https://baileys.wiki/docs/api/functions/makeWASocket/#labelid-2 "Direct link to labelId")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-102 "Direct link to Returns")
`Promise`<`void`>
### removeContact()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#removecontact "Direct link to removeContact\(\)")
> **removeContact** : (`jid`) => `Promise`<`void`>
Remove Contact
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-97 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-51 "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-103 "Direct link to Returns")
`Promise`<`void`>
### removeCoverPhoto()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#removecoverphoto "Direct link to removeCoverPhoto\(\)")
> **removeCoverPhoto** : (`id`) => `Promise`<`any`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-98 "Direct link to Parameters")
##### id[​](https://baileys.wiki/docs/api/functions/makeWASocket/#id-2 "Direct link to id")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-104 "Direct link to Returns")
`Promise`<`any`>
### removeMessageLabel()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#removemessagelabel "Direct link to removeMessageLabel\(\)")
> **removeMessageLabel** : (`jid`, `messageId`, `labelId`) => `Promise`<`void`>
Removes label for the message
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-99 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-52 "Direct link to jid")
`string`
##### messageId[​](https://baileys.wiki/docs/api/functions/makeWASocket/#messageid-1 "Direct link to messageId")
`string`
##### labelId[​](https://baileys.wiki/docs/api/functions/makeWASocket/#labelid-3 "Direct link to labelId")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-105 "Direct link to Returns")
`Promise`<`void`>
### removeProfilePicture()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#removeprofilepicture "Direct link to removeProfilePicture\(\)")
> **removeProfilePicture** : (`jid`) => `Promise`<`void`>
remove the profile picture for yourself or a group
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-100 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-53 "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-106 "Direct link to Returns")
`Promise`<`void`>
### removeQuickReply()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#removequickreply "Direct link to removeQuickReply\(\)")
> **removeQuickReply** : (`timestamp`) => `Promise`<`void`>
Remove Quick Reply
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-101 "Direct link to Parameters")
##### timestamp[​](https://baileys.wiki/docs/api/functions/makeWASocket/#timestamp "Direct link to timestamp")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-107 "Direct link to Returns")
`Promise`<`void`>
### requestPairingCode()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#requestpairingcode "Direct link to requestPairingCode\(\)")
> **requestPairingCode** : (`phoneNumber`, `customPairingCode`?) => `Promise`<`string`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-102 "Direct link to Parameters")
##### phoneNumber[​](https://baileys.wiki/docs/api/functions/makeWASocket/#phonenumber-1 "Direct link to phoneNumber")
`string`
##### customPairingCode?[​](https://baileys.wiki/docs/api/functions/makeWASocket/#custompairingcode "Direct link to customPairingCode?")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-108 "Direct link to Returns")
`Promise`<`string`>
### requestPlaceholderResend()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#requestplaceholderresend "Direct link to requestPlaceholderResend\(\)")
> **requestPlaceholderResend** : (`messageKey`) => `Promise`<`undefined` | `string`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-103 "Direct link to Parameters")
##### messageKey[​](https://baileys.wiki/docs/api/functions/makeWASocket/#messagekey "Direct link to messageKey")
[`WAMessageKey`](https://baileys.wiki/docs/api/type-aliases/WAMessageKey)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-109 "Direct link to Returns")
`Promise`<`undefined` | `string`>
### resyncAppState()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#resyncappstate "Direct link to resyncAppState\(\)")
> **resyncAppState** : (...`args`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-104 "Direct link to Parameters")
##### args[​](https://baileys.wiki/docs/api/functions/makeWASocket/#args-2 "Direct link to args")
...[readonly (`"critical_unblock_low"` | `"regular_high"` | `"regular_low"` | `"critical_block"` | `"regular"`)[], `boolean`]
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-110 "Direct link to Returns")
`Promise`<`void`>
### rotateSignedPreKey()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#rotatesignedprekey "Direct link to rotateSignedPreKey\(\)")
> **rotateSignedPreKey** : () => `Promise`<`void`>
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-111 "Direct link to Returns")
`Promise`<`void`>
### sendMessage()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#sendmessage "Direct link to sendMessage\(\)")
> **sendMessage** : (`jid`, `content`, `options`) => `Promise`<`undefined` | [`WAMessage`](https://baileys.wiki/docs/api/type-aliases/WAMessage)>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-105 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-54 "Direct link to jid")
`string`
##### content[​](https://baileys.wiki/docs/api/functions/makeWASocket/#content-1 "Direct link to content")
[`AnyMessageContent`](https://baileys.wiki/docs/api/type-aliases/AnyMessageContent)
##### options[​](https://baileys.wiki/docs/api/functions/makeWASocket/#options "Direct link to options")
[`MiscMessageGenerationOptions`](https://baileys.wiki/docs/api/type-aliases/MiscMessageGenerationOptions) = `{}`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-112 "Direct link to Returns")
`Promise`<`undefined` | [`WAMessage`](https://baileys.wiki/docs/api/type-aliases/WAMessage)>
### sendMessageAck()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#sendmessageack "Direct link to sendMessageAck\(\)")
> **sendMessageAck** : (`__namedParameters`, `errorCode`?) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-106 "Direct link to Parameters")
##### __namedParameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#__namedparameters-2 "Direct link to __namedParameters")
[`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)
##### errorCode?[​](https://baileys.wiki/docs/api/functions/makeWASocket/#errorcode "Direct link to errorCode?")
`number`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-113 "Direct link to Returns")
`Promise`<`void`>
### sendNode()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#sendnode "Direct link to sendNode\(\)")
> **sendNode** : (`frame`) => `Promise`<`void`>
send a binary node
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-107 "Direct link to Parameters")
##### frame[​](https://baileys.wiki/docs/api/functions/makeWASocket/#frame "Direct link to frame")
[`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-114 "Direct link to Returns")
`Promise`<`void`>
### sendPeerDataOperationMessage()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#sendpeerdataoperationmessage "Direct link to sendPeerDataOperationMessage\(\)")
> **sendPeerDataOperationMessage** : (`pdoMessage`) => `Promise`<`string`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-108 "Direct link to Parameters")
##### pdoMessage[​](https://baileys.wiki/docs/api/functions/makeWASocket/#pdomessage "Direct link to pdoMessage")
[`IPeerDataOperationRequestMessage`](https://baileys.wiki/docs/api/namespaces/proto/namespaces/Message/interfaces/IPeerDataOperationRequestMessage)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-115 "Direct link to Returns")
`Promise`<`string`>
### sendPresenceUpdate()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#sendpresenceupdate "Direct link to sendPresenceUpdate\(\)")
> **sendPresenceUpdate** : (`type`, `toJid`?) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-109 "Direct link to Parameters")
##### type[​](https://baileys.wiki/docs/api/functions/makeWASocket/#type-4 "Direct link to type")
[`WAPresence`](https://baileys.wiki/docs/api/type-aliases/WAPresence)
##### toJid?[​](https://baileys.wiki/docs/api/functions/makeWASocket/#tojid-1 "Direct link to toJid?")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-116 "Direct link to Returns")
`Promise`<`void`>
### sendRawMessage()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#sendrawmessage "Direct link to sendRawMessage\(\)")
> **sendRawMessage** : (`data`) => `Promise`<`void`>
send a raw buffer
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-110 "Direct link to Parameters")
##### data[​](https://baileys.wiki/docs/api/functions/makeWASocket/#data "Direct link to data")
`Uint8Array`<`ArrayBufferLike`> | `Buffer`<`ArrayBufferLike`>
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-117 "Direct link to Returns")
`Promise`<`void`>
### sendReceipt()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#sendreceipt "Direct link to sendReceipt\(\)")
> **sendReceipt** : (`jid`, `participant`, `messageIds`, `type`) => `Promise`<`void`>
generic send receipt function used for receipts of phone call, read, delivery etc.
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-111 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-55 "Direct link to jid")
`string`
##### participant[​](https://baileys.wiki/docs/api/functions/makeWASocket/#participant "Direct link to participant")
`undefined` | `string`
##### messageIds[​](https://baileys.wiki/docs/api/functions/makeWASocket/#messageids "Direct link to messageIds")
`string`[]
##### type[​](https://baileys.wiki/docs/api/functions/makeWASocket/#type-5 "Direct link to type")
[`MessageReceiptType`](https://baileys.wiki/docs/api/type-aliases/MessageReceiptType)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-118 "Direct link to Returns")
`Promise`<`void`>
### sendReceipts()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#sendreceipts "Direct link to sendReceipts\(\)")
> **sendReceipts** : (`keys`, `type`) => `Promise`<`void`>
Correctly bulk send receipts to multiple chats, participants
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-112 "Direct link to Parameters")
##### keys[​](https://baileys.wiki/docs/api/functions/makeWASocket/#keys-1 "Direct link to keys")
[`WAMessageKey`](https://baileys.wiki/docs/api/type-aliases/WAMessageKey)[]
##### type[​](https://baileys.wiki/docs/api/functions/makeWASocket/#type-6 "Direct link to type")
[`MessageReceiptType`](https://baileys.wiki/docs/api/type-aliases/MessageReceiptType)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-119 "Direct link to Returns")
`Promise`<`void`>
### sendRetryRequest()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#sendretryrequest "Direct link to sendRetryRequest\(\)")
> **sendRetryRequest** : (`node`, `forceIncludeKeys`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-113 "Direct link to Parameters")
##### node[​](https://baileys.wiki/docs/api/functions/makeWASocket/#node-1 "Direct link to node")
[`BinaryNode`](https://baileys.wiki/docs/api/type-aliases/BinaryNode)
##### forceIncludeKeys[​](https://baileys.wiki/docs/api/functions/makeWASocket/#forceincludekeys "Direct link to forceIncludeKeys")
`boolean` = `false`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-120 "Direct link to Returns")
`Promise`<`void`>
### sendWAMBuffer()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#sendwambuffer "Direct link to sendWAMBuffer\(\)")
> **sendWAMBuffer** : (`wamBuffer`) => `Promise`<`any`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-114 "Direct link to Parameters")
##### wamBuffer[​](https://baileys.wiki/docs/api/functions/makeWASocket/#wambuffer "Direct link to wamBuffer")
`Buffer`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-121 "Direct link to Returns")
`Promise`<`any`>
### signalRepository[​](https://baileys.wiki/docs/api/functions/makeWASocket/#signalrepository "Direct link to signalRepository")
> **signalRepository** : [`SignalRepositoryWithLIDStore`](https://baileys.wiki/docs/api/interfaces/SignalRepositoryWithLIDStore)
### star()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#star "Direct link to star\(\)")
> **star** : (`jid`, `messages`, `star`) => `Promise`<`void`>
Star or Unstar a message
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-115 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-56 "Direct link to jid")
`string`
##### messages[​](https://baileys.wiki/docs/api/functions/makeWASocket/#messages "Direct link to messages")
`object`[]
##### star[​](https://baileys.wiki/docs/api/functions/makeWASocket/#star-1 "Direct link to star")
`boolean`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-122 "Direct link to Returns")
`Promise`<`void`>
### subscribeNewsletterUpdates()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#subscribenewsletterupdates "Direct link to subscribeNewsletterUpdates\(\)")
> **subscribeNewsletterUpdates** : (`jid`) => `Promise`<`null` | { `duration`: `string`; }>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-116 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-57 "Direct link to jid")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-123 "Direct link to Returns")
`Promise`<`null` | { `duration`: `string`; }>
### type[​](https://baileys.wiki/docs/api/functions/makeWASocket/#type-7 "Direct link to type")
> **type** : `"md"`
### updateBlockStatus()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#updateblockstatus "Direct link to updateBlockStatus\(\)")
> **updateBlockStatus** : (`jid`, `action`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-117 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-58 "Direct link to jid")
`string`
##### action[​](https://baileys.wiki/docs/api/functions/makeWASocket/#action-4 "Direct link to action")
`"block"` | `"unblock"`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-124 "Direct link to Returns")
`Promise`<`void`>
### updateBussinesProfile()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#updatebussinesprofile "Direct link to updateBussinesProfile\(\)")
> **updateBussinesProfile** : (`args`) => `Promise`<`any`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-118 "Direct link to Parameters")
##### args[​](https://baileys.wiki/docs/api/functions/makeWASocket/#args-3 "Direct link to args")
`UpdateBussinesProfileProps`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-125 "Direct link to Returns")
`Promise`<`any`>
### updateCallPrivacy()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#updatecallprivacy "Direct link to updateCallPrivacy\(\)")
> **updateCallPrivacy** : (`value`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-119 "Direct link to Parameters")
##### value[​](https://baileys.wiki/docs/api/functions/makeWASocket/#value "Direct link to value")
[`WAPrivacyCallValue`](https://baileys.wiki/docs/api/type-aliases/WAPrivacyCallValue)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-126 "Direct link to Returns")
`Promise`<`void`>
### updateCoverPhoto()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#updatecoverphoto "Direct link to updateCoverPhoto\(\)")
> **updateCoverPhoto** : (`photo`) => `Promise`<`number`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-120 "Direct link to Parameters")
##### photo[​](https://baileys.wiki/docs/api/functions/makeWASocket/#photo "Direct link to photo")
[`WAMediaUpload`](https://baileys.wiki/docs/api/type-aliases/WAMediaUpload)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-127 "Direct link to Returns")
`Promise`<`number`>
### updateDefaultDisappearingMode()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#updatedefaultdisappearingmode "Direct link to updateDefaultDisappearingMode\(\)")
> **updateDefaultDisappearingMode** : (`duration`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-121 "Direct link to Parameters")
##### duration[​](https://baileys.wiki/docs/api/functions/makeWASocket/#duration "Direct link to duration")
`number`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-128 "Direct link to Returns")
`Promise`<`void`>
### updateDisableLinkPreviewsPrivacy()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#updatedisablelinkpreviewsprivacy "Direct link to updateDisableLinkPreviewsPrivacy\(\)")
> **updateDisableLinkPreviewsPrivacy** : (`isPreviewsDisabled`) => `Promise`<`void`>
Enable/Disable link preview privacy, not related to baileys link preview generation
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-122 "Direct link to Parameters")
##### isPreviewsDisabled[​](https://baileys.wiki/docs/api/functions/makeWASocket/#ispreviewsdisabled "Direct link to isPreviewsDisabled")
`boolean`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-129 "Direct link to Returns")
`Promise`<`void`>
### updateGroupsAddPrivacy()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#updategroupsaddprivacy "Direct link to updateGroupsAddPrivacy\(\)")
> **updateGroupsAddPrivacy** : (`value`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-123 "Direct link to Parameters")
##### value[​](https://baileys.wiki/docs/api/functions/makeWASocket/#value-1 "Direct link to value")
[`WAPrivacyGroupAddValue`](https://baileys.wiki/docs/api/type-aliases/WAPrivacyGroupAddValue)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-130 "Direct link to Returns")
`Promise`<`void`>
### updateLastSeenPrivacy()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#updatelastseenprivacy "Direct link to updateLastSeenPrivacy\(\)")
> **updateLastSeenPrivacy** : (`value`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-124 "Direct link to Parameters")
##### value[​](https://baileys.wiki/docs/api/functions/makeWASocket/#value-2 "Direct link to value")
[`WAPrivacyValue`](https://baileys.wiki/docs/api/type-aliases/WAPrivacyValue)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-131 "Direct link to Returns")
`Promise`<`void`>
### updateMediaMessage()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#updatemediamessage "Direct link to updateMediaMessage\(\)")
> **updateMediaMessage** : (`message`) => `Promise`<[`WAMessage`](https://baileys.wiki/docs/api/type-aliases/WAMessage)>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-125 "Direct link to Parameters")
##### message[​](https://baileys.wiki/docs/api/functions/makeWASocket/#message-2 "Direct link to message")
[`WAMessage`](https://baileys.wiki/docs/api/type-aliases/WAMessage)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-132 "Direct link to Returns")
`Promise`<[`WAMessage`](https://baileys.wiki/docs/api/type-aliases/WAMessage)>
### updateMessagesPrivacy()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#updatemessagesprivacy "Direct link to updateMessagesPrivacy\(\)")
> **updateMessagesPrivacy** : (`value`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-126 "Direct link to Parameters")
##### value[​](https://baileys.wiki/docs/api/functions/makeWASocket/#value-3 "Direct link to value")
[`WAPrivacyMessagesValue`](https://baileys.wiki/docs/api/type-aliases/WAPrivacyMessagesValue)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-133 "Direct link to Returns")
`Promise`<`void`>
### updateOnlinePrivacy()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#updateonlineprivacy "Direct link to updateOnlinePrivacy\(\)")
> **updateOnlinePrivacy** : (`value`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-127 "Direct link to Parameters")
##### value[​](https://baileys.wiki/docs/api/functions/makeWASocket/#value-4 "Direct link to value")
[`WAPrivacyOnlineValue`](https://baileys.wiki/docs/api/type-aliases/WAPrivacyOnlineValue)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-134 "Direct link to Returns")
`Promise`<`void`>
### updateProfileName()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#updateprofilename "Direct link to updateProfileName\(\)")
> **updateProfileName** : (`name`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-128 "Direct link to Parameters")
##### name[​](https://baileys.wiki/docs/api/functions/makeWASocket/#name-2 "Direct link to name")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-135 "Direct link to Returns")
`Promise`<`void`>
### updateProfilePicture()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#updateprofilepicture "Direct link to updateProfilePicture\(\)")
> **updateProfilePicture** : (`jid`, `content`, `dimensions`?) => `Promise`<`void`>
update the profile picture for yourself or a group
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-129 "Direct link to Parameters")
##### jid[​](https://baileys.wiki/docs/api/functions/makeWASocket/#jid-59 "Direct link to jid")
`string`
##### content[​](https://baileys.wiki/docs/api/functions/makeWASocket/#content-2 "Direct link to content")
[`WAMediaUpload`](https://baileys.wiki/docs/api/type-aliases/WAMediaUpload)
##### dimensions?[​](https://baileys.wiki/docs/api/functions/makeWASocket/#dimensions "Direct link to dimensions?")
###### height[​](https://baileys.wiki/docs/api/functions/makeWASocket/#height "Direct link to height")
`number`
###### width[​](https://baileys.wiki/docs/api/functions/makeWASocket/#width "Direct link to width")
`number`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-136 "Direct link to Returns")
`Promise`<`void`>
### updateProfilePicturePrivacy()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#updateprofilepictureprivacy "Direct link to updateProfilePicturePrivacy\(\)")
> **updateProfilePicturePrivacy** : (`value`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-130 "Direct link to Parameters")
##### value[​](https://baileys.wiki/docs/api/functions/makeWASocket/#value-5 "Direct link to value")
[`WAPrivacyValue`](https://baileys.wiki/docs/api/type-aliases/WAPrivacyValue)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-137 "Direct link to Returns")
`Promise`<`void`>
### updateProfileStatus()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#updateprofilestatus "Direct link to updateProfileStatus\(\)")
> **updateProfileStatus** : (`status`) => `Promise`<`void`>
update the profile status for yourself
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-131 "Direct link to Parameters")
##### status[​](https://baileys.wiki/docs/api/functions/makeWASocket/#status "Direct link to status")
`string`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-138 "Direct link to Returns")
`Promise`<`void`>
### updateReadReceiptsPrivacy()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#updatereadreceiptsprivacy "Direct link to updateReadReceiptsPrivacy\(\)")
> **updateReadReceiptsPrivacy** : (`value`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-132 "Direct link to Parameters")
##### value[​](https://baileys.wiki/docs/api/functions/makeWASocket/#value-6 "Direct link to value")
[`WAReadReceiptsValue`](https://baileys.wiki/docs/api/type-aliases/WAReadReceiptsValue)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-139 "Direct link to Returns")
`Promise`<`void`>
### updateStatusPrivacy()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#updatestatusprivacy "Direct link to updateStatusPrivacy\(\)")
> **updateStatusPrivacy** : (`value`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-133 "Direct link to Parameters")
##### value[​](https://baileys.wiki/docs/api/functions/makeWASocket/#value-7 "Direct link to value")
[`WAPrivacyValue`](https://baileys.wiki/docs/api/type-aliases/WAPrivacyValue)
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-140 "Direct link to Returns")
`Promise`<`void`>
### uploadPreKeys()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#uploadprekeys "Direct link to uploadPreKeys\(\)")
> **uploadPreKeys** : (`count`, `retryCount`) => `Promise`<`void`>
generates and uploads a set of pre-keys to the server
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-134 "Direct link to Parameters")
##### count[​](https://baileys.wiki/docs/api/functions/makeWASocket/#count-2 "Direct link to count")
`number` = `MIN_PREKEY_COUNT`
##### retryCount[​](https://baileys.wiki/docs/api/functions/makeWASocket/#retrycount "Direct link to retryCount")
`number` = `0`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-141 "Direct link to Returns")
`Promise`<`void`>
### uploadPreKeysToServerIfRequired()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#uploadprekeystoserverifrequired "Direct link to uploadPreKeysToServerIfRequired\(\)")
> **uploadPreKeysToServerIfRequired** : () => `Promise`<`void`>
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-142 "Direct link to Returns")
`Promise`<`void`>
### upsertMessage()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#upsertmessage "Direct link to upsertMessage\(\)")
> **upsertMessage** : (...`args`) => `Promise`<`void`>
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-135 "Direct link to Parameters")
##### args[​](https://baileys.wiki/docs/api/functions/makeWASocket/#args-4 "Direct link to args")
...[[`WAMessage`](https://baileys.wiki/docs/api/type-aliases/WAMessage), [`MessageUpsertType`](https://baileys.wiki/docs/api/type-aliases/MessageUpsertType)]
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-143 "Direct link to Returns")
`Promise`<`void`>
### user[​](https://baileys.wiki/docs/api/functions/makeWASocket/#user "Direct link to user")
> **user** : `undefined` | [`Contact`](https://baileys.wiki/docs/api/interfaces/Contact)
### waitForConnectionUpdate()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#waitforconnectionupdate "Direct link to waitForConnectionUpdate\(\)")
> **waitForConnectionUpdate** : (`check`, `timeoutMs`?) => `Promise`<`void`>
Waits for the connection to WA to reach a state
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-136 "Direct link to Parameters")
##### check[​](https://baileys.wiki/docs/api/functions/makeWASocket/#check "Direct link to check")
(`u`) => `Promise`<`undefined` | `boolean`>
##### timeoutMs?[​](https://baileys.wiki/docs/api/functions/makeWASocket/#timeoutms-3 "Direct link to timeoutMs?")
`number`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-144 "Direct link to Returns")
`Promise`<`void`>
### waitForMessage()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#waitformessage "Direct link to waitForMessage\(\)")
> **waitForMessage** : <`T`>(`msgId`, `timeoutMs`) => `Promise`<`undefined` | `T`>
Wait for a message with a certain tag to be received
#### Type Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#type-parameters-1 "Direct link to Type Parameters")
• **T**
#### Parameters[​](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters-137 "Direct link to Parameters")
##### msgId[​](https://baileys.wiki/docs/api/functions/makeWASocket/#msgid "Direct link to msgId")
`string`
the message tag to await
##### timeoutMs[​](https://baileys.wiki/docs/api/functions/makeWASocket/#timeoutms-4 "Direct link to timeoutMs")
timeout after which the promise will reject
`undefined` | `number`
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-145 "Direct link to Returns")
`Promise`<`undefined` | `T`>
### waitForSocketOpen()[​](https://baileys.wiki/docs/api/functions/makeWASocket/#waitforsocketopen "Direct link to waitForSocketOpen\(\)")
> **waitForSocketOpen** : () => `Promise`<`void`>
#### Returns[​](https://baileys.wiki/docs/api/functions/makeWASocket/#returns-146 "Direct link to Returns")
`Promise`<`void`>
### wamBuffer[​](https://baileys.wiki/docs/api/functions/makeWASocket/#wambuffer-1 "Direct link to wamBuffer")
> **wamBuffer** : [`BinaryInfo`](https://baileys.wiki/docs/api/classes/BinaryInfo) = `publicWAMBuffer`
### waUploadToServer[​](https://baileys.wiki/docs/api/functions/makeWASocket/#wauploadtoserver "Direct link to waUploadToServer")
> **waUploadToServer** : [`WAMediaUploadFunction`](https://baileys.wiki/docs/api/type-aliases/WAMediaUploadFunction)
### ws[​](https://baileys.wiki/docs/api/functions/makeWASocket/#ws "Direct link to ws")
> **ws** : `WebSocketClient`
[](https://github.com/WhiskeySockets/baileys.wiki-site/tree/main/docs/api/functions/makeWASocket.md)
[Previous Function: makeNoiseHandler()](https://baileys.wiki/docs/api/functions/makeNoiseHandler)[Next Function: md5()](https://baileys.wiki/docs/api/functions/md5)
  * [Parameters](https://baileys.wiki/docs/api/functions/makeWASocket/#parameters)
    * [config](https://baileys.wiki/docs/api/functions/makeWASocket/#config)
  * [Returns](https://baileys.wiki/docs/api/functions/makeWASocket/#returns)
    * [addChatLabel()](https://baileys.wiki/docs/api/functions/makeWASocket/#addchatlabel)
    * [addLabel()](https://baileys.wiki/docs/api/functions/makeWASocket/#addlabel)
    * [addMessageLabel()](https://baileys.wiki/docs/api/functions/makeWASocket/#addmessagelabel)
    * [addOrEditContact()](https://baileys.wiki/docs/api/functions/makeWASocket/#addoreditcontact)
    * [addOrEditQuickReply()](https://baileys.wiki/docs/api/functions/makeWASocket/#addoreditquickreply)
    * [appPatch()](https://baileys.wiki/docs/api/functions/makeWASocket/#apppatch)
    * [assertSessions()](https://baileys.wiki/docs/api/functions/makeWASocket/#assertsessions)
    * [authState](https://baileys.wiki/docs/api/functions/makeWASocket/#authstate)
    * [chatModify()](https://baileys.wiki/docs/api/functions/makeWASocket/#chatmodify)
    * [cleanDirtyBits()](https://baileys.wiki/docs/api/functions/makeWASocket/#cleandirtybits)
    * [communityAcceptInvite()](https://baileys.wiki/docs/api/functions/makeWASocket/#communityacceptinvite)
    * [communityAcceptInviteV4()](https://baileys.wiki/docs/api/functions/makeWASocket/#communityacceptinvitev4)
    * [communityCreate()](https://baileys.wiki/docs/api/functions/makeWASocket/#communitycreate)
    * [communityCreateGroup()](https://baileys.wiki/docs/api/functions/makeWASocket/#communitycreategroup)
    * [communityFetchAllParticipating()](https://baileys.wiki/docs/api/functions/makeWASocket/#communityfetchallparticipating)
    * [communityFetchLinkedGroups()](https://baileys.wiki/docs/api/functions/makeWASocket/#communityfetchlinkedgroups)
    * [communityGetInviteInfo()](https://baileys.wiki/docs/api/functions/makeWASocket/#communitygetinviteinfo)
    * [communityInviteCode()](https://baileys.wiki/docs/api/functions/makeWASocket/#communityinvitecode)
    * [communityJoinApprovalMode()](https://baileys.wiki/docs/api/functions/makeWASocket/#communityjoinapprovalmode)
    * [communityLeave()](https://baileys.wiki/docs/api/functions/makeWASocket/#communityleave)
    * [communityLinkGroup()](https://baileys.wiki/docs/api/functions/makeWASocket/#communitylinkgroup)
    * [communityMemberAddMode()](https://baileys.wiki/docs/api/functions/makeWASocket/#communitymemberaddmode)
    * [communityMetadata()](https://baileys.wiki/docs/api/functions/makeWASocket/#communitymetadata)
    * [communityParticipantsUpdate()](https://baileys.wiki/docs/api/functions/makeWASocket/#communityparticipantsupdate)
    * [communityRequestParticipantsList()](https://baileys.wiki/docs/api/functions/makeWASocket/#communityrequestparticipantslist)
    * [communityRequestParticipantsUpdate()](https://baileys.wiki/docs/api/functions/makeWASocket/#communityrequestparticipantsupdate)
    * [communityRevokeInvite()](https://baileys.wiki/docs/api/functions/makeWASocket/#communityrevokeinvite)
    * [communityRevokeInviteV4()](https://baileys.wiki/docs/api/functions/makeWASocket/#communityrevokeinvitev4)
    * [communitySettingUpdate()](https://baileys.wiki/docs/api/functions/makeWASocket/#communitysettingupdate)
    * [communityToggleEphemeral()](https://baileys.wiki/docs/api/functions/makeWASocket/#communitytoggleephemeral)
    * [communityUnlinkGroup()](https://baileys.wiki/docs/api/functions/makeWASocket/#communityunlinkgroup)
    * [communityUpdateDescription()](https://baileys.wiki/docs/api/functions/makeWASocket/#communityupdatedescription)
    * [communityUpdateSubject()](https://baileys.wiki/docs/api/functions/makeWASocket/#communityupdatesubject)
    * [createCallLink()](https://baileys.wiki/docs/api/functions/makeWASocket/#createcalllink)
    * [createParticipantNodes()](https://baileys.wiki/docs/api/functions/makeWASocket/#createparticipantnodes)
    * [digestKeyBundle()](https://baileys.wiki/docs/api/functions/makeWASocket/#digestkeybundle)
    * [end()](https://baileys.wiki/docs/api/functions/makeWASocket/#end)
    * [ev](https://baileys.wiki/docs/api/functions/makeWASocket/#ev)
    * [executeUSyncQuery()](https://baileys.wiki/docs/api/functions/makeWASocket/#executeusyncquery)
    * [fetchBlocklist()](https://baileys.wiki/docs/api/functions/makeWASocket/#fetchblocklist)
    * [fetchDisappearingDuration()](https://baileys.wiki/docs/api/functions/makeWASocket/#fetchdisappearingduration)
    * [fetchMessageHistory()](https://baileys.wiki/docs/api/functions/makeWASocket/#fetchmessagehistory)
    * [fetchPrivacySettings()](https://baileys.wiki/docs/api/functions/makeWASocket/#fetchprivacysettings)
    * [fetchStatus()](https://baileys.wiki/docs/api/functions/makeWASocket/#fetchstatus)
    * [generateMessageTag()](https://baileys.wiki/docs/api/functions/makeWASocket/#generatemessagetag)
    * [getBotListV2()](https://baileys.wiki/docs/api/functions/makeWASocket/#getbotlistv2)
    * [getBusinessProfile()](https://baileys.wiki/docs/api/functions/makeWASocket/#getbusinessprofile)
    * [getCatalog()](https://baileys.wiki/docs/api/functions/makeWASocket/#getcatalog)
    * [getCollections()](https://baileys.wiki/docs/api/functions/makeWASocket/#getcollections)
    * [getOrderDetails()](https://baileys.wiki/docs/api/functions/makeWASocket/#getorderdetails)
    * [getPrivacyTokens()](https://baileys.wiki/docs/api/functions/makeWASocket/#getprivacytokens)
    * [getUSyncDevices()](https://baileys.wiki/docs/api/functions/makeWASocket/#getusyncdevices)
    * [groupAcceptInvite()](https://baileys.wiki/docs/api/functions/makeWASocket/#groupacceptinvite)
    * [groupAcceptInviteV4()](https://baileys.wiki/docs/api/functions/makeWASocket/#groupacceptinvitev4)
    * [groupCreate()](https://baileys.wiki/docs/api/functions/makeWASocket/#groupcreate)
    * [groupFetchAllParticipating()](https://baileys.wiki/docs/api/functions/makeWASocket/#groupfetchallparticipating)
    * [groupGetInviteInfo()](https://baileys.wiki/docs/api/functions/makeWASocket/#groupgetinviteinfo)
    * [groupInviteCode()](https://baileys.wiki/docs/api/functions/makeWASocket/#groupinvitecode)
    * [groupJoinApprovalMode()](https://baileys.wiki/docs/api/functions/makeWASocket/#groupjoinapprovalmode)
    * [groupLeave()](https://baileys.wiki/docs/api/functions/makeWASocket/#groupleave)
    * [groupMemberAddMode()](https://baileys.wiki/docs/api/functions/makeWASocket/#groupmemberaddmode)
    * [groupMetadata()](https://baileys.wiki/docs/api/functions/makeWASocket/#groupmetadata)
    * [groupParticipantsUpdate()](https://baileys.wiki/docs/api/functions/makeWASocket/#groupparticipantsupdate)
    * [groupRequestParticipantsList()](https://baileys.wiki/docs/api/functions/makeWASocket/#grouprequestparticipantslist)
    * [groupRequestParticipantsUpdate()](https://baileys.wiki/docs/api/functions/makeWASocket/#grouprequestparticipantsupdate)
    * [groupRevokeInvite()](https://baileys.wiki/docs/api/functions/makeWASocket/#grouprevokeinvite)
    * [groupRevokeInviteV4()](https://baileys.wiki/docs/api/functions/makeWASocket/#grouprevokeinvitev4)
    * [groupSettingUpdate()](https://baileys.wiki/docs/api/functions/makeWASocket/#groupsettingupdate)
    * [groupToggleEphemeral()](https://baileys.wiki/docs/api/functions/makeWASocket/#grouptoggleephemeral)
    * [groupUpdateDescription()](https://baileys.wiki/docs/api/functions/makeWASocket/#groupupdatedescription)
    * [groupUpdateSubject()](https://baileys.wiki/docs/api/functions/makeWASocket/#groupupdatesubject)
    * [logger](https://baileys.wiki/docs/api/functions/makeWASocket/#logger)
    * [logout()](https://baileys.wiki/docs/api/functions/makeWASocket/#logout)
    * [messageRetryManager](https://baileys.wiki/docs/api/functions/makeWASocket/#messageretrymanager)
    * [newsletterAdminCount()](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletteradmincount)
    * [newsletterChangeOwner()](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterchangeowner)
    * [newsletterCreate()](https://baileys.wiki/docs/api/functions/makeWASocket/#newslettercreate)
    * [newsletterDelete()](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterdelete)
    * [newsletterDemote()](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterdemote)
    * [newsletterFetchMessages()](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterfetchmessages)
    * [newsletterFollow()](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterfollow)
    * [newsletterMetadata()](https://baileys.wiki/docs/api/functions/makeWASocket/#newslettermetadata)
    * [newsletterMute()](https://baileys.wiki/docs/api/functions/makeWASocket/#newslettermute)
    * [newsletterReactMessage()](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterreactmessage)
    * [newsletterRemovePicture()](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterremovepicture)
    * [newsletterSubscribers()](https://baileys.wiki/docs/api/functions/makeWASocket/#newslettersubscribers)
    * [newsletterUnfollow()](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterunfollow)
    * [newsletterUnmute()](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterunmute)
    * [newsletterUpdate()](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterupdate)
    * [newsletterUpdateDescription()](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterupdatedescription)
    * [newsletterUpdateName()](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterupdatename)
    * [newsletterUpdatePicture()](https://baileys.wiki/docs/api/functions/makeWASocket/#newsletterupdatepicture)
    * [onUnexpectedError()](https://baileys.wiki/docs/api/functions/makeWASocket/#onunexpectederror)
    * [onWhatsApp()](https://baileys.wiki/docs/api/functions/makeWASocket/#onwhatsapp)
    * [presenceSubscribe()](https://baileys.wiki/docs/api/functions/makeWASocket/#presencesubscribe)
    * [processingMutex](https://baileys.wiki/docs/api/functions/makeWASocket/#processingmutex)
    * [productCreate()](https://baileys.wiki/docs/api/functions/makeWASocket/#productcreate)
    * [productDelete()](https://baileys.wiki/docs/api/functions/makeWASocket/#productdelete)
    * [productUpdate()](https://baileys.wiki/docs/api/functions/makeWASocket/#productupdate)
    * [profilePictureUrl()](https://baileys.wiki/docs/api/functions/makeWASocket/#profilepictureurl)
    * [query()](https://baileys.wiki/docs/api/functions/makeWASocket/#query)
    * [readMessages()](https://baileys.wiki/docs/api/functions/makeWASocket/#readmessages)
    * [refreshMediaConn()](https://baileys.wiki/docs/api/functions/makeWASocket/#refreshmediaconn)
    * [rejectCall()](https://baileys.wiki/docs/api/functions/makeWASocket/#rejectcall)
    * [relayMessage()](https://baileys.wiki/docs/api/functions/makeWASocket/#relaymessage)
    * [removeChatLabel()](https://baileys.wiki/docs/api/functions/makeWASocket/#removechatlabel)
    * [removeContact()](https://baileys.wiki/docs/api/functions/makeWASocket/#removecontact)
    * [removeCoverPhoto()](https://baileys.wiki/docs/api/functions/makeWASocket/#removecoverphoto)
    * [removeMessageLabel()](https://baileys.wiki/docs/api/functions/makeWASocket/#removemessagelabel)
    * [removeProfilePicture()](https://baileys.wiki/docs/api/functions/makeWASocket/#removeprofilepicture)
    * [removeQuickReply()](https://baileys.wiki/docs/api/functions/makeWASocket/#removequickreply)
    * [requestPairingCode()](https://baileys.wiki/docs/api/functions/makeWASocket/#requestpairingcode)
    * [requestPlaceholderResend()](https://baileys.wiki/docs/api/functions/makeWASocket/#requestplaceholderresend)
    * [resyncAppState()](https://baileys.wiki/docs/api/functions/makeWASocket/#resyncappstate)
    * [rotateSignedPreKey()](https://baileys.wiki/docs/api/functions/makeWASocket/#rotatesignedprekey)
    * [sendMessage()](https://baileys.wiki/docs/api/functions/makeWASocket/#sendmessage)
    * [sendMessageAck()](https://baileys.wiki/docs/api/functions/makeWASocket/#sendmessageack)
    * [sendNode()](https://baileys.wiki/docs/api/functions/makeWASocket/#sendnode)
    * [sendPeerDataOperationMessage()](https://baileys.wiki/docs/api/functions/makeWASocket/#sendpeerdataoperationmessage)
    * [sendPresenceUpdate()](https://baileys.wiki/docs/api/functions/makeWASocket/#sendpresenceupdate)
    * [sendRawMessage()](https://baileys.wiki/docs/api/functions/makeWASocket/#sendrawmessage)
    * [sendReceipt()](https://baileys.wiki/docs/api/functions/makeWASocket/#sendreceipt)
    * [sendReceipts()](https://baileys.wiki/docs/api/functions/makeWASocket/#sendreceipts)
    * [sendRetryRequest()](https://baileys.wiki/docs/api/functions/makeWASocket/#sendretryrequest)
    * [sendWAMBuffer()](https://baileys.wiki/docs/api/functions/makeWASocket/#sendwambuffer)
    * [signalRepository](https://baileys.wiki/docs/api/functions/makeWASocket/#signalrepository)
    * [star()](https://baileys.wiki/docs/api/functions/makeWASocket/#star)
    * [subscribeNewsletterUpdates()](https://baileys.wiki/docs/api/functions/makeWASocket/#subscribenewsletterupdates)
    * [type](https://baileys.wiki/docs/api/functions/makeWASocket/#type-7)
    * [updateBlockStatus()](https://baileys.wiki/docs/api/functions/makeWASocket/#updateblockstatus)
    * [updateBussinesProfile()](https://baileys.wiki/docs/api/functions/makeWASocket/#updatebussinesprofile)
    * [updateCallPrivacy()](https://baileys.wiki/docs/api/functions/makeWASocket/#updatecallprivacy)
    * [updateCoverPhoto()](https://baileys.wiki/docs/api/functions/makeWASocket/#updatecoverphoto)
    * [updateDefaultDisappearingMode()](https://baileys.wiki/docs/api/functions/makeWASocket/#updatedefaultdisappearingmode)
    * [updateDisableLinkPreviewsPrivacy()](https://baileys.wiki/docs/api/functions/makeWASocket/#updatedisablelinkpreviewsprivacy)
    * [updateGroupsAddPrivacy()](https://baileys.wiki/docs/api/functions/makeWASocket/#updategroupsaddprivacy)
    * [updateLastSeenPrivacy()](https://baileys.wiki/docs/api/functions/makeWASocket/#updatelastseenprivacy)
    * [updateMediaMessage()](https://baileys.wiki/docs/api/functions/makeWASocket/#updatemediamessage)
    * [updateMessagesPrivacy()](https://baileys.wiki/docs/api/functions/makeWASocket/#updatemessagesprivacy)
    * [updateOnlinePrivacy()](https://baileys.wiki/docs/api/functions/makeWASocket/#updateonlineprivacy)
    * [updateProfileName()](https://baileys.wiki/docs/api/functions/makeWASocket/#updateprofilename)
    * [updateProfilePicture()](https://baileys.wiki/docs/api/functions/makeWASocket/#updateprofilepicture)
    * [updateProfilePicturePrivacy()](https://baileys.wiki/docs/api/functions/makeWASocket/#updateprofilepictureprivacy)
    * [updateProfileStatus()](https://baileys.wiki/docs/api/functions/makeWASocket/#updateprofilestatus)
    * [updateReadReceiptsPrivacy()](https://baileys.wiki/docs/api/functions/makeWASocket/#updatereadreceiptsprivacy)
    * [updateStatusPrivacy()](https://baileys.wiki/docs/api/functions/makeWASocket/#updatestatusprivacy)
    * [uploadPreKeys()](https://baileys.wiki/docs/api/functions/makeWASocket/#uploadprekeys)
    * [uploadPreKeysToServerIfRequired()](https://baileys.wiki/docs/api/functions/makeWASocket/#uploadprekeystoserverifrequired)
    * [upsertMessage()](https://baileys.wiki/docs/api/functions/makeWASocket/#upsertmessage)
    * [user](https://baileys.wiki/docs/api/functions/makeWASocket/#user)
    * [waitForConnectionUpdate()](https://baileys.wiki/docs/api/functions/makeWASocket/#waitforconnectionupdate)
    * [waitForMessage()](https://baileys.wiki/docs/api/functions/makeWASocket/#waitformessage)
    * [waitForSocketOpen()](https://baileys.wiki/docs/api/functions/makeWASocket/#waitforsocketopen)
    * [wamBuffer](https://baileys.wiki/docs/api/functions/makeWASocket/#wambuffer-1)
    * [waUploadToServer](https://baileys.wiki/docs/api/functions/makeWASocket/#wauploadtoserver)
    * [ws](https://baileys.wiki/docs/api/functions/makeWASocket/#ws)


Docs
  * [Tutorial](https://baileys.wiki/docs/intro)


More
  * [GitHub](https://github.com/WhiskeySockets/Baileys)


![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)![](https://baileys.wiki/img/Written-By-Human-Not-By-AI-Badge-white.svg)
Copyright © 2025 Rajeh Taher, WhiskeySockets.
