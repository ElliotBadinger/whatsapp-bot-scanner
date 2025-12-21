import tls from "tls";
import { request } from "undici";
import { certificateIntelligence } from "../../reputation/certificate-intelligence";

jest.mock("tls", () => ({
  connect: jest.fn(),
  checkServerIdentity: jest.fn(),
}));

jest.mock("undici", () => ({
  request: jest.fn(),
}));

type ConnectCallback = () => void;
type ConnectOptions = { rejectUnauthorized?: boolean; servername?: string };

const getOptions = (args: any[]): ConnectOptions => {
  const options = args[2];
  return (typeof options === "object" ? options : {}) as ConnectOptions;
};

const getCallback = (args: any[]): ConnectCallback | undefined => {
  const direct = args[3];
  if (typeof direct === "function") return direct as ConnectCallback;
  if (typeof args[2] === "function") return args[2] as ConnectCallback;
  return undefined;
};

describe("Certificate Intelligence", () => {
  const tlsConnect = tls.connect as jest.MockedFunction<typeof tls.connect>;
  const undiciRequest = request as jest.MockedFunction<typeof request>;

  const baseCert = {
    issuer: { CN: "Trusted CA" },
    subject: { CN: "example.com" },
    valid_from: new Date("2020-01-01T00:00:00.000Z").toUTCString(),
    valid_to: new Date("2035-01-01T00:00:00.000Z").toUTCString(),
    subjectaltname: "DNS:example.com, DNS:www.example.com",
  };

  const buildSocket = (certInfo: unknown) => ({
    getPeerCertificate: jest.fn(() => certInfo),
    destroy: jest.fn(),
    on: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    undiciRequest.mockResolvedValue({
      statusCode: 200,
      body: {
        json: async () => [{ id: 1 }],
      },
    } as any);
  });

  it("analyzes a valid certificate and CT log presence", async () => {
    tlsConnect.mockImplementation((...args: any[]) => {
      const cb = getCallback(args);
      const socket = buildSocket(baseCert);
      if (cb) {
        setImmediate(cb);
      }
      return socket as any;
    });

    const result = await certificateIntelligence("example.com", {
      timeoutMs: 100,
      ctCheckEnabled: true,
    });

    expect(result.isValid).toBe(true);
    expect(result.issuer).toBe("Trusted CA");
    expect(result.ctLogPresent).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("flags suspicious certificate properties", async () => {
    const fixedNow = new Date("2024-01-10T00:00:00.000Z").getTime();
    const dateSpy = jest.spyOn(Date, "now").mockReturnValue(fixedNow);

    const manySans = Array.from(
      { length: 101 },
      (_, i) => `DNS:alt${i}.example.com`,
    ).join(", ");
    const suspiciousCert = {
      issuer: { CN: "test issuer" },
      subject: { CN: "test issuer" },
      valid_from: new Date("2024-01-09T00:00:00.000Z").toUTCString(),
      valid_to: new Date("2024-01-20T00:00:00.000Z").toUTCString(),
      subjectaltname: manySans,
    };

    tlsConnect.mockImplementation((...args: any[]) => {
      const cb = getCallback(args);
      const socket = buildSocket(suspiciousCert);
      if (cb) {
        setImmediate(cb);
      }
      return socket as any;
    });

    const result = await certificateIntelligence("suspicious.example", {
      timeoutMs: 100,
      ctCheckEnabled: false,
    });

    expect(result.isSelfSigned).toBe(true);
    expect(result.suspicionScore).toBeGreaterThan(1);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "Self-signed certificate detected",
        "Very new certificate (< 7 days old)",
        "Certificate expires soon",
        "Unusually high number of SANs",
        "Suspicious certificate issuer",
      ]),
    );
    dateSpy.mockRestore();
  });

  it("falls back to unvalidated certificate when validation fails", async () => {
    tlsConnect.mockImplementation((...args: any[]) => {
      const options = getOptions(args);
      const cb = getCallback(args);
      const socket = buildSocket(baseCert);
      socket.on = jest.fn((event: string, handler: (err: Error) => void) => {
        if (event === "error" && options.rejectUnauthorized) {
          handler(new Error("bad cert"));
        }
        return socket;
      });
      if (cb && !options.rejectUnauthorized) {
        setImmediate(cb);
      }
      return socket as any;
    });

    const result = await certificateIntelligence("fallback.example", {
      timeoutMs: 100,
      ctCheckEnabled: false,
    });

    expect(result.isValid).toBe(false);
    expect(result.reasons).toContain("Certificate validation failed");
  });

  it("adds CT log warning when certificate is missing from logs", async () => {
    tlsConnect.mockImplementation((...args: any[]) => {
      const cb = getCallback(args);
      const socket = buildSocket(baseCert);
      if (cb) {
        setImmediate(cb);
      }
      return socket as any;
    });
    undiciRequest.mockResolvedValue({
      statusCode: 200,
      body: {
        json: async () => [],
      },
    } as any);

    const result = await certificateIntelligence("ct-missing.example", {
      timeoutMs: 100,
      ctCheckEnabled: true,
    });

    expect(result.ctLogPresent).toBe(false);
    expect(result.reasons).toContain("Certificate not found in CT logs");
  });

  it("handles certificate analysis failures", async () => {
    tlsConnect.mockImplementation((...args: any[]) => {
      const cb = getCallback(args);
      const socket = buildSocket(baseCert);
      socket.on = jest.fn((event: string, handler: (err: Error) => void) => {
        if (event === "error") {
          handler(new Error("connection failed"));
        }
        return socket;
      });
      // Don't invoke the success callback when forcing an error.
      return socket as any;
    });

    const result = await certificateIntelligence("error.example", {
      timeoutMs: 10,
      ctCheckEnabled: true,
    });

    expect(result.isValid).toBe(false);
    expect(result.reasons).toContain("Certificate analysis failed");
  });
});
