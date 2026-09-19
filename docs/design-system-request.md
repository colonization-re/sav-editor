# Build brief: twelve additions to `col.css`

**For an agent working in the [web-ui](https://github.com/colonization-re/web-ui) repo.**

[docs/design-system-gaps.md](design-system-gaps.md) is the report — what was missing and
why. This is the implementation spec for the same twelve items.

A working reference implementation already exists: `web/app.css` in the **savegame-editor**
repo, where each of these is prefixed `sav-` and marked `GAP:`. The numbers below are taken
from it and are known to work in a real tool against both themes. Treat them as a starting
point, not a transcript — fit them to the system where the system already has an answer.

## Read first

`CLAUDE.md` and `README.md` in the web-ui repo govern this work. The parts that bite:

- **Classes are `col-<name>`, modifiers `col-<name>--<mod>`.** stylelint's
  `selector-class-pattern` enforces it.
- **Add each new file to the `@import` list in `src/css/index.css` by hand.** Nothing globs
  a directory; a file that is not imported silently does nothing.
- **A token identical in both themes goes in `tokens/scales.css`; one that differs goes in
  BOTH `theme-light.css` and `theme-dark.css`.** A token defined in only one theme shows up
  as an unstyled element.
- **Contrast is a hard constraint** — 4.5:1 for every text token on every surface it can
  land on, in both themes, and the test suite checks it. Item 10 is the one below that puts
  real pressure on this.
- **No decorative gradients, no JavaScript, radii top out at 6px, depth comes from borders.**
  Two durations (`--t-fast`, `--t`) and two z-indexes; if you need a third, something else
  is wrong.
- **A shipped class name is a public API.** Everything here is additive. Item 7 is the one
  exception and is flagged as such.
- **Use the existing font sizes.** The README calls 19 distinct `font-size` values the one
  place the system is not systematic — do not make it 25. Where a size is given below,
  prefer an existing step within half a pixel of it.
- Add a demo to `src/partials/` for anything with a visible shape, and a row to the
  component table in `README.md`. Run `npm run check` before calling it done.

## Where things go

| new file | items |
| --- | --- |
| `src/css/components/list.css` | 1 |
| `src/css/components/props.css` | 2 |
| `src/css/components/disclosure.css` | 3 |
| `src/css/components/range.css` | 4 |

| existing file | items |
| --- | --- |
| `src/css/components/form.css` | 5 (cells), 6 (input sizes), 8 (inline label) |
| `src/css/components/button.css` | 11 (file button) |
| `src/css/components/tile.css` | 12 (text value) |
| `src/css/base/typography.css` | 9 (mono metadata) |
| `src/css/utilities.css` | 7 (row margins), 10 (status text) |

Import order for the four new files: after `tabs.css` and before `table.css` keeps the
navigation-then-data grouping the list already has.

---

# A. New components

## 1. `.col-list` — a vertical nav list

A scrolling index of things you pick between, exactly one active. `.col-tabs` is the
horizontal cousin; `.col-table` is a table of figures. This is neither.

```html
<div class="col-list">
  <button class="col-list-item is-active">
    <span class="col-list-i">12</span>Jamestown — pop 3, Dutch
  </button>
  <button class="col-list-item">
    <span class="col-list-i">13</span>Fort Orange — pop 1, Dutch
  </button>
</div>
```

- `.col-list` — `display:flex;flex-direction:column;gap:2px`. No padding, no background:
  the consumer owns the pane it sits in and how it scrolls.
- `.col-list-item` — `display:flex;align-items:baseline;gap:9px;width:100%`, padding
  `6px 9px`, `border:0`, `border-radius:var(--r-sm)`, `font:inherit`, 13px,
  `text-align:left`, `background:none`, `color:var(--text)`, `cursor:pointer`, and a
  `background` transition on `var(--t-fast) var(--ease)`.
- `:hover` → `background:var(--surface-3)`.
- Active → `background:var(--brand);color:var(--on-brand)`. Support **both**
  `.is-active` and `[aria-selected="true"]`, the way `.col-tab` and `.col-segmented`
  already do.
- `.col-list-i` — the muted leading slot for an index or a count.
  `min-width:26px;flex:none`, mono, 11px, `color:var(--text-3)`, tabular figures.

**Pitfall.** Inside an active item the leading slot must flip to `--on-brand`, or it
vanishes against the fill. `--text-3` on `--brand` fails contrast in both themes.

```css
.col-list-item.is-active .col-list-i{color:var(--on-brand);opacity:.75}
```

Consider a `.col-list-item--sub` with extra `padding-left` for a nested index; the editor
does not need it yet, so only add it if the styleguide demo wants it.

## 2. `.col-props` — a property grid

**The most valuable item in this brief.** A repeating `label | control` pair with an
optional full-width note underneath, ruled between rows, for editing a structure field by
field. `dl.col-dl` is the read-only cousin — no control column, no note row, and
right-aligned keys that make a long scan hard to follow.

```html
<div class="col-props">
  <div class="col-prop">
    <div class="col-prop-label">
      <span class="col-prop-name">bells</span>
      <span class="col-badge col-badge--ok">high</span>
      <span class="col-meta">+0x1d</span>
    </div>
    <div><input class="col-input col-input--sm" value="14"></div>
    <div class="col-prop-desc">Accumulated liberty bells. Reset when a new statesman is produced.</div>
  </div>
  <!-- …repeated, 60+ times -->
</div>
```

- `.col-props` — `display:flex;flex-direction:column`.
- `.col-prop` — `display:grid;grid-template-columns:var(--_k,230px) 1fr;gap:9px 16px;
  align-items:start;padding:9px 0;border-top:1px solid var(--rule)`, and
  `:first-child{border-top:0}`. The `--_k` knob lets a consumer widen the label column for
  long names without redefining the component.
- `.col-prop-label` — `display:flex;flex-wrap:wrap;align-items:baseline;gap:6px`. It holds
  a name plus any number of badges and metadata spans.
- `.col-prop-name` — mono, 13px.
- `.col-prop-desc` — `grid-column:2;max-width:80ch`, 12px, `line-height:1.5`,
  `color:var(--text-3)`.
- `.col-prop--muted` — `opacity:.72`, and `:hover{opacity:1}`. For a row that is present
  but not established. (In the editor this is a field whose meaning is unknown: shown
  deliberately, but it should not compete with the rows that are known.)

Below ~700px, collapse to `grid-template-columns:1fr` and move `.col-prop-desc` to
`grid-column:1`. The repo already breaks at 700px in `tile.css`; reuse that.

**Pitfall.** The third row is a grid item, not a wrapper — `.col-prop` has three children
in a two-column grid and the description is explicitly placed in column 2. Do not wrap the
label and control in a sub-div; the rule and the alignment both depend on the flat grid.

## 3. `.col-disclosure` — a `<details>` that reads as a card

The pattern is a friendly summary on top with the complete detail folded underneath.

```html
<details class="col-disclosure">
  <summary>All 142 bytes of the globals block</summary>
  <p class="col-hint">…</p>
  <div class="col-props">…</div>
</details>
```

- `.col-disclosure` — `background:var(--surface);border:1px solid var(--border);
  border-radius:var(--r)`. No margin: let the consumer's stack space it, as `.col-card`
  already does.
- `> summary` — padding `11px 14px`, `cursor:pointer`, mono, 12px,
  `letter-spacing:.04em`, `color:var(--text-2)`; `:hover{color:var(--text)}`.
- `> *:not(summary)` — `padding:0 14px`; `> *:last-child{padding-bottom:14px}`. This keeps
  the body's left edge on the summary's, whatever the consumer puts inside.

**Decide and document one thing:** whether to keep the native disclosure triangle or draw
one. Native is fine and free; if you draw one, `summary::marker{content:""}` plus a rotated
CSS triangle needs a `transform` transition on `var(--t-fast)` and must not reintroduce a
third duration. Either way, `:focus-visible` on the summary must show the ring `a11y.css`
provides — check it, because `summary` focus is easy to lose.

## 4. `.col-range` — a slider

The only native control the system does not style. A raw `<input type=range>` beside a
`.col-check` and a `.col-select` is the one place a page stops looking like itself.

```html
<input type="range" class="col-range" min="4" max="20" step="1" value="12">
```

- `-webkit-appearance:none;appearance:none;background:none;cursor:pointer`, height 18px,
  and a sensible default width (130px) the consumer can override.
- Track — `::-webkit-slider-runnable-track` **and** `::-moz-range-track`: height 4px,
  `background:var(--surface-3)`, `border:1px solid var(--border)`,
  `border-radius:var(--r-xs)`.
- Thumb — `::-webkit-slider-thumb` (needs its own `-webkit-appearance:none`) **and**
  `::-moz-range-thumb`: 12×14, `background:var(--brand)`, `border:0`,
  `border-radius:var(--r-xs)`. A rectangle, not a circle — the system has no pills.
- Add a `:disabled` state consistent with the other controls (`--surface-3` track,
  `--text-3` thumb, `cursor:not-allowed`).

**Pitfalls.** These vendor selectors **cannot be combined into one rule** — a browser drops
the entire selector list if it does not recognise one of them, which is precisely why this
belongs in the shared sheet and not in every consumer. Write them as separate rules.
The WebKit thumb needs `margin-top` (about `-6px`) to centre on a 4px track; Firefox
centres its own. `property-no-vendor-prefix` is already disabled in the stylelint config,
so the prefixes will pass — but re-read the comment there before touching it.

## 5. `.col-cells` — captioned control cells

A tiny caption over a tiny input, tiled and wrapping. It is `.col-field` shrunk to a grid
cell. Used wherever a fixed-length array is edited: a colony's sixteen warehouse stocks,
sixteen Europe prices, any per-good or per-nation row.

```html
<div class="col-cells">
  <label class="col-cell">
    <span>Food</span>
    <input type="number" class="col-input col-input--mono col-input--xs" value="120">
  </label>
  <!-- ×16 -->
</div>
```

- `.col-cells` — `display:flex;flex-wrap:wrap;gap:8px`.
- `.col-cell` — `display:flex;flex-direction:column;gap:3px`.
- `.col-cell > span` — 10.5px, `color:var(--text-3)`. Reuse the 10.5px step that
  `.col-tile-k` and `.col-badge` already use rather than adding a size.

The `<label>` wrapper is load-bearing: it makes the caption the input's accessible name
without an `id`/`for` pair, which matters when the cells are generated in a loop.

---

# B. Modifiers on what already exists

## 6. Input sizes — `.col-input--sm`, `.col-input--xs`, `.col-input--auto`

`.col-input` is `width:100%` at 14.5px with 10px padding. Correct for a form; far too large
for a row of sixteen figures, and `width:100%` means every inline use starts with an
override.

- `.col-input--sm` — padding `5px 8px`, font-size 13px.
- `.col-input--xs` — as `--sm`, plus a fixed narrow width (~78px) for a byte or a small
  number.
- `.col-input--auto` — `width:auto`. Consider also honouring a `--_w` custom property
  (`width:var(--_w,100%)`) so a consumer can size one control without a new class; that
  would cover the editor's 112px number box and 260px name box with no further additions.

Apply the same modifiers to `.col-select` and `.col-textarea` — all three share the base
rule already, so the sizes should share it too.

**Pitfall.** `.col-select` reserves `padding-right:34px` for its drawn arrow, and the
arrow's `background-position` is measured from the right edge. Shrink the select and check
the arrow still sits correctly and does not collide with the text — this is the one place
a size modifier can silently break an existing component.

## 7. `.col-row` should neutralise its children's margins

**The only item here that changes existing behaviour.** `.col-field` (18px), `.col-check`
(11px) and `.col-switch` (11px) all carry a bottom margin that assumes a stacked form. Put
three checks in a `.col-row` and the row is taller than it should be and sits off its own
baseline.

```css
.col-row > .col-field,
.col-row > .col-check,
.col-row > .col-switch{margin-bottom:0}
```

A row is a horizontal arrangement, so a bottom margin on its children is very unlikely to
be wanted by anyone — but it is a change to shipped output, so it is your call whether it
lands as the rule above or as an opt-in `.col-row--tight`. **The direct fix is the better
one**, because the alternative means every consumer discovers the problem first.

Right now the savegame-editor reaches into `col-` selectors to zero these itself, which is
the one place it breaks its own rule about not shadowing the design system. That override
disappears when this ships.

## 8. `.col-label--inline`

`.col-label` has the right voice — 11px mono, `letter-spacing:.1em`, uppercase,
`color:var(--text-3)` — but it is `display:block` with a margin under it, for a control on
the next line. A dense row needs the same voice beside the control.

```css
.col-label--inline{display:inline-block;margin:0;white-space:nowrap}
```

Check it sits on the control's centre line inside a `.col-row` (which is
`align-items:center`), not on its baseline.

