"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navLinks = [
  { href: "/", label: "HOME" },
  { href: "/community", label: "COMMUNITY" },
  { href: "/deploy", label: "DEPLOY" },
  { href: "/admin", label: "ADMIN" },
]

export function NavBar() {
  const pathname = usePathname()

  return (
    <nav className="h-16 bg-background/95 border-b border-border backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-full flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="font-mono text-xl lg:text-2xl text-primary tracking-wider drop-shadow-[0_0_10px_var(--color-primary-glow)] hover:drop-shadow-[0_0_20px_var(--color-primary-glow)] transition-all duration-200 focus-ring"
        >
          SAFEMODE
        </Link>

        {/* Nav Links */}
        <div className="flex gap-4 lg:gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "font-mono text-sm font-medium transition-all duration-200 focus-ring",
                pathname === link.href
                  ? "text-primary drop-shadow-[0_0_10px_var(--color-primary-glow)]"
                  : "text-muted-foreground hover:text-primary",
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
