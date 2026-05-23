-- Add unclaimed_rewards_wei to validators (live pending commission, refreshed each epoch cycle)
ALTER TABLE validators
  ADD COLUMN IF NOT EXISTS unclaimed_rewards_wei NUMERIC(78, 0);

-- Cumulative per-block proposer reward history (from 0x3a420a01 events)
CREATE TABLE IF NOT EXISTS validator_staking_rewards (
  id              BIGSERIAL PRIMARY KEY,
  -- on-chain uint64 validator ID (from event topics[1])
  onchain_validator_id  BIGINT NOT NULL,
  -- auth address (FK to validators.id), lowercased
  validator_auth_address TEXT NOT NULL REFERENCES validators(id) ON DELETE CASCADE,
  block_number    BIGINT NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL,
  -- gross reward emitted by protocol per block (~21.25 MON in wei)
  gross_reward_wei       NUMERIC(78, 0) NOT NULL,
  -- commission_earned = gross_reward * commission_rate / 1e18
  commission_earned_wei  NUMERIC(78, 0) NOT NULL,
  -- epoch number from event data[1]
  epoch           BIGINT NOT NULL,
  indexed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vsr_validator_block
  ON validator_staking_rewards (onchain_validator_id, block_number);

CREATE INDEX IF NOT EXISTS idx_vsr_auth_ts
  ON validator_staking_rewards (validator_auth_address, block_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_vsr_block_number
  ON validator_staking_rewards (block_number);
