# Extension improvement roadmap

This review proposes 38 improvements based on the capture, popup, settings, export, and debug-session code. The first three batches are independent PRs targeting `main`. Remaining ideas are proposals, not implemented features.

| # | Feature or improvement | User benefit / acceptance criteria | Priority | Batch |
|---|---|---|---|---|
| 1 | Persistent System appearance | System remains selected across popup and editor launches. | P1 | Settings/privacy |
| 2 | Explicit Light/Dark overrides | OS changes never overwrite a deliberate appearance choice. | P1 | Settings/privacy |
| 3 | Live OS appearance updates | Open views repaint when OS appearance changes in System mode. | P1 | Settings/privacy |
| 4 | Live capture settings | Other extension contexts observe changes without reopening. | P1 | Settings/privacy |
| 5 | Lossless overlapping setting changes | Changing two controls quickly preserves both changes. | P1 | Settings/privacy |
| 6 | Legacy setting normalization | Missing fields get defaults and quality is bounded to 50–100%. | P1 | Settings/privacy |
| 7 | JPEG quality control | Users can trade image quality for smaller files. | P1 | Settings/privacy |
| 8 | Restore capture defaults | One action resets capture/export options while keeping privacy rules. | P2 | Settings/privacy |
| 9 | Domain normalization and validation | Accept URLs and hostnames; reject credentials and invalid input. | P1 | Settings/privacy |
| 10 | Precise domain rules | Include subdomains without matching unrelated lookalike domains. | P1 | Settings/privacy |
| 11 | Enforce diagnostic skip rules | Skipped pages and request destinations do not write new diagnostics. | P0 | Settings/privacy |
| 12 | Enforce Rewind skip rules | Stop collection live and omit skipped-page buffered exports. | P0 | Settings/privacy |
| 13 | Source-tab redaction policy | A different active tab cannot alter another tab's redaction policy. | P0 | Settings/privacy |
| 14 | Persistent diagnostic retention | Expired records leave memory and IndexedDB, including after restart. | P1 | Settings/privacy |
| 15 | Accessible settings and save feedback | Controls have labels; invalid input and failed saves are explained. | P1 | Settings/privacy |
| 16 | Honor PNG/JPEG export settings | Image bytes, MIME type, extension, and quality agree. | P1 | Export quality |
| 17 | Export visible annotations | Download contains the current annotated result for every screenshot. | P0 | Export quality |
| 18 | Copy visible annotations as PNG | Clipboard images include current markup and work for JPEG sources. | P1 | Export quality |
| 19 | Safe, unique export filenames | Multiple screenshots cannot overwrite each other in a ZIP. | P1 | Export quality |
| 20 | Accurate attachment metadata | JSON lists the actual attachment names without embedded duplicate images. | P1 | Export quality |
| 21 | Markdown bug-report bundle | Debug ZIP includes a readable issue template and evidence summary. | P1 | Export quality |
| 22 | Accurate HTTP failures | Both browser statusCode and interceptor status appear in reports/HAR. | P1 | Export quality |
| 23 | Prevent repeated download submissions | Busy state prevents duplicate exports and recovers after failure. | P1 | Export quality |
| 24 | Area/viewport/full-page keyboard commands | Capture can begin without opening the popup; bindings are configurable. | P1 | Capture usability |
| 25 | Central capture entry point | Shortcuts and context menus share validation, recovery, and cleanup. | P1 | Capture usability |
| 26 | Restricted-page guidance | Unsupported schemes and store pages are explained before capture starts. | P1 | Capture usability |
| 27 | Prevent competing capture sessions | Starting another capture cannot overwrite an active session. | P0 | Capture usability |
| 28 | Shortcut discovery | Popup exposes a link to Chrome's shortcut configuration. | P2 | Capture usability |
| 29 | Actionable capture errors | Storage and initialization failures return the UI to a usable state. | P1 | Capture usability |
| 30 | Searchable local capture history | Find saved captures by title, date, domain, or type. | P2 | Proposed |
| 31 | Storage usage and bulk cleanup | Show usage by capture/AI/Rewind and selectively remove local data. | P1 | Proposed |
| 32 | Pre-export privacy review | Show diagnostics preview plus sensitive URL/body detections before sharing. | P0 | Proposed |
| 33 | Screenshot OCR and searchable text | Extract text locally and allow copy/search without sending images away. | P2 | Proposed |
| 34 | Capture comparison | Compare two screenshots with an overlay/diff and matching viewport metadata. | P2 | Proposed |
| 35 | Recording quality and audio controls | Explicit resolution/frame-rate/system-audio options with capability detection. | P2 | Proposed |
| 36 | AI session export and mobile navigation | Export selected chat/context and reach history on small screens. | P2 | Proposed |

| 37 | Repository workflow hygiene | PR guidance targets main and generated pnpm stores stay out of Git. | P2 | Capture usability |
| 38 | Accessible screenshot action buttons | Area, viewport, and full-page actions have visible keyboard focus and correct button semantics. | P1 | Capture usability |

## Suggested merge order

Merge Settings/privacy, Export quality, then Capture usability after their CI checks pass. Each PR uses `main` as its base and can be reviewed independently. Review all three together before release, especially annotation fidelity, privacy exclusions, and capture-session ownership.

## Next planning pass

Start with the privacy preview and storage manager because they make the local-first promise easier to understand and verify. Searchable history then gives captures a durable workflow. OCR, comparison, recording controls, and AI session enhancements should be separate feature PRs with explicit UI designs and browser acceptance tests.

## Validation boundaries

The first batches add unit coverage for privacy/storage/export boundaries and Chromium tests for the actual extension UI. Microphone permission dialogs, desktop sharing, live paid AI calls, and Firefox packaging remain outside the automated test suite. Proposed ideas need design and implementation before being described as shipped.
