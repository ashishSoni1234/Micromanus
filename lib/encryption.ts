// lib/encryption.ts
// AES-256-GCM encryption for user-supplied API keys stored in Supabase.
// The ENCRYPTION_SECRET env var must be a 64-character hex string (32 bytes).
// This module is SERVER-SIDE ONLY. Never import from client components.

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.length !== 64) {
    throw new Error(
      "ENCRYPTION_SECRET must be a 64-character hex string (32 bytes). " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(secret, "hex");
}

export type EncryptedPayload = {
  ciphertext: string; // hex
  iv: string;         // hex — 12 bytes for GCM
  authTag: string;    // hex — 16 bytes GCM authentication tag
};

/**
 * Encrypts a plaintext string (e.g., an API key) using AES-256-GCM.
 * Returns the ciphertext, IV, and auth tag as hex strings for database storage.
 */
export function encrypt(plaintext: string): EncryptedPayload {
  const key = getEncryptionKey();
  const iv = randomBytes(12); // GCM standard: 12-byte IV
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

/**
 * Decrypts an EncryptedPayload back to the original plaintext.
 * Throws if the auth tag doesn't match (tamper detection).
 */
export function decrypt(payload: EncryptedPayload): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(payload.iv, "hex");
  const authTag = Buffer.from(payload.authTag, "hex");
  const ciphertext = Buffer.from(payload.ciphertext, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}
