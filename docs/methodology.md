# Iris Scoring Methodology

Public record of all Class-2 (derived) formulas used by Iris.

Formula versions are immutable. A score computed with v1.0 stays a v1.0 score even after v1.1 ships.

---

## v1.0 — Initial formulas

### OVR Score

Composite score on a 0–100 scale from four weighted sub-scores derived from Watchtower data.

```
perf        = clamp(50, 99, uptime_pct × 0.7 + epoch_success_rate × 0.3)
trust       = clamp(50, 99, 99 − min(vdp_flagged_weeks × 5, 30) − alert_level × 10)
reliability = clamp(50, 99, 99 − min(consecutive_skipped × 2, 30))
activity    = clamp(50, 99, min(epochs_observed + 50, 99))

OVR = round((perf × 0.40 + trust × 0.30 + reliability × 0.20 + activity × 0.10))
```

Data class: **Class 2**. Inputs are Class 1 (Watchtower). Formula version: `v1.0`.

### Shannon Entropy (Delegator Diversity)

Measures how evenly a delegator's stake is spread across validators.

```
H = −Σ (p_i × log2(p_i))   where p_i = stake_i / total_stake
```

Normalized to 0–1 over the active validator set size.

### Nakamoto Coefficient

Minimum number of validators controlling > 1/3 of total stake (33% attack threshold).

```
Sort validators by stake descending.
Walk the list, accumulate stake.
Return the index where cumulative stake > total / 3.
```

---

_Last updated: 2026-05-14. New formula versions will be added with a changelog entry._
