function makeCell(tag) {
  const cell = document.createElement(tag);
  cell.style.border = '1px solid #d1d5db';
  cell.style.padding = '6px 8px';
  cell.innerHTML = '<br>';
  return cell;
}

// Finds the <td>/<th> the current selection is inside, if any — this is
// what decides whether the contextual table bar shows at all.
export function getCellFromSelection(root) {
  // Runs while rendering: on the server (or before the editable element mounts) there is
  // no `root` and possibly no `window`, so bail out before touching the DOM.
  if (!root || typeof window === 'undefined') return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  let node = sel.anchorNode;
  if (!node || !root.contains(node)) return null;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  return node?.closest('td, th') || null;
}

export function cellIndex(cell) {
  return Array.prototype.indexOf.call(cell.parentElement.children, cell);
}

// Visual column index, accounting for colSpan on earlier cells in the row
// — needed by merge/split/resize, where DOM child index and "which
// column is this really" diverge once any cell spans more than one column.
export function visualColumnIndex(cell) {
  let idx = 0;
  let sib = cell.previousElementSibling;
  while (sib) {
    idx += sib.colSpan || 1;
    sib = sib.previousElementSibling;
  }
  return idx;
}

function cellAtVisualColumn(row, colIndex) {
  let acc = 0;
  for (const c of Array.from(row.children)) {
    if (acc === colIndex) return c;
    acc += c.colSpan || 1;
    if (acc > colIndex) return null; // colIndex falls inside another cell's span
  }
  return null;
}

// The table's visual column count - the widest row once colSpan is taken
// into account, not just the highest DOM child count. insertRow/
// deleteColumn below need this instead of a plain `.children.length`
// because a row containing a merged cell has fewer DOM children than the
// table actually has columns.
function tableVisualWidth(table) {
  let max = 0;
  table.querySelectorAll('tr').forEach((row) => {
    const width = Array.from(row.children).reduce((sum, c) => sum + (c.colSpan || 1), 0);
    if (width > max) max = width;
  });
  return max;
}

export function setCellStyle(cell, prop, value) {
  cell.style[prop] = value;
}

export function setCellAlign(cell, align) {
  cell.style.textAlign = align;
}

export function emptyCell(cell) {
  cell.innerHTML = '<br>';
}

// Merge with the cell immediately to the right, in the same row.
export function mergeRight(cell) {
  const next = cell.nextElementSibling;
  if (!next) return;
  const a = cell.innerHTML.replace(/^\s*<br\s*\/?>\s*$/i, '').trim();
  const b = next.innerHTML.replace(/^\s*<br\s*\/?>\s*$/i, '').trim();
  cell.innerHTML = [a, b].filter(Boolean).join(' ') || '<br>';
  cell.colSpan = (cell.colSpan || 1) + (next.colSpan || 1);
  next.remove();
}

// Merge with the cell directly below, in the same visual column.
export function mergeDown(cell) {
  const row = cell.parentElement;
  const table = row.closest('table');
  const rows = Array.from(table.querySelectorAll('tr'));
  const rowIdx = rows.indexOf(row);
  if (rowIdx === -1 || rowIdx + (cell.rowSpan || 1) >= rows.length) return;
  const nextRow = rows[rowIdx + (cell.rowSpan || 1)];
  const target = cellAtVisualColumn(nextRow, visualColumnIndex(cell));
  if (!target) return;
  const a = cell.innerHTML.replace(/^\s*<br\s*\/?>\s*$/i, '').trim();
  const b = target.innerHTML.replace(/^\s*<br\s*\/?>\s*$/i, '').trim();
  cell.innerHTML = [a, b].filter(Boolean).join(' ') || '<br>';
  cell.rowSpan = (cell.rowSpan || 1) + (target.rowSpan || 1);
  target.remove();
}

// Splits are the inverse of merge — only meaningful on a cell that
// currently spans more than one column/row (i.e. one that came from a
// merge). Handles the common single-level case; deeply irregular
// pre-existing spans aren't guaranteed to come out perfectly.
export function splitVertical(cell) {
  if ((cell.colSpan || 1) <= 1) return;
  cell.colSpan -= 1;
  cell.after(makeCell(cell.tagName.toLowerCase()));
}

