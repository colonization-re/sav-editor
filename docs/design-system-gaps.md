# Web UI migration note

The editor is styled by [`@colonization-re/web-ui`](https://github.com/colonization-re/web-ui)
through the vendored [web/vendor/col.css](../web/vendor/col.css). The current pin is
recorded in [web/vendor/col-css.json](../web/vendor/col-css.json).

This file used to list twelve reusable components that the editor carried locally as
`sav-*` classes. Those gaps were added upstream and are present in the vendored `col.css`.
The app now uses the Web UI classes directly:

- `.col-list`, `.col-list-item`, `.col-list-i`
- `.col-props`, `.col-prop`, `.col-prop-label`, `.col-prop-name`, `.col-prop-desc`
- `.col-meta`
- `.col-input--sm`, `.col-input--xs`, `.col-select--auto`, `.col-select--sm`
- `.col-label--inline`
- `.col-cells`, `.col-cell`
- `.col-ok`, `.col-warn`, `.col-danger`
- `.col-disclosure`
- `.col-range`
- `.col-btn--file`
- `.col-tile-v--text`

The remaining `sav-*` rules in [web/app.css](../web/app.css) are app-specific: viewport
layout, split panes, the map frame, status chrome, section spacing, and exact control
widths for this save editor.

When bumping Web UI, follow [web/vendor/README.md](../web/vendor/README.md) and run:

```sh
npm run check
```