## 9. `.col-meta` — small mono metadata

11px mono, `color:var(--text-3)`, `font-variant-numeric:tabular-nums`. For a byte offset, a
width, a write number, an index, a bit mask — the quiet technical annotation beside a name.

`.col-mono` is `.93em` of whatever it sits in and is not quiet. `.col-badge` is the right
size and weight but is a bordered pill, too loud to repeat sixty times down a column.

**Before adding an 11px step**, check whether 11.5px (`.col-eyebrow`) or 10.5px
(`.col-tile-k`, `.col-badge`, `.col-table th`) reads the same in place. Reusing one is
worth more than the half pixel. Name it `.col-meta` rather than `.col-mono--sm` — it is a
role, not a size, and the tabular figures are part of it.

## 10. `.col-ok` / `.col-warn` / `.col-danger` — status text

The system has `.col-dim` and `.col-faint`, but `--ok` / `--warn` / `--danger` as *text*
are reachable only through a badge, a note or a button — all boxes. A one-word status
inside a sentence has nowhere to go.

```css
.col-ok{color:var(--ok)}
.col-warn{color:var(--warn)}
.col-danger{color:var(--danger)}
```

**This is the contrast risk in this brief, and the reason to do it here rather than let
every consumer do it badly.** `--ok`, `--warn` and `--danger` are currently used as fills
and as accents, not as body text on a surface. Promoting them to text utilities means they
must clear 4.5:1 on `--surface`, `--surface-2`, `--surface-3` and `--bg`, in **both**
themes. `--warn` is the one to check first: `--amber-500` in light is the likely failure.

