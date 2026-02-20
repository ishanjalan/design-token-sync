import { build, context } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const watching = process.argv.includes('--watch');

const codeConfig = {
  entryPoints: ['src/code.ts'],
  bundle: true,
  outfile: 'dist/code.js',
  target: 'es2017',
  format: 'iife',
};

const uiConfig = {
  entryPoints: ['src/ui.ts'],
  bundle: true,
  outfile: 'dist/ui-bundle.js',
  target: 'es2017',
  format: 'iife',
};

function buildHtml() {
  mkdirSync('dist', { recursive: true });
  let js = '';
  try {
    js = readFileSync('dist/ui-bundle.js', 'utf-8');
  } catch {
    // first run — file doesn't exist yet
  }
  const css = readFileSync('src/ui.css', 'utf-8');
  const html = readFileSync('src/ui.html', 'utf-8')
    .replace('/* __CSS__ */', css)
    .replace('/* __JS__ */', js);
  writeFileSync('dist/ui.html', html);
}

if (watching) {
  const [codeCtx, uiCtx] = await Promise.all([
    context(codeConfig),
    context({
      ...uiConfig,
      plugins: [{
        name: 'rebuild-html',
        setup(b) {
          b.onEnd(() => buildHtml());
        },
      }],
    }),
  ]);
  await Promise.all([codeCtx.watch(), uiCtx.watch()]);
  console.log('Watching for changes…');
} else {
  await Promise.all([build(codeConfig), build(uiConfig)]);
  buildHtml();
  console.log('Build complete.');
}
