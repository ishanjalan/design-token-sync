# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Tokensmith** — A SvelteKit 2 web app that accepts Figma design token JSON exports and generates platform-specific code for Web (SCSS/TS/CSS), iOS (Swift), and Android (Kotlin).

**Two generation modes:**
- `matched` — convention detection from uploaded reference files; output mirrors team's existing code exactly
- `best-practices` — ignores reference files; generates opinionated modern output

**Core principle:** "What's inputted → should be outputted." If reference files don't contain a token type, don't generate it. If they do, regenerate it. If no reference files, generate everything the token data contains.

## Commands

```bash
npm run dev           # start dev server
npm run build         # production build
npm run check         # svelte-kit sync + svelte-check type checking
npm run lint          # ESLint
npm run format        # Prettier

npm run test          # all unit tests (vitest)
npm run test:watch    # interactive vitest
npx vitest run src/lib/transformers/diagnostic.test.ts   # fidelity test suite (run after transformer changes)
npx vitest run src/lib/transformers/shadow.test.ts       # single test file

npm run test:e2e      # Playwright E2E (requires built app: npm run build first)
npx tsc --noEmit      # type check without building
```

## Architecture

### Data flow

```
FormData upload (lightColors.json, darkColors.json, values.json, optional reference files)
  → POST /api/generate
  → classify reference files → detectConventions()
  → matched pass: run transformers with detected conventions
  → best-practices pass (when refs exist): run again with opinionated defaults
  → token-type transforms (shadow/border/radius/opacity/gradient/motion) — gated by refHas()
  → typography transforms
  → append removed-token comments to matched files
  → return { files[], stats, warnings[] }
```

### Key files

| File | Role |
|------|------|
| `src/routes/api/generate/+server.ts` | Main orchestrator — runs all transformers, validates via Zod, returns results |
| `src/lib/transformers/*.ts` | Per-platform, per-token-type generators |
| `src/lib/types.ts` | All shared types: `TransformResult`, `DetectedConventions`, `GenerateWarning`, `Platform`, etc. |
| `src/lib/transformers/naming.ts` | Convention detection: `detectConventions()`, `detectSwiftConventions()`, `detectKotlinConventions()` |
| `src/lib/transformers/shared.ts` | Shared utilities: `pathToKebab/Camel/Pascal()`, `fileHeaderLines()`, `detectRenamesInReference()`, `createNewDetector()` |
| `src/lib/resolve-tokens.ts` | Token graph, cycle detection, `walkAllTokens()`, `collectUnknownTokenTypes()` |
| `src/lib/token-adapters.ts` | W3C DTCG / Tokens Studio → Figma DTCG normalization |
| `src/lib/search-utils.ts` | `searchDiffLines()` (in-panel diff search), `buildSearchHighlight()` |
| `src/lib/diff-utils.ts` | Diff computation for the editor panel |
| `src/lib/stores/*.svelte.ts` | Svelte 5 class-based reactive stores (singletons) |
| `src/lib/components/EditorPane.svelte` | Main editor panel — 1,653 lines, refactor candidate (see IMPROVEMENTS.md) |

### Transformer pattern

Every transformer in `src/lib/transformers/` follows the same shape:

```typescript
// Inputs: parsed token data + platforms array + optional reference/conventions
export function transformToShadows(
  tokenExport: Record<string, unknown>,
  platforms: Platform[]
): TransformResult[] { ... }

// Also exports a count function for stats
export function countShadowTokens(tokenExport: Record<string, unknown>): number { ... }
```

Transformers self-gate — if token data has zero of that type, they return `[]`. No need to check counts before calling.

Token-type transformers (`shadow.ts`, `border.ts`, `radius.ts`, `opacity.ts`, `gradient.ts`, `motion.ts`) take `values` as input. Color transformers take `lightColors`/`darkColors`. Typography takes `typography`.

### Token-type gating (`refHas` pattern)

In `+server.ts`, the six token-type transforms (shadow/border/radius/opacity/gradient/motion) are gated by whether any uploaded reference file contains patterns for that type:

```typescript
const allRefContent = [webScss, webTs, swiftColors, swiftTypo, kotlinColors, kotlinTypo]
  .filter(Boolean).join('\n');
const refHas = (pattern: RegExp): boolean => bestPractices || pattern.test(allRefContent);
if (refHas(/\$shadow-|--shadow-|\bShadowToken\b/)) results.push(...transformToShadows(...));
```

Key: `refHas` scans ALL platforms combined — if iOS reference has shadows, web also gets shadow output. In best-practices mode, `refHas` always returns `true`.

### Swift three-tier architecture

`swift.ts` generates three enums that form a chain:
1. **Primitive** (`primitiveColorCode`): raw hex strings, `fileprivate` access
2. **Semantic** (`ColorCodes`): references primitive members with Light/Dark variants
3. **UIColor API** (`ColorStyle`): public UIColor properties, uses `|` operator for dynamic colors

**Tier detection** (brace-counting content analysis):
- Primitive: body has `= "#..."` but NOT `*Light =` / `*Dark =` patterns
- Semantic: body has both `*Light =` AND `*Dark =`
- UIColor: body has `: UIColor` or `UIColor =`
- Priority: UIColor > hasLightDark > hasHex (critical — semantic enum has both hex AND Light/Dark)

