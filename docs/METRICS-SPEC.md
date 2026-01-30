# Ironplan Metrics Specification

This document defines the business-critical metrics and algorithms used in Ironplan.
Each metric has corresponding golden fixture tests in `tests/correctness/`.

---

## Table of Contents

1. [E1RM (Estimated 1-Rep Max)](#e1rm-estimated-1-rep-max)
2. [Unit Conversions](#unit-conversions)
3. [Volume Load (Tonnage)](#volume-load-tonnage)
4. [Workload Score](#workload-score)
5. [Training Load Ratio (ACR)](#training-load-ratio-acr)
6. [Readiness Score](#readiness-score)
7. [Intensity Normalization](#intensity-normalization)
8. [Body Metrics (BMI/BMR)](#body-metrics-bmibmr)
9. [Math Utilities](#math-utilities)

---

## E1RM (Estimated 1-Rep Max)

**Purpose**: Estimate a user's theoretical maximum single-rep lift based on submaximal performance.  
**Used For**: Tracking strength progress over time, prescribing training loads.  
**Location**: [src/lib/session-metrics.ts](../src/lib/session-metrics.ts)

### Formula (Epley v1)

```
E1RM = weight × (1 + repsAtFailure / 30)

where:
  repsAtFailure = reps + RIR
  RIR = Reps In Reserve (clamped to 0-6)
  RIR = 10 - RPE (when using RPE)
```

### Eligibility Rules

| Criterion | Requirement |
|-----------|-------------|
| Reps | 1-12 (Epley inaccurate above 12) |
| RPE | ≥ 6 (or RIR ≤ 4) |
| Weight | > 0 |
| Effort Indicator | RPE or RIR must be provided |

### Examples (Golden Fixtures)

| ID | Scenario | Weight | Reps | RPE/RIR | E1RM |
|----|----------|--------|------|---------|------|
| e1rm-001 | Standard set | 100 kg | 5 | RPE 10 | 116.67 kg |
| e1rm-002 | Moderate effort | 60 kg | 10 | RPE 8 | 84.0 kg |
| e1rm-003 | Heavy single | 200 kg | 1 | RPE 9 | 213.33 kg |
| e1rm-005 | Using RIR | 80 kg | 8 | RIR 3 | 109.33 kg |

### Invariants

- E1RM always ≥ weight used
- Higher weight → higher E1RM (same reps/effort)
- More reps at same weight → higher E1RM (you're stronger)
- RIR clamped to maximum of 6

---

## Unit Conversions

**Purpose**: Convert between weight units (kg/lb) and distance units.  
**Used For**: All load-based calculations, user display preferences.  
**Location**: [src/lib/units.ts](../src/lib/units.ts)

### Constants

```typescript
LBS_PER_KG = 2.20462262
KG_PER_LB = 0.45359237  // 1 / LBS_PER_KG
METERS_PER_MILE = 1609.344
METERS_PER_KM = 1000
```

### Critical Behavior

| Input Unit | Default Assumption |
|------------|-------------------|
| `null` | Treated as `lb` (legacy data) |
| `undefined` | Treated as `lb` (legacy data) |
| Invalid (NaN, Infinity) | Returns `0` |

### Invariants

- Round-trip conversion: `kg → lb → kg` preserves value (within floating point tolerance)
- Order preserved: if `a < b` in kg, then `a < b` in lb
- `LBS_PER_KG × KG_PER_LB = 1`

---

## Volume Load (Tonnage)

**Purpose**: Measure total training volume as weight × reps.  
**Used For**: Tracking volume trends, comparing workouts.  
**Location**: [src/lib/session-metrics.ts](../src/lib/session-metrics.ts)

### Formula

```
Tonnage (lbs) = reps × effective_weight

For weighted exercises:
  effective_weight = weight (converted to lbs)

For per-implement loads:
  effective_weight = weight × implement_count

For bodyweight exercises:
  effective_weight = virtual_bodyweight + external_weight
  virtual_bodyweight = user_weight × multiplier
```

### Virtual Bodyweight Multipliers

| Exercise Type | Multiplier | Examples |
|---------------|------------|----------|
| Push | 0.66 | Push-ups, dips |
| Pull | 0.90 | Pull-ups, chin-ups |
| Default | 0.70 | Burpees, squats |

**Default user weight**: 170 lbs (when not provided)

### Examples (Golden Fixtures)

| ID | Scenario | Reps | Weight | Tonnage |
|----|----------|------|--------|---------|
| tonnage-001 | Standard weighted | 10 | 100 lb | 1,000 lbs |
| tonnage-003 | Bodyweight push-up (170 lb user) | 20 | - | 2,244 lbs |
| tonnage-004 | Bodyweight pull-up (170 lb user) | 10 | - | 1,530 lbs |
| tonnage-005 | Weighted pull-up | 8 | +45 lb | 1,584 lbs |

### Invariants

- Tonnage always ≥ 0
- Linear scaling with reps (double reps = double tonnage)
- Linear scaling with weight

---

## Workload Score

**Purpose**: Quantify physiological stress combining volume and intensity.  
**Used For**: Training load management, acute:chronic ratio.  
**Location**: [src/lib/session-metrics.ts](../src/lib/session-metrics.ts)

### Formula

```
For strength sets:
  Workload = Tonnage × IntensityFactor

For cardio/duration sets:
  Workload = Minutes × IntensityFactor × TIME_LOAD_FACTOR
  TIME_LOAD_FACTOR = 215 (scales ~60min @ RPE 7 to ~7,500 load)
```

### Intensity Factor

See [Intensity Normalization](#intensity-normalization) below.

---

## Training Load Ratio (ACR)

**Purpose**: Monitor training load balance to prevent overtraining/undertraining.  
**Used For**: Training recommendations, readiness assessment.  
**Location**: [src/lib/training-metrics.ts](../src/lib/training-metrics.ts)

### Formula

```
acuteLoad = sum(workload) for sessions in last 7 days
chronicLoad = sum(workload) for sessions in last 28 days
chronicWeeklyAvg = chronicLoad / 4
loadRatio = acuteLoad / chronicWeeklyAvg
```

### Status Classification

| Condition | Status |
|-----------|--------|
| loadRatio ≥ 1.3 | `overreaching` |
| loadRatio ≤ 0.8 AND chronicLoad > 0 | `undertraining` |
| Otherwise | `balanced` |

### Initial Phase

ACR is statistically volatile until:
- ≥ 14 days of history
- ≥ 4 sessions

During initial phase, status defaults to `balanced`.

### Examples (Golden Fixtures)

| ID | Scenario | Acute | Chronic Avg | Ratio | Status |
|----|----------|-------|-------------|-------|--------|
| acr-002 | Spike in training | 24,000 | 11,000 | 2.18 | overreaching |
| acr-003 | Detraining | 3,000 | 8,750 | 0.34 | undertraining |

### Invariants

- acuteLoad ≤ chronicLoad (when all sessions in window)
- chronicWeeklyAvg = chronicLoad / 4
- loadRatio = acuteLoad / chronicWeeklyAvg

---

## Readiness Score

**Purpose**: Assess training readiness from subjective metrics.  
**Used For**: Adjusting session intensity recommendations.  
**Location**: [src/lib/training-metrics.ts](../src/lib/training-metrics.ts)

### Formula

```
rawSum = sleep + motivation + (6 - soreness) + (6 - stress)
score = ((rawSum - 4) / 16) × 100

Where all inputs are 1-5 scale:
- sleep: higher = better
- motivation: higher = better  
- soreness: higher = WORSE (inverted)
- stress: higher = WORSE (inverted)
```

### Level Classification

| Score | Level |
|-------|-------|
| ≥ 70 | `high` |
| < 40 | `low` |
| 40-69 | `steady` |

### Examples (Golden Fixtures)

| ID | Sleep | Soreness | Stress | Motivation | Score | Level |
|----|-------|----------|--------|------------|-------|-------|
| ready-001 | 5 | 1 | 1 | 5 | 100 | high |
| ready-002 | 1 | 5 | 5 | 1 | 0 | low |
| ready-003 | 3 | 3 | 3 | 3 | 50 | steady |

### Invariants

- Score always 0-100
- Higher sleep → higher score
- Higher soreness → LOWER score (inverted)
- Higher stress → LOWER score (inverted)

---

## Intensity Normalization

**Purpose**: Convert RPE (1-10) to a normalized intensity factor (0-1).  
**Used For**: Workload calculations.  
**Location**: [src/lib/units.ts](../src/lib/units.ts)

### Formula

```
For RPE ≥ 4:
  intensityFactor = (RPE - 3) / 7

For RPE < 4:
  intensityFactor = 0.1

For null RPE:
  intensityFactor = 0.5 (default moderate)
```

### Examples

| RPE | Intensity Factor |
|-----|------------------|
| 10 | 1.0 |
| 7 | 0.571 |
| 4 | 0.143 |
| 3 | 0.1 |
| null | 0.5 |

### Invariants

- Always returns 0-1 range
- Monotonically increasing for RPE ≥ 4
- RPE 10 always returns 1.0

---

## Body Metrics (BMI/BMR)

**Purpose**: Calculate body composition metrics.  
**Location**: [src/lib/body-metrics.ts](../src/lib/body-metrics.ts)

### BMI Formula

```
BMI = (weight_lb / height_in²) × 703
```

### BMR Formula (Mifflin-St Jeor)

```
BMR = 10 × weight_kg + 6.25 × height_cm - 5 × age + sex_offset

Where:
  sex_offset = +5 for male, -161 for female
```

### Invariants

- BMI increases with weight, decreases with height
- BMR higher for males than females (same stats)
- Invalid sex returns null

---

## Math Utilities

**Location**: [src/lib/math.ts](../src/lib/math.ts)

### clamp(value, min, max)

Returns value bounded to [min, max].

**Invariants**:
- Result always within [min, max]
- Idempotent: clamp(clamp(x)) = clamp(x)

### weightedAverage(values, weights)

Calculates weighted average, skipping null values.

**Invariants**:
- Equal weights → arithmetic mean
- Result within [min(values), max(values)]
- All null values → returns null

### isValidNumber(value)

Type guard for finite numbers.

**Returns true for**: 0, positive/negative integers, floats  
**Returns false for**: NaN, Infinity, null, undefined, strings, objects

---

## Running Correctness Tests

```bash
# Run all tests including correctness tests
npm test

# Run only correctness tests
node --test --experimental-vm-modules tests/correctness/*.ts

# Type check
npx tsc --noEmit
```

## Adding New Fixtures

1. Add fixture data to appropriate JSON file in `tests/fixtures/`
2. Include: `id`, `description`, `input`, `expected`, and optionally `tolerance` and `calculation`
3. Add corresponding test case in `tests/correctness/`
4. Document in this spec file

## Fixture Format

```json
{
  "id": "unique-id",
  "description": "Human-readable description",
  "input": { /* algorithm inputs */ },
  "expected": /* expected output */,
  "tolerance": 0.01,  // optional, for floating point
  "calculation": "Step-by-step formula" // optional, for documentation
}
```
