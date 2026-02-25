# Tokensmith — Improvement Backlog

Generated 2026-02-25. Updated 2026-02-26 after implementation session.

---

## Codebase Overview

**What it is:** A SvelteKit web app that accepts Figma design token JSON exports (light/dark colors,
typography, values) plus optional reference code files from the developer's existing codebase,
detects the team's coding conventions, and generates platform-specific code:

| Platform | Outputs |
|----------|---------|
| Web | `Primitives.scss`, `Colors.scss`, `Primitives.ts`, `Colors.ts`, `Colors.css`, `Spacing.ts/.scss` |
| iOS | `Colors.swift`, `Typography.swift` |
| Android | `Color.kt`, per-category `R*Colors.kt` files, `RTypography.kt`, `RLocalTypography.kt` |

**Key principle: "What's inputted → should be outputted."**
If reference files don't contain a token type (e.g. no shadow variables), don't generate shadows.
If they DO contain it, regenerate it. If no reference files at all (best-practices mode),
generate everything the token data contains.

**Two generation modes:**
- `matched` — detects conventions from uploaded reference files, reproduces structure exactly
- `best-practices` — ignores reference, generates opinionated clean output

**Key files:**
- `src/routes/api/generate/+server.ts` — main POST endpoint, orchestrates all transforms
- `src/lib/transformers/` — all per-platform, per-token-type generators
- `src/lib/types.ts` — full type model including `DetectedConventions`, `GenerateWarning`, etc.
- `src/lib/transformers/diagnostic.test.ts` — fidelity test suite (run manually, not in CI)
  - Run: `npx vitest run src/lib/transformers/diagnostic.test.ts`
  - All 6 tests pass after all changes below
- `Reference files/` — real production token JSON + reference code files used by diagnostic tests

---

## Recently Completed Work (commit `335f42f` + session 2026-02-26)

### Baseline (commit `335f42f`)

Six fidelity fixes were implemented and all 6 diagnostic tests now pass:

- **P1 (Kotlin):** Enum values now use `camelToScreamingSnake()` → `FILL_COMPONENT_PRIMARY`
- **P2 (Kotlin):** `val LocalFillColor` → `var LocalFillColor`; MaterialTheme extension gets explicit type annotation
- **P4 (Swift):** Alpha stripped from primitive AND semantic `flatLightDark` hex strings
- **P5 (Typography SCSS):** `commonMixinPrefix()` correctly finds shared prefix across all mixin names
- **P6 (Kotlin):** `detectKotlinCategoryGaps()` + `missing-category` warning type
- **Diagnostic test:** `src/lib/transformers/diagnostic.test.ts` created with 6 structural assertions

### Session 2026-02-26 — Items 1–4, 7–12 all implemented

See per-item notes below.

---

## Pending Items (not yet implemented)

*All items now implemented. See Completed Items below.*

---

## Completed Items (most recent first)

### ✅ 5 — Convention detection has no confidence score

**Implemented:** Added `confidence?: number` (0–1) to `DetectedConventions` in `types.ts`.
In `naming.ts`, refactored the three majority-vote detectors (`detectScssSeparator`,
`detectTsNamingCase`, `detectTsHexCasing`) to return `{ value, confidence }`. Overall confidence
is the minimum across dimensions that have actual data (total votes > 0). Dimensions with no
data default to confidence 1.0 (no evidence of conflict).

In `+server.ts`, after `detectConventions()`, emits a `lint` warning when
`confidence < 0.7` in matched mode:
```
"Convention detection confidence is 62% — your reference file may have mixed
conventions. Check naming case, separator style, and hex casing for consistency."
```

**Files changed:** `src/lib/types.ts`, `src/lib/transformers/naming.ts`,
`src/routes/api/generate/+server.ts`

---

### ✅ 6 — Multi-file reference classification is fragile

**Implemented:** Two sub-fixes:

1. **Dynamic prefix detection:** Added `extractKotlinColorClassInfo(text)` to `shared.ts`.
   Matches all `class \w+Colors` declarations, finds the common prefix across base names
   (e.g. "R" from RFillColors/RBorderColors; "App" from AppFillColors/AppBorderColors),
   then strips the prefix to produce lowercase category names. Used by both `kotlin.ts`
   `detectKotlinConventions` and `+server.ts` `classifyKotlinRefFiles`.

