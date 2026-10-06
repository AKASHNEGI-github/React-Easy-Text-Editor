// Pulled in as raw CSS text (Vite's ?inline suffix) rather than letting
// it auto-inject into *this* page — the print window is a totally
// separate document (window.open('', ...)), so it doesn't inherit any of
// the app's stylesheets no matter how they're loaded here. Reusing the
// real file, instead of hand-copying a subset of rules into a second
// stylesheet, is also what fixes "colors aren't visible / it's printing
// in black and white": an older inline <style> block never included the
// alert-box colors or the code block's syntax-highlighting theme at all,
// so those genuinely weren't anywhere to be found, in print OR PDF
// (Save-as-PDF goes through this exact same window). Importing the actual
// file (which includes the scoped highlight.js colors) means print/PDF
// output always matches the live editor, including for any future style
// change, with nothing to keep manually in sync.
//
// Every rule in editor.css is scoped under `.jc-root` (see
// build/postcss-jc-scope.mjs), so this document mirrors the live DOM:
// <body class="jc-root"> wraps a <div class="jc-content">. The print-only
// overrides below therefore carry the same `.jc-root` prefix — otherwise
// the stylesheet above would out-rank them.
import editorCss from '../styles/editor.css?inline';

// Opening the window and immediately calling print() is a classic bug:
// images that haven't finished loading print as blank boxes. This waits
// for every <img> to either load or error out first (with a timeout
// safety net in case something never fires) before triggering print.
//
// Also doubles as "export to PDF": every modern browser's print dialog
// offers "Save as PDF" as a destination, so there's no separate PDF
// pipeline to build — the window's <title> becomes the suggested
// filename in that dialog, which is why callers can pass one.
export function openPrintWindow(html, title = 'Print') {
  const win = window.open('', '_blank', 'width=800,height=600');
  if (!win) return; // popup blocked

  win.document.write(
    `<!doctype html><html><head><title>${title}</title><style>
      ${editorCss}
      @page { margin: 2cm; }
      html, body { margin: 0; }
      /* The live editor's shell (flex column, border, clipped overflow)
         is the wrong box for paper: let the page flow and break normally. */
      .jc-root.jc-root--print {
        display: block;
        overflow: visible;
        border: 0;
        border-radius: 0;
        background: #fff;
      }
      /* Most browsers skip background colors/images when printing by
         default, to save ink — separately from whether the CSS for them
         is even present. That's the other half of "black and white":
         even with the real stylesheet above in place, alert backgrounds,
         code-block chrome, and highlighted-code backgrounds would still
         print blank without explicitly opting back in like this. */
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      img { max-width: 100%; }
      table { border-collapse: collapse; width: 100%; }
      tr, img, table, .jc-code-block, .jc-alert { break-inside: avoid; }
      h1, h2, h3 { break-after: avoid; }
      /* Print/PDF is read-only output — no tabs to click, so every tab's
         content renders stacked instead of only the active one, same as
         Preview. */
      .jc-root .jc-code-actions, .jc-root .jc-code-tabs { display: none; }
      .jc-root .jc-code-panel { display: block !important; }
      .jc-root .jc-code-panel::before {
        content: attr(data-filename);
        display: block;
        padding: 8px 14px 0;
        font-family: ui-monospace, Menlo, Consolas, monospace;
        font-size: 11px;
        color: #9aa0a6;
      }
      .jc-root .jc-code-panel + .jc-code-panel { border-top: 1px solid #e2e2e5; }
    </style></head><body class="jc-root jc-root--print"><div class="jc-content">${html}</div></body></html>`
  );
  win.document.close();

  // Leaves the popup open forever otherwise — 'afterprint' fires whether
  // the document was actually printed or the dialog was cancelled, so
  // this closes it either way. Not every browser is guaranteed to fire it
  // (Safari has historically been inconsistent here), hence the timeout
  // fallback right after print() below as a second line of defense.
  let closed = false;
  const closeWindow = () => {
    if (closed || win.closed) return;
    closed = true;
    win.close();
  };
  win.addEventListener('afterprint', closeWindow);

  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    win.focus();
    win.print();
    setTimeout(closeWindow, 1000);
  };

  const images = win.document.images;
  if (!images.length) {
    setTimeout(triggerPrint, 50);
    return;
  }
  let loaded = 0;
  const onImageSettled = () => {
    loaded += 1;
    if (loaded >= images.length) triggerPrint();
  };
  Array.from(images).forEach((img) => {
    if (img.complete) onImageSettled();
    else {
      img.addEventListener('load', onImageSettled);
      img.addEventListener('error', onImageSettled);
    }
  });
  setTimeout(triggerPrint, 1500); // safety net if an image never settles
}