export function splitHorizontal(cell) {
  if ((cell.rowSpan || 1) <= 1) return;
  const row = cell.parentElement;
  const table = row.closest('table');
  const rows = Array.from(table.querySelectorAll('tr'));
  const rowIdx = rows.indexOf(row);
  cell.rowSpan -= 1;
  const targetRow = rows[rowIdx + cell.rowSpan];
  if (!targetRow) return;
  const colIdx = visualColumnIndex(cell);
  let acc = 0;
  let insertBefore = null;
  for (const c of Array.from(targetRow.children)) {
    if (acc >= colIdx) {
      insertBefore = c;
      break;
    }
    acc += c.colSpan || 1;
  }
  const newCell = makeCell(cell.tagName.toLowerCase());
  if (insertBefore) targetRow.insertBefore(newCell, insertBefore);
  else targetRow.appendChild(newCell);
}

// Sets one column's width across every row — used by the drag-to-resize
// handles. Switches the table to table-layout:fixed so explicit widths
// are actually honored instead of fighting content-based auto sizing.
export function setColumnWidth(table, colIndex, width) {
  table.style.tableLayout = 'fixed';
  table.querySelectorAll('tr').forEach((row) => {
    const cell = cellAtVisualColumn(row, colIndex);
    if (cell) cell.style.width = `${width}px`;
  });
}

// A new row needs one cell per VISUAL column in the table, not one per DOM
// child of whichever row you happened to click in - those diverge as soon
// as that row contains a merged (colSpan > 1) cell, which used to leave the
// freshly-inserted row too short and the table's grid out of alignment.
export function insertRow(cell, after) {
  const row = cell.parentElement;
  const table = row.closest('table');
  const width = tableVisualWidth(table);
  const tag = row.children[0]?.tagName.toLowerCase() || 'td';
  const newRow = document.createElement('tr');
  for (let i = 0; i < width; i += 1) newRow.appendChild(makeCell(tag));
  row.parentElement.insertBefore(newRow, after ? row.nextSibling : row);
}

// Visual-column-aware insert: `boundary` is the column line the new column
// goes at, computed once from the clicked cell and then applied the same
// way to every row. A row whose own cells happen to meet exactly at that
// line gets a new cell dropped in there; a row where the line instead falls
// INSIDE an existing colSpan cell (e.g. a merged header) has that cell's
// span widened by one instead - it grows to cover the new column rather
// than the table quietly falling out of alignment (see cellIndex, which is
// only a raw DOM-child index and knows nothing about spans).
export function insertColumn(cell, after) {
  const table = cell.closest('table');
  const boundary = visualColumnIndex(cell) + (after ? cell.colSpan || 1 : 0);
  table.querySelectorAll('tr').forEach((row) => {
    let acc = 0;
    const cells = Array.from(row.children);
    for (const c of cells) {
      const span = c.colSpan || 1;
      if (boundary === acc) {
        row.insertBefore(makeCell(c.tagName.toLowerCase()), c);
        return;
      }
      if (boundary < acc + span) {
        c.colSpan = span + 1; // boundary falls inside this cell's span - widen it
        return;
      }
      acc += span;
    }
    // The boundary sits at/after this row's own visual width - e.g. a row
    // shortened by a rowSpan continuation from a row above it. Append so
    // every row still gains exactly one cell.
    const template = cells[cells.length - 1];
    row.appendChild(makeCell(template ? template.tagName.toLowerCase() : 'td'));
  });
}

export function deleteRow(cell) {
  const row = cell.parentElement;
  const table = row.closest('table');
  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length <= 1) {
    table.remove();
    return;
  }
  const rowIdx = rows.indexOf(row);
  const nextRow = rows[rowIdx + 1] || null;

  // Cells in THIS row that vertically span past it need to move down into
  // the next row first, content and remaining span intact - otherwise
  // deleting the row would silently delete that content with no trace.
  // Visual columns are captured up front, before anything is moved, since
  // relocating a cell changes the previousElementSibling chain that
  // visualColumnIndex walks for whatever is still left in this row.
  const spanning = Array.from(row.children)
    .filter((c) => (c.rowSpan || 1) > 1)
    .map((c) => ({ c, col: visualColumnIndex(c) }));

  spanning.forEach(({ c, col }) => {
    c.rowSpan -= 1;
    if (!nextRow) return;
    let acc = 0;
    let insertBefore = null;
    for (const nc of Array.from(nextRow.children)) {
      if (acc >= col) {
        insertBefore = nc;
        break;
      }
      acc += nc.colSpan || 1;
    }
    if (insertBefore) nextRow.insertBefore(c, insertBefore);
    else nextRow.appendChild(c);
  });

  // Any cell in an EARLIER row whose span reached through this row shrinks
  // by one now that a row it used to cover is gone, so it doesn't silently
  // over-span past the table's new row count.
  rows.forEach((r, i) => {
    if (i >= rowIdx) return;
    Array.from(r.children).forEach((c) => {
      const span = c.rowSpan || 1;
      if (i + span > rowIdx) c.rowSpan = span - 1;
    });
  });

  row.remove();
}

