export type NetworkSnapshot = {
  activeValidators: number;
  totalValidators: number;
  successRate: number;
  diversityScore: number;
  trend: { day: string; successRate: number; activeValidators: number }[];
};

export function getMockNetworkSnapshot(): NetworkSnapshot {
  return {
    activeValidators: 200,
    totalValidators: 212,
    successRate: 99.3,
    diversityScore: 7.4,
    trend: [
      { day: "Mon", successRate: 98.8, activeValidators: 197 },
      { day: "Tue", successRate: 99.1, activeValidators: 198 },
      { day: "Wed", successRate: 99.4, activeValidators: 200 },
      { day: "Thu", successRate: 97.2, activeValidators: 193 },
      { day: "Fri", successRate: 98.9, activeValidators: 198 },
      { day: "Sat", successRate: 99.5, activeValidators: 200 },
      { day: "Sun", successRate: 99.3, activeValidators: 200 },
    ],
  };
}
