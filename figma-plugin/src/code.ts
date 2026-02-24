figma.showUI(__html__, { width: 360, height: 480, themeColors: true });

interface TokenValue {
  $type: string;
  $value: unknown;
  $extensions?: Record<string, unknown>;
}

interface ColorComponents {
  colorSpace: string;
  components: [number, number, number];
  alpha: number;
  hex: string;
}

function colorToHex(r: number, g: number, b: number): string {
  const ri = Math.round(r * 255);
  const gi = Math.round(g * 255);
  const bi = Math.round(b * 255);
  return (
    '#' +
    ri.toString(16).padStart(2, '0') +
    gi.toString(16).padStart(2, '0') +
    bi.toString(16).padStart(2, '0')
  );
}

function setNested(
  obj: Record<string, unknown>,
  parts: string[],
  value: TokenValue,
): void {
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function isColor(v: VariableValue): v is RGBA {
  return typeof v === 'object' && v !== null && 'r' in v && 'g' in v && 'b' in v && !('type' in v);
}

function isAlias(v: VariableValue): v is VariableAlias {
  return typeof v === 'object' && v !== null && 'type' in v && (v as VariableAlias).type === 'VARIABLE_ALIAS';
}

async function resolveColorAlias(
  alias: VariableAlias,
  modeId: string,
  visited?: Set<string>,
): Promise<RGBA | null> {
  const seen = visited ?? new Set<string>();
  if (seen.has(alias.id)) return null;
  seen.add(alias.id);

  const target = await figma.variables.getVariableByIdAsync(alias.id);
  if (!target) return null;

  const val = target.valuesByMode[modeId];
  if (!val) {
    const modeIds = Object.keys(target.valuesByMode);
    if (modeIds.length === 0) return null;
    const fallback = target.valuesByMode[modeIds[0]];
    if (isAlias(fallback)) return resolveColorAlias(fallback, modeIds[0], seen);
    if (isColor(fallback)) return fallback;
    return null;
  }
  if (isAlias(val)) return resolveColorAlias(val, modeId, seen);
  if (isColor(val)) return val;
  return null;
}

async function resolveNumberAlias(
  alias: VariableAlias,
  modeId: string,
  visited?: Set<string>,
): Promise<number | null> {
  const seen = visited ?? new Set<string>();
  if (seen.has(alias.id)) return null;
  seen.add(alias.id);

  const target = await figma.variables.getVariableByIdAsync(alias.id);
  if (!target) return null;

  let val: VariableValue | undefined = target.valuesByMode[modeId];
  if (val === undefined) {
    const modeIds = Object.keys(target.valuesByMode);
    if (modeIds.length === 0) return null;
    val = target.valuesByMode[modeIds[0]];
  }
  if (isAlias(val)) return resolveNumberAlias(val, modeId, seen);
  if (typeof val === 'number') return val;
  return null;
}

async function buildColorToken(
  value: VariableValue,
  variable: Variable,
  modeId: string,
): Promise<TokenValue | null> {
  if (isAlias(value)) {
    const resolved = await resolveColorAlias(value, modeId);
    if (!resolved) return null;

    const aliasTarget = await figma.variables.getVariableByIdAsync(value.id);
    const token: TokenValue = {
      $type: 'color',
      $value: {
        colorSpace: 'srgb',
        components: [resolved.r, resolved.g, resolved.b],
        alpha: resolved.a,
        hex: colorToHex(resolved.r, resolved.g, resolved.b),
      } as ColorComponents,
    };

    if (aliasTarget) {
      token.$extensions = {
        'com.figma.variableId': variable.id,
        'com.figma.scopes': variable.scopes,
        'com.figma.aliasData': {
          targetVariableId: aliasTarget.id,
          targetVariableName: aliasTarget.name,
          targetVariableSetId: aliasTarget.variableCollectionId,
          targetVariableSetName: '',
        },
      };
    }
    return token;
  }

  if (isColor(value)) {
    return {
      $type: 'color',
      $value: {
        colorSpace: 'srgb',
        components: [value.r, value.g, value.b],
        alpha: value.a,
        hex: colorToHex(value.r, value.g, value.b),
      } as ColorComponents,
      $extensions: {
        'com.figma.variableId': variable.id,
        'com.figma.scopes': variable.scopes,
      },
    };
  }

  return null;
}

async function buildNumberToken(
  value: VariableValue,
  variable: Variable,
  modeId: string,
): Promise<TokenValue | null> {
  if (typeof value === 'number') {
    return { $type: 'number', $value: value };
  }
  if (isAlias(value)) {
    const resolved = await resolveNumberAlias(value, modeId);
    if (resolved === null) return null;
    const aliasTarget = await figma.variables.getVariableByIdAsync(value.id);
    const token: TokenValue = { $type: 'number', $value: resolved };
    if (aliasTarget) {
      token.$extensions = {
        'com.figma.variableId': variable.id,
        'com.figma.aliasData': {
          targetVariableId: aliasTarget.id,
          targetVariableName: aliasTarget.name,
        },
      };
    }
    return token;
  }
  return null;
}

// ── Typography helpers ──────────────────────────────────────────────────

function getFontWeight(fontStyle: string): number {
  const weightMap: Record<string, number> = {
    'Thin': 100, 'Hairline': 100,
    'ExtraLight': 200, 'Ultra Light': 200, 'UltraLight': 200,
    'Light': 300,
    'Normal': 400, 'Regular': 400, 'Book': 400,
    'Medium': 500,
    'SemiBold': 600, 'Semi Bold': 600, 'Semibold': 600, 'DemiBold': 600,
    'Bold': 700,
    'ExtraBold': 800, 'Extra Bold': 800, 'UltraBold': 800,
    'Black': 900, 'Heavy': 900,
    'ExtraBlack': 950, 'Ultra Black': 950,
  };
  if (weightMap[fontStyle]) return weightMap[fontStyle];
  const lc = fontStyle.toLowerCase();
  for (const key in weightMap) {
    if (key.toLowerCase() === lc) return weightMap[key];
  }
  const m = fontStyle.match(/\d{3}/);
  if (m) return parseInt(m[0], 10);
  return 400;
}

function getLineHeight(lineHeight: LineHeight, fontSize: number): number | string {
  if (lineHeight.unit === 'PIXELS') return lineHeight.value;
  if (lineHeight.unit === 'PERCENT') return Math.round((lineHeight.value / 100) * fontSize * 100) / 100;
  if (lineHeight.unit === 'AUTO') return 'auto';
  return lineHeight.value / 100;
}

function getLetterSpacing(letterSpacing: LetterSpacing): number {
  if (letterSpacing.unit === 'PIXELS') return letterSpacing.value;
  if (letterSpacing.unit === 'PERCENT') return letterSpacing.value / 100;
  return 0;
}

async function extractTypography(): Promise<Record<string, unknown>> {
  const textStyles = await figma.getLocalTextStylesAsync();
  const result: Record<string, unknown> = {};
  for (const style of textStyles) {
    if (typeof style.fontName === 'symbol') continue;
    const fontName = style.fontName;
    const fs = typeof style.fontSize === 'number' ? style.fontSize : 16;
    result[style.name] = {
      $type: 'typography',
      $value: {
        fontFamily: fontName.family,
        fontSize: fs,
        fontWeight: getFontWeight(fontName.style),
        lineHeight: getLineHeight(style.lineHeight, fs),
        letterSpacing: getLetterSpacing(style.letterSpacing),
      },
      $extensions: {
        'com.figma.styleId': style.id,
        'com.figma.styleName': style.name,
      },
    };
  }
  return result;
}

// ── Main extraction ─────────────────────────────────────────────────────

async function extractTokens() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const lightColors: Record<string, unknown> = {};
  const darkColors: Record<string, unknown> = {};
  const values: Record<string, unknown> = {};
  const typography = await extractTypography();

  let colorCount = 0;
  let numberCount = 0;
  let effectCount = 0;

  for (const collection of collections) {
    const modes = collection.modes;
    let lightMode: { modeId: string; name: string } | undefined;
    let darkMode: { modeId: string; name: string } | undefined;

    for (const mode of modes) {
      const modeName = mode.name.toLowerCase();
      if (modeName.includes('dark')) {
        darkMode = mode;
      }
      if (modeName.includes('light') || mode.modeId === collection.defaultModeId) {
        if (!lightMode) lightMode = mode;
      }
    }

    for (const varId of collection.variableIds) {
      const variable = await figma.variables.getVariableByIdAsync(varId);
      if (!variable || variable.hiddenFromPublishing) continue;

      const pathParts = variable.name.split('/');

      if (variable.resolvedType === 'COLOR') {
        colorCount++;
        if (lightMode) {
          const lightVal = variable.valuesByMode[lightMode.modeId];
          if (lightVal !== undefined) {
            const lt = await buildColorToken(lightVal, variable, lightMode.modeId);
            if (lt) setNested(lightColors, pathParts, lt);
          }
        }

        if (darkMode) {
          const darkVal = variable.valuesByMode[darkMode.modeId];
          if (darkVal !== undefined) {
            const dt = await buildColorToken(darkVal, variable, darkMode.modeId);
            if (dt) setNested(darkColors, pathParts, dt);
          }
        } else if (lightMode) {
          const fallbackVal = variable.valuesByMode[lightMode.modeId];
          if (fallbackVal !== undefined) {
            const ft = await buildColorToken(fallbackVal, variable, lightMode.modeId);
            if (ft) setNested(darkColors, pathParts, ft);
          }
        }
      } else if (variable.resolvedType === 'FLOAT') {
        const numModeId = lightMode ? lightMode.modeId : collection.defaultModeId;
        const numVal = variable.valuesByMode[numModeId];
        if (numVal !== undefined) {
          const nt = await buildNumberToken(numVal, variable, numModeId);
          if (nt) {
            numberCount++;
            setNested(values, pathParts, nt);
          }
        }

        if (lightMode && darkMode) {
          const effLightVal = variable.valuesByMode[lightMode.modeId];
          const effDarkVal = variable.valuesByMode[darkMode.modeId];
          if (effLightVal !== undefined && effDarkVal !== undefined) {
            const elt = await buildNumberToken(effLightVal, variable, lightMode.modeId);
            const edt = await buildNumberToken(effDarkVal, variable, darkMode.modeId);
            if (elt && edt) {
              effectCount++;
            }
          }
        }
      }
    }
  }

  return {
    lightColors,
    darkColors,
    values,
    typography,
    stats: {
      collections: collections.length,
      colors: colorCount,
      numbers: numberCount,
      effects: effectCount,
      typography: Object.keys(typography).length,
    },
  };
}

