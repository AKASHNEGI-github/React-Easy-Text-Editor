import InsertCodeForm from '../components/popups/InsertCodeForm';
import AddTabForm from '../components/popups/AddTabForm';
import { getCodeBlockFromTarget, switchTab, copyActiveTab, toggleEditActiveTab, deleteActiveTab, deleteBlock } from '../core/codeBlockDom';

// The widget's own buttons (tabs, copy, edit, delete, add-tab) are plain
// DOM elements inside contentEditable="false" content, not React — so
// they're wired up with one delegated click listener on the editor root,
// attached once via this plugin's init() hook, rather than per-button
// handlers.
// Per-instance state, keyed by each editor's own rootRef object (stable
// for that editor's whole lifetime - see EditorContext.jsx). allPlugins is
// one module-level array shared by every <Editor> mounted on the page, so
// storing _handler/_root directly on this plugin object (as `this._x =`)
// would have every instance overwrite the same fields: mount a second
// editor and the first one's init() state is gone, so when the first
// editor later unmounts, destroy() removes the SECOND editor's still-in-
// use listener instead of the first editor's own — breaking the second
// editor's code blocks even though it never unmounted.
const instances = new WeakMap();

function handleDelegatedClick(editor) {
  return (e) => {
    const addTabBtn = e.target.closest('.jc-code-tab-add');
    if (addTabBtn) {
      // isLocked(), not the plain `locked` boolean: this whole function
      // is captured exactly once (in init() below) and kept alive for
      // the editor's whole lifetime, so it needs the always-fresh
      // accessor - see the lockedRef comment in EditorContext.jsx for
      // why a plain captured `editor.locked` here would silently never
      // update after the very first render, defeating this check
      // entirely the moment Lock was toggled on for the first time.
      if (editor.isLocked()) return;
      const block = getCodeBlockFromTarget(addTabBtn);
      if (block) {
        editor.openPopup('addCodeTab', (ed, close) => (
          <AddTabForm editor={ed} block={block} onClose={close} />
        ), false, true); // persistent: a pasted-in code snippet is too easy to lose to a stray click
      }
      return;
    }

    // Switching tabs is just navigation, not a content change — safe to
    // leave enabled even in read-only/locked mode.
    const tab = e.target.closest('.jc-code-tab');
    if (tab) {
      const block = getCodeBlockFromTarget(tab);
      if (block) switchTab(block, Number(tab.dataset.tab));
      return;
    }

    const actionBtn = e.target.closest('.jc-code-action');
    if (!actionBtn) return;
    const block = getCodeBlockFromTarget(actionBtn);
    if (!block) return;
    const action = actionBtn.dataset.action;
    // 'copy' reads content out, same as the toolbar's own Copy button —
    // fine while locked. Every other action mutates the document.
    // isLocked() here for the same reason as addTabBtn above.
    if (editor.isLocked() && action !== 'copy') return;
    switch (action) {
      case 'copy':
        copyActiveTab(block);
        break;
      case 'edit':
        if (toggleEditActiveTab(block)) editor.onInput();
        break;
      case 'delete-tab':
        deleteActiveTab(block);
        editor.onInput();
        break;
      case 'delete-block':
        deleteBlock(block);
        editor.onInput();
        break;
      default:
        break;
    }
  };
}

export default {
  name: 'insertCode',
  init(editor) {
    // Bound to .jc-root (via rootRef), NOT the contentEditable itself.
    // The contentEditable node is destroyed and recreated every time the
    // editor switches into "View content in HTML output" and back
    // (EditorCore unmounts/remounts — see EditorShell) — a listener
    // attached directly to it would silently stop receiving events the
    // first time that happens, which is exactly why tabs/copy/edit/
    // delete/add-tab used to stop working "after a while." .jc-root is
    // mounted once for the editor's whole lifetime, so delegating from
    // there keeps working no matter how many times the content area
    // underneath it gets swapped out.
    const root = editor.rootRef.current;
    if (!root) return;
    const handler = handleDelegatedClick(editor);
    instances.set(editor.rootRef, { handler, root });
    root.addEventListener('click', handler);
  },
  destroy(editor) {
    const entry = instances.get(editor.rootRef);
    if (!entry) return;
    entry.root.removeEventListener('click', entry.handler);
    instances.delete(editor.rootRef);
  },
  button: {
    icon: 'code',
    tooltip: 'Insert code',
    type: 'popup',
    large: true,
    // Same reasoning as the addCodeTab popup above — this is the form
    // that builds the block's very first tab, just as easy to lose.
    persistent: true,
    renderPopup: (editor, close) => <InsertCodeForm editor={editor} onClose={close} />,
  },
};
