# Publishing to npm

Everything below is run from the project folder. Nothing here is shipped in the package.

## One-time setup

1. Create an account at <https://www.npmjs.com/signup> and verify your email.
2. Turn on two-factor authentication (Account → Two-Factor Authentication). npm requires it, or a token that bypasses it, to publish.
3. In `package.json`, add where the code lives (this fills in the links and "Repository" box on your npm page). Use your own URL:

   ```json
   "repository": { "type": "git", "url": "git+https://github.com/<you>/<repo>.git" },
   "homepage": "https://github.com/<you>/<repo>#readme",
   "bugs": { "url": "https://github.com/<you>/<repo>/issues" }
   ```

## Every release

```bash
npm install                 # first time only
npm run test:package        # packs the real tarball and tests it in a clean project (needs `npm run build` first)
npm login                   # opens your browser; first time only
npm publish                 # prompts for your 2FA code
```

`npm publish` first runs `prepublishOnly`, which lints, builds, checks that every CSS rule is scoped, and checks the package metadata and TypeScript types (publint and Are The Types Wrong). If any step fails, nothing is published.

Want to see exactly what will be uploaded? `npm pack --dry-run` lists the files without publishing.

## Good to know

- **A version can only be published once.** Even after `npm unpublish` you can never reuse it. Bump the version for every release: `npm version patch` (1.0.1), `npm version minor` (1.1.0) or `npm version major` (2.0.0).
- **The name is public by default.** `react-easy-text-editor` is not a scoped name, so it is public automatically; `publishConfig.access` is set to `public` anyway. (Scoped names such as `@akashnegi/text-editor` default to private unless published with `--access public`.)
- **Installs may lag a minute.** npm scans new releases when they are published, so `npm install react-easy-text-editor` can fail briefly right after `npm publish`. Wait a minute and retry.
- **Automating releases later.** Use npm's trusted publishing from GitHub Actions rather than a stored token. It needs the package to exist first, so do the first publish by hand.

## Checking your work after publishing

```bash
mkdir try && cd try && npm init -y && npm i react react-dom react-easy-text-editor
```

Then import `{ Editor }` in a React app. Version 1.0.0 should render a full toolbar with no other setup.
