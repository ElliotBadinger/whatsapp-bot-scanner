import Link from "next/link"
import { NavBar } from "@/components/safemode/nav-bar"
import { CRTMonitor } from "@/components/safemode/crt-monitor"
import { StatsDisplay } from "@/components/safemode/stats-display"
import { SafeModeCard, CardBadge } from "@/components/safemode/card"
import { SafeModeButton } from "@/components/safemode/button"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <main>
        {/* Hero Section */}
        <section className="py-12 lg:py-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-10">
            {/* Page Title */}
            <div className="text-center mb-12 lg:mb-16">
              <h1 className="font-mono text-2xl lg:text-4xl text-primary tracking-wider uppercase mb-4 terminal-glow">
                INDUSTRIAL-GRADE LINK SCANNING
              </h1>
              <p className="font-mono text-sm lg:text-base text-muted-foreground max-w-2xl mx-auto">
                Protect WhatsApp groups from phishing & malware with automated threat detection
              </p>
            </div>

            {/* CRT Monitor with CTAs */}
            <CRTMonitor>
              {/* ASCII Header */}
              <pre
                className="font-mono text-xs sm:text-sm lg:text-base text-primary leading-tight text-center mb-8 overflow-x-auto"
                aria-label="SafeMode Security Protocol banner"
              >
                {`╔════════════════════════════════════════════════╗
║  SAFEMODE SECURITY PROTOCOL                    ║
║  INDUSTRIAL-GRADE LINK SCANNING                ║
╚════════════════════════════════════════════════╝`}
              </pre>

              <p className="font-mono text-sm text-muted-foreground text-center mb-10 lg:mb-16">
                Industrial-Grade Link Scanning for WhatsApp Groups
              </p>

              {/* CTA Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Community Bot Card - Recommended */}
                <SafeModeCard variant="highlighted" className="p-6 lg:p-8">
                  <CardBadge>✓ RECOMMENDED</CardBadge>

                  <h3 className="font-mono text-lg lg:text-xl font-bold text-primary mb-2 mt-2">USE COMMUNITY BOT</h3>

                  <p className="font-mono text-xs text-muted-foreground mb-4">Zero Setup Required</p>

                  <ul className="space-y-2 font-mono text-sm text-muted-foreground mb-6" aria-label="Benefits">
                    <li>✓ Free forever</li>
                    <li>✓ No hosting needed</li>
                    <li>✓ 1-minute setup</li>
                  </ul>

                  <Link href="/community">
                    <SafeModeButton variant="primary" className="w-full">
                      Get Started
                    </SafeModeButton>
                  </Link>
                </SafeModeCard>

                {/* Self-Host Card */}
                <SafeModeCard className="p-6 lg:p-8">
                  <h3 className="font-mono text-lg lg:text-xl font-medium text-muted-foreground mb-2">
                    DEPLOY YOUR OWN →
                  </h3>

                  <p className="font-mono text-xs text-muted-foreground mb-4">Advanced Users</p>

                  <ul className="space-y-2 font-mono text-sm text-muted-foreground mb-6" aria-label="Benefits">
                    <li>✓ Full control</li>
                    <li>✓ Your data stays yours</li>
                    <li>✓ Self-hosted infrastructure</li>
                  </ul>

                  <Link href="/deploy">
                    <SafeModeButton variant="secondary" className="w-full">
                      Learn More
                    </SafeModeButton>
                  </Link>
                </SafeModeCard>
              </div>
            </CRTMonitor>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-8 lg:py-12">
          <div className="max-w-7xl mx-auto px-6 lg:px-10">
            <StatsDisplay />
          </div>
        </section>

        {/* Status Bar */}
        <div className="bg-card/80 border-t border-border py-5 text-center">
          <div className="flex items-center justify-center gap-3">
            <div
              className="w-2 h-2 bg-primary rounded-full shadow-[0_0_10px_var(--color-primary-glow)] pulse-led"
              aria-hidden="true"
            />
            <span className="font-mono text-sm font-medium text-primary tracking-wide">
              SYSTEM STATUS: SCANNING 24/7
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
