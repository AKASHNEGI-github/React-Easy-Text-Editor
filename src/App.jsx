import { useState } from 'react';
import { Editor, ContentViewer } from './index';
import { buildCodeBlock } from './core/codeBlockDom';

const starterCodeBlock = buildCodeBlock([
  { language: 'javascript', filename: 'sum.js', code: 'function sum(a, b) {\n  return a + b;\n}\n\nconsole.log(sum(2, 3));' },
  { language: 'python', filename: 'sum.py', code: 'def total(a, b):\n    return a + b\n\nprint(total(2, 3))' },
]).outerHTML;

const STARTER_HTML = `
  <h1>React Easy Text Editor</h1>
  <p>This is a <strong>from-scratch</strong> rich text editor &mdash; no third-party editor library (except highlight.js, used only for code syntax highlighting). Every plugin on the toolbar above is our own code: <em>toggle formats</em>, <u>lists</u>, tables, links, and more.</p>
  <ul>
    <li>Bold, italic, lists, alignment &mdash; backed by execCommand</li>
    <li>Font size, line height &mdash; custom span/style logic</li>
    <li>Links, images, video &mdash; custom popups</li>
  </ul>
  <p>Click inside this table to see the row/column/color/merge tools appear above it, and drag a column edge to resize:</p>
  <table style="border-collapse: collapse; width: 100%;">
    <tbody>
      <tr>
        <th style="border: 1px solid #d1d5db; padding: 6px 8px; background: #f7f7f8;">Plugin</th>
        <th style="border: 1px solid #d1d5db; padding: 6px 8px; background: #f7f7f8;">Status</th>
      </tr>
      <tr>
        <td style="border: 1px solid #d1d5db; padding: 6px 8px;">Table editing</td>
        <td style="border: 1px solid #d1d5db; padding: 6px 8px;">Try the toolbar above</td>
      </tr>
    </tbody>
  </table>
  <p>A multi-tab code block, inserted via the code icon on row 2 &mdash; try Copy, Edit, and switching tabs:</p>
  ${starterCodeBlock}
  <p>&nbsp;</p>
  <p>&nbsp;</p>
  <div class="jc-alert jc-alert--tip"><div class="jc-alert-label" contenteditable="false">Tip</div><div class="jc-alert-content"><p>Alerts (Note/Tip/Important/Caution/Warning) work like a Quote, just colored by type &mdash; try the triangle icon on row 1. Lock (the padlock, row 2) makes the whole editor read-only without hiding the toolbar.</p></div></div>
  <p>Click &ldquo;View content in HTML output&rdquo; (the &lt;/&gt; icon on row 2) &mdash; the editor itself switches to showing and editing the raw HTML; click it again to return to normal view. Check the word/character count and tag path at the bottom of the editor too.</p>
  <p>New: the sun/moon icon at the end of row 2 switches between light and dark theme (your choice is remembered), and the smiley icon next to special characters opens a searchable emoji picker &mdash; try typing &ldquo;cat&rdquo; or &ldquo;fire&rdquo; in it. <span>&#127881;</span></p>
`;

export default function App() {
  const [html, setHtml] = useState(STARTER_HTML);

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 20px' }}>
      <h2 style={{ marginBottom: 4 }}>React Easy Text Editor</h2>
      <p style={{ marginTop: 0, marginBottom: 20, color: '#5f6368', fontSize: 14 }}>
        Everything below is the published package's public API: <code>{'<Editor />'}</code> and{' '}
        <code>{'<ContentViewer />'}</code>.
      </p>

      {/* No plugins/toolbarRows needed: the defaults give the full toolbar. height/width work like Jodit's. */}
      <Editor height={520} placeholder="Start typing…" initialValue={STARTER_HTML} onChange={setHtml} />

      <h2 style={{ margin: '40px 0 4px' }}>Same content, outside the editor</h2>
      <p style={{ marginTop: 0, marginBottom: 16, color: '#5f6368', fontSize: 14 }}>
        <code>{'<ContentViewer html={html} />'}</code> — updates live as you type above.
      </p>
      <div style={{ border: '1px solid #e2e2e5', borderRadius: 4, padding: 20 }}>
        <ContentViewer html={html} />
      </div>
    </div>
  );
}
