import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

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

export async function checkRateLimit(ip: string | null): Promise<Response | null> {
  if (!ip) return null;
  const lim = getLimiters();
  if (!lim) return null;
  try {
    const [burst, hourly] = await Promise.all([lim.burst.limit(ip), lim.hourly.limit(ip)]);
    if (!burst.success || !hourly.success) {
      const failing = !burst.success ? burst : hourly;
      const retryAfter = Math.max(0, Math.ceil((failing.reset - Date.now()) / 1000));
      return new Response(JSON.stringify({ error: "Too many requests. Please slow down." }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
          "X-RateLimit-Remaining": String(Math.min(burst.remaining, hourly.remaining)),
        },
      });
    }
    return null;
  } catch {
    return null;
  }
}
