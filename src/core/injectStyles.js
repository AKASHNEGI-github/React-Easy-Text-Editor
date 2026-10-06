// Zero-config styling.
//
// The editor's whole stylesheet is also embedded in the JS bundle (it is needed anyway to build the
// print window — see printUtils.js). The first time an editor or viewer mounts in the browser, this
// checks whether the stylesheet is already on the page, and if it isn't, adds it. So
//
//     import { Editor } from 'react-easy-text-editor';
//     <Editor />
//
// just works, with no CSS import. Apps that render on the server, or that run a strict
// Content-Security-Policy (inline <style> blocked), should import the stylesheet instead:
//
//     import 'react-easy-text-editor/style.css';
//
// and nothing is injected, because the check below finds the editor's custom properties.
import css from '../styles/editor.css?inline';

const STYLE_ID = 'jc-editor-styles';

export function ensureStyles(rootEl) {
  if (typeof document === 'undefined' || !rootEl) return;
  if (document.getElementById(STYLE_ID)) return;
  // The theme tokens live on `.jc-root`. If they resolve, a stylesheet (ours, however it got
  // there) is already doing its job.
  if (window.getComputedStyle(rootEl).getPropertyValue('--jc-bg').trim()) return;

  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = css;
  // First in <head>, so any rule of your own with the same specificity still wins by coming later.
  document.head.insertBefore(el, document.head.firstChild);
}
