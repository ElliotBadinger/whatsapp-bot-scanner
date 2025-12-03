module.exports = [
  56637,
  (a, b, c) => {
    "use strict";
    b.exports = a.r(80326).vendored["react-ssr"].React;
  },
  68185,
  (a, b, c) => {
    "use strict";
    b.exports = a.r(80326).vendored.contexts.AppRouterContext;
  },
  71323,
  (a, b, c) => {
    "use strict";
    b.exports = a.r(80326).vendored.contexts.HooksClientContext;
  },
  11102,
  (a, b, c) => {
    "use strict";
    b.exports = a.r(80326).vendored.contexts.ServerInsertedHtml;
  },
  18622,
  (a, b, c) => {
    b.exports = a.x(
      "next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",
      () =>
        require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"),
    );
  },
  56704,
  (a, b, c) => {
    b.exports = a.x(
      "next/dist/server/app-render/work-async-storage.external.js",
      () =>
        require("next/dist/server/app-render/work-async-storage.external.js"),
    );
  },
  32319,
  (a, b, c) => {
    b.exports = a.x(
      "next/dist/server/app-render/work-unit-async-storage.external.js",
      () =>
        require("next/dist/server/app-render/work-unit-async-storage.external.js"),
    );
  },
  20635,
  (a, b, c) => {
    b.exports = a.x(
      "next/dist/server/app-render/action-async-storage.external.js",
      () =>
        require("next/dist/server/app-render/action-async-storage.external.js"),
    );
  },
  80326,
  (a, b, c) => {
    "use strict";
    b.exports = a.r(18622);
  },
  47081,
  (a) => {
    "use strict";
    var b = a.i(56637),
      c = a.i(40858);
    function d(a) {
      return RegExp(`/${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[/?#]|$)`);
    }
    function e(a) {
      return (
        (0, b.useEffect)(() => {
          var b;
          a.beforeSend &&
            (null == (b = window.va) ||
              b.call(window, "beforeSend", a.beforeSend));
        }, [a.beforeSend]),
        (0, b.useEffect)(() => {
          !(function (a = { debug: !0 }) {})({
            framework: a.framework || "react",
            basePath:
              a.basePath ??
              (function () {
                if ("undefined" != typeof process && void 0 !== process.env)
                  return process.env.REACT_APP_VERCEL_OBSERVABILITY_BASEPATH;
              })(),
            ...(void 0 !== a.route && { disableAutoTrack: !0 }),
            ...a,
          });
        }, []),
        (0, b.useEffect)(() => {
          a.route &&
            a.path &&
            (function ({ route: a, path: b }) {
              var c;
              null == (c = window.va) ||
                c.call(window, "pageview", { route: a, path: b });
            })({ route: a.route, path: a.path });
        }, [a.route, a.path]),
        null
      );
    }
    function f(a) {
      let f,
        g,
        h,
        { route: i, path: j } =
          ((f = (0, c.useParams)()),
          (g = (0, c.useSearchParams)()),
          (h = (0, c.usePathname)()),
          f
            ? {
                route: (function (a, b) {
                  if (!a || !b) return a;
                  let c = a;
                  try {
                    let a = Object.entries(b);
                    for (let [b, e] of a)
                      if (!Array.isArray(e)) {
                        let a = d(e);
                        a.test(c) && (c = c.replace(a, `/[${b}]`));
                      }
                    for (let [b, e] of a)
                      if (Array.isArray(e)) {
                        let a = d(e.join("/"));
                        a.test(c) && (c = c.replace(a, `/[...${b}]`));
                      }
                    return c;
                  } catch (b) {
                    return a;
                  }
                })(
                  h,
                  Object.keys(f).length ? f : Object.fromEntries(g.entries()),
                ),
                path: h,
              }
            : { route: null, path: h });
      return b.default.createElement(e, {
        path: j,
        route: i,
        ...a,
        basePath: (function () {
          if ("undefined" != typeof process && void 0 !== process.env)
            return process.env.NEXT_PUBLIC_VERCEL_OBSERVABILITY_BASEPATH;
        })(),
        framework: "next",
      });
    }
    function g(a) {
      return b.default.createElement(
        b.Suspense,
        { fallback: null },
        b.default.createElement(f, { ...a }),
      );
    }
    a.s(["Analytics", () => g]);
  },
];

//# sourceMappingURL=%5Broot-of-the-server%5D__f0f44682._.js.map
