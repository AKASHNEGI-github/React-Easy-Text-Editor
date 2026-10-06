import { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { SelectionManager } from './SelectionManager';
import { CommandRegistry } from './CommandRegistry';
import { HistoryManager } from './HistoryManager';
import { getInitialTheme, persistTheme } from './themeStorage';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect';
import { sanitizeHtml } from './sanitize';

const EditorContext = createContext(null);


export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor() must be used inside <EditorProvider>');
  return ctx;
}

export function EditorProvider({ plugins, initialValue, onChange, theme: themeProp, placeholder, readOnly, children }) {
  const containerRef = useRef(null);
  // Points at the outer .jc-root shell, which is mounted once and lives
  // for the whole life of the editor. containerRef, by contrast, gets
  // reassigned to a brand-new DOM node every time EditorCore
  // unmounts/remounts (which happens on every switch into "view HTML
  // source" and back — see EditorShell). Plugins that attach a DOM
  // listener once in init() and expect it to keep working forever (e.g.
  // codeBlock's click delegation) need to bind to something that never
  // gets swapped out from under them — this ref is that anchor.
  const rootRef = useRef(null);
  // Set by EditorCore's onMouseDown, read by MediaTools via
  // getMediaFromSelection's `preferred` param — see the comment on that
  // function for why the selection alone can't always tell which of two
  // side-by-side images/videos was actually clicked.
  const lastClickedMediaRef = useRef(null);
  const selectionRef = useRef(null);
  const commandsRef = useRef(null);
  const historyRef = useRef(null);
  const apiRef = useRef(null); // always holds the *current* render's api — closures below read this, not a stale one
  const sourceContentRef = useRef(''); // HTML captured the instant source mode is entered — see changeMode below

  const [mode, setMode] = useState('wysiwyg'); // 'wysiwyg' | 'source'
  const [fullscreen, setFullscreen] = useState(false);
  // The toolbar's Lock button flips `lockedState`; the `readOnly` prop locks the editor from the
  // outside and wins over it (the button then does nothing).
  const [lockedState, setLocked] = useState(false);
  const locked = !!readOnly || lockedState;
  // A plain captured `editor.locked` boolean is fine for anything read
  // through useEditor() during a normal render (Context correctly
  // re-renders consumers with the current value) - but codeBlock.jsx's
  // init() hook captures its whole `editor` argument exactly ONCE, in a
  // click listener meant to keep working for the editor's entire
  // lifetime (see the comment on that plugin's init() for why it has to
  // be set up that way). Every render below builds a brand new `api`
  // object, so a plain `locked` property baked into that first, one-time
  // snapshot stays permanently frozen at whatever it was at mount (i.e.
  // false) - toggling Lock later never changes what that specific
  // captured object holds, and the code-block widget's own locked check
  // would silently pass an unlocked check forever, letting edit/delete-
  // tab/add-tab keep working right through Lock being turned on. This
  // ref is mutated in place instead of replaced, so isLocked() below
  // keeps reading the *current* value no matter how old the particular
  // closure calling it is.
  const lockedRef = useRef(locked);
  // Always starts as 'light' so the server render and the first client render agree
  // (reading localStorage / prefers-color-scheme during render would produce a hydration
  // mismatch under Next.js and friends). The saved/system preference is applied in a layout
  // effect right after mount — before the browser paints — so client-only apps never see a flash.
  // An explicit `theme` prop wins over the saved/system preference, on mount and whenever it changes.
  const [theme, setThemeState] = useState(themeProp || 'light');
  useIsomorphicLayoutEffect(() => {
    setThemeState(themeProp || getInitialTheme());
  }, [themeProp]);
  const [activePopup, setActivePopup] = useState(null); // { name, render } | null
  const [, forceRender] = useState(0);
  const bump = useCallback(() => forceRender((v) => v + 1), []);

  const toggleTheme = useCallback(() => {
    setThemeState((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      // When the host app drives the theme through the `theme` prop, don't also store a preference.
      if (!themeProp) persistTheme(next);
      return next;
    });
  }, [themeProp]);

  // Syntax-highlighting colors need no JS: hljs-scoped.css ships both the light and dark
  // palettes, scoped to `.jc-root[data-theme]`, so the `data-theme` attribute on the root
  // element is all that switches them (see scripts/generate-hljs-css.mjs).

  if (!selectionRef.current) selectionRef.current = new SelectionManager(containerRef);
  if (!commandsRef.current) commandsRef.current = new CommandRegistry();

  const getHTML = useCallback(() => containerRef.current?.innerHTML ?? '', []);
  const setHTMLInternal = useCallback(
    (html) => {
      if (containerRef.current) {
        // Sanitized here rather than on the way out: this is the one
        // choke point that every source of "content from outside this
        // editor's own live DOM" already passes through — undo/redo
        // replay, committing out of source-view, and (via editor.setHTML)
        // whatever the host app loads in from its database — so it's
        // where a script tag or an on-click handler that got saved by
        // some other path gets stopped before it can run again.
        const clean = sanitizeHtml(html);
        containerRef.current.innerHTML = clean;
        onChange?.(clean);
      }
    },
    [onChange]
  );

  if (!historyRef.current) {
    historyRef.current = new HistoryManager({
      getHTML,
      setHTML: setHTMLInternal,
      onChange: bump,
      isAvailable: () => !!containerRef.current,
    });
  }

  const exec = useCallback(
    (name, value) => {
      selectionRef.current.restore();
      commandsRef.current.exec(apiRef.current, name, value);
      onChange?.(getHTML());
      bump();
    },
    [bump, getHTML, onChange]
  );

  const handleInput = useCallback(() => {
    // A contentEditable element that's mid-unmount (e.g. switching into
    // source view while it's focused) can still fire one last native
    // "input" event on the way out — see the isAvailable comment on
    // HistoryManager for why. Without this guard, getHTML() below would
    // read back '' at that moment and hand it straight to the host app's
    // onChange as if the document had just been emptied.
    if (!containerRef.current) return;
    historyRef.current.snapshot();
    onChange?.(getHTML());
  }, [getHTML, onChange]);

  const openPopup = useCallback((name, render, large, persistent) => setActivePopup({ name, render, large, persistent }), []);
  const closePopup = useCallback(() => setActivePopup(null), []);

  const undo = useCallback(() => {
    historyRef.current.undo();
    onChange?.(getHTML());
    bump();
  }, [bump, getHTML, onChange]);

  const redo = useCallback(() => {
    historyRef.current.redo();
    onChange?.(getHTML());
    bump();
  }, [bump, getHTML, onChange]);

  const setHTML = useCallback(
    (html) => {
      setHTMLInternal(html);
      historyRef.current.snapshotNow();
      bump();
    },
    [bump, setHTMLInternal]
  );

  // Switching to 'source' mode unmounts EditorCore and mounts SourceView
  // in the same render. By the time SourceView's own effects run, React
  // has already nulled containerRef.current (it happens synchronously
  // during commit, before any effect fires) — so SourceView calling
  // getHTML() itself reads empty. The fix is capturing the HTML *here*,
  // synchronously in this same click-handler tick, while EditorCore is
  // still mounted and the ref is still valid — before setMode even runs.
  const changeMode = useCallback(
    (newMode) => {
      if (newMode === 'source' && mode !== 'source') {
        sourceContentRef.current = getHTML();
      }
      setMode(newMode);
    },
    [mode, getHTML]
  );

  // Register every plugin's custom commands + run init(), on mount. No
  // "only once" guard here on purpose: StrictMode intentionally runs this
  // as mount -> cleanup -> mount to catch exactly the bug a guard like
  // that causes — init() attaches things (e.g. codeBlock's click
  // delegation), destroy() removes them, and a guard that blocks the
  // second init() leaves things permanently torn down. Every step here is
  // safe to run more than once: content-loading and command registration
  // are idempotent, and historyRef.current.snapshotNow() already no-ops
  // if nothing changed since the last snapshot.
  useEffect(() => {
    if (containerRef.current && initialValue) {
      // Sanitized on the way in — see setHTMLInternal above for why this
      // is the boundary that matters. initialValue is the one entry
      // point that boundary doesn't already cover, since it lands
      // directly in the DOM before any editor.setHTML() call exists to
      // pass through.
      containerRef.current.innerHTML = sanitizeHtml(initialValue);
    }

    plugins.forEach((plugin) => {
      Object.entries(plugin.commands || {}).forEach(([name, handler]) => {
        commandsRef.current.register(name, handler);
      });
    });
    plugins.forEach((plugin) => plugin.init?.(apiRef.current));
    historyRef.current.snapshotNow();

    return () => plugins.forEach((plugin) => plugin.destroy?.(apiRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute toolbar active-state whenever the selection moves inside the editor.
  useEffect(() => {
    const handler = () => {
      const root = containerRef.current;
      const sel = window.getSelection();
      if (!root || !sel || sel.rangeCount === 0) return;
      if (root.contains(sel.anchorNode)) {
        selectionRef.current.save();
        bump();
      }
    };
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, [bump]);

  const api = {
    containerRef,
    rootRef,
    lastClickedMediaRef,
    mode,
    setMode: changeMode,
    getSourceContent: () => sourceContentRef.current,
    fullscreen,
    toggleFullscreen: () => setFullscreen((f) => !f),
    locked,
    // Stable, always-fresh accessor for the same value - see the
    // lockedRef comment above for exactly why plain `locked` isn't
    // enough for every consumer of this object. Everything that reads
    // state through useEditor() during a normal render should keep using
    // the plain `locked` boolean above (it's simpler, and Context
    // re-renders make it correct there); isLocked() exists specifically
    // for the one-time-captured-closure case.
    isLocked: () => lockedRef.current,
    toggleLock: () => {
      if (!readOnly) setLocked((l) => !l);
    },
    theme,
    toggleTheme,
    placeholder,
    exec,
    queryState: (name, value) => commandsRef.current.queryState(name, value),
    queryValue: (name) => commandsRef.current.queryValue(name),
    registerCommand: (name, handler) => commandsRef.current.register(name, handler),
    selection: selectionRef.current,
    history: {
      undo,
      redo,
      canUndo: () => historyRef.current.canUndo(),
      canRedo: () => historyRef.current.canRedo(),
      snapshot: () => historyRef.current.snapshot(),
    },
    getHTML,
    setHTML,
    onInput: handleInput,
    openPopup,
    closePopup,
    activePopup,
  };
  apiRef.current = api; // keep the ref current *after* every render for the closures above
  lockedRef.current = locked;

  return <EditorContext.Provider value={api}>{children}</EditorContext.Provider>;
}

export default EditorContext;
