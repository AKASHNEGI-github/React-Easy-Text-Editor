// Kept deliberately separate from document.execCommand('undo'). execCommand
// edits get native undo for free, but plugins that touch the DOM directly
// (table insert, classname, font-size-as-span) bypass that stack entirely —
// so relying on native undo alone gives inconsistent results. This manager
// snapshots HTML instead, debounced so fast typing doesn't spam the stack.
export class HistoryManager {
  constructor({ getHTML, setHTML, onChange, isAvailable, limit = 100, debounceMs = 400 }) {
    this.getHTML = getHTML;
    this.setHTML = setHTML;
    // Called whenever snapshotNow() actually pushes a new entry. The
    // debounced path below is the one case where that happens on a timer,
    // well after the input event that triggered it — with nothing to
    // tell React a render is due, the toolbar's Undo/Redo buttons would
    // otherwise sit stale (e.g. still disabled right after typing) until
    // some unrelated event happened to re-render them.
    this.onChange = onChange;
    // Reports whether there's an actual live document to read right now.
    // Needed because snapshot() below is debounced: switching into source
    // view unmounts the contentEditable element (getHTML() would read it
    // back as '' — indistinguishable from a genuinely emptied document),
    // and on at least Chrome, removing a *focused* contentEditable element
    // fires one last native "input" event on its way out, which schedules
    // exactly that debounced snapshot. Left unguarded, it fires ~400ms
    // later while still in source view and pushes '' onto the undo stack
    // as if the user had deleted everything — so one Undo click after
    // visiting source view could wipe the whole document. Defaults to
    // always-available for any caller that doesn't pass one.
    this.isAvailable = isAvailable || (() => true);
    this.limit = limit;
    this.debounceMs = debounceMs;
    this.stack = [];
    this.index = -1;
    this.timer = null;
    this.suspended = false;
  }

  // Take an immediate snapshot (used right after mount, and by undo/redo
  // themselves so they don't get re-captured by the debounce).
  snapshotNow() {
    if (!this.isAvailable()) return; // nothing real to capture right now
    const html = this.getHTML();
    if (this.stack[this.index] === html) return;
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(html);
    if (this.stack.length > this.limit) this.stack.shift();
    this.index = this.stack.length - 1;
    this.onChange?.();
  }

  // Called on every input event; debounced so a whole burst of typing
  // becomes one history entry instead of one per keystroke.
  snapshot() {
    if (this.suspended) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.snapshotNow(), this.debounceMs);
  }

  // Commits a pending debounced snapshot early, if one is queued. undo/redo
  // both need this: clicking Undo within the debounce window (e.g. right
  // after finishing a drag-resize, or right after typing) used to cancel
  // that pending snapshot outright via clearTimeout with nothing to
  // replace it — so the change never made it into the stack at all, and
  // "Undo" silently skipped past it to whatever the last-committed state
  // was instead of undoing the thing the person just did. Flushing first
  // means that state is captured as its own step, so undo reverts exactly
  // one step back from it, the way a person clicking Undo right after an
  // edit would expect.
  flushPending() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.snapshotNow();
    }
  }

  canUndo() {
    return this.index > 0;
  }

  canRedo() {
    return this.index < this.stack.length - 1;
  }

  undo() {
    this.flushPending();
    if (!this.canUndo() || !this.isAvailable()) return;
    this.index -= 1;
    this.suspended = true;
    this.setHTML(this.stack[this.index]);
    this.suspended = false;
  }

  redo() {
    this.flushPending();
    if (!this.canRedo() || !this.isAvailable()) return;
    this.index += 1;
    this.suspended = true;
    this.setHTML(this.stack[this.index]);
    this.suspended = false;
  }
}

export default HistoryManager;
