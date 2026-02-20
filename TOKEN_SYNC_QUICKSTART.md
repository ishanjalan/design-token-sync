# Token Sync Plugin - Quick Start Guide

**TL;DR:** Build this plugin FIRST. It's simpler than the AI audit plugin and provides immediate value.

---

## 🎯 What This Plugin Does

**Exports your Figma Variables to production-ready code for:**
- ✅ **Web:** CSS Custom Properties + TypeScript
- ✅ **iOS:** Swift with SwiftUI (hybrid structs + extensions)
- ✅ **Android:** Kotlin with Jetpack Compose

**One click = All platforms synced** 🚀

---

## ✅ Why Your Tokens Are Already Perfect

Based on the **RedBus CSS analysis** (see `REDBUS_CSS_ANALYSIS.md`):

### **Your Token Structure:**
```json
{
  "Text": { "primary": "#1D1D1D" },
  "Icon": { "primary": "#1D1D1D" },
  "Fill": { "component": { "primary": "#FDFDFD" } },
  "Stroke": { "weaker": "#E6E6E6" },
  "Background": { "base": "#FFFFFF" }
}
```

### **RedBus Uses:**
```css
--text-primary: light-dark(#1d1d1d, #fdfdfd);
--icon-primary: light-dark(#1d1d1d, #fdfdfd);
--fill-component-primary: light-dark(#fdfdfd, #27272a);
--stroke-weaker: light-dark(#e6e6e6, #4b4b4b);
--background-base: light-dark(#fff, #18181b);
```

**Your structure is enterprise-grade and matches production apps!** ✅

---

## 📦 What You'll Export

### **Web Output Example:**

```css
/* colors.css */
:root {
  --text-primary: light-dark(#1d1d1d, #fdfdfd);
  --icon-primary: light-dark(#1d1d1d, #fdfdfd);
  --spacing-16: 16px;
  --radius-8: 8px;
}
```

```typescript
// colors.ts
export const colors = {
  text: {
    primary: '#1d1d1d',
    secondary: 'rgba(29, 29, 29, 0.69)',
  }
} as const;
```

### **iOS Output Example:**

```swift
// DesignTokens.swift
enum DesignTokens {
    enum Colors {
        enum Text {
            static let primary = ColorToken(
                light: Color(red: 0.114, green: 0.114, blue: 0.114),
                dark: Color(red: 0.992, green: 0.992, blue: 0.992)
            )
        }
    }
}

// Usage: Color.textPrimary
```

### **Android Output Example:**

```kotlin
// DesignTokens.kt
object DesignTokens {
    object Colors {
        object Text {
            val primary = ColorToken(
                light = Color(0xFF1D1D1D),
                dark = Color(0xFFFDFDFD)
            )
        }
    }
}

// Usage: colorScheme.textPrimary
```

---

## 🚀 Implementation Plan

### **Phase 1: Web Only (Week 1-2)** ← START HERE

**Why first:**
- ✅ Simplest platform
- ✅ Immediate value to web team
- ✅ Validates your approach
- ✅ No complex type conversions

**Build:**
1. Read Figma Variables API
2. Transform to CSS (with `light-dark()`)
3. Transform to TypeScript
4. Generate downloadable ZIP
5. Test with your actual tokens

**Time:** 1-2 weeks  
**Complexity:** ⭐⭐ (Medium)

---

### **Phase 2: iOS (Week 3)**

**Build:**
1. Swift transformer
2. ColorToken struct (light/dark handling)
3. Convenience extensions
4. Test with iOS project

**Time:** 1 week  
**Complexity:** ⭐⭐⭐ (Medium-High)

---

### **Phase 3: Android (Week 4)**

**Build:**
1. Kotlin transformer
2. ColorToken data class
3. ColorScheme extensions
4. Test with Android project

**Time:** 1 week  
**Complexity:** ⭐⭐⭐ (Medium-High)

---

### **Phase 4: Polish (Week 5)**

**Add:**
1. Token preview UI
2. Export options
3. Error handling
4. Documentation generation
5. Beta testing

**Time:** 1 week  
**Complexity:** ⭐⭐ (Medium)

---

## 📂 Key Files to Read

