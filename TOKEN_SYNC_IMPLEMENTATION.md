# Design Token Sync Plugin - Implementation Guide

**Last Updated:** January 30, 2026  
**Status:** Ready for Development  
**Priority:** HIGH (Build this FIRST before AI audit plugin)

---

## 🎯 Overview

A Figma plugin that automatically exports your design tokens (Figma Variables) to production-ready code for Web, iOS, and Android platforms.

### **Why This Plugin First?**
1. ✅ **No AI complexity** - Straightforward data transformation
2. ✅ **Immediate value** - Eliminates manual token sync
3. ✅ **Foundation** - Other plugins will use these tokens
4. ✅ **Validated approach** - RedBus uses same pattern (see REDBUS_CSS_ANALYSIS.md)

---

## 📊 Input: Your Figma Variables

### **Current Token Structure:**

```
Figma Variables (Collections):
├── Value.tokens (Primitives)
│   ├── Integer/
│   │   ├── 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80
│   │   └── radius: 0, 4, 8, 12, 16, 20, 24, 999
│   ├── Colour/
│   │   ├── Neutral/0-100, 200-1000
│   │   ├── Red/100-900
│   │   ├── Blue/100-900
│   │   └── Green/100-900
│   └── Typography/
│       └── Font sizes, weights, line heights
│
└── Tokens/ (Semantic - Light/Dark modes)
    ├── 1. Colours/
    │   ├── Light.tokens.json
    │   └── Dark.tokens.json
    │       ├── Text/ (primary, secondary, tertiary, disabled)
    │       ├── Icon/ (primary, secondary, tertiary)
    │       ├── Stroke/ (weaker, weak, disabled, etc.)
    │       ├── Fill/ (component, brand, success, warning, error, info)
    │       └── Background/ (base, sunken, etc.)
    │
    └── 2. Radius and Spacing/
        ├── Android.tokens.json
        └── iOS.tokens.json
            ├── Spacing/ (aliases to Integer primitives)
            └── Radius/ (aliases to Integer primitives)
```

### **Key Characteristics:**
- ✅ DTCG-compliant JSON format
- ✅ Semantic naming (Text/primary not Grey/750)
- ✅ Light/Dark mode separation
- ✅ Alias references (`$aliasData`)
- ✅ Platform-specific exports ready

---

## 🎨 Output Formats

### **1. Web (CSS Custom Properties)**

**Target:** Modern web apps using CSS Modules (like RedBus)

#### **Format: Modern `light-dark()` Syntax**

```css
/* tokens/colors.css */
/* Auto-generated from Figma Variables - DO NOT EDIT */
/* Generated: 2026-01-30T17:30:00Z */

:root {
  /* ========================================
     TEXT COLORS
     ======================================== */
  
  --text-primary: light-dark(#1d1d1d, #fdfdfd);
  --text-secondary: light-dark(rgba(29, 29, 29, 0.69), rgba(253, 253, 253, 0.72));
  --text-tertiary: light-dark(rgba(29, 29, 29, 0.62), rgba(253, 253, 253, 0.64));
  --text-disabled: light-dark(rgba(29, 29, 29, 0.49), rgba(253, 253, 253, 0.50));
  
  /* ========================================
     ICON COLORS
     ======================================== */
  
  --icon-primary: light-dark(#1d1d1d, #fdfdfd);
  --icon-secondary: light-dark(rgba(29, 29, 29, 0.64), rgba(253, 253, 253, 0.72));
  --icon-tertiary: light-dark(rgba(29, 29, 29, 0.26), rgba(253, 253, 253, 0.26));
  
  /* ========================================
     BACKGROUND COLORS
     ======================================== */
  
  --background-base: light-dark(#ffffff, #18181b);
  --background-sunken: light-dark(#f2f2f8, #202023);
  
  /* ========================================
     FILL COLORS - Component
     ======================================== */
  
  --fill-component-primary: light-dark(#fdfdfd, #27272a);
  --fill-component-secondary: light-dark(#f9f9f9, #202023);
  --fill-component-tertiary: light-dark(#f9fafb, #18181b);
  --fill-component-hover: light-dark(rgba(29, 29, 29, 0.08), rgba(253, 253, 253, 0.08));
  
  /* ========================================
     FILL COLORS - Brand
     ======================================== */
  
  --fill-brand-primary: #d84e55;  /* Same in both modes */
  --fill-brand-secondary: light-dark(#fed9d5, #622726);
  --fill-brand-tertiary: light-dark(#fde6e5, #4c2b2a);
  
  /* ========================================
     FILL COLORS - Semantic
     ======================================== */
  
  --fill-success-primary: light-dark(#00a32b, #34d058);
  --fill-success-secondary: light-dark(#adf2b3, #1a4221);
  
  --fill-warning-primary: light-dark(#b14b00, #db946f);
  --fill-warning-secondary: light-dark(#fff4e5, #4a2b00);
  
  --fill-error-primary: light-dark(#cd2400, #f85149);
  --fill-error-secondary: light-dark(#ffebe9, #4a1d1a);
  
  --fill-info-primary: light-dark(#285bf3, #7da3f9);
  --fill-info-secondary: light-dark(#e6ebfc, #1e2a4a);
  
  /* ========================================
     STROKE COLORS
     ======================================== */
  
  --stroke-weaker: light-dark(#e6e6e6, #4b4b4b);
  --stroke-weak: light-dark(#b0b0b0, #b2b2b2);
  --stroke-disabled: light-dark(#e6e6e6, #4b4b4b);
  --stroke-error: light-dark(#cd2400, #db8574);
  
  /* ========================================
     STATIC COLORS (No dark mode variant)
     ======================================== */
  
  --fill-static-black: #1d1d1d;
  --fill-static-white: #ffffff;
  --fill-static-grey: #e6e6e6;
  
  /* ========================================
     SPACING (Improvement over RedBus)
     ======================================== */
  
  --spacing-0: 0px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-64: 64px;
  --spacing-80: 80px;
  
  /* ========================================
     BORDER RADIUS
     ======================================== */
  
  --radius-0: 0px;
  --radius-4: 4px;
  --radius-8: 8px;
  --radius-12: 12px;
  --radius-16: 16px;
  --radius-20: 20px;
  --radius-24: 24px;
  --radius-full: 9999px;
}

/* ========================================
   FALLBACK for browsers without light-dark()
   ======================================== */

@supports not (color: light-dark(red, blue)) {
  :root {
    /* Light mode defaults */
    --text-primary: #1d1d1d;
    --text-secondary: rgba(29, 29, 29, 0.69);
    --background-base: #ffffff;
    /* ... all other light mode values ... */
  }
  
  @media (prefers-color-scheme: dark) {
    :root {
      /* Dark mode overrides */
      --text-primary: #fdfdfd;
      --text-secondary: rgba(253, 253, 253, 0.72);
      --background-base: #18181b;
      /* ... all other dark mode values ... */
    }
  }
}
```