2. **Classification failure warning:** When uploaded `.kt` files contain `Color(` patterns
   (indicating Kotlin color content) but no color class pattern was detected, emits a
   `missing-category` warning explaining the expected `class <Prefix><Category>Colors` pattern.

Also broadened the `usesEnum` pattern in `kotlin.ts` from `/\benum\s+class\s+R\w+Color\b/` to
`/\benum\s+class\s+\w+Color\b/` — no longer hardcoded to the `R` prefix.

**Files changed:** `src/lib/transformers/shared.ts`, `src/lib/transformers/kotlin.ts`,
`src/routes/api/generate/+server.ts`

---

### Previously Completed Items (session 2026-02-26 — Items 1–4, 7–12)

---

### ✅ 1 — Token-type transforms never called from server

**Implemented:** Inserted `if (wantColors)` block in `+server.ts` after Android block, before
typography block. Uses `refHas()` to gate each token type by whether any reference file
across any platform contains patterns for that type.

**Key design decisions preserved:**
- `refHas` scans ALL reference files across ALL platforms combined — if any platform has shadows, generate shadows for all
- Not added to best-practices pass — would create duplicate files with identical content
- In best-practices mode, `matchedMode = 'best-practices'` so files are already tagged correctly
- All transformers self-gate; if token data has zero of a type, `transform*` returns `[]`

**Patterns used per type:**
- Shadow: `/\$shadow-|--shadow-|\bShadowToken\b|\bShadowSpec\b/`
- Border: `/\$border-|--border-|\bBorderToken\b|\bobject\s+Borders\b/`
- Radius: `/\$radius-|--radius-|\bCornerRadius\b/`
- Opacity: `/\$opacity-|--opacity-|\benum\s+Opacity\b|\bobject\s+Opacity\b/`
- Gradient: `/\$gradient-|\bGradientTokens\b/`
- Motion: `/\$duration-|\$easing-|\bMotionTokens\b/`

**Files changed:** `src/routes/api/generate/+server.ts`

---

### ✅ 2 — iOS alpha variants dropped at the API tier

**Implemented:** `ColorStyle` UIColor tier now emits `.withAlphaComponent(<alpha>)` when token
alpha < 1.0. Handles both static (single) and dynamic (light/dark) variants separately.

**Implementation:** In `swift.ts`, within the UIColor tier generation block:
```swift
// Static: color(ColorCodes.primary).withAlphaComponent(0.08)
// Dynamic: (color(ColorCodes.primaryLight) | color(ColorCodes.primaryDark)).withAlphaComponent(0.08)
```
Alpha is rounded to 2 decimal places via `roundAlpha()` helper. Light and dark alpha handled independently for dynamic tokens.

**Files changed:** `src/lib/transformers/swift.ts`

---

### ✅ 3 — Swift tier detection breaks on enum ordering

**Implemented:** Replaced positional detection with brace-counting content analysis. Each enum's
body is extracted by tracking `{`/`}` depth, then classified by content:

- **Primitive:** body contains `= "#...` (hex strings) but NOT Light/Dark suffixes
- **Semantic (ColorCodes):** body contains both `*Light =` AND `*Dark =` patterns
- **UIColor API (ColorStyle):** body contains `: UIColor` or `UIColor =`

