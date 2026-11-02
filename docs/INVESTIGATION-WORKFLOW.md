# Investigation workflow

This extension already captures and reviews evidence. The next useful improvements reduce repeated discovery work, make investigations easier to track, and preserve report composition between sessions. These ten additions focus on that workflow while keeping data on the device.

| # | Feature | How to use it |
| --- | --- | --- |
| 1 | Favorite captures | Check **Favorite capture** in details, save, and choose **Favorites only** in the library. |
| 2 | Workflow status | Set **Open**, **In progress**, or **Resolved** in details. Status appears on library cards and can be filtered. Older captures start as Open. |
| 3 | Investigation notes | Save up to 10,000 characters of clues and next steps with capture details. Library search includes notes. Notes do not enter reports automatically. |
| 4 | Exact tag filtering | Choose a **Tag** to match a complete tag rather than a substring. Combine it with domain, dates, favorites, status, and search. |
| 5 | Named saved views | Name and save the current filters and sort order. Apply or delete a saved view later. Reusing a name updates it; up to 20 views are supported. Applying starts at page one. |
| 6 | Library keyboard navigation | `/` focuses search; `j` and `k` focus adjacent capture cards; Enter opens the focused card. `?` opens help and Escape closes it. Typing, selectors, composition, and modifier shortcuts are respected. Disable single-key shortcuts from the help panel; the preference survives reloads. |
| 7 | Report templates | Apply blank, bug, regression, or accessibility prompts. Replacing existing narrative requires confirmation and preserves the report title, severity, and environment. |
| 8 | Recoverable local report drafts | Explicitly save, restore, or discard the narrative, masks, screenshot choices, and selected diagnostics. Restore validates the capture revision and preview assets. Review approval is never saved. |
| 9 | Structured report context | Set severity and describe the browser, OS, device, or test environment. These fields appear in report text and JSON and pass through the existing text redaction. |
| 10 | Reviewed JSON export | Download structured report fields, selected redacted diagnostics, and attachment filenames after reviewing evidence. Image pixels, hidden originals, capture IDs, and unselected diagnostics are excluded. |

## Persistence and privacy

Capture metadata remains in the existing IndexedDB capture document and follows its revision checks. Screenshot edits retain favorites, status, and notes. Older captures remain readable without a migration. Named views and explicit report drafts use extension-origin local storage. Drafts are bounded and can contain private text, so they remain on this device. Capture deletion also removes its saved report draft.

Report drafts are not autosaved. Save before closing if you want to resume later. Changed evidence invalidates a saved draft, including changes from another tab. Discard a stale draft and review current evidence before saving another. Restored masks and selections always require a new review acknowledgment. Applying a template or changing report content resets that acknowledgment too.

If another report tab saves or discards the same draft, your current text remains open and a conflict warning protects it from silent replacement. Restore the latest saved draft or explicitly confirm replacing it with the current report. A stale tab cannot silently save over or discard a newer draft.

JSON attachment names refer to the reviewed PNGs available in the ZIP or through individual image downloads. A JSON file does not embed those images. Automated redaction only recognizes known patterns; review screenshot pixels and report text before sharing.

## Test coverage

The browser suite uses a fresh extension profile for each test. New scenarios cover metadata persistence and combined filters, saved view replacement/reload/deletion, keyboard navigation without interfering with typing, report template replacement, draft restore and stale evidence, reviewed JSON field selection/redaction, and mobile/tablet/desktop layouts. Recovery scenarios cover missing evidence, invalid date ranges, settings persistence, skipped domains, failed cleanup, and comparison keyboard controls.

Recording coverage uses a synthetic canvas stream at the native picker boundary with the real MediaRecorder, pause/resume state, review, and WebM download. Rewind coverage uses actual page events and persistence. These tests do not exercise the operating system's screen-sharing or microphone permission dialogs, paid AI calls, Firefox, or store installation. See [testing notes](TESTING.md) for commands and final validation results.