#### **Alternative: Legacy CSS (for older projects)**

```css
/* tokens/colors-legacy.css */
/* Auto-generated - Use @media queries for dark mode */

:root {
  /* Light mode (default) */
  --text-primary: #1d1d1d;
  --text-secondary: rgba(29, 29, 29, 0.69);
  /* ... */
}

@media (prefers-color-scheme: dark) {
  :root {
    /* Dark mode overrides */
    --text-primary: #fdfdfd;
    --text-secondary: rgba(253, 253, 253, 0.72);
    /* ... */
  }
}
```

---

### **2. Web (TypeScript/JavaScript for Storybook/React)**

**Target:** Component libraries, Storybook, React apps

```typescript
// tokens/colors.ts
// Auto-generated from Figma Variables - DO NOT EDIT
// Generated: 2026-01-30T17:30:00Z

/**
 * Design Tokens - Light Mode
 * Use these for light theme or static values
 */
export const colors = {
  text: {
    primary: '#1d1d1d',
    secondary: 'rgba(29, 29, 29, 0.69)',
    tertiary: 'rgba(29, 29, 29, 0.62)',
    disabled: 'rgba(29, 29, 29, 0.49)',
  },
  icon: {
    primary: '#1d1d1d',
    secondary: 'rgba(29, 29, 29, 0.64)',
    tertiary: 'rgba(29, 29, 29, 0.26)',
  },
  background: {
    base: '#ffffff',
    sunken: '#f2f2f8',
  },
  fill: {
    component: {
      primary: '#fdfdfd',
      secondary: '#f9f9f9',
      tertiary: '#f9fafb',
      hover: 'rgba(29, 29, 29, 0.08)',
    },
    brand: {
      primary: '#d84e55',
      secondary: '#fed9d5',
      tertiary: '#fde6e5',
    },
    success: {
      primary: '#00a32b',
      secondary: '#adf2b3',
    },
    warning: {
      primary: '#b14b00',
      secondary: '#fff4e5',
    },
    error: {
      primary: '#cd2400',
      secondary: '#ffebe9',
    },
    info: {
      primary: '#285bf3',
      secondary: '#e6ebfc',
    },
  },
  stroke: {
    weaker: '#e6e6e6',
    weak: '#b0b0b0',
    disabled: '#e6e6e6',
    error: '#cd2400',
  },
  static: {
    black: '#1d1d1d',
    white: '#ffffff',
    grey: '#e6e6e6',
  },
} as const;

/**
 * Design Tokens - Dark Mode
 * Use these for dark theme
 */
export const colorsDark = {
  text: {
    primary: '#fdfdfd',
    secondary: 'rgba(253, 253, 253, 0.72)',
    tertiary: 'rgba(253, 253, 253, 0.64)',
    disabled: 'rgba(253, 253, 253, 0.50)',
  },
  icon: {
    primary: '#fdfdfd',
    secondary: 'rgba(253, 253, 253, 0.72)',
    tertiary: 'rgba(253, 253, 253, 0.26)',
  },
  background: {
    base: '#18181b',
    sunken: '#202023',
  },
  fill: {
    component: {
      primary: '#27272a',
      secondary: '#202023',
      tertiary: '#18181b',
      hover: 'rgba(253, 253, 253, 0.08)',
    },
    brand: {
      primary: '#d84e55',
      secondary: '#622726',
      tertiary: '#4c2b2a',
    },
    success: {
      primary: '#34d058',
      secondary: '#1a4221',
    },
    warning: {
      primary: '#db946f',
      secondary: '#4a2b00',
    },
    error: {
      primary: '#f85149',
      secondary: '#4a1d1a',
    },
    info: {
      primary: '#7da3f9',
      secondary: '#1e2a4a',
    },
  },
  stroke: {
    weaker: '#4b4b4b',
    weak: '#b2b2b2',
    disabled: '#4b4b4b',
    error: '#db8574',
  },
  static: {
    black: '#1d1d1d',
    white: '#ffffff',
    grey: '#e6e6e6',
  },
} as const;

/**
 * Spacing tokens
 */
export const spacing = {
  0: 0,
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  40: 40,
  48: 48,
  64: 64,
  80: 80,
} as const;

/**
 * Border radius tokens
 */
export const radius = {
  0: 0,
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  full: 9999,
} as const;

/**
 * Type definitions
 */
export type ColorToken = typeof colors;
export type ColorTokenDark = typeof colorsDark;
export type SpacingToken = typeof spacing;
export type RadiusToken = typeof radius;

/**
 * Helper to get color by theme
 */
export const getColor = (
  path: string,
  theme: 'light' | 'dark' = 'light'
): string => {
  const tokens = theme === 'dark' ? colorsDark : colors;
  const keys = path.split('.');
  let value: any = tokens;
  
  for (const key of keys) {
    value = value[key];
    if (value === undefined) {
      throw new Error(`Token not found: ${path}`);
    }
  }
  
  return value as string;
};

// Usage examples:
// import { colors, spacing, radius } from '@/tokens';
// 
// const buttonStyle = {
//   color: colors.text.primary,
//   padding: `${spacing[16]}px`,
//   borderRadius: `${radius[8]}px`,
// };
```

