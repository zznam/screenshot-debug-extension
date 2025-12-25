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

## Acknowledgments

This project is built upon the excellent [Brie Extension](https://github.com/briehq/brie-extension) by the Brie team.

**Special thanks to:**

- [Ion Leu](mailto:ion@brie.io) — Co-founder & Developer
- [Luminita Leu](mailto:luminita@brie.io) — Co-founder & Developer

The original Brie extension provides a full-featured bug reporting solution with server-side integration. This fork strips away the server components to create a purely local, privacy-focused screenshot and debugging tool.

If you need a complete bug reporting workflow with team collaboration features, check out the original project at [brie.io](https://brie.io).

## License

Apache-2.0 — See [LICENSE](LICENSE) for details.
