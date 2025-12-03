module.exports = [
  36451,
  (a) => {
    "use strict";
    let b, c, d, e, f;
    var g = a.i(72288),
      h = a.i(56637),
      i = a.i(6255),
      j = a.i(70383),
      k = a.i(96566),
      l = a.i(8300);
    function m(a, b) {
      if ("function" == typeof a) return a(b);
      null != a && (a.current = b);
    }
    var n = Symbol.for("react.lazy"),
      o = h[" use ".trim().toString()];
    function p(a) {
      var b;
      return (
        null != a &&
        "object" == typeof a &&
        "$$typeof" in a &&
        a.$$typeof === n &&
        "_payload" in a &&
        "object" == typeof (b = a._payload) &&
        null !== b &&
        "then" in b
      );
    }
    var q =
        (((f = h.forwardRef((a, b) => {
          let { children: c, ...d } = a;
          if (
            (p(c) && "function" == typeof o && (c = o(c._payload)),
            h.isValidElement(c))
          ) {
            var e;
            let a,
              f,
              g =
                ((e = c),
                (f =
                  (a = Object.getOwnPropertyDescriptor(e.props, "ref")?.get) &&
                  "isReactWarning" in a &&
                  a.isReactWarning)
                  ? e.ref
                  : (f =
                        (a = Object.getOwnPropertyDescriptor(e, "ref")?.get) &&
                        "isReactWarning" in a &&
                        a.isReactWarning)
                    ? e.props.ref
                    : e.props.ref || e.ref),
              i = (function (a, b) {
                let c = { ...b };
                for (let d in b) {
                  let e = a[d],
                    f = b[d];
                  /^on[A-Z]/.test(d)
                    ? e && f
                      ? (c[d] = (...a) => {
                          let b = f(...a);
                          return (e(...a), b);
                        })
                      : e && (c[d] = e)
                    : "style" === d
                      ? (c[d] = { ...e, ...f })
                      : "className" === d &&
                        (c[d] = [e, f].filter(Boolean).join(" "));
                }
                return { ...a, ...c };
              })(d, c.props);
            return (
              c.type !== h.Fragment &&
                (i.ref = b
                  ? (function (...a) {
                      return (b) => {
                        let c = !1,
                          d = a.map((a) => {
                            let d = m(a, b);
                            return (c || "function" != typeof d || (c = !0), d);
                          });
                        if (c)
                          return () => {
                            for (let b = 0; b < d.length; b++) {
                              let c = d[b];
                              "function" == typeof c ? c() : m(a[b], null);
                            }
                          };
                      };
                    })(b, g)
                  : g),
              h.cloneElement(c, i)
            );
          }
          return h.Children.count(c) > 1 ? h.Children.only(null) : null;
        })).displayName = "Slot.SlotClone"),
        (b = f),
        ((c = h.forwardRef((a, c) => {
          let { children: d, ...e } = a;
          p(d) && "function" == typeof o && (d = o(d._payload));
          let f = h.Children.toArray(d),
            i = f.find(s);
          if (i) {
            let a = i.props.children,
              d = f.map((b) =>
                b !== i
                  ? b
                  : h.Children.count(a) > 1
                    ? h.Children.only(null)
                    : h.isValidElement(a)
                      ? a.props.children
                      : null,
              );
            return (0, g.jsx)(b, {
              ...e,
              ref: c,
              children: h.isValidElement(a)
                ? h.cloneElement(a, void 0, d)
                : null,
            });
          }
          return (0, g.jsx)(b, { ...e, ref: c, children: d });
        })).displayName = "Slot.Slot"),
        c),
      r = Symbol("radix.slottable");
    function s(a) {
      return (
        h.isValidElement(a) &&
        "function" == typeof a.type &&
        "__radixId" in a.type &&
        a.type.__radixId === r
      );
    }
    var t = a.i(75104);
    let u = (a) => ("boolean" == typeof a ? `${a}` : 0 === a ? "0" : a),
      v = t.clsx;
    var w = a.i(54869);
    let x =
      ((d =
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"),
      (e = {
        variants: {
          variant: {
            default: "bg-primary text-primary-foreground hover:bg-primary/90",
            destructive:
              "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
            outline:
              "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
            secondary:
              "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            ghost:
              "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
            link: "text-primary underline-offset-4 hover:underline",
          },
          size: {
            default: "h-9 px-4 py-2 has-[>svg]:px-3",
            sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
            lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
            icon: "size-9",
            "icon-sm": "size-8",
            "icon-lg": "size-10",
          },
        },
        defaultVariants: { variant: "default", size: "default" },
      }),
      (a) => {
        var b;
        if ((null == e ? void 0 : e.variants) == null)
          return v(
            d,
            null == a ? void 0 : a.class,
            null == a ? void 0 : a.className,
          );
        let { variants: c, defaultVariants: f } = e,
          g = Object.keys(c).map((b) => {
            let d = null == a ? void 0 : a[b],
              e = null == f ? void 0 : f[b];
            if (null === d) return null;
            let g = u(d) || u(e);
            return c[b][g];
          }),
          h =
            a &&
            Object.entries(a).reduce((a, b) => {
              let [c, d] = b;
              return (void 0 === d || (a[c] = d), a);
            }, {});
        return v(
          d,
          g,
          null == e || null == (b = e.compoundVariants)
            ? void 0
            : b.reduce((a, b) => {
                let { class: c, className: d, ...e } = b;
                return Object.entries(e).every((a) => {
                  let [b, c] = a;
                  return Array.isArray(c)
                    ? c.includes({ ...f, ...h }[b])
                    : { ...f, ...h }[b] === c;
                })
                  ? [...a, c, d]
                  : a;
              }, []),
          null == a ? void 0 : a.class,
          null == a ? void 0 : a.className,
        );
      });
    function y({ className: a, variant: b, size: c, asChild: d = !1, ...e }) {
      return (0, g.jsx)(d ? q : "button", {
        "data-slot": "button",
        className: (0, w.cn)(x({ variant: b, size: c, className: a })),
        ...e,
      });
    }
    function z({ className: a, type: b, ...c }) {
      return (0, g.jsx)("input", {
        type: b,
        "data-slot": "input",
        className: (0, w.cn)(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          a,
        ),
        ...c,
      });
    }
    var A = a.i(50663);
    function B() {
      let [a, b] = (0, h.useState)(""),
        [c, d] = (0, h.useState)(!1),
        [e, f] = (0, h.useState)(null),
        [i, j] = (0, h.useState)(null),
        k = async (b) => {
          if ((b.preventDefault(), a.trim())) {
            (d(!0), j(null), f(null));
            try {
              let b = await (0, A.rescanUrl)(a);
              f(b);
            } catch {
              j("SCAN_FAILED: Unable to process URL");
            } finally {
              d(!1);
            }
          }
        };
      return (0, g.jsxs)("div", {
        className: "space-y-4",
        children: [
          (0, g.jsxs)("form", {
            onSubmit: k,
            className: "flex gap-2",
            children: [
              (0, g.jsx)(z, {
                type: "url",
                placeholder: "https://example.com/suspicious-link",
                value: a,
                onChange: (a) => b(a.target.value),
                className:
                  "flex-1 bg-background border-border text-secondary placeholder:text-muted-foreground/30 font-mono text-sm focus:border-primary focus:ring-primary/20 focus-ring",
              }),
              (0, g.jsx)(y, {
                type: "submit",
                disabled: c || !a.trim(),
                className:
                  "bg-primary text-background hover:bg-primary/80 font-mono font-bold disabled:opacity-50",
                children: c ? "SCANNING..." : "[ RESCAN ]",
              }),
            ],
          }),
          e &&
            (0, g.jsxs)("div", {
              className: (0, w.cn)(
                "border p-4 font-mono text-sm",
                ((a) => {
                  switch (a) {
                    case "SAFE":
                      return "text-success bg-success/10 border-success/40";
                    case "DENY":
                      return "text-danger bg-danger/10 border-danger/40";
                    case "WARN":
                      return "text-warning bg-warning/10 border-warning/40";
                    default:
                      return "text-muted-foreground bg-muted/10 border-border";
                  }
                })(e.verdict),
              ),
              children: [
                (0, g.jsxs)("div", {
                  className: "flex items-center justify-between mb-2",
                  children: [
                    (0, g.jsxs)("span", {
                      className: "font-bold",
                      children: ["VERDICT: ", e.verdict],
                    }),
                    (0, g.jsx)("span", {
                      className: "text-xs opacity-60",
                      children: new Date(e.timestamp).toLocaleString(),
                    }),
                  ],
                }),
                (0, g.jsxs)("div", {
                  className: "text-xs opacity-70 break-all",
                  children: ["URL: ", e.url],
                }),
                e.category &&
                  (0, g.jsxs)("div", {
                    className: "text-xs opacity-70 mt-1",
                    children: ["CATEGORY: ", e.category],
                  }),
              ],
            }),
          i &&
            (0, g.jsx)("div", {
              className:
                "border border-danger/40 bg-danger/10 p-4 font-mono text-sm text-danger",
              children: i,
            }),
        ],
      });
    }
    var C = a.i(24655);
    function D() {
      let { data: a, mutate: b } = (0, C.default)("overrides", A.getOverrides),
        [c, d] = (0, h.useState)(!1),
        [e, f] = (0, h.useState)(""),
        [i, j] = (0, h.useState)("block"),
        [k, l] = (0, h.useState)(""),
        m = async (c) => {
          (c.preventDefault(),
            e.trim() &&
              (b([...(a || []), await (0, A.addOverride)(e, i, k)]),
              f(""),
              l(""),
              d(!1)));
        };
      return (0, g.jsxs)("div", {
        className: "space-y-4",
        children: [
          (0, g.jsxs)("div", {
            className: "flex items-center justify-between",
            children: [
              (0, g.jsxs)("span", {
                className: "font-mono text-primary text-sm",
                children: ["ACTIVE OVERRIDES: ", a?.length || 0],
              }),
              (0, g.jsx)(y, {
                onClick: () => d(!c),
                variant: "outline",
                size: "sm",
                className:
                  "border-primary/40 text-primary hover:bg-primary/10 font-mono text-xs focus-ring",
                children: c ? "[ CANCEL ]" : "[ + ADD ]",
              }),
            ],
          }),
          c &&
            (0, g.jsxs)("form", {
              onSubmit: m,
              className: "border border-border bg-background/50 p-4 space-y-3",
              children: [
                (0, g.jsxs)("div", {
                  className: "grid grid-cols-1 md:grid-cols-3 gap-3",
                  children: [
                    (0, g.jsx)(z, {
                      placeholder: "Pattern (e.g., *.example.com)",
                      value: e,
                      onChange: (a) => f(a.target.value),
                      className:
                        "bg-background border-border text-secondary placeholder:text-muted-foreground/30 font-mono text-xs focus-ring",
                    }),
                    (0, g.jsxs)("select", {
                      value: i,
                      onChange: (a) => j(a.target.value),
                      className:
                        "bg-background border border-border text-secondary font-mono text-xs px-3 py-2 rounded-md focus-ring",
                      children: [
                        (0, g.jsx)("option", {
                          value: "block",
                          children: "BLOCK",
                        }),
                        (0, g.jsx)("option", {
                          value: "allow",
                          children: "ALLOW",
                        }),
                      ],
                    }),
                    (0, g.jsx)(z, {
                      placeholder: "Reason",
                      value: k,
                      onChange: (a) => l(a.target.value),
                      className:
                        "bg-background border-border text-secondary placeholder:text-muted-foreground/30 font-mono text-xs focus-ring",
                    }),
                  ],
                }),
                (0, g.jsx)(y, {
                  type: "submit",
                  size: "sm",
                  className:
                    "bg-primary text-background hover:bg-primary/80 font-mono text-xs",
                  children: "[ SAVE OVERRIDE ]",
                }),
              ],
            }),
          (0, g.jsxs)("div", {
            className: "border border-border overflow-hidden",
            children: [
              (0, g.jsxs)("div", {
                className:
                  "grid grid-cols-4 gap-2 bg-primary/5 px-4 py-2 font-mono text-xs text-primary/70 border-b border-border",
                children: [
                  (0, g.jsx)("span", { children: "PATTERN" }),
                  (0, g.jsx)("span", { children: "ACTION" }),
                  (0, g.jsx)("span", { children: "REASON" }),
                  (0, g.jsx)("span", { children: "CREATED" }),
                ],
              }),
              (0, g.jsxs)("div", {
                className: "divide-y divide-border",
                children: [
                  a?.map((a) =>
                    (0, g.jsxs)(
                      "div",
                      {
                        className:
                          "grid grid-cols-4 gap-2 px-4 py-3 font-mono text-xs hover:bg-primary/5 transition-colors",
                        children: [
                          (0, g.jsx)("span", {
                            className: "text-secondary truncate",
                            children: a.pattern,
                          }),
                          (0, g.jsx)("span", {
                            className: (0, w.cn)(
                              "allow" === a.action
                                ? "text-success"
                                : "text-danger",
                            ),
                            children: a.action.toUpperCase(),
                          }),
                          (0, g.jsx)("span", {
                            className: "text-muted-foreground truncate",
                            children: a.reason,
                          }),
                          (0, g.jsx)("span", {
                            className: "text-muted-foreground/60",
                            children: new Date(
                              a.createdAt,
                            ).toLocaleDateString(),
                          }),
                        ],
                      },
                      a.id,
                    ),
                  ),
                  (!a || 0 === a.length) &&
                    (0, g.jsx)("div", {
                      className:
                        "px-4 py-8 text-center font-mono text-sm text-muted-foreground/60",
                      children: "No overrides configured",
                    }),
                ],
              }),
            ],
          }),
        ],
      });
    }
    let E = [
      {
        id: "1",
        name: "Family Chat",
        members: 12,
        scansTotal: 156,
        threatsBlocked: 3,
        isMuted: !1,
      },
      {
        id: "2",
        name: "Work Team",
        members: 45,
        scansTotal: 892,
        threatsBlocked: 15,
        isMuted: !1,
      },
      {
        id: "3",
        name: "Gaming Squad",
        members: 8,
        scansTotal: 234,
        threatsBlocked: 7,
        isMuted: !0,
      },
      {
        id: "4",
        name: "Crypto Traders",
        members: 128,
        scansTotal: 2341,
        threatsBlocked: 89,
        isMuted: !1,
      },
      {
        id: "5",
        name: "School Group",
        members: 67,
        scansTotal: 445,
        threatsBlocked: 12,
        isMuted: !1,
      },
    ];
    function F() {
      let [a, b] = (0, h.useState)(E),
        [c, d] = (0, h.useState)(null),
        e = async (a) => {
          d(a);
          try {
            (await (0, A.muteGroup)(a),
              b((b) =>
                b.map((b) => (b.id === a ? { ...b, isMuted: !b.isMuted } : b)),
              ));
          } finally {
            d(null);
          }
        };
      return (0, g.jsxs)("div", {
        className: "space-y-4",
        children: [
          (0, g.jsxs)("div", {
            className: "grid grid-cols-3 gap-4 mb-4",
            children: [
              (0, g.jsxs)("div", {
                className: "text-center",
                children: [
                  (0, g.jsx)("div", {
                    className: "font-mono text-2xl text-primary font-bold",
                    children: a.length,
                  }),
                  (0, g.jsx)("div", {
                    className: "font-mono text-xs text-primary/60",
                    children: "GROUPS",
                  }),
                ],
              }),
              (0, g.jsxs)("div", {
                className: "text-center",
                children: [
                  (0, g.jsx)("div", {
                    className: "font-mono text-2xl text-primary font-bold",
                    children: a.reduce((a, b) => a + b.members, 0),
                  }),
                  (0, g.jsx)("div", {
                    className: "font-mono text-xs text-primary/60",
                    children: "MEMBERS",
                  }),
                ],
              }),
              (0, g.jsxs)("div", {
                className: "text-center",
                children: [
                  (0, g.jsx)("div", {
                    className: "font-mono text-2xl text-danger font-bold",
                    children: a.reduce((a, b) => a + b.threatsBlocked, 0),
                  }),
                  (0, g.jsx)("div", {
                    className: "font-mono text-xs text-danger/60",
                    children: "THREATS",
                  }),
                ],
              }),
            ],
          }),
          (0, g.jsx)("div", {
            className: "border border-border divide-y divide-border",
            children: a.map((a) =>
              (0, g.jsxs)(
                "div",
                {
                  className:
                    "flex items-center justify-between px-4 py-3 hover:bg-primary/5 transition-colors",
                  children: [
                    (0, g.jsxs)("div", {
                      className: "flex-1",
                      children: [
                        (0, g.jsxs)("div", {
                          className: "flex items-center gap-2",
                          children: [
                            (0, g.jsx)("span", {
                              className: "font-mono text-sm text-secondary",
                              children: a.name,
                            }),
                            a.isMuted &&
                              (0, g.jsx)("span", {
                                className:
                                  "px-2 py-0.5 bg-warning/10 text-warning text-xs font-mono",
                                children: "MUTED",
                              }),
                          ],
                        }),
                        (0, g.jsxs)("div", {
                          className:
                            "font-mono text-xs text-muted-foreground/60 mt-1",
                          children: [
                            a.members,
                            " members • ",
                            a.scansTotal,
                            " scans • ",
                            a.threatsBlocked,
                            " threats",
                          ],
                        }),
                      ],
                    }),
                    (0, g.jsx)(y, {
                      onClick: () => e(a.id),
                      disabled: c === a.id,
                      variant: "outline",
                      size: "sm",
                      className: (0, w.cn)(
                        "font-mono text-xs focus-ring",
                        a.isMuted
                          ? "border-primary/40 text-primary hover:bg-primary/10"
                          : "border-warning/40 text-warning hover:bg-warning/10",
                      ),
                      children:
                        c === a.id
                          ? "..."
                          : a.isMuted
                            ? "[ UNMUTE ]"
                            : "[ MUTE ]",
                    }),
                  ],
                },
                a.id,
              ),
            ),
          }),
        ],
      });
    }
    function G({ onAuthenticated: a }) {
      let [b, c] = (0, h.useState)(""),
        [d, e] = (0, h.useState)(null),
        [f, k] = (0, h.useState)(!1),
        l = async (c) => {
          (c.preventDefault(),
            k(!0),
            e(null),
            await new Promise((a) => setTimeout(a, 800)),
            "safemode-admin-demo" === b || "demo" === b
              ? a()
              : e("ACCESS_DENIED: Invalid token"),
            k(!1));
        };
      return (0, g.jsxs)("div", {
        className: "min-h-screen bg-background",
        children: [
          (0, g.jsx)(i.NavBar, {}),
          (0, g.jsx)("div", {
            className: "flex items-center justify-center p-4 py-20",
            children: (0, g.jsx)("div", {
              className: "w-full max-w-md",
              children: (0, g.jsx)(j.TerminalCard, {
                title: "ADMIN AUTHENTICATION",
                variant: "solid",
                children: (0, g.jsxs)("div", {
                  className: "space-y-6",
                  children: [
                    (0, g.jsx)("pre", {
                      className:
                        "font-mono text-primary/60 text-xs text-center",
                      children: `    ██████
   ██    ██
   ██    ██
 ████████████
 ██        ██
 ██  ████  ██
 ██  ████  ██
 ██        ██
 ████████████`,
                    }),
                    (0, g.jsxs)("form", {
                      onSubmit: l,
                      className: "space-y-4",
                      children: [
                        (0, g.jsxs)("div", {
                          children: [
                            (0, g.jsx)("label", {
                              className:
                                "block font-mono text-xs text-primary/60 mb-2",
                              children: "> ENTER API TOKEN",
                            }),
                            (0, g.jsx)(z, {
                              type: "password",
                              placeholder: "••••••••••••••••",
                              value: b,
                              onChange: (a) => c(a.target.value),
                              className:
                                "bg-background border-border text-secondary placeholder:text-muted-foreground/40 font-mono focus-ring",
                            }),
                          ],
                        }),
                        d &&
                          (0, g.jsx)("div", {
                            className:
                              "font-mono text-xs text-danger bg-danger/10 border border-danger/30 p-3",
                            children: d,
                          }),
                        (0, g.jsx)(y, {
                          type: "submit",
                          disabled: f || !b.trim(),
                          className:
                            "w-full bg-primary text-background hover:bg-primary/80 font-mono font-bold",
                          children: f
                            ? "AUTHENTICATING..."
                            : "[ AUTHENTICATE ]",
                        }),
                      ],
                    }),
                    (0, g.jsx)("div", {
                      className:
                        "text-center font-mono text-xs text-primary/40",
                      children: (0, g.jsx)("p", {
                        children: 'Demo token: "demo"',
                      }),
                    }),
                  ],
                }),
              }),
            }),
          }),
        ],
      });
    }
    function H() {
      let [a, b] = (0, h.useState)(!1),
        [c, d] = (0, h.useState)("overview");
      return a
        ? (0, g.jsxs)("div", {
            className: "min-h-screen bg-background",
            children: [
              (0, g.jsx)(i.NavBar, {}),
              (0, g.jsxs)("main", {
                className: "container mx-auto px-6 lg:px-10 py-8",
                children: [
                  (0, g.jsxs)("div", {
                    className:
                      "mb-8 flex items-center justify-between flex-wrap gap-4",
                    children: [
                      (0, g.jsx)("div", {
                        children: (0, g.jsx)("h1", {
                          className:
                            "font-mono text-2xl md:text-3xl text-primary terminal-glow",
                          children: "ADMIN CONTROL PANEL",
                        }),
                      }),
                      (0, g.jsx)("button", {
                        onClick: () => b(!1),
                        className:
                          "font-mono text-xs text-danger/60 hover:text-danger transition-colors focus-ring px-3 py-1.5 border border-danger/30 hover:border-danger/60",
                        children: "[ LOGOUT ]",
                      }),
                    ],
                  }),
                  (0, g.jsx)("div", {
                    className: "flex gap-2 mb-6 overflow-x-auto pb-2",
                    role: "tablist",
                    children: [
                      { id: "overview", label: "OVERVIEW" },
                      { id: "rescan", label: "RESCAN" },
                      { id: "overrides", label: "OVERRIDES" },
                      { id: "groups", label: "GROUPS" },
                    ].map((a) =>
                      (0, g.jsxs)(
                        "button",
                        {
                          onClick: () => d(a.id),
                          role: "tab",
                          "aria-selected": c === a.id,
                          className: (0, w.cn)(
                            "px-4 py-2 font-mono text-sm whitespace-nowrap transition-all focus-ring",
                            c === a.id
                              ? "bg-primary text-background font-bold"
                              : "border border-border text-primary/60 hover:border-primary/60 hover:text-primary",
                          ),
                          children: ["[ ", a.label, " ]"],
                        },
                        a.id,
                      ),
                    ),
                  }),
                  (0, g.jsxs)("div", {
                    className: "space-y-6",
                    role: "tabpanel",
                    children: [
                      "overview" === c &&
                        (0, g.jsxs)(g.Fragment, {
                          children: [
                            (0, g.jsxs)("div", {
                              className:
                                "grid grid-cols-1 lg:grid-cols-2 gap-6",
                              children: [
                                (0, g.jsx)(j.TerminalCard, {
                                  title: "SYSTEM METRICS",
                                  variant: "solid",
                                  children: (0, g.jsx)(k.StatsDisplay, {}),
                                }),
                                (0, g.jsx)(j.TerminalCard, {
                                  title: "QUICK ACTIONS",
                                  variant: "solid",
                                  children: (0, g.jsx)("div", {
                                    className: "space-y-3",
                                    children: [
                                      {
                                        tab: "rescan",
                                        label: "Force rescan a URL",
                                      },
                                      {
                                        tab: "overrides",
                                        label: "Manage URL overrides",
                                      },
                                      {
                                        tab: "groups",
                                        label: "View protected groups",
                                      },
                                    ].map((a) =>
                                      (0, g.jsxs)(
                                        "button",
                                        {
                                          onClick: () => d(a.tab),
                                          className:
                                            "w-full text-left px-4 py-3 border border-border hover:border-primary/40 hover:bg-primary/5 transition-all font-mono text-sm focus-ring",
                                          children: [
                                            (0, g.jsx)("span", {
                                              className: "text-primary",
                                              children: ">",
                                            }),
                                            (0, g.jsx)("span", {
                                              className:
                                                "text-muted-foreground ml-2",
                                              children: a.label,
                                            }),
                                          ],
                                        },
                                        a.tab,
                                      ),
                                    ),
                                  }),
                                }),
                              ],
                            }),
                            (0, g.jsx)(l.LiveFeed, { maxItems: 6 }),
                          ],
                        }),
                      "rescan" === c &&
                        (0, g.jsx)(j.TerminalCard, {
                          title: "FORCE URL RESCAN",
                          variant: "solid",
                          children: (0, g.jsxs)("div", {
                            className: "space-y-4",
                            children: [
                              (0, g.jsx)("p", {
                                className:
                                  "font-mono text-sm text-muted-foreground",
                                children:
                                  "Force a fresh scan of any URL, bypassing cache. Results will be updated immediately.",
                              }),
                              (0, g.jsx)(B, {}),
                            ],
                          }),
                        }),
                      "overrides" === c &&
                        (0, g.jsx)(j.TerminalCard, {
                          title: "URL PATTERN OVERRIDES",
                          variant: "solid",
                          children: (0, g.jsxs)("div", {
                            className: "space-y-4",
                            children: [
                              (0, g.jsx)("p", {
                                className:
                                  "font-mono text-sm text-muted-foreground",
                                children:
                                  "Configure manual allow/block rules that override automatic scanning results.",
                              }),
                              (0, g.jsx)(D, {}),
                            ],
                          }),
                        }),
                      "groups" === c &&
                        (0, g.jsx)(j.TerminalCard, {
                          title: "PROTECTED GROUPS",
                          variant: "solid",
                          children: (0, g.jsxs)("div", {
                            className: "space-y-4",
                            children: [
                              (0, g.jsx)("p", {
                                className:
                                  "font-mono text-sm text-muted-foreground",
                                children:
                                  "Manage WhatsApp groups protected by SafeMode. Muted groups will not receive bot messages.",
                              }),
                              (0, g.jsx)(F, {}),
                            ],
                          }),
                        }),
                    ],
                  }),
                  (0, g.jsx)("footer", {
                    className:
                      "mt-12 text-center font-mono text-primary/40 text-xs",
                    children: (0, g.jsx)("p", {
                      children: "SafeMode Admin Panel v1.0.0",
                    }),
                  }),
                ],
              }),
            ],
          })
        : (0, g.jsx)(G, { onAuthenticated: () => b(!0) });
    }
    a.s(["default", () => H], 36451);
  },
];

//# sourceMappingURL=Development_whatsapp-bot-scanner_SafeMode-web-app_app_admin_page_tsx_e7743351._.js.map