---

### **3. iOS (Swift with Hybrid Approach)**

**Target:** SwiftUI apps with structured tokens + convenience

```swift
//
//  DesignTokens.swift
//  Auto-generated from Figma Variables - DO NOT EDIT
//  Generated: 2026-01-30T17:30:00Z
//

import SwiftUI

// MARK: - Design Tokens

enum DesignTokens {
    
    // MARK: - Colors
    
    enum Colors {
        
        enum Text {
            static let primary = ColorToken(
                light: Color(red: 0.114, green: 0.114, blue: 0.114),  // #1D1D1D
                dark: Color(red: 0.992, green: 0.992, blue: 0.992)    // #FDFDFD
            )
            static let secondary = ColorToken(
                light: Color(red: 0.114, green: 0.114, blue: 0.114, opacity: 0.69),
                dark: Color(red: 0.992, green: 0.992, blue: 0.992, opacity: 0.72)
            )
            static let tertiary = ColorToken(
                light: Color(red: 0.114, green: 0.114, blue: 0.114, opacity: 0.62),
                dark: Color(red: 0.992, green: 0.992, blue: 0.992, opacity: 0.64)
            )
            static let disabled = ColorToken(
                light: Color(red: 0.114, green: 0.114, blue: 0.114, opacity: 0.49),
                dark: Color(red: 0.992, green: 0.992, blue: 0.992, opacity: 0.50)
            )
        }
        
        enum Icon {
            static let primary = ColorToken(
                light: Color(red: 0.114, green: 0.114, blue: 0.114),
                dark: Color(red: 0.992, green: 0.992, blue: 0.992)
            )
            static let secondary = ColorToken(
                light: Color(red: 0.114, green: 0.114, blue: 0.114, opacity: 0.64),
                dark: Color(red: 0.992, green: 0.992, blue: 0.992, opacity: 0.72)
            )
            static let tertiary = ColorToken(
                light: Color(red: 0.114, green: 0.114, blue: 0.114, opacity: 0.26),
                dark: Color(red: 0.992, green: 0.992, blue: 0.992, opacity: 0.26)
            )
        }
        
        enum Background {
            static let base = ColorToken(
                light: Color(red: 1.0, green: 1.0, blue: 1.0),      // #FFFFFF
                dark: Color(red: 0.094, green: 0.094, blue: 0.106)  // #18181B
            )
            static let sunken = ColorToken(
                light: Color(red: 0.949, green: 0.949, blue: 0.973),  // #F2F2F8
                dark: Color(red: 0.125, green: 0.125, blue: 0.137)    // #202023
            )
        }
        
        enum Fill {
            enum Component {
                static let primary = ColorToken(
                    light: Color(red: 0.992, green: 0.992, blue: 0.992),  // #FDFDFD
                    dark: Color(red: 0.153, green: 0.153, blue: 0.165)    // #27272A
                )
                static let secondary = ColorToken(
                    light: Color(red: 0.976, green: 0.976, blue: 0.976),
                    dark: Color(red: 0.125, green: 0.125, blue: 0.137)
                )
                static let tertiary = ColorToken(
                    light: Color(red: 0.976, green: 0.980, blue: 0.984),
                    dark: Color(red: 0.094, green: 0.094, blue: 0.106)
                )
            }
            
            enum Brand {
                // Brand primary stays same in both modes
                static let primary = Color(red: 0.847, green: 0.306, blue: 0.333)  // #D84E55
                
                static let secondary = ColorToken(
                    light: Color(red: 0.996, green: 0.851, blue: 0.835),  // #FED9D5
                    dark: Color(red: 0.384, green: 0.153, blue: 0.149)    // #622726
                )
                static let tertiary = ColorToken(
                    light: Color(red: 0.992, green: 0.902, blue: 0.898),  // #FDE6E5
                    dark: Color(red: 0.298, green: 0.169, blue: 0.165)    // #4C2B2A
                )
            }
            
            enum Success {
                static let primary = ColorToken(
                    light: Color(red: 0.000, green: 0.639, blue: 0.169),  // #00A32B
                    dark: Color(red: 0.204, green: 0.816, blue: 0.345)    // #34D058
                )
                static let secondary = ColorToken(
                    light: Color(red: 0.678, green: 0.949, blue: 0.702),  // #ADF2B3
                    dark: Color(red: 0.102, green: 0.259, blue: 0.129)    // #1A4221
                )
            }
            
            enum Warning {
                static let primary = ColorToken(
                    light: Color(red: 0.694, green: 0.294, blue: 0.000),  // #B14B00
                    dark: Color(red: 0.859, green: 0.580, blue: 0.435)    // #DB946F
                )
            }
            
            enum Error {
                static let primary = ColorToken(
                    light: Color(red: 0.804, green: 0.141, blue: 0.000),  // #CD2400
                    dark: Color(red: 0.973, green: 0.318, blue: 0.286)    // #F85149
                )
            }
            
            enum Info {
                static let primary = ColorToken(
                    light: Color(red: 0.157, green: 0.357, blue: 0.953),  // #285BF3
                    dark: Color(red: 0.490, green: 0.639, blue: 0.976)    // #7DA3F9
                )
            }
        }
        
        enum Stroke {
            static let weaker = ColorToken(
                light: Color(red: 0.902, green: 0.902, blue: 0.902),  // #E6E6E6
                dark: Color(red: 0.294, green: 0.294, blue: 0.294)    // #4B4B4B
            )
            static let weak = ColorToken(
                light: Color(red: 0.690, green: 0.690, blue: 0.690),  // #B0B0B0
                dark: Color(red: 0.698, green: 0.698, blue: 0.698)    // #B2B2B2
            )
            static let disabled = ColorToken(
                light: Color(red: 0.902, green: 0.902, blue: 0.902),
                dark: Color(red: 0.294, green: 0.294, blue: 0.294)
            )
            static let error = ColorToken(
                light: Color(red: 0.804, green: 0.141, blue: 0.000),
                dark: Color(red: 0.859, green: 0.518, blue: 0.455)
            )
        }
        
        enum Static {
            // These don't change with theme
            static let black = Color(red: 0.114, green: 0.114, blue: 0.114)  // #1D1D1D
            static let white = Color(red: 1.0, green: 1.0, blue: 1.0)        // #FFFFFF
            static let grey = Color(red: 0.902, green: 0.902, blue: 0.902)   // #E6E6E6
        }
    }
    
    // MARK: - Spacing
    
    enum Spacing {
        static let spacing0: CGFloat = 0
        static let spacing4: CGFloat = 4
        static let spacing8: CGFloat = 8
        static let spacing12: CGFloat = 12
        static let spacing16: CGFloat = 16
        static let spacing20: CGFloat = 20
        static let spacing24: CGFloat = 24
        static let spacing32: CGFloat = 32
        static let spacing40: CGFloat = 40
        static let spacing48: CGFloat = 48
        static let spacing64: CGFloat = 64
        static let spacing80: CGFloat = 80
    }
    
    // MARK: - Border Radius
    
    enum Radius {
        static let radius0: CGFloat = 0
        static let radius4: CGFloat = 4
        static let radius8: CGFloat = 8
        static let radius12: CGFloat = 12
        static let radius16: CGFloat = 16
        static let radius20: CGFloat = 20
        static let radius24: CGFloat = 24
        static let radiusFull: CGFloat = 9999
    }
}

// MARK: - Color Token (Light/Dark Mode Support)

struct ColorToken {
    let light: Color
    let dark: Color
    
    /// Returns the appropriate color based on the current color scheme
    var color: Color {
        Color(UIColor { traitCollection in
            traitCollection.userInterfaceStyle == .dark ?
                UIColor(self.dark) : UIColor(self.light)
        })
    }
}

// MARK: - Convenience Extensions

extension Color {
    
    // MARK: Text Colors
    
    static var textPrimary: Color {
        DesignTokens.Colors.Text.primary.color
    }
    
    static var textSecondary: Color {
        DesignTokens.Colors.Text.secondary.color
    }
    
    static var textTertiary: Color {
        DesignTokens.Colors.Text.tertiary.color
    }
    
    static var textDisabled: Color {
        DesignTokens.Colors.Text.disabled.color
    }
    
    // MARK: Icon Colors
    
    static var iconPrimary: Color {
        DesignTokens.Colors.Icon.primary.color
    }
    
    static var iconSecondary: Color {
        DesignTokens.Colors.Icon.secondary.color
    }
    
    static var iconTertiary: Color {
        DesignTokens.Colors.Icon.tertiary.color
    }
    
    // MARK: Background Colors
    
    static var backgroundBase: Color {
        DesignTokens.Colors.Background.base.color
    }
    
    static var backgroundSunken: Color {
        DesignTokens.Colors.Background.sunken.color
    }
    
    // MARK: Fill Colors
    
    static var fillComponentPrimary: Color {
        DesignTokens.Colors.Fill.Component.primary.color
    }
    
    static var fillComponentSecondary: Color {
        DesignTokens.Colors.Fill.Component.secondary.color
    }
    
    static var fillBrandPrimary: Color {
        DesignTokens.Colors.Fill.Brand.primary
    }
    
    static var fillBrandSecondary: Color {
        DesignTokens.Colors.Fill.Brand.secondary.color
    }
    
    static var fillSuccessPrimary: Color {
        DesignTokens.Colors.Fill.Success.primary.color
    }
    
    static var fillWarningPrimary: Color {
        DesignTokens.Colors.Fill.Warning.primary.color
    }
    
    static var fillErrorPrimary: Color {
        DesignTokens.Colors.Fill.Error.primary.color
    }
    
    static var fillInfoPrimary: Color {
        DesignTokens.Colors.Fill.Info.primary.color
    }
    
    // MARK: Stroke Colors
    
    static var strokeWeaker: Color {
        DesignTokens.Colors.Stroke.weaker.color
    }
    
    static var strokeWeak: Color {
        DesignTokens.Colors.Stroke.weak.color
    }
    
    static var strokeDisabled: Color {
        DesignTokens.Colors.Stroke.disabled.color
    }
    
    static var strokeError: Color {
        DesignTokens.Colors.Stroke.error.color
    }
    
    // MARK: Static Colors
    
    static var staticBlack: Color {
        DesignTokens.Colors.Static.black
    }
    
    static var staticWhite: Color {
        DesignTokens.Colors.Static.white
    }
    
    static var staticGrey: Color {
        DesignTokens.Colors.Static.grey
    }
}

// MARK: - Usage Examples

#if DEBUG
struct DesignTokens_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: DesignTokens.Spacing.spacing16) {
            Text("Welcome")
                .font(.largeTitle)
                .foregroundColor(.textPrimary)
            
            Text("This uses design tokens")
                .foregroundColor(.textSecondary)
            
            Button("Continue") {
                // action
            }
            .foregroundColor(.staticWhite)
            .padding(DesignTokens.Spacing.spacing16)
            .background(.fillBrandPrimary)
            .cornerRadius(DesignTokens.Radius.radius8)
        }
        .padding(DesignTokens.Spacing.spacing24)
        .background(.backgroundBase)
    }
}
#endif
```

