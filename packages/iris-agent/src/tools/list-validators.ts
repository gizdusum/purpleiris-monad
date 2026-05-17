import { eq, and, lte, gte, sql } from "drizzle-orm";
import { getDb, validators } from "@purpleiris/monad-indexer";
import { makeResult } from "./types";
import type { ListValidatorsInput, ToolResult } from "./types";

export async function listValidatorsTool(input: ListValidatorsInput): Promise<ToolResult> {
  const db = getDb();
  const {
    active_only = true,
    max_commission_bps,
    min_stake_mon,
    region,
    infra_provider,
    limit = 50,
  } = input;

  const conditions = [];
  if (active_only) conditions.push(eq(validators.active, true));
  if (max_commission_bps !== undefined)
    conditions.push(lte(validators.commissionBps, max_commission_bps));
  if (min_stake_mon !== undefined)
    conditions.push(
      gte(validators.stakedAmount, BigInt(Math.floor(min_stake_mon * 1e18)).toString())
    );
  if (region) conditions.push(eq(validators.region, region));
  if (infra_provider) conditions.push(eq(validators.infraProvider, infra_provider));

  const rows = await db
    .select({
      id: validators.id,
      moniker: validators.moniker,
      slug: validators.slug,
      commission_bps: validators.commissionBps,
      jailed: validators.jailed,
      active: validators.active,
      staked_amount_raw: validators.stakedAmount,
      region: validators.region,
      infra_provider: validators.infraProvider,
    })
    .from(validators)
    .where(conditions.length ? and(...conditions) : sql`1=1`)
    .orderBy(sql`${validators.stakedAmount} DESC`)
    .limit(Math.min(limit, 100));

  return makeResult(
    {
      count: rows.length,
      validators: rows.map((v) => ({
        ...v,
        commission_pct: v.commission_bps / 100,
        staked_amount_mon: Number(v.staked_amount_raw) / 1e18,
        staked_amount_raw: undefined,
      })),
    },
    { data_class: 1, source: "list_validators" }
  );
}
