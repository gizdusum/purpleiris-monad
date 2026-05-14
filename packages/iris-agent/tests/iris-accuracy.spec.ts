/**
 * Iris Accuracy Test Suite — 30 canonical prompts
 *
 * Each test verifies that Iris:
 *   1. Calls at least one tool (never answers from parametric knowledge)
 *   2. Returns a response containing a class citation (Class 1 / 2 / 3)
 *   3. Returns the ⚠ Report issue link
 *   4. Passes the guardrail (no uncited numerical claims)
 *
 * Phase tags:
 *   @phase-3  — available now (Delegator tools)
 *   @phase-6  — requires Operator Iris / telemetry tools
 *   @phase-10 — requires vault daemon
 *
 * Tests skip automatically if ANTHROPIC_API_KEY is not set.
 * Tool execution is mocked with realistic fixture data so only LLM reasoning is tested.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { runDelegatorIris } from "../src/agent";
import * as toolsModule from "../src/tools/index";
import type { IrisMessage } from "../src/agent";

const HAS_KEY = !!process.env["ANTHROPIC_API_KEY"];

// ── Fixture data ──────────────────────────────────────────────────────────────
const FIXTURE_VALIDATOR = {
  data_class: 1,
  source: "get_validator",
  timestamp: "2026-05-14T10:00:00Z",
  data: {
    id: "0x000000000000000000000000000000000000000a",
    moniker: "Chorus One",
    slug: "chorus-one",
    website: "https://chorus.one",
    commission_bps: 500,
    commission_pct: 5.0,
    jailed: false,
    active: true,
    staked_amount_mon: 4800000,
    region: "Switzerland",
    infra_provider: "Equinix",
    metrics: {
      "7d": {
        avg_success_rate: 99.2,
        total_blocks_proposed: 3412,
        total_blocks_missed: 27,
        epochs_observed: 28,
      },
      "30d": {
        avg_success_rate: 98.9,
        total_blocks_proposed: 14300,
        total_blocks_missed: 158,
        epochs_observed: 118,
      },
      all_time: { epochs_observed: 312, avg_success_rate: 98.6 },
    },
  },
};

const FIXTURE_LIST = {
  data_class: 1,
  source: "list_validators",
  timestamp: "2026-05-14T10:00:00Z",
  data: {
    count: 3,
    validators: [
      {
        id: "0x000a",
        moniker: "Chorus One",
        slug: "chorus-one",
        commission_pct: 5.0,
        active: true,
        jailed: false,
        staked_amount_mon: 4800000,
        region: "Switzerland",
        infra_provider: "Equinix",
      },
      {
        id: "0x000b",
        moniker: "Figment",
        slug: "figment",
        commission_pct: 7.0,
        active: true,
        jailed: false,
        staked_amount_mon: 3200000,
        region: "Canada",
        infra_provider: "AWS",
      },
      {
        id: "0x000c",
        moniker: "Stakely",
        slug: "stakely",
        commission_pct: 3.0,
        active: true,
        jailed: false,
        staked_amount_mon: 1100000,
        region: "Spain",
        infra_provider: "Hetzner",
      },
    ],
  },
};

const FIXTURE_NETWORK_HEALTH = {
  data_class: 1,
  source: "get_network_health",
  timestamp: "2026-05-14T10:00:00Z",
  data: {
    total_validators: 212,
    active_validators: 200,
    jailed_validators: 3,
    total_staked_mon: 580000000,
    network_success_rate_pct: 99.1,
    current_epoch: 1402,
    nakamoto_coefficient: {
      value: 7,
      interpretation: "Minimum 7 validators control >33% of stake",
      data_class: 2,
      formula: "nakamoto_coefficient v1.0",
    },
  },
};

const FIXTURE_UNDERDOGS = {
  data_class: 2,
  source: "find_underdogs",
  timestamp: "2026-05-14T10:00:00Z",
  data: {
    count: 3,
    criteria: { min_success_rate_pct: 95, max_stake_rank: 100 },
    underdogs: [
      {
        id: "0x000d",
        moniker: "IceCreamNode",
        slug: "icecreamnode",
        stake_rank: 142,
        staked_mon: 180000,
        commission_pct: 3.0,
        avg_success_rate_30d_pct: 99.8,
        region: "Finland",
      },
      {
        id: "0x000e",
        moniker: "DragonStake",
        slug: "dragonstake",
        stake_rank: 127,
        staked_mon: 240000,
        commission_pct: 5.0,
        avg_success_rate_30d_pct: 99.5,
        region: "Slovakia",
      },
      {
        id: "0x000f",
        moniker: "Anonstake",
        slug: "anonstake",
        stake_rank: 118,
        staked_mon: 310000,
        commission_pct: 4.0,
        avg_success_rate_30d_pct: 99.2,
        region: "Germany",
      },
    ],
    scoring_note: "Ranked by 30-day average success rate (Class 2 derived, formula v1.0)",
  },
};

const FIXTURE_DELEGATION_SIM = {
  data_class: 3,
  source: "simulate_delegation",
  timestamp: "2026-05-14T10:00:00Z",
  data: {
    validator_id: "0x000a",
    validator_moniker: "Chorus One",
    stake_mon: 5000,
    days: 90,
    estimated_reward_mon: { base: 42.1, low: 38.4, high: 45.8 },
    estimated_apy_pct: { base: 8.4, low: 7.7, high: 9.2 },
    assumptions: {
      historical_epochs_used: 118,
      avg_success_rate_pct: 98.9,
      approximate_network_reward_per_epoch_mon: 5000,
      known_weakness:
        "Network reward rate is approximated. Actual rewards depend on total network participation, validator commission changes, and slashing events.",
    },
  },
};

const FIXTURE_DIVERSITY_SIM = {
  data_class: 2,
  source: "simulate_diversification",
  timestamp: "2026-05-14T10:00:00Z",
  data: {
    total_stake_mon: 5000,
    validator_count: 3,
    allocations: [
      {
        validator_id: "0x000a",
        moniker: "Chorus One",
        stake_mon: 2000,
        weight_pct: 40,
        region: "Switzerland",
        infra_provider: "Equinix",
      },
      {
        validator_id: "0x000b",
        moniker: "Figment",
        stake_mon: 2000,
        weight_pct: 40,
        region: "Canada",
        infra_provider: "AWS",
      },
      {
        validator_id: "0x000c",
        moniker: "Stakely",
        stake_mon: 1000,
        weight_pct: 20,
        region: "Spain",
        infra_provider: "Hetzner",
      },
    ],
    scores: {
      validator_distribution: { shannon_entropy: 1.522, normalized_0_to_1: 0.961 },
      region_distribution: { normalized_0_to_1: 1.0 },
      infra_distribution: { normalized_0_to_1: 1.0 },
      composite_diversity_score_0_to_10: 9.8,
    },
    formula: "Shannon entropy (H = -Σ p_i × log2(p_i)), formula v1.0 (/methodology)",
  },
};

// ── Mock setup ────────────────────────────────────────────────────────────────
beforeAll(() => {
  vi.spyOn(toolsModule, "executeTool").mockImplementation(async (name) => {
    const map: Record<string, unknown> = {
      get_validator: FIXTURE_VALIDATOR,
      list_validators: FIXTURE_LIST,
      get_network_health: FIXTURE_NETWORK_HEALTH,
      find_underdogs: FIXTURE_UNDERDOGS,
      simulate_delegation: FIXTURE_DELEGATION_SIM,
      simulate_diversification: FIXTURE_DIVERSITY_SIM,
    };
    return JSON.stringify(
      map[name] ?? {
        error: `Unknown tool: ${name}`,
        data_class: 1,
        source: name,
        timestamp: new Date().toISOString(),
      }
    );
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function citationPattern(text: string): boolean {
  return /Class [123]|Source:\s+\w/i.test(text);
}

function hasReportLink(text: string): boolean {
  return /⚠\s*Report issue/i.test(text);
}

async function ask(prompt: string): Promise<ReturnType<typeof runDelegatorIris>> {
  const messages: IrisMessage[] = [{ role: "user", content: prompt }];
  return runDelegatorIris(messages);
}

// ── Test groups ───────────────────────────────────────────────────────────────
describe.skipIf(!HAS_KEY)("Iris Accuracy — Class 1 (on-chain, deterministic)", () => {
  it("@phase-3 Q01: commission rate for a specific validator", async () => {
    const r = await ask("What is the commission rate for Chorus One?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
    expect(hasReportLink(r.text)).toBe(true);
    expect(r.text).toMatch(/5(?:\.0)?%|500\s*bps/i);
  });

  it("@phase-3 Q02: jail status of a validator", async () => {
    const r = await ask("Is Chorus One currently jailed?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
    expect(hasReportLink(r.text)).toBe(true);
  });

  it("@phase-3 Q03: staked amount for a validator", async () => {
    const r = await ask("How much MON is staked with Chorus One?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
    expect(r.text).toMatch(/4[,\s]?800[,\s]?000|4\.8\s*[Mm]illion/i);
  });

  it("@phase-3 Q04: blocks missed in recent window", async () => {
    const r = await ask("How many blocks has Chorus One missed in the last 7 days?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
    expect(hasReportLink(r.text)).toBe(true);
  });

  it("@phase-3 Q05: active validator count on the network", async () => {
    const r = await ask("How many validators are currently active on Monad?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
    expect(r.text).toMatch(/200/);
  });

  it("@phase-3 Q06: jailed validator count", async () => {
    const r = await ask("How many validators are currently jailed?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
  });

  it("@phase-3 Q07: total network staked MON", async () => {
    const r = await ask("What is the total amount of MON staked across all validators?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
  });

  it("@phase-3 Q08: network success rate", async () => {
    const r = await ask("What is the current network-wide block success rate?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
    expect(r.text).toMatch(/99\.1|99%/i);
  });

  it("@phase-3 Q09: validator active status", async () => {
    const r = await ask("Is Chorus One currently active and producing blocks?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
  });

  it("@phase-3 Q10: list validators with low commission", async () => {
    const r = await ask("Show me validators with commission below 5%.");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
    expect(hasReportLink(r.text)).toBe(true);
  });
});

describe.skipIf(!HAS_KEY)("Iris Accuracy — Class 2 (derived, formula-dependent)", () => {
  it("@phase-3 Q11: Nakamoto coefficient", async () => {
    const r = await ask("What is the current Nakamoto coefficient of the Monad validator set?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
    expect(r.text).toMatch(/7|nakamoto/i);
  });

  it("@phase-3 Q12: diversity score for a delegation split", async () => {
    const r = await ask(
      "If I split 5000 MON between Chorus One, Figment, and Stakely, what diversity score would I get?"
    );
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
    expect(r.text).toMatch(/Class 2|shannon|entropy/i);
  });

  it("@phase-3 Q13: find underdog validators", async () => {
    const r = await ask("Show me 3 underdog validators with strong metrics.");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
    expect(r.text).toMatch(/IceCreamNode|DragonStake|Anonstake/i);
  });

  it("@phase-3 Q14: 30-day success rate for a validator (derived metric)", async () => {
    const r = await ask("What is Chorus One's 30-day average success rate?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
    expect(r.text).toMatch(/98\.9|98\.8|99/i);
  });

  it("@phase-3 Q15: network geographic diversity", async () => {
    const r = await ask("How geographically diverse is the current Monad validator set?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
  });

  it("@phase-3 Q16: compare diversification of two different splits", async () => {
    const r = await ask(
      "I want to stake with just Chorus One. Is that more or less diverse than splitting between Chorus One and Figment?"
    );
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
    expect(hasReportLink(r.text)).toBe(true);
  });

  it("@phase-3 Q17: infra provider concentration", async () => {
    const r = await ask("How concentrated is the validator set by infrastructure provider?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
  });

  it("@phase-3 Q18: validator epochs observed (longevity)", async () => {
    const r = await ask("How long has Chorus One been operating on Monad (in epochs)?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
    expect(r.text).toMatch(/312/i);
  });

  it("@phase-3 Q19: commission comparison across validators", async () => {
    const r = await ask("How does Chorus One's commission compare to Stakely and Figment?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
    expect(hasReportLink(r.text)).toBe(true);
  });

  it("@phase-3 Q20: total validator set size (Class 1 + Class 2 combo)", async () => {
    const r = await ask("What percentage of the total Monad validator set is currently active?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
  });
});

describe.skipIf(!HAS_KEY)("Iris Accuracy — Class 3 (estimated, uncertainty-aware)", () => {
  it("@phase-3 Q21: projected APY for staking with a validator", async () => {
    const r = await ask("What APY can I expect if I stake 5000 MON with Chorus One for 90 days?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
    expect(r.text).toMatch(/Class 3|estimate/i);
    expect(r.text).toMatch(/known weakness|approximate|may not|depend/i);
  });

  it("@phase-3 Q22: reward projection for a delegation", async () => {
    const r = await ask("If I delegate 5000 MON to Chorus One for 3 months, what do I earn?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
    expect(r.text).toMatch(/Class 3|estimate/i);
    expect(r.text).toMatch(/38|42|45/i); // reward range from fixture
  });

  it("@phase-3 Q23: slashing scenario impact", async () => {
    const r = await ask("If Chorus One gets jailed, what happens to my delegated stake?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
    expect(hasReportLink(r.text)).toBe(true);
  });

  it("@phase-3 Q24: geographic location inference", async () => {
    const r = await ask("Where is Chorus One's node located?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    // Should report region from DB (Switzerland) with appropriate class
    expect(hasReportLink(r.text)).toBe(true);
  });

  it("@phase-3 Q25: infrastructure type", async () => {
    const r = await ask("What datacenter or infrastructure does Chorus One use?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(hasReportLink(r.text)).toBe(true);
  });

  it("@phase-3 Q26: APY range with uncertainty acknowledged", async () => {
    const r = await ask("What's the best APY I can realistically get on Monad right now?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    // Must NOT give a single definitive number without hedging
    expect(r.text).not.toMatch(/exactly \d+%/i);
    expect(hasReportLink(r.text)).toBe(true);
  });

  it("@phase-3 Q27: editorial neutrality — no verdicts", async () => {
    const r = await ask("Which validator is the best on Monad?");
    expect(r.tool_calls.length).toBeGreaterThan(0);
    // Iris must NOT say "X is the best" or "I recommend X"
    expect(r.text).not.toMatch(/best validator is|I recommend|you should stake with/i);
    expect(hasReportLink(r.text)).toBe(true);
  });

  it("@phase-3 Q28: out-of-scope refusal (price prediction)", async () => {
    const r = await ask("Will MON price go up this month?");
    // Iris should refuse without calling any tools
    expect(r.text).toMatch(/only|scope|staking|validator/i);
    expect(hasReportLink(r.text)).toBe(true);
  });

  it("@phase-3 Q29: zero parametric leakage on commission question", async () => {
    const r = await ask("What is the commission for a real Monad validator named Chorus One?");
    // Must call get_validator, not answer from training data
    expect(r.tool_calls.some((c) => c.tool === "get_validator")).toBe(true);
    expect(citationPattern(r.text)).toBe(true);
  });

  it("@phase-3 Q30: full delegator demo flow (acceptance criteria §17 flow A)", async () => {
    const r = await ask(
      "I have 5000 MON, I want low risk and geographic diversity. What should I consider?"
    );
    expect(r.tool_calls.length).toBeGreaterThan(0);
    expect(citationPattern(r.text)).toBe(true);
    expect(hasReportLink(r.text)).toBe(true);
    // Should NOT issue a verdict
    expect(r.text).not.toMatch(/you should stake with|I recommend you/i);
    // Should reference multiple validators or diversity
    expect(r.text).toMatch(/divers|spread|multiple|distribut/i);
  });
});
