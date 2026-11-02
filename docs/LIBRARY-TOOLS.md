# Capture review and workspace tools

Open **Capture library** from the extension popup. The tools below work with saved captures after the source page closes, using the frozen diagnostics saved with each capture. They do not query another active tab or invoke AI.

## Review and compose a bug report

Open a capture and choose **Review & compose report**. Select the screenshots to include and drag over sensitive pixels to add solid black masks. The keyboard alternative accepts a region in percentages of the image. Undo removes the latest mask. Masks affect exported copies, while the original and editable preview remain stored locally.

Fill in the report title, reproduction steps, expected behavior and actual behavior. The source URL and all diagnostic records start excluded. Expand individual diagnostic previews and select only the evidence needed for the report. Recognized credentials and email addresses are redacted in diagnostic previews and report exports, including localhost URLs. Detection is a convenience and cannot identify every kind of private data or inspect image pixels.

Check **I have reviewed the selected evidence** to enable export. Changing the selected evidence, masks or report text requires another review. The ZIP contains `report.md`, numbered PNG copies of selected screenshots, and `diagnostics.json` only when records were selected. PNG copies are rendered from the annotated preview with opaque masks baked into their pixels; the bundle never includes original images, editable layers, thumbnails, OCR indexes or unselected records. Markdown and copy actions contain the reviewed report text. Markdown image links refer to the PNG files in the ZIP.

Review edits and report fields are temporary to the current page. Download before closing or refreshing. Existing quick downloads in the image editor remain available; use the review workflow when preparing evidence to share.

## Compare screenshots

Choose **Compare screenshots** from the library or a capture. Pick before/after captures and, for sets with multiple images, the screenshot in each set. Comparison uses saved annotated previews.

Side-by-side view preserves image proportions. Matching image dimensions also enable a keyboard-controlled slider and a pink difference overlay. Different dimensions show a notice and keep side-by-side view available. Pixel comparison samples images at up to 1600 pixels along the longest edge and counts a pixel as changed when any channel differs by more than 24/255. The percentage is a sampled visual aid, not a full-resolution regression score. Comparison neither modifies nor uploads evidence.

## Read and search screenshot text

Open a capture and choose **Read screenshot text**. The extension reads English text from annotated previews with bundled Tesseract.js, WebAssembly cores and English language data. Recognition starts only when requested and works offline; no CDN, external OCR service or model API is used. Cancel stops the operation without saving partial results.

Recognized text stays in the local capture, can be copied, and becomes searchable from the library search field after recognition completes. At most 100,000 characters are retained per screenshot. **Clear saved text** removes it. Saving image edits invalidates the text index so hidden original pixels or outdated annotations cannot remain searchable. Metadata-only changes preserve the index. Revision checks reject results if a capture changes or is deleted while recognition runs. Text recognition can misread small, stylized or non-English text.

## Storage and cleanup

Open **Storage & cleanup** from the library header. The dashboard groups captures, saved AI sessions and persisted diagnostic records. Sizes describe stored content and exclude browser/database overhead. Rewind buffers, downloads and general preferences are outside this dashboard.

Filter by type, title/domain, date or minimum size; sort by size or age. Select individual entries or the currently visible entries. **Review deletion** lists the complete selection, including selected items hidden by a later filter. **Keep items** cancels the confirmation. Permanent deletion affects only selected IDs; capture deletion also removes all its original/preview assets and OCR text. AI session deletion includes its saved screenshot, context and messages. Diagnostic deletion removes persistent rows and corresponding records in background memory. New records may arrive while source pages stay open.

Each data category commits separately. If one deletion fails, the dashboard reloads the remaining items and asks for a fresh selection instead of claiming the whole operation succeeded. The new management messages accept requests only from this extension's library page; websites and content scripts cannot list or erase other stored evidence through those messages. Saved capture ingestion and editor revision protections remain unchanged.

## Visual examples

Production Chromium screenshots use synthetic example data: [privacy review and report composition](images/library-tools/review-desktop.png), [before/after comparison](images/library-tools/compare-desktop.png), [storage management](images/library-tools/storage-desktop.png), and [mobile review](images/library-tools/review-mobile.png). Browser checks cover 360, 768, and 1280 pixel widths.
