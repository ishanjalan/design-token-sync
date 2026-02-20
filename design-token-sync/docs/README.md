# Design Token Documentation Site

This directory contains the static website for the Design Token Sync system. It's automatically deployed to GitHub Pages when tokens are published.

## Structure

```
docs/
├── index.html          # Homepage
├── web.html            # Web platform page (CSS/TypeScript)
├── ios.html            # iOS platform page (Swift)
├── android.html        # Android platform page (Kotlin)
├── styles/
│   └── main.css       # Website styles
└── tokens/            # Generated token files (auto-deployed)
    ├── web/
    │   ├── colors.css
    │   ├── spacing.css
    │   ├── radius.css
    │   ├── typography.css
    │   ├── colors.ts
    │   ├── spacing.ts
    │   └── typography.ts
    ├── ios/
    │   └── DesignTokens.swift
    └── android/
        ├── DesignTokens.kt
        └── ColorScheme+Tokens.kt
```

## GitHub Pages Setup

1. Go to your repository settings
2. Navigate to "Pages" in the sidebar
3. Under "Source", select:
   - Branch: `main`
   - Folder: `/docs`
4. Click "Save"

GitHub Pages will automatically build and deploy from the `/docs` folder.

## Local Development

To view the website locally:

1. Install a local server (e.g., `npm install -g http-server`)
2. Run: `http-server docs`
3. Open: `http://localhost:8080`

## Automatic Updates

When tokens are published via the backend:
1. Transformed token files are committed to `/docs/tokens/`
2. GitHub Pages automatically rebuilds the site
3. Changes are live within minutes

## Customization

### Branding

Update these files to customize for your organization:
- `docs/styles/main.css` - Colors and styling
- `docs/index.html` - Homepage content
- Footer text in all HTML files

### Adding Content

- Add new platform pages following the same structure
- Update `index.html` to link to new platforms
- Use the same CSS classes for consistency