If a colour does not clear it, do **not** ship the utility against the raw token — add a
text-weight variant (`--ok-text` and friends, defined in both theme files) and point the
utility at that. A utility that fails contrast is worse than no utility, because it looks
sanctioned.

## 11. `.col-btn--file`

`<input type="file">` cannot be styled. The only way to make it look like a button is to
hide it under a `<label>` that is one — and every tool that opens a file writes the same
three lines, with a good chance of getting the hit area wrong.

```html
<label class="col-btn col-btn--outline col-btn--file">
  Open .SAV<input type="file" accept=".sav">
</label>
```

```css
.col-btn--file{position:relative;overflow:hidden}
.col-btn--file input{position:absolute;inset:0;opacity:0;cursor:pointer;font-size:0}
```

`inset:0` is what makes the whole face of the button clickable rather than just the native
control's own box. `font-size:0` stops a tall default control forcing the label taller.

**Do not skip the keyboard case.** The input stays focusable but is invisible, so focus
lands on something nobody can see. The label needs to show the ring on its behalf:

```css
.col-btn--file:has(input:focus-visible){outline:2px solid var(--brand);outline-offset:2px}
```

`:has()` is safe for this sheet's baseline — `form.css` already uses
`.col-check:has(input:disabled)`.

## 12. `.col-tile-v--text`

