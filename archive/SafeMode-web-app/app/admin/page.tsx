"use client";

import { useState } from "react";
import { NavBar } from "@/components/safemode/nav-bar";
import { TerminalCard } from "@/components/safemode/terminal-card";
import { StatsDisplay } from "@/components/safemode/stats-display";
import { LiveFeed } from "@/components/safemode/live-feed";
import { RescanForm } from "@/components/safemode/rescan-form";
import { OverridesTable } from "@/components/safemode/overrides-table";
import { GroupsManager } from "@/components/safemode/groups-manager";
import { AdminAuth } from "@/components/safemode/admin-auth";
import { cn } from "@/lib/utils";

type Tab = "overview" | "rescan" | "overrides" | "groups";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  if (!isAuthenticated) {
    return <AdminAuth onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "OVERVIEW" },
    { id: "rescan", label: "RESCAN" },
    { id: "overrides", label: "OVERRIDES" },
    { id: "groups", label: "GROUPS" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <main className="container mx-auto px-6 lg:px-10 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-mono text-2xl md:text-3xl text-primary terminal-glow">
              ADMIN CONTROL PANEL
            </h1>
          </div>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="font-mono text-xs text-danger/60 hover:text-danger transition-colors focus-ring px-3 py-1.5 border border-danger/30 hover:border-danger/60"
          >
            [ LOGOUT ]
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={cn(
                "px-4 py-2 font-mono text-sm whitespace-nowrap transition-all focus-ring",
                activeTab === tab.id
                  ? "bg-primary text-background font-bold"
                  : "border border-border text-primary/60 hover:border-primary/60 hover:text-primary",
              )}
            >
              [ {tab.label} ]
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6" role="tabpanel">
          {activeTab === "overview" && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TerminalCard title="SYSTEM METRICS" variant="solid">
                  <StatsDisplay />
                </TerminalCard>

                <TerminalCard title="QUICK ACTIONS" variant="solid">
                  <div className="space-y-3">
                    {[
                      { tab: "rescan" as Tab, label: "Force rescan a URL" },
                      {
                        tab: "overrides" as Tab,
                        label: "Manage URL overrides",
                      },
                      { tab: "groups" as Tab, label: "View protected groups" },
                    ].map((action) => (
                      <button
                        key={action.tab}
                        onClick={() => setActiveTab(action.tab)}
                        className="w-full text-left px-4 py-3 border border-border hover:border-primary/40 hover:bg-primary/5 transition-all font-mono text-sm focus-ring"
                      >
                        <span className="text-primary">{`>`}</span>
                        <span className="text-muted-foreground ml-2">
                          {action.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </TerminalCard>
              </div>

              <LiveFeed maxItems={6} />
            </>
          )}

          {activeTab === "rescan" && (
            <TerminalCard title="FORCE URL RESCAN" variant="solid">
              <div className="space-y-4">
                <p className="font-mono text-sm text-muted-foreground">
                  Force a fresh scan of any URL, bypassing cache. Results will
                  be updated immediately.
                </p>
                <RescanForm />
              </div>
            </TerminalCard>
          )}

          {activeTab === "overrides" && (
            <TerminalCard title="URL PATTERN OVERRIDES" variant="solid">
              <div className="space-y-4">
                <p className="font-mono text-sm text-muted-foreground">
                  Configure manual allow/block rules that override automatic
                  scanning results.
                </p>
                <OverridesTable />
              </div>
            </TerminalCard>
          )}

          {activeTab === "groups" && (
            <TerminalCard title="PROTECTED GROUPS" variant="solid">
              <div className="space-y-4">
                <p className="font-mono text-sm text-muted-foreground">
                  Manage WhatsApp groups protected by SafeMode. Muted groups
                  will not receive bot messages.
                </p>
                <GroupsManager />
              </div>
            </TerminalCard>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center font-mono text-primary/40 text-xs">
          <p>SafeMode Admin Panel v1.0.0</p>
        </footer>
      </main>
    </div>
  );
}
