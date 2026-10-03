# Settings and privacy behavior

Choose **System** to follow operating-system appearance. Light and Dark are explicit overrides and survive reopening the popup. Existing Light/Dark preferences remain compatible. Settings changes update other extension views immediately.

JPEG quality is adjustable from 50–100%. Reset capture settings restores capture/export defaults without deleting the domain skip list or changing the selected theme.

The domain skip list accepts hostnames or HTTP(S) URLs and includes subdomains. `example.com` matches `app.example.com`, but excludes lookalikes such as `notexample.com`. Diagnostics from skipped pages are dropped before background storage; skipped request destinations are also omitted. Auto-screenshots on errors and Rewind collection stop for skipped pages. Manual screenshots and recordings remain available. Adding a skip rule does not erase exported files or existing AI sessions. Previously buffered diagnostics are discarded when requested from a currently skipped page.

Diagnostic retention applies to console, network, events, cookies, and performance records, including persisted data after the worker restarts. Cleanup runs at worker startup, when settings change, every minute while Chrome is running, and before records are read. Chrome may delay alarms while asleep; cleanup resumes when the browser wakes. The setting does not remove saved downloads, AI sessions, or recordings. Rewind retains its separate rolling buffer policy.

Validation covers overlapping settings writes, legacy setting defaults, domain validation and matching, source-tab redaction, skipped record storage, persisted retention, OS appearance changes, and the complete popup settings flow.
