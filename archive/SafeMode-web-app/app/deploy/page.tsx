"use client"

import { useState } from "react"
import { NavBar } from "@/components/safemode/nav-bar"
import { TerminalCard } from "@/components/safemode/terminal-card"
import { DeployCard } from "@/components/safemode/deploy-card"
import { DeployProgress } from "@/components/safemode/deploy-progress"
import { QRScannerPrompt } from "@/components/safemode/qr-scanner-prompt"

// Icons
const RailwayIcon = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
    <path d="M.113 13.029c.063-.024.127-.042.193-.056l.032-.007a1.25 1.25 0 0 1 .229-.021h7.859c.17 0 .327-.065.445-.172l.016-.016a.625.625 0 0 0 .177-.436V4.46a.625.625 0 0 0-.625-.625H.563a.625.625 0 0 0-.563.625v7.944c0 .2.044.39.113.57Zm7.95-2.086H2.188V6.084h5.875v4.859Zm8.363-7.108h-5.875a.625.625 0 0 0-.625.625v7.861c0 .346.28.625.625.625h5.875a.625.625 0 0 0 .625-.625V4.46a.625.625 0 0 0-.625-.625Zm-1.25 6.234h-3.375V6.084h3.375v3.985Zm-6.75 4.875h-7.86a.625.625 0 0 0-.566.891l.004.008c.024.063.042.127.056.193l.007.032c.013.076.021.152.021.229v5.14c0 .346.28.625.625.625h7.86a.625.625 0 0 0 .625-.625v-5.868a.625.625 0 0 0-.625-.625h-.147Zm-1.25 4.865H2.188v-3.365h4.988v3.365Zm10.398-4.865h-5.14a.625.625 0 0 0-.625.625v5.868c0 .346.28.625.625.625h5.14a.625.625 0 0 0 .625-.625v-5.868a.625.625 0 0 0-.625-.625Zm-.875 4.865h-3.39v-3.365h3.39v3.365Zm4.988-10.865h-2.16a.625.625 0 0 0-.625.625v12.867c0 .346.28.625.625.625h2.16a.625.625 0 0 0 .625-.625V9.569a.625.625 0 0 0-.625-.625Z" />
  </svg>
)

const RenderIcon = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.182a9.818 9.818 0 1 1 0 19.636 9.818 9.818 0 0 1 0-19.636zm-.545 4.364a5.455 5.455 0 1 0 0 10.908 5.455 5.455 0 0 0 0-10.908z" />
  </svg>
)

const DockerIcon = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
    <path d="M13.983 11.078h2.119a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.119a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 0 0 .186-.186V3.574a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 0 0 .186-.186V6.29a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 0 0 .184-.186V6.29a.185.185 0 0 0-.185-.185H8.1a.185.185 0 0 0-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 0 0 .185-.186V6.29a.185.185 0 0 0-.185-.185H5.136a.186.186 0 0 0-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 0 0 .185-.185V9.006a.185.185 0 0 0-.185-.186H5.136a.186.186 0 0 0-.186.185v1.888c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 0 0-.75.748 11.376 11.376 0 0 0 .692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 0 0 3.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z" />
  </svg>
)

// Template URLs (placeholders for proof of concept)
const RAILWAY_TEMPLATE_URL = "https://railway.app/template/safemode?referralCode=demo"
const RENDER_DEPLOY_URL = "https://render.com/deploy?repo=https://github.com/safemode/whatsapp-scanner"
const DOCKER_DOCS_URL = "#docker-compose"

