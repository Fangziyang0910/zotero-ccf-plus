# Changelog

## 0.3.4 — 2026-10-21

### Fixed

- Allow installation on stable Zotero 10.0; verified with Zotero 10.0.6 on macOS.
- Emit one citation result per lookup instead of overwriting an HTTP error with a second callback.
- Require matching normalized titles; reject unrelated short titles and treat missing counts as unknown rather than zero.
- Serialize note writes per parent item to avoid duplicate notes and lost fields during overlapping refreshes.
- Preserve successful ratings/counts when a refresh fails or finds nothing.
- Register columns and the import observer once per plugin session; bind menus to their own windows and clean up on unload.
- Debounce automatic import updates, ignore deleted/read-only items, and make the automatic-update preference effective.
- Await lookup completion and show a final progress summary instead of closing the progress window before work finishes.

### Changed

- Add 15-second request timeouts, serialized Semantic Scholar requests, a shared 429 cooldown, and cancellation on plugin shutdown.
- Prefer DOI/arXiv identifiers where available and reuse successful paper lookups for five minutes.
- Handle DBLP network failures and malformed responses without leaving a batch waiting indefinitely.
- Distinguish the plugin's citation column as “CCF Plus Citations” / “CCF Plus 引用次数”.
- Add regression tests, a tracked dependency lockfile, CI, release checks, and contributor documentation.
- Replace unsupported accuracy/instantaneous-update claims in the README with matching rules, data provenance, privacy details, and known limitations.

## 0.3.2

Initial independent Zotero CCF Plus release with Semantic Scholar/DBLP lookup, CCF venue columns and structured child notes. See the [original release](https://github.com/Fangziyang0910/zotero-ccf-plus/releases/tag/v0.3.2).
