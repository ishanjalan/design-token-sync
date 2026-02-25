/**
 * Reference file completeness validation.
 * Detects when a developer uploads an incomplete set of reference files
 * (e.g. primitives without semantics for Kotlin) and returns advisory warnings.
 */

export interface RefCompletenessWarning {
  key: string; // DropZoneKey like 'referenceColorsKotlin'
  message: string;
}

/**
 * Analyze reference file content for completeness.
 * Returns warnings for incomplete reference file sets.
 */
export function detectRefCompleteness(
  refContents: Record<string, string | undefined>
): RefCompletenessWarning[] {
  const warnings: RefCompletenessWarning[] = [];

  // Kotlin color detection:
  const kotlinContent = refContents['referenceColorsKotlin'];
  if (kotlinContent) {
    const hasPrimitives = /\bobject\s+\w+Palette\b/.test(kotlinContent)
      || /^val\s+\w+\s*=\s*Color\(/m.test(kotlinContent)
      || /\bobject\s+(?:Primitives|.*Primitives)\s*\{/.test(kotlinContent);
    const hasSemantics = /\bclass\s+R\w+Colors\b/.test(kotlinContent)
      || /\bobject\s+(?:Light|Dark)ColorTokens\b/.test(kotlinContent);

    if (hasPrimitives && !hasSemantics) {
      warnings.push({
        key: 'referenceColorsKotlin',
        message: 'You uploaded a primitives file (e.g. Color.kt) but no semantic color files (e.g. RFillColors.kt, RTextColors.kt). Only primitives will be generated. Upload all your color files for complete match-existing output, or remove the reference to use best-practices mode.'
      });
    } else if (!hasPrimitives && hasSemantics) {
      warnings.push({
        key: 'referenceColorsKotlin',
        message: 'You uploaded semantic color files but no primitives file (e.g. Color.kt). Only semantic files will be generated. Upload the primitives file for complete output.'
      });
    }
  }

  // Kotlin typography detection:
  const kotlinTypoContent = refContents['referenceTypographyKotlin'];
  if (kotlinTypoContent) {
    const hasDefinition =
      (/\bclass\s+\w+/.test(kotlinTypoContent) && (/@Immutable\b/.test(kotlinTypoContent) || /internal\s+constructor/.test(kotlinTypoContent))) ||
      (/\bobject\s+\w+/.test(kotlinTypoContent) && /\bTextStyle\s*\(/.test(kotlinTypoContent));
    const hasAccessor = /\benum\s+class\s+\w+/.test(kotlinTypoContent) && /MaterialTheme/.test(kotlinTypoContent);

    if (hasAccessor && !hasDefinition) {
      warnings.push({
        key: 'referenceTypographyKotlin',
        message: 'You uploaded an accessor file (e.g. RLocalTypography.kt) but no definition file (e.g. RTypography.kt). Upload the definition file for complete match-existing output, or remove the reference to use best-practices mode.'
      });
    }
  }

  // Web color detection:
  const webContent = refContents['referenceColorsWeb'];
  if (webContent) {
    const hasPrimitives = /\$[\w-]+-\d+\s*:/.test(webContent)
      || /--[\w-]+-\d+\s*:/.test(webContent)
      || /export\s+const\s+[A-Z_]+_\d+\s*=/.test(webContent)
      || /primitive/i.test(webContent);
    const hasSemantics = /\$text-primary|\$fill-primary/i.test(webContent)
      || /--text-primary|--fill-primary/i.test(webContent)
      || /TEXT_PRIMARY|FILL_PRIMARY/.test(webContent);

    if (hasPrimitives && !hasSemantics) {
      warnings.push({
        key: 'referenceColorsWeb',
        message: 'You uploaded primitives (e.g. Primitives.scss) but no semantic color file (e.g. Colors.scss). Only primitives will be generated.'
      });
    } else if (!hasPrimitives && hasSemantics) {
      warnings.push({
        key: 'referenceColorsWeb',
        message: 'You uploaded a semantic color file but no primitives file. Upload both for complete output.'
      });
    }
  }

  return warnings;
}
