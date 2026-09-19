# Vendored `col.css`

`col.css` is [`@colonization-re/web-ui`](https://github.com/colonization-re/web-ui), pinned
to a release and committed. **`col-css.json` is the pin** — tag, asset, sha256 — and the
only place the version is written down. Read it, do not guess from the banner comment.

## Why it is vendored and not linked

`npm run web:build` produces **one self-contained `dist-web/index.html`** that opens from
`file://`. A `<link>` to a release URL would mean the editor phones GitHub every time
someone opens their save — exactly the property `web/` exists to avoid. A copy in the tree
is the only way a single file stays a single file, and it also means the build is
reproducible offline and in CI.

## Bumping

```sh
npm run vendor:css -- v1.2.0     # fetch that release, verify, rewrite the pin
npm run check                    # then look at the editor in a browser
```

That is the whole procedure. The script downloads the asset **and** the release's
`SHA256SUMS.txt`, refuses to write anything unless the hashes agree, and records the hash
in the pin.

Other forms:

```sh
npm run vendor:css               # re-fetch the currently pinned tag
npm run vendor:css -- --check    # offline: does the committed file match the pin?
```

`--check` runs as part of `npm run check`, so a hand-edited vendor file or a half-finished
bump fails there rather than in someone's browser.

## Rules

- **Do not edit `col.css`.** `--check` will catch it. Anything the editor needs that the
  design system does not provide goes in [`web/app.css`](../app.css), namespaced `sav-`,
  and gets written up in [docs/design-system-gaps.md](../../docs/design-system-gaps.md).
- **Do not hand-copy the file** from a local web-ui checkout. A working-tree build has no
  version and no checksum; the pin would then be a lie.
- web-ui treats a shipped class name as a public API, so a bump adds names rather than
  renaming them. `test/ui.test.ts` renders every panel against both saves, but it runs in
  jsdom and **cannot see a layout regression** — look at the editor after a bump.

## Why not an npm dependency

web-ui is not published to the npm registry, and its `dist/` is git-ignored with no
`prepare` script, so a `github:` dependency would install the sources without the built
stylesheet. The release assets are the distribution channel that repo actually supports —
its release workflow calls those four asset names a contract.
