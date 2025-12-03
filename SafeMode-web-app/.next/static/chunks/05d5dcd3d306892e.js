(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([
  "object" == typeof document ? document.currentScript : void 0,
  83661,
  (e, r, t) => {
    "use strict";
    (Object.defineProperty(t, "__esModule", { value: !0 }),
      Object.defineProperty(t, "warnOnce", {
        enumerable: !0,
        get: function () {
          return a;
        },
      }));
    let a = (e) => {};
  },
  66404,
  (e) => {
    "use strict";
    var r = e.i(66808),
      t = e.i(97202);
    function a({
      title: e,
      children: a,
      className: s,
      variant: i = "default",
    }) {
      return (0, r.jsxs)("div", {
        className: (0, t.cn)(
          "relative overflow-hidden font-mono",
          "glass" === i &&
            "bg-background/80 backdrop-blur-md border border-border",
          "solid" === i && "bg-background border border-primary/40",
          "default" === i && "bg-background/90 border border-border",
          s,
        ),
        style: {
          boxShadow:
            "inset 0 0 20px rgba(0, 255, 65, 0.05), 0 0 10px rgba(0, 255, 65, 0.1)",
        },
        children: [
          e &&
            (0, r.jsx)("div", {
              className: "border-b border-border bg-primary/5 px-4 py-2",
              children: (0, r.jsx)("span", {
                className: "text-primary text-sm",
                children: `┌─ ${e} ─`,
              }),
            }),
          (0, r.jsx)("div", { className: "p-4", children: a }),
          e &&
            (0, r.jsx)("div", {
              className: "border-t border-border bg-primary/5 px-4 py-1",
              children: (0, r.jsx)("span", {
                className: "text-primary/50 text-xs",
                children: "└───────────────────────────────────────┘",
              }),
            }),
        ],
      });
    }
    e.s(["TerminalCard", () => a]);
  },
  61113,
  (e) => {
    "use strict";
    var r = e.i(66808),
      t = e.i(16371),
      a = e.i(97202);
    let s = [
      { url: "github.com/vercel/next.js", verdict: "SAFE" },
      { url: "bit.ly/3xYz123", verdict: "SCAN" },
      { url: "phishing-site.xyz/login", verdict: "DENY" },
      { url: "docs.google.com/d/abc", verdict: "SAFE" },
      { url: "suspicious-link.ru/click", verdict: "WARN" },
      { url: "linkedin.com/post/456", verdict: "SAFE" },
      { url: "malware-host.net/payload", verdict: "DENY" },
      { url: "youtube.com/watch?v=xyz", verdict: "SAFE" },
      { url: "dropbox.com/s/abc123", verdict: "SAFE" },
      { url: "free-prize.win/claim", verdict: "DENY" },
    ];
    function i({ maxItems: e = 8 }) {
      let [i, n] = (0, t.useState)([]),
        [c, d] = (0, t.useState)(!1),
        [l, o] = (0, t.useState)(!1);
      return (
        (0, t.useEffect)(() => {
          (n(
            Array.from({ length: 5 }, () => {
              let e = s[Math.floor(Math.random() * s.length)];
              return {
                id: Math.random().toString(36).substring(7),
                timestamp: new Date(
                  Date.now() - 6e4 * Math.random(),
                ).toISOString(),
                url: e.url,
                verdict: e.verdict,
              };
            }).sort(
              (e, r) =>
                new Date(r.timestamp).getTime() -
                new Date(e.timestamp).getTime(),
            ),
          ),
            d(!0));
          let r = setInterval(
              () => {
                if (l) return;
                let r = s[Math.floor(Math.random() * s.length)],
                  t = {
                    id: Math.random().toString(36).substring(7),
                    timestamp: new Date().toISOString(),
                    url: r.url,
                    verdict: r.verdict,
                  };
                n((r) => [t, ...r.slice(0, e - 1)]);
              },
              3e3 + 2e3 * Math.random(),
            ),
            t = new EventSource("/api/feed");
          return (
            (t.onmessage = (r) => {
              if (!l)
                try {
                  let t = JSON.parse(r.data);
                  n((r) => [t, ...r.slice(0, e - 1)]);
                } catch {}
            }),
            (t.onerror = () => {}),
            () => {
              (clearInterval(r), t.close());
            }
          );
        }, [e, l]),
        (0, r.jsxs)("div", {
          className: "font-mono",
          role: "log",
          "aria-live": "polite",
          "aria-atomic": "false",
          children: [
            (0, r.jsxs)("div", {
              className:
                "flex items-center justify-between mb-2 flex-wrap gap-2",
              children: [
                (0, r.jsx)("span", {
                  className: "text-primary text-sm",
                  children: `┌─ REAL-TIME SCAN LOG ─────────────────┐`,
                }),
                (0, r.jsxs)("div", {
                  className: "flex items-center gap-3",
                  children: [
                    (0, r.jsx)("button", {
                      onClick: () => o(!l),
                      className:
                        "px-2 py-1 text-xs border border-border text-primary hover:bg-primary/10 transition-colors focus-ring",
                      "aria-label": l ? "Resume feed" : "Pause feed",
                      children: l ? "▶ RESUME" : "⏸ PAUSE",
                    }),
                    (0, r.jsxs)("div", {
                      className: "flex items-center gap-2",
                      children: [
                        (0, r.jsx)("span", {
                          className: (0, a.cn)(
                            "h-2 w-2 rounded-full",
                            c && !l ? "bg-success pulse-led" : "bg-danger",
                          ),
                        }),
                        (0, r.jsx)("span", {
                          className: "text-primary/60 text-xs",
                          children: l ? "PAUSED" : c ? "LIVE" : "OFFLINE",
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            (0, r.jsx)("div", {
              className:
                "border border-border bg-background/80 overflow-hidden max-h-96 overflow-y-auto",
              children: (0, r.jsx)("div", {
                className: "divide-y divide-border",
                children: i.map((e, t) =>
                  (0, r.jsxs)(
                    "div",
                    {
                      className: (0, a.cn)(
                        "flex items-center gap-2 px-3 py-2 text-xs transition-all",
                        0 === t && "animate-[fadeIn_0.3s_ease-out]",
                      ),
                      children: [
                        (0, r.jsx)("span", {
                          className: "text-primary/50 w-16 shrink-0",
                          children: new Date(e.timestamp).toLocaleTimeString(
                            "en-US",
                            {
                              hour12: !1,
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            },
                          ),
                        }),
                        (0, r.jsx)("span", {
                          className: "text-primary/30",
                          children: "│",
                        }),
                        (0, r.jsx)("span", {
                          className: (0, a.cn)(
                            "w-14 shrink-0 font-bold",
                            (function (e) {
                              switch (e) {
                                case "SAFE":
                                  return "text-success";
                                case "DENY":
                                  return "text-danger";
                                case "WARN":
                                  return "text-warning";
                                case "SCAN":
                                  return "text-muted-foreground";
                                default:
                                  return "text-primary/60";
                              }
                            })(e.verdict),
                          ),
                          children: (0, r.jsx)("span", {
                            className: (0, a.cn)(
                              "px-1.5 py-0.5 rounded",
                              (function (e) {
                                switch (e) {
                                  case "SAFE":
                                    return "bg-success/10";
                                  case "DENY":
                                    return "bg-danger/10";
                                  case "WARN":
                                    return "bg-warning/10";
                                  case "SCAN":
                                    return "bg-muted/30";
                                  default:
                                    return "bg-primary/5";
                                }
                              })(e.verdict),
                            ),
                            children: e.verdict,
                          }),
                        }),
                        (0, r.jsx)("span", {
                          className: "text-primary/30",
                          children: "│",
                        }),
                        (0, r.jsx)("span", {
                          className: "text-muted-foreground truncate flex-1",
                          children: e.url,
                        }),
                      ],
                    },
                    e.id,
                  ),
                ),
              }),
            }),
            (0, r.jsx)("div", {
              className: "text-primary/40 text-xs mt-1",
              children: `└───────────────────────────────────────┘`,
            }),
          ],
        })
      );
    }
    e.s(["LiveFeed", () => i]);
  },
]);
