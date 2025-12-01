// SafeMode Control Plane API Client
// Mock implementation for proof of concept

export interface SystemStatus {
  scansToday: number;
  threatsBlocked: number;
  cacheHitRate: number;
  groupsProtected: number;
  uptime: string;
  version: string;
}

export interface ScanVerdict {
  id: string;
  timestamp: string;
  url: string;
  verdict: "SAFE" | "DENY" | "SCAN" | "WARN";
  category?: string;
  groupId?: string;
}

export interface Override {
  id: string;
  pattern: string;
  action: "allow" | "block";
  reason: string;
  createdAt: string;
}

// Environment configuration
const CONTROL_PLANE_URL =
  process.env.CONTROL_PLANE_URL || "http://localhost:8080";
const API_TOKEN = process.env.CONTROL_PLANE_API_TOKEN || "demo-token";

// Headers for authenticated requests
const getHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_TOKEN}`,
});

// Mock data generators for proof of concept
const generateMockStatus = (): SystemStatus => ({
  scansToday: Math.floor(Math.random() * 500) + 1000,
  threatsBlocked: Math.floor(Math.random() * 50) + 20,
  cacheHitRate: Math.floor(Math.random() * 15) + 80,
  groupsProtected: Math.floor(Math.random() * 100) + 300,
  uptime: "99.97%",
  version: "1.0.0",
});

const mockUrls = [
  { url: "github.com/safe-repo", verdict: "SAFE" as const },
  { url: "bit.ly/xyz123", verdict: "SCAN" as const },
  { url: "phish-site.com/login", verdict: "DENY" as const },
  { url: "docs.google.com/document", verdict: "SAFE" as const },
  { url: "suspicious-link.xyz", verdict: "WARN" as const },
  { url: "linkedin.com/post/123", verdict: "SAFE" as const },
  { url: "malware-dropper.ru", verdict: "DENY" as const },
  { url: "youtube.com/watch", verdict: "SAFE" as const },
];

const generateMockVerdict = (): ScanVerdict => {
  const mock = mockUrls[Math.floor(Math.random() * mockUrls.length)];
  return {
    id: Math.random().toString(36).substring(7),
    timestamp: new Date().toISOString(),
    url: mock.url,
    verdict: mock.verdict,
    category: mock.verdict === "DENY" ? "phishing" : undefined,
  };
};

// API Functions
export async function getStatus(): Promise<SystemStatus> {
  try {
    const response = await fetch(`${CONTROL_PLANE_URL}/status`, {
      headers: getHeaders(),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("API unavailable");
    return response.json();
  } catch {
    // Return mock data for proof of concept
    return generateMockStatus();
  }
}

export async function getRecentScans(limit = 10): Promise<ScanVerdict[]> {
  try {
    const response = await fetch(
      `${CONTROL_PLANE_URL}/scans/recent?limit=${limit}`,
      {
        headers: getHeaders(),
        cache: "no-store",
      },
    );
    if (!response.ok) throw new Error("API unavailable");
    return response.json();
  } catch {
    // Return mock data for proof of concept
    return Array.from({ length: limit }, generateMockVerdict);
  }
}

export async function rescanUrl(url: string): Promise<ScanVerdict> {
  try {
    const response = await fetch(`${CONTROL_PLANE_URL}/rescan`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ url }),
    });
    if (!response.ok) throw new Error("API unavailable");
    return response.json();
  } catch {
    return {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      url,
      verdict: "SCAN",
    };
  }
}

export async function getOverrides(): Promise<Override[]> {
  try {
    const response = await fetch(`${CONTROL_PLANE_URL}/overrides`, {
      headers: getHeaders(),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("API unavailable");
    return response.json();
  } catch {
    // Return mock overrides
    return [
      {
        id: "1",
        pattern: "*.example.com",
        action: "allow",
        reason: "Trusted domain",
        createdAt: new Date().toISOString(),
      },
      {
        id: "2",
        pattern: "malware.xyz",
        action: "block",
        reason: "Known malware",
        createdAt: new Date().toISOString(),
      },
    ];
  }
}

export async function addOverride(
  pattern: string,
  action: "allow" | "block",
  reason: string,
): Promise<Override> {
  try {
    const response = await fetch(`${CONTROL_PLANE_URL}/overrides`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ pattern, action, reason }),
    });
    if (!response.ok) throw new Error("API unavailable");
    return response.json();
  } catch {
    return {
      id: Math.random().toString(36).substring(7),
      pattern,
      action,
      reason,
      createdAt: new Date().toISOString(),
    };
  }
}

export async function muteGroup(chatId: string): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${CONTROL_PLANE_URL}/groups/${chatId}/mute`, {
      method: "POST",
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error("API unavailable");
    return response.json();
  } catch {
    return { success: true };
  }
}

// Stream generator for SSE mock data
export function* generateMockStream(): Generator<ScanVerdict> {
  while (true) {
    yield generateMockVerdict();
  }
}
