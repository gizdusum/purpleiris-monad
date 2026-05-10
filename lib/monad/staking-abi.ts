// Monad staking precompile ABI (0x0000000000000000000000000000000000001000)
// Source: https://docs.monad.xyz/developer-essentials/staking/staking-precompile

export const STAKING_ABI = [
  {
    name: "getValidators",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "validators",
        type: "tuple[]",
        components: [
          { name: "valAddress", type: "address" },
          { name: "moniker", type: "string" },
          { name: "website", type: "string" },
          { name: "commission", type: "uint256" },
          { name: "jailed", type: "bool" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getValidator",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "valAddress", type: "address" }],
    outputs: [
      {
        name: "validator",
        type: "tuple",
        components: [
          { name: "valAddress", type: "address" },
          { name: "moniker", type: "string" },
          { name: "website", type: "string" },
          { name: "commission", type: "uint256" },
          { name: "jailed", type: "bool" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getDelegation",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "delAddress", type: "address" },
      { name: "valAddress", type: "address" },
    ],
    outputs: [
      {
        name: "delegation",
        type: "tuple",
        components: [
          { name: "shares", type: "uint256" },
          { name: "staked", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "getAllDelegatorStake",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "delAddress", type: "address" }],
    outputs: [
      {
        name: "delegations",
        type: "tuple[]",
        components: [
          { name: "valAddress", type: "address" },
          { name: "shares", type: "uint256" },
          { name: "staked", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "getValidatorDelegations",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "valAddress", type: "address" }],
    outputs: [
      {
        name: "delegations",
        type: "tuple[]",
        components: [
          { name: "delAddress", type: "address" },
          { name: "shares", type: "uint256" },
          { name: "staked", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "getStakedAmount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "valAddress", type: "address" }],
    outputs: [{ name: "amount", type: "uint256" }],
  },
] as const;
