// Installs the package the way a user would and checks that it works.
//
//   npm run build && npm run test:package
//
// It packs the project exactly as `npm publish` would, installs that tarball (plus React) into a
// throw-away folder, and then, in plain Node with no browser and no bundler:
//   - imports it as an ES module and as CommonJS
//   - resolves the `./style.css` subpath
//   - renders <Editor /> and <ContentViewer /> on the server (no `window`, no `document`)
// Exit code is non-zero if anything fails, so it is safe to run in CI before publishing.

import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const sh = (cmd, cwd) => execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString();

if (!existsSync(join(root, 'dist', 'index.js'))) {
  console.error('dist/ is missing. Run `npm run build` first.');
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), 'jc-smoke-'));
let failed = false;
const ok = (name, pass, detail = '') => {
  if (!pass) failed = true;
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

try {
  const tarball = sh(`npm pack --silent --pack-destination "${tmp}"`, root).trim().split('\n').pop();
  const app = join(tmp, 'app');
  mkdirSync(app);
  writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'smoke', private: true, type: 'module' }));
  console.log(`Installing ${tarball} + react into a clean project...`);
  sh(`npm install --silent --no-audit --no-fund "${join(tmp, tarball)}" react react-dom`, app);

  const checks = `
    const assert = (c, m) => { if (!c) throw new Error(m); };
    assert(typeof window === 'undefined' && typeof document === 'undefined', 'test must run without a DOM');
    const { Editor, ContentViewer, allPlugins, toolbarRows, SEPARATOR, IconStore } = LIB;
    assert(typeof Editor === 'object' && typeof ContentViewer === 'object', 'Editor/ContentViewer missing');
    assert(allPlugins.length > 30 && Array.isArray(toolbarRows), 'plugins missing');
    assert(IconStore.set('x', '<svg/>') === IconStore && IconStore.has('x'), 'IconStore broken');
    const e = renderToString(React.createElement(Editor, { initialValue: '<p>hi</p>', height: 300, theme: 'dark', placeholder: 'Type' }));
    assert(e.includes('jc-toolbar') && e.includes('jc-statusbar'), 'editor did not server-render');
    assert(e.includes('data-theme="dark"') && e.includes('height:300px'), 'theme/height props not applied on the server');
    const v1 = renderToString(React.createElement(ContentViewer, { html: '<p>hi</p>' }));
    assert(v1.includes('jc-viewer') && !v1.includes('<p>hi</p>'), 'default viewer must not emit unsanitized HTML on the server');
    const v2 = renderToString(React.createElement(ContentViewer, { html: '<p>hi</p>', sanitize: false }));
    assert(v2.includes('<p>hi</p>'), 'sanitize={false} viewer must server-render its HTML');
    console.log('ok');
  `;

  writeFileSync(join(app, 'esm.mjs'), `import React from 'react';\nimport { renderToString } from 'react-dom/server';\nimport * as LIB from 'react-easy-text-editor';\nimport Default from 'react-easy-text-editor';\nif (Default !== LIB.Editor) throw new Error('default export is not Editor');\n${checks}`);
  writeFileSync(join(app, 'cjs.cjs'), `const React = require('react');\nconst { renderToString } = require('react-dom/server');\nconst LIB = require('react-easy-text-editor');\n${checks}`);
  writeFileSync(join(app, 'css.mjs'), `import { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);\nconst a = import.meta.resolve('react-easy-text-editor/style.css');\nconst b = require.resolve('react-easy-text-editor/style.css');\nif (!a.endsWith('/dist/style.css') || !b.endsWith('style.css')) throw new Error(a + ' ' + b);\nconsole.log('ok');`);

  for (const [label, file] of [
    ['import (ES module)', 'esm.mjs'],
    ['require (CommonJS)', 'cjs.cjs'],
    ['import "react-easy-text-editor/style.css" resolves', 'css.mjs'],
  ]) {
    try {
      const out = sh(`node ${file}`, app).trim();
      ok(label, out.endsWith('ok'));
    } catch (err) {
      ok(label, false, String(err.stderr || err.message).split('\n').find((l) => /Error/.test(l)) || 'failed');
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
