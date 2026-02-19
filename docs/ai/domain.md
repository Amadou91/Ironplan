# Ironplan Domain Logic

> **The Math** and **Business Rules** of Ironplan.

## Core Metrics

### E1RM (Estimated 1-Rep Max)
**Purpose:** Estimate strength progress.
**Formula:** `E1RM = weight × (1 + repsAtFailure / 30)`
**Rules:**
- `repsAtFailure = reps + (10 - RPE)`
- `weight > 0`
- `reps <= 12`
- `RPE >= 6`

### Volume Load (Tonnage)
**Purpose:** Measure total work.
**Formula:** `Tonnage = reps × external_weight`
**Rules:**
- **External Load Only:** Bodyweight does NOT count unless weighted.
- If no external weight: `Tonnage = 0`.
- Per-implement: `weight × implement_count`.

### Workload Score
**Purpose:** Calculate physiological stress.
**Formula:** `Tonnage × IntensityFactor` (Strength) OR `Time × IntensityFactor × 215` (Cardio)
**Rules:**
- **External Load Only.**
- Normalized Intensity (RPE 1-10 → 0.1-1.0).

### Training Load Ratio (ACR)
**Purpose:** Prevent overtraining.
**Formula:** `Acute Load (7d) / Chronic Load (28d Avg)`
**Status:**
- `> 1.3`: Overreaching
- `< 0.8`: Undertraining
- `0.8 - 1.3`: Balanced

## Readiness Score

**Purpose:** Daily readiness assessment (0-100).
**Inputs (1-5 Scale):**
- Sleep (Higher is better)
- Motivation (Higher is better)
- Soreness (Lower is better)
- Stress (Lower is better)

**Formula:**
`Score = ((Sleep + Motivation + (6-Soreness) + (6-Stress) - 4) / 16) × 100`

**Levels:**
- `High`: ≥ 70
- `Steady`: 40-69
- `Low`: < 40

**Database:** stored in `session_readiness` table (keyed by `session_id`).

## Body Metrics

- **BMI:** `(weight_lb / height_in²) × 703`
- **BMR:** `10w + 6.25h - 5a + s` (Mifflin-St Jeor)

## Intensity Normalization

| RPE | Factor |
|-----|--------|
| 10  | 1.0    |
| 7   | 0.57   |
| 4   | 0.14   |
| <4  | 0.10   |

## Testing Correctness

Critical algorithms have "Golden Fixtures" in `tests/correctness/`.
ALWAYS verify changes against `npm test`.