**Alpha handling**: Alpha is stripped from primitive and semantic tiers (flat hex only). The UIColor tier applies `.withAlphaComponent(<alpha>)` when token alpha < 1.0, on both light and dark variants independently.

### Kotlin multi-file architecture

`kotlin.ts` generates per-category files matching `class R{Category}Colors` pattern. Category gaps (token data has a category but no matching reference file) are detected via `detectKotlinCategoryGaps()` and:
1. A `missing-category` warning is emitted
2. Missing categories are generated with best-practices conventions as fallback

### Typography font weights

`normalizeFontWeight()` in `typography.ts` resolves font weights in priority order:
1. Numeric value (passthrough)
2. String parseable as number (`"400"`)
3. `WEIGHT_NAME_MAP` lookup (thin/100 through black/900)
4. Fallback: 400 (emits `lint` warning)

### Svelte stores

All stores are class-based singletons using Svelte 5 runes:

```typescript
class FileStore {
  files = $state<...>({});
  derived = $derived(this.files...);
}
export const fileStore = new FileStore();
```

Never use Svelte 4 stores (`writable`, `readable`, etc.) — runes only.

### API patterns

All POST endpoints use `FormData` (not JSON body). Zod validates everything. File size limit is 10 MB per file. The `optionalFileText()` and `multiFileEntries()` helpers handle file extraction from FormData.

### Reference file classification

When reference files are uploaded, the server classifies them:
- `classifyWebColorFiles()` — splits into primitives/colors × scss/ts
- `classifyKotlinRefFiles()` — detects multi-file architecture, extracts semantic categories
- `classifyKotlinTypographyRefFiles()` — splits definition vs accessor files
- `classifyWebTypographyFiles()` — splits by extension

`bestPractices = true` when no reference files are uploaded at all.

### GitHub PR branch naming

`createBranch()` in `src/routes/api/github/pr/+server.ts` returns the actual branch name used. On HTTP 422 (branch exists), retries once with a 4-char random suffix. The returned `actualBranch` is used in all subsequent API calls. If retry also fails, surfaces an actionable error message.

### Figma webhook persistence

`src/routes/api/figma/webhook/+server.ts` persists the latest webhook event to `.webhook-state.json` at project root (should be gitignored). In-memory cache is kept for fast access; disk write is non-fatal.

### EditorPane diff search

`src/lib/components/EditorPane.svelte` contains in-panel search for the diff view:
- `diffMatchIdx: $state(0)` — current match cursor
- `activeDiffMatchIndices: $derived(...)` — line indices of search matches
- Enter/Shift+Enter navigate, Escape clears
- Diff lines get `diff-line--search-match` (amber outline) and `diff-line--search-current` (amber bg)
- Guard: diff search uses `{#if searchQuery && sr && !(mode === 'diff' && hasDiff)}` — when in diff mode with a diff, the diff view renders with inline highlights instead of being replaced by the raw `<pre>` search view

## Testing

Diagnostic (fidelity) tests live in `src/lib/transformers/diagnostic.test.ts` and use real production files from `Reference files/`. **Always run these after changing any transformer.** All 6 tests must pass.

Unit tests are co-located with source: `shadow.ts` → `shadow.test.ts`. Test fixtures are in `src/lib/transformers/fixtures.ts`.

E2E tests are in `e2e/` and use fixtures from `e2e/fixtures/`. They require a production build (`npm run build`) before running.

## Important conventions

- **ESM imports** in test files require `.js` extensions: `from './shadow.js'`
- **`{#each}` blocks** must always have `:key` attributes
- **`SvelteSet`/`SvelteMap`** from `svelte/reactivity` instead of native `Set`/`Map` in components
- **`$effect` dependency tracking**: prefix reactive reads with `void` to declare intent
- **Transformer outputs** tag `mode` via `tagMode()` helper in the server — transformers themselves don't set mode
- **Convention detection** returns best-practice defaults when `bestPractices=true`; never pass `undefined` conventions to a transformer — always call `detectConventions()` first
- **Typography overloads**: `transformToTypography` supports `{ collectWarnings: true }` option returning `TransformToTypographyResult` with `{ files, warnings }`
- **Unknown token types**: `collectUnknownTokenTypes(values)` returns a `Map<string, number>` of unseen `$type` values and their counts

## Known pitfalls

- **EditorPane.svelte tab/space mismatch**: The file uses tabs but the Read tool output displays spaces. The Edit tool's `old_string` matching fails silently. Use Python subprocess heredoc for replacements in this file:
  ```bash
  python3 << 'PYEOF'
  with open('path', 'r') as f: content = f.read()
  content = content.replace(old_with_tabs, new_with_tabs)
  with open('path', 'w') as f: f.write(content)
  PYEOF
  ```
- **Swift enum classification priority**: The semantic (ColorCodes) enum contains BOTH hex strings AND Light/Dark patterns. Always check `hasLightDark` before `hasHex` — otherwise semantic enums are misclassified as primitive, breaking all iOS output.
- **Token-type transforms not in best-practices pass**: Don't add shadow/border/radius/opacity/gradient/motion to the best-practices regeneration pass — they produce identical output regardless of mode, creating duplicates in the UI.
- **`tagMode()` usage**: Always use `tagMode(results, mode)` — never set `mode` directly on `TransformResult` objects outside the server.
