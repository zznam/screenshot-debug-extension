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
