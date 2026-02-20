# Developer Questionnaire - Token Sync Plugin

**Purpose:** Gather requirements from Web, Android, and iOS teams before building the multi-platform token sync plugin.

**Date:** _____________  
**Interviewer:** _____________

---

## 🌐 Web Team

**Respondent Name:** _____________  
**Role:** _____________

### Current Setup

**1. Where do you currently keep design tokens/CSS variables?**
- File path: _____________________________________________
- Example: `src/styles/design-system/tokens.css`

**2. What format do you use?**
- [ ] CSS Custom Properties (`:root { --color-purple: #ECE9FC; }`)
- [ ] SCSS/SASS variables (`$color-purple: #ECE9FC;`)
- [ ] Tailwind configuration (`theme: { colors: { purple: '#ECE9FC' }}`)
- [ ] CSS-in-JS (styled-components, emotion, etc.)
- [ ] JavaScript/TypeScript constants
- [ ] Other: _____________

**3. What's your naming convention?**
Examples:
- `--color-purple-50` vs `$purple-50` vs `colors.purple.50`
- `--spacing-1` vs `$space-xs` vs `spacing[1]`

Your convention: _____________________________________________

**4. Do you use any existing token/styling tools?**
- [ ] Style Dictionary
- [ ] Tailwind CSS
- [ ] PostCSS
- [ ] None
- [ ] Other: _____________

### Preferences

**5. How would you prefer to receive token updates?**
- [ ] **Copy-paste code snippets** (simplest, I paste into my file)
- [ ] **GitHub PR with auto-updated files** (automated, I just review and merge)
- [ ] **Download ZIP file** (I download and manually integrate)
- [ ] **Style Dictionary JSON** (I run build command to generate final files)
- [ ] **Hosted download portal** (I download from a webpage)
- [ ] Other: _____________

**6. How often do design tokens change?**
- [ ] Multiple times per day
- [ ] Daily
- [ ] Weekly
- [ ] Monthly
- [ ] Rarely (quarterly or less)

**7. Any specific requirements or edge cases?**
Examples: theming (light/dark), multiple brands, CSS Modules support, etc.

_____________________________________________
_____________________________________________
_____________________________________________

---

## 🤖 Android Team

**Respondent Name:** _____________  
**Role:** _____________

### Current Setup

**1. Where do you keep colors/dimensions?**
- File path: _____________________________________________
- Example: `app/src/main/res/values/colors.xml`

**2. What format do you use?**
- [ ] **XML resources only** (`colors.xml`, `dimens.xml`)
- [ ] **Jetpack Compose only** (Kotlin objects with Color/Dp)
- [ ] **Both XML and Compose** (in transition or supporting both)
- [ ] Other: _____________

**3. What's your naming convention?**
Examples:
- XML: `<color name="purple_50">` vs `<color name="color_purple_50">`
- Compose: `val Purple50` vs `val purple50` vs `val colorPurple50`

Your convention: _____________________________________________

**4. File organization?**
- Single `colors.xml` or multiple files (`colors_purple.xml`, `colors_red.xml`)?
- Multiple modules/feature folders?

_____________________________________________

### Preferences

**5. How would you prefer to receive token updates?**
- [ ] Copy-paste code snippets
- [ ] GitHub PR with auto-updated files
- [ ] Download ZIP file
- [ ] Style Dictionary (you run build)
- [ ] Hosted download portal
- [ ] Other: _____________

**6. Do you need separate files for light/dark themes?**
- [ ] Yes - need `values/colors.xml` and `values-night/colors.xml`
- [ ] No - single theme only
- [ ] We handle theming differently: _____________

**7. How often do tokens change?**
- [ ] Multiple times per day
- [ ] Daily
- [ ] Weekly
- [ ] Monthly
- [ ] Rarely

**8. Any Android-specific requirements?**
Examples: Material Design 3 compatibility, vector drawable colors, etc.

_____________________________________________
_____________________________________________

---

## 🍎 iOS Team

**Respondent Name:** _____________  
**Role:** _____________

### Current Setup

**1. Where do you keep design tokens?**
- File path in Xcode project: _____________________________________________
- Example: `DesignSystem/Sources/Tokens/Colors.swift`

