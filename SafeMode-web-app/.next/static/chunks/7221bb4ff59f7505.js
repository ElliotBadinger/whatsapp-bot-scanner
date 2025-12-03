(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([
  "object" == typeof document ? document.currentScript : void 0,
  72252,
  (e, r, t) => {
    "use strict";
    Object.defineProperty(t, "__esModule", { value: !0 });
    var o = {
      assign: function () {
        return s;
      },
      searchParamsToUrlQuery: function () {
        return l;
      },
      urlQueryToSearchParams: function () {
        return i;
      },
    };
    for (var n in o) Object.defineProperty(t, n, { enumerable: !0, get: o[n] });
    function l(e) {
      let r = {};
      for (let [t, o] of e.entries()) {
        let e = r[t];
        void 0 === e
          ? (r[t] = o)
          : Array.isArray(e)
            ? e.push(o)
            : (r[t] = [e, o]);
      }
      return r;
    }
    function a(e) {
      return "string" == typeof e
        ? e
        : ("number" != typeof e || isNaN(e)) && "boolean" != typeof e
          ? ""
          : String(e);
    }
    function i(e) {
      let r = new URLSearchParams();
      for (let [t, o] of Object.entries(e))
        if (Array.isArray(o)) for (let e of o) r.append(t, a(e));
        else r.set(t, a(o));
      return r;
    }
    function s(e, ...r) {
      for (let t of r) {
        for (let r of t.keys()) e.delete(r);
        for (let [r, o] of t.entries()) e.append(r, o);
      }
      return e;
    }
  },
  83683,
  (e, r, t) => {
    "use strict";
    Object.defineProperty(t, "__esModule", { value: !0 });
    var o = {
      formatUrl: function () {
        return i;
      },
      formatWithValidation: function () {
        return c;
      },
      urlObjectKeys: function () {
        return s;
      },
    };
    for (var n in o) Object.defineProperty(t, n, { enumerable: !0, get: o[n] });
    let l = e.r(73520)._(e.r(72252)),
      a = /https?|ftp|gopher|file/;
    function i(e) {
      let { auth: r, hostname: t } = e,
        o = e.protocol || "",
        n = e.pathname || "",
        i = e.hash || "",
        s = e.query || "",
        c = !1;
      ((r = r ? encodeURIComponent(r).replace(/%3A/i, ":") + "@" : ""),
        e.host
          ? (c = r + e.host)
          : t &&
            ((c = r + (~t.indexOf(":") ? `[${t}]` : t)),
            e.port && (c += ":" + e.port)),
        s && "object" == typeof s && (s = String(l.urlQueryToSearchParams(s))));
      let d = e.search || (s && `?${s}`) || "";
      return (
        o && !o.endsWith(":") && (o += ":"),
        e.slashes || ((!o || a.test(o)) && !1 !== c)
          ? ((c = "//" + (c || "")), n && "/" !== n[0] && (n = "/" + n))
          : c || (c = ""),
        i && "#" !== i[0] && (i = "#" + i),
        d && "?" !== d[0] && (d = "?" + d),
        (n = n.replace(/[?#]/g, encodeURIComponent)),
        (d = d.replace("#", "%23")),
        `${o}${c}${n}${d}${i}`
      );
    }
    let s = [
      "auth",
      "hash",
      "host",
      "hostname",
      "href",
      "path",
      "pathname",
      "port",
      "protocol",
      "query",
      "search",
      "slashes",
    ];
    function c(e) {
      return i(e);
    }
  },
  96154,
  (e, r, t) => {
    "use strict";
    (Object.defineProperty(t, "__esModule", { value: !0 }),
      Object.defineProperty(t, "useMergedRef", {
        enumerable: !0,
        get: function () {
          return n;
        },
      }));
    let o = e.r(16371);
    function n(e, r) {
      let t = (0, o.useRef)(null),
        n = (0, o.useRef)(null);
      return (0, o.useCallback)(
        (o) => {
          if (null === o) {
            let e = t.current;
            e && ((t.current = null), e());
            let r = n.current;
            r && ((n.current = null), r());
          } else (e && (t.current = l(e, o)), r && (n.current = l(r, o)));
        },
        [e, r],
      );
    }
    function l(e, r) {
      if ("function" != typeof e)
        return (
          (e.current = r),
          () => {
            e.current = null;
          }
        );
      {
        let t = e(r);
        return "function" == typeof t ? t : () => e(null);
      }
    }
    ("function" == typeof t.default ||
      ("object" == typeof t.default && null !== t.default)) &&
      void 0 === t.default.__esModule &&
      (Object.defineProperty(t.default, "__esModule", { value: !0 }),
      Object.assign(t.default, t),
      (r.exports = t.default));
  },
  82192,
  (e, r, t) => {
    "use strict";
    Object.defineProperty(t, "__esModule", { value: !0 });
    var o = {
      DecodeError: function () {
        return h;
      },
      MiddlewareNotFoundError: function () {
        return w;
      },
      MissingStaticPage: function () {
        return v;
      },
      NormalizeError: function () {
        return y;
      },
      PageNotFoundError: function () {
        return x;
      },
      SP: function () {
        return m;
      },
      ST: function () {
        return g;
      },
      WEB_VITALS: function () {
        return l;
      },
      execOnce: function () {
        return a;
      },
      getDisplayName: function () {
        return u;
      },
      getLocationOrigin: function () {
        return c;
      },
      getURL: function () {
        return d;
      },
      isAbsoluteUrl: function () {
        return s;
      },
      isResSent: function () {
        return p;
      },
      loadGetInitialProps: function () {
        return b;
      },
      normalizeRepeatedSlashes: function () {
        return f;
      },
      stringifyError: function () {
        return k;
      },
    };
    for (var n in o) Object.defineProperty(t, n, { enumerable: !0, get: o[n] });
    let l = ["CLS", "FCP", "FID", "INP", "LCP", "TTFB"];
    function a(e) {
      let r,
        t = !1;
      return (...o) => (t || ((t = !0), (r = e(...o))), r);
    }
    let i = /^[a-zA-Z][a-zA-Z\d+\-.]*?:/,
      s = (e) => i.test(e);
    function c() {
      let { protocol: e, hostname: r, port: t } = window.location;
      return `${e}//${r}${t ? ":" + t : ""}`;
    }
    function d() {
      let { href: e } = window.location,
        r = c();
      return e.substring(r.length);
    }
    function u(e) {
      return "string" == typeof e ? e : e.displayName || e.name || "Unknown";
    }
    function p(e) {
      return e.finished || e.headersSent;
    }
    function f(e) {
      let r = e.split("?");
      return (
        r[0].replace(/\\/g, "/").replace(/\/\/+/g, "/") +
        (r[1] ? `?${r.slice(1).join("?")}` : "")
      );
    }
    async function b(e, r) {
      let t = r.res || (r.ctx && r.ctx.res);
      if (!e.getInitialProps)
        return r.ctx && r.Component
          ? { pageProps: await b(r.Component, r.ctx) }
          : {};
      let o = await e.getInitialProps(r);
      if (t && p(t)) return o;
      if (!o)
        throw Object.defineProperty(
          Error(
            `"${u(e)}.getInitialProps()" should resolve to an object. But found "${o}" instead.`,
          ),
          "__NEXT_ERROR_CODE",
          { value: "E394", enumerable: !1, configurable: !0 },
        );
      return o;
    }
    let m = "undefined" != typeof performance,
      g =
        m &&
        ["mark", "measure", "getEntriesByName"].every(
          (e) => "function" == typeof performance[e],
        );
    class h extends Error {}
    class y extends Error {}
    class x extends Error {
      constructor(e) {
        (super(),
          (this.code = "ENOENT"),
          (this.name = "PageNotFoundError"),
          (this.message = `Cannot find module for page: ${e}`));
      }
    }
    class v extends Error {
      constructor(e, r) {
        (super(),
          (this.message = `Failed to load static file for page: ${e} ${r}`));
      }
    }
    class w extends Error {
      constructor() {
        (super(),
          (this.code = "ENOENT"),
          (this.message = "Cannot find the middleware module"));
      }
    }
    function k(e) {
      return JSON.stringify({ message: e.message, stack: e.stack });
    }
  },
  34188,
  (e, r, t) => {
    "use strict";
    (Object.defineProperty(t, "__esModule", { value: !0 }),
      Object.defineProperty(t, "isLocalURL", {
        enumerable: !0,
        get: function () {
          return l;
        },
      }));
    let o = e.r(82192),
      n = e.r(65898);
    function l(e) {
      if (!(0, o.isAbsoluteUrl)(e)) return !0;
      try {
        let r = (0, o.getLocationOrigin)(),
          t = new URL(e, r);
        return t.origin === r && (0, n.hasBasePath)(t.pathname);
      } catch (e) {
        return !1;
      }
    }
  },
  86054,
  (e, r, t) => {
    "use strict";
    (Object.defineProperty(t, "__esModule", { value: !0 }),
      Object.defineProperty(t, "errorOnce", {
        enumerable: !0,
        get: function () {
          return o;
        },
      }));
    let o = (e) => {};
  },
  23291,
  (e, r, t) => {
    "use strict";
    Object.defineProperty(t, "__esModule", { value: !0 });
    var o = {
      default: function () {
        return h;
      },
      useLinkStatus: function () {
        return x;
      },
    };
    for (var n in o) Object.defineProperty(t, n, { enumerable: !0, get: o[n] });
    let l = e.r(73520),
      a = e.r(66808),
      i = l._(e.r(16371)),
      s = e.r(83683),
      c = e.r(32019),
      d = e.r(96154),
      u = e.r(82192),
      p = e.r(46320);
    e.r(83661);
    let f = e.r(3440),
      b = e.r(34188),
      m = e.r(12372);
    function g(e) {
      return "string" == typeof e ? e : (0, s.formatUrl)(e);
    }
    function h(r) {
      var t;
      let o,
        n,
        l,
        [s, h] = (0, i.useOptimistic)(f.IDLE_LINK_STATUS),
        x = (0, i.useRef)(null),
        {
          href: v,
          as: w,
          children: k,
          prefetch: j = null,
          passHref: P,
          replace: _,
          shallow: z,
          scroll: E,
          onClick: O,
          onMouseEnter: S,
          onTouchStart: C,
          legacyBehavior: N = !1,
          onNavigate: T,
          ref: M,
          unstable_dynamicOnHover: R,
          ...I
        } = r;
      ((o = k),
        N &&
          ("string" == typeof o || "number" == typeof o) &&
          (o = (0, a.jsx)("a", { children: o })));
      let $ = i.default.useContext(c.AppRouterContext),
        A = !1 !== j,
        L =
          !1 !== j
            ? null === (t = j) || "auto" === t
              ? m.FetchStrategy.PPR
              : m.FetchStrategy.Full
            : m.FetchStrategy.PPR,
        { href: U, as: D } = i.default.useMemo(() => {
          let e = g(v);
          return { href: e, as: w ? g(w) : e };
        }, [v, w]);
      if (N) {
        if (o?.$$typeof === Symbol.for("react.lazy"))
          throw Object.defineProperty(
            Error(
              "`<Link legacyBehavior>` received a direct child that is either a Server Component, or JSX that was loaded with React.lazy(). This is not supported. Either remove legacyBehavior, or make the direct child a Client Component that renders the Link's `<a>` tag.",
            ),
            "__NEXT_ERROR_CODE",
            { value: "E863", enumerable: !1, configurable: !0 },
          );
        n = i.default.Children.only(o);
      }
      let F = N ? n && "object" == typeof n && n.ref : M,
        G = i.default.useCallback(
          (e) => (
            null !== $ &&
              (x.current = (0, f.mountLinkInstance)(e, U, $, L, A, h)),
            () => {
              (x.current &&
                ((0, f.unmountLinkForCurrentNavigation)(x.current),
                (x.current = null)),
                (0, f.unmountPrefetchableInstance)(e));
            }
          ),
          [A, U, $, L, h],
        ),
        B = {
          ref: (0, d.useMergedRef)(G, F),
          onClick(r) {
            (N || "function" != typeof O || O(r),
              N &&
                n.props &&
                "function" == typeof n.props.onClick &&
                n.props.onClick(r),
              !$ ||
                r.defaultPrevented ||
                (function (r, t, o, n, l, a, s) {
                  if ("undefined" != typeof window) {
                    let c,
                      { nodeName: d } = r.currentTarget;
                    if (
                      ("A" === d.toUpperCase() &&
                        (((c = r.currentTarget.getAttribute("target")) &&
                          "_self" !== c) ||
                          r.metaKey ||
                          r.ctrlKey ||
                          r.shiftKey ||
                          r.altKey ||
                          (r.nativeEvent && 2 === r.nativeEvent.which))) ||
                      r.currentTarget.hasAttribute("download")
                    )
                      return;
                    if (!(0, b.isLocalURL)(t)) {
                      l && (r.preventDefault(), location.replace(t));
                      return;
                    }
                    if ((r.preventDefault(), s)) {
                      let e = !1;
                      if (
                        (s({
                          preventDefault: () => {
                            e = !0;
                          },
                        }),
                        e)
                      )
                        return;
                    }
                    let { dispatchNavigateAction: u } = e.r(84435);
                    i.default.startTransition(() => {
                      u(o || t, l ? "replace" : "push", a ?? !0, n.current);
                    });
                  }
                })(r, U, D, x, _, E, T));
          },
          onMouseEnter(e) {
            (N || "function" != typeof S || S(e),
              N &&
                n.props &&
                "function" == typeof n.props.onMouseEnter &&
                n.props.onMouseEnter(e),
              $ && A && (0, f.onNavigationIntent)(e.currentTarget, !0 === R));
          },
          onTouchStart: function (e) {
            (N || "function" != typeof C || C(e),
              N &&
                n.props &&
                "function" == typeof n.props.onTouchStart &&
                n.props.onTouchStart(e),
              $ && A && (0, f.onNavigationIntent)(e.currentTarget, !0 === R));
          },
        };
      return (
        (0, u.isAbsoluteUrl)(D)
          ? (B.href = D)
          : (N && !P && ("a" !== n.type || "href" in n.props)) ||
            (B.href = (0, p.addBasePath)(D)),
        (l = N
          ? i.default.cloneElement(n, B)
          : (0, a.jsx)("a", { ...I, ...B, children: o })),
        (0, a.jsx)(y.Provider, { value: s, children: l })
      );
    }
    e.r(86054);
    let y = (0, i.createContext)(f.IDLE_LINK_STATUS),
      x = () => (0, i.useContext)(y);
    ("function" == typeof t.default ||
      ("object" == typeof t.default && null !== t.default)) &&
      void 0 === t.default.__esModule &&
      (Object.defineProperty(t.default, "__esModule", { value: !0 }),
      Object.assign(t.default, t),
      (r.exports = t.default));
  },
  97202,
  10266,
  (e) => {
    "use strict";
    function r() {
      for (var e, r, t = 0, o = "", n = arguments.length; t < n; t++)
        (e = arguments[t]) &&
          (r = (function e(r) {
            var t,
              o,
              n = "";
            if ("string" == typeof r || "number" == typeof r) n += r;
            else if ("object" == typeof r)
              if (Array.isArray(r)) {
                var l = r.length;
                for (t = 0; t < l; t++)
                  r[t] && (o = e(r[t])) && (n && (n += " "), (n += o));
              } else for (o in r) r[o] && (n && (n += " "), (n += o));
            return n;
          })(e)) &&
          (o && (o += " "), (o += r));
      return o;
    }
    e.s(["clsx", () => r], 10266);
    let t = (e, r) => {
        if (0 === e.length) return r.classGroupId;
        let o = e[0],
          n = r.nextPart.get(o),
          l = n ? t(e.slice(1), n) : void 0;
        if (l) return l;
        if (0 === r.validators.length) return;
        let a = e.join("-");
        return r.validators.find(({ validator: e }) => e(a))?.classGroupId;
      },
      o = /^\[(.+)\]$/,
      n = (e, r, t, o) => {
        e.forEach((e) => {
          if ("string" == typeof e) {
            ("" === e ? r : l(r, e)).classGroupId = t;
            return;
          }
          "function" == typeof e
            ? a(e)
              ? n(e(o), r, t, o)
              : r.validators.push({ validator: e, classGroupId: t })
            : Object.entries(e).forEach(([e, a]) => {
                n(a, l(r, e), t, o);
              });
        });
      },
      l = (e, r) => {
        let t = e;
        return (
          r.split("-").forEach((e) => {
            (t.nextPart.has(e) ||
              t.nextPart.set(e, { nextPart: new Map(), validators: [] }),
              (t = t.nextPart.get(e)));
          }),
          t
        );
      },
      a = (e) => e.isThemeGetter,
      i = (e, r) =>
        r
          ? e.map(([e, t]) => [
              e,
              t.map((e) =>
                "string" == typeof e
                  ? r + e
                  : "object" == typeof e
                    ? Object.fromEntries(
                        Object.entries(e).map(([e, t]) => [r + e, t]),
                      )
                    : e,
              ),
            ])
          : e,
      s = (e) => {
        if (e.length <= 1) return e;
        let r = [],
          t = [];
        return (
          e.forEach((e) => {
            "[" === e[0] ? (r.push(...t.sort(), e), (t = [])) : t.push(e);
          }),
          r.push(...t.sort()),
          r
        );
      },
      c = /\s+/;
    function d() {
      let e,
        r,
        t = 0,
        o = "";
      for (; t < arguments.length; )
        (e = arguments[t++]) && (r = u(e)) && (o && (o += " "), (o += r));
      return o;
    }
    let u = (e) => {
        let r;
        if ("string" == typeof e) return e;
        let t = "";
        for (let o = 0; o < e.length; o++)
          e[o] && (r = u(e[o])) && (t && (t += " "), (t += r));
        return t;
      },
      p = (e) => {
        let r = (r) => r[e] || [];
        return ((r.isThemeGetter = !0), r);
      },
      f = /^\[(?:([a-z-]+):)?(.+)\]$/i,
      b = /^\d+\/\d+$/,
      m = new Set(["px", "full", "screen"]),
      g = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/,
      h =
        /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/,
      y = /^(rgba?|hsla?|hwb|(ok)?(lab|lch))\(.+\)$/,
      x = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/,
      v =
        /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/,
      w = (e) => j(e) || m.has(e) || b.test(e),
      k = (e) => $(e, "length", A),
      j = (e) => !!e && !Number.isNaN(Number(e)),
      P = (e) => $(e, "number", j),
      _ = (e) => !!e && Number.isInteger(Number(e)),
      z = (e) => e.endsWith("%") && j(e.slice(0, -1)),
      E = (e) => f.test(e),
      O = (e) => g.test(e),
      S = new Set(["length", "size", "percentage"]),
      C = (e) => $(e, S, L),
      N = (e) => $(e, "position", L),
      T = new Set(["image", "url"]),
      M = (e) => $(e, T, D),
      R = (e) => $(e, "", U),
      I = () => !0,
      $ = (e, r, t) => {
        let o = f.exec(e);
        return (
          !!o &&
          (o[1] ? ("string" == typeof r ? o[1] === r : r.has(o[1])) : t(o[2]))
        );
      },
      A = (e) => h.test(e) && !y.test(e),
      L = () => !1,
      U = (e) => x.test(e),
      D = (e) => v.test(e),
      F = (function (e, ...r) {
        let l,
          a,
          u,
          p = function (s) {
            let c;
            return (
              (a = (l = {
                cache: ((e) => {
                  if (e < 1) return { get: () => void 0, set: () => {} };
                  let r = 0,
                    t = new Map(),
                    o = new Map(),
                    n = (n, l) => {
                      (t.set(n, l),
                        ++r > e && ((r = 0), (o = t), (t = new Map())));
                    };
                  return {
                    get(e) {
                      let r = t.get(e);
                      return void 0 !== r
                        ? r
                        : void 0 !== (r = o.get(e))
                          ? (n(e, r), r)
                          : void 0;
                    },
                    set(e, r) {
                      t.has(e) ? t.set(e, r) : n(e, r);
                    },
                  };
                })((c = r.reduce((e, r) => r(e), e())).cacheSize),
                parseClassName: ((e) => {
                  let { separator: r, experimentalParseClassName: t } = e,
                    o = 1 === r.length,
                    n = r[0],
                    l = r.length,
                    a = (e) => {
                      let t,
                        a = [],
                        i = 0,
                        s = 0;
                      for (let c = 0; c < e.length; c++) {
                        let d = e[c];
                        if (0 === i) {
                          if (d === n && (o || e.slice(c, c + l) === r)) {
                            (a.push(e.slice(s, c)), (s = c + l));
                            continue;
                          }
                          if ("/" === d) {
                            t = c;
                            continue;
                          }
                        }
                        "[" === d ? i++ : "]" === d && i--;
                      }
                      let c = 0 === a.length ? e : e.substring(s),
                        d = c.startsWith("!"),
                        u = d ? c.substring(1) : c;
                      return {
                        modifiers: a,
                        hasImportantModifier: d,
                        baseClassName: u,
                        maybePostfixModifierPosition:
                          t && t > s ? t - s : void 0,
                      };
                    };
                  return t ? (e) => t({ className: e, parseClassName: a }) : a;
                })(c),
                ...((e) => {
                  let r = ((e) => {
                      let { theme: r, prefix: t } = e,
                        o = { nextPart: new Map(), validators: [] };
                      return (
                        i(Object.entries(e.classGroups), t).forEach(
                          ([e, t]) => {
                            n(t, o, e, r);
                          },
                        ),
                        o
                      );
                    })(e),
                    {
                      conflictingClassGroups: l,
                      conflictingClassGroupModifiers: a,
                    } = e;
                  return {
                    getClassGroupId: (e) => {
                      let n = e.split("-");
                      return (
                        "" === n[0] && 1 !== n.length && n.shift(),
                        t(n, r) ||
                          ((e) => {
                            if (o.test(e)) {
                              let r = o.exec(e)[1],
                                t = r?.substring(0, r.indexOf(":"));
                              if (t) return "arbitrary.." + t;
                            }
                          })(e)
                      );
                    },
                    getConflictingClassGroupIds: (e, r) => {
                      let t = l[e] || [];
                      return r && a[e] ? [...t, ...a[e]] : t;
                    },
                  };
                })(c),
              }).cache.get),
              (u = l.cache.set),
              (p = f),
              f(s)
            );
          };
        function f(e) {
          let r = a(e);
          if (r) return r;
          let t = ((e, r) => {
            let {
                parseClassName: t,
                getClassGroupId: o,
                getConflictingClassGroupIds: n,
              } = r,
              l = [],
              a = e.trim().split(c),
              i = "";
            for (let e = a.length - 1; e >= 0; e -= 1) {
              let r = a[e],
                {
                  modifiers: c,
                  hasImportantModifier: d,
                  baseClassName: u,
                  maybePostfixModifierPosition: p,
                } = t(r),
                f = !!p,
                b = o(f ? u.substring(0, p) : u);
              if (!b) {
                if (!f || !(b = o(u))) {
                  i = r + (i.length > 0 ? " " + i : i);
                  continue;
                }
                f = !1;
              }
              let m = s(c).join(":"),
                g = d ? m + "!" : m,
                h = g + b;
              if (l.includes(h)) continue;
              l.push(h);
              let y = n(b, f);
              for (let e = 0; e < y.length; ++e) {
                let r = y[e];
                l.push(g + r);
              }
              i = r + (i.length > 0 ? " " + i : i);
            }
            return i;
          })(e, l);
          return (u(e, t), t);
        }
        return function () {
          return p(d.apply(null, arguments));
        };
      })(() => {
        let e = p("colors"),
          r = p("spacing"),
          t = p("blur"),
          o = p("brightness"),
          n = p("borderColor"),
          l = p("borderRadius"),
          a = p("borderSpacing"),
          i = p("borderWidth"),
          s = p("contrast"),
          c = p("grayscale"),
          d = p("hueRotate"),
          u = p("invert"),
          f = p("gap"),
          b = p("gradientColorStops"),
          m = p("gradientColorStopPositions"),
          g = p("inset"),
          h = p("margin"),
          y = p("opacity"),
          x = p("padding"),
          v = p("saturate"),
          S = p("scale"),
          T = p("sepia"),
          $ = p("skew"),
          A = p("space"),
          L = p("translate"),
          U = () => ["auto", "contain", "none"],
          D = () => ["auto", "hidden", "clip", "visible", "scroll"],
          F = () => ["auto", E, r],
          G = () => [E, r],
          B = () => ["", w, k],
          K = () => ["auto", j, E],
          W = () => [
            "bottom",
            "center",
            "left",
            "left-bottom",
            "left-top",
            "right",
            "right-bottom",
            "right-top",
            "top",
          ],
          q = () => ["solid", "dashed", "dotted", "double", "none"],
          Q = () => [
            "normal",
            "multiply",
            "screen",
            "overlay",
            "darken",
            "lighten",
            "color-dodge",
            "color-burn",
            "hard-light",
            "soft-light",
            "difference",
            "exclusion",
            "hue",
            "saturation",
            "color",
            "luminosity",
          ],
          X = () => [
            "start",
            "end",
            "center",
            "between",
            "around",
            "evenly",
            "stretch",
          ],
          J = () => ["", "0", E],
          V = () => [
            "auto",
            "avoid",
            "all",
            "avoid-page",
            "page",
            "left",
            "right",
            "column",
          ],
          Y = () => [j, E];
        return {
          cacheSize: 500,
          separator: ":",
          theme: {
            colors: [I],
            spacing: [w, k],
            blur: ["none", "", O, E],
            brightness: Y(),
            borderColor: [e],
            borderRadius: ["none", "", "full", O, E],
            borderSpacing: G(),
            borderWidth: B(),
            contrast: Y(),
            grayscale: J(),
            hueRotate: Y(),
            invert: J(),
            gap: G(),
            gradientColorStops: [e],
            gradientColorStopPositions: [z, k],
            inset: F(),
            margin: F(),
            opacity: Y(),
            padding: G(),
            saturate: Y(),
            scale: Y(),
            sepia: J(),
            skew: Y(),
            space: G(),
            translate: G(),
          },
          classGroups: {
            aspect: [{ aspect: ["auto", "square", "video", E] }],
            container: ["container"],
            columns: [{ columns: [O] }],
            "break-after": [{ "break-after": V() }],
            "break-before": [{ "break-before": V() }],
            "break-inside": [
              {
                "break-inside": ["auto", "avoid", "avoid-page", "avoid-column"],
              },
            ],
            "box-decoration": [{ "box-decoration": ["slice", "clone"] }],
            box: [{ box: ["border", "content"] }],
            display: [
              "block",
              "inline-block",
              "inline",
              "flex",
              "inline-flex",
              "table",
              "inline-table",
              "table-caption",
              "table-cell",
              "table-column",
              "table-column-group",
              "table-footer-group",
              "table-header-group",
              "table-row-group",
              "table-row",
              "flow-root",
              "grid",
              "inline-grid",
              "contents",
              "list-item",
              "hidden",
            ],
            float: [{ float: ["right", "left", "none", "start", "end"] }],
            clear: [
              { clear: ["left", "right", "both", "none", "start", "end"] },
            ],
            isolation: ["isolate", "isolation-auto"],
            "object-fit": [
              { object: ["contain", "cover", "fill", "none", "scale-down"] },
            ],
            "object-position": [{ object: [...W(), E] }],
            overflow: [{ overflow: D() }],
            "overflow-x": [{ "overflow-x": D() }],
            "overflow-y": [{ "overflow-y": D() }],
            overscroll: [{ overscroll: U() }],
            "overscroll-x": [{ "overscroll-x": U() }],
            "overscroll-y": [{ "overscroll-y": U() }],
            position: ["static", "fixed", "absolute", "relative", "sticky"],
            inset: [{ inset: [g] }],
            "inset-x": [{ "inset-x": [g] }],
            "inset-y": [{ "inset-y": [g] }],
            start: [{ start: [g] }],
            end: [{ end: [g] }],
            top: [{ top: [g] }],
            right: [{ right: [g] }],
            bottom: [{ bottom: [g] }],
            left: [{ left: [g] }],
            visibility: ["visible", "invisible", "collapse"],
            z: [{ z: ["auto", _, E] }],
            basis: [{ basis: F() }],
            "flex-direction": [
              { flex: ["row", "row-reverse", "col", "col-reverse"] },
            ],
            "flex-wrap": [{ flex: ["wrap", "wrap-reverse", "nowrap"] }],
            flex: [{ flex: ["1", "auto", "initial", "none", E] }],
            grow: [{ grow: J() }],
            shrink: [{ shrink: J() }],
            order: [{ order: ["first", "last", "none", _, E] }],
            "grid-cols": [{ "grid-cols": [I] }],
            "col-start-end": [{ col: ["auto", { span: ["full", _, E] }, E] }],
            "col-start": [{ "col-start": K() }],
            "col-end": [{ "col-end": K() }],
            "grid-rows": [{ "grid-rows": [I] }],
            "row-start-end": [{ row: ["auto", { span: [_, E] }, E] }],
            "row-start": [{ "row-start": K() }],
            "row-end": [{ "row-end": K() }],
            "grid-flow": [
              {
                "grid-flow": ["row", "col", "dense", "row-dense", "col-dense"],
              },
            ],
            "auto-cols": [{ "auto-cols": ["auto", "min", "max", "fr", E] }],
            "auto-rows": [{ "auto-rows": ["auto", "min", "max", "fr", E] }],
            gap: [{ gap: [f] }],
            "gap-x": [{ "gap-x": [f] }],
            "gap-y": [{ "gap-y": [f] }],
            "justify-content": [{ justify: ["normal", ...X()] }],
            "justify-items": [
              { "justify-items": ["start", "end", "center", "stretch"] },
            ],
            "justify-self": [
              { "justify-self": ["auto", "start", "end", "center", "stretch"] },
            ],
            "align-content": [{ content: ["normal", ...X(), "baseline"] }],
            "align-items": [
              { items: ["start", "end", "center", "baseline", "stretch"] },
            ],
            "align-self": [
              {
                self: ["auto", "start", "end", "center", "stretch", "baseline"],
              },
            ],
            "place-content": [{ "place-content": [...X(), "baseline"] }],
            "place-items": [
              {
                "place-items": [
                  "start",
                  "end",
                  "center",
                  "baseline",
                  "stretch",
                ],
              },
            ],
            "place-self": [
              { "place-self": ["auto", "start", "end", "center", "stretch"] },
            ],
            p: [{ p: [x] }],
            px: [{ px: [x] }],
            py: [{ py: [x] }],
            ps: [{ ps: [x] }],
            pe: [{ pe: [x] }],
            pt: [{ pt: [x] }],
            pr: [{ pr: [x] }],
            pb: [{ pb: [x] }],
            pl: [{ pl: [x] }],
            m: [{ m: [h] }],
            mx: [{ mx: [h] }],
            my: [{ my: [h] }],
            ms: [{ ms: [h] }],
            me: [{ me: [h] }],
            mt: [{ mt: [h] }],
            mr: [{ mr: [h] }],
            mb: [{ mb: [h] }],
            ml: [{ ml: [h] }],
            "space-x": [{ "space-x": [A] }],
            "space-x-reverse": ["space-x-reverse"],
            "space-y": [{ "space-y": [A] }],
            "space-y-reverse": ["space-y-reverse"],
            w: [
              { w: ["auto", "min", "max", "fit", "svw", "lvw", "dvw", E, r] },
            ],
            "min-w": [{ "min-w": [E, r, "min", "max", "fit"] }],
            "max-w": [
              {
                "max-w": [
                  E,
                  r,
                  "none",
                  "full",
                  "min",
                  "max",
                  "fit",
                  "prose",
                  { screen: [O] },
                  O,
                ],
              },
            ],
            h: [
              { h: [E, r, "auto", "min", "max", "fit", "svh", "lvh", "dvh"] },
            ],
            "min-h": [
              { "min-h": [E, r, "min", "max", "fit", "svh", "lvh", "dvh"] },
            ],
            "max-h": [
              { "max-h": [E, r, "min", "max", "fit", "svh", "lvh", "dvh"] },
            ],
            size: [{ size: [E, r, "auto", "min", "max", "fit"] }],
            "font-size": [{ text: ["base", O, k] }],
            "font-smoothing": ["antialiased", "subpixel-antialiased"],
            "font-style": ["italic", "not-italic"],
            "font-weight": [
              {
                font: [
                  "thin",
                  "extralight",
                  "light",
                  "normal",
                  "medium",
                  "semibold",
                  "bold",
                  "extrabold",
                  "black",
                  P,
                ],
              },
            ],
            "font-family": [{ font: [I] }],
            "fvn-normal": ["normal-nums"],
            "fvn-ordinal": ["ordinal"],
            "fvn-slashed-zero": ["slashed-zero"],
            "fvn-figure": ["lining-nums", "oldstyle-nums"],
            "fvn-spacing": ["proportional-nums", "tabular-nums"],
            "fvn-fraction": ["diagonal-fractions", "stacked-fractions"],
            tracking: [
              {
                tracking: [
                  "tighter",
                  "tight",
                  "normal",
                  "wide",
                  "wider",
                  "widest",
                  E,
                ],
              },
            ],
            "line-clamp": [{ "line-clamp": ["none", j, P] }],
            leading: [
              {
                leading: [
                  "none",
                  "tight",
                  "snug",
                  "normal",
                  "relaxed",
                  "loose",
                  w,
                  E,
                ],
              },
            ],
            "list-image": [{ "list-image": ["none", E] }],
            "list-style-type": [{ list: ["none", "disc", "decimal", E] }],
            "list-style-position": [{ list: ["inside", "outside"] }],
            "placeholder-color": [{ placeholder: [e] }],
            "placeholder-opacity": [{ "placeholder-opacity": [y] }],
            "text-alignment": [
              { text: ["left", "center", "right", "justify", "start", "end"] },
            ],
            "text-color": [{ text: [e] }],
            "text-opacity": [{ "text-opacity": [y] }],
            "text-decoration": [
              "underline",
              "overline",
              "line-through",
              "no-underline",
            ],
            "text-decoration-style": [{ decoration: [...q(), "wavy"] }],
            "text-decoration-thickness": [
              { decoration: ["auto", "from-font", w, k] },
            ],
            "underline-offset": [{ "underline-offset": ["auto", w, E] }],
            "text-decoration-color": [{ decoration: [e] }],
            "text-transform": [
              "uppercase",
              "lowercase",
              "capitalize",
              "normal-case",
            ],
            "text-overflow": ["truncate", "text-ellipsis", "text-clip"],
            "text-wrap": [{ text: ["wrap", "nowrap", "balance", "pretty"] }],
            indent: [{ indent: G() }],
            "vertical-align": [
              {
                align: [
                  "baseline",
                  "top",
                  "middle",
                  "bottom",
                  "text-top",
                  "text-bottom",
                  "sub",
                  "super",
                  E,
                ],
              },
            ],
            whitespace: [
              {
                whitespace: [
                  "normal",
                  "nowrap",
                  "pre",
                  "pre-line",
                  "pre-wrap",
                  "break-spaces",
                ],
              },
            ],
            break: [{ break: ["normal", "words", "all", "keep"] }],
            hyphens: [{ hyphens: ["none", "manual", "auto"] }],
            content: [{ content: ["none", E] }],
            "bg-attachment": [{ bg: ["fixed", "local", "scroll"] }],
            "bg-clip": [
              { "bg-clip": ["border", "padding", "content", "text"] },
            ],
            "bg-opacity": [{ "bg-opacity": [y] }],
            "bg-origin": [{ "bg-origin": ["border", "padding", "content"] }],
            "bg-position": [{ bg: [...W(), N] }],
            "bg-repeat": [
              {
                bg: ["no-repeat", { repeat: ["", "x", "y", "round", "space"] }],
              },
            ],
            "bg-size": [{ bg: ["auto", "cover", "contain", C] }],
            "bg-image": [
              {
                bg: [
                  "none",
                  {
                    "gradient-to": ["t", "tr", "r", "br", "b", "bl", "l", "tl"],
                  },
                  M,
                ],
              },
            ],
            "bg-color": [{ bg: [e] }],
            "gradient-from-pos": [{ from: [m] }],
            "gradient-via-pos": [{ via: [m] }],
            "gradient-to-pos": [{ to: [m] }],
            "gradient-from": [{ from: [b] }],
            "gradient-via": [{ via: [b] }],
            "gradient-to": [{ to: [b] }],
            rounded: [{ rounded: [l] }],
            "rounded-s": [{ "rounded-s": [l] }],
            "rounded-e": [{ "rounded-e": [l] }],
            "rounded-t": [{ "rounded-t": [l] }],
            "rounded-r": [{ "rounded-r": [l] }],
            "rounded-b": [{ "rounded-b": [l] }],
            "rounded-l": [{ "rounded-l": [l] }],
            "rounded-ss": [{ "rounded-ss": [l] }],
            "rounded-se": [{ "rounded-se": [l] }],
            "rounded-ee": [{ "rounded-ee": [l] }],
            "rounded-es": [{ "rounded-es": [l] }],
            "rounded-tl": [{ "rounded-tl": [l] }],
            "rounded-tr": [{ "rounded-tr": [l] }],
            "rounded-br": [{ "rounded-br": [l] }],
            "rounded-bl": [{ "rounded-bl": [l] }],
            "border-w": [{ border: [i] }],
            "border-w-x": [{ "border-x": [i] }],
            "border-w-y": [{ "border-y": [i] }],
            "border-w-s": [{ "border-s": [i] }],
            "border-w-e": [{ "border-e": [i] }],
            "border-w-t": [{ "border-t": [i] }],
            "border-w-r": [{ "border-r": [i] }],
            "border-w-b": [{ "border-b": [i] }],
            "border-w-l": [{ "border-l": [i] }],
            "border-opacity": [{ "border-opacity": [y] }],
            "border-style": [{ border: [...q(), "hidden"] }],
            "divide-x": [{ "divide-x": [i] }],
            "divide-x-reverse": ["divide-x-reverse"],
            "divide-y": [{ "divide-y": [i] }],
            "divide-y-reverse": ["divide-y-reverse"],
            "divide-opacity": [{ "divide-opacity": [y] }],
            "divide-style": [{ divide: q() }],
            "border-color": [{ border: [n] }],
            "border-color-x": [{ "border-x": [n] }],
            "border-color-y": [{ "border-y": [n] }],
            "border-color-s": [{ "border-s": [n] }],
            "border-color-e": [{ "border-e": [n] }],
            "border-color-t": [{ "border-t": [n] }],
            "border-color-r": [{ "border-r": [n] }],
            "border-color-b": [{ "border-b": [n] }],
            "border-color-l": [{ "border-l": [n] }],
            "divide-color": [{ divide: [n] }],
            "outline-style": [{ outline: ["", ...q()] }],
            "outline-offset": [{ "outline-offset": [w, E] }],
            "outline-w": [{ outline: [w, k] }],
            "outline-color": [{ outline: [e] }],
            "ring-w": [{ ring: B() }],
            "ring-w-inset": ["ring-inset"],
            "ring-color": [{ ring: [e] }],
            "ring-opacity": [{ "ring-opacity": [y] }],
            "ring-offset-w": [{ "ring-offset": [w, k] }],
            "ring-offset-color": [{ "ring-offset": [e] }],
            shadow: [{ shadow: ["", "inner", "none", O, R] }],
            "shadow-color": [{ shadow: [I] }],
            opacity: [{ opacity: [y] }],
            "mix-blend": [
              { "mix-blend": [...Q(), "plus-lighter", "plus-darker"] },
            ],
            "bg-blend": [{ "bg-blend": Q() }],
            filter: [{ filter: ["", "none"] }],
            blur: [{ blur: [t] }],
            brightness: [{ brightness: [o] }],
            contrast: [{ contrast: [s] }],
            "drop-shadow": [{ "drop-shadow": ["", "none", O, E] }],
            grayscale: [{ grayscale: [c] }],
            "hue-rotate": [{ "hue-rotate": [d] }],
            invert: [{ invert: [u] }],
            saturate: [{ saturate: [v] }],
            sepia: [{ sepia: [T] }],
            "backdrop-filter": [{ "backdrop-filter": ["", "none"] }],
            "backdrop-blur": [{ "backdrop-blur": [t] }],
            "backdrop-brightness": [{ "backdrop-brightness": [o] }],
            "backdrop-contrast": [{ "backdrop-contrast": [s] }],
            "backdrop-grayscale": [{ "backdrop-grayscale": [c] }],
            "backdrop-hue-rotate": [{ "backdrop-hue-rotate": [d] }],
            "backdrop-invert": [{ "backdrop-invert": [u] }],
            "backdrop-opacity": [{ "backdrop-opacity": [y] }],
            "backdrop-saturate": [{ "backdrop-saturate": [v] }],
            "backdrop-sepia": [{ "backdrop-sepia": [T] }],
            "border-collapse": [{ border: ["collapse", "separate"] }],
            "border-spacing": [{ "border-spacing": [a] }],
            "border-spacing-x": [{ "border-spacing-x": [a] }],
            "border-spacing-y": [{ "border-spacing-y": [a] }],
            "table-layout": [{ table: ["auto", "fixed"] }],
            caption: [{ caption: ["top", "bottom"] }],
            transition: [
              {
                transition: [
                  "none",
                  "all",
                  "",
                  "colors",
                  "opacity",
                  "shadow",
                  "transform",
                  E,
                ],
              },
            ],
            duration: [{ duration: Y() }],
            ease: [{ ease: ["linear", "in", "out", "in-out", E] }],
            delay: [{ delay: Y() }],
            animate: [
              { animate: ["none", "spin", "ping", "pulse", "bounce", E] },
            ],
            transform: [{ transform: ["", "gpu", "none"] }],
            scale: [{ scale: [S] }],
            "scale-x": [{ "scale-x": [S] }],
            "scale-y": [{ "scale-y": [S] }],
            rotate: [{ rotate: [_, E] }],
            "translate-x": [{ "translate-x": [L] }],
            "translate-y": [{ "translate-y": [L] }],
            "skew-x": [{ "skew-x": [$] }],
            "skew-y": [{ "skew-y": [$] }],
            "transform-origin": [
              {
                origin: [
                  "center",
                  "top",
                  "top-right",
                  "right",
                  "bottom-right",
                  "bottom",
                  "bottom-left",
                  "left",
                  "top-left",
                  E,
                ],
              },
            ],
            accent: [{ accent: ["auto", e] }],
            appearance: [{ appearance: ["none", "auto"] }],
            cursor: [
              {
                cursor: [
                  "auto",
                  "default",
                  "pointer",
                  "wait",
                  "text",
                  "move",
                  "help",
                  "not-allowed",
                  "none",
                  "context-menu",
                  "progress",
                  "cell",
                  "crosshair",
                  "vertical-text",
                  "alias",
                  "copy",
                  "no-drop",
                  "grab",
                  "grabbing",
                  "all-scroll",
                  "col-resize",
                  "row-resize",
                  "n-resize",
                  "e-resize",
                  "s-resize",
                  "w-resize",
                  "ne-resize",
                  "nw-resize",
                  "se-resize",
                  "sw-resize",
                  "ew-resize",
                  "ns-resize",
                  "nesw-resize",
                  "nwse-resize",
                  "zoom-in",
                  "zoom-out",
                  E,
                ],
              },
            ],
            "caret-color": [{ caret: [e] }],
            "pointer-events": [{ "pointer-events": ["none", "auto"] }],
            resize: [{ resize: ["none", "y", "x", ""] }],
            "scroll-behavior": [{ scroll: ["auto", "smooth"] }],
            "scroll-m": [{ "scroll-m": G() }],
            "scroll-mx": [{ "scroll-mx": G() }],
            "scroll-my": [{ "scroll-my": G() }],
            "scroll-ms": [{ "scroll-ms": G() }],
            "scroll-me": [{ "scroll-me": G() }],
            "scroll-mt": [{ "scroll-mt": G() }],
            "scroll-mr": [{ "scroll-mr": G() }],
            "scroll-mb": [{ "scroll-mb": G() }],
            "scroll-ml": [{ "scroll-ml": G() }],
            "scroll-p": [{ "scroll-p": G() }],
            "scroll-px": [{ "scroll-px": G() }],
            "scroll-py": [{ "scroll-py": G() }],
            "scroll-ps": [{ "scroll-ps": G() }],
            "scroll-pe": [{ "scroll-pe": G() }],
            "scroll-pt": [{ "scroll-pt": G() }],
            "scroll-pr": [{ "scroll-pr": G() }],
            "scroll-pb": [{ "scroll-pb": G() }],
            "scroll-pl": [{ "scroll-pl": G() }],
            "snap-align": [{ snap: ["start", "end", "center", "align-none"] }],
            "snap-stop": [{ snap: ["normal", "always"] }],
            "snap-type": [{ snap: ["none", "x", "y", "both"] }],
            "snap-strictness": [{ snap: ["mandatory", "proximity"] }],
            touch: [{ touch: ["auto", "none", "manipulation"] }],
            "touch-x": [{ "touch-pan": ["x", "left", "right"] }],
            "touch-y": [{ "touch-pan": ["y", "up", "down"] }],
            "touch-pz": ["touch-pinch-zoom"],
            select: [{ select: ["none", "text", "all", "auto"] }],
            "will-change": [
              { "will-change": ["auto", "scroll", "contents", "transform", E] },
            ],
            fill: [{ fill: [e, "none"] }],
            "stroke-w": [{ stroke: [w, k, P] }],
            stroke: [{ stroke: [e, "none"] }],
            sr: ["sr-only", "not-sr-only"],
            "forced-color-adjust": [
              { "forced-color-adjust": ["auto", "none"] },
            ],
          },
          conflictingClassGroups: {
            overflow: ["overflow-x", "overflow-y"],
            overscroll: ["overscroll-x", "overscroll-y"],
            inset: [
              "inset-x",
              "inset-y",
              "start",
              "end",
              "top",
              "right",
              "bottom",
              "left",
            ],
            "inset-x": ["right", "left"],
            "inset-y": ["top", "bottom"],
            flex: ["basis", "grow", "shrink"],
            gap: ["gap-x", "gap-y"],
            p: ["px", "py", "ps", "pe", "pt", "pr", "pb", "pl"],
            px: ["pr", "pl"],
            py: ["pt", "pb"],
            m: ["mx", "my", "ms", "me", "mt", "mr", "mb", "ml"],
            mx: ["mr", "ml"],
            my: ["mt", "mb"],
            size: ["w", "h"],
            "font-size": ["leading"],
            "fvn-normal": [
              "fvn-ordinal",
              "fvn-slashed-zero",
              "fvn-figure",
              "fvn-spacing",
              "fvn-fraction",
            ],
            "fvn-ordinal": ["fvn-normal"],
            "fvn-slashed-zero": ["fvn-normal"],
            "fvn-figure": ["fvn-normal"],
            "fvn-spacing": ["fvn-normal"],
            "fvn-fraction": ["fvn-normal"],
            "line-clamp": ["display", "overflow"],
            rounded: [
              "rounded-s",
              "rounded-e",
              "rounded-t",
              "rounded-r",
              "rounded-b",
              "rounded-l",
              "rounded-ss",
              "rounded-se",
              "rounded-ee",
              "rounded-es",
              "rounded-tl",
              "rounded-tr",
              "rounded-br",
              "rounded-bl",
            ],
            "rounded-s": ["rounded-ss", "rounded-es"],
            "rounded-e": ["rounded-se", "rounded-ee"],
            "rounded-t": ["rounded-tl", "rounded-tr"],
            "rounded-r": ["rounded-tr", "rounded-br"],
            "rounded-b": ["rounded-br", "rounded-bl"],
            "rounded-l": ["rounded-tl", "rounded-bl"],
            "border-spacing": ["border-spacing-x", "border-spacing-y"],
            "border-w": [
              "border-w-s",
              "border-w-e",
              "border-w-t",
              "border-w-r",
              "border-w-b",
              "border-w-l",
            ],
            "border-w-x": ["border-w-r", "border-w-l"],
            "border-w-y": ["border-w-t", "border-w-b"],
            "border-color": [
              "border-color-s",
              "border-color-e",
              "border-color-t",
              "border-color-r",
              "border-color-b",
              "border-color-l",
            ],
            "border-color-x": ["border-color-r", "border-color-l"],
            "border-color-y": ["border-color-t", "border-color-b"],
            "scroll-m": [
              "scroll-mx",
              "scroll-my",
              "scroll-ms",
              "scroll-me",
              "scroll-mt",
              "scroll-mr",
              "scroll-mb",
              "scroll-ml",
            ],
            "scroll-mx": ["scroll-mr", "scroll-ml"],
            "scroll-my": ["scroll-mt", "scroll-mb"],
            "scroll-p": [
              "scroll-px",
              "scroll-py",
              "scroll-ps",
              "scroll-pe",
              "scroll-pt",
              "scroll-pr",
              "scroll-pb",
              "scroll-pl",
            ],
            "scroll-px": ["scroll-pr", "scroll-pl"],
            "scroll-py": ["scroll-pt", "scroll-pb"],
            touch: ["touch-x", "touch-y", "touch-pz"],
            "touch-x": ["touch"],
            "touch-y": ["touch"],
            "touch-pz": ["touch"],
          },
          conflictingClassGroupModifiers: { "font-size": ["leading"] },
        };
      });
    function G(...e) {
      return F(r(e));
    }
    e.s(["cn", () => G], 97202);
  },
  92240,
  (e) => {
    "use strict";
    var r = e.i(66808),
      t = e.i(23291),
      o = e.i(20517),
      n = e.i(97202);
    let l = [
      { href: "/", label: "HOME" },
      { href: "/community", label: "COMMUNITY" },
      { href: "/deploy", label: "DEPLOY" },
      { href: "/admin", label: "ADMIN" },
    ];
    function a() {
      let e = (0, o.usePathname)();
      return (0, r.jsx)("nav", {
        className:
          "h-16 bg-background/95 border-b border-border backdrop-blur-md sticky top-0 z-50",
        children: (0, r.jsxs)("div", {
          className:
            "max-w-7xl mx-auto px-6 lg:px-10 h-full flex items-center justify-between",
          children: [
            (0, r.jsx)(t.default, {
              href: "/",
              className:
                "font-mono text-xl lg:text-2xl text-primary tracking-wider drop-shadow-[0_0_10px_var(--color-primary-glow)] hover:drop-shadow-[0_0_20px_var(--color-primary-glow)] transition-all duration-200 focus-ring",
              children: "SAFEMODE",
            }),
            (0, r.jsx)("div", {
              className: "flex gap-4 lg:gap-8",
              children: l.map((o) =>
                (0, r.jsx)(
                  t.default,
                  {
                    href: o.href,
                    className: (0, n.cn)(
                      "font-mono text-sm font-medium transition-all duration-200 focus-ring",
                      e === o.href
                        ? "text-primary drop-shadow-[0_0_10px_var(--color-primary-glow)]"
                        : "text-muted-foreground hover:text-primary",
                    ),
                    children: o.label,
                  },
                  o.href,
                ),
              ),
            }),
          ],
        }),
      });
    }
    e.s(["NavBar", () => a]);
  },
]);
