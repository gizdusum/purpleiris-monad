/**
 * Single-validator live read and validator flag decoding, with the chain
 * replaced by a fake reader.
 */
import { describe, it, expect } from "vitest";
import {
  readLiveValidator,
  decodeValidatorFlags,
  describeValidatorFlags,
  STAKING_PRECOMPILE,
  type SnapshotReader,
} from "@purpleiris/monad-indexer";
import { buildValidatorOnchainPayload } from "../src/tools/get-validator-onchain";

const MON = 10n ** 18n;
const AUTH = "0x00000000000000000000000000000000000000AA" as `0x${string}`;
const DELEGATOR = "0x00000000000000000000000000000000000000bb";
const ZERO = "0x0000000000000000000000000000000000000000" as `0x${string}`;
const BLOCK = 112_498_422n;

type Call = { fn: string; args?: readonly unknown[] | undefined; blockNumber?: bigint | undefined };

function fakeChain(opts: { exists?: boolean; flags?: bigint } = {}) {
  const calls: Call[] = [];
  const reader: SnapshotReader = {
    async getBlockNumber() {
      return BLOCK;
    },
    async readContract({ address, functionName, args, blockNumber }) {
      expect(address).toBe(STAKING_PRECOMPILE);
      calls.push({ fn: functionName, args, blockNumber });
      if (functionName === "getEpoch") return [2250n, false];
      if (functionName === "getValidator") {
        return [
          opts.exists === false ? ZERO : AUTH,
          opts.flags ?? 0n,
          1_200n * MON, // execution stake
          0n,
          10n ** 17n, // execution commission: 10%
          40n * MON, // pool unclaimed rewards
          1_000n * MON, // consensus stake
          5n * 10n ** 16n, // consensus commission: 5%
          900n * MON, // snapshot stake
          5n * 10n ** 16n, // snapshot commission: 5%
          "0x02abcd",
          "0x",
        ];
      }
      if (functionName === "getDelegator") {
        const who = String(args?.[1]).toLowerCase();
        return who === AUTH.toLowerCase()
          ? [100n * MON, 0n, 7n * MON, 0n, 0n, 0n, 0n]
          : [50n * MON, 0n, 2n * MON, 25n * MON, 0n, 2251n, 0n];
      }
      throw new Error(`unexpected call ${functionName}`);
    },
  };
  return { reader, calls };
}

describe("decodeValidatorFlags", () => {
  it("reads zero as ok", () => {
    const f = decodeValidatorFlags(0n);
    expect(f).toMatchObject({ raw: "0", ok: true, stakeTooLow: false, withdrawn: false });
    expect(f.doubleSign).toBe(false);
    expect(f.unknownBits).toBeNull();
    expect(describeValidatorFlags(f)).toMatch(/eligible/);
  });

  it("decodes each known bit", () => {
    expect(decodeValidatorFlags(1n)).toMatchObject({ ok: false, stakeTooLow: true });
    expect(decodeValidatorFlags(2n)).toMatchObject({ ok: false, withdrawn: true });
    expect(decodeValidatorFlags(4n)).toMatchObject({ ok: false, doubleSign: true });
    expect(decodeValidatorFlags(3n)).toMatchObject({ stakeTooLow: true, withdrawn: true });
  });

  it("reports bits it does not know instead of dropping them", () => {
    const f = decodeValidatorFlags(0b1001n);
    expect(f.ok).toBe(false);
    expect(f.stakeTooLow).toBe(true);
    expect(f.unknownBits).toBe("0x8");
    expect(describeValidatorFlags(f)).toMatch(/unrecognised bits 0x8/);
  });
});

