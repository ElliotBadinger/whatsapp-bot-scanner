module.exports = [
  18622,
  (e, t, r) => {
    t.exports = e.x(
      "next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",
      () =>
        require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"),
    );
  },
  56704,
  (e, t, r) => {
    t.exports = e.x(
      "next/dist/server/app-render/work-async-storage.external.js",
      () =>
        require("next/dist/server/app-render/work-async-storage.external.js"),
    );
  },
  32319,
  (e, t, r) => {
    t.exports = e.x(
      "next/dist/server/app-render/work-unit-async-storage.external.js",
      () =>
        require("next/dist/server/app-render/work-unit-async-storage.external.js"),
    );
  },
  93695,
  (e, t, r) => {
    t.exports = e.x("next/dist/shared/lib/no-fallback-error.external.js", () =>
      require("next/dist/shared/lib/no-fallback-error.external.js"),
    );
  },
  57099,
  (e) => {
    "use strict";
    var t = e.i(90724),
      r = e.i(11298),
      a = e.i(12669),
      n = e.i(64029),
      o = e.i(68568),
      i = e.i(80066),
      s = e.i(98898),
      l = e.i(54985),
      d = e.i(49794),
      u = e.i(80505),
      c = e.i(56747),
      p = e.i(2400),
      h = e.i(49283),
      v = e.i(36254),
      x = e.i(46723),
      R = e.i(11481),
      g = e.i(93695);
    e.i(86707);
    var f = e.i(33280);
    let m = [
      { url: "github.com/vercel/next.js", verdict: "SAFE" },
      { url: "bit.ly/3xYz123", verdict: "SCAN" },
      { url: "phishing-site.xyz/login", verdict: "DENY" },
      { url: "docs.google.com/d/abc", verdict: "SAFE" },
      { url: "suspicious-link.ru/click", verdict: "WARN" },
      { url: "linkedin.com/post/456", verdict: "SAFE" },
      { url: "malware-host.net/payload", verdict: "DENY" },
      { url: "youtube.com/watch?v=xyz", verdict: "SAFE" },
    ];
    async function E() {
      let e = new TextEncoder();
      return new Response(
        new ReadableStream({
          async start(t) {
            t.enqueue(
              e.encode(`data: ${JSON.stringify({ type: "connected" })}

`),
            );
            let r = setInterval(
                () => {
                  let r,
                    a =
                      ((r = m[Math.floor(Math.random() * m.length)]),
                      {
                        id: Math.random().toString(36).substring(7),
                        timestamp: new Date().toISOString(),
                        url: r.url,
                        verdict: r.verdict,
                      });
                  t.enqueue(
                    e.encode(`data: ${JSON.stringify(a)}

`),
                  );
                },
                4e3 + 3e3 * Math.random(),
              ),
              a = () => {
                (clearInterval(r), t.close());
              },
              n = setInterval(() => {
                try {
                  t.enqueue(
                    e.encode(`: ping

`),
                  );
                } catch {
                  a();
                }
              }, 3e4);
            setTimeout(() => {
              (clearInterval(n), a());
            }, 3e5);
          },
        }),
        {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        },
      );
    }
    e.s(["GET", () => E], 86445);
    var w = e.i(86445);
    let y = new t.AppRouteRouteModule({
        definition: {
          kind: r.RouteKind.APP_ROUTE,
          page: "/api/feed/route",
          pathname: "/api/feed",
          filename: "route",
          bundlePath: "",
        },
        distDir: ".next",
        relativeProjectDir: "",
        resolvedPagePath:
          "[project]/Development/whatsapp-bot-scanner/SafeMode-web-app/app/api/feed/route.ts",
        nextConfigOutput: "",
        userland: w,
      }),
      { workAsyncStorage: C, workUnitAsyncStorage: b, serverHooks: A } = y;
    function S() {
      return (0, a.patchFetch)({
        workAsyncStorage: C,
        workUnitAsyncStorage: b,
      });
    }
    async function N(e, t, a) {
      y.isDev &&
        (0, n.addRequestMeta)(
          e,
          "devRequestTimingInternalsEnd",
          process.hrtime.bigint(),
        );
      let m = "/api/feed/route";
      m = m.replace(/\/index$/, "") || "/";
      let E = await y.prepare(e, t, { srcPage: m, multiZoneDraftMode: !1 });
      if (!E)
        return (
          (t.statusCode = 400),
          t.end("Bad Request"),
          null == a.waitUntil || a.waitUntil.call(a, Promise.resolve()),
          null
        );
      let {
          buildId: w,
          params: C,
          nextConfig: b,
          parsedUrl: A,
          isDraftMode: S,
          prerenderManifest: N,
          routerServerContext: T,
          isOnDemandRevalidate: O,
          revalidateOnlyGenerated: k,
          resolvedPathname: P,
          clientReferenceManifest: q,
          serverActionsManifest: M,
        } = E,
        I = (0, l.normalizeAppPath)(m),
        _ = !!(N.dynamicRoutes[I] || N.routes[P]),
        D = async () => (
          (null == T ? void 0 : T.render404)
            ? await T.render404(e, t, A, !1)
            : t.end("This page could not be found"),
          null
        );
      if (_ && !S) {
        let e = !!N.routes[P],
          t = N.dynamicRoutes[I];
        if (t && !1 === t.fallback && !e) {
          if (b.experimental.adapterPath) return await D();
          throw new g.NoFallbackError();
        }
      }
      let H = null;
      !_ || y.isDev || S || (H = "/index" === (H = P) ? "/" : H);
      let j = !0 === y.isDev || !_,
        U = _ && !j;
      M &&
        q &&
        (0, i.setReferenceManifestsSingleton)({
          page: m,
          clientReferenceManifest: q,
          serverActionsManifest: M,
          serverModuleMap: (0, s.createServerModuleMap)({
            serverActionsManifest: M,
          }),
        });
      let F = e.method || "GET",
        $ = (0, o.getTracer)(),
        K = $.getActiveScopeSpan(),
        B = {
          params: C,
          prerenderManifest: N,
          renderOpts: {
            experimental: { authInterrupts: !!b.experimental.authInterrupts },
            cacheComponents: !!b.cacheComponents,
            supportsDynamicResponse: j,
            incrementalCache: (0, n.getRequestMeta)(e, "incrementalCache"),
            cacheLifeProfiles: b.cacheLife,
            waitUntil: a.waitUntil,
            onClose: (e) => {
              t.on("close", e);
            },
            onAfterTaskError: void 0,
            onInstrumentationRequestError: (t, r, a) =>
              y.onRequestError(e, t, a, T),
          },
          sharedContext: { buildId: w },
        },
        L = new d.NodeNextRequest(e),
        z = new d.NodeNextResponse(t),
        G = u.NextRequestAdapter.fromNodeNextRequest(
          L,
          (0, u.signalFromNodeResponse)(t),
        );
      try {
        let i = async (e) =>
            y.handle(G, B).finally(() => {
              if (!e) return;
              e.setAttributes({
                "http.status_code": t.statusCode,
                "next.rsc": !1,
              });
              let r = $.getRootSpanAttributes();
              if (!r) return;
              if (r.get("next.span_type") !== c.BaseServerSpan.handleRequest)
                return void console.warn(
                  `Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`,
                );
              let a = r.get("next.route");
              if (a) {
                let t = `${F} ${a}`;
                (e.setAttributes({
                  "next.route": a,
                  "http.route": a,
                  "next.span_name": t,
                }),
                  e.updateName(t));
              } else e.updateName(`${F} ${m}`);
            }),
          s = !!(0, n.getRequestMeta)(e, "minimalMode"),
          l = async (n) => {
            var o, l;
            let d = async ({ previousCacheEntry: r }) => {
                try {
                  if (!s && O && k && !r)
                    return (
                      (t.statusCode = 404),
                      t.setHeader("x-nextjs-cache", "REVALIDATED"),
                      t.end("This page could not be found"),
                      null
                    );
                  let o = await i(n);
                  e.fetchMetrics = B.renderOpts.fetchMetrics;
                  let l = B.renderOpts.pendingWaitUntil;
                  l && a.waitUntil && (a.waitUntil(l), (l = void 0));
                  let d = B.renderOpts.collectedTags;
                  if (!_)
                    return (
                      await (0, h.sendResponse)(
                        L,
                        z,
                        o,
                        B.renderOpts.pendingWaitUntil,
                      ),
                      null
                    );
                  {
                    let e = await o.blob(),
                      t = (0, v.toNodeOutgoingHttpHeaders)(o.headers);
                    (d && (t[R.NEXT_CACHE_TAGS_HEADER] = d),
                      !t["content-type"] &&
                        e.type &&
                        (t["content-type"] = e.type));
                    let r =
                        void 0 !== B.renderOpts.collectedRevalidate &&
                        !(
                          B.renderOpts.collectedRevalidate >= R.INFINITE_CACHE
                        ) &&
                        B.renderOpts.collectedRevalidate,
                      a =
                        void 0 === B.renderOpts.collectedExpire ||
                        B.renderOpts.collectedExpire >= R.INFINITE_CACHE
                          ? void 0
                          : B.renderOpts.collectedExpire;
                    return {
                      value: {
                        kind: f.CachedRouteKind.APP_ROUTE,
                        status: o.status,
                        body: Buffer.from(await e.arrayBuffer()),
                        headers: t,
                      },
                      cacheControl: { revalidate: r, expire: a },
                    };
                  }
                } catch (t) {
                  throw (
                    (null == r ? void 0 : r.isStale) &&
                      (await y.onRequestError(
                        e,
                        t,
                        {
                          routerKind: "App Router",
                          routePath: m,
                          routeType: "route",
                          revalidateReason: (0, p.getRevalidateReason)({
                            isStaticGeneration: U,
                            isOnDemandRevalidate: O,
                          }),
                        },
                        T,
                      )),
                    t
                  );
                }
              },
              u = await y.handleResponse({
                req: e,
                nextConfig: b,
                cacheKey: H,
                routeKind: r.RouteKind.APP_ROUTE,
                isFallback: !1,
                prerenderManifest: N,
                isRoutePPREnabled: !1,
                isOnDemandRevalidate: O,
                revalidateOnlyGenerated: k,
                responseGenerator: d,
                waitUntil: a.waitUntil,
                isMinimalMode: s,
              });
            if (!_) return null;
            if (
              (null == u || null == (o = u.value) ? void 0 : o.kind) !==
              f.CachedRouteKind.APP_ROUTE
            )
              throw Object.defineProperty(
                Error(
                  `Invariant: app-route received invalid cache entry ${null == u || null == (l = u.value) ? void 0 : l.kind}`,
                ),
                "__NEXT_ERROR_CODE",
                { value: "E701", enumerable: !1, configurable: !0 },
              );
            (s ||
              t.setHeader(
                "x-nextjs-cache",
                O
                  ? "REVALIDATED"
                  : u.isMiss
                    ? "MISS"
                    : u.isStale
                      ? "STALE"
                      : "HIT",
              ),
              S &&
                t.setHeader(
                  "Cache-Control",
                  "private, no-cache, no-store, max-age=0, must-revalidate",
                ));
            let c = (0, v.fromNodeOutgoingHttpHeaders)(u.value.headers);
            return (
              (s && _) || c.delete(R.NEXT_CACHE_TAGS_HEADER),
              !u.cacheControl ||
                t.getHeader("Cache-Control") ||
                c.get("Cache-Control") ||
                c.set(
                  "Cache-Control",
                  (0, x.getCacheControlHeader)(u.cacheControl),
                ),
              await (0, h.sendResponse)(
                L,
                z,
                new Response(u.value.body, {
                  headers: c,
                  status: u.value.status || 200,
                }),
              ),
              null
            );
          };
        K
          ? await l(K)
          : await $.withPropagatedContext(e.headers, () =>
              $.trace(
                c.BaseServerSpan.handleRequest,
                {
                  spanName: `${F} ${m}`,
                  kind: o.SpanKind.SERVER,
                  attributes: { "http.method": F, "http.target": e.url },
                },
                l,
              ),
            );
      } catch (t) {
        if (
          (t instanceof g.NoFallbackError ||
            (await y.onRequestError(e, t, {
              routerKind: "App Router",
              routePath: I,
              routeType: "route",
              revalidateReason: (0, p.getRevalidateReason)({
                isStaticGeneration: U,
                isOnDemandRevalidate: O,
              }),
            })),
          _)
        )
          throw t;
        return (
          await (0, h.sendResponse)(L, z, new Response(null, { status: 500 })),
          null
        );
      }
    }
    e.s(
      [
        "handler",
        () => N,
        "patchFetch",
        () => S,
        "routeModule",
        () => y,
        "serverHooks",
        () => A,
        "workAsyncStorage",
        () => C,
        "workUnitAsyncStorage",
        () => b,
      ],
      57099,
    );
  },
];

//# sourceMappingURL=%5Broot-of-the-server%5D__4a9fe360._.js.map