---

### **4. Android (Kotlin + Jetpack Compose)**

**Target:** Modern Android apps using Compose

```kotlin
// design/tokens/DesignTokens.kt
// Auto-generated from Figma Variables - DO NOT EDIT
// Generated: 2026-01-30T17:30:00Z

package com.yourapp.design.tokens

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Design Tokens
 * 
 * Organized structure matching Figma Variables.
 * Use the convenience extensions in ColorScheme+Tokens.kt for theme-aware colors.
 */
object DesignTokens {
    
    /**
     * Color tokens organized by category
     */
    object Colors {
        
        object Text {
            val primary = ColorToken(
                light = Color(0xFF1D1D1D),
                dark = Color(0xFFFDFDFD)
            )
            val secondary = ColorToken(
                light = Color(0xB01D1D1D),  // 0.69 alpha
                dark = Color(0xB8FDFDFD)   // 0.72 alpha
            )
            val tertiary = ColorToken(
                light = Color(0x9E1D1D1D),  // 0.62 alpha
                dark = Color(0xA3FDFDFD)   // 0.64 alpha
            )
            val disabled = ColorToken(
                light = Color(0x7D1D1D1D),  // 0.49 alpha
                dark = Color(0x80FDFDFD)   // 0.50 alpha
            )
        }
        
        object Icon {
            val primary = ColorToken(
                light = Color(0xFF1D1D1D),
                dark = Color(0xFFFDFDFD)
            )
            val secondary = ColorToken(
                light = Color(0xA31D1D1D),  // 0.64 alpha
                dark = Color(0xB8FDFDFD)   // 0.72 alpha
            )
            val tertiary = ColorToken(
                light = Color(0x421D1D1D),  // 0.26 alpha
                dark = Color(0x42FDFDFD)   // 0.26 alpha
            )
        }
        
        object Background {
            val base = ColorToken(
                light = Color(0xFFFFFFFF),
                dark = Color(0xFF18181B)
            )
            val sunken = ColorToken(
                light = Color(0xFFF2F2F8),
                dark = Color(0xFF202023)
            )
        }
        
        object Fill {
            object Component {
                val primary = ColorToken(
                    light = Color(0xFFFDFDFD),
                    dark = Color(0xFF27272A)
                )
                val secondary = ColorToken(
                    light = Color(0xFFF9F9F9),
                    dark = Color(0xFF202023)
                )
                val tertiary = ColorToken(
                    light = Color(0xFFF9FAFB),
                    dark = Color(0xFF18181B)
                )
                val hover = ColorToken(
                    light = Color(0x141D1D1D),  // 0.08 alpha
                    dark = Color(0x14FDFDFD)   // 0.08 alpha
                )
            }
            
            object Brand {
                // Brand primary is same in both themes
                val primary = Color(0xFFD84E55)
                
                val secondary = ColorToken(
                    light = Color(0xFFFED9D5),
                    dark = Color(0xFF622726)
                )
                val tertiary = ColorToken(
                    light = Color(0xFFFDE6E5),
                    dark = Color(0xFF4C2B2A)
                )
            }
            
            object Success {
                val primary = ColorToken(
                    light = Color(0xFF00A32B),
                    dark = Color(0xFF34D058)
                )
                val secondary = ColorToken(
                    light = Color(0xFFADF2B3),
                    dark = Color(0xFF1A4221)
                )
            }
            
            object Warning {
                val primary = ColorToken(
                    light = Color(0xFFB14B00),
                    dark = Color(0xFFDB946F)
                )
                val secondary = ColorToken(
                    light = Color(0xFFFFF4E5),
                    dark = Color(0xFF4A2B00)
                )
            }
            
            object Error {
                val primary = ColorToken(
                    light = Color(0xFFCD2400),
                    dark = Color(0xFFF85149)
                )
                val secondary = ColorToken(
                    light = Color(0xFFFFEBE9),
                    dark = Color(0xFF4A1D1A)
                )
            }
            
            object Info {
                val primary = ColorToken(
                    light = Color(0xFF285BF3),
                    dark = Color(0xFF7DA3F9)
                )
                val secondary = ColorToken(
                    light = Color(0xFFE6EBFC),
                    dark = Color(0xFF1E2A4A)
                )
            }
        }
        
        object Stroke {
            val weaker = ColorToken(
                light = Color(0xFFE6E6E6),
                dark = Color(0xFF4B4B4B)
            )
            val weak = ColorToken(
                light = Color(0xFFB0B0B0),
                dark = Color(0xFFB2B2B2)
            )
            val disabled = ColorToken(
                light = Color(0xFFE6E6E6),
                dark = Color(0xFF4B4B4B)
            )
            val error = ColorToken(
                light = Color(0xFFCD2400),
                dark = Color(0xFFDB8574)
            )
        }
        
        object Static {
            val black = Color(0xFF1D1D1D)
            val white = Color(0xFFFFFFFF)
            val grey = Color(0xFFE6E6E6)
        }
    }
    
    /**
     * Spacing tokens
     */
    object Spacing {
        val spacing0: Dp = 0.dp
        val spacing4: Dp = 4.dp
        val spacing8: Dp = 8.dp
        val spacing12: Dp = 12.dp
        val spacing16: Dp = 16.dp
        val spacing20: Dp = 20.dp
        val spacing24: Dp = 24.dp
        val spacing32: Dp = 32.dp
        val spacing40: Dp = 40.dp
        val spacing48: Dp = 48.dp
        val spacing64: Dp = 64.dp
        val spacing80: Dp = 80.dp
    }
    
    /**
     * Border radius tokens
     */
    object Radius {
        val radius0: Dp = 0.dp
        val radius4: Dp = 4.dp
        val radius8: Dp = 8.dp
        val radius12: Dp = 12.dp
        val radius16: Dp = 16.dp
        val radius20: Dp = 20.dp
        val radius24: Dp = 24.dp
        val radiusFull: Dp = 9999.dp
    }
}

/**
 * Color token with light/dark variants
 */
data class ColorToken(
    val light: Color,
    val dark: Color
)

/**
 * Get the appropriate color based on current theme
 */
fun ColorToken.resolve(isDark: Boolean): Color {
    return if (isDark) dark else light
}
```

