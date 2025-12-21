"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, muteGroup, unmuteGroup } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Group {
  id: string;
  name: string;
  members: number;
  scansTotal: number;
  threatsBlocked: number;
  isMuted: boolean;
}

// Mock data
const mockGroups: Group[] = [
  {
    id: "1",
    name: "Family Chat",
    members: 12,
    scansTotal: 156,
    threatsBlocked: 3,
    isMuted: false,
  },
  {
    id: "2",
    name: "Work Team",
    members: 45,
    scansTotal: 892,
    threatsBlocked: 15,
    isMuted: false,
  },
  {
    id: "3",
    name: "Gaming Squad",
    members: 8,
    scansTotal: 234,
    threatsBlocked: 7,
    isMuted: true,
  },
  {
    id: "4",
    name: "Crypto Traders",
    members: 128,
    scansTotal: 2341,
    threatsBlocked: 89,
    isMuted: false,
  },
  {
    id: "5",
    name: "School Group",
    members: 67,
    scansTotal: 445,
    threatsBlocked: 12,
    isMuted: false,
  },
];

export function GroupsManager() {
  const [groups, setGroups] = useState<Group[]>(mockGroups);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSetMute = async (groupId: string, nextIsMuted: boolean) => {
    if (loadingId !== null) return;

    const group = groups.find((candidate) => candidate.id === groupId);
    if (!group) {
      setNotice(null);
      setError(`REQUEST_FAILED: Unknown group ${groupId}`);
      return;
    }
    const groupName = group.name;

    setLoadingId(groupId);
    setNotice(null);
    setError(null);
    try {
      if (nextIsMuted) {
        const result = await muteGroup(groupId);
        const parsedUntil = new Date(result.muted_until);
        const until = Number.isNaN(parsedUntil.getTime())
          ? null
          : parsedUntil.toLocaleString();
        setNotice(
          until
            ? `MUTE_OK: ${groupName} muted until ${until}`
            : `MUTE_OK: ${groupName} muted`,
        );
      } else {
        await unmuteGroup(groupId);
        setNotice(`UNMUTE_OK: ${groupName} unmuted`);
      }

      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId ? { ...g, isMuted: nextIsMuted } : g,
        ),
      );
    } catch (err) {
      if (err instanceof ApiError) {
        const code = err.code ? `${err.code}: ` : "";
        setError(`REQUEST_FAILED: ${code}${err.message}`);
      } else {
        setError("REQUEST_FAILED: Unable to update group");
      }
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="font-mono text-2xl text-primary font-bold">
            {groups.length}
          </div>
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
        {notice && (
          <div className="px-4 py-3 font-mono text-xs text-success/80 border-b border-border bg-success/5">
            {notice}
          </div>
        )}
        {error && (
          <div className="px-4 py-3 font-mono text-xs text-danger/80 border-b border-border bg-danger/5">
            {error}
          </div>
        )}
        {groups.map((group) => (
          <div
            key={group.id}
            className="flex items-center justify-between px-4 py-3 hover:bg-primary/5 transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-secondary">
                  {group.name}
                </span>
                {group.isMuted && (
                  <span className="px-2 py-0.5 bg-warning/10 text-warning text-xs font-mono">
                    MUTED
                  </span>
                )}
              </div>
              <div className="font-mono text-xs text-muted-foreground/60 mt-1">
                {group.members} members • {group.scansTotal} scans •{" "}
                {group.threatsBlocked} threats
              </div>
            </div>
            <Button
              onClick={() => handleSetMute(group.id, !group.isMuted)}
              disabled={loadingId !== null}
              variant="outline"
              size="sm"
              className={cn(
                "font-mono text-xs focus-ring",
                group.isMuted
                  ? "border-primary/40 text-primary hover:bg-primary/10"
                  : "border-warning/40 text-warning hover:bg-warning/10",
              )}
            >
              {loadingId === group.id
                ? "..."
                : group.isMuted
                  ? "[ UNMUTE ]"
                  : "[ MUTE ]"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
