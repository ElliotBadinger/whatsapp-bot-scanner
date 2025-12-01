import type React from "react";
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, VT323 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-mono",
});

const vt323 = VT323({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-vt323",
});

export const metadata: Metadata = {
  title: "SafeMode - Industrial-Grade WhatsApp Security",
  description:
    "Industrial-grade link scanning for WhatsApp groups. Protect your community from phishing, malware, and malicious links.",
  generator: "SafeMode Security Protocol",
  keywords: [
    "WhatsApp",
    "security",
    "link scanner",
    "phishing protection",
    "malware detection",
  ],
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
};

export const viewport: Viewport = {
  themeColor: "#0D1117",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${ibmPlexMono.variable} ${vt323.variable} font-sans antialiased min-h-screen`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
