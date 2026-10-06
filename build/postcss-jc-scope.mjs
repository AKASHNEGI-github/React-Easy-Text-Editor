// PostCSS plugin: guarantees every rule in the editor's stylesheet is
// scoped under `.jc-root`, no matter how it was written in the source.
//
//   .jc-btn                 ->  .jc-root .jc-btn
//   .jc-root--fullscreen    ->  .jc-root.jc-root--fullscreen
//   .jc-root[data-theme]    ->  (unchanged, already rooted)
//
// Why do this at build time instead of hand-writing the prefix?
//
//  1. It makes it impossible to leak a global rule by accident: a new
//     `.jc-foo { ... }` added next year is scoped automatically.
//  2. It raises every rule's specificity by one class. A host page's
//     `button:hover { ... }` (0,1,1) can no longer beat the editor's own
//     `.jc-btn { ... }`, which now weighs (0,2,0).
//
// The same plugin runs in the dev server, the library build and the demo
// build, so what you see in `npm run dev` is what consumers get.

const ROOT = '.jc-root';

// Split a selector list on top-level commas only (ignores commas inside
// :is(...), :not(...), [attr="a,b"], etc.).
function splitSelectorList(list) {
  const out = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (let i = 0; i < list.length; i += 1) {
    const ch = list[i];
    if (quote) {
      current += ch;
      if (ch === quote && list[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === '(' || ch === '[') {
      depth += 1;
      current += ch;
    } else if (ch === ')' || ch === ']') {
      depth -= 1;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current);
  return out;
}

export function scopeSelector(selector) {
  const s = selector.trim();
  if (!s) return s;
  // Already rooted: `.jc-root`, `.jc-root[data-theme]`, `.jc-root .x`, ...
  if (/^\.jc-root(?![\w-])/.test(s)) return s;
  // Modifier class that lives on the root element itself.
  if (/^\.jc-root--/.test(s)) return s.replace(/^\.jc-root--/, '.jc-root.jc-root--');
  return `${ROOT} ${s}`;
}

const isKeyframes = (node) =>
  node && node.type === 'atrule' && /keyframes$/i.test(node.name);

export default function jcScope() {
  return {
    postcssPlugin: 'jc-scope',
    Rule(rule) {
      if (isKeyframes(rule.parent)) return; // `from`, `to`, `50%` are not selectors
      const next = splitSelectorList(rule.selector).map(scopeSelector).join(', ');
      if (next !== rule.selector) rule.selector = next;
    },
  };
}
jcScope.postcss = true;
