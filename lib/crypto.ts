import crypto from "node:crypto";

function key() {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) throw new Error("APP_ENCRYPTION_KEY není nastavený");
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map(part => part.toString("base64url")).join(".");
}

export function decryptSecret(value: string) {
  const [ivText, tagText, dataText] = value.split(".");
  if (!ivText || !tagText || !dataText) throw new Error("Neplatný uložený token");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataText, "base64url")), decipher.final()]).toString("utf8");
}