**Priority order (critical — don't change):** UIColor > hasLightDark > hasHex.
The semantic enum has both hex strings AND Light/Dark suffixes; checking hex first causes
misclassification. UIColor must be checked first since it can also contain color references.

**Bug that was fixed during implementation:** Initial version checked hex first — the ColorCodes
enum has both hex AND Light/Dark patterns, causing 2 tests to fail. Fixed by inverting priority.

**Files changed:** `src/lib/transformers/swift.ts`

---

### ✅ 4 — Kotlin: new token category has no fallback generation

**Implemented:** When `detectKotlinCategoryGaps()` finds missing categories in `+server.ts`
Android block, those categories are now generated with best-practices conventions alongside
the warning, rather than being silently skipped.

**Implementation:**
```typescript
if (gaps.length > 0) {
  const gapScope = { generatePrimitives: false, generateSemantics: true, semanticCategories: gaps };
  results.push(...tagMode(
    transformToKotlin(lightColors, darkColors, undefined, true, gapScope),
    'best-practices'
  ));
}
```
The gap categories are generated with `bestPractices=true` and the existing `missing-category`
warning is still emitted so the user knows these files used opinionated defaults.

**Files changed:** `src/routes/api/generate/+server.ts`

---

### ✅ 7 — Typography font weight uses string lookup instead of numeric value

**Implemented:** Added `normalizeFontWeight()` function in `typography.ts` that:
1. Uses numeric value directly if present
2. Parses string-as-number (`"400"` → `400`)
3. Falls back to `WEIGHT_NAME_MAP` lookup for named weights
4. Returns `[400, true]` (value + `usedFallback` flag) as last resort

**WEIGHT_NAME_MAP covers:** thin/hairline (100), extralight/ultralight (200), light (300),
regular/normal/book (400), medium (500), semibold/demibold (600), bold (700),
extrabold/ultrabold (800), black/heavy (900).

**Warning emission:** Added `TransformToTypographyResult` interface with `{ files, warnings }`.
Overloaded `transformToTypography` and `parseEntries` to support `collectWarnings: true`
parameter. Server uses this to emit `lint` warnings when weight fallbacks are triggered.

**Files changed:** `src/lib/transformers/typography.ts`, `src/routes/api/generate/+server.ts`

---

### ✅ 8 — GitHub branch creation doesn't handle conflicts

**Implemented:** `createBranch()` in the GitHub PR server now returns `string` (the actual
branch name used, which may differ from requested). On HTTP 422 from branch creation, retries
once with a 4-char random alphanumeric suffix (`branch-name-a3f7`). If the retry also fails,
surfaces actionable error: "Branch already exists. Merge or delete the open PR before syncing again."

**`actualBranch` variable** is threaded through all subsequent calls (PR creation, file commits)
instead of the original `branchName`, ensuring consistency when suffix was added.

**Files changed:** `src/routes/api/github/pr/+server.ts`

---

### ✅ 9 — Unknown token types silently skipped with no warning

**Implemented:** Added `collectUnknownTokenTypes()` in `resolve-tokens.ts` and `KNOWN_TOKEN_TYPES`
set covering all standard W3C DTCG and Tokens Studio types. `walkAllTokens` accepts an optional
`unknownTypes?: Map<string, number>` parameter that accumulates unseen `$type` values.

**Known types set:**
```
color, number, shadow, border, typography, gradient, transition, cubic-bezier,
duration, dimension, fontFamily, fontWeight, fontSize, lineHeight, letterSpacing,
string, boolean, other
```

Server calls `collectUnknownTokenTypes(values)` and emits `lint` warnings:
`"3 tokens with unknown type 'spacing-alias' were skipped."`

**Files changed:** `src/lib/resolve-tokens.ts`, `src/routes/api/generate/+server.ts`

---

### ✅ 10 — Diff view has no in-file search

**Implemented:** Added keyboard-navigable in-panel search for the diff view in `EditorPane.svelte`.

**New function:** `searchDiffLines()` in `src/lib/search-utils.ts` — takes `{ text: string }[]`
array and query string, returns array of matching line indices.

**State added to EditorPane:**
```typescript
let diffMatchIdx = $state(0);                    // current match cursor
const activeDiffMatchIndices = $derived(...);    // indices of matching diff lines
$effect(() => { ... diffMatchIdx = 0; });        // reset on query/tab change
$effect(() => { ... el.scrollIntoView(...); });  // scroll to current match
```

**UX:**
- `Enter` / `Shift+Enter` navigate forward/backward through matches
- `Escape` clears the search
- Counter shows "X / Y" in diff mode (match position / total)
- Matching lines get `.diff-line--search-match` (amber outline)
- Current match gets `.diff-line--search-current` (amber background, `!important`)
- Diff view renders normally with highlights — guarded separately from the raw `<pre>` search path

**Critical guard:** Changed `{#if searchQuery && sr}` to `{#if searchQuery && sr && !(mode === 'diff' && hasDiff)}`
so diff view shows with highlights instead of being replaced by the `<pre>` search result display.

**Files changed:** `src/lib/search-utils.ts`, `src/lib/components/EditorPane.svelte`

---

### ✅ 11 — Multi-theme support exists in types but not consumed

**Implemented:** Extended additional themes loop in `+server.ts` to call all six token-type
transforms for each additional theme (same logic as primary theme but scoped to theme's `values`).
The loop already existed for SCSS/TS/CSS; shadow/border/radius/opacity/gradient/motion are now
included.

**Files changed:** `src/routes/api/generate/+server.ts`

---

### ✅ 12 — Figma webhook state is ephemeral

**Implemented:** `.webhook-state.json` file persistence in the webhook server. On process restart
or cold start, the last event is rehydrated from disk.

**Design:** `saveToDisk()` is non-fatal (wrapped in try/catch) — in-memory cache still serves
requests if filesystem write fails. `loadFromDisk()` is called lazily on first GET request
(lazy-loaded flag `loaded` prevents redundant disk reads).

**State path:** `join(process.cwd(), '.webhook-state.json')` — project root, should be gitignored.

**Files changed:** `src/routes/api/figma/webhook/+server.ts`

---

## EditorPane.svelte Refactor Plan

**File:** `src/lib/components/EditorPane.svelte`
**Current state:** ~1,653 lines (177 script / 436 template / 1,037 CSS)
**Complexity:** 77 props (26 data, 18 UI state, 28 callbacks, 5 helpers), 27 `{@const}` blocks in template

**Verdict: Moderate-High — approaching critical threshold.** Not unmaintainable today, but each
additional feature will be disproportionately harder to implement and test.

---

### Phase 1 — Extract `<CodeViewer>` (highest impact, ~240 lines)

**Lines:** ~353–590 in current file

**What to extract:**
- View mode toolbar (diff / code / changes buttons)
- Diff renderer (line-by-line with search highlights, `.diff-line--search-match/current`)
- Code renderer (Shiki-highlighted `<pre>` block)
- Change summary / breadcrumb bar
- Search match logic (`activeDiffMatchIndices`, `diffMatchIdx`, scroll effect)

**Props it will need:**
```typescript
// Data
content: string
diffLines: DiffLine[] | null
viewMode: 'diff' | 'code' | 'changes'
fileName: string
searchQuery: string
searchResult: SearchResult | null

// Callbacks
onViewModeChange: (mode: ViewMode) => void
```

**Safe to move:** All diff CSS (`diff-line`, `.added`, `.removed`, `.search-mark`, etc.)
**Risky:** The `$effect` scroll-to-match logic has DOM dependencies — test carefully.

---

### Phase 2 — Extract `<FileTabsBar>` (~110 lines)

**Lines:** ~191–299 in current file

**What to extract:**
- File tab buttons (active/inactive state, close button)
- Mode toggle (matched / best-practices)
- Theme picker dropdown
- Action buttons (copy, download, GitHub PR)

**Props it will need:**
```typescript
tabs: FileTab[]
activeTab: string | null
mode: 'matched' | 'best-practices'
selectedTheme: string
themes: string[]
onTabSelect: (id: string) => void
onTabClose: (id: string) => void
onModeChange: (mode: Mode) => void
onThemeChange: (theme: string) => void
onCopy: () => void
onDownload: () => void
onPRCreate: () => void
```

---

### Phase 3 — Move `{@const}` blocks to `$derived` (script-level)

**27 `{@const}` blocks** clutter the template with derived logic. Move all to script section as
`const foo = $derived(...)`. This is a mechanical refactor with no behavior change, but reduces
template nesting depth significantly.

**Pattern:**
```svelte
<!-- Before (in template) -->
{@const isActive = tab.id === activeTab}
{@const hasChanges = diffCounts[tab.id] > 0}

<!-- After (in script) -->
const isActive = $derived(activeTab !== null && tab.id === activeTab);
```

Note: `{@const}` inside `{#each}` blocks cannot trivially move to script level — those need
to become computed properties on the iterated item or use a helper function.

---

### Phase 4 — Extract notification banners (safe, low-risk)

Notification banners (warnings, quality alerts, success messages) are self-contained markup
with no cross-cutting logic. Extract as `<NotificationBanner type="warning|info|success">`.

---

### Refactor priorities

| Phase | Impact | Risk | Effort |
|-------|--------|------|--------|
| 1 — CodeViewer | High | Medium | ~3h |
| 2 — FileTabsBar | Medium | Low | ~1.5h |
| 3 — `{@const}` → `$derived` | Medium | Low | ~1h |
| 4 — Banners | Low | Very low | ~30m |

**Do Phase 1 first** — it removes the most complexity and contains the diff search logic added
in item #10, which is the most likely area for future changes.

**Known pitfall:** EditorPane.svelte uses tabs (not spaces). The Edit tool misreads indentation
from the Read tool output (which shows spaces). Use Python heredoc replacements when editing:
```bash
python3 << 'PYEOF'
import re
with open('path', 'r') as f: content = f.read()
content = content.replace(old, new)
with open('path', 'w') as f: f.write(content)
PYEOF
```

---

## Architecture Quick Reference

```
src/
├── routes/
│   ├── +page.svelte              # Main UI orchestrator
│   └── api/
│       ├── generate/+server.ts   # ← Main transform orchestrator (most changes go here)
│       ├── github/pr/+server.ts  # PR creation
│       └── figma/webhook/        # Figma webhook listener
├── lib/
│   ├── types.ts                  # All shared types, Zod schemas, convention interfaces
│   ├── search-utils.ts           # searchDiffLines(), buildSearchHighlight()
│   ├── transformers/
│   │   ├── scss.ts               # Web SCSS colors
│   │   ├── ts-web.ts             # Web TypeScript colors
│   │   ├── css.ts                # Web CSS custom properties
│   │   ├── spacing.ts            # Spacing tokens
│   │   ├── swift.ts              # iOS Swift colors (3-tier: primitive/semantic/UIColor)
│   │   ├── kotlin.ts             # Android Kotlin colors (multi-file by category)
│   │   ├── typography.ts         # Typography dispatcher (all platforms)
│   │   ├── typography-scss.ts    # Web SCSS typography
│   │   ├── typography-ts.ts      # Web TS typography
│   │   ├── typography-swift.ts   # iOS Swift typography
│   │   ├── typography-kotlin.ts  # Android Kotlin typography
│   │   ├── shadow.ts             # Shadow tokens (all platforms)
│   │   ├── border.ts             # Border tokens (all platforms)
│   │   ├── radius.ts             # Radius tokens (all platforms)
│   │   ├── opacity.ts            # Opacity tokens (all platforms)
│   │   ├── gradient.ts           # Gradient tokens (all platforms)
│   │   ├── motion.ts             # Motion tokens (all platforms)
│   │   ├── naming.ts             # Convention detection
│   │   ├── shared.ts             # Shared utilities
│   │   └── diagnostic.test.ts    # Fidelity test suite (run manually)
│   ├── components/
│   │   └── EditorPane.svelte     # Editor panel (1,653 lines — refactor candidate)
│   ├── resolve-tokens.ts         # Token graph, cycle detection, tree walking
│   └── token-adapters.ts         # W3C DTCG / Tokens Studio normalization
```

## Token Data Sources

| Token file | Contains | Used by |
|------------|----------|---------|
| `lightColors` | Color tokens (light mode) | SCSS, TS, CSS, Swift, Kotlin |
| `darkColors` | Color tokens (dark mode) | SCSS, TS, CSS, Swift, Kotlin |
| `values` | Spacing + shadow + border + radius + opacity + gradient + motion | Spacing and all 6 token-type transforms |
| `typography` | Font family/weight/size/lineHeight/letterSpacing | Typography transformers |

## Current Git State

- Branch: `main`
- All items 1–4, 7–12 implemented (not yet committed)
- Working tree dirty: `src/routes/api/generate/+server.ts`, `src/lib/transformers/swift.ts`,
  `src/lib/transformers/typography.ts`, `src/lib/resolve-tokens.ts`,
  `src/routes/api/github/pr/+server.ts`, `src/routes/api/figma/webhook/+server.ts`,
  `src/lib/search-utils.ts`, `src/lib/components/EditorPane.svelte`
- Items 5 and 6 remain unimplemented
- EditorPane refactor not yet started