```kotlin
// design/tokens/ColorScheme+Tokens.kt
// Convenience extensions for Material3 ColorScheme

package com.yourapp.design.tokens

import androidx.compose.material3.ColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * Convenience extensions to access design tokens from ColorScheme
 */

// Text colors
val ColorScheme.textPrimary: Color
    @Composable get() = DesignTokens.Colors.Text.primary.resolve(isSystemInDarkTheme())

val ColorScheme.textSecondary: Color
    @Composable get() = DesignTokens.Colors.Text.secondary.resolve(isSystemInDarkTheme())

val ColorScheme.textTertiary: Color
    @Composable get() = DesignTokens.Colors.Text.tertiary.resolve(isSystemInDarkTheme())

// Icon colors
val ColorScheme.iconPrimary: Color
    @Composable get() = DesignTokens.Colors.Icon.primary.resolve(isSystemInDarkTheme())

val ColorScheme.iconSecondary: Color
    @Composable get() = DesignTokens.Colors.Icon.secondary.resolve(isSystemInDarkTheme())

// Background colors
val ColorScheme.backgroundBase: Color
    @Composable get() = DesignTokens.Colors.Background.base.resolve(isSystemInDarkTheme())

val ColorScheme.backgroundSunken: Color
    @Composable get() = DesignTokens.Colors.Background.sunken.resolve(isSystemInDarkTheme())

// Fill colors
val ColorScheme.fillComponentPrimary: Color
    @Composable get() = DesignTokens.Colors.Fill.Component.primary.resolve(isSystemInDarkTheme())

val ColorScheme.fillBrandPrimary: Color
    get() = DesignTokens.Colors.Fill.Brand.primary

val ColorScheme.fillBrandSecondary: Color
    @Composable get() = DesignTokens.Colors.Fill.Brand.secondary.resolve(isSystemInDarkTheme())

// Stroke colors
val ColorScheme.strokeWeaker: Color
    @Composable get() = DesignTokens.Colors.Stroke.weaker.resolve(isSystemInDarkTheme())

val ColorScheme.strokeWeak: Color
    @Composable get() = DesignTokens.Colors.Stroke.weak.resolve(isSystemInDarkTheme())

// Static colors
val ColorScheme.staticBlack: Color
    get() = DesignTokens.Colors.Static.black

val ColorScheme.staticWhite: Color
    get() = DesignTokens.Colors.Static.white
```

