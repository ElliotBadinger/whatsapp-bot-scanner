"use client";

import { memo, useMemo } from "react";
import useSWR from "swr";
import { getStatus, type SystemStatus } from "@/lib/api";
import { StatsCard } from "./stats-card";

export const StatsDisplay = memo(function StatsDisplay() {
  const { data: status, error } = useSWR<SystemStatus>("status", getStatus, {
    refreshInterval: 10000,
    dedupingInterval: 5000, // Dedupe requests within 5 seconds
    revalidateOnFocus: false, // Don't refetch on window focus
    revalidateOnReconnect: true,
  });

  // Memoize calculations
  const { formattedScans, threatPercent } = useMemo(() => {
    const scans = status?.scans ?? 0;
    const blocked = status?.malicious ?? 0;
    return {
      formattedScans: scans.toLocaleString(),
      threatPercent: scans > 0 ? ((blocked / scans) * 100).toFixed(1) : "0",
    };
  }, [status?.scans, status?.malicious]);

  return (
    <section className="py-8 lg:py-12" aria-labelledby="stats-heading">
      <div className="flex items-center gap-2 mb-6">
        <div
          className="w-2 h-2 bg-primary rounded-full pulse-led"
          aria-hidden="true"
        />
        <h2
          id="stats-heading"
          className="font-mono text-sm font-semibold text-primary tracking-wide"
        >
          {`> LIVE STATUS`}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-8">
        <StatsCard
          value={formattedScans}
          label="SCANS"
          variant="neutral"
        />
        <StatsCard
          value={status?.malicious ?? "---"}
          label={`MALICIOUS (${threatPercent}%)`}
          variant="danger"
        />
        <StatsCard
          value={status?.groups ?? "---"}
          label="GROUPS"
          variant="success"
        />
      </div>

      {error && (
        <div className="mt-4 font-mono text-xs text-danger/70">
          Control-plane unavailable. Showing latest cached values.
        </div>
      )}
    </section>
  );
});
