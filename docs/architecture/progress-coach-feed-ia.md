# Progress IA Refactor: Coach Feed -> Summary -> Drilldown

## 1) IA Blueprint And Component Hierarchy

### IA zones (top to bottom)
1. `ProgressFilters` (sticky controls that scope all analytics)
2. `CoachFeed` (forward action panel, rolling 14-day horizon)
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
- Reduce cognitive load: users land on 1-2 forward actions instead of all charts.
- Increase actionability: each insight includes what changed, why it matters now, and a concrete next step.
- Preserve expert depth: full chart and history drilldown remains available below.

## 2) Insight Generation Rules (Forward Actions)

Insights are generated from a dedicated rolling action horizon (`Last 14 days`).
Date filters remain analytics-only for summary cards, charts, and history.
Rules produce categorized candidates with numeric priority; highest priority per category survives; top 2 render.

### Primary rule categories
- `load-risk`: overreaching or undertraining from ACR status/ratio.
- `recovery-mismatch`: mismatch between readiness and effort (e.g., low readiness + high effort).
- `consistency-gap`: low sessions/week cadence.
- `session-gap`: long gap since last session.

### Tie-break and fallback states
- Highest priority wins within each category.
- Sorted descending by priority and clipped to 2.
- If no candidate exists:
  - `insufficient-data` for empty horizon.
  - `stable-on-track` when no urgent correction is needed.

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
- `buildActionScopeSummary` builds action panel labels from horizon + muscle + exercise focus.
- Coach actions use rolling-horizon data; analytics summaries/charts/history use active date filters.
- Drilldown header explicitly states that active filters are applied.

## 5) QA Checklist (Data Correctness + UX Regression)

### Data correctness
- Coach actions render 1-2 cards (or one explicit state card).
- Overreaching scenarios prioritize load-risk insight above lower-priority items.
- Empty action horizon yields explicit insufficient-data insight.
- Filter scope label reflects date, muscle, and exercise filters accurately.
- Action scope label reflects horizon, muscle, and exercise focus.

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
