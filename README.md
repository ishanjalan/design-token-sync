# Tokensmith

**Design token pipeline — Figma → SCSS · TypeScript · Swift · Kotlin**

Tokensmith converts Figma's exported design token JSON into production-ready code for Web, iOS, and Android — eliminating manual copy-paste and preventing design–development drift.

**Live:** [design-token-sync.vercel.app](https://design-token-sync.vercel.app)

---

## What it generates

| Output                  | Web | iOS | Android |
| ----------------------- | --- | --- | ------- |
| `Primitives.scss`       | ✓   | —   | —       |
| `Colors.scss`           | ✓   | —   | —       |
| `Colors.css`            | ✓   | —   | —       |
| `Spacing.scss`          | ✓   | —   | —       |
| `Primitives.ts`         | ✓   | —   | —       |
| `Colors.ts`             | ✓   | —   | —       |
| `Spacing.ts`            | ✓   | —   | —       |
| `Typography.scss / .ts` | ✓   | —   | —       |
| `Colors.swift`          | —   | ✓   | —       |
| `Typography.swift`      | —   | ✓   | —       |
| `Colors.kt`             | —   | —   | ✓       |
| `Typography.kt`         | —   | —   | ✓       |

### iOS Swift output structure

In **"Match existing"** mode, Tokensmith detects your reference file's conventions and reproduces a multi-tier structure:

| Tier | Purpose | Example |
| ---- | ------- | ------- |
| **1** | Primitive hex codes | `fileprivate enum ColorCode { static let blue500Light = "#0969DA" }` |
| **2** | Semantic aliases | `enum ColorCodes { static let accentFgLight = ColorCode.blue500Light }` |
| **4** | SwiftUI `Color` API | `public extension ColorStyle { static var accentFg: Color { ... } }` |

Tier 3 (`UIColor` API) is intentionally skipped — the generated output targets SwiftUI `Color` directly, which is the recommended modern approach. If your reference file contains a `UIColor` API layer, the generated output will still compile and work; the SwiftUI Color extension in Tier 4 handles dynamic light/dark resolution.

In **"Best practices"** mode, the output uses a clean two-tier structure with `Color(hex:)` initializers and `light-dark` dynamic resolution.

---

## Getting started

### Prerequisites

- Node.js >= 24
- Figma project with Variables and/or Styles

### Install and run

```sh
npm install
npm run dev       # http://localhost:5173
```

### Production build

```sh
npm run build
npm run preview   # preview production build locally
```

### Docker

```sh
docker build -t tokensmith .
docker run -p 3000:3000 tokensmith
```

### Deploy to Vercel

The app uses `@sveltejs/adapter-vercel` and deploys automatically on push to `main`.

---

## How to use

### Step 1 — Load design tokens

Tokens are loaded automatically from the design tokens GitHub repository. On first load, Tokensmith pulls the latest version and populates all file slots.

You can also drag-and-drop JSON files manually:
- Light mode → `Light.tokens.json`
- Dark mode → `Dark.tokens.json`
- Values (spacing, integers) → `Value.tokens.json`
- Typography (optional) → `typography.tokens.json`

### Step 2 — Upload reference files (optional)

To preserve your team's existing variable naming conventions, upload their current source files:

| Platform | Reference files                                                |
| -------- | -------------------------------------------------------------- |
| Web      | `Primitives.scss`, `Colors.scss`, `Primitives.ts`, `Colors.ts` |
| iOS      | `Colors.swift`                                                 |
| Android  | `Colors.kt`                                                    |

Tokensmith detects naming patterns (camelCase, SCREAMING_SNAKE_CASE, separators, import style, indentation, container types, enum names) dynamically at runtime — no hardcoded conventions.

### Step 3 — Choose a mode

- **Match existing** — mirrors the structure and naming of your reference files
- **Best practices** — applies recommended conventions per platform:
  - **Web:** `@use` imports, `light-dark()` CSS function, type annotations
  - **iOS:** SwiftUI `Color` extensions, `Color(hex:)` initializers, camelCase
  - **Android:** camelCase, Compose `Color()` constructors, `object` containers

### Step 4 — Generate

Select your target platform (Web / iOS / Android), then click **Generate files**.

---

## GitHub token storage

Store your design tokens in a GitHub repository so team members can load the latest version without re-exporting from Figma.

### Setup

1. Open **Settings** in the activity rail
2. Enter your GitHub **Personal Access Token** (needs `repo` scope)
3. Configure a repository per platform (owner, repo, branch, directory)

### Environment variables

| Variable            | Description                                     |
| ------------------- | ----------------------------------------------- |
| `TOKENS_GITHUB_PAT` | GitHub PAT for server-side token operations     |
| `TOKENS_GITHUB_REPO`| Default repository in `owner/repo` format       |

Once configured, Tokensmith can:
- Load previously stored tokens from GitHub
- Browse version history and restore any previous version
- Create PRs with generated output files directly from the UI

---

## Figma plugin integration

The Figma plugin enables direct token export without manual JSON downloads.

### Webhook auto-sync

1. In **Settings**, enter a Figma file key and Figma PAT
2. Tokensmith registers for `FILE_VERSION_UPDATE` webhooks
3. When your Figma file is published, tokens are automatically refreshed and regeneration is triggered

### Plugin sync

If the Tokensmith Figma plugin is installed, click **Sync from plugin** in the Import panel to pull tokens directly from the active Figma file.

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
- Diff count pills on file tabs showing number of changes per file

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
- **Figma plugin sync** — pull tokens directly from the Figma plugin
- **ZIP download** — download all generated files in one archive
- **Shareable config** — export/import platform selections and reference files as JSON

### UX

- First-run onboarding guide with step-by-step instructions
- In-app help panel with quick start guide and file reference
- Post-generation success summary with diff statistics
- Platform filtering — toggle Web, iOS, Android independently
- Colour swatch panel — preview your full palette before generating
- Generation history — last 5 runs saved in localStorage, restorable with one click
- Keyboard shortcut legend (press `?` or click the keyboard icon in the status bar)
- Dark/light theme with automatic system detection

### Other

- Health endpoint — `GET /api/health` returns `{ status, version, uptime }`
- 10 MB per-file upload limit with Zod schema validation

---

## Scripts

```sh
npm run dev           # Start dev server
npm run build         # Production build
npm run check         # svelte-check (TypeScript + Svelte diagnostics)
npm run test          # Run Vitest unit tests
npm run test:ui       # Vitest browser UI
npm run test:coverage # Coverage report
npm run test:e2e      # Playwright E2E tests (18 tests)
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
│   │   ├── swift.ts          # Colors.swift (Tier 1+2+4 SwiftUI Color)
│   │   ├── kotlin.ts         # Colors.kt (Compose + Material3 ColorScheme)
│   │   ├── typography.ts     # Typography.{scss,ts,swift,kt}
│   │   ├── spacing.ts        # Spacing tokens
│   │   ├── naming.ts         # Dynamic convention detection
│   │   └── fixtures.ts       # Shared test fixtures
│   ├── stores/
│   │   ├── file-store.svelte.ts       # File slots, drag/drop, platform selection
│   │   ├── generation-store.svelte.ts # Generation results, diffs, highlights
│   │   ├── ui-store.svelte.ts         # Theme, panels, scroll, search state
│   │   ├── settings-store.svelte.ts   # GitHub, Figma, Chat config
│   │   ├── token-store-client.svelte.ts # GitHub token versions, plugin sync
│   │   └── history-store.svelte.ts    # Generation history
│   ├── components/
│   │   ├── AppShell.svelte
│   │   ├── ActivityRail.svelte
│   │   ├── WelcomeView.svelte
│   │   ├── EditorPane.svelte
│   │   ├── ExplorerPanel.svelte
│   │   ├── ImportPanel.svelte
│   │   ├── SettingsPanel.svelte
│   │   ├── HistoryPanel.svelte
│   │   ├── HelpPanel.svelte
│   │   ├── StatusBar.svelte
│   │   ├── BottomTabBar.svelte
│   │   ├── PlatformConsistency.svelte
│   │   ├── PrResults.svelte
│   │   └── SwatchPanel.svelte
│   ├── color-utils.ts        # Hex formatting via culori
│   ├── diff-utils.ts         # Diff computation with word-level highlighting
│   ├── file-validation.ts    # Zod-based upload validation
│   ├── search-utils.ts       # In-file search with highlighting
│   ├── swatch-utils.ts       # Swatch comparison logic
│   ├── storage.ts            # localStorage helpers
│   ├── token-analysis.ts     # Coverage, impact, rename, cross-platform analysis
│   └── types.ts              # Shared TypeScript types + Zod schemas
├── routes/
│   ├── +page.svelte          # Main orchestrator
│   ├── +layout.svelte        # Primer CSS + global styles
│   ├── +error.svelte         # Error boundary
│   └── api/
│       ├── generate/         # POST — runs all transformers
│       ├── notify/           # POST — Google Chat webhook proxy
│       ├── github/pr/        # POST — GitHub branch + PR creation
│       ├── figma/webhook/    # POST — Figma file version webhook
│       └── health/           # GET  — health check
└── e2e/
    ├── critical-path.spec.ts
    ├── platform-switching.spec.ts
    ├── reference-files.spec.ts
    ├── diff-view.spec.ts
    ├── settings-persistence.spec.ts
    ├── dark-mode.spec.ts
    ├── history.spec.ts
    └── fixtures/             # Test fixture JSON files
```

---

## Tech stack

| Layer      | Technology                                      |
| ---------- | ----------------------------------------------- |
| Framework  | SvelteKit 2 (Svelte 5 with runes)              |
| Language   | TypeScript                                      |
| Design     | Primer Primitives (`@primer/primitives`)        |
| Syntax     | Shiki                                           |
| Colour     | culori, apca-w3                                 |
| Diff       | diff (v8)                                       |
| Validation | Zod                                             |
| Unit tests | Vitest                                          |
| E2E tests  | Playwright (18 tests across 7 specs)            |
| Linting    | ESLint + Prettier                               |
| Dead code  | Knip                                            |
| Pre-commit | Husky + lint-staged                             |
| CI/CD      | GitHub Actions (lint, type-check, unit, E2E)    |
| Hosting    | Vercel (`@sveltejs/adapter-vercel`, Node.js 24) |

---

## Environment variables

| Variable             | Default    | Description                                      |
| -------------------- | ---------- | ------------------------------------------------ |
| `PORT`               | `3000`     | HTTP port for the production server              |
| `HOST`               | `0.0.0.0`  | Host binding                                     |
| `ORIGIN`             | —          | Required for CSRF protection in production       |
| `TOKENS_GITHUB_PAT`  | —          | GitHub PAT for server-side token operations      |
| `TOKENS_GITHUB_REPO` | —          | Default repository in `owner/repo` format        |

---

## Keyboard shortcuts

| Key                 | Action                              |
| ------------------- | ----------------------------------- |
| `Cmd+F` / `Ctrl+F`  | Focus search in code pane           |
| `Cmd+D` / `Ctrl+D`  | Toggle diff view                    |
| `↑` / `↓`           | Navigate diff hunks                 |
| `Escape`             | Close panels / clear line highlight |
| `?`                  | Toggle keyboard shortcut legend     |

---

## Security

- No server-side authentication — deploy behind your corporate VPN or SSO proxy
- GitHub PAT is stored only in browser `localStorage`; never logged or persisted on the server
- All `{@html}` output is either Shiki-generated or pre-escaped via `escapeHtml()`
- File uploads are validated for size (10 MB) and JSON structure via Zod schemas

---

## License

Internal use only.
