# Testing Guide

Comprehensive testing guide for the Design Token Sync System.

## Pre-requisites

1. Typography plugin built and installed in Figma
2. Backend server running locally
3. Test token files available
4. GitHub repository created (for deployment tests)

## 1. Typography Plugin Testing

### Setup
```bash
cd typography-plugin
npm install
npm run build
```

### Manual Test in Figma

1. Open Figma with Text Styles
2. Plugins → Development → Import plugin from manifest
3. Select `typography-plugin/manifest.json`
4. Run the plugin
5. Click "Export Typography"

**Expected Result**:
- Plugin displays UI
- Shows count of text styles found
- Downloads `typography.tokens.json`
- File contains all text styles in DTCG format

**Verify JSON Structure**:
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

## 2. Backend API Testing

### Start Server
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with test values
npm run dev
```

### Test Health Endpoint
```bash
curl http://localhost:3000/api/tokens/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "timestamp": "2026-02-05T...",
  "version": "1.0.0"
}
```

### Test Token Publishing

Using actual token files:

```bash
curl -X POST http://localhost:3000/api/tokens/publish \
  -H "X-API-Key: your-test-api-key" \
  -F "light=@/Users/ishan.jalan/Downloads/Tokens/1. Colours/Light.tokens.json" \
  -F "dark=@/Users/ishan.jalan/Downloads/Tokens/1. Colours/Dark.tokens.json" \
  -F "value=@/Users/ishan.jalan/Downloads/Tokens/Value.tokens.json" \
  -F "typography=@typography.json"
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Tokens transformed and deployed successfully",
  "filesGenerated": [
    "tokens/web/colors.css",
    "tokens/web/spacing.css",
    "tokens/web/radius.css",
    "tokens/web/typography.css",
    "tokens/web/colors.ts",
    "tokens/web/spacing.ts",
    "tokens/web/typography.ts",
    "tokens/ios/DesignTokens.swift",
    "tokens/android/DesignTokens.kt",
    "tokens/android/ColorScheme+Tokens.kt"
  ],
  "websiteUrl": "https://yourteam.github.io/design-tokens",
  "deployTime": "2026-02-05T..."
}
```

### Test Error Cases

**Missing Files**:
```bash
curl -X POST http://localhost:3000/api/tokens/publish \
  -H "X-API-Key: test-key" \
  -F "light=@Light.tokens.json"
```

Expected: 400 Bad Request with missing files error

**Invalid API Key**:
```bash
curl -X POST http://localhost:3000/api/tokens/publish \
  -H "X-API-Key: wrong-key" \
  -F "light=@Light.tokens.json" \
  -F "dark=@Dark.tokens.json" \
  -F "value=@Value.tokens.json" \
  -F "typography=@typography.json"
