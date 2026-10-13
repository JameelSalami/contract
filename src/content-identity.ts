import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export function contentDigest(content: string | Uint8Array): string {
  const bytes = typeof content === "string" ? utf8ToBytes(content) : content;
  return "sha256:" + bytesToHex(sha256(bytes));
}