import { normalizeListNesting } from '../core/domUtils';

export default {
  name: 'indent',
  button: {
    icon: 'indent',
    tooltip: 'Increase indent',
    type: 'instant',
    onClick: (editor) => {
      editor.exec('indent');
      // See normalizeListNesting: indenting a list item can leave a <ul>
      // sitting directly inside another <ul>, which a later list-type
      // toggle handles inconsistently. onInput() re-captures the fixed-up
      // result so it — not the momentarily-invalid intermediate shape —
      // is what history/onChange actually see.
      normalizeListNesting(editor.containerRef.current);
      editor.onInput();
    },
  },
};
