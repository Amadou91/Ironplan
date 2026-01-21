# Metrics Dashboard & Readiness

## Readiness metric definitions

- Sleep Quality: 1 = poor sleep, 5 = great sleep.
- Muscle Soreness: 1 = fresh, 5 = very sore.
- Stress Level: 1 = calm, 5 = high stress.
- Motivation: 1 = low, 5 = high motivation.

## Readiness score logic

- The readiness score is a 0-100 composite based on the four inputs.
- Sleep and motivation increase readiness; soreness and stress reduce it.
- Readiness level is derived from the score: low (<= 45), steady (46-69), high (>= 70).

## Storage model

- Readiness data is stored in `public.session_readiness` with one row per session.
- Each row includes the four inputs plus the derived readiness score and level.
- Data is keyed by `session_id` for easy joins with session training data.

## Dashboard visualizations

- Readiness score trend: line chart of the 0-100 readiness score over time.
- Readiness components: bar chart showing average Sleep, Soreness, Stress, Motivation (1-5) for the selected range.
- Readiness vs session effort: scatter plot comparing readiness score to average effort (RPE-derived) per session.

## Usage notes

- Use high readiness scores to justify harder sessions; low readiness should cue lower intensity or added recovery.
- Soreness and stress are intentionally interpreted as negatives in the readiness score.
- If a session is missing readiness data (manual logs), it is excluded from readiness charts.
