# Screenshot & Debug Extension

A powerful and privacy-focused Chrome extension for capturing screenshots and generating debug logs instantly.

## Features

- **Immediate Capture**: Automatically saves full-page, viewport, or selected area screenshots.
- **Debug Logs**: Generates a detailed JSON log file with every screenshot, including:
  - Network requests
  - Console logs
  - Browser & OS details
  - Metadata
- **Privacy First**: No server uploads. All data is saved locally to your downloads folder.
- **No Login Required**: Ready to use immediately.

## Installation from Source

1. Clone this repository.
2. Install dependencies:

    ```bash
    pnpm install
    ```

3. Build the extension:

    ```bash
    pnpm build:chrome:local
    ```

4. Load into Chrome:
    - Open `chrome://extensions/`
    - Enable **Developer mode** (top right).
    - Click **Load unpacked**.
    - Select the `chrome-extension/dist` (or `dist` depending on output) directory.

## Usage

1. Right-click on any page.
2. Select **Screenshot & Debug** > **Area** (or Viewport/Full Page).
3. The screenshot (`.png`) and log (`.json`) will be downloaded immediately.

## Development

- Run dev server: `pnpm run:chrome:local`
- Lint: `pnpm lint`
