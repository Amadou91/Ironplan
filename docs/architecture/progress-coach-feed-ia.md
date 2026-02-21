# Progress IA Refactor: Coach Feed -> Summary -> Drilldown

## 1) IA Blueprint And Component Hierarchy

### IA zones (top to bottom)
1. `ProgressFilters` (sticky controls that scope all analytics)
2. `CoachFeed` (top 3 actionable insights, filter-scoped)
3. Key summaries (`TrainingStatusCard` + `MetricCards`)
4. Progressive drilldown (collapsed by default, expands to full charts + full session history)

### Component hierarchy
```text
ProgressPage
  PageHeader
  Alert (error state)
  ProgressFilters (sticky)
  CoachFeed
  SummarySection
    TrainingStatusCard (when ACR visibility is enabled)
    MetricCards
  DrilldownSection (progressive disclosure)
    ProgressCharts
    SessionHistoryList
```

### IA intent
- Reduce cognitive load: users land on 3 prioritized actions instead of all charts.
- Increase actionability: each insight includes explicit action text and key metric.
- Preserve expert depth: full chart and history drilldown remains available below.

## 2) Insight Generation Rules (Top 3)

Insights are generated from the same filtered dataset that powers summaries/charts/history.
Rules produce categorized candidates with numeric priority; highest priority per category survives; top 3 overall render.

### Primary rule categories
- `load`: overreaching or undertraining from ACR status/ratio.
- `readiness_effort`: mismatch between readiness and effort (e.g., low readiness + high effort).
- `consistency`: low or strong sessions/week cadence.
- `strength`: e1RM momentum positive or stagnating.
- `muscle_balance`: dominant or under-dosed muscle groups from distribution/imbalance.
- `recency`: long gap since last scoped session.
- `no_data`: explicit no-data action when current filters return zero sessions.

### Tie-break and fallback
- Highest priority wins within each category.
- Sorted descending by priority and clipped to exactly 3.
- If fewer than 3 candidates, deterministic fallback insights are appended.

## 3) Progressive Disclosure Behavior

- Drilldown is collapsed by default (`showDrilldown = false`).
- `CoachFeed` contains a “Show full drilldown / Hide drilldown” toggle.
- A second toggle is available in the drilldown section header.
- When collapsed, users see lightweight explanatory context (no heavy chart/history rendering).
- When expanded, all existing deep analytics render unchanged:
  - `ProgressCharts`
  - `SessionHistoryList` (with existing pagination/import/delete behavior)

## 4) Filter Coherence

- Single source of truth remains in `useProgressMetrics` filter state.
- `buildFilterScopeSummary` builds user-visible scope labels from those exact filters.
- Coach feed, summaries, and drilldown all consume the same filtered data objects.
- Drilldown header explicitly states that active filters are applied.

## 5) QA Checklist (Data Correctness + UX Regression)

### Data correctness
- Top 3 insights always render exactly 3 cards.
- Overreaching scenarios prioritize load-risk insight above lower-priority items.
- No-data filter scope yields explicit no-data insight.
- Filter scope label reflects date, muscle, and exercise filters accurately.
- Summary metrics match drilldown values under the same filters.

### UX/behavior
- Progress page still supports sticky filters and reset behavior.
- Drilldown toggle does not reset filters or loaded session state.
- Session history pagination/import/delete still works when drilldown is expanded.
- ACR card visibility still respects `useAcrVisibility`.
- Mobile layout still works with collapsed/expanded drilldown.

## Risks And Fallback

### Risks
- Insight rules may need threshold tuning per cohort.
- Users might miss drilldown if they never expand it.

### Fallback
- Drilldown is one click from both top feed and drilldown header.
- If insight quality is noisy, disable category rules incrementally while keeping summary+drilldown intact.
