-- Optimises per-validator time-range scans used by get_validator enrichment
-- and get_recent_assignments epoch history queries.
CREATE INDEX IF NOT EXISTS idx_epoch_snapshots_validator_snapshot_at
  ON epoch_snapshots(validator_id, snapshot_at DESC);