| File | Purpose |
|------|---------|
| `TOKEN_SYNC_IMPLEMENTATION.md` | **Full technical spec** with code examples |
| `REDBUS_CSS_ANALYSIS.md` | Proof your tokens match production patterns |
| `DEVELOPER_QUESTIONNAIRE.md` | Questions for your dev team |
| `TECHNICAL_ARCHITECTURE.md` | Plugin architecture (for AI plugin) |

---

## 🎨 Output Format Decisions Made

### **✅ Web: Modern `light-dark()` with Fallback**
- Primary: `--text-primary: light-dark(#1d1d1d, #fdfdfd);`
- Fallback: `@supports not (color: light-dark())` with media queries
- **Why:** Future-proof, matches RedBus, cleaner than media queries

### **✅ Web: Add Spacing/Radius Variables**
- `--spacing-16: 16px;`
- `--radius-8: 8px;`
- **Why:** More consistent than RedBus (they hardcode these)

### **✅ iOS: Hybrid Structs + Extensions**
- Source of truth: `DesignTokens.Colors.Text.primary`
- Convenience: `Color.textPrimary`
- **Why:** Best of both worlds (organization + ease of use)

### **✅ Android: Jetpack Compose with ColorScheme Extensions**
- Tokens: `DesignTokens.Colors.Text.primary`
- Usage: `colorScheme.textPrimary`
- **Why:** Modern, integrates with Material3

---

## 🎯 Success Criteria

### **Week 1-2 (Web Export):**
- [ ] Plugin reads your Figma Variables
- [ ] Generates CSS with `light-dark()`
- [ ] Generates TypeScript with types
- [ ] Creates downloadable ZIP
- [ ] Web team tests and approves

### **Week 3 (iOS):**
- [ ] Generates Swift files
- [ ] iOS team tests in Xcode
- [ ] Light/Dark mode works correctly
- [ ] Autocomplete works

### **Week 4 (Android):**
- [ ] Generates Kotlin files
- [ ] Android team tests in Android Studio
- [ ] Compose integration works
- [ ] Theme switching works

### **Week 5 (Polish):**
- [ ] UI polished
- [ ] Documentation complete
- [ ] Beta testing done
- [ ] Ready for team rollout

---

## 💡 Pro Tips

### **Start Small**
1. Export **only color tokens** first
2. Add spacing/radius later
3. One platform at a time

### **Validate Early**
1. Use DEVELOPER_QUESTIONNAIRE.md
2. Share generated code samples
3. Get approval before building

### **Test with Real Data**
1. Use your actual `Light.tokens.json` and `Dark.tokens.json`
2. Test edge cases (opacity, aliases, nested tokens)
3. Compare output to RedBus patterns

### **Documentation is Key**
1. Generate README.md with usage examples
2. Include import instructions
3. Show before/after comparisons

---

## 🚀 Ready to Build?

### **Next Steps:**

1. **Read:** `TOKEN_SYNC_IMPLEMENTATION.md` (full spec)
2. **Validate:** Share output examples with dev team
3. **Start:** Phase 1 (Web export)
4. **Test:** With your actual token files
5. **Iterate:** Based on feedback

---

## 📞 Questions to Answer First

Before you start coding:

1. **Where do developers want the exported files?**
   - GitHub repo? Specific branch?
   - Copy-paste into project?
   - Direct download?

2. **What naming convention do they prefer?**
   - Kebab-case: `--text-primary`
   - Camel-case: `--textPrimary`
   - Custom prefix: `--ds-text-primary`

3. **Do they use Style Dictionary or similar?**
   - If yes, export DTCG JSON instead of code
   - If no, generate code directly

4. **What's their deployment process?**
   - Manual copy-paste?
   - PR to GitHub?
   - CI/CD pipeline?

**Use DEVELOPER_QUESTIONNAIRE.md to gather answers!**

---

## 🎉 Why This Will Be Awesome

### **Before (Manual):**
- Designer exports tokens → 30 min
- Developer updates CSS → 30 min
- Developer updates Swift → 30 min
- Developer updates Kotlin → 30 min
- Test on all platforms → 60 min
- Fix inconsistencies → 30 min
- **Total: 3-4 hours per token update**

### **After (Automated):**
- Designer clicks "Export" → 10 sec
- Developer reviews PR → 5 min
- Merge → 1 min
- **Total: 6 minutes per token update**

**You'll save 40x time and eliminate human error!** 🚀

---

**Let's build this!** Start with Phase 1 (Web export) and get immediate wins. 💪
