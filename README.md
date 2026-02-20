# Design Token Sync

**Figma Variables → SCSS · TypeScript · Swift · Kotlin**

Design Token Sync converts Figma's exported design token JSON into production-ready code for Web, iOS, and Android — eliminating manual copy-paste and preventing design–development drift.

**Live:** [design-token-sync.vercel.app](https://design-token-sync.vercel.app)

---

## What it generates

| Output                  | Web | iOS | Android |
| ----------------------- | --- | --- | ------- |
| `Primitives.scss`       | ✓   | —   | —       |
| `Colors.scss`           | ✓   | —   | —       |
| `Spacing.scss`          | ✓   | —   | —       |
| `Primitives.ts`         | ✓   | —   | —       |
| `Colors.ts`             | ✓   | —   | —       |
| `Spacing.ts`            | ✓   | —   | —       |
| `Typography.scss / .ts` | ✓   | —   | —       |
| `Colors.swift`          | —   | ✓   | —       |
| `Typography.swift`      | —   | ✓   | —       |
| `Colors.kt`             | —   | —   | ✓       |
| `Typography.kt`         | —   | —   | ✓       |

---

## Getting started

### Prerequisites

- Node.js >= 20
- Figma project with Variables and/or Styles

### Install and run

```sh
npm install
npm run dev       # http://localhost:5173
```

### Production build

```sh
npm run build
node build        # serves on PORT (default 3000)
```

### Docker

```sh
docker build -t token-sync .
docker run -p 3000:3000 token-sync
```

### Deploy to Vercel

The app uses `@sveltejs/adapter-vercel` and deploys automatically on push to `main`.

---

## How to use

### Step 1 — Export tokens from Figma

1. Open your Figma file
2. **Variables**: Copy as JSON or use the Variables panel export
   - Light mode → `Light.tokens.json`
   - Dark mode → `Dark.tokens.json`
   - Values (spacing, integers) → `Value.tokens.json`
3. **Typography** (optional): Export text styles → `typography.tokens.json`

### Step 2 — Upload reference files (optional)

To preserve your team's existing variable naming conventions, upload their current source files:

| Platform | Reference files                                                |
| -------- | -------------------------------------------------------------- |
| Web      | `Primitives.scss`, `Colors.scss`, `Primitives.ts`, `Colors.ts` |
| iOS      | `Colors.swift`                                                 |
| Android  | `Colors.kt`                                                    |

Token Sync detects naming patterns (camelCase, SCREAMING_SNAKE_CASE, separators, import style) dynamically at runtime — no hardcoded conventions.

### Step 3 — Generate

Select your target platforms (Web / iOS / Android), then click **Generate files**.

---

## Features

### Code viewer

- Shiki syntax highlighting with 6 themes (One Dark, Dracula, GitHub Dark, GitHub Dimmed, Catppuccin, Night Owl)
- Inline colour swatches next to every hex value
- Clickable line numbers with highlight (click to select, shift-click for a range)
- Sticky toolbar that stays visible while scrolling
- Line wrap toggle
- Section navigation — jump to comment headers (`// MARK:`, struct/object declarations)
- In-file search (`Cmd+F` / `Ctrl+F`)

### Diff engine

- Line-by-line diff view against reference files with word-level highlighting
- Old/new line numbers in the diff gutter
- Changes-only filtered view with context separators
- Diff navigation (previous/next change)

### Token analysis

- Deprecation detection — tokens removed between versions
- Modification tracking — tokens whose values changed
- Rename detection — tokens that moved (including family renames like `fuchsia` → `pink`)
- Token coverage — percentage of Figma tokens implemented per file
- Impact analysis — which semantic tokens are affected when a primitive changes
- Cross-platform consistency validation

### Integrations

- **GitHub PR** — creates a branch and opens a PR per platform with one click
- **Google Chat webhook** — posts a summary card to your team channel after each generation
- **Figma webhook** — receives `FILE_VERSION_UPDATE` events and triggers regeneration
- **ZIP download** — download all generated files in one archive
- **Shareable config** — export/import platform selections and reference files as JSON

### Other

- Platform filtering — toggle Web, iOS, Android independently
- Colour swatch panel — preview your full palette before generating
- Generation history — last 5 runs saved in localStorage, restorable with one click
- Health endpoint — `GET /api/health` returns `{ status, version, uptime }`
- 10 MB per-file upload limit with Zod schema validation

---

## Scripts

```sh
npm run dev           # Start dev server
npm run build         # Production build
npm run check         # svelte-check (TypeScript + Svelte diagnostics)
npm run test          # Run Vitest (146 tests)
npm run test:ui       # Vitest browser UI
npm run test:coverage # Coverage report
npm run lint          # ESLint
npm run format        # Prettier
npm run knip          # Dead code analysis
```

---

## Architecture

```
src/
├── lib/
│   ├── transformers/
│   │   ├── scss.ts           # Primitives.scss + Colors.scss
│   │   ├── ts-web.ts         # Primitives.ts + Colors.ts + Spacing.ts
│   │   ├── swift.ts          # Colors.swift (SwiftUI + UIColor dynamic provider)
│   │   ├── kotlin.ts         # Colors.kt (Compose + Material3 ColorScheme)
│   │   ├── typography.ts     # Typography.{scss,ts,swift,kt}
│   │   ├── spacing.ts        # Spacing tokens
│   │   ├── naming.ts         # Dynamic convention detection
│   │   └── fixtures.ts       # Shared test fixtures
│   ├── components/
│   │   ├── HistoryPanel.svelte
│   │   ├── PlatformConsistency.svelte
│   │   ├── PrResults.svelte
│   │   ├── SettingsPanel.svelte
│   │   └── SwatchPanel.svelte
│   ├── color-utils.ts        # Hex formatting via culori
│   ├── diff-utils.ts         # Diff computation, rename/deprecation detection
│   ├── file-validation.ts    # Zod-based upload validation
│   ├── search-utils.ts       # In-file search with highlighting
│   ├── swatch-utils.ts       # Swatch comparison logic
│   ├── storage.ts            # localStorage helpers
│   ├── token-analysis.ts     # Coverage, impact, cross-platform analysis
│   └── types.ts              # Shared TypeScript types + Zod schemas
└── routes/
    ├── +page.svelte          # Main UI
    ├── +layout.svelte        # Primer CSS + global styles
    ├── +error.svelte         # Error boundary
    └── api/
        ├── generate/         # POST — runs all transformers
        ├── notify/           # POST — Google Chat webhook proxy
        ├── github/pr/        # POST — GitHub branch + PR creation
        ├── figma/webhook/    # POST — Figma file version webhook
        └── health/           # GET  — health check
```

---

## Tech stack

| Layer      | Technology                                      |
| ---------- | ----------------------------------------------- |
| Framework  | SvelteKit (Svelte 5)                            |
| Language   | TypeScript                                      |
| Design     | Primer Primitives (`@primer/primitives`)        |
| Syntax     | Shiki                                           |
| Colour     | culori                                          |
| Testing    | Vitest (146 tests)                              |
| Linting    | ESLint + Prettier                               |
| Dead code  | Knip                                            |
| Pre-commit | Husky + lint-staged                             |
| Hosting    | Vercel (`@sveltejs/adapter-vercel`, Node.js 22) |

---

## Environment variables

| Variable | Default   | Description                                |
| -------- | --------- | ------------------------------------------ |
| `PORT`   | `3000`    | HTTP port for the production server        |
| `HOST`   | `0.0.0.0` | Host binding                               |
| `ORIGIN` | —         | Required for CSRF protection in production |

---

## Keyboard shortcuts

| Key                | Action                              |
| ------------------ | ----------------------------------- |
| `Cmd+F` / `Ctrl+F` | Focus search in code pane           |
| `Escape`           | Close panels / clear line highlight |

---

## Security

- No server-side authentication — deploy behind your corporate VPN or SSO proxy
- GitHub PAT is stored only in browser `localStorage`; never logged or persisted on the server
- All `{@html}` output is either Shiki-generated or pre-escaped via `escapeHtml()`
- File uploads are validated for size (10 MB) and JSON structure via Zod schemas

---

## License

Internal use only.
