/**
 * Validator flags, as returned by `getValidator(uint64).flags` on the staking
 * precompile.
 *
 * Bit positions are taken from the Monad client source
 * (category/execution/monad/staking/util/constants.hpp):
 *
 *   ValidatorFlagsOk          = 0
 *   ValidatorFlagsStakeTooLow = 1 << 0
 *   ValidatorFlagWithdrawn    = 1 << 1
 *   ValidatorFlagsDoubleSign  = 1 << 2
 *
 * Per the same source, any non-zero value means the validator is not a
 * candidate for the consensus set in the next epoch. Class 1 (on-chain).
 */
export const VALIDATOR_FLAG_BITS = {
  stakeTooLow: 1n << 0n,
  withdrawn: 1n << 1n,
  doubleSign: 1n << 2n,
} as const;

const KNOWN_MASK =
  VALIDATOR_FLAG_BITS.stakeTooLow | VALIDATOR_FLAG_BITS.withdrawn | VALIDATOR_FLAG_BITS.doubleSign;

export type DecodedValidatorFlags = {
  /** Raw bitfield, as a decimal string. */
  raw: string;
  /** True when no flag is set: the validator is eligible for the next consensus set. */
  ok: boolean;
  /** Total stake is below the active-set threshold. */
  stakeTooLow: boolean;
  /** The auth address withdrew below its required self-stake. */
  withdrawn: boolean;
  /** The validator was flagged for double signing. */
  doubleSign: boolean;
  /** Bits set outside the three known flags, as a hex string, or null. */
  unknownBits: string | null;
};

export function decodeValidatorFlags(flags: bigint): DecodedValidatorFlags {
  const unknown = flags & ~KNOWN_MASK;
  return {
    raw: flags.toString(),
    ok: flags === 0n,
    stakeTooLow: (flags & VALIDATOR_FLAG_BITS.stakeTooLow) !== 0n,
    withdrawn: (flags & VALIDATOR_FLAG_BITS.withdrawn) !== 0n,
    doubleSign: (flags & VALIDATOR_FLAG_BITS.doubleSign) !== 0n,
    unknownBits: unknown === 0n ? null : `0x${unknown.toString(16)}`,
  };
}

/** Short human-readable reading of a decoded flag set. */
export function describeValidatorFlags(f: DecodedValidatorFlags): string {
  if (f.ok) return "No flags set: eligible for the next consensus set.";
  const parts: string[] = [];
  if (f.stakeTooLow) parts.push("stake below the active-set threshold");
  if (f.withdrawn) parts.push("auth address below its required self-stake");
  if (f.doubleSign) parts.push("flagged for double signing");
  if (f.unknownBits) parts.push(`unrecognised bits ${f.unknownBits}`);
  return `Not a candidate for the next consensus set: ${parts.join(", ")}.`;
}