// Visual-column-aware delete, mirroring insertColumn: a column passing
// through a plain cell removes it, but a column passing through a colSpan
// cell (e.g. a merged header) just shrinks that cell's span by one instead
// - the previous cellIndex-based version compared raw DOM child counts, so
// a single merged header cell (one DOM child) made deleteColumn think the
// table had only one column left and delete the WHOLE table out from under
// an edit made three ordinary rows below it.
export function deleteColumn(cell) {
  const table = cell.closest('table');
  const colIndex = visualColumnIndex(cell);
  if (tableVisualWidth(table) <= 1) {
    table.remove();
    return;
  }
  table.querySelectorAll('tr').forEach((row) => {
    let acc = 0;
    for (const c of Array.from(row.children)) {
      const span = c.colSpan || 1;
      if (colIndex >= acc && colIndex < acc + span) {
        if (span > 1) c.colSpan = span - 1;
        else c.remove();
        return;
      }
      acc += span;
    }
  });
}

export function deleteTable(cell) {
  cell.closest('table')?.remove();
}

// Tab inside a table cell currently does the browser's default thing —
// moves focus off the editor entirely, onto whatever's next in the page's
// tab order — instead of the Word/Excel/Google Docs convention of hopping
// to the next cell (and adding a row from the last cell of the last row).
// Returns true when it handled the key, so the caller preventDefault()s
// and keeps focus inside the editor.
export function handleTableTabKeyDown(editor, e) {
  if (e.key !== 'Tab') return false;
  const root = editor.containerRef.current;
  const cell = getCellFromSelection(root);
  if (!cell) return false;

  e.preventDefault();
  const row = cell.parentElement;
  const table = row.closest('table');
  const rows = Array.from(table.querySelectorAll('tr'));
  const rowIdx = rows.indexOf(row);
  const idxInRow = Array.prototype.indexOf.call(row.children, cell);

  let target;
  let addedRow = false;
  if (e.shiftKey) {
    if (idxInRow > 0) {
      target = row.children[idxInRow - 1];
    } else if (rowIdx > 0) {
      const prevRow = rows[rowIdx - 1];
      target = prevRow.children[prevRow.children.length - 1];
    }
  } else if (idxInRow < row.children.length - 1) {
    target = row.children[idxInRow + 1];
  } else if (rowIdx < rows.length - 1) {
    target = rows[rowIdx + 1].children[0];
  } else if (!editor.locked) {
    // Only add a row when the document isn't locked — everything else in
    // this function is pure navigation (safe even read-only), but this
    // one branch is a genuine content change.
    insertRow(cell, true);
    addedRow = true;
    const newRows = Array.from(table.querySelectorAll('tr'));
    target = newRows[newRows.length - 1]?.children[0];
  }

  if (target) {
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    editor.selection.save();
  }
  if (addedRow) editor.onInput();
  return true;
}

export function toggleHeaderRow(cell) {
  const table = cell.closest('table');
  const firstRow = table.querySelector('tr');
  if (!firstRow) return;
  const isHeader = firstRow.children[0]?.tagName === 'TH';
  const newTag = isHeader ? 'td' : 'th';
  Array.from(firstRow.children).forEach((c) => {
    const replacement = document.createElement(newTag);
    replacement.innerHTML = c.innerHTML;
    replacement.style.cssText = c.style.cssText;
    replacement.style.background = isHeader ? '' : '#f7f7f8';
    c.replaceWith(replacement);
  });
}
