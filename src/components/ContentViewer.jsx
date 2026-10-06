import { memo, useRef, useState } from 'react';
import { sanitizeHtml } from '../core/sanitize';
import { ensureStyles } from '../core/injectStyles';
import { useIsomorphicLayoutEffect } from '../core/useIsomorphicLayoutEffect';
import { copyActiveTab, getCodeBlockFromTarget, switchTab } from '../core/codeBlockDom';
import '../styles/editor.css';

// Shows content written in the editor anywhere else in your app — a blog post page, a comment, a
// preview card. It renders with the same typography, tables, alerts and syntax-highlighted code as
// the editing area, so what authors saw is what readers get.
//
// Read-only interactions still work (switching code-block tabs, the Copy button); anything that
// edits (Edit / Delete / Add tab) is hidden in CSS.
//
// SERVER RENDERING: sanitizing needs a DOM, which doesn't exist on the server. So with the default
// `sanitize` the first render is empty and the content appears right after mount, before the browser
// paints. If your HTML is already trusted (cleaned on your server) pass `sanitize={false}` and it is
// rendered as-is — including in server-rendered HTML, which is what you want for SEO.
function ContentViewer({ html = '', sanitize = true, theme = 'light', className, style }) {
  const rootRef = useRef(null);

  const [safeHtml, setSafeHtml] = useState('');
  useIsomorphicLayoutEffect(() => {
    if (sanitize) setSafeHtml(sanitizeHtml(html));
  }, [html, sanitize]);
  const content = sanitize ? safeHtml : html;

  // 'auto' follows the visitor's system setting. Until the browser can be asked, it renders light so
  // the server render and the first client render agree.
  const [resolved, setResolved] = useState(theme === 'dark' ? 'dark' : 'light');
  useIsomorphicLayoutEffect(() => {
    if (theme !== 'auto') {
      setResolved(theme === 'dark' ? 'dark' : 'light');
      return undefined;
    }
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => setResolved(media?.matches ? 'dark' : 'light');
    apply();
    media?.addEventListener?.('change', apply);
    return () => media?.removeEventListener?.('change', apply);
  }, [theme]);

  useIsomorphicLayoutEffect(() => {
    ensureStyles(rootRef.current);
  }, []);

  const handleClick = (e) => {
    const tab = e.target.closest?.('.jc-code-tab');
    if (tab) {
      const block = getCodeBlockFromTarget(tab);
      if (block) switchTab(block, Number(tab.dataset.tab));
      return;
    }
    const copy = e.target.closest?.('.jc-code-action[data-action="copy"]');
    if (copy) {
      const block = getCodeBlockFromTarget(copy);
      if (block) copyActiveTab(block);
    }
  };

  return (
    <div
      ref={rootRef}
      data-theme={resolved}
      className={['jc-root', 'jc-viewer', className].filter(Boolean).join(' ')}
      style={style}
      onClick={handleClick}
    >
      <div className="jc-content" dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}

export default memo(ContentViewer);
