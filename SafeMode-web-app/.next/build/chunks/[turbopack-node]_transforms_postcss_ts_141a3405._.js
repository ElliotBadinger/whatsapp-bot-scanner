module.exports = [
  '[turbopack-node]/transforms/postcss.ts { CONFIG => "[project]/Development/whatsapp-bot-scanner/SafeMode-web-app/postcss.config.mjs [postcss] (ecmascript)" } [postcss] (ecmascript, async loader)',
  (__turbopack_context__) => {
    __turbopack_context__.v((parentImport) => {
      return Promise.all(
        [
          "chunks/Development_whatsapp-bot-scanner_741921f2._.js",
          "chunks/[root-of-the-server]__ca1afeb2._.js",
        ].map((chunk) => __turbopack_context__.l(chunk)),
      ).then(() => {
        return parentImport(
          '[turbopack-node]/transforms/postcss.ts { CONFIG => "[project]/Development/whatsapp-bot-scanner/SafeMode-web-app/postcss.config.mjs [postcss] (ecmascript)" } [postcss] (ecmascript)',
        );
      });
    });
  },
];
