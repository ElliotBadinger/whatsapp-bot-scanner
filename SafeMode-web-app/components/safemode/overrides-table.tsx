"use client";

import type React from "react";
import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getOverrides, addOverride, type Override } from "@/lib/api";
import { cn } from "@/lib/utils";

export function OverridesTable() {
  const { data: overrides, mutate } = useSWR<Override[]>(
    "overrides",
    getOverrides,
  );
  const [isAdding, setIsAdding] = useState(false);
  const [newPattern, setNewPattern] = useState("");
  const [newAction, setNewAction] = useState<"allow" | "block">("block");
  const [newReason, setNewReason] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPattern.trim()) return;

    const override = await addOverride(newPattern, newAction, newReason);
    mutate([...(overrides || []), override]);
    setNewPattern("");
    setNewReason("");
    setIsAdding(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-primary text-sm">
          ACTIVE OVERRIDES: {overrides?.length || 0}
        </span>
        <Button
          onClick={() => setIsAdding(!isAdding)}
          variant="outline"
          size="sm"
          className="border-primary/40 text-primary hover:bg-primary/10 font-mono text-xs focus-ring"
        >
          {isAdding ? "[ CANCEL ]" : "[ + ADD ]"}
        </Button>
      </div>

      {/* Add form */}
      {isAdding && (
        <form
          onSubmit={handleAdd}
          className="border border-border bg-background/50 p-4 space-y-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              placeholder="Pattern (e.g., *.example.com)"
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              className="bg-background border-border text-secondary placeholder:text-muted-foreground/30 font-mono text-xs focus-ring"
            />
            <select
              value={newAction}
              onChange={(e) =>
                setNewAction(e.target.value as "allow" | "block")
              }
              className="bg-background border border-border text-secondary font-mono text-xs px-3 py-2 rounded-md focus-ring"
            >
              <option value="block">BLOCK</option>
              <option value="allow">ALLOW</option>
            </select>
            <Input
              placeholder="Reason"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              className="bg-background border-border text-secondary placeholder:text-muted-foreground/30 font-mono text-xs focus-ring"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            className="bg-primary text-background hover:bg-primary/80 font-mono text-xs"
          >
            [ SAVE OVERRIDE ]
          </Button>
        </form>
      )}

      {/* Table */}
      <div className="border border-border overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-4 gap-2 bg-primary/5 px-4 py-2 font-mono text-xs text-primary/70 border-b border-border">
          <span>PATTERN</span>
          <span>ACTION</span>
          <span>REASON</span>
          <span>CREATED</span>
        </div>

        {/* Table body */}
        <div className="divide-y divide-border">
          {overrides?.map((override) => (
            <div
              key={override.id}
              className="grid grid-cols-4 gap-2 px-4 py-3 font-mono text-xs hover:bg-primary/5 transition-colors"
            >
              <span className="text-secondary truncate">
                {override.pattern}
              </span>
              <span
                className={cn(
                  override.action === "allow" ? "text-success" : "text-danger",
                )}
              >
                {override.action.toUpperCase()}
              </span>
              <span className="text-muted-foreground truncate">
                {override.reason}
              </span>
              <span className="text-muted-foreground/60">
                {new Date(override.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}

          {(!overrides || overrides.length === 0) && (
            <div className="px-4 py-8 text-center font-mono text-sm text-muted-foreground/60">
              No overrides configured
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
