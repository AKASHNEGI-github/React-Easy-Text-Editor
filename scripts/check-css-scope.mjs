// Fails the build if dist/style.css could ever restyle anything outside the editor.
//
//   npm run check:css
//
// Rules enforced:
//   - every selector begins with `.jc-root`
//   - no :root / html / body / bare `*` selectors
//   - no @import left unresolved, no @font-face, and any @keyframes name is prefixed `jc-`
//     (those at-rules live in the global namespace and cannot be scoped by a selector)

import { readFileSync } from 'node:fs';
import postcss from 'postcss';

const file = process.argv[2] || 'dist/style.css';
const css = readFileSync(file, 'utf8');
const root = postcss.parse(css, { from: file });

const problems = [];
let rules = 0;

root.walkRules((rule) => {
  if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
  rules += 1;
  for (const sel of rule.selectors) {
    const s = sel.trim();
    if (!/^\.jc-root(?![\w-])/.test(s)) problems.push(`not scoped: ${s}`);
    if (/(^|[\s,>+~(])(:root|html|body)(?![\w-])/.test(s)) problems.push(`global element selector: ${s}`);
    if (/^\.jc-root \.jc-viewer(?![\w-])/.test(s)) problems.push(`dead selector (the viewer's root IS .jc-root; write .jc-root.jc-viewer): ${s}`);
  }
});

root.walkAtRules((at) => {
  if (at.name === 'import') problems.push(`unresolved @import ${at.params}`);
  if (at.name === 'font-face') problems.push('@font-face is global; not allowed');
  if (/keyframes$/i.test(at.name) && !/^jc-/.test(at.params)) problems.push(`@keyframes ${at.params} must be prefixed "jc-"`);
});

if (problems.length) {
  console.error(`✗ ${file}: ${problems.length} problem(s)`);
  for (const p of [...new Set(problems)].slice(0, 30)) console.error('  - ' + p);
  process.exit(1);
}
console.log(`✓ ${file}: all ${rules} rules are scoped under .jc-root`);
