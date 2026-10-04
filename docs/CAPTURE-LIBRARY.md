# Local capture library

Open **Capture library** from the extension popup. In the screenshot editor, choose **Save manually** or **Save automatically** the first time you capture a page. Change this preference in Settings. Until you choose, the extension does not save screenshots to the library.

Manual mode adds a **Save to library** action. Automatic mode saves completed screenshots and updates their annotations and title after a short idle period. Saving does not enable recording or Rewind. A save can be cancelled; a failed save keeps the preview available for download or retry.

The library keeps screenshot sets, original image bytes, rendered previews, editable annotation snapshots, source-page metadata, and the diagnostics frozen when the capture completes. Diagnostics follow the Debug Records setting and are redacted even for localhost. The library never uploads captures or invokes AI.

Search by title, source title, domain, or tag, and combine domain/date/type filters. Open a capture after its source page closes or the browser restarts. Rename captures, add comma-separated tags, or permanently delete a capture and its images. Saved captures do not expire automatically.

Choose **Edit screenshots** on a capture to reopen its original images and annotation layers in a standalone editor. The source tab is unnecessary. See [saved screenshot editing](LIBRARY-EDITOR.md) for saving, undo/redo, and conflict recovery. Recording/Rewind persistence, report composition, privacy review, OCR, comparison, and bulk storage management are separate feature PRs.

## Persistence boundaries

Capture ingestion is bound to the sending top-level tab and document. Content scripts can snapshot their own diagnostics and upload their own screenshot sets; they cannot list, read, or delete the library through runtime messages. Library pages read extension-origin IndexedDB.

Uploads use sequential acknowledged chunks of at most 256 KiB. A save supports up to 30 images and 128 MiB of serialized input. Pending uploads are invisible. Captures and their image assets commit in one transaction; revision checks reject stale updates rather than overwriting another window's changes. Unfinished staging expires after 24 hours; this never deletes saved captures.

The `unlimitedStorage` permission protects saved evidence against browser quota eviction, as described in [Chrome's persistence documentation](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies#persistence). Physical disk exhaustion can still prevent a save; existing captures and the current preview remain available.

Screenshots can contain visible private information. Original images and annotation layers remain stored locally even if their rendered preview contains blur or other markup. Deleting the capture removes both original and rendered image assets.

## Upstream source

The thumbnail-history interaction is adapted from Brie, replacing its authenticated server-backed records with local IndexedDB documents. Reference: briehq/brie-extension at `b18e550026e4acf322815bd91200692593397d91`, `pages/popup/src/components/slices-history/content.slices-history.tsx`. Apache-2.0 attribution is retained in the repository.

## Verification

Unit tests exercise upload ordering and ownership, frozen metadata, revision conflicts, atomic asset replacement, invalid inputs, staging cleanup, search filters, and redaction. Chromium tests cover real annotated capture saving, reopening after the source tab closes, tags/search/deletion, responsive layouts, automatic updates, and a complete browser restart.

The production bundle passed all 18 integration scenarios in Linux with Playwright 1.61.1, including the existing capture, image-export, Settings, and AI Debug regressions. Annotation scenarios draw through the editor rather than injecting state during canvas initialization.

Screenshots from the browser tests: [desktop](images/capture-library/desktop.png), [tablet](images/capture-library/tablet.png), [mobile](images/capture-library/mobile.png), and [restored annotated capture](images/capture-library/restored-capture.png).
