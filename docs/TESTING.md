# Validation and review notes

Run `pnpm validate` for the same workspace preparation, formatting, lint, type checks, and unit coverage checks used in CI. Run `pnpm e2e` to build and test locally, or `pnpm build:chrome:production && pnpm verify:build && pnpm -F @extension/e2e e2e` to test the production build. Install Chromium once with `pnpm -F @extension/e2e exec playwright install --no-shell chromium`.

Unit tests resolve workspace packages directly to source. They do not require generated package output. Most run in Node; only tests that need browser APIs use jsdom. The source-comment check ignores dependencies and generated files instead of scanning linked dependencies. End-to-end tests use a fresh Chromium profile for every test and a local, deterministic helper responder.

## Verified locally on 2026-10-02

| Check | Result |
| --- | --- |
| Unit tests | 109 passed across 17 files, up from 46 tests |
| Chromium integration tests | 10 passed against the final production build |
| Overall runtime coverage | 11.09% lines, 11.12% statements, 10.33% functions, 10.50% branches |
| Critical boundary coverage | All five modules pass 90% gates on every metric |
| Formatting and TypeScript | Passed, including root tooling and browser tests |
| ESLint | Passed with seven existing hook warnings |
| Workflow syntax | All workflows passed actionlint |
| Frozen lockfile | Verified with an offline install |
| Production package | Manifest verified; 37 ZIP entries matched the built files byte for byte |

Unit coverage was also run after removing generated bundles with no skipped-file parsing errors. After rebasing onto the latest capture-state changes from main, unit tests, type checks, and production browser tests were rerun; the table reports that combined revision. GitHub-hosted execution and branch protection have not been changed or verified remotely.

## Regressions covered

- Multiple secret formats in one string; numeric and structured secret fields; header/name/value pairs; embedded JSON; and remote URLs containing `localhost` that previously bypassed redaction.
- Overlapping async updates within a storage instance, failed writes, delayed initial reads, external storage events, serialization, and removal. Chrome storage still has no atomic read/modify/write across separate extension contexts; the local write queue does not claim to solve that platform limitation.
- AI helper origin and pairing checks, malformed/oversized requests, context validation, hidden upstream errors, client timeouts, refused redirects, and upstream cancellation when a client disconnects.
- AI context capture from the intended active page, changed-page rejection, persistent sessions, deduplicated messages, record bounds, and failure recovery.
- Rewind database isolation and retention; preservation of separate events sharing a millisecond; replay anchors; and valid time bounds in exported `events.json`.
- Screenshot lifecycle/recovery, debug JSON and ZIP downloads, runtime injection, editor theme contrast, annotated AI context, and capture-owner reconciliation in Chromium.
- Environment selection and flag precedence for both development and production builds on fresh checkouts.

## Reports and CI behavior

- `pnpm test:coverage`: text summary, HTML, LCOV, and JSON summary under `coverage/`.
- `pnpm verify:build`: validates the Chrome manifest version, required asset paths, and absence of source maps, test files, and environment files from `dist/`. Empty CSS placeholders are allowed.
- CI rejects focused Playwright tests. It retries a browser test once, preserves failed traces/screenshots, and uploads the HTML report. `pnpm -F @extension/e2e e2e:headed` honors headed mode.
- Quality checks and the production build run independently. Browser tests download the build artifact and run their mock helper directly from source. The final ZIP comes from the tested bundle and is only produced after both quality and browser checks succeed.
- Actions are pinned to commit hashes and tracked by Dependabot. CI has read-only repository permissions, bounded job times, and cancels superseded runs.
- GitHub branch protection is configured separately in repository settings. Select the quality, build, and browser jobs as required checks if merges should be blocked by failures.

