// Cryptographic Release Hashing (T046)
// Deterministic canonical JSON serialization and SHA-256 computation
// to ensure lesson and curriculum versions are tamper-evident and reproducible.

function canonicalize(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(canonicalize);
  }
  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const result: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    result[key] = canonicalize((obj as Record<string, unknown>)[key]);
  }
  return result;
}

export function canonicalJsonString(data: unknown): string {
  return JSON.stringify(canonicalize(data));
}

export async function computeReleaseHash(payload: unknown): Promise<string> {
  const canonicalStr = canonicalJsonString(payload);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalStr));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