`.col-tile-v` is 30px, weight 660, `letter-spacing:-.03em` — sized for a figure. A tile
whose value is a name, a file, a status or an ID wraps out of the tile at that size.

```css
.col-tile-v--text{font-size:16px;letter-spacing:-.01em;word-break:break-all}
```

Reuse an existing step near 16px rather than adding one. `word-break:break-all` is there
for identifiers with no break opportunity (`_DECLARE.SAV`); if that reads badly in the
demo, `overflow-wrap:anywhere` is the gentler option. A `.col-tile--text` that styles its
own `.col-tile-v` is also reasonable — pick whichever matches how the other tile modifiers
are written.

---

## Done means

- `npm run check` passes — build, stylelint, `check-css.mjs`, and the contrast tests.
- Each new file is in the `@import` list in `src/css/index.css`, in a deliberate position.
- Every visible item has a demo in `src/partials/`, showing its states: the active list
  row, the muted property row, the disabled range, the focused file button.
- The component table in `README.md` has the new classes.
- Any new token is in `scales.css` if it is theme-independent, or in **both** theme files
  if it is not.
- Nothing existing was renamed. The only modified shipped rule is item 7, and it is called
  out in the commit message.

## The consumer contract

When this ships, the savegame-editor re-vendors `col.css`, deletes the corresponding
`sav-` rules from `web/app.css`, and cuts the matching entry from
`docs/design-system-gaps.md`. What should survive there afterwards is only the app shell —
the full-viewport frame a design system should not own. If a `sav-` rule marked `GAP:`
cannot be deleted after this work, the shape shipped does not fit the use, and that is
worth a round trip rather than a consumer override.
