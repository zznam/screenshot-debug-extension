## Architecture

Following architecture seems more appropriate for having for browser extensions, using single-responsibility principle. This will allow us to have a structured project architecture that will be easy to understand and navigate.

## Boilerplate structure <a name="structure"></a>

### Chrome extension <a name="structure-chrome-extension"></a>

The extension lives in the `chrome-extension` directory and includes the following files:

- [`manifest.ts`](chrome-extension/manifest.js) - script that outputs the `manifest.json`
- [`src/background`](chrome-extension/src/background) - [background script](https://developer.chrome.com/docs/extensions/mv3/background_pages/)
  (`background.service_worker` in manifest.json)
- [`public`](chrome-extension/public/) - icons referenced in the manifest; content CSS for user's page injection

> [!IMPORTANT]
> To facilitate development, the boilerplate is configured to "Read and change all your data on all websites".
> In production, it's best practice to limit the premissions to only the strictly necessary websites. See
> [Declaring permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
> and edit `manifest.js` accordingly.

### Pages <a name="structure-pages"></a>

Code that is transpiled to be part of the extension lives in the [pages](pages/) directory.

- [
  `content`](pages/content/) - [content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
  (`content_scripts` in manifest.json)
- [`content-ui`](pages/content-ui) - React UI rendered in the current page (you can see it at the very bottom when you
  get started)
  (`content_scripts` in manifest.json)
- [
  `content-runtime`](pages/content-runtime/src/) - [injected content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts#functionality);
  this can be injected from `popup` like standard `content`
- [`popup`](pages/popup/) - [popup](https://developer.chrome.com/docs/extensions/reference/api/action#popup) shown when
  clicking the extension in the toolbar
  (`action.default_popup` in manifest.json)

### Packages <a name="structure-packages"></a>

Some shared packages:

- `dev-utils` - utilities for Chrome extension development (manifest-parser, logger)
- `env` - exports object which contain all environment variables from `.env` and dynamically declared
- `hmr` - custom HMR plugin for Vite, injection script for reload/refresh, HMR dev-server
- `i18n` - custom internationalization package; provides i18n function with type safety and other validation
- `shared` - shared code for the entire project (types, constants, custom hooks, components etc.)
- `storage` - helpers for easier integration with [storage](https://developer.chrome.com/docs/extensions/reference/api/storage), e.g. local/session storages
- `store` - state management package, where all public and private reducers and api are available
- `tailwindcss-config` - shared Tailwind config for entire project
- `tsconfig` - shared tsconfig for the entire project
- `ui` - function to merge your Tailwind config with the global one; you can save components here
- `vite-config` - shared Vite config for the entire project

Other useful packages:

- `zipper` - run `pnpm zip` to pack the `dist` folder into `extension-YYYYMMDD-HHmmss.zip` inside the newly created
  `dist-zip`
- `e2e` - run `pnpm e2e` for end-to-end tests of your zipped extension on different browsers
