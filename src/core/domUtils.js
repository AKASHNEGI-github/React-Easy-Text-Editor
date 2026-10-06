// Wraps the current selection in a <span> carrying one inline style
// property. Used instead of execCommand for font-size/font-family, which
// would otherwise insert legacy <font> tags.
export function wrapSelectionWithStyle(editor, styleProp, value) {
  editor.selection.restore();
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const span = document.createElement('span');
  span.style[styleProp] = value;
  try {
    range.surroundContents(span);
  } catch {
    // surroundContents throws if the range crosses element boundaries
    // (e.g. spans two <p>s) — fall back to extract + re-insert.
    const contents = range.extractContents();
    span.appendChild(contents);
    range.insertNode(span);
  }
  sel.removeAllRanges();
  const newRange = document.createRange();
  newRange.selectNodeContents(span);
  sel.addRange(newRange);
  editor.selection.save();
}

// Applies a style to the block-level ancestor of the selection — for
// properties like line-height that are block-level, not inline.
export function applyBlockStyle(editor, styleProp, value) {
  editor.selection.restore();
  const root = editor.containerRef.current;
  const block = editor.selection.getBlockAncestor(root);
  if (block) block.style[styleProp] = value;
}

// Best-effort "what's the value at the cursor" reader, used to show the
// current font/size/line-height in its dropdown without relying on
// queryCommandValue (unreliable once we stop using execCommand for these).
//
// Deliberately reads the *inline* style off each ancestor rather than
// window.getComputedStyle(), and stops at `root` rather than climbing the
// whole document. Computed style normalizes values on the way out — a
// unitless line-height like the "1.5" this app's own dropdown options use
// comes back from getComputedStyle() as a computed pixel value instead
// (e.g. "22.4px", derived from the current font-size), which never
// string-matches any option and so never highlights as selected no
// matter what's actually applied. Multi-word font-family names have the
// same problem in a smaller way: browsers don't all normalize the quotes
// around "Times New Roman" the same way on the way back out. Reading the
// inline value directly returns it in the exact format it was authored
// in, which is the only format guaranteed to match an option's value.
export function getCurrentStyleValue(root, styleProp) {
  // Called while rendering toolbar dropdowns. On the server (and on a first client render,
  // before the editable element is mounted) `root` is null and `window` may not exist, so
  // bail out before touching the DOM.
  if (!root || typeof window === 'undefined') return '';
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return '';
  let node = sel.anchorNode;
  if (!node || !root.contains(node)) return '';
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  while (node && node !== root.parentElement) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const inline = node.style?.[styleProp];
      if (inline) return inline;
    }
    if (node === root) break;
    node = node.parentElement;
  }
  return '';
}

// ---------------------------------------------------------------------
// Caret placement after inserting a fresh widget (link/image/file/video/
// table/code block/alert) at what was a collapsed selection.
//
// Range.insertNode() — and Range.surroundContents(), which a couple of
// these popups fall back to internally — does not leave the caret after
// the node it just inserted. Per spec, inserting into a *collapsed*
// range moves the range's end to just past the new node but leaves its
// start where it was, so the range ends up spanning the whole node
// instead of collapsing after it. Nothing syncs that back to the live
// browser selection on its own, and because these popups already
// re-focus the editor root right before inserting (editor.selection.
// restore()), focus stays put — so the very next keystroke lands right
// on that now-selected node, replacing the link/image/table/code block/
// alert that was just inserted with whatever gets typed next.
// ---------------------------------------------------------------------

// Collapses the caret to sit immediately AFTER `node` — for widgets the
// user keeps typing normal prose after (a link, image, download link,
// video embed).
export function placeCaretAfter(editor, node) {
  const sel = window.getSelection();
  if (!sel || !node?.parentNode) return;
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  editor.selection.save();
}

// Collapses the caret to the END of `container`'s own contents — for
// widgets the user keeps typing INTO (an alert's body, a table's first
// cell, the empty paragraph left after a freshly-inserted code block).
export function placeCaretInside(editor, container) {
  const sel = window.getSelection();
  if (!sel || !container) return;
  const range = document.createRange();
  range.selectNodeContents(container);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
  editor.selection.save();
}

