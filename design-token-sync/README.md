# Design Token Sync System

**Automated design token synchronization from Figma to all platforms**

A complete system that extracts design tokens from Figma, transforms them into platform-specific code (CSS, Swift, Kotlin), and automatically deploys to a GitHub Pages documentation site.

## 🎯 What It Does

1. **Extracts** design tokens from Figma (Variables + Text Styles)
2. **Transforms** tokens into platform-specific formats
3. **Deploys** to GitHub Pages automatically
4. **Provides** documentation website for all teams

## 🏗️ System Architecture

```
Figma Variables → Native Export → JSON files (3 files)
                                        ↓
Figma Text Styles → Typography Plugin → JSON file
                                        ↓
                              Backend Service
                                        ↓
                            ┌───────────┴───────────┐
                            ↓           ↓           ↓
                           CSS        Swift      Kotlin
                            ↓           ↓           ↓
                            GitHub Pages Website
                                        ↓
                       Web | iOS | Android Teams
```

## 📦 Components

### 1. Typography Plugin
- **Location**: `typography-plugin/`
- **Purpose**: Extract Text Styles from Figma
- **Output**: `typography.json`
- **Tech**: TypeScript, Figma Plugin API

### 2. Backend Service
- **Location**: `backend/`
- **Purpose**: Process and transform tokens
- **Input**: 4 JSON files (Light, Dark, Value, Typography)
- **Output**: Platform-specific token files
- **Tech**: Node.js, Express, TypeScript

### 3. Documentation Website
- **Location**: `docs/`
- **Purpose**: Host tokens and documentation
- **Tech**: Static HTML/CSS, GitHub Pages

## 🚀 Quick Start

### 1. Setup Typography Plugin

```bash
cd typography-plugin
npm install
npm run build
```

Then import into Figma: Plugins → Development → Import plugin from manifest

### 2. Setup Backend

```bash
cd backend
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your values:
# - API_KEY
# - GITHUB_TOKEN
# - GITHUB_OWNER
# - GITHUB_REPO
```

### 3. Run Backend

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 4. Setup GitHub Pages

1. Create a repository (e.g., `design-tokens`)
2. Push this project to the repository
3. Enable GitHub Pages:
   - Settings → Pages
   - Source: `main` branch
   - Folder: `/docs`
4. Generate a Personal Access Token with `repo` scope
5. Add token to backend `.env` as `GITHUB_TOKEN`

## 📝 Usage Workflow

### For Designers

1. **Export from Figma**:
   - Go to Variables → Export as JSON
   - Download 3 files:
     - `Light.tokens.json`
     - `Dark.tokens.json`
     - `Value.tokens.json`

2. **Run Typography Plugin**:
   - Plugins → Typography Token Exporter
   - Click "Export Typography"
   - Download `typography.json`

3. **Publish Tokens**:
   ```bash
   curl -X POST http://localhost:3000/api/tokens/publish \
     -H "X-API-Key: your-api-key" \
     -F "light=@Light.tokens.json" \
     -F "dark=@Dark.tokens.json" \
     -F "value=@Value.tokens.json" \
     -F "typography=@typography.json"
   ```

4. **View Results**:
   - Check your GitHub Pages site (e.g., `https://yourteam.github.io/design-tokens`)
   - Tokens are automatically deployed and available

### For Developers

Visit the GitHub Pages site to download tokens for your platform:

- **Web**: CSS + TypeScript files
- **iOS**: Swift file with ColorToken struct
- **Android**: Kotlin files with Compose extensions

## 🎨 Token Structure

### Input (from Figma)

**Colors** (Light & Dark modes):
- Text (primary, secondary, tertiary, disabled)
- Icon (primary, secondary, tertiary)
- Fill (component, brand, success, warning, error, info)
- Stroke (weaker, weak, disabled, error)
- Background (base, sunken)

**Spacing**: 0, 1, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 128, 160, 192, 256

**Radius**: 0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 48, 999 (full)