**2. What format do you use?**
- [ ] **Swift structs/enums** (`struct Colors { static let purple50 = Color(...)`)
- [ ] **SwiftUI Color extensions** (`extension Color { static let purple50 = ... }`)
- [ ] **UIKit UIColor extensions** (`extension UIColor { static let purple50 = ... }`)
- [ ] **Asset catalog colors** (Colors.xcassets)
- [ ] Both SwiftUI and UIKit
- [ ] Other: _____________

**3. What's your naming convention?**
Examples:
- `Color.purple50` vs `Color.Purple.shade50` vs `Colors.purple50`
- `Spacing.small` vs `Spacing.spacing1` vs `Layout.space1`

Your convention: _____________________________________________

**4. Project structure?**
- Swift Package? Framework? Main app target?
- Multiple modules?

_____________________________________________

### Preferences

**5. How would you prefer to receive token updates?**
- [ ] Copy-paste code snippets
- [ ] GitHub PR with auto-updated files
- [ ] Download ZIP file
- [ ] Style Dictionary (you run build)
- [ ] Hosted download portal
- [ ] Other: _____________

**6. Do you need separate light/dark mode support?**
- [ ] Yes - need dynamic colors for light/dark mode
- [ ] No - single appearance only
- [ ] We handle it differently: _____________

**7. How often do tokens change?**
- [ ] Multiple times per day
- [ ] Daily
- [ ] Weekly
- [ ] Monthly
- [ ] Rarely

**8. Any iOS-specific requirements?**
Examples: UIKit compatibility, SF Symbols integration, semantic colors, etc.

_____________________________________________
_____________________________________________

---

## 🎯 General Questions (All Teams)

**1. What's the BIGGEST pain point with the current manual token update process?**

_____________________________________________
_____________________________________________
_____________________________________________

**2. Would you be willing to beta test a plugin in 2-3 weeks?**
- [ ] Yes, definitely
- [ ] Maybe, depends on timing
- [ ] No, too busy
- [ ] After we finish [project]: _____________

**3. Do you currently use any token management tools?**
- [ ] Style Dictionary
- [ ] Theo
- [ ] Figma Tokens plugin
- [ ] Design Tokens Studio
- [ ] Custom scripts
- [ ] None
- [ ] Other: _____________

**4. Is there anything about the current Figma tokens that doesn't work for your platform?**

Examples: Wrong color format, missing values, naming issues, etc.

_____________________________________________
_____________________________________________
_____________________________________________

**5. If you could have ONE feature in a token sync plugin, what would it be?**

_____________________________________________
_____________________________________________

**6. Any concerns or potential blockers for adopting automated token sync?**

Examples: CI/CD compatibility, review process, file ownership, etc.

_____________________________________________
_____________________________________________

---

## 📊 Priority Assessment

Based on responses, rank these features by importance (1 = most important, 5 = least important):

- [ ] **Accuracy** - Generated tokens must match our exact format
- [ ] **Speed** - Updates should take <30 seconds
- [ ] **Automation** - Minimal manual steps (GitHub integration)
- [ ] **Flexibility** - Configurable paths and formats
- [ ] **Reliability** - Never breaks our build or CI/CD

---

## 🎯 Summary & Next Steps

**Key Findings:**
- ____________________________________________
- ____________________________________________
- ____________________________________________

**Recommended Approach:**
- [ ] Start with copy-paste MVP (simplest, 2 weeks)
- [ ] Build GitHub integration (automated, 3-4 weeks)
- [ ] Use Style Dictionary (flexible, 2-3 weeks)
- [ ] Custom solution needed: _____________

**Timeline:**
- Week 1-2: _____________________________________________
- Week 3-4: _____________________________________________

**Next Steps:**
1. _____________________________________________
2. _____________________________________________
3. _____________________________________________

---

## 📝 Notes

Additional context, edge cases, or important details:

_____________________________________________
_____________________________________________
_____________________________________________
_____________________________________________
_____________________________________________

---

**Interview completed:** _____ / _____ / _____  
**Follow-up needed:** [ ] Yes [ ] No  
**Follow-up notes:** _____________________________________________
