# Token Sync

**Design token pipeline — Figma Variables → SCSS · TypeScript · Swift · Kotlin**

Token Sync is an internal design-ops tool that converts Figma's exported design token JSON into production-ready code for Web, iOS, and Android teams — eliminating manual copy-paste and preventing design–development drift.

---

## What it does

Upload Figma's native JSON exports, optionally provide your team's existing reference files, and Token Sync generates:

| Output                  | Web | iOS | Android |
| ----------------------- | --- | --- | ------- |
| `Primitives.scss`       | ✅  | —   | —       |
| `Colors.scss`           | ✅  | —   | —       |
| `Spacing.scss`          | ✅  | —   | —       |
| `Primitives.ts`         | ✅  | —   | —       |
| `Colors.ts`             | ✅  | —   | —       |
| `Spacing.ts`            | ✅  | —   | —       |
| `Typography.scss / .ts` | ✅  | —   | —       |
| `Colors.swift`          | —   | ✅  | —       |
| `Typography.swift`      | —   | ✅  | —       |
| `Colors.kt`             | —   | —   | ✅      |
| `Typography.kt`         | —   | —   | ✅      |

---

## Getting started

### Prerequisites

- Node.js ≥ 20
- Figma project with Variables and/or Styles set up

### Install & run

```sh
npm install
npm run dev          # http://localhost:5173
```

### Production build

```sh
npm run build
node build           # serves on PORT (default: 3000)
```

### Docker

```sh
docker build -t token-sync .
docker run -p 3000:3000 token-sync
```

---

## How to use

### Step 1 — Export tokens from Figma

1. Open your Figma file
2. **Variables**: `Edit → Copy as JSON` (or use the Variables panel export)
   - Export **Light mode** → `Light.tokens.json`
   - Export **Dark mode** → `Dark.tokens.json`
   - Export **Values** (spacing, integers) → `Value.tokens.json`
3. **Typography** (optional): Export text styles → `typography.tokens.json`

### Step 2 — Upload reference files (optional but recommended)

To preserve your team's existing variable naming conventions, upload their current source files:

| Platform | Reference files                                                |
| -------- | -------------------------------------------------------------- |
| Web      | `Primitives.scss`, `Colors.scss`, `Primitives.ts`, `Colors.ts` |
| iOS      | `Colors.swift`                                                 |
| Android  | `Colors.kt`                                                    |

Token Sync detects naming patterns (camelCase, SCREAMING_SNAKE_CASE, separators, import style) dynamically at runtime — **no hardcoded conventions, no breaking changes**.

### Step 3 — Generate

Select your target platforms (Web / iOS / Android / All), then click **Generate files →**.

The output panel shows:

- Syntax-highlighted code with **inline colour swatches** next to every hex value
- Six IDE themes: One Dark, Dracula, GitHub Dark, GitHub Dimmed, Catppuccin, Night Owl
- Line-by-line **diff view** against your reference files
- In-panel **search** (`⌘F`)
- **ZIP download** of all generated files

---

## Features

| Feature                       | Detail                                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Dynamic convention detection  | Reads your reference files at runtime to match prefix, separator, naming case, and import style                            |
| Primitive + semantic two-tier | Primitive colour constants → semantic alias tokens using `light-dark()` / UIColor dynamic providers                        |
| Modern output                 | CSS `@property`, `light-dark()`, SCSS `@use`, Swift hex `Color(hex: 0xRRGGBB)`, Material3 `ColorScheme` builders           |
| Typography support            | Parses Figma text style exports → SCSS mixins, TS interfaces, Swift `TypographyStyle` / `ViewModifier`, Kotlin `TextStyle` |
| Colour swatches               | Upload `Light.tokens.json` to instantly preview your full colour palette before generating                                 |
| Generation history            | Last 5 generations saved in `localStorage`, restorable with one click                                                      |
| Google Chat webhook           | Post a summary card to your team channel after each generation                                                             |
| GitHub PR (framework)         | Configure a PAT + repo per platform; sends a branch + PR automatically                                                     |
| Shareable config              | Export / import platform selections and reference files as a `.json` config                                                |
| Health endpoint               | `GET /api/health` — returns `{ status, version, uptime }`                                                                  |
| File size limit               | 10 MB per upload                                                                                                           |

---

## Settings

Click **⚙ Settings** in the upload panel (or press Escape to close):

### Google Chat webhook

Paste an incoming webhook URL. A summary card is posted after every successful generation.

### GitHub PR

1. Create a [GitHub Personal Access Token](https://github.com/settings/tokens) with `repo` scope
2. Enter the PAT and per-platform repository details (`owner`, `repo`, `base branch`, `target dir`)
3. After generating, click **↑ PR** — Token Sync creates a branch `design-tokens/sync-{timestamp}` and opens a PR in each configured repo

---

## Keyboard shortcuts

| Key             | Action                                             |
| --------------- | -------------------------------------------------- |
| `⌘F` / `Ctrl+F` | Focus search in code pane                          |
| `Escape`        | Close Settings / History / Swatches / Theme picker |

---

## Scripts

```sh
npm run dev          # Start dev server
npm run build        # Production build
npm run check        # svelte-check (TypeScript + Svelte diagnostics)
npm run test         # Run Vitest tests (145 tests, 100% coverage)
npm run test:coverage # Coverage report
npm run lint         # ESLint
npm run format       # Prettier
```

---

## Architecture

```
src/
├── lib/
│   ├── transformers/
│   │   ├── scss.ts          # Primitives.scss + Colors.scss
│   │   ├── ts-web.ts        # Primitives.ts + Colors.ts + Spacing.ts
│   │   ├── swift.ts         # Colors.swift (SwiftUI + UIColor dynamic provider)
│   │   ├── kotlin.ts        # Colors.kt (Compose + Material3 ColorScheme)
│   │   ├── typography.ts    # Typography.{scss,ts,swift,kt}
│   │   ├── spacing.ts       # Spacing tokens
│   │   └── naming.ts        # Dynamic convention detection
│   ├── storage.ts           # localStorage helpers
│   └── types.ts             # Shared TypeScript types + Zod schemas
└── routes/
    ├── +page.svelte         # Main UI
    ├── +layout.svelte
    ├── +error.svelte
    └── api/
        ├── generate/        # POST — runs all transformers
        ├── notify/          # POST — Google Chat webhook proxy
        ├── github/pr/       # POST — GitHub branch + PR creation
        └── health/          # GET  — health check
```

---

## Environment variables

| Variable | Default   | Description                                                                     |
| -------- | --------- | ------------------------------------------------------------------------------- |
| `PORT`   | `3000`    | HTTP port for the production server                                             |
| `HOST`   | `0.0.0.0` | Host binding                                                                    |
| `ORIGIN` | —         | Required for CSRF protection in production (e.g. `https://token-sync.internal`) |

---

## Security notes

- No server-side authentication — deploy behind your corporate VPN or SSO proxy
- GitHub PAT is stored only in the user's browser `localStorage`; it is never logged or persisted on the server
- All `{@html}` output is either Shiki-generated (from our own transformer content) or pre-escaped via `escapeHtml()`
- File uploads are validated for size (10 MB limit) and JSON structure via Zod schemas

---

## License

Internal use only.