**Typography**: Font family, size, weight, line height, letter spacing

### Output Formats

#### Web (CSS)
```css
:root {
  --text-primary: light-dark(#1d1d1d, #fdfdfd);
  --spacing-16: 16px;
  --radius-8: 8px;
}
```

#### Web (TypeScript)
```typescript
export const colors = {
  text: {
    primary: '#1d1d1d',
    secondary: 'rgba(29, 29, 29, 0.69)'
  }
};
```

#### iOS (Swift)
```swift
enum DesignTokens {
    enum Colors {
        static let textPrimary = ColorToken(
            light: Color(red: 0.113, green: 0.113, blue: 0.113),
            dark: Color(red: 0.992, green: 0.992, blue: 0.992)
        )
    }
}
```

#### Android (Kotlin)
```kotlin
object DesignTokens {
    object Colors {
        val textPrimary = ColorToken(
            light = Color(0xFF1D1D1D),
            dark = Color(0xFFFDFDFD)
        )
    }
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Backend Server
PORT=3000
NODE_ENV=production

# API Security
API_KEY=your-secret-api-key

# GitHub Deployment
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=your-github-username
GITHUB_REPO=design-tokens

# Optional: Slack Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

## 📚 Documentation

- [Typography Plugin README](typography-plugin/README.md)
- [Backend README](backend/README.md)
- [Documentation Site README](docs/README.md)
- [Project Plan](../plans/design_token_sync_system_e6579f3c.plan.md)

## 🧪 Testing

### Manual Testing

1. Test typography plugin in Figma
2. Test backend locally with curl
3. Verify transformed output files
4. Check GitHub deployment
5. Validate website display

### Test with Sample Data

Use the actual token files from `/Users/ishan.jalan/Downloads/Tokens/`:

```bash
curl -X POST http://localhost:3000/api/tokens/publish \
  -H "X-API-Key: test-key" \
  -F "light=@/Users/ishan.jalan/Downloads/Tokens/1. Colours/Light.tokens.json" \
  -F "dark=@/Users/ishan.jalan/Downloads/Tokens/1. Colours/Dark.tokens.json" \
  -F "value=@/Users/ishan.jalan/Downloads/Tokens/Value.tokens.json" \
  -F "typography=@typography.json"
```

## 🎯 Success Metrics

- ✅ Typography plugin extracts all text styles
- ✅ Backend parses Figma's DTCG format correctly
- ✅ All transformers generate valid platform-specific code
- ✅ GitHub deployment succeeds
- ✅ Website displays tokens correctly
- ✅ Teams can download and use tokens

## 🔄 Update Workflow

1. Designer updates tokens in Figma
2. Designer exports + runs plugin (4 files total)
3. Designer uploads to backend
4. Backend transforms tokens
5. Backend deploys to GitHub
6. GitHub Pages rebuilds (1-5 minutes)
7. Teams get updated tokens

**Time to update**: < 5 minutes

## 💡 Benefits

- **Eliminates manual token updates**: Save 2-4 hours/week
- **Zero design-dev drift**: Single source of truth
- **Multi-platform support**: One publish → all platforms updated
- **Type-safe tokens**: TypeScript, Swift, Kotlin
- **Automatic deployment**: No manual steps needed
- **Version history**: Git tracks all changes
- **Documentation**: Always up-to-date website

## 🛠️ Technology Stack

- **Plugin**: TypeScript, Figma Plugin API
- **Backend**: Node.js, Express, TypeScript
- **Transformers**: Custom TypeScript transformers
- **Deployment**: GitHub API (Octokit)
- **Website**: Static HTML/CSS, Prism.js
- **Hosting**: GitHub Pages (free)

## 📄 License

MIT

## 👥 Contributing

This is an internal DesignOps tool. For questions or improvements, contact the DesignOps team.

## 🎉 Acknowledgments

Built as part of the DesignOps Plugin Portfolio to improve design-dev collaboration and reduce token sync overhead.
