export type WeatherCondition = "sunny" | "cloudy" | "stormy";

export type NetworkSnapshot = {
  condition: WeatherCondition;
  activeValidators: number;
  successRate: number;
  diversityScore: number;
  trend: { day: string; successRate: number; activeValidators: number }[];
};

export function getMockNetworkSnapshot(): NetworkSnapshot {
  return {
    condition: "sunny",
    activeValidators: 187,
    successRate: 99.3,
    diversityScore: 7.4,
    trend: [
      { day: "Mon", successRate: 98.8, activeValidators: 184 },
      { day: "Tue", successRate: 99.1, activeValidators: 185 },
      { day: "Wed", successRate: 99.4, activeValidators: 186 },
      { day: "Thu", successRate: 97.2, activeValidators: 181 },
      { day: "Fri", successRate: 98.9, activeValidators: 185 },
      { day: "Sat", successRate: 99.5, activeValidators: 187 },
      { day: "Sun", successRate: 99.3, activeValidators: 187 },
    ],
  };
}
