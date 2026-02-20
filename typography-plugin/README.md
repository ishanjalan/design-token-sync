# Typography Token Exporter

A minimal Figma plugin that extracts Text Styles as DTCG-compliant typography tokens.

## Features

- Extracts all local Text Styles from your Figma file
- Outputs DTCG-compliant JSON format
- Includes: fontFamily, fontSize, fontWeight, lineHeight, letterSpacing
- One-click export with automatic file download

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the plugin:
```bash
npm run build
```

3. In Figma:
   - Go to Plugins → Development → Import plugin from manifest
   - Select the `manifest.json` file from this directory

## Usage

1. Open your Figma file with Text Styles
2. Run the plugin: Plugins → Development → Typography Token Exporter
3. Click "Export Typography"
4. Save the generated `typography.tokens.json` file

## Output Format

```json
{
  "typography": {
    "Heading/H1": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Inter",
        "fontSize": 32,
        "fontWeight": 700,
        "lineHeight": 40,
        "letterSpacing": 0
      }
    }
  }
}
```

## Development

Watch mode for development:
```bash
npm run watch
```

## Integration

This plugin is part of the Design Token Sync System. The exported JSON file should be uploaded to the backend along with:
- `Light.tokens.json` (color tokens - light mode)
- `Dark.tokens.json` (color tokens - dark mode)  
- `Value.tokens.json` (spacing & radius tokens)

Together, these 4 files are transformed into platform-specific code (CSS, Swift, Kotlin) and published to GitHub Pages.