The coverage configuration follows [Vitest's explicit source inclusion](https://vitest.dev/guide/coverage.html), and the browser fixture uses [Playwright's persistent Chromium extension context](https://playwright.dev/docs/chrome-extensions).

## Remaining review findings

The broad runtime coverage number remains low even with strong coverage at the tested boundaries. Canvas editing, full-page stitching, actual microphone/desktop recording, video encoding, and many UI hooks still need focused tests. Headless browser tests cannot replace manual checks of native sharing and microphone prompts. Firefox is not part of the supported test pipeline.

Seven pre-existing React hook dependency warnings remain in the editor, replay UI, and recording timer. Production builds also report large UI bundles. Those require separate behavioral and performance work; the pipeline does not suppress the warnings.

Screenshots contain visible page content and are not automatically scrubbed. The AI path redacts diagnostic records; this is not a guarantee that arbitrary page text or URL fields contain no sensitive information. Review screenshot content before using AI Debug. Ordinary localhost diagnostics retain the existing local-development redaction opt-out; AI records use a forced redaction boundary.

The repository still contains inherited Brie naming, legacy authentication/store modules, and upstream reviewer metadata. Removing those safely needs a dedicated dependency and compatibility pass.

## Capture workspace verification on 2026-10-18

- `pnpm validate` passes formatting, lint, all workspace type checks, and 309 unit tests across 51 files with the existing coverage gates.
- The production Chrome build and build-asset verification pass, including bundled offline OCR assets, the WebAssembly-only CSP allowance, and content-script Unicode compatibility.
- All 29 Chromium integration scenarios pass against the production bundle. The seven new scenarios cover reviewed ZIP/PNG pixels, selected diagnostics, comparison, offline OCR/search/reload/clearing/cancellation, bulk cleanup and background-cache consistency, and responsive layouts.
- The existing editor scenarios verify one undo step per drawing gesture, independent image/window histories, conflict handling, quota recovery, and preserved originals.
- Visual examples and feature boundaries are in [capture workspace tools](LIBRARY-TOOLS.md).

## Workspace quality verification on 2026-10-22

- `pnpm validate` passes formatting, lint, all workspace type checks, coverage gates, and 336 unit tests across 55 files. Four existing hook-dependency warnings remain in unchanged content UI components.
- The production Chrome build and `pnpm verify:build` pass. The packaged ZIP contains 57 files verified byte for byte against the tested build. The manifest version remains 0.5.27; no dependency or permission changes were introduced.
- All 37 Chromium scenarios passed across the full run and an isolated rerun. The full run passed 36 scenarios; the pre-existing shortcut-registration test timed out while awaiting Chrome's commands API, then passed unchanged on its isolated rerun in 4 seconds. No timeouts, retries, or CI settings were relaxed.
- Eight new browser scenarios cover offline AI history at 360/768/1280px, keyboard access, selected/redacted exports, cancellation/retry, invalid pairing, failed deletion, sorted/paginated discovery, unsaved-work prompts, oversized capture recovery, and normal full-page rendering.
- New unit checks cover AI export field selection and Markdown escaping, user cancellation, bounded screenshot dimensions, library view serialization/sorting, and IndexedDB writes/deletions aborted after successful requests.
- Visual checks include AI light/dark layouts, long unbroken text, and the library at mobile/desktop widths. Screenshots use synthetic test evidence: [AI desktop](images/quality-pass/ai-workspace-1280.png), [AI narrow](images/quality-pass/ai-workspace-360.png), [library desktop](images/quality-pass/library-1280.png), [library narrow](images/quality-pass/library-360.png).

Report drafts remain in memory and are protected by the browser's navigation prompt; they are not crash-recoverable autosaves. Full-page output is deliberately bounded and can omit cross-origin resources the DOM renderer cannot access. Native sharing/microphone dialogs, paid AI calls, Firefox, and store distribution remain outside this verification. The large injected editor bundle remains a performance follow-up.

## Investigation workflow verification on 2026-10-31

- `pnpm validate` passes formatting, repository-wide lint and type checks, and 380 unit tests across 59 files. The same four existing React hook warnings remain.
- Coverage gates pass: 25.90% lines, 25.16% statements, 21.34% functions, and 24.95% branches across the runtime source. These figures include untested source and are not a claim of complete code coverage.
- The production Chrome build and `verify:build` pass, including the bundled single-thread video encoder, worker, and WebAssembly assets. The encoder adds about 31 MB to the unpacked extension and loads only for trimmed/converting exports. Full WebM downloads preserve their original bytes.
- [Ten workflow additions](INVESTIGATION-WORKFLOW.md) cover capture triage, saved views, keyboard navigation, report templates, explicit local drafts, structured report context, and reviewed JSON.
- New regression checks protect metadata writes from synchronous quota errors, preserve triage across image edits, reject oversized saved views and stale report writes, validate draft evidence, and preserve original WebM bytes for full exports. Encoder tests cover load failure, timeout, conversion failure, and worker cleanup.
- Report drafts can now be saved explicitly and restored after reopening. Concurrent tabs cannot silently replace a newer draft; restoring still requires a fresh evidence review. Deleting a capture removes its draft, with retryable cleanup if browser storage fails.

## Final verification on 2026-11-03

- Final `pnpm validate` passes all **383 unit tests across 59 files**, formatting, source lint, and workspace type checks. Coverage gates pass with 26.07% lines, 25.32% statements, 21.55% functions, and 25.06% branches. Production asset verification passes; four pre-existing hook warnings remain.

- All **55 Chromium E2E scenarios passed in one clean run** against the production build, without retries or skipped tests (1.3 minutes). The local command used three isolated workers and a 120-second execution budget; repository defaults remain unchanged. The HTML report is generated at `tests/e2e/playwright-report/index.html`.
- Recording coverage uses a synthetic stream only at the native sharing boundary. Real MediaRecorder frames, pause/resume, two active segments, keyboard trim controls, byte-identical full WebM download, offline FFmpeg trimming, and decoded output dimensions/duration all pass.
- WebM trims copy packets without re-encoding. A trim start can align to a nearby codec keyframe. Native sharing/microphone dialogs remain manual checks; MP4 conversion is unit-tested and has no exposed UI control.
- Fixed unstable recording/rewind settings snapshots that froze the Record tab, the popup-close race in content-tab identification, and duration refinement sending full exports through conversion. Added snapshot identity and requesting-tab regression tests.
- Rewind tests verify real rrweb events and opt-out stopping collection. The known browser warning about blocked scripts in the intentionally sandboxed replay frame is recognized specifically; unexpected extension errors still fail the tests.
- Generated Playwright reports and test results are excluded from ESLint to prevent generated report bundles from stalling source validation.