export default function DeployPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [isDeploying, setIsDeploying] = useState(false)
  const [showQR, setShowQR] = useState(false)

  const handleDeployClick = (platform: string) => {
    setSelectedPlatform(platform)
    setIsDeploying(true)
    setShowQR(false)
  }

  const handleDeployComplete = () => {
    setIsDeploying(false)
    setShowQR(true)
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <main className="container mx-auto px-6 lg:px-10 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-mono text-2xl md:text-3xl text-primary terminal-glow">SELF-HOST DEPLOYMENT</h1>
          <p className="mt-2 font-mono text-muted-foreground text-sm">
            Deploy your own SafeMode instance with full control
          </p>
        </div>

        {/* Platform Selection */}
        <div className="mb-8">
          <TerminalCard title="SELECT DEPLOYMENT TARGET" variant="solid">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DeployCard
                name="RAILWAY"
                icon={<RailwayIcon />}
                description="One-click cloud deployment"
                features={[
                  "Automatic SSL & domains",
                  "Built-in Redis & Postgres",
                  "Easy scaling",
                  "Free tier available",
                ]}
                href={RAILWAY_TEMPLATE_URL}
                recommended
                onClick={() => handleDeployClick("railway")}
              />

              <DeployCard
                name="RENDER"
                icon={<RenderIcon />}
                description="Managed cloud platform"
                features={["Blueprint deployment", "Managed databases", "Auto-deploys from Git", "Free tier available"]}
                href={RENDER_DEPLOY_URL}
                onClick={() => handleDeployClick("render")}
              />

              <DeployCard
                name="DOCKER"
                icon={<DockerIcon />}
                description="Self-managed containers"
                features={["Full control", "Run anywhere", "Docker Compose ready", "VPS compatible"]}
                href={DOCKER_DOCS_URL}
                onClick={() => handleDeployClick("docker")}
              />
            </div>
          </TerminalCard>
        </div>

        {/* Deployment Progress */}
        {(isDeploying || showQR) && (
          <div className="space-y-6">
            <DeployProgress isDeploying={isDeploying} onComplete={handleDeployComplete} />
            <QRScannerPrompt isVisible={showQR} />
          </div>
        )}

        {/* Docker Compose Section */}
        <div id="docker-compose" className="mt-8">
          <TerminalCard title="DOCKER COMPOSE SETUP" variant="glass">
            <div className="space-y-4">
              <p className="font-mono text-muted-foreground text-sm">For manual deployment, use Docker Compose:</p>

              <div className="bg-background border border-border p-4 overflow-x-auto">
                <pre className="font-mono text-xs text-primary/80">
                  {`# Clone the repository
git clone https://github.com/safemode/whatsapp-scanner.git
cd whatsapp-scanner

# Copy environment template
cp .env.example .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f wa-client`}
                </pre>
              </div>

              <div className="space-y-2 font-mono text-xs">
                <div className="text-muted-foreground">Required environment variables:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {["REDIS_URL", "DATABASE_URL", "VIRUSTOTAL_API_KEY", "GOOGLE_SAFE_BROWSING_KEY"].map((env) => (
                    <div key={env} className="flex items-center gap-2">
                      <span className="text-primary">{`>`}</span>
                      <code className="text-muted-foreground">{env}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TerminalCard>
        </div>

        {/* Requirements */}
        <div className="mt-8">
          <TerminalCard title="SYSTEM REQUIREMENTS" variant="glass">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
              <div>
                <div className="text-primary font-bold mb-2">MINIMUM</div>
                <div className="space-y-1 text-muted-foreground">
                  <div>{`> 1 vCPU`}</div>
                  <div>{`> 1GB RAM`}</div>
                  <div>{`> 10GB Storage`}</div>
                </div>
              </div>
              <div>
                <div className="text-primary font-bold mb-2">RECOMMENDED</div>
                <div className="space-y-1 text-muted-foreground">
                  <div>{`> 2 vCPU`}</div>
                  <div>{`> 2GB RAM`}</div>
                  <div>{`> 20GB SSD`}</div>
                </div>
              </div>
              <div>
                <div className="text-primary font-bold mb-2">SERVICES</div>
                <div className="space-y-1 text-muted-foreground">
                  <div>{`> Redis 7+`}</div>
                  <div>{`> PostgreSQL 15+`}</div>
                  <div>{`> Node.js 20+`}</div>
                </div>
              </div>
            </div>
          </TerminalCard>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center font-mono text-primary/40 text-xs">
          <p>
            Documentation:{" "}
            <a href="https://docs.safemode.app" className="hover:text-primary/60 underline focus-ring">
              docs.safemode.app
            </a>
          </p>
        </footer>
      </main>
    </div>
  )
}
