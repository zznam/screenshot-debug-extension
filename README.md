# Screenshot & Debug

A privacy-focused Chrome extension for capturing screenshots, recording a tab or desktop, and exporting browser debugging context. Captures stay on your device and do not require an account.

## Features

- Capture a selected area, the visible viewport, or a full page.
- Review and annotate screenshots before downloading them.
- Export screenshots with console, network, browser, operating-system, and page metadata.
- Record a browser tab or desktop, with optional microphone audio.
- Pause, resume, review, trim, and export recordings.
- Opt in to Rewind to review recent page activity. Rewind is disabled by default.
- Open a persistent AI Debug session with a viewport screenshot and redacted browser diagnostics.
- Run locally without login or server uploads.
- Save screenshot sets in a searchable local capture library, preserving originals, annotations, and diagnostic snapshots.

## Requirements

- [Node.js 22.22.1](https://nodejs.org/)
- [pnpm 9.15.1](https://pnpm.io/installation)
- Google Chrome or another Chromium-based browser

The repository pins Node in `.nvmrc`. With `nvm` installed:

```bash
nvm install
nvm use
corepack enable
corepack prepare pnpm@9.15.1 --activate
```

## Install and build

```bash
git clone https://github.com/zznam/screenshot-debug-extension.git
cd screenshot-debug-extension
pnpm install
pnpm build:chrome:local
```

The unpacked extension is generated in `dist/`.

## Load in Chrome

1. Open `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository's `dist/` directory.
5. Pin **Screenshot & Debug** from Chrome's Extensions menu if desired.

After rebuilding, return to `chrome://extensions/` and click the extension's reload button. Chrome internal pages such as `chrome://extensions/` cannot be captured; test on a regular `http://` or `https://` page.

## Usage

### Screenshots

1. Open the extension popup and select the **Screenshot** tab.
2. Choose area, viewport, or full-page capture.
3. Review and annotate the result in the page editor.
4. Download the screenshot, debug report, or ZIP from the editor.

### Recordings

1. Open the **Record** tab.
2. Choose **Record Tab** or **Record Desktop**.
3. Click **Start** in the page overlay and select what Chrome should share.
4. Use the overlay or popup to pause, resume, or stop.
5. Review, trim, and export the captured video.

Microphone access is optional. The first time it is enabled, the extension opens its microphone permission page.

### Rewind

Rewind is disabled by default and only begins collecting recent page activity after you enable it from the **Record** tab. Select **Capture Last Minute** to freeze and review the buffered activity.

### AI Debug

AI Debug uses a loopback-only Node helper so the OpenAI API key never enters Chrome, extension storage, screenshots, or debug reports.

In one terminal, configure the key and start the helper:

```bash
export OPENAI_API_KEY="your-api-key"
# Optional; defaults to gpt-5.6-terra
export OPENAI_MODEL="gpt-5.6-terra"
pnpm ai:helper
```

On first launch, the helper creates a pairing token in `~/.screenshot-debug-extension/ai-helper-token` with user-only permissions and prints the token once. Keep the helper terminal running.

Then:

1. Open a normal HTTP or HTTPS page.
2. Open the extension and click **AI Debug**.
3. Paste the helper pairing token when prompted.
4. The prepared screenshot and redacted diagnostics are submitted only after the helper is connected.

The AI session opens in its own extension tab and remains available after the popup closes or the browser restarts. Clicking **AI Debug** again on the same source tab refreshes its context and reuses the session.

If setup fails:

- **Helper is not running:** confirm `pnpm ai:helper` is listening on `127.0.0.1:43123`.
- **OPENAI_API_KEY is not set:** export it in the same shell before starting the helper, then restart the helper.
- **Pairing token is invalid:** copy the exact value from the first helper launch or the token file, then pair again.
- **Model access error:** set `OPENAI_MODEL` to a model available to the API project and restart the helper.

The helper accepts requests only from Chrome extension origins with the pairing credential. Do not put `OPENAI_API_KEY` in the repository `.env`, browser settings, or extension source.

## Capture library

Open **Capture library** from the popup, or choose **Save to library** in the screenshot editor. On first use, choose manual or automatic saving; the preference stays available in Settings. Saved captures persist after their source page closes or the browser restarts, and remain until deleted. Choose **Edit screenshots** to reopen their annotation layers, undo/redo, save changes, or copy/download an image. See [capture library details](docs/CAPTURE-LIBRARY.md) and [saved screenshot editing](docs/LIBRARY-EDITOR.md).

## Development

```bash
# Start Chrome development mode with hot reload
pnpm run:chrome:local

# Build an unpacked local Chrome extension
pnpm build:chrome:local

# Run validation
pnpm validate

# Run the unit suite or collect coverage (no extension build required)
pnpm test:unit
pnpm test:coverage

# Install Chromium once, then run extension E2E tests
pnpm -F @extension/e2e exec playwright install --no-shell chromium
pnpm e2e

# Build and package a production Chrome extension
pnpm zip
```

The Husky pre-commit hook runs the repository's installed `lint-staged` executable. Run `pnpm install` after switching Node versions so the hook does not fall back to downloading a different release.

## Continuous integration and coverage

`Extension CI` runs on pull requests, pushes to `main`, and manual dispatch. It uses the pinned Node/pnpm versions and frozen lockfile, checks formatting and lint, type-checks all workspaces (including browser tests), and runs unit tests with coverage. A separate job builds the production Chrome extension and checks its manifest assets. Chromium tests run against that exact build with a local mock AI responder; no API key or paid API calls are needed. The installable ZIP is published as a workflow artifact only after the quality and browser jobs pass. No store submission or automatic deployment occurs.

Failed runs retain HTML coverage reports and Playwright reports, screenshots, and traces for 14 days. Dependency updates cover both npm packages and pinned GitHub Actions. The old workflow that automatically retargeted pull requests to `develop` has been removed; this fork uses `main`.

Coverage includes untested runtime source, so the overall percentage is deliberately honest about the remaining UI and recording gaps. The global floor is 10% for lines, statements, functions, and branches. Redaction, base storage, the AI helper server/client, and AI session orchestration each require 90% on all four metrics. Reports are written to `coverage/index.html` and `coverage/lcov.info`. See [testing notes](docs/TESTING.md) for scope and limitations.

Build commands use `.env.development` or `.env.production` when present and otherwise fall back to tracked `.example.env`, so a fresh checkout builds without private configuration. Generated CLI flags take precedence over stale flags in those files.

## Project structure

- `chrome-extension/` — manifest and background service worker
- `pages/popup/` — extension popup
- `pages/content/` — capture and recording runtime
- `pages/content-ui/` — screenshot editor and recording review UI
- `pages/ai-debug/` — persistent AI Debug extension page
- `packages/ai-helper/` — loopback-only OpenAI helper
- `packages/` — shared storage, UI, translations, and build tooling
- `tests/e2e/` — Playwright extension tests
- `dist/` — generated unpacked extension

## Acknowledgments

This project is based on the original [Brie Extension](https://github.com/briehq/brie-extension), created by Ion Leu and Luminita Leu. Screenshot & Debug is a local-first fork focused on capture, recording, and debugging exports without Brie server integration.

## License

Apache-2.0. See [LICENSE](LICENSE.md).
