import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak256 } from "viem";

/**
 * Derive the Ethereum address from a compressed secp256k1 public key.
 * This matches the address embedded in every block's system transaction arg,
 * allowing block proposer identification without relying on block.miner.
 *
 * Formula: keccak256(uncompressed_pubkey_without_prefix)[12:]
 */
export function secpPubkeyToAddr(compressedHex: string): `0x${string}` {
  const point = secp256k1.ProjectivePoint.fromHex(compressedHex);
  const uncompressed = point.toRawBytes(false); // 65 bytes: 04 || X || Y
  const raw64 = uncompressed.slice(1); // 64 bytes: X || Y (no 04 prefix)
  const hash = keccak256(raw64); // "0x" + 64 hex chars
  return `0x${hash.slice(-40)}` as `0x${string}`; // last 20 bytes
}