describe("readLiveValidator", () => {
  it("pins every read to one block", async () => {
    const { reader, calls } = fakeChain();
    const d = await readLiveValidator({ validatorId: 97, delegator: DELEGATOR, reader });

    expect(d.blockNumber).toBe(Number(BLOCK));
    expect(calls.map((c) => c.fn).sort()).toEqual([
      "getDelegator",
      "getDelegator",
      "getEpoch",
      "getValidator",
    ]);
    for (const c of calls) expect(c.blockNumber).toBe(BLOCK);
  });

  it("maps the three views and the auth address's own record", async () => {
    const { reader } = fakeChain();
    const d = await readLiveValidator({ validatorId: 97, reader });

    expect(d.exists).toBe(true);
    expect(d.authAddress).toBe(AUTH.toLowerCase());
    expect(d.stakeWei).toBe(1_200n * MON);
    expect(d.consensusStakeWei).toBe(1_000n * MON);
    expect(d.snapshotStakeWei).toBe(900n * MON);
    expect([d.commissionBps, d.consensusCommissionBps, d.snapshotCommissionBps]).toEqual([
      1000, 500, 500,
    ]);
    expect(d.poolUnclaimedRewardsWei).toBe(40n * MON);
    expect(d.authDelegator?.unclaimedRewardsWei).toBe(7n * MON);
    expect(d.delegator).toBeNull();
    expect(d.secpPubkey).toBe("02abcd");
  });

  it("does not read a delegator twice when it is the auth address", async () => {
    const { reader, calls } = fakeChain();
    const d = await readLiveValidator({ validatorId: 97, delegator: AUTH, reader });
    expect(calls.filter((c) => c.fn === "getDelegator")).toHaveLength(1);
    expect(d.delegator).toBe(d.authDelegator);
  });

  it("reports a missing validator without reading delegators", async () => {
    const { reader, calls } = fakeChain({ exists: false });
    const d = await readLiveValidator({ validatorId: 999_999, delegator: DELEGATOR, reader });
    expect(d.exists).toBe(false);
    expect(d.authDelegator).toBeNull();
    expect(calls.some((c) => c.fn === "getDelegator")).toBe(false);
  });
});

describe("buildValidatorOnchainPayload", () => {
  it("keeps the pool and the operator's claimable balance apart", async () => {
    const { reader } = fakeChain();
    const d = await readLiveValidator({ validatorId: 97, delegator: DELEGATOR, reader });
    const p = buildValidatorOnchainPayload(d, "Backpack") as Record<string, any>;

    expect(p.as_of_block).toBe(Number(BLOCK));
    expect(p.read_methods).toContain("getDelegator(uint64,address)");
    expect(p.validator.pool_unclaimed_rewards_mon).toBe(40);
    expect(p.operator.claimable_rewards_mon).toBe(7);
    expect(p.validator.stake_mon).toEqual({ execution: 1200, consensus: 1000, snapshot: 900 });
    expect(p.validator.flags.ok).toBe(true);
    expect(p.validator.moniker).toBe("Backpack");
    expect(p.validator.moniker_data_class).toBe(3);
  });

  it("labels pending changes as derived and lists stake waiting to activate", async () => {
    const { reader } = fakeChain();
    const d = await readLiveValidator({ validatorId: 97, delegator: DELEGATOR, reader });
    const p = buildValidatorOnchainPayload(d, null) as Record<string, any>;

    expect(p.derived).toMatchObject({
      data_class: 2,
      pending_stake_change_mon: 200,
      commission_change_pending: true,
    });
    expect(p.delegator).toMatchObject({
      address: DELEGATOR,
      has_position: true,
      active_stake_mon: 50,
      claimable_rewards_mon: 2,
      pending_stake: [{ amount_mon: 25, activates_at_epoch: 2251 }],
    });
  });

  it("explains a flagged validator", async () => {
    const { reader } = fakeChain({ flags: 5n });
    const d = await readLiveValidator({ validatorId: 97, reader });
    const p = buildValidatorOnchainPayload(d, null) as Record<string, any>;
    expect(p.validator.flags).toMatchObject({ ok: false, stake_too_low: true, double_sign: true });
    expect(p.validator.flags.meaning).toMatch(/double signing/);
  });

  it("returns not_found for an id the precompile does not know", async () => {
    const { reader } = fakeChain({ exists: false });
    const d = await readLiveValidator({ validatorId: 999_999, reader });
    const p = buildValidatorOnchainPayload(d, null) as Record<string, any>;
    expect(p.not_found).toBe(true);
    expect(p.validator).toBeUndefined();
    expect(p.read_methods).toEqual(["getEpoch()", "getValidator(uint64)"]);
  });
});
