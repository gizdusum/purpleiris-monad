export type EpochSnapshot = {
  epoch: number;
  validatorAddress: string;
  blocksProposed: number;
  blocksMissed: number;
  successRate: number;
  votingPower: bigint;
  delegatorCount: number;
  snapshotAt: Date;
  scheduledDowntime: boolean;
};

export type NetworkSnapshot = {
  activeValidators: number;
  totalValidators: number;
  successRate: number;
  diversityScore: number;
  trend: { day: string; successRate: number; activeValidators: number }[];
};
