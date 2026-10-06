import { normalizeUrlForSchemeCheck } from './domUtils';

// A light, deliberately narrow pass applied wherever HTML from OUTSIDE
// this editor's own live DOM becomes editor content: the initial value
// this editor is mounted with, every editor.setHTML() call (undo/redo
// replay, and committing out of source-view), and the toolbar's
// clipboard-based Paste button. That is exactly the boundary this app's
// own stated use case crosses constantly — content loaded back in from
// a database, which could have been written by any client, not just
// this editor, or content copied in from an arbitrary web page.
//
// This is deliberately NOT a general allowlist sanitizer: it doesn't
// touch tags, classes, or most attributes, because this editor's own
// widgets (code blocks, alerts) depend on a wide set of structural
// markup — data-*, contenteditable="false", inline SVG, <button> — that
// a strict allowlist would have to special-case anyway, and getting
// that allowlist wrong would silently corrupt legitimate saved
// documents, which for a document-management tool is its own kind of
// serious bug. Instead this strips exactly the constructs that are
// unambiguously dangerous and that this editor itself never generates:
//   - <script> elements, outright
//   - every "on*" event-handler attribute (onclick, onerror, onload...)
//     — this editor never sets these itself, so anywhere one shows up
//     in loaded content, it can only have come from outside it
//   - javascript:/vbscript: URIs in href/src/action attributes
//   - <iframe> elements pointing anywhere other than the YouTube/Vimeo
//     embed hosts the video plugin itself ever generates
const DANGEROUS_SCHEME = /^\s*(javascript|vbscript):/i;
const ALLOWED_EMBED_HOST = /^(www\.)?(youtube(-nocookie)?\.com|youtu\.be|player\.vimeo\.com)$/i;
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction']);

export function sanitizeHtml(html) {
  if (!html) return html;

  const doc = new DOMParser().parseFromString(html, 'text/html');

  doc.querySelectorAll('script').forEach((el) => el.remove());

  doc.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
      } else if (URL_ATTRS.has(name) && DANGEROUS_SCHEME.test(normalizeUrlForSchemeCheck(attr.value))) {
        el.removeAttribute(attr.name);
      }
    });

    if (el.tagName === 'IFRAME') {
      let host = '';
      try {
        host = new URL(el.getAttribute('src') || '', window.location.href).hostname;
      } catch {
        host = '';
      }
      if (!ALLOWED_EMBED_HOST.test(host)) el.remove();
    }
  });

  return doc.body.innerHTML;
}

export default sanitizeHtml;
