import crypto from "node:crypto";

const ALGORITHM = "aes-256-cbc";

function getKey() {
  const secret = process.env.INTEGRATION_SECRET;

  if (!secret) {
    throw new Error("INTEGRATION_SECRET is required for credential encryption.");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptCredentials(data: object): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);

  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptCredentials(encrypted: string): object {
  const [ivHex, encryptedHex] = encrypted.split(":");

  if (!ivHex || !encryptedHex) {
    throw new Error("Invalid encrypted credential payload.");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivHex, "hex"),
  );
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8")) as object;
}
