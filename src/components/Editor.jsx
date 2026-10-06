import { memo } from 'react';
import { allPlugins, toolbarRows as defaultToolbarRows } from '../plugins';
import { ensureStyles } from '../core/injectStyles';
import { useIsomorphicLayoutEffect } from '../core/useIsomorphicLayoutEffect';
import { EditorProvider, useEditor } from '../core/EditorContext';
import Toolbar from './Toolbar';
import TableTools from './TableTools';
import MediaTools from './MediaTools';
import LinkTools from './LinkTools';
import EditorCore from './EditorCore';
import SourceView from './SourceView';
import StatusBar from './StatusBar';
import Modal from './Modal';
import '../styles/editor.css';

// Numbers mean pixels (like Jodit's `height: 400`); strings pass through ('50%', '30rem', 'auto').
const toCss = (v) => (typeof v === 'number' ? `${v}px` : v);

function EditorShell({ toolbarRows, className, style, width, maxWidth, height, minHeight, maxHeight }) {
  const editor = useEditor();

  // Adds the stylesheet if the app hasn't imported it (see core/injectStyles.js).
  useIsomorphicLayoutEffect(() => {
    ensureStyles(editor.rootRef.current);
  }, []);

  const sized = height != null || minHeight != null || maxHeight != null;
  const classes = [
    'jc-root',
    sized && 'jc-root--sized',
    editor.fullscreen && 'jc-root--fullscreen',
    className,
  ].filter(Boolean).join(' ');
  // Full screen always fills the viewport, so the size props step aside while it's on.
  const box = editor.fullscreen
    ? undefined
    : {
        width: toCss(width),
        maxWidth: toCss(maxWidth),
        height: toCss(height),
        minHeight: toCss(minHeight),
        maxHeight: toCss(maxHeight),
      };
  const rootStyle = box || style ? { ...box, ...style } : undefined;

  return (
    <div ref={editor.rootRef} data-theme={editor.theme} className={classes} style={rootStyle}>
      <Toolbar rows={toolbarRows} />
      <div className="jc-body">
        {editor.mode === 'source' ? <SourceView /> : <EditorCore />}
        <TableTools />
        <MediaTools />
        <LinkTools />
      </div>
      <StatusBar />
      <Modal />
    </div>
  );
}

// Wrapped in memo() because of how `onChange` typically gets used: a host
// app almost always stores the latest HTML in its own state (to enable a
// Save button, show a live preview, etc.), and onChange fires on every
// single keystroke (see handleInput in EditorContext.jsx) — so the host's
// own component re-renders on every keystroke too, as a direct
// consequence of just wiring onChange up at all, not because it did
// anything wrong. Without memo, that re-render cascades into this
// component and everything below it (Toolbar and every one of its
// buttons, TableTools, MediaTools, LinkTools, StatusBar) on every single
// keystroke, for no reason: none of that subtree's own output depends on
// the host re-rendering, only on state living inside EditorProvider
// itself, which continues to trigger its own re-renders exactly as
// before regardless of this memo (memo only short-circuits a re-render
// forced from the *parent*; it has no effect on state changes originating
// inside this subtree). Confirmed via this project's own demo (App.jsx):
// typing became noticeably heavier over a longer session specifically
// because of this cascade, worsening as the document grew — larger
// content meant more DOM for every one of those unnecessary re-renders
// to reconcile against, on every keystroke, for the lifetime of the
// session. This only pays off if `plugins`/`toolbarRows`/`initialValue`
// are stable references from the host (module-level constants, as in
// this project's own App.jsx) — an inline `plugins={[...]}` literal
// recreated on every render would defeat it.
// `style` is compared shallowly (below) so `style={{ height: 500 }}` written inline
// doesn't defeat the memo above on every host render. Everything else is compared by
// identity, exactly like plain memo().
function shallowEqualStyle(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
}

function propsAreEqual(prev, next) {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const k of keys) {
    if (k === 'style') {
      if (!shallowEqualStyle(prev.style, next.style)) return false;
    } else if (prev[k] !== next[k]) {
      return false;
    }
  }
  return true;
}

// `plugins` and `toolbarRows` default to the full built-in set, so `<Editor />` works with
// no configuration. `width`/`height`/`minHeight`/`maxHeight` size the whole editor (toolbar and
// status bar included; the content scrolls inside). `className` and `style` land on the root
// element (`.jc-root`); because the root resets inherited styles (see editor.css), use `style`
// for anything else you want to set on it, including overriding `--jc-*` tokens.
const Editor = memo(function Editor({
  plugins = allPlugins,
  toolbarRows = defaultToolbarRows,
  initialValue,
  onChange,
  placeholder,
  theme,
  readOnly,
  width,
  maxWidth,
  height,
  minHeight,
  maxHeight,
  className,
  style,
}) {
  return (
    <EditorProvider
      plugins={plugins}
      initialValue={initialValue}
      onChange={onChange}
      theme={theme}
      placeholder={placeholder}
      readOnly={readOnly}
    >
      <EditorShell
        toolbarRows={toolbarRows}
        className={className}
        style={style}
        width={width}
        maxWidth={maxWidth}
        height={height}
        minHeight={minHeight}
        maxHeight={maxHeight}
      />
    </EditorProvider>
  );
}, propsAreEqual);

export default Editor;
