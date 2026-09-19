# What the editor needs that `col.css` does not have

The browser editor is styled by [`@colonization-re/web-ui`](https://github.com/colonization-re/web-ui)
— `col.css`, vendored at [web/vendor/col.css](../web/vendor/col.css). Everything it can
borrow, it borrows: buttons, inputs, checks, the segmented control, tabs, cards, tiles,
badges, chips, notes, hints, the plate, the brand mark, `.col-art`, and the whole token
palette.

What it could not borrow lives in [web/app.css](../web/app.css), namespaced `sav-`. That
file has two halves. The first is the **app shell** and is nobody's business but this
tool's — see the last section. The second is marked `GAP:`, and is the subject of this
document: rules that are not specific to savegame editing at all, and that the next tool
built on `col.css` will write again from scratch.

This is a report from a consumer, not a patch. `web-ui` treats a shipped class name as a
public API, so the names below are suggestions; the shapes are the finding.

---

## The twelve gaps

### 1. A nav list — `.sav-list-item`, `.sav-list-i`

**Used by** the master-detail index in every record panel: colonies, units, nations, native
settlements, tribes. 277 rows for `_DECLARE.SAV`, filtered live, exactly one selected.

Rows of a selectable index: flush, dense, keyboard-reachable, one active. `.col-tabs` is
the horizontal cousin and `.col-table` is a table of figures; neither is a vertical list of
things you pick between. The active row here fills with `--brand`, which also means the
index number inside it needs `--on-brand` rather than `--text-3`.

Suggested: `.col-list` / `.col-list-item` with `.is-active`, and a muted leading slot.

### 2. A property grid — `.sav-fields`, `.sav-field`, `.sav-field-label`, `.sav-field-desc`

**Used by** the generic record editor, which is the editor's core: every field of every
record, generated from the `FieldSpec` tables. The globals block alone is 142 bytes across
~60 rows; `raw.ts` renders 41 more.

A repeating `label | control` pair with an optional full-width note underneath, ruled
between rows. `dl.col-dl` is the read-only cousin — but it has no control column, no third
row for the note, and right-aligns its keys, which makes a 60-row scan hard to follow.
This is the single biggest thing missing, and any tool that edits a structure will want it.

Suggested: `.col-props` / `.col-prop` + `-label` / `-desc`, with the label column width as
a custom property.

### 3. Small mono metadata — `.sav-meta`

**Used by** the byte offset beside every field name (`+0x1d`), the write number in the raw
panel, the tile index in the map inspector, the bit mask beside each game flag.

11px mono, `--text-3`, tabular figures. `.col-mono` is `.93em` of whatever it sits in and
is not quiet; `.col-badge` is the right size and weight but is a bordered pill, which is
too loud to repeat 60 times down a column.

Suggested: `.col-meta`, or a `.col-mono--sm` alongside the existing `.col-mono`.

### 4. Compact and inline form controls — `.sav-input--sm`, `--num`, `--xs`, `--text`, `.sav-select--auto`, `.sav-hex`

**Used by** nearly every control in the editor. A colony warehouse is 16 number boxes in a
row; the Europe price list is another 16; an array field renders one box per element.

`.col-input` is `width:100%` at `14.5px` with `10px` padding — correct for a form, far too
large for a row of figures, and `width:100%` means every inline use has to be overridden.
Three things are missing: a **size** (`--sm`), an **auto width** so a control can sit in a
row, and **explicit widths** for the common cases (a number, a short name, a byte).

Suggested: `.col-input--sm`, `.col-input--auto`, and letting a `--_w` custom property set
the width. The same applies to `.col-select` and `.col-textarea`.

### 5. Margin-free variants for use in a row

**Used by** every `.col-row` in the editor that contains a check or a field.

`.col-field` (18px), `.col-check` (11px) and `.col-switch` (11px) all carry a bottom margin
that assumes a stacked form. Put three checks in a `.col-row` and the row is taller than it
should be and sits off its own baseline. The editor currently reaches into `col-`
selectors to zero these, which is the one place it breaks its own rule about not shadowing
the design system.

Suggested: a `.col-row` that neutralises the margins of its own children, which would fix
this everywhere at once without a new class.

### 6. An inline label — `.sav-label`

**Used by** `Turn`, `You play`, `Difficulty`, `Owner`, `Population`, `At`, `Orders`,
`Tax %`, `Bells`, `Crosses`, `zoom`.

`.col-label` is the right voice — 11px mono, letterspaced, uppercase, `--text-3` — but it
is `display:block` with a margin under it, for a control on the next line. A dense row
needs the same voice beside the control.

Suggested: `.col-label--inline`.

### 7. A captioned control cell — `.sav-cells`, `.sav-cell`

**Used by** the colony warehouse, the Europe price list, and every fixed-length array field
in the generic editor.

A tiny caption over a tiny input, tiled and wrapping. It is `.col-field` shrunk to a grid
cell: caption above, no bottom margin, and the pair wrapped in a `<label>` so the caption
is the control's accessible name.

Suggested: `.col-cells` / `.col-cell`, or `.col-field--cell` inside a wrapping row.

### 8. Text in a status colour — `.sav-ok`, `.sav-warn`

**Used by** the date readout, which is green when `turnCounter`, `year` and `season` agree
and amber when the file contradicts itself.

`col.css` has `.col-dim` and `.col-faint`, but `--ok` / `--warn` / `--danger` as *text* are
reachable only through a badge, a note or a button — all of which are boxes. A one-word
status inside a sentence has nowhere to go.

Suggested: `.col-ok` / `.col-warn` / `.col-danger` as text-colour utilities, next to
`.col-dim`.

### 9. A disclosure — `.sav-disclosure`

**Used by** the "All 142 bytes of the globals block" block under the overview, and the
"All N bytes of …" block under every record detail. The pattern throughout the editor is a
friendly summary on top with the complete generic editor folded underneath, so this appears
on six of the eight panels.

A `<details>` that reads as a card: a bordered surface, a mono summary row that is clearly
clickable, and body padding that lines up with it.

Suggested: `.col-disclosure`, sharing the card's border and radius.

### 10. A range input — `.sav-range`

**Used by** the map zoom, 4–20px per tile.

`col.css` styles every other native control — checkbox, radio, switch, select arrow — so a
raw `<input type=range>` beside them is the one place the page stops looking like itself.
It needs the `::-webkit-slider-runnable-track` / `::-moz-range-track` /
`::-webkit-slider-thumb` / `::-moz-range-thumb` set; there is no way to do it with one
selector, which is exactly why it belongs in the shared sheet and not in each consumer.

Suggested: `.col-range`.

### 11. A file-input button — `.sav-filebtn`

**Used by** `Open .SAV`.

`<input type="file">` cannot be styled, so the only way to make it look like a button is to
hide it at `opacity:0` under a `<label>` that is one. Every tool that opens a file needs
the same three lines, and getting them slightly wrong means a button that is not clickable
across its whole face.

Suggested: `.col-btn--file`, as a modifier a `<label>` can carry.

### 12. A stat tile whose value is text — `.sav-tile-v--text`

**Used by** the `File` tile on the overview, which holds a save's file name.

`.col-tile-v` is 30px, weight 660 and letterspaced `-.03em` — sized for a figure. A file
name at that size wraps out of the tile, and `_DECLARE.SAV` has nowhere to break.

Suggested: `.col-tile-v--text`, or `.col-tile--text`.

---

## Not gaps, but worth saying

**The app shell is correctly absent.** `col.css` lays out a *document*: `.col-wrap` centres
a column and the page scrolls as one. The editor is an application frame — fixed chrome,
tabs, and panes that scroll independently inside the viewport (`.sav-app`, `.sav-panel`,
`.sav-split`, `.sav-viewport`, the map layout). That is not a gap; a design system that
tried to own it would be guessing. It is listed here only so the next reader knows the
`sav-` rules in the first half of `app.css` are deliberate and not an oversight.

**The dark theme carried the whole editor for free.** The old stylesheet was a hand-rolled
dark palette. Setting `data-theme="dark"` on `<html>` replaced all of it, and the editor
now also works in light — which it never did — without a line written for it.

**What mapped cleanly, with nothing lost:** `.col-bar` + `.col-brand` for the top bar,
`.col-tabs` / `.col-tab`, `.col-btn` and its variants, `.col-segmented` for the map view
switch, `.col-tiles` for the overview figures, `.col-card` + `.col-eyebrow` for every
section, `.col-chip` for a read-only value, `.col-hint` and `.col-hint--error` for notes
and validation, `.col-check`, `.col-input` / `.col-select` / `.col-textarea`, `.col-plate`
for the empty state, `.col-art` for the map canvas, `.col-row` and `.col-push`.

**One happy accident:** `.col-badge` is exactly the confidence pill the field tables need —
mono, tiny, uppercase, tinted from one custom property. `high` is `--ok`, `medium` is
`--warn`, `unknown` is the neutral default. That was three bespoke rules before and is now
a modifier.
