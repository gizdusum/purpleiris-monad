import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

type Limiters = { burst: Ratelimit; hourly: Ratelimit };
let limiters: Limiters | null = null;

function getLimiters(): Limiters | null {
  if (limiters) return limiters;
  const url = process.env["UPSTASH_REDIS_REST_URL"];
  const token = process.env["UPSTASH_REDIS_REST_TOKEN"];
  if (!url || !token) return null;
  const redis = new Redis({ url, token });
  limiters = {
    burst: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "20 s"),
      prefix: "rl:chat:burst",
    }),
    hourly: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, "1 h"),
      prefix: "rl:chat:hourly",
    }),
  };
  return limiters;
}

function extractIp(req: NextRequest): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real.toLowerCase();
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded.toLowerCase();
  return "unknown";
}

function tooMany(retryAfterSec: number, remaining: number, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify({ error: "Too many requests. Please slow down." }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(Math.max(1, retryAfterSec)),
      "X-RateLimit-Remaining": String(Math.max(0, remaining)),
      ...extra,
    },
  });
}

// ── In-memory fallback ────────────────────────────────────────────────────────
// Used when Upstash is not configured or not reachable. It is per serverless
// instance, so it is a best-effort brake rather than a global quota, but it
// means a Redis outage no longer turns rate limiting off entirely.

type Window = { limit: number; windowMs: number };
const memoryHits = new Map<string, number[]>();
const MEMORY_MAX_KEYS = 5_000;

export function memoryLimit(
  key: string,
  { limit, windowMs }: Window,
  now: number = Date.now()
): { success: boolean; remaining: number; retryAfterSec: number } {
  const cutoff = now - windowMs;
  const hits = (memoryHits.get(key) ?? []).filter((t) => t > cutoff);

  if (hits.length >= limit) {
    memoryHits.set(key, hits);
    const retryAfterSec = Math.ceil((hits[0]! + windowMs - now) / 1000);
    return { success: false, remaining: 0, retryAfterSec };
  }

  hits.push(now);
  // Re-insert so the Map keeps most-recently-used keys last, then trim the oldest.
  memoryHits.delete(key);
  memoryHits.set(key, hits);
  if (memoryHits.size > MEMORY_MAX_KEYS) {
    const oldest = memoryHits.keys().next().value;
    if (oldest !== undefined) memoryHits.delete(oldest);
  }
  return { success: true, remaining: limit - hits.length, retryAfterSec: 0 };
}

export function __resetMemoryLimiter(): void {
  memoryHits.clear();
}

const CHAT_BURST: Window = { limit: 5, windowMs: 20_000 };
const CHAT_HOURLY: Window = { limit: 50, windowMs: 3_600_000 };

function chatMemoryFallback(ip: string): Response | null {
  const burst = memoryLimit(`chat:burst:${ip}`, CHAT_BURST);
  if (!burst.success) return tooMany(burst.retryAfterSec, 0);
  const hourly = memoryLimit(`chat:hourly:${ip}`, CHAT_HOURLY);
  if (!hourly.success) return tooMany(hourly.retryAfterSec, 0);
  return null;
}

export async function checkRateLimit(req: NextRequest): Promise<Response | null> {
  const ip = extractIp(req);
  const lim = getLimiters();
  if (!lim) return chatMemoryFallback(ip);
  try {
    const [burst, hourly] = await Promise.all([lim.burst.limit(ip), lim.hourly.limit(ip)]);
    if (!burst.success || !hourly.success) {
      const failing = !burst.success ? burst : hourly;
      const retryAfter = Math.max(0, Math.ceil((failing.reset - Date.now()) / 1000));
      return tooMany(retryAfter, Math.min(burst.remaining, hourly.remaining));
    }
    return null;
  } catch {
    return chatMemoryFallback(ip);
  }
}

// ── Public data API (MCP + REST) ──────────────────────────────────────────────
// Read-only and cheap compared with the chat routes (no LLM call), so the
// allowance is larger: 60 requests per minute per IP.

const API_MINUTE: Window = { limit: 60, windowMs: 60_000 };
let apiLimiter: Ratelimit | null = null;

function getApiLimiter(): Ratelimit | null {
  if (apiLimiter) return apiLimiter;
  const url = process.env["UPSTASH_REDIS_REST_URL"];
  const token = process.env["UPSTASH_REDIS_REST_TOKEN"];
  if (!url || !token) return null;
  apiLimiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(API_MINUTE.limit, "60 s"),
    prefix: "rl:api:minute",
    timeout: 800,
  });
  return apiLimiter;
}

export async function checkApiRateLimit(
  req: NextRequest,
  extraHeaders: HeadersInit = {}
): Promise<Response | null> {
  const ip = extractIp(req);
  const lim = getApiLimiter();
  if (lim) {
    try {
      const r = await lim.limit(ip);
      // `reason: "timeout"` means Upstash did not answer in time and let the request
      // through; fall back to the local window instead of trusting that.
      if ((r as { reason?: string }).reason !== "timeout") {
        if (r.success) return null;
        return tooMany(Math.ceil((r.reset - Date.now()) / 1000), r.remaining, extraHeaders);
      }
    } catch {
      // fall through to the in-memory window
    }
  }
  const local = memoryLimit(`api:minute:${ip}`, API_MINUTE);
  return local.success ? null : tooMany(local.retryAfterSec, 0, extraHeaders);
}
