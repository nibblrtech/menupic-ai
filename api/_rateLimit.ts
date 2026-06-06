interface RateEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateEntry>();
const GC_EVERY = 200;
let mutationCount = 0;

function maybeGc(now: number) {
  mutationCount += 1;
  if (mutationCount % GC_EVERY !== 0) return;

  for (const [key, entry] of buckets.entries()) {
    if (entry.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(
  bucketKey: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, {
      count: 1,
      resetAt: now + windowMs,
    });
    maybeGc(now);
    return { allowed: true, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  existing.count += 1;
  buckets.set(bucketKey, existing);
  maybeGc(now);
  return { allowed: true, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
}