```kotlin
// Usage example
@Composable
fun WelcomeScreen() {
    val colorScheme = MaterialTheme.colorScheme
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colorScheme.backgroundBase)
            .padding(DesignTokens.Spacing.spacing24),
        verticalArrangement = Arrangement.spacedBy(DesignTokens.Spacing.spacing16)
    ) {
        Text(
            text = "Welcome",
            style = MaterialTheme.typography.headlineLarge,
            color = colorScheme.textPrimary
        )
        
        Text(
            text = "Get started below",
            color = colorScheme.textSecondary
        )
        
        Button(
            onClick = { /* action */ },
            colors = ButtonDefaults.buttonColors(
                containerColor = colorScheme.fillBrandPrimary,
                contentColor = colorScheme.staticWhite
            ),
            shape = RoundedCornerShape(DesignTokens.Radius.radius8)
        ) {
            Text("Continue")
        }
    }
}
```

---

## 🏗️ Plugin Architecture

### **File Structure:**

```
figma-token-sync/
├── manifest.json
├── package.json
├── tsconfig.json
├── src/
│   ├── plugin/
│   │   ├── main.ts                  # Plugin entry point
│   │   ├── tokenReader.ts           # Read Figma Variables
│   │   ├── transformers/
│   │   │   ├── web.ts              # Transform to CSS/TS
│   │   │   ├── ios.ts              # Transform to Swift
│   │   │   └── android.ts          # Transform to Kotlin
│   │   └── utils/
│   │       ├── colorConverter.ts   # Hex/RGB/Color conversions
│   │       └── fileGenerator.ts    # Generate file content
│   └── ui/
│       ├── App.tsx                  # Main UI
│       ├── components/
│       │   ├── TokenPreview.tsx    # Preview tokens before export
│       │   ├── PlatformSelector.tsx # Select platforms to export
│       │   └── ExportOptions.tsx   # Export format options
│       └── styles/
│           └── main.css
└── output/                          # Generated files (user downloads)
    ├── web/
    │   ├── colors.css
    │   ├── colors.ts
    │   └── README.md
    ├── ios/
    │   ├── DesignTokens.swift
    │   └── README.md
    └── android/
        ├── DesignTokens.kt
        ├── ColorScheme+Tokens.kt
        └── README.md
```

