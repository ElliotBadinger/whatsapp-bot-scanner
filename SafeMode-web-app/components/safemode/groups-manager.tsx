"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { muteGroup } from "@/lib/api"
import { cn } from "@/lib/utils"

interface Group {
  id: string
  name: string
  members: number
  scansTotal: number
  threatsBlocked: number
  isMuted: boolean
}

// Mock data
const mockGroups: Group[] = [
  { id: "1", name: "Family Chat", members: 12, scansTotal: 156, threatsBlocked: 3, isMuted: false },
  { id: "2", name: "Work Team", members: 45, scansTotal: 892, threatsBlocked: 15, isMuted: false },
  { id: "3", name: "Gaming Squad", members: 8, scansTotal: 234, threatsBlocked: 7, isMuted: true },
  { id: "4", name: "Crypto Traders", members: 128, scansTotal: 2341, threatsBlocked: 89, isMuted: false },
  { id: "5", name: "School Group", members: 67, scansTotal: 445, threatsBlocked: 12, isMuted: false },
]

export function GroupsManager() {
  const [groups, setGroups] = useState<Group[]>(mockGroups)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleToggleMute = async (groupId: string) => {
    setLoadingId(groupId)
    try {
      await muteGroup(groupId)
      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, isMuted: !g.isMuted } : g)))
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="font-mono text-2xl text-primary font-bold">{groups.length}</div>
          <div className="font-mono text-xs text-primary/60">GROUPS</div>
        </div>
        <div className="text-center">
          <div className="font-mono text-2xl text-primary font-bold">
            {groups.reduce((acc, g) => acc + g.members, 0)}
          </div>
          <div className="font-mono text-xs text-primary/60">MEMBERS</div>
        </div>
        <div className="text-center">
          <div className="font-mono text-2xl text-danger font-bold">
            {groups.reduce((acc, g) => acc + g.threatsBlocked, 0)}
          </div>
          <div className="font-mono text-xs text-danger/60">THREATS</div>
        </div>
      </div>

      {/* Groups list */}
      <div className="border border-border divide-y divide-border">
        {groups.map((group) => (
          <div
            key={group.id}
            className="flex items-center justify-between px-4 py-3 hover:bg-primary/5 transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-secondary">{group.name}</span>
                {group.isMuted && (
                  <span className="px-2 py-0.5 bg-warning/10 text-warning text-xs font-mono">MUTED</span>
                )}
              </div>
              <div className="font-mono text-xs text-muted-foreground/60 mt-1">
                {group.members} members • {group.scansTotal} scans • {group.threatsBlocked} threats
              </div>
            </div>
            <Button
              onClick={() => handleToggleMute(group.id)}
              disabled={loadingId === group.id}
              variant="outline"
              size="sm"
              className={cn(
                "font-mono text-xs focus-ring",
                group.isMuted
                  ? "border-primary/40 text-primary hover:bg-primary/10"
                  : "border-warning/40 text-warning hover:bg-warning/10",
              )}
            >
              {loadingId === group.id ? "..." : group.isMuted ? "[ UNMUTE ]" : "[ MUTE ]"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
