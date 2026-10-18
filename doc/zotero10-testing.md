# Zotero 10 compatibility release (0.3.3)

The manifest now allows Zotero versions through `10.0.*`. The plugin ID,
minimum version, dependencies, and saved CCF note format remain unchanged.
This release addresses the installation compatibility gate; Windows runtime
validation is still required.

## Install on Windows

1. Download or build `zotero-ccf-plus.xpi`.
2. In Zotero, open **Tools → Plugins** (or **Add-ons**, depending on the locale).
3. Open the gear menu, choose **Install Plugin/Add-on From File**, and select
   the XPI. Confirm that Zotero CCF Plus shows version **0.3.3** and is enabled.
4. Restart Zotero.

An existing installation is upgraded under the same plugin ID. There is no
need to uninstall the previous version or delete its saved CCF notes.

## Manual smoke test

Use a small test collection. Lookup operations create or update child notes.

- Enable the **CCF Info** and **Citation Number** columns from the items list's
  column picker.
- Right-click one regular paper and choose **Get CCF Info**. Check its CCF
  result, citation result, and **CCF Info & Citations** child note.
- Repeat the lookup and confirm it updates that note without creating a duplicate.
- Process a small batch, including an arXiv item, and check all selected papers.
- Add a new paper and allow at least ten seconds for automatic processing.
- Disable and re-enable the plugin. Confirm the menu and columns return and a
  lookup still works. If using multiple main windows, check each window too.
- Restart Zotero and confirm the saved results remain visible.

Record the Windows and Zotero versions and the failing step if anything breaks.
Use **Help → Debug Output Logging** to capture a reproduction, and include any
errors mentioning **CCF Plus** or `ccfplus`. Citation requests depend on Semantic
Scholar; an HTTP error such as 429 should be reported separately from installation
or Zotero API errors.

## Build from WSL

Use Node.js 22 or newer. Run the build in WSL; the resulting XPI can be installed
in Windows Zotero without Windows build tools.

```bash
npm install --ignore-scripts
npm run build
```

The output is `build/zotero-ccf-plus.xpi`, accompanied by `update.json` and
`update-beta.json`. Disabling dependency install scripts avoids preparing large
upstream Git dependencies included by the Zotero type definitions.

To limit D: usage, use an isolated copy of the source under WSL `/tmp`, with the
npm cache there as well, and copy only the XPI and update JSON files back to the
repository's `build/` directory.

## Publishing

Attach the XPI to the `v0.3.3` release. Publish the generated stable `update.json`
at the existing `release` tag's asset URL. It includes the XPI's SHA-512 hash and
the same `10.0.*` compatibility limit. Rebuild and regenerate the feed together
if the XPI changes.
