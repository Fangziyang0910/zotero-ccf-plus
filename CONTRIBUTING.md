# Contributing

Issues and pull requests are welcome. Describe the observed behavior, expected behavior, Zotero/plugin versions, operating system, and the smallest reproducible example. Use public paper identifiers or sanitized metadata; never include credentials or a private library export.

## Setup and checks

Use Node.js 22 or newer:

```sh
npm ci
npm run check
npm run build
```

`npm run check` runs deterministic regression tests, ESLint, and formatting checks. `npm run format` formats the maintained files. Commit `package-lock.json` when dependencies change; do not edit generated `build/` files.

Tests bundle the actual TypeScript modules with esbuild and provide a small Zotero host fixture. They cover callbacks, conservative matching, failed responses, rate limits, timeout/cancellation, concurrent note writes, and window lifecycle registration. Do not replace these tests with assertions that merely copy implementation details. External API availability is checked manually, so local regression tests do not require API keys or live network queries.

## Manual acceptance

Use a disposable Zotero profile for destructive scenarios. Back up any existing plugin note before testing against a real library.

- Install the built XPI and verify that Zotero reports the expected version as enabled.
- Check a public paper with known local venue metadata; confirm the rating in the CCF column and in one `CCF Info & Citations` child note.
- Run a remote lookup. Record success or the actual failure (for example HTTP 429); do not report an unavailable service as a successful citation refresh.
- Refresh a multi-item selection and repeat a refresh while one is pending. There should still be one plugin note per parent and both fields should be retained.
- Check that failed lookups preserve earlier successful values. A real count of zero must stay distinct from unknown data.
- Confirm that attachments, notes, deleted items, and read-only libraries are excluded.
- Open/close another main window and disable/re-enable the plugin. Check for one menu entry per window, working columns, and no duplicate automatic queries.
- Verify that disabling `extensions.zotero.ccfplus.enable` stops automatic import lookups while manual refresh remains available.

List precisely which versions/platforms were tested. A declared compatibility range is not a substitute for a test matrix.

## Catalog corrections

The bundled `src/modules/ccfCatalog2026.ts` is a snapshot from a third-party mirror. Include a CCF official source, the venue's full name, its abbreviation, and its DBLP key when proposing corrections. Distinguish missing coverage from an explicit rating. Avoid sweeping claims about catalog completeness without an independently reproducible audit.

## Releases

1. Update `package.json`, `package-lock.json`, `CHANGELOG.md`, and relevant README instructions.
2. Run the checks, build, and manual acceptance steps. Check the XPI's manifest, compatibility range, and generated update-feed hash.
3. Commit the tested changes and create a tag matching the package version (for example `v0.3.4`).
4. Push the commit and tag. Manually publish the built XPI as a GitHub Release and upload the update manifests to the `release` feed. GitHub Actions is disabled.
5. Confirm that the published update manifest points to the release's package with the correct hash.

Keep release and update-feed assets from the same build. Never silently replace a versioned XPI with different bytes after users have downloaded it.
