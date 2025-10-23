whatsapp-web.js 1.34.1 &raquo; Source: util/Util.js

        [whatsapp-web.js 1.34.1](index.html)

            # Source: util/Util.js

            ```
&#x27;use strict&#x27;;

const path &#x3D; require(&#x27;path&#x27;);
const Crypto &#x3D; require(&#x27;crypto&#x27;);
const { tmpdir } &#x3D; require(&#x27;os&#x27;);
const ffmpeg &#x3D; require(&#x27;fluent-ffmpeg&#x27;);
const webp &#x3D; require(&#x27;node-webpmux&#x27;);
const fs &#x3D; require(&#x27;fs&#x27;).promises;
const has &#x3D; (o, k) &#x3D;> Object.prototype.hasOwnProperty.call(o, k);

/**
 * Utility methods
 */
class Util {
    constructor() {
        throw new Error(&#x60;The ${this.constructor.name} class may not be instantiated.&#x60;);
    }

    static generateHash(length) {
        var result &#x3D; &#x27;&#x27;;
        var characters &#x3D; &#x27;ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789&#x27;;
        var charactersLength &#x3D; characters.length;
        for (var i &#x3D; 0; i &lt; length; i++) {
            result +&#x3D; characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }

    /**
     * Sets default properties on an object that aren&#x27;t already specified.
     * @param {Object} def Default properties
     * @param {Object} given Object to assign defaults to
     * @returns {Object}
     * @private
     */
    static mergeDefault(def, given) {
        if (!given) return def;
        for (const key in def) {
            if (!has(given, key) || given[key] &#x3D;&#x3D;&#x3D; undefined) {
                given[key] &#x3D; def[key];
            } else if (given[key] &#x3D;&#x3D;&#x3D; Object(given[key])) {
                given[key] &#x3D; Util.mergeDefault(def[key], given[key]);
            }
        }

        return given;
    }

    /**
     * Formats a image to webp
     * @param {MessageMedia} media
     * 
     * @returns {Promise&lt;MessageMedia>} media in webp format
     */
    static async formatImageToWebpSticker(media, pupPage) {
        if (!media.mimetype.includes(&#x27;image&#x27;))
            throw new Error(&#x27;media is not a image&#x27;);

        if (media.mimetype.includes(&#x27;webp&#x27;)) {
            return media;
        }

        return pupPage.evaluate((media) &#x3D;> {
            return window.WWebJS.toStickerData(media);
        }, media);
    }

    /**
     * Formats a video to webp
     * @param {MessageMedia} media
     * 
     * @returns {Promise&lt;MessageMedia>} media in webp format
     */
    static async formatVideoToWebpSticker(media) {
        if (!media.mimetype.includes(&#x27;video&#x27;))
            throw new Error(&#x27;media is not a video&#x27;);

        const videoType &#x3D; media.mimetype.split(&#x27;/&#x27;)[1];

        const tempFile &#x3D; path.join(
            tmpdir(),
            &#x60;${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp&#x60;
        );

        const stream &#x3D; new (require(&#x27;stream&#x27;).Readable)();
        const buffer &#x3D; Buffer.from(
            media.data.replace(&#x60;data:${media.mimetype};base64,&#x60;, &#x27;&#x27;),
            &#x27;base64&#x27;
        );
        stream.push(buffer);
        stream.push(null);

        await new Promise((resolve, reject) &#x3D;> {
            ffmpeg(stream)
                .inputFormat(videoType)
                .on(&#x27;error&#x27;, reject)
                .on(&#x27;end&#x27;, () &#x3D;> resolve(true))
                .addOutputOptions([
                    &#x27;-vcodec&#x27;,
                    &#x27;libwebp&#x27;,
                    &#x27;-vf&#x27;,
                    // eslint-disable-next-line no-useless-escape
                    &#x27;scale&#x3D;\&#x27;iw*min(300/iw\,300/ih)\&#x27;:\&#x27;ih*min(300/iw\,300/ih)\&#x27;,format&#x3D;rgba,pad&#x3D;300:300:\&#x27;(300-iw)/2\&#x27;:\&#x27;(300-ih)/2\&#x27;:\&#x27;#00000000\&#x27;,setsar&#x3D;1,fps&#x3D;10&#x27;,
                    &#x27;-loop&#x27;,
                    &#x27;0&#x27;,
                    &#x27;-ss&#x27;,
                    &#x27;00:00:00.0&#x27;,
                    &#x27;-t&#x27;,
                    &#x27;00:00:05.0&#x27;,
                    &#x27;-preset&#x27;,
                    &#x27;default&#x27;,
                    &#x27;-an&#x27;,
                    &#x27;-vsync&#x27;,
                    &#x27;0&#x27;,
                    &#x27;-s&#x27;,
                    &#x27;512:512&#x27;,
                ])
                .toFormat(&#x27;webp&#x27;)
                .save(tempFile);
        });

        const data &#x3D; await fs.readFile(tempFile, &#x27;base64&#x27;);
        await fs.unlink(tempFile);

        return {
            mimetype: &#x27;image/webp&#x27;,
            data: data,
            filename: media.filename,
        };
    }

    /**
     * Sticker metadata.
     * @typedef {Object} StickerMetadata
     * @property {string} [name] 
     * @property {string} [author] 
     * @property {string[]} [categories]
     */

    /**
     * Formats a media to webp
     * @param {MessageMedia} media
     * @param {StickerMetadata} metadata
     * 
     * @returns {Promise&lt;MessageMedia>} media in webp format
     */
    static async formatToWebpSticker(media, metadata, pupPage) {
        let webpMedia;

        if (media.mimetype.includes(&#x27;image&#x27;))
            webpMedia &#x3D; await this.formatImageToWebpSticker(media, pupPage);
        else if (media.mimetype.includes(&#x27;video&#x27;))
            webpMedia &#x3D; await this.formatVideoToWebpSticker(media);
        else
            throw new Error(&#x27;Invalid media format&#x27;);

        if (metadata.name || metadata.author) {
            const img &#x3D; new webp.Image();
            const hash &#x3D; this.generateHash(32);
            const stickerPackId &#x3D; hash;
            const packname &#x3D; metadata.name;
            const author &#x3D; metadata.author;
            const categories &#x3D; metadata.categories || [&#x27;&#x27;];
            const json &#x3D; { &#x27;sticker-pack-id&#x27;: stickerPackId, &#x27;sticker-pack-name&#x27;: packname, &#x27;sticker-pack-publisher&#x27;: author, &#x27;emojis&#x27;: categories };
            let exifAttr &#x3D; Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
            let jsonBuffer &#x3D; Buffer.from(JSON.stringify(json), &#x27;utf8&#x27;);
            let exif &#x3D; Buffer.concat([exifAttr, jsonBuffer]);
            exif.writeUIntLE(jsonBuffer.length, 14, 4);
            await img.load(Buffer.from(webpMedia.data, &#x27;base64&#x27;));
            img.exif &#x3D; exif;
            webpMedia.data &#x3D; (await img.save(null)).toString(&#x27;base64&#x27;);
        }

        return webpMedia;
    }

    /**
     * Configure ffmpeg path
     * @param {string} path
     */
    static setFfmpegPath(path) {
        ffmpeg.setFfmpegPath(path);
    }
}

module.exports &#x3D; Util;

```

        Generated by [JSDoc](https://github.com/jsdoc3/jsdoc) 3.6.11 on October 23, 2025.