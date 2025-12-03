(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([
  "object" == typeof document ? document.currentScript : void 0,
  83661,
  (e, s, a) => {
    "use strict";
    (Object.defineProperty(a, "__esModule", { value: !0 }),
      Object.defineProperty(a, "warnOnce", {
        enumerable: !0,
        get: function () {
          return r;
        },
      }));
    let r = (e) => {};
  },
  66404,
  (e) => {
    "use strict";
    var s = e.i(66808),
      a = e.i(97202);
    function r({
      title: e,
      children: r,
      className: t,
      variant: i = "default",
    }) {
      return (0, s.jsxs)("div", {
        className: (0, a.cn)(
          "relative overflow-hidden font-mono",
          "glass" === i &&
            "bg-background/80 backdrop-blur-md border border-border",
          "solid" === i && "bg-background border border-primary/40",
          "default" === i && "bg-background/90 border border-border",
          t,
        ),
        style: {
          boxShadow:
            "inset 0 0 20px rgba(0, 255, 65, 0.05), 0 0 10px rgba(0, 255, 65, 0.1)",
        },
        children: [
          e &&
            (0, s.jsx)("div", {
              className: "border-b border-border bg-primary/5 px-4 py-2",
              children: (0, s.jsx)("span", {
                className: "text-primary text-sm",
                children: `┌─ ${e} ─`,
              }),
            }),
          (0, s.jsx)("div", { className: "p-4", children: r }),
          e &&
            (0, s.jsx)("div", {
              className: "border-t border-border bg-primary/5 px-4 py-1",
              children: (0, s.jsx)("span", {
                className: "text-primary/50 text-xs",
                children: "└───────────────────────────────────────┘",
              }),
            }),
        ],
      });
    }
    e.s(["TerminalCard", () => r]);
  },
  21518,
  (e) => {
    "use strict";
    var s = e.i(66808),
      a = e.i(16371),
      r = e.i(92240),
      t = e.i(66404),
      i = e.i(97202);
    function n({
      name: e,
      icon: a,
      description: r,
      features: t,
      href: n,
      recommended: l,
      onClick: o,
    }) {
      return (0, s.jsxs)("a", {
        href: n,
        target: "_blank",
        rel: "noopener noreferrer",
        onClick: o,
        className: (0, i.cn)(
          "group relative block border bg-background/80 p-6 transition-all hover:bg-background focus-ring",
          l
            ? "border-primary shadow-[0_0_20px_var(--color-primary-glow)]"
            : "border-border hover:border-primary/60",
        ),
        children: [
          l &&
            (0, s.jsx)("div", {
              className:
                "absolute -top-3 left-4 bg-primary px-3 py-1 text-xs font-bold text-background",
              children: "RECOMMENDED",
            }),
          (0, s.jsxs)("div", {
            className: "flex items-center gap-4 mb-4",
            children: [
              (0, s.jsx)("div", {
                className: "text-primary text-3xl",
                children: a,
              }),
              (0, s.jsxs)("div", {
                children: [
                  (0, s.jsxs)("h3", {
                    className: "font-mono text-lg text-primary font-bold",
                    children: ["[ ", e, " ]"],
                  }),
                  (0, s.jsx)("p", {
                    className: "font-mono text-xs text-muted-foreground",
                    children: r,
                  }),
                ],
              }),
            ],
          }),
          (0, s.jsx)("div", {
            className: "space-y-2 mb-4",
            children: t.map((e, a) =>
              (0, s.jsxs)(
                "div",
                {
                  className: "flex items-center gap-2 font-mono text-xs",
                  children: [
                    (0, s.jsx)("span", {
                      className: "text-primary",
                      children: ">",
                    }),
                    (0, s.jsx)("span", {
                      className: "text-muted-foreground",
                      children: e,
                    }),
                  ],
                },
                a,
              ),
            ),
          }),
          (0, s.jsxs)("div", {
            className:
              "font-mono text-sm text-primary group-hover:text-primary transition-colors",
            children: [
              "DEPLOY → ",
              (0, s.jsx)("span", {
                className:
                  "opacity-0 group-hover:opacity-100 transition-opacity",
                children: "▓▓▓",
              }),
            ],
          }),
        ],
      });
    }
    let l = [
      { message: "Initializing deployment...", duration: 1500 },
      { message: "Creating Redis instance...", duration: 2e3 },
      { message: "Setting up PostgreSQL...", duration: 2500 },
      { message: "Building wa-client service...", duration: 3e3 },
      { message: "Configuring control-plane...", duration: 2e3 },
      { message: "Starting verdict-engine...", duration: 2500 },
      { message: "Running health checks...", duration: 1500 },
      { message: "Generating QR code...", duration: 1e3 },
      { message: "DEPLOYMENT COMPLETE", duration: 0 },
    ];
    function o({ isDeploying: e, onComplete: r }) {
      let [t, n] = (0, a.useState)(0),
        [o, d] = (0, a.useState)([]),
        [c, m] = (0, a.useState)(0);
      return ((0, a.useEffect)(() => {
        if (!e) {
          (n(0), d([]), m(0));
          return;
        }
        let s = 0,
          a = 0,
          t = l.reduce((e, s) => e + s.duration, 0),
          i = () => {
            if (s >= l.length) return void r?.();
            let e = l[s],
              o = new Date().toLocaleTimeString("en-US", {
                hour12: !1,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });
            (n(s),
              d((s) => [...s, `[${o}] ${e.message}`]),
              m(Math.min(100, Math.floor(((a += e.duration) / t) * 100))),
              e.duration > 0 &&
                setTimeout(() => {
                  (s++, i());
                }, e.duration));
          };
        i();
      }, [e, r]),
      e || 0 !== o.length)
        ? (0, s.jsxs)("div", {
            className: "border border-primary/40 bg-background",
            children: [
              (0, s.jsxs)("div", {
                className:
                  "border-b border-border bg-primary/5 px-4 py-2 flex items-center justify-between",
                children: [
                  (0, s.jsx)("span", {
                    className: "font-mono text-primary text-sm",
                    children: "┌─ DEPLOYMENT LOG ─┐",
                  }),
                  (0, s.jsxs)("span", {
                    className: "font-mono text-primary/60 text-xs",
                    children: [c, "%"],
                  }),
                ],
              }),
              (0, s.jsx)("div", {
                className: "h-1 bg-background",
                children: (0, s.jsx)("div", {
                  className: "h-full bg-primary transition-all duration-500",
                  style: { width: `${c}%` },
                }),
              }),
              (0, s.jsx)("div", {
                className: "p-4 max-h-64 overflow-y-auto font-mono text-xs",
                children: o.map((a, r) =>
                  (0, s.jsxs)(
                    "div",
                    {
                      className: (0, i.cn)(
                        "py-1",
                        r === o.length - 1 && e && "text-primary",
                        a.includes("COMPLETE") && "text-primary font-bold",
                        !a.includes("COMPLETE") &&
                          !(r === o.length - 1 && e) &&
                          "text-muted-foreground",
                      ),
                      children: [
                        a,
                        r === o.length - 1 &&
                          e &&
                          (0, s.jsx)("span", {
                            className: "cursor-blink ml-1",
                            children: "▊",
                          }),
                      ],
                    },
                    r,
                  ),
                ),
              }),
              (0, s.jsx)("div", {
                className: "border-t border-border px-4 py-2",
                children: (0, s.jsxs)("div", {
                  className: "font-mono text-xs text-primary",
                  children: [
                    "[",
                    (0, s.jsx)("span", {
                      className: "text-primary",
                      children: "▓".repeat(Math.floor(c / 5)),
                    }),
                    (0, s.jsx)("span", {
                      className: "text-primary/20",
                      children: "░".repeat(20 - Math.floor(c / 5)),
                    }),
                    "]",
                  ],
                }),
              }),
            ],
          })
        : null;
    }
    var d = e.i(90905);
    function c({ isVisible: e }) {
      if (!e) return null;
      let a = `2@abc123xyz...${Date.now()}`;
      return (0, s.jsxs)("div", {
        className: "border border-primary bg-background p-6 text-center",
        children: [
          (0, s.jsxs)("div", {
            className: "mb-4",
            children: [
              (0, s.jsx)("div", {
                className: "font-mono text-primary text-lg font-bold mb-2",
                children: "SCAN TO CONNECT WHATSAPP",
              }),
              (0, s.jsx)("div", {
                className: "font-mono text-muted-foreground text-sm",
                children: "Open WhatsApp → Linked Devices → Link a Device",
              }),
            ],
          }),
          (0, s.jsx)("div", {
            className: "flex justify-center py-6",
            children: (0, s.jsx)(d.QRCodeDisplay, { value: a, size: 220 }),
          }),
          (0, s.jsxs)("div", {
            className: "space-y-2 font-mono text-xs text-left max-w-sm mx-auto",
            children: [
              (0, s.jsxs)("div", {
                className: "flex items-start gap-2",
                children: [
                  (0, s.jsx)("span", {
                    className: "text-primary",
                    children: "1.",
                  }),
                  (0, s.jsx)("span", {
                    className: "text-muted-foreground",
                    children: "Open WhatsApp on your phone",
                  }),
                ],
              }),
              (0, s.jsxs)("div", {
                className: "flex items-start gap-2",
                children: [
                  (0, s.jsx)("span", {
                    className: "text-primary",
                    children: "2.",
                  }),
                  (0, s.jsx)("span", {
                    className: "text-muted-foreground",
                    children: "Tap Menu or Settings → Linked Devices",
                  }),
                ],
              }),
              (0, s.jsxs)("div", {
                className: "flex items-start gap-2",
                children: [
                  (0, s.jsx)("span", {
                    className: "text-primary",
                    children: "3.",
                  }),
                  (0, s.jsx)("span", {
                    className: "text-muted-foreground",
                    children: 'Tap "Link a Device" and scan this QR code',
                  }),
                ],
              }),
            ],
          }),
          (0, s.jsxs)("div", {
            className:
              "mt-6 flex items-center justify-center gap-2 font-mono text-xs",
            children: [
              (0, s.jsx)("span", {
                className: "h-2 w-2 rounded-full bg-warning animate-pulse",
              }),
              (0, s.jsx)("span", {
                className: "text-warning",
                children: "WAITING FOR SCAN...",
              }),
            ],
          }),
          (0, s.jsx)("div", {
            className: "mt-4 font-mono text-primary/40 text-xs",
            children: "QR code refreshes every 60 seconds",
          }),
        ],
      });
    }
    let m = () =>
        (0, s.jsx)("svg", {
          viewBox: "0 0 24 24",
          className: "w-8 h-8",
          fill: "currentColor",
          children: (0, s.jsx)("path", {
            d: "M.113 13.029c.063-.024.127-.042.193-.056l.032-.007a1.25 1.25 0 0 1 .229-.021h7.859c.17 0 .327-.065.445-.172l.016-.016a.625.625 0 0 0 .177-.436V4.46a.625.625 0 0 0-.625-.625H.563a.625.625 0 0 0-.563.625v7.944c0 .2.044.39.113.57Zm7.95-2.086H2.188V6.084h5.875v4.859Zm8.363-7.108h-5.875a.625.625 0 0 0-.625.625v7.861c0 .346.28.625.625.625h5.875a.625.625 0 0 0 .625-.625V4.46a.625.625 0 0 0-.625-.625Zm-1.25 6.234h-3.375V6.084h3.375v3.985Zm-6.75 4.875h-7.86a.625.625 0 0 0-.566.891l.004.008c.024.063.042.127.056.193l.007.032c.013.076.021.152.021.229v5.14c0 .346.28.625.625.625h7.86a.625.625 0 0 0 .625-.625v-5.868a.625.625 0 0 0-.625-.625h-.147Zm-1.25 4.865H2.188v-3.365h4.988v3.365Zm10.398-4.865h-5.14a.625.625 0 0 0-.625.625v5.868c0 .346.28.625.625.625h5.14a.625.625 0 0 0 .625-.625v-5.868a.625.625 0 0 0-.625-.625Zm-.875 4.865h-3.39v-3.365h3.39v3.365Zm4.988-10.865h-2.16a.625.625 0 0 0-.625.625v12.867c0 .346.28.625.625.625h2.16a.625.625 0 0 0 .625-.625V9.569a.625.625 0 0 0-.625-.625Z",
          }),
        }),
      x = () =>
        (0, s.jsx)("svg", {
          viewBox: "0 0 24 24",
          className: "w-8 h-8",
          fill: "currentColor",
          children: (0, s.jsx)("path", {
            d: "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.182a9.818 9.818 0 1 1 0 19.636 9.818 9.818 0 0 1 0-19.636zm-.545 4.364a5.455 5.455 0 1 0 0 10.908 5.455 5.455 0 0 0 0-10.908z",
          }),
        }),
      h = () =>
        (0, s.jsx)("svg", {
          viewBox: "0 0 24 24",
          className: "w-8 h-8",
          fill: "currentColor",
          children: (0, s.jsx)("path", {
            d: "M13.983 11.078h2.119a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.119a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 0 0 .186-.186V3.574a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 0 0 .186-.186V6.29a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 0 0 .184-.186V6.29a.185.185 0 0 0-.185-.185H8.1a.185.185 0 0 0-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 0 0 .185-.186V6.29a.185.185 0 0 0-.185-.185H5.136a.186.186 0 0 0-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 0 0 .185-.185V9.006a.185.185 0 0 0-.185-.186H5.136a.186.186 0 0 0-.186.185v1.888c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 0 0-.75.748 11.376 11.376 0 0 0 .692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 0 0 3.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z",
          }),
        });
    function p() {
      let [e, i] = (0, a.useState)(null),
        [l, d] = (0, a.useState)(!1),
        [p, u] = (0, a.useState)(!1),
        g = (e) => {
          (i(e), d(!0), u(!1));
        };
      return (0, s.jsxs)("div", {
        className: "min-h-screen bg-background",
        children: [
          (0, s.jsx)(r.NavBar, {}),
          (0, s.jsxs)("main", {
            className: "container mx-auto px-6 lg:px-10 py-8",
            children: [
              (0, s.jsxs)("div", {
                className: "mb-8",
                children: [
                  (0, s.jsx)("h1", {
                    className:
                      "font-mono text-2xl md:text-3xl text-primary terminal-glow",
                    children: "SELF-HOST DEPLOYMENT",
                  }),
                  (0, s.jsx)("p", {
                    className: "mt-2 font-mono text-muted-foreground text-sm",
                    children:
                      "Deploy your own SafeMode instance with full control",
                  }),
                ],
              }),
              (0, s.jsx)("div", {
                className: "mb-8",
                children: (0, s.jsx)(t.TerminalCard, {
                  title: "SELECT DEPLOYMENT TARGET",
                  variant: "solid",
                  children: (0, s.jsxs)("div", {
                    className: "grid grid-cols-1 md:grid-cols-3 gap-4",
                    children: [
                      (0, s.jsx)(n, {
                        name: "RAILWAY",
                        icon: (0, s.jsx)(m, {}),
                        description: "One-click cloud deployment",
                        features: [
                          "Automatic SSL & domains",
                          "Built-in Redis & Postgres",
                          "Easy scaling",
                          "Free tier available",
                        ],
                        href: "https://railway.app/template/safemode?referralCode=demo",
                        recommended: !0,
                        onClick: () => g("railway"),
                      }),
                      (0, s.jsx)(n, {
                        name: "RENDER",
                        icon: (0, s.jsx)(x, {}),
                        description: "Managed cloud platform",
                        features: [
                          "Blueprint deployment",
                          "Managed databases",
                          "Auto-deploys from Git",
                          "Free tier available",
                        ],
                        href: "https://render.com/deploy?repo=https://github.com/safemode/whatsapp-scanner",
                        onClick: () => g("render"),
                      }),
                      (0, s.jsx)(n, {
                        name: "DOCKER",
                        icon: (0, s.jsx)(h, {}),
                        description: "Self-managed containers",
                        features: [
                          "Full control",
                          "Run anywhere",
                          "Docker Compose ready",
                          "VPS compatible",
                        ],
                        href: "#docker-compose",
                        onClick: () => g("docker"),
                      }),
                    ],
                  }),
                }),
              }),
              (l || p) &&
                (0, s.jsxs)("div", {
                  className: "space-y-6",
                  children: [
                    (0, s.jsx)(o, {
                      isDeploying: l,
                      onComplete: () => {
                        (d(!1), u(!0));
                      },
                    }),
                    (0, s.jsx)(c, { isVisible: p }),
                  ],
                }),
              (0, s.jsx)("div", {
                id: "docker-compose",
                className: "mt-8",
                children: (0, s.jsx)(t.TerminalCard, {
                  title: "DOCKER COMPOSE SETUP",
                  variant: "glass",
                  children: (0, s.jsxs)("div", {
                    className: "space-y-4",
                    children: [
                      (0, s.jsx)("p", {
                        className: "font-mono text-muted-foreground text-sm",
                        children: "For manual deployment, use Docker Compose:",
                      }),
                      (0, s.jsx)("div", {
                        className:
                          "bg-background border border-border p-4 overflow-x-auto",
                        children: (0, s.jsx)("pre", {
                          className: "font-mono text-xs text-primary/80",
                          children: `# Clone the repository
git clone https://github.com/safemode/whatsapp-scanner.git
cd whatsapp-scanner

# Copy environment template
cp .env.example .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f wa-client`,
                        }),
                      }),
                      (0, s.jsxs)("div", {
                        className: "space-y-2 font-mono text-xs",
                        children: [
                          (0, s.jsx)("div", {
                            className: "text-muted-foreground",
                            children: "Required environment variables:",
                          }),
                          (0, s.jsx)("div", {
                            className: "grid grid-cols-1 md:grid-cols-2 gap-2",
                            children: [
                              "REDIS_URL",
                              "DATABASE_URL",
                              "VIRUSTOTAL_API_KEY",
                              "GOOGLE_SAFE_BROWSING_KEY",
                            ].map((e) =>
                              (0, s.jsxs)(
                                "div",
                                {
                                  className: "flex items-center gap-2",
                                  children: [
                                    (0, s.jsx)("span", {
                                      className: "text-primary",
                                      children: ">",
                                    }),
                                    (0, s.jsx)("code", {
                                      className: "text-muted-foreground",
                                      children: e,
                                    }),
                                  ],
                                },
                                e,
                              ),
                            ),
                          }),
                        ],
                      }),
                    ],
                  }),
                }),
              }),
              (0, s.jsx)("div", {
                className: "mt-8",
                children: (0, s.jsx)(t.TerminalCard, {
                  title: "SYSTEM REQUIREMENTS",
                  variant: "glass",
                  children: (0, s.jsxs)("div", {
                    className:
                      "grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs",
                    children: [
                      (0, s.jsxs)("div", {
                        children: [
                          (0, s.jsx)("div", {
                            className: "text-primary font-bold mb-2",
                            children: "MINIMUM",
                          }),
                          (0, s.jsxs)("div", {
                            className: "space-y-1 text-muted-foreground",
                            children: [
                              (0, s.jsx)("div", { children: "> 1 vCPU" }),
                              (0, s.jsx)("div", { children: "> 1GB RAM" }),
                              (0, s.jsx)("div", { children: "> 10GB Storage" }),
                            ],
                          }),
                        ],
                      }),
                      (0, s.jsxs)("div", {
                        children: [
                          (0, s.jsx)("div", {
                            className: "text-primary font-bold mb-2",
                            children: "RECOMMENDED",
                          }),
                          (0, s.jsxs)("div", {
                            className: "space-y-1 text-muted-foreground",
                            children: [
                              (0, s.jsx)("div", { children: "> 2 vCPU" }),
                              (0, s.jsx)("div", { children: "> 2GB RAM" }),
                              (0, s.jsx)("div", { children: "> 20GB SSD" }),
                            ],
                          }),
                        ],
                      }),
                      (0, s.jsxs)("div", {
                        children: [
                          (0, s.jsx)("div", {
                            className: "text-primary font-bold mb-2",
                            children: "SERVICES",
                          }),
                          (0, s.jsxs)("div", {
                            className: "space-y-1 text-muted-foreground",
                            children: [
                              (0, s.jsx)("div", { children: "> Redis 7+" }),
                              (0, s.jsx)("div", {
                                children: "> PostgreSQL 15+",
                              }),
                              (0, s.jsx)("div", { children: "> Node.js 20+" }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                }),
              }),
              (0, s.jsx)("footer", {
                className:
                  "mt-12 text-center font-mono text-primary/40 text-xs",
                children: (0, s.jsxs)("p", {
                  children: [
                    "Documentation:",
                    " ",
                    (0, s.jsx)("a", {
                      href: "https://docs.safemode.app",
                      className: "hover:text-primary/60 underline focus-ring",
                      children: "docs.safemode.app",
                    }),
                  ],
                }),
              }),
            ],
          }),
        ],
      });
    }
    e.s(["default", () => p], 21518);
  },
]);
