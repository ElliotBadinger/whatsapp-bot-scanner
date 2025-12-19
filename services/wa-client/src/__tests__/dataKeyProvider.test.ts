import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));
const originalFetch = global.fetch;

describe("dataKeyProvider", () => {
  const logger = {
    info: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    delete process.env.AWS_REGION;
    delete process.env.AWS_DEFAULT_REGION;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("uses raw data key and caches materials", async () => {
    const { loadEncryptionMaterials } = await import(
      "../crypto/dataKeyProvider"
    );
    const key = Buffer.from("super-secret-key").toString("base64");

    const first = await loadEncryptionMaterials(
      { dataKey: key } as any,
      logger as any,
    );
    const second = await loadEncryptionMaterials(
      { dataKey: key } as any,
      logger as any,
    );

    expect(first).toBe(second);
    expect(first.keySource).toBe("env");
    expect(first.encryptionKey).toBeInstanceOf(Buffer);
    expect(first.hmacKey).toBeInstanceOf(Buffer);
  });

  it("decrypts data key via Vault", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          plaintext: Buffer.from("vault-secret-key").toString("base64"),
        },
      }),
    });
    (global as any).fetch = fetchMock;

    const { loadEncryptionMaterials } = await import(
      "../crypto/dataKeyProvider"
    );
    const materials = await loadEncryptionMaterials(
      {
        vaultAddress: "https://vault.local",
        vaultTransitPath: "transit",
        vaultToken: "token",
        encryptedDataKey: "ciphertext",
      } as any,
      logger as any,
    );

    expect(fetchMock).toHaveBeenCalled();
    expect(materials.keySource).toBe("vault");
  });

  it("decrypts data key via KMS when configured", async () => {
    process.env.AWS_REGION = "us-east-1";
    const sendMock = jest
      .fn()
      .mockResolvedValue({ Plaintext: Buffer.from("kms-secret") });

    jest.unstable_mockModule("@aws-sdk/client-kms", () => ({
      KMSClient: class {
        send = sendMock;
      },
      DecryptCommand: class {
        input: unknown;
        constructor(input: unknown) {
          this.input = input;
        }
      },
    }));

    const { loadEncryptionMaterials } = await import(
      "../crypto/dataKeyProvider"
    );
    const materials = await loadEncryptionMaterials(
      {
        encryptedDataKey: Buffer.from("ciphertext").toString("base64"),
        kmsKeyId: "kms-key",
      } as any,
      logger as any,
    );

    await flushPromises();
    expect(sendMock).toHaveBeenCalled();
    expect(materials.keySource).toBe("kms");
  });

  it("throws when no data key sources are configured", async () => {
    const { loadEncryptionMaterials } = await import(
      "../crypto/dataKeyProvider"
    );

    await expect(
      loadEncryptionMaterials({} as any, logger as any),
    ).rejects.toThrow(
      "RemoteAuth encryption requires WA_REMOTE_AUTH_DATA_KEY, or KMS/Vault configuration.",
    );
  });
});
