# Ironplan UI System & PWA Standards

> **Design Philosophy:** "Gym-First"
>
> 1.  **Legibility:** Metrics must be readable from 6 feet away (phone on floor).
> 2.  **Touch Accuracy:** Fat fingers + shaking hands = minimum 44px (preferably 48px) touch targets.
> 3.  **Performance:** True Black for OLED battery saving; reduced motion; no heavy blurs on mobile.
> 4.  **Focus:** Visual hierarchy highlights *what to do next*, not *what you did*.

## 1. Color System (OKLCH)

We use the OKLCH color space for perceptually uniform colors.

| Token | Light Mode | Dark Mode (True Black) | Usage |
|-------|------------|------------------------|-------|
| `--color-bg` | White/Light Gray | `oklch(14% ...)` | App background |
| `--color-surface` | Pure White | `oklch(18% ...)` | Cards, Modals |
| `--color-primary` | Vibrant Orange | Vibrant Orange (Lighter) | Key Actions, Brand |
| `--color-text` | Deep Gray | Near White | Body Copy |
| `--color-success` | Green | Green | Completion, Good Status |

**Why True Black?**
-   Saves battery on OLED screens during long workouts.
-   Reduces glare in dim gym environments.
-   Increases perceived contrast of active elements.

## 2. Typography Scale

**Fonts:**
-   **Display:** `Space Grotesk` (Headings, Key Metrics)
-   **Body:** `Source Sans 3` (UI Text, Instructions)
-   **Mono:** `JetBrains Mono` (Data Entry, Timers, Rep Counts)

**Sizes:**
-   **Base:** 18px (Improved readability for body copy)
-   **Small (sm):** 16px (Secondary text, Inputs - prevents iOS zoom)
-   **Tiny (xs):** 14px (Minimum readable size for badges/metadata - no text smaller than this)
-   **Metrics:** Huge (32px+) for "glanceability"

## 3. Spacing & Layout

-   **Grid:** 4px baseline.
-   **Touch Targets:** Minimum 48x48px for primary actions (Add Set, Finish).
-   **Margins:** Tighter mobile margins (16px), wider desktop margins.
-   **Cards:** `surface-card` class provides consistent rounded corners (lg/xl) and borders.

## 4. Component Standards

### Cards (`surface-card`)
```jsx
<div className="surface-card p-4 md:p-6">
  <h3 className="font-display text-xl">Title</h3>
  {/* Content */}
</div>
```

### Buttons (`btn-primary`, `btn-secondary`)
-   **Height:** Fixed `h-12` or `min-h-[48px]`.
-   **Width:** Full width on mobile contexts.
-   **Active State:** `active:scale-95` for tactile feedback.

### Inputs (`input-base`)
-   **Font:** Mono for numbers.
-   **Size:** Large (`text-lg`), centered alignment for data entry.
-   **Focus:** Thick primary ring.

## 5. PWA Optimizations

-   **Overscroll:** Disabled (`overscroll-behavior-y: none`) to prevent pull-to-refresh interfering with gestures.
-   **Safe Areas:** `env(safe-area-inset-...)` applied globally.
-   **Touch Highlight:** Removed standard tap highlight color.
-   **Selection:** Disabled on non-interactive elements to prevent accidental text selection during workouts.
