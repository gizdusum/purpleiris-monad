import { createServer, type IncomingMessage } from "node:http";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { getDb, telemetryMetrics, telemetryNodes } from "@purpleiris/monad-indexer";
import { eq } from "drizzle-orm";
import { z } from "zod";

const PORT = 3010;
const HMAC_SECRET = process.env["TELEMETRY_INGEST_HMAC_SECRET"];

if (!HMAC_SECRET) {
  console.error("[ingest] TELEMETRY_INGEST_HMAC_SECRET is not set");
  process.exit(1);
}

const MetricsPayload = z.object({
  node_id: z.string().min(1).max(128),
  ts: z.string().datetime().optional(),
  cpu_percent: z.number().min(0).max(100).optional(),
  mem_percent: z.number().min(0).max(100).optional(),
  disk_percent: z.number().min(0).max(100).optional(),
  block_height: z.number().int().positive().optional(),
  consensus_lag_ms: z.number().int().min(0).optional(),
  execution_lag_ms: z.number().int().min(0).optional(),
  peer_count: z.number().int().min(0).optional(),
  extra: z.record(z.unknown()).optional(),
});

function verifyHmac(secret: string, body: Buffer, sig: string): boolean {
  try {
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    const expectedBuf = Buffer.from(expected, "hex");
    const sigBuf = Buffer.from(sig, "hex");
    if (expectedBuf.length !== sigBuf.length) return false;
    return timingSafeEqual(expectedBuf, sigBuf);
  } catch {
    return false;
  }
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = req.url ?? "/";
  const method = req.method ?? "GET";

  if (method === "GET" && url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "telemetry-ingest" }));
    return;
  }

  if (method === "POST" && url === "/v1/metrics") {
    let body: Buffer;
    try {
      body = await readBody(req);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to read body" }));
      return;
    }

    const sig = req.headers["x-purpleiris-signature"];
    if (typeof sig !== "string" || !verifyHmac(HMAC_SECRET, body, sig)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid signature" }));
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(body.toString("utf8"));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    const parsed = MetricsPayload.safeParse(json);
    if (!parsed.success) {
      res.writeHead(422, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Validation failed", details: parsed.error.flatten() }));
      return;
    }

    const payload = parsed.data;
    const db = getDb();

    // Verify node is registered
    const node = await db
      .select({ id: telemetryNodes.id })
      .from(telemetryNodes)
      .where(eq(telemetryNodes.id, payload.node_id))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!node) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Node not registered" }));
      return;
    }

    try {
      await db.insert(telemetryMetrics).values({
        id: randomUUID(),
        nodeId: payload.node_id,
        ts: payload.ts ? new Date(payload.ts) : new Date(),
        cpuPercent: payload.cpu_percent ?? null,
        memPercent: payload.mem_percent ?? null,
        diskPercent: payload.disk_percent ?? null,
        blockHeight: payload.block_height ? BigInt(payload.block_height) : null,
        consensusLagMs: payload.consensus_lag_ms ?? null,
        executionLagMs: payload.execution_lag_ms ?? null,
        peerCount: payload.peer_count ?? null,
        payload: payload.extra ?? null,
      });

      // Update last seen
      await db
        .update(telemetryNodes)
        .set({ lastSeenAt: new Date() })
        .where(eq(telemetryNodes.id, payload.node_id));

      res.writeHead(202, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      console.error("[ingest] db write failed:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "DB write failed" }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`[ingest] listening on :${PORT}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