---

## 🔧 Core Implementation Logic

### **1. Read Figma Variables**

```typescript
// src/plugin/tokenReader.ts

interface TokenCollection {
  id: string;
  name: string;
  modes: TokenMode[];
  variables: Variable[];
}

interface Variable {
  id: string;
  name: string;
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  valuesByMode: Record<string, VariableValue>;
}

interface VariableValue {
  type: 'VARIABLE_ALIAS' | 'FLOAT' | 'COLOR';
  value: RGB | number | string | VariableAlias;
}

export async function readTokens(): Promise<TokenCollection[]> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const result: TokenCollection[] = [];
  
  for (const collection of collections) {
    const variables = await Promise.all(
      collection.variableIds.map(id => figma.variables.getVariableByIdAsync(id))
    );
    
    result.push({
      id: collection.id,
      name: collection.name,
      modes: collection.modes,
      variables: variables.filter((v): v is Variable => v !== null)
    });
  }
  
  return result;
}
```

### **2. Transform to Web (CSS)**

```typescript
// src/plugin/transformers/web.ts

export function generateCSS(tokens: TokenCollection[]): string {
  const lines: string[] = [];
  
  // Header
  lines.push('/* Auto-generated from Figma Variables - DO NOT EDIT */');
  lines.push(`/* Generated: ${new Date().toISOString()} */`);
  lines.push('');
  lines.push(':root {');
  
  // Find light and dark modes
  const colorCollection = tokens.find(c => c.name.includes('Colour'));
  const lightMode = colorCollection?.modes.find(m => m.name === 'Light');
  const darkMode = colorCollection?.modes.find(m => m.name === 'Dark');
  
  if (!lightMode || !darkMode) {
    throw new Error('Light and Dark modes not found');
  }
  
  // Generate color tokens with light-dark()
  for (const variable of colorCollection.variables) {
    const path = variable.name.split('/').map(toCSSCase).join('-');
    const lightValue = resolveValue(variable.valuesByMode[lightMode.modeId]);
    const darkValue = resolveValue(variable.valuesByMode[darkMode.modeId]);
    
    lines.push(`  --${path}: light-dark(${lightValue}, ${darkValue});`);
  }
  
  lines.push('}');
  
  return lines.join('\n');
}

function toCSSCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
}

function resolveValue(value: VariableValue): string {
  if (value.type === 'COLOR') {
    const rgb = value.value as RGB;
    return rgbToHex(rgb);
  }
  if (value.type === 'FLOAT') {
    return `${value.value}px`;
  }
  if (value.type === 'VARIABLE_ALIAS') {
    // Resolve alias
    const aliasVariable = figma.variables.getVariableById(value.value.id);
    return resolveValue(aliasVariable.valuesByMode[value.value.modeId]);
  }
  return String(value.value);
}
```

