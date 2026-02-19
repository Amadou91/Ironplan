# Ironplan Codex

> **The Rules** for writing code in this repository. Violations will be rejected.

## Code Style

| Style | Rule |
|-------|------|
| **Imports** | ALWAYS Absolute (`@/...`) |
| **Exports** | ALWAYS Named (`export function X`) |
| **Types** | ALWAYS Type Keyword (`import type { X }`) |
| **Components** | `PascalCase.tsx` |
| **Hooks** | `useCamelCase.ts` |
| **Libraries** | `kebab-case.ts` |

## File Limits

- **Components:** 250 LOC (Extract sub-components)
- **Hooks:** 200 LOC (Extract helper hooks)
- **Lib:** 300 LOC (Split into modules)
- **Types:** 200 LOC (Split by domain)

## Forbidden Patterns

- ❌ `export default` (breaks import consistency)
- ❌ Relative imports (`../../`)
- ❌ Magic numbers (Use `src/constants/training.ts`)
- ❌ Giant files (Split them up)
- ❌ Mixed concerns (Separate UI, Logic, Data)
- ❌ Inline styles (Use Tailwind CSS classes)

## TypeScript

- **Strict Mode:** ON
- **No `any`:** Avoid `any` at all costs.
- **Barrel Files:** Import from `@/types/domain` whenever possible.

## Data Fetching

**Supabase Pattern:**

```typescript
// Client-side
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
const { data, error } = await supabase.from('table').select()

// Server-side (App Router pages)
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
```

## Testing

- **Run:** `npm test`
- **Type Check:** `npx tsc --noEmit`
- **Correctness:** `tests/correctness/*.ts` (Critical math tests)