// ── Message handler ─────────────────────────────────────────────────────

const URL_STORAGE_KEY = 'tokensmith:url';
const ENDPOINT_STORAGE_KEY = 'tokensmith:endpoint';

async function runExtraction() {
  try {
    const result = await extractTokens();
    figma.ui.postMessage({ type: 'tokens', data: result });

    const parts: string[] = [];
    if (result.stats.colors > 0) parts.push(`${result.stats.colors} colors`);
    if (result.stats.numbers > 0) parts.push(`${result.stats.numbers} values`);
    if (result.stats.typography > 0) parts.push(`${result.stats.typography} text styles`);
    figma.notify(`Extracted ${parts.join(', ')} from ${result.stats.collections} collections`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    figma.ui.postMessage({ type: 'error', message });
    figma.notify(`Extraction failed: ${message.slice(0, 80)}`, { error: true });
  }
}

figma.ui.onmessage = async (msg: { type: string; url?: string; endpoint?: string }) => {
  if (msg.type === 'ui-ready' || msg.type === 'extract') {
    await runExtraction();
  }

  if (msg.type === 'load-url') {
    const [savedUrl, savedEndpoint] = await Promise.all([
      figma.clientStorage.getAsync(URL_STORAGE_KEY),
      figma.clientStorage.getAsync(ENDPOINT_STORAGE_KEY),
    ]);
    figma.ui.postMessage({
      type: 'url-loaded',
      url: savedUrl || '',
      endpoint: savedEndpoint || '/api/figma/plugin-sync',
    });
    await runExtraction();
  }

  if (msg.type === 'save-url' && msg.url !== undefined) {
    await figma.clientStorage.setAsync(URL_STORAGE_KEY, msg.url);
  }

  if (msg.type === 'save-endpoint' && msg.endpoint !== undefined) {
    await figma.clientStorage.setAsync(ENDPOINT_STORAGE_KEY, msg.endpoint);
  }

  if (msg.type === 'close') {
    figma.closePlugin();
  }
};
