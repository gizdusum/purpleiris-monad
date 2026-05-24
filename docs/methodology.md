# Hermes Scoring Methodology

Public record of all Class-2 (derived) formulas used by Hermes.

Formula versions are immutable. A score computed with v1.0 stays a v1.0 score even after v1.1 ships.

---

## v1.0 — Initial formulas

### Shannon Entropy (Delegator Diversity)

Measures how evenly delegated stake is spread across validators.

```
H = −Σ (p_i × log2(p_i))   where p_i = stake_i / total_stake
```

Normalized to 0–1 over the active validator set size.

Data class: **Class 2**. Inputs are Class 1 (on-chain). Formula version: `v1.0`.

### Nakamoto Coefficient

Minimum number of validators controlling > 1/3 of total stake (33% attack threshold).

```
Sort validators by stake descending.
Walk the list, accumulate stake.
Return the index where cumulative stake > total / 3.
```

Data class: **Class 2**. Inputs are Class 1 (on-chain). Formula version: `v1.0`.

---

_Last updated: 2026-05-24. New formula versions will be added with a changelog entry._
