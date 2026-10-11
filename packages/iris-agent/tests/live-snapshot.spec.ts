/**
 * Live staking-precompile snapshot, with the chain replaced by a fake reader.
 */
import { describe, it, expect } from "vitest";
import {
  readLiveSnapshot,
  summarizeSnapshot,
  nakamotoCoefficient,
  commissionToBps,
  weiToMon,
  getRpcUrls,
  describeFreshness,
  STALE_AFTER_MS,
  STAKING_PRECOMPILE,
  type SnapshotReader,
} from "@purpleiris/monad-indexer";
import { buildSnapshotPayload } from "../src/tools/get-onchain-snapshot";

const MON = 10n ** 18n;
const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`;

type Fake = {
  reader: SnapshotReader;
  calls: Array<{ fn: string; args?: readonly unknown[]; blockNumber?: bigint }>;
};

/** Validators 1..n, validator i stakes `stakes[i-1]` MON at 5% commission. */
function fakeChain(
  stakes: number[],
  opts: { failOnce?: number[]; failAlways?: number[] } = {}
): Fake {
  const calls: Fake["calls"] = [];
  const failures = new Map<number, number>();
  const ids = stakes.map((_, i) => BigInt(i + 1));
  const reader: SnapshotReader = {
    async getBlockNumber() {
      return 112_474_748n;
    },
    async readContract({ address, functionName, args, blockNumber }) {
      expect(address).toBe(STAKING_PRECOMPILE);
      calls.push({
        fn: functionName,
        ...(args ? { args } : {}),
        ...(blockNumber ? { blockNumber } : {}),
      });
      if (functionName === "getEpoch") return [2250n, false] as const;
      if (functionName === "getExecutionValidatorSet") {
        const start = Number(args![0]);
        const page = ids.slice(start, start + 100);
        const next = start + page.length;
        return [next >= ids.length, next, page] as const;
      }
      if (functionName === "getValidator") {
        const id = Number(args![0]);
        const seen = failures.get(id) ?? 0;
        failures.set(id, seen + 1);
        if (opts.failAlways?.includes(id)) throw new Error("rate limited");
        if (opts.failOnce?.includes(id) && seen === 0) throw new Error("rate limited");
        const stake = BigInt(stakes[id - 1]!) * MON;
        return [
          addr(id).toUpperCase().replace("0X", "0x") as `0x${string}`,
          0n,
          stake + MON, // execution-view stake
          0n,
          5n * 10n ** 16n, // 5%
          BigInt(id) * MON,
          stake, // consensus stake
          0n,
          0n,
          0n,
          `0x02${"ab".repeat(32)}` as `0x${string}`,
          "0x" as `0x${string}`,
        ] as const;
      }
      throw new Error(`unexpected call ${functionName}`);
    },
  };
  return { reader, calls };
}

const noSleep = async () => {};

describe("readLiveSnapshot", () => {
  it("reads the whole set and pins every read to one block", async () => {
    const { reader, calls } = fakeChain(Array.from({ length: 196 }, (_, i) => 1000 - i));
    const s = await readLiveSnapshot({ reader, sleep: noSleep });

    expect(s.blockNumber).toBe(112_474_748);
    expect(s.epoch).toBe(2250);
    expect(s.validatorSetSize).toBe(196);
    expect(s.validators).toHaveLength(196);
    expect(s.complete).toBe(true);
    expect(s.failedIds).toEqual([]);

    expect(calls.filter((c) => c.fn === "getExecutionValidatorSet").map((c) => c.args![0])).toEqual(
      [0, 100]
    );
    expect(calls.filter((c) => c.fn === "getValidator")).toHaveLength(196);
    expect(new Set(calls.map((c) => c.blockNumber))).toEqual(new Set([112_474_748n]));
  });

  it("decodes commission, stake and addresses", async () => {
    const { reader } = fakeChain([250]);
    const s = await readLiveSnapshot({ reader, sleep: noSleep });
    expect(s.validators[0]).toMatchObject({
      validatorId: 1,
      authAddress: addr(1),
      commissionBps: 500,
      consensusStakeWei: 250n * MON,
      stakeWei: 251n * MON,
      unclaimedRewardsWei: MON,
      secpPubkey: `02${"ab".repeat(32)}`,
    });
  });

  it("retries a failed read once", async () => {
    const { reader, calls } = fakeChain([10, 20, 30], { failOnce: [2] });
    const s = await readLiveSnapshot({ reader, sleep: noSleep });
    expect(s.complete).toBe(true);
    expect(calls.filter((c) => c.fn === "getValidator" && Number(c.args![0]) === 2)).toHaveLength(
      2
    );
  });

  it("marks the snapshot incomplete when a validator cannot be read", async () => {
    const { reader } = fakeChain([10, 20, 30], { failAlways: [3] });
    const s = await readLiveSnapshot({ reader, sleep: noSleep });
    expect(s.complete).toBe(false);
    expect(s.failedIds).toEqual([3]);
    expect(s.validators.map((v) => v.validatorId)).toEqual([1, 2]);
  });

  it("paces chunks instead of firing every read at once", async () => {
    const { reader } = fakeChain(Array.from({ length: 45 }, () => 1));
    const sleeps: number[] = [];
    await readLiveSnapshot({
      reader,
      chunkSize: 20,
      chunkDelayMs: 450,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    expect(sleeps).toEqual([450, 450]); // 3 chunks → 2 pauses
  });
});

describe("derived metrics", () => {
  it("computes the Nakamoto coefficient at the one-third threshold", () => {
    expect(nakamotoCoefficient([])).toBe(0);
    expect(nakamotoCoefficient([100n])).toBe(1);
    expect(nakamotoCoefficient([40n, 30n, 30n])).toBe(1); // 40 > 33.3
    expect(nakamotoCoefficient([30n, 30n, 30n, 10n])).toBe(2); // 30 < 33.3, 60 > 33.3
    expect(nakamotoCoefficient(Array.from({ length: 9 }, () => 1n))).toBe(4); // 4/9 > 1/3, 3/9 is not
    expect(nakamotoCoefficient([1n, 1n, 1n])).toBe(2); // exactly one third is not enough
  });

  it("is order-independent and ignores zero stakes", () => {
    expect(nakamotoCoefficient([1n, 0n, 50n, 5n, 0n])).toBe(nakamotoCoefficient([50n, 5n, 1n]));
  });

  it("converts commission and wei", () => {
    expect(commissionToBps(10n ** 17n)).toBe(1000);
    expect(commissionToBps(0n)).toBe(0);
    expect(weiToMon(15_610_000_000n * MON)).toBe(15_610_000_000);
    expect(weiToMon(MON / 2n)).toBe(0.5);
  });

  it("summarises a snapshot", async () => {
    const { reader } = fakeChain([40, 30, 30]);
    const summary = summarizeSnapshot(await readLiveSnapshot({ reader, sleep: noSleep }));
    expect(summary).toMatchObject({
      validatorSetSize: 3,
      validatorsRead: 3,
      totalConsensusStakeMon: 100,
      totalStakeMon: 103,
      nakamotoCoefficient: 1,
      topValidatorSharePct: 40,
      medianCommissionBps: 500,
    });
  });
});

describe("get_onchain_snapshot payload", () => {
  it("carries the block, the precompile address and ranked validators", async () => {
    const { reader } = fakeChain([10, 60, 30]);
    const snapshot = await readLiveSnapshot({ reader, sleep: noSleep });
    const payload = buildSnapshotPayload(snapshot, new Map([[addr(2), "Backpack"]]), 2);

    expect(payload).toMatchObject({
      as_of_block: 112_474_748,
      epoch: 2250,
      chain_id: 143,
      staking_precompile: STAKING_PRECOMPILE,
      validator_set_size: 3,
      complete: true,
      totals: { data_class: 2, total_consensus_stake_mon: 100 },
    });
    expect(payload.nakamoto_coefficient).toMatchObject({ value: 1, data_class: 2 });
    expect(
      payload.top_validators.map((v) => [v.rank, v.validator_id, v.moniker, v.stake_share_pct])
    ).toEqual([
      [1, 2, "Backpack", 60],
      [2, 3, null, 30],
    ]);
    expect(payload).not.toHaveProperty("incomplete_note");
  });

  it("says so when the read is partial", async () => {
    const { reader } = fakeChain([10, 60, 30], { failAlways: [2] });
    const payload = buildSnapshotPayload(
      await readLiveSnapshot({ reader, sleep: noSleep }),
      new Map(),
      5
    );
    expect(payload.complete).toBe(false);
    expect(payload.incomplete_note).toMatch(/1 of 3 validator reads failed/);
  });
});

describe("RPC endpoint list", () => {
  it("puts the configured endpoint first and appends public fallbacks", () => {
    expect(getRpcUrls("https://example-provider.test/v2/key")).toEqual([
      "https://example-provider.test/v2/key",
      "https://rpc.monad.xyz",
      "https://rpc1.monad.xyz",
    ]);
  });

  it("de-duplicates when the configured endpoint is already a public one", () => {
    expect(getRpcUrls("https://RPC.monad.xyz/")).toEqual([
      "https://RPC.monad.xyz/",
      "https://rpc1.monad.xyz",
    ]);
  });
});

describe("index freshness", () => {
  const now = Date.parse("2026-10-11T12:00:00.000Z");

  it("is fresh within one and a half indexer cycles", () => {
    const f = describeFreshness(new Date(now - 60 * 60 * 1000), now);
    expect(f).toEqual({ indexedAt: "2026-10-11T11:00:00.000Z", ageSeconds: 3600, stale: false });
  });

  it("is stale past the threshold", () => {
    expect(describeFreshness(new Date(now - STALE_AFTER_MS - 1000), now).stale).toBe(true);
    expect(describeFreshness(new Date("2026-08-01T11:07:49.819Z"), now).stale).toBe(true);
  });

  it("is stale when the age is unknown", () => {
    expect(describeFreshness(null, now)).toEqual({
      indexedAt: null,
      ageSeconds: null,
      stale: true,
    });
    expect(describeFreshness(new Date("nope"), now).stale).toBe(true);
  });
});