```

Expected: 401 Unauthorized

**Invalid JSON**:
Create a test file with invalid JSON and upload.

Expected: 400 Bad Request with JSON parse error

## 3. Transformer Testing

### Verify CSS Output

After publishing, check generated CSS:

```bash
cat docs/tokens/web/colors.css
```

**Verify**:
- ✅ Contains `:root { ... }` block
- ✅ Uses `light-dark()` syntax
- ✅ Has fallback with `@supports` and `@media`
- ✅ Variables named correctly (e.g., `--text-primary`)
- ✅ Color values match Figma exports

**Example**:
```css
:root {
  color-scheme: light dark;
  
  --text-primary: light-dark(#1d1d1d, #fdfdfd);
  --text-secondary: light-dark(rgba(29, 29, 29, 0.69), rgba(253, 253, 253, 0.72));
}
```

### Verify TypeScript Output

```bash
cat docs/tokens/web/colors.ts
```

**Verify**:
- ✅ Valid TypeScript syntax
- ✅ Exports `colors` and `colorsDark` objects
- ✅ Exports `spacing` and `radius` objects
- ✅ Has `getColor()` helper function
- ✅ Uses `as const` for type safety

### Verify Swift Output

```bash
cat docs/tokens/ios/DesignTokens.swift
```

**Verify**:
- ✅ Valid Swift syntax
- ✅ `enum DesignTokens` structure
- ✅ `ColorToken` struct with light/dark properties
- ✅ Nested enums for categories (Text, Icon, Fill, etc.)
- ✅ `Spacing` and `Radius` enums with CGFloat values
- ✅ Color extensions for convenience

### Verify Kotlin Output

```bash
cat docs/tokens/android/DesignTokens.kt
cat docs/tokens/android/ColorScheme+Tokens.kt
```

**Verify**:
- ✅ Valid Kotlin syntax
- ✅ `object DesignTokens` structure
- ✅ `ColorToken` data class
- ✅ Nested objects for categories
- ✅ `ColorScheme` extensions in separate file
- ✅ Uses Compose types (Dp, Color)

## 4. GitHub Deployment Testing

### Prerequisites
- GitHub repository created
- GitHub Pages enabled (main branch, /docs folder)
- Personal Access Token with `repo` scope
- Environment variables configured in `.env`

### Test Deployment

1. Run backend with GitHub configured
2. Publish tokens via API
3. Check GitHub repository:
   - New commit should appear
   - Files in `/docs/tokens/` updated
4. Wait 1-5 minutes for GitHub Pages to rebuild
5. Visit your GitHub Pages URL

**Expected Result**:
- Website loads successfully
- All platform pages accessible
- Download buttons work
- Token files downloadable

### Verify GitHub Integration

```bash
# Check if GitHub is configured
curl http://localhost:3000/api/tokens/health
```

Backend logs should show:
```
[INFO] GitHub Token configured: true
```

## 5. Website Testing

### Local Testing

```bash
# Install http-server
npm install -g http-server

# Serve docs folder
cd docs
http-server

# Open http://localhost:8080
```

### Manual Checks

**Homepage** (`index.html`):
- ✅ Platform cards displayed
- ✅ Links work
- ✅ Last update time shows

**Platform Pages**:
- ✅ Web page: CSS and TypeScript examples
- ✅ iOS page: Swift examples
- ✅ Android page: Kotlin examples
- ✅ Code syntax highlighting works
- ✅ Download buttons work
- ✅ Code examples are accurate

### Cross-Browser Testing

Test in:
- Chrome/Edge
- Safari
- Firefox

**Verify**:
- ✅ Layout renders correctly
- ✅ Download buttons work
- ✅ Syntax highlighting works
- ✅ Responsive design on mobile

## 6. Integration Testing

### End-to-End Flow

1. **Export from Figma**:
   - Export Variables as JSON (3 files)
   - Run Typography Plugin (1 file)

2. **Publish**:
   ```bash
   curl -X POST http://localhost:3000/api/tokens/publish \
     -H "X-API-Key: test-key" \
     -F "light=@Light.tokens.json" \
     -F "dark=@Dark.tokens.json" \
     -F "value=@Value.tokens.json" \
     -F "typography=@typography.json"
   ```

3. **Verify**:
   - Backend logs show success
   - GitHub commit created
   - Website updates (wait 1-5 minutes)
   - All token files downloadable
   - Token values match Figma

## 7. Performance Testing

### Large Token Sets

Test with:
- 100+ color tokens
- 50+ typography styles
- Complex nested structures

**Verify**:
- ✅ Backend processes in < 5 seconds
- ✅ GitHub deployment completes
- ✅ Generated files are readable
- ✅ Website loads quickly

### Concurrent Requests

**Not recommended** - This system is designed for sequential updates by designers, not high concurrency.

## 8. Error Handling

### Test Error Scenarios

1. **Network Errors**: Disconnect GitHub and test
2. **Invalid Tokens**: Upload malformed JSON
3. **Missing Permissions**: Use invalid GitHub token
4. **Large Files**: Upload files > 10MB (should fail)

**Verify**:
- ✅ Appropriate error messages
- ✅ HTTP status codes correct
- ✅ Backend doesn't crash
- ✅ Errors logged properly

## 9. Regression Testing

After making changes:

1. Run all API tests
2. Verify transformer outputs
3. Check GitHub deployment
4. Test website display
5. Download and use tokens in a real project

## 10. User Acceptance Testing

### Designer Flow
- Designer can export from Figma easily
- Plugin is intuitive to use
- Upload process is clear
- Feedback is helpful

### Developer Flow
- Website is easy to navigate
- Download process is straightforward
- Token files integrate into projects
- Code examples are helpful

## Test Checklist

- [ ] Typography plugin extracts all styles
- [ ] Backend health endpoint works
- [ ] Token publish API works
- [ ] All transformers generate valid code
- [ ] GitHub deployment succeeds
- [ ] Website displays correctly
- [ ] Download buttons work
- [ ] Token values match Figma
- [ ] Error handling works
- [ ] End-to-end flow complete in < 5 minutes

## Known Issues

None at this time.

## Reporting Issues

If you find issues during testing:

1. Check backend logs for errors
2. Verify environment variables are set
3. Confirm GitHub permissions
4. Test with sample data
5. Document steps to reproduce

## Next Steps

After successful testing:

1. Deploy backend to production (Vercel/Railway)
2. Configure production environment variables
3. Test with production deployment
4. Onboard design team
5. Document for developers
