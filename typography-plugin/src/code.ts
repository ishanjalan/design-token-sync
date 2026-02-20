// Typography Token Exporter Plugin
// Extracts Text Styles from Figma and exports as DTCG-compliant JSON

interface TypographyToken {
  $type: 'typography';
  $value: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    lineHeight: number | string;
    letterSpacing: number;
  };
  $extensions?: {
    'com.figma.styleId': string;
    'com.figma.styleName': string;
  };
}

interface TypographyExport {
  typography: Record<string, TypographyToken>;
  $extensions?: {
    exportedAt: string;
    figmaFileKey: string;
  };
}

// Show UI
figma.showUI(__html__, { width: 400, height: 300 });

// Handle messages from UI
figma.ui.onmessage = async (msg: { type: string }) => {
  if (msg.type === 'export-typography') {
    try {
      const typography = await exportTypography();
      figma.ui.postMessage({
        type: 'export-complete',
        data: typography
      });
    } catch (error) {
      figma.ui.postMessage({
        type: 'export-error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};

/**
 * Main export function - extracts all local text styles
 */
async function exportTypography(): Promise<TypographyExport> {
  const textStyles = figma.getLocalTextStyles();
  const typography: Record<string, TypographyToken> = {};

  for (const style of textStyles) {
    // Skip mixed font families (shouldn't happen in well-maintained design systems)
    if (typeof style.fontName === 'symbol') {
      console.warn(`Skipping style "${style.name}" - mixed font family`);
      continue;
    }
    
    const fontName = style.fontName;

    typography[style.name] = {
      $type: 'typography',
      $value: {
        fontFamily: fontName.family,
        fontSize: getFontSize(style.fontSize),
        fontWeight: getFontWeight(fontName.style),
        lineHeight: getLineHeight(style.lineHeight, style.fontSize as number),
        letterSpacing: getLetterSpacing(style.letterSpacing)
      },
      $extensions: {
        'com.figma.styleId': style.id,
        'com.figma.styleName': style.name
      }
    };
  }

  return {
    typography,
    $extensions: {
      exportedAt: new Date().toISOString(),
      figmaFileKey: figma.fileKey || 'unknown'
    }
  };
}

/**
 * Get font size - handle mixed values
 */
function getFontSize(fontSize: number | symbol): number {
  if (typeof fontSize === 'symbol') {
    console.warn('Mixed font size detected, defaulting to 16');
    return 16;
  }
  return fontSize;
}

/**
 * Map Figma font style names to numeric weights
 */
function getFontWeight(fontStyle: string): number {
  // Common weight mappings
  const weightMap: Record<string, number> = {
    'Thin': 100,
    'Hairline': 100,
    'ExtraLight': 200,
    'Ultra Light': 200,
    'UltraLight': 200,
    'Light': 300,
    'Normal': 400,
    'Regular': 400,
    'Book': 400,
    'Medium': 500,
    'SemiBold': 600,
    'Semi Bold': 600,
    'Semibold': 600,
    'DemiBold': 600,
    'Bold': 700,
    'ExtraBold': 800,
    'Extra Bold': 800,
    'UltraBold': 800,
    'Ultra Bold': 800,
    'Black': 900,
    'Heavy': 900,
    'ExtraBlack': 950,
    'Ultra Black': 950
  };

  // Try exact match first
  if (weightMap[fontStyle]) {
    return weightMap[fontStyle];
  }

  // Try case-insensitive match
  const styleKey = Object.keys(weightMap).find(
    key => key.toLowerCase() === fontStyle.toLowerCase()
  );
  if (styleKey) {
    return weightMap[styleKey];
  }

  // Try to extract number from style name (e.g., "Inter 600" -> 600)
  const numberMatch = fontStyle.match(/\d{3}/);
  if (numberMatch) {
    return parseInt(numberMatch[0], 10);
  }

  // Default to Regular
  console.warn(`Unknown font weight "${fontStyle}", defaulting to 400`);
  return 400;
}

/**
 * Convert Figma line height to number or string
 */
function getLineHeight(
  lineHeight: LineHeight,
  fontSize: number
): number | string {
  if (lineHeight.unit === 'PIXELS') {
    return lineHeight.value;
  } else if (lineHeight.unit === 'PERCENT') {
    // Convert percent to decimal (e.g., 150% -> 1.5)
    return Math.round((lineHeight.value / 100) * fontSize * 100) / 100;
  } else if (lineHeight.unit === 'AUTO') {
    return 'auto';
  }
  
  // FONT_SIZE_%
  return lineHeight.value / 100;
}

/**
 * Convert Figma letter spacing to number
 */
function getLetterSpacing(
  letterSpacing: LetterSpacing
): number {
  if (letterSpacing.unit === 'PIXELS') {
    return letterSpacing.value;
  } else if (letterSpacing.unit === 'PERCENT') {
    // Return as decimal (e.g., 5% -> 0.05)
    return letterSpacing.value / 100;
  }
  return 0;
}
