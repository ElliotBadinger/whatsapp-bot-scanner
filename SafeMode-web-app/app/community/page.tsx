import { NavBar } from "@/components/safemode/nav-bar";
import { TerminalCard } from "@/components/safemode/terminal-card";
import { QRCodeDisplay } from "@/components/safemode/qr-code";
import { LiveFeed } from "@/components/safemode/live-feed";
import { StatsDisplay } from "@/components/safemode/stats-display";
import { getPublicEnv } from "@/lib/public-env";

const {
  NEXT_PUBLIC_BOT_PHONE_NUMBER: BOT_PHONE,
  NEXT_PUBLIC_WA_ME_LINK: WA_ME_LINK,
} = getPublicEnv();

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <main className="container mx-auto px-6 lg:px-10 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-mono text-2xl md:text-3xl text-primary terminal-glow">
            COMMUNITY BOT SETUP
          </h1>
          <p className="mt-2 font-mono text-muted-foreground text-sm">
            Add SafeMode to your WhatsApp group in seconds
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Setup Instructions */}
          <div className="space-y-6">
            <TerminalCard title="STEP 1: ADD BOT TO GROUP" variant="solid">
              <div className="space-y-6">
                {/* Option A: Direct Link */}
                <div>
                  <div className="text-secondary text-sm mb-3">
                    Option A: Tap to add
                  </div>
                  <a
                    href={WA_ME_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 border-2 border-primary bg-primary/10 px-6 py-3 font-mono text-primary hover:bg-primary/20 transition-all focus-ring"
                  >
                    <span className="text-lg">[</span>
                    <span>Add {BOT_PHONE} →</span>
                    <span className="text-lg">]</span>
                  </a>
                  <p className="mt-2 text-primary/40 text-xs">
                    Opens WhatsApp with pre-filled message
                  </p>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-4">
                  <div className="flex-1 border-t border-border" />
                  <span className="text-primary/40 text-xs">OR</span>
                  <div className="flex-1 border-t border-border" />
                </div>

                {/* Option B: QR Code */}
                <div>
                  <div className="text-secondary text-sm mb-3">
                    Option B: Scan QR Code
                  </div>
                  <div className="flex justify-center py-4">
                    <QRCodeDisplay value={WA_ME_LINK} size={180} />
                  </div>
                  <p className="mt-2 text-primary/40 text-xs text-center">
                    Scan with your phone camera
                  </p>
                </div>
              </div>
            </TerminalCard>

            <TerminalCard title="STEP 2: ADD TO GROUP" variant="solid">
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <span className="text-primary">{`>`}</span>
                  <span className="text-muted-foreground">
                    Open the chat with SafeMode bot
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-primary">{`>`}</span>
                  <span className="text-muted-foreground">
                    Tap the group name at the top
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-primary">{`>`}</span>
                  <span className="text-muted-foreground">
                    Select "Add to Group" and choose your group
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-primary">{`>`}</span>
                  <span className="text-muted-foreground">
                    Make SafeMode an admin for full protection
                  </span>
                </div>
              </div>
            </TerminalCard>

            <TerminalCard title="COMMANDS" variant="glass">
              <div className="space-y-2 text-xs font-mono">
                <div className="flex gap-4">
                  <span className="text-primary w-24">!scan {"<url>"}</span>
                  <span className="text-muted-foreground">
                    Force scan a link
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="text-primary w-24">!status</span>
                  <span className="text-muted-foreground">Show bot status</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-primary w-24">!help</span>
                  <span className="text-muted-foreground">
                    List all commands
                  </span>
                </div>
              </div>
            </TerminalCard>
          </div>

          {/* Live Feed & Stats */}
          <div className="space-y-6">
            <TerminalCard title="SYSTEM METRICS" variant="solid">
              <StatsDisplay />
            </TerminalCard>

            <LiveFeed maxItems={10} />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center font-mono text-primary/40 text-xs">
          <p>
            Need help?{" "}
            <a
              href="mailto:support@safemode.app"
              className="hover:text-primary/60 underline focus-ring"
            >
              support@safemode.app
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
