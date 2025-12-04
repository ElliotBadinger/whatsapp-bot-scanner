import type React from "react"
import type { Metadata, Viewport } from "next"
import { IBM_Plex_Mono, VT323 } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

// Optimize font loading with display swap and preload
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"], // Reduced from 4 weights to 2 (regular + semibold)
  variable: "--font-ibm-plex-mono",
  display: "swap", // Prevent FOIT (Flash of Invisible Text)
  preload: true,
})

const vt323 = VT323({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-vt323",
  display: "swap",
  preload: true,
})

export const metadata: Metadata = {
  title: "SafeMode - Industrial-Grade WhatsApp Security",
  description:
    "Industrial-grade link scanning for WhatsApp groups. Protect your community from phishing, malware, and malicious links.",
  generator: "SafeMode Security Protocol",
  keywords: ["WhatsApp", "security", "link scanner", "phishing protection", "malware detection"],
  authors: [{ name: "SafeMode" }],
  openGraph: {
    title: "SafeMode - Industrial-Grade WhatsApp Security",
    description: "Industrial-grade link scanning for WhatsApp groups.",
    type: "website",
    siteName: "SafeMode",
  },
  twitter: {
    card: "summary_large_image",
    title: "SafeMode - Industrial-Grade WhatsApp Security",
    description: "Industrial-grade link scanning for WhatsApp groups.",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  themeColor: "#0D1117",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Preconnect to critical origins for faster resource loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* DNS prefetch for API endpoints */}
        <link rel="dns-prefetch" href="//localhost:8080" />
      </head>
      <body className={`${ibmPlexMono.variable} ${vt323.variable} font-sans antialiased min-h-screen`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
