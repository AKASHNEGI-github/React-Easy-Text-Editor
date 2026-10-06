# react-easy-text-editor

A rich text (WYSIWYG) editor for React, inspired by [Jodit](https://xdsoft.net/jodit/) and built to be just as easy to start with: one install, one component, nothing to configure.

```bash
npm install react-easy-text-editor
```

```jsx
import { Editor } from 'react-easy-text-editor';

export default function App() {
  return <Editor height={400} onChange={(html) => console.log(html)} />;
}
```

That's the whole setup. The styles come with the component, so there is no CSS file to import.

- Full toolbar out of the box: text formatting, fonts and colors, lists, alignment, headings, links, images, video, tables, tabbed code blocks with syntax highlighting, alerts, find & replace, full screen, light/dark theme, preview, print and an HTML source view
- `<ContentViewer />` shows the saved content anywhere else in your app
- Size it like Jodit: `width`, `height`, `minHeight`, `maxHeight`
- Doesn't fight your app's CSS: works next to Tailwind, Bootstrap, the Vite template and plain resets
- TypeScript types included; ESM and CommonJS builds; works with React 17, 18 and 19; safe to import on the server (tested with Next.js)

## Contents

[Saving and loading content](#saving-and-loading-content) · [Size and layout](#size-and-layout) · [Showing content outside the editor](#showing-content-outside-the-editor) · [Props](#props) · [Theming](#theming) · [Styles and CSS conflicts](#styles-and-css-conflicts) · [Next.js and server rendering](#nextjs-and-server-rendering) · [Customizing the toolbar](#customizing-the-toolbar) · [Writing a plugin](#writing-a-plugin) · [CommonJS](#commonjs) · [Security](#security)

## Saving and loading content

The editor produces plain HTML. `onChange` gives you the current HTML after every change; `initialValue` loads HTML when the editor first mounts.

```jsx
import { useState } from 'react';
import { Editor } from 'react-easy-text-editor';

function PostForm({ post }) {
  const [html, setHtml] = useState(post.body);

  return (
    <>
      <Editor initialValue={post.body} onChange={setHtml} />
      <button onClick={() => save(html)}>Save</button>
    </>
  );
}
```

- `initialValue` is read once, on mount. To load different content later (for example after a fetch), change the component's `key`: `<Editor key={post.id} initialValue={post.body} />`.
- Pass a stable `onChange` (a `useState` setter, or a function wrapped in `useCallback`). A new inline function on every render makes the editor re-render along with its parent.

## Size and layout

Numbers are pixels, strings are any CSS length. The options mirror Jodit's.

```jsx
<Editor height={400} />                        {/* exactly 400px tall; content scrolls inside */}
<Editor minHeight={300} maxHeight={700} />     {/* grows with the content between 300 and 700px */}
<Editor width={800} />                         {/* 800px wide */}
<Editor width="100%" height="60vh" />
<Editor maxWidth={720} />                      {/* full width, but never wider than 720px */}
```

`height` sizes the whole editor, toolbar and status bar included, and the writing area scrolls inside it. With no height set, the editor grows with its content up to 70% of the window height, then scrolls. Full screen always fills the window and hands the size back when you leave it.

## Showing content outside the editor

`ContentViewer` displays HTML that the editor produced, with the same typography, tables, alerts and syntax-highlighted code blocks, but without the toolbar and border. Use it for blog posts, comments, previews, or anywhere readers see the content.

```jsx
import { ContentViewer } from 'react-easy-text-editor';

function Post({ post }) {
  return (
    <article>
      <h1>{post.title}</h1>
      <ContentViewer html={post.body} />
    </article>
  );
}
```

Code-block tabs and the Copy button work; the editing actions (Edit, Delete, Add tab) are hidden.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `html` | `string` | `''` | The HTML to show. |
| `sanitize` | `boolean` | `true` | Removes scripts, `on*` handlers and `javascript:` links before showing the HTML. See the note below. |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'light'` | `'auto'` follows the visitor's system setting. |
| `className` | `string` | | Extra class on the viewer's root element. |
| `style` | `CSSProperties` | | Inline style: font size, font family, `--jc-*` colors. |

The viewer reads at 16px and has no background of its own. Match your site with `style`:

```jsx
<ContentViewer html={html} style={{ fontSize: 18, '--jc-font-family': 'Inter, sans-serif', '--jc-text': '#222' }} />
```

**Server rendering.** Sanitizing needs a browser DOM, so with the default `sanitize` the viewer's first server render is empty and the content appears as soon as the page loads in the browser. If your HTML is already trusted (for example cleaned on your server before it was stored), pass `sanitize={false}`: the content is then rendered as-is, including in the server-rendered HTML that search engines see.

## Props

`<Editor />`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `initialValue` | `string` | | HTML to load on mount. |
| `onChange` | `(html: string) => void` | | Called with the current HTML after every change. |
| `placeholder` | `string` | | Text shown while the editor is empty. |
| `height` | `number \| string` | auto | Height of the whole editor. |
| `minHeight` | `number \| string` | | The editor is never shorter than this. |
| `maxHeight` | `number \| string` | | The editor is never taller than this; content scrolls. |
| `width` | `number \| string` | `100%` of the container | Width of the editor. |
| `maxWidth` | `number \| string` | | The editor is never wider than this. |
| `theme` | `'light' \| 'dark'` | saved choice, else system | Forces the theme and follows it if the value changes. The toolbar's theme button still works. |
| `readOnly` | `boolean` | `false` | Locks the content. The toolbar's Lock button can't unlock it. |
| `toolbarRows` | `ToolbarItem[][]` | the default two rows | Which buttons appear and in what order. |
| `plugins` | `Plugin[]` | all built-in plugins | Plugins to register. |
| `className` | `string` | | Extra class on the root element. |
| `style` | `CSSProperties` | | Inline style on the root element (`--jc-*` tokens allowed). |

## Theming

The look is driven by CSS custom properties that all begin with `--jc-`. Set them from CSS or from the `style` prop.

```css
.jc-root {
  --jc-accent: #e11d48;
  --jc-accent-rgb: 225, 29, 72;   /* the same color as r, g, b (used for translucent highlights) */
}
```

```jsx
<Editor style={{ '--jc-accent': '#e11d48', '--jc-accent-rgb': '225, 29, 72' }} />
```

| Variable | What it controls |
| --- | --- |
| `--jc-bg`, `--jc-surface` | Editor and toolbar backgrounds |
| `--jc-text`, `--jc-text-muted` | Text colors |
| `--jc-border` | Borders |
| `--jc-accent`, `--jc-accent-rgb`, `--jc-accent-soft` | Links, active buttons, highlights (`-rgb` is the same color written as `r, g, b`) |
| `--jc-font-family` | Font used by the editor and viewer |
| `--jc-content-min-height` | Minimum height of the writing area (default `260px`) |
| `--jc-body-max-height` | Height cap of the writing area when no `height` is set (default `70vh`) |
| `--jc-z-fullscreen`, `--jc-z-modal` | Stacking order of full screen (`1000`) and dialogs (`1100`) |

The dark palette is the same set of variables under `.jc-root[data-theme='dark']`. There are more (alert colors, find-highlight colors, shadows); they are all declared at the top of `style.css`.

## Styles and CSS conflicts

The stylesheet is built so that it neither leaks into your page nor gets broken by it:

- **Everything is scoped.** Every rule starts with `.jc-root`. There are no bare element selectors and no `:root`, `html` or `body` rules, so nothing here can restyle your app.
- **Your global CSS can't reach in.** The editor's root starts from a clean slate (`all: initial`), so `text-align`, `line-height`, `letter-spacing` and similar set on `body` or your wrapper don't flow in, and its internal sizing no longer depends on a global `box-sizing` rule. Host rules such as `button:hover { ... }` can't win against the editor's controls.
- **Resets don't strip the content.** Tailwind's preflight, Bootstrap's reboot, normalize.css and similar remove bullets, bold headings and link underlines. The writing area restores them.

This was verified in Chromium by rendering the real build on a clean page and on pages loaded with the Vite React template CSS, Bootstrap 5, normalize.css, Tailwind 3 and 4, and a deliberately hostile stylesheet, in both load orders, across 12 UI states (hover, keyboard focus, open menus, dialogs, source view, dark theme, full screen, the viewer). The computed styles and the rendered pixels of every element were identical to the clean page.

**Customizing.** Prefer the `--jc-*` variables. If you need to override a rule directly, match its weight: because rules are scoped, `.jc-btn` ships as `.jc-root .jc-btn`, so write `.my-app .jc-root .jc-btn { ... }`.

**Where the CSS comes from.** The first time an editor or viewer mounts in the browser, it adds its stylesheet to `<head>` unless it is already there. For server-rendered pages, or sites with a strict Content-Security-Policy that blocks inline `<style>`, import the stylesheet yourself; nothing is injected when it's present:

```js
import 'react-easy-text-editor/style.css';
```

## Next.js and server rendering

The package ships with a `"use client"` directive, so it works directly from the App Router. Import the stylesheet in your layout so server-rendered pages are styled before the JavaScript loads:

```jsx
// app/layout.js
import 'react-easy-text-editor/style.css';
```

```jsx
// app/editor/page.js — a Server Component can render it as long as you don't pass functions
import { Editor } from 'react-easy-text-editor';

export default function Page() {
  return <Editor height={400} initialValue="<p>Hello</p>" />;
}
```

To use `onChange`, put the editor in your own Client Component (`'use client'` at the top of the file). The toolbar is part of the server-rendered HTML; the writing area is filled in as soon as the page loads in the browser.

## Customizing the toolbar

`toolbarRows` is an array of rows, each an array of plugins and `SEPARATOR`s. Pick plugins from `allPlugins` by name:

```jsx
import { Editor, allPlugins, SEPARATOR } from 'react-easy-text-editor';

const pick = (...names) => names.map((name) => allPlugins.find((p) => p.name === name));

const toolbarRows = [
  [...pick('bold', 'italic', 'underline'), SEPARATOR, ...pick('insertLink', 'insertImage', 'insertTable'), SEPARATOR, ...pick('sourceMode')],
];

<Editor toolbarRows={toolbarRows} />
```

Leave `plugins` alone: it defaults to all built-in plugins, which keeps features such as table editing working even when their buttons are hidden.

Built-in plugin names: `undo`, `redo`, `bold`, `italic`, `underline`, `strikeThrough`, `superscript`, `subscript`, `fontFamily`, `fontSize`, `color`, `clearFormatting`, `orderedList`, `unorderedList`, `outdent`, `indent`, `align`, `formatBlock`, `lineHeight`, `alert`, `sourceMode`, `insertLink`, `insertImage`, `insertFile`, `insertVideo`, `insertTable`, `insertCode`, `horizontalLine`, `specialCharacter`, `emoji`, `cut`, `copy`, `paste`, `selectAll`, `findReplace`, `fullscreen`, `lock`, `theme`, `preview`, `print`, `about`, and `tableTools` (no button; powers table editing).

## Writing a plugin

A plugin is an object with a `name`, an optional toolbar `button`, and optional `commands`, `init` and `destroy`. The `editor` object your callbacks receive can run commands (`editor.exec`), open dialogs (`editor.openPopup`), read and set the HTML (`editor.getHTML`, `editor.setHTML`) and more; see `EditorApi` in the bundled types.

```jsx
import { Editor, allPlugins, IconStore, SEPARATOR } from 'react-easy-text-editor';

IconStore.set('star', '<svg viewBox="0 0 20 20"><path d="M10 2l2.4 5 5.6.8-4 3.9.9 5.5L10 14.6 5.1 17.2 6 11.7 2 7.8l5.6-.8z" fill="currentColor"/></svg>');

const star = {
  name: 'star',
  // A command goes through the editor's undo history and calls onChange for you.
  commands: {
    insertStar: () => document.execCommand('insertText', false, '★'),
  },
  button: {
    type: 'instant',
    icon: 'star',
    tooltip: 'Insert star',
    onClick: (editor) => editor.exec('insertStar'),
  },
};

const rows = [[allPlugins.find((p) => p.name === 'bold'), SEPARATOR, star]];

<Editor plugins={[...allPlugins, star]} toolbarRows={rows} />
```

Button types are `toggle`, `instant`, `dropdown`, `buttonGroup`, `colorpicker` and `popup` (a button that opens a dialog). The shapes are all in the bundled TypeScript definitions.

## TypeScript

Types are included; there is nothing extra to install.

```tsx
import { Editor, ContentViewer, type EditorProps } from 'react-easy-text-editor';

const props: EditorProps = { height: 400, onChange: (html) => console.log(html) };
```

## CommonJS

```js
const { Editor, ContentViewer } = require('react-easy-text-editor');
```

## Security

The editor and the viewer clean HTML in the browser: scripts, event-handler attributes and `javascript:` links are removed on load, undo, redo and when leaving source view. Treat that as a safety net rather than your only defense. If you store or show content written by other people, sanitize it on your server as well before saving it.

## Browser support

Tested in Chromium (Chrome and Edge). Firefox and Safari rely on the same standard web features (contentEditable, CSS custom properties, `:where()`, `all`) but have not been tested yet.

## Credits and license

Inspired by [Jodit](https://xdsoft.net/jodit/), the editor that made starting with a rich text editor a one-line job. This is an independent project and is not affiliated with Jodit.

[MIT](./LICENSE) © Akash Negi