// ---------------------------------------------------------------------
// URL safety for user-supplied link/file/image/video addresses.
//
// A URL typed into Insert Link/File/Image/Video becomes a live href/src
// in the HTML this editor produces — and per this app's own use case,
// that HTML is meant to be saved and re-rendered later, including for
// other people who open the saved document, not just looked at once
// here. javascript:/vbscript: hrefs are executable, so accepting them
// verbatim turns "insert a link" into a stored-XSS vector the moment
// the saved document is opened again. This is deliberately an allowlist
// of known-safe schemes rather than a blocklist of known-bad ones,
// since new dangerous schemes are easier to invent than to enumerate.
// ---------------------------------------------------------------------

const SAFE_URL_SCHEMES = /^(https?:|mailto:|tel:)/i;
const HAS_URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

// Browsers trim leading/trailing C0-control-or-space from a URL, and then
// strip every ASCII tab/newline/CR from anywhere else in it, before they
// ever look at the scheme (WHATWG URL Standard, "basic URL parser", steps
// 1-2). That means a value like "java\tscript:alert(1)" still runs as
// javascript: in the browser even though it doesn't literally start with
// "javascript:" — so a scheme check run on the raw string can be walked
// straight past with one stray control character. Normalizing the same
// way first is what keeps isSafeUrl/isSafeImageSrc (and sanitize.js's own
// scheme check, which reuses this) from being bypassable that way.
const C0_OR_SPACE_EDGES = /^[\u0000-\u0020]+|[\u0000-\u0020]+$/g;
const TAB_OR_NEWLINE = /[\t\n\r]/g;
export function normalizeUrlForSchemeCheck(value) {
  return String(value || '').replace(C0_OR_SPACE_EDGES, '').replace(TAB_OR_NEWLINE, '');
}

// True for http(s)/mailto/tel URLs, and for schemeless ones (relative
// paths, '#anchor', '?query', same-site links) — the shapes a normal URL
// field legitimately contains. False for javascript:, vbscript:, data:,
// and any other unrecognized scheme.
export function isSafeUrl(value) {
  const v = normalizeUrlForSchemeCheck(value);
  if (!v) return false;
  if (!HAS_URL_SCHEME.test(v)) return true; // relative/anchor/query — no scheme to abuse
  return SAFE_URL_SCHEMES.test(v);
}

// Same idea for <img src>, plus data:image/* — how pasted or uploaded
// images legitimately end up embedded as base64.
export function isSafeImageSrc(value) {
  const v = normalizeUrlForSchemeCheck(value);
  if (!v) return false;
  if (/^data:image\//i.test(v)) return true;
  return isSafeUrl(v);
}

// document.execCommand('indent') on a list item produces
// <ul><li>A</li><ul><li>B</li></ul><li>C</li></ul> in Chrome — a <ul>
// sitting directly inside another <ul>, which only <li> may legally do.
// It's tolerated as a live DOM (rendering looks right), but it's not
// something a browser's own HTML parser would ever produce by parsing a
// string, and a later execCommand — insertOrderedList on the same list,
// say — treats the nested <ul> inconsistently (only the outer list
// converts, leaving the nested one behind as an orphaned bullet list).
//
// Fixing that first shape (moving the stray <ul> inside the preceding
// <li>, the correctly-nested shape indent actually means to produce)
// then exposes a second one: execCommand('outdent') on THAT correctly-
// nested shape doesn't reverse it the way it reverses its own native
// output — it unwraps the inner <ul> but leaves the inner <li> sitting
// directly inside the outer <li>, with no <ul>/<ol> between them at all,
// which is even less valid (a bare <li> may never be a direct child of
// another <li>). So this also moves any such <li> back out to be a
// sibling of the outer one, in the outer <li>'s own parent list — which
// is what "outdent" actually means: one list-nesting level shallower,
// not a duplicated child.
//
// Called after both indent and outdent for exactly that reason: each one
// can produce the malformation the OTHER step needs cleaned up before
// it'll reverse correctly next time.
export function normalizeListNesting(root) {
  if (!root) return;
  root.querySelectorAll('ul, ol').forEach((list) => {
    Array.from(list.children).forEach((child) => {
      if (child.tagName !== 'UL' && child.tagName !== 'OL') return;
      const prevLi = child.previousElementSibling;
      if (prevLi && prevLi.tagName === 'LI') prevLi.appendChild(child);
    });
  });
  root.querySelectorAll('li').forEach((li) => {
    const outerList = li.parentElement;
    if (!outerList || (outerList.tagName !== 'UL' && outerList.tagName !== 'OL')) return;
    let cursor = li;
    Array.from(li.children).forEach((child) => {
      if (child.tagName !== 'LI') return;
      cursor.after(child);
      cursor = child;
    });
  });
}