### **3. Transform to iOS (Swift)**

```typescript
// src/plugin/transformers/ios.ts

export function generateSwift(tokens: TokenCollection[]): string {
  const lines: string[] = [];
  
  lines.push('//');
  lines.push('//  DesignTokens.swift');
  lines.push('//  Auto-generated from Figma Variables - DO NOT EDIT');
  lines.push(`//  Generated: ${new Date().toISOString()}`);
  lines.push('//');
  lines.push('');
  lines.push('import SwiftUI');
  lines.push('');
  lines.push('enum DesignTokens {');
  lines.push('    enum Colors {');
  
  // Group tokens by category
  const categories = groupByCategory(tokens);
  
  for (const [category, variables] of Object.entries(categories)) {
    lines.push(`        enum ${category} {`);
    
    for (const variable of variables) {
      const name = variable.name.split('/').pop();
      const lightValue = resolveColorForSwift(variable, 'Light');
      const darkValue = resolveColorForSwift(variable, 'Dark');
      
      lines.push(`            static let ${toCamelCase(name)} = ColorToken(`);
      lines.push(`                light: ${lightValue},`);
      lines.push(`                dark: ${darkValue}`);
      lines.push(`            )`);
    }
    
    lines.push(`        }`);
  }
  
  lines.push('    }');
  lines.push('}');
  
  // Add ColorToken struct
  lines.push('');
  lines.push('struct ColorToken {');
  lines.push('    let light: Color');
  lines.push('    let dark: Color');
  lines.push('    ');
  lines.push('    var color: Color {');
  lines.push('        Color(UIColor { traitCollection in');
  lines.push('            traitCollection.userInterfaceStyle == .dark ?');
  lines.push('                UIColor(self.dark) : UIColor(self.light)');
  lines.push('        })');
  lines.push('    }');
  lines.push('}');
  
  return lines.join('\n');
}

function resolveColorForSwift(variable: Variable, mode: string): string {
  const rgb = resolveColorValue(variable, mode);
  const r = (rgb.r).toFixed(3);
  const g = (rgb.g).toFixed(3);
  const b = (rgb.b).toFixed(3);
  
  if (rgb.a < 1) {
    return `Color(red: ${r}, green: ${g}, blue: ${b}, opacity: ${rgb.a.toFixed(2)})`;
  }
  return `Color(red: ${r}, green: ${g}, blue: ${b})`;
}
```

---

## 🚀 Development Roadmap

### **Phase 1: MVP (Week 1-2)**

**Goal:** Export Web tokens only (CSS + TypeScript)

**Tasks:**
- [ ] Set up Figma plugin boilerplate
- [ ] Implement `tokenReader.ts` to read Figma Variables
- [ ] Build Web transformer (CSS with `light-dark()`)
- [ ] Build Web transformer (TypeScript)
- [ ] Create basic UI (select collections, export button)
- [ ] Generate downloadable ZIP file
- [ ] Test with your actual tokens

**Deliverable:** Plugin that exports Web tokens

---

### **Phase 2: iOS Support (Week 3)**

**Goal:** Add iOS Swift generation

**Tasks:**
- [ ] Build iOS transformer (Swift hybrid approach)
- [ ] Generate ColorToken struct
- [ ] Generate convenience extensions
- [ ] Add platform selector UI
- [ ] Test with iOS project

**Deliverable:** Plugin that exports Web + iOS

---

### **Phase 3: Android Support (Week 4)**

**Goal:** Add Android Kotlin/Compose generation

**Tasks:**
- [ ] Build Android transformer (Kotlin)
- [ ] Generate ColorToken data class
- [ ] Generate ColorScheme extensions
- [ ] Test with Android project

**Deliverable:** Full multi-platform token sync

---

### **Phase 4: Polish & Features (Week 5)**

**Goal:** Production-ready plugin

**Tasks:**
- [ ] Add token preview before export
- [ ] Custom naming conventions
- [ ] Export to GitHub directly (optional)
- [ ] Documentation generation
- [ ] Error handling
- [ ] Beta testing

**Deliverable:** Production plugin ready for team

---

## 🎯 Success Metrics

### **Immediate Value:**
- ✅ Eliminates manual token updates (saves 2-4 hours/week)
- ✅ Zero design-dev token drift
- ✅ One-click multi-platform export

### **Quality:**
- ✅ Generated code matches RedBus production patterns
- ✅ Light/Dark mode works correctly on all platforms
- ✅ Type-safe tokens with autocomplete
- ✅ Clean, readable generated code

### **Adoption:**
- ✅ Web team uses exported CSS
- ✅ iOS team uses exported Swift
- ✅ Android team uses exported Kotlin
- ✅ Becomes primary source of truth

---

## 📝 Next Steps

1. **Review this plan** with your team
2. **Validate output formats** with developers (use DEVELOPER_QUESTIONNAIRE.md)
3. **Start Phase 1** (Web export only)
4. **Test with real tokens** (your existing JSON files)
5. **Iterate based on feedback**

---

**This plugin will save your team hours every week and eliminate token sync issues completely!** 🎉

Ready to start building? Let me know which phase you want to tackle first! 🚀
