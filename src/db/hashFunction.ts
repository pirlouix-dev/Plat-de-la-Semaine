import type { HashFunction } from "rxdb";
import { sha256 } from "js-sha256";

async function inputToUint8Array(
  input: string | ArrayBuffer | Blob,
): Promise<Uint8Array> {
  if (typeof input === "string") {
    return new TextEncoder().encode(input);
  }
  if (input instanceof Blob) {
    return new Uint8Array(await input.arrayBuffer());
  }
  return new Uint8Array(input);
}

export const hashFunction: HashFunction = async (input) => {
  const bytes = await inputToUint8Array(input);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashed = await crypto.subtle.digest(
      "SHA-256",
      bytes.buffer as ArrayBuffer,
    );
    return Array.from(new Uint8Array(hashed))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return sha256.hex(bytes);
};
