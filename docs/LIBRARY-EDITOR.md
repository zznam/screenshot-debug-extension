# Saved screenshot editing

Open the capture library from the popup, select a saved screenshot set, and choose **Edit screenshots**. The editor loads the original images and editable layers from extension-origin IndexedDB. It works after the source tab closes or the browser restarts and never queries an active tab for diagnostics.

Use the same rectangle, arrow, text, pen, highlighter, blur, color, and export tools as the capture overlay. Select a screenshot from the sidebar to edit another image in the set. **Undo** and **Redo** operate separately for each image; **Start over** removes its layers and can itself be undone. Keyboard shortcuts include Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, copy/paste selected layers, and Delete. Shortcuts leave title inputs and Fabric text editing alone.

In manual mode, choose **Save changes**. Automatic mode saves changes after a short idle period, using the preference in Settings. Each successful save advances the capture revision, regenerates flattened previews and the library thumbnail, and retains the original image bytes, tags, captured source, and frozen diagnostics. Resizing the editor does not mark an image as edited.

**Download** exports the selected annotated image in the PNG/JPEG format configured in Settings. The toolbar also offers PNG/JPEG export. **Copy** places an annotated PNG on the system clipboard. These actions remain available if saving fails and do not save automatically in manual mode. Existing overlay image, ZIP, and Markdown exports are preserved. Saved-capture editing does not invoke AI Debug.

Every editor window owns its annotation state, undo/redo stacks, and layer-copy clipboard. Minimizing the overlay preserves that capture's edits. Closing or discarding one session cannot clear another window's layers. Layer-copy data is kept in memory, never in the captured website's local storage. A page refresh discards unsaved edits; the browser warns before leaving when applicable, and the Close action confirms unsaved manual changes.

## Conflicts and insufficient storage

Two windows may independently edit a capture. The first successful save wins its revision; the other window receives a conflict instead of overwriting it. Download the unsaved image to keep a copy, then choose **Reload saved version**. Reload asks before discarding your edits. Deleting a capture in another window prevents further saves and never recreates it.

Originals, previews, layers, and the document update commit in one IndexedDB transaction. A failed or full-disk write rolls back to the previous capture. The editor retains its working layers and offers **Retry save**, **Download**, and a link to the library for freeing space. Automatic saving pauses after an error until you retry. Saved captures have no automatic expiry or eviction.

Blur and annotations are editable markup. The original pixels remain local, and image exports are flattened copies. The shared privacy review and opaque export masks belong to the later privacy-review PR.

## Implementation and validation

`@extension/editor` contains the shared Fabric canvas, toolbar, header, sidebar, rendering helpers, and isolated editor sessions. Compatibility exports preserve existing content-overlay imports. The library page's content security policy permits bundled resources and local data/blob images, and blocks external resource connections. The annotation controls retain the repository's Apache-2.0 attribution; this PR refactors existing source and introduces no additional upstream ports.

Unit tests cover saved-layer undo baselines, per-session isolation, bounded histories, revision conflicts, immutable originals and context, deletion, and quota rollback/retry. Chromium integration scenarios cover standalone editing, concurrent windows, PNG download/copy, automatic saving, quota recovery, keyboard access, and layouts at 360, 768, and 1280 pixels alongside the existing capture/restart regressions.

The production bundle passes 22 Chromium integration scenarios and 167 unit tests. Editor screenshots: [desktop](images/library-editor/desktop.png), [tablet](images/library-editor/tablet.png), and [mobile](images/library-editor/mobile.png).
