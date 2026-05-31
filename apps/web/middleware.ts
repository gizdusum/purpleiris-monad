import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const config = {
  matcher: "/api/chat/:path*",
};

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

export async function middleware(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  if (!ip) return NextResponse.next();

  const lim = getLimiters();
  if (!lim) return NextResponse.next();

  let burst: Awaited<ReturnType<Ratelimit["limit"]>>;
  let hourly: Awaited<ReturnType<Ratelimit["limit"]>>;
  try {
    [burst, hourly] = await Promise.all([lim.burst.limit(ip), lim.hourly.limit(ip)]);
  } catch (err) {
    console.warn("[rate-limit] Upstash unreachable, failing open:", err);
    return NextResponse.next();
  }

  if (!burst.success || !hourly.success) {
    const failing = !burst.success ? burst : hourly;
    const retryAfter = Math.max(0, Math.ceil((failing.reset - Date.now()) / 1000));
    return new NextResponse(JSON.stringify({ error: "Too many requests. Please slow down." }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Remaining": String(Math.min(burst.remaining, hourly.remaining)),
      },
    });
  }

  return NextResponse.next();
}
