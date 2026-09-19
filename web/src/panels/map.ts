/**
 * The map: four planes, drawn and inspected.
 *
 * Planes live in the document as base64 so the file round-trip is exact whatever we do
 * here. This panel decodes them for drawing and writes single bytes back -- via
 * `encodeTerrain`, which is exact for all 256 values, so editing a tile cannot drop a bit
 * whose meaning has not been recovered.
 */
import {
  decodeTerrain, encodeTerrain, exploredBy, MAP1, MAP1_LABELS, setExploredBy,
  setSquareNation, squareNation, terrainColour, terrainName, TERRAIN_FULL,
} from '../../../src/format/map.js';
import { NATION } from '../../../src/format/enums.js';
import { fromB64, toB64 } from '../fields.js';
import { clear, h, hex } from '../dom.js';
import { store } from '../state.js';
import { picker, section } from './overview.js';

type View = 'terrain' | 'owner' | 'explored' | 'features';

export function mapPanel(): HTMLElement {
  const doc = store.save!.doc;
  const W = doc.header.mapWidth;
  const H = doc.header.mapHeight;
  const planes = doc.map.planes.map((p) => fromB64(p)) as [Uint8Array, Uint8Array, Uint8Array, Uint8Array];

  const commit = () => {
    doc.map.planes = planes.map(toB64) as [string, string, string, string];
    store.touch();
  };

  let view: View = 'terrain';
  let exploredNation = (doc.globals as Record<string, number>).playerNation ?? 0;
  let sel: { x: number; y: number } | undefined;
  let scale = 12;

  const canvas = h('canvas', { class: 'map-canvas' });
  const info = h('div', { class: 'map-info' });

  const draw = () => {
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const t = decodeTerrain(planes[0][i]!);
        ctx.fillStyle = terrainColour(t);
        ctx.fillRect(x * scale, y * scale, scale, scale);

        if (view === 'owner') {
          const n = squareNation(planes[2][i]!);
          if (n >= 0) {
            ctx.fillStyle = NATION_TINT[n] ?? 'rgba(255,255,255,.45)';
            ctx.fillRect(x * scale, y * scale, scale, scale);
          }
        } else if (view === 'explored') {
          if (!exploredBy(planes[3][i]!, exploredNation)) {
            ctx.fillStyle = 'rgba(8,10,14,.78)';
            ctx.fillRect(x * scale, y * scale, scale, scale);
          }
        } else if (view === 'features') {
          const b = planes[1][i]!;
          if (b & MAP1.road) dot(ctx, x, y, scale, '#d8c48a');
          if (b & MAP1.plowed) dot(ctx, x, y, scale, '#caa25a', true);
          if (b & MAP1.settlement) { ctx.fillStyle = '#f2f2f2'; ctx.fillRect(x * scale + scale / 4, y * scale + scale / 4, scale / 2, scale / 2); }
        }

        // Rivers as a short centred stroke rather than a full-width bar: a full bar
        // reads as banding across the continent at these tile sizes.
        if (view === 'terrain' && t.river) {
          ctx.fillStyle = t.majorRiver ? 'rgba(120,190,245,.95)' : 'rgba(110,175,235,.55)';
          const w = Math.max(2, scale * 0.55);
          const th = Math.max(1, Math.round(scale / 8));
          ctx.fillRect(x * scale + (scale - w) / 2, y * scale + (scale - th) / 2, w, th);
        }
      }
    }

    // Colonies, always. They are the landmark that makes the map legible.
    for (const c of doc.colonies as Array<Record<string, number>>) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#12161d';
      ctx.lineWidth = 1;
      const px = c.x! * scale, py = c.y! * scale;
      ctx.fillRect(px, py, scale, scale);
      ctx.strokeRect(px + 0.5, py + 0.5, scale - 1, scale - 1);
    }

    if (sel) {
      ctx.strokeStyle = '#ff4d6d';
      ctx.lineWidth = 2;
      ctx.strokeRect(sel.x * scale - 1, sel.y * scale - 1, scale + 2, scale + 2);
    }
  };

  const renderInfo = () => {
    clear(info);
    if (!sel) {
      info.appendChild(h('p', { class: 'note' }, 'Click a square to inspect and edit it.'));
      return;
    }
    const { x, y } = sel;
    const i = y * W + x;
    const t = decodeTerrain(planes[0][i]!);

    info.appendChild(h('h3', {}, `Square ${x}, ${y}`, h('span', { class: 'f-off' }, `index ${i}`)));

    // ---- plane 0
    const terr = h('select', {
      class: 'f-select',
      onchange: () => {
        const base = Number(terr.value);
        // Hills and mountains are a BIT, not an id: 27 and 28 are never stored in the
        // five-bit field. Selecting them sets the flags instead.
        const next = base === 27 || base === 28
          ? { ...t, hilly: true, mountains: base === 27 }
          : { ...t, hilly: false, mountains: false, base };
        planes[0][i] = encodeTerrain(next);
        commit(); draw(); renderInfo();
      },
    }, ...Object.entries(TERRAIN_FULL).map(([k, name]) =>
      h('option', { value: k, selected: Number(k) === t.id }, `${k} - ${name}`)));

    const flag = (label: string, on: boolean, set: (v: boolean) => void) =>
      h('label', { class: 'chk' },
        h('input', {
          type: 'checkbox', checked: on,
          onchange: (e: Event) => { set((e.target as HTMLInputElement).checked); commit(); draw(); renderInfo(); },
        }), label);

    info.appendChild(section(`Terrain - ${terrainName(t)}`,
      h('div', { class: 'row wrap' }, terr,
        flag('River', t.river, (v) => { planes[0][i] = encodeTerrain({ ...t, river: v }); }),
        t.river ? flag('Major', t.majorRiver, (v) => { planes[0][i] = encodeTerrain({ ...t, majorRiver: v }); }) : null,
        t.hilly ? flag('Mountains', t.mountains, (v) => { planes[0][i] = encodeTerrain({ ...t, mountains: v }); }) : null,
      ),
      h('p', { class: 'note' }, `plane 0 byte ${hex(planes[0][i]!)}`)));

    // ---- plane 1
    const b1 = planes[1][i]!;
    info.appendChild(section('Features (plane 1)',
      h('div', { class: 'row wrap' }, ...(Object.keys(MAP1) as Array<keyof typeof MAP1>).map((k) =>
        flag(MAP1_LABELS[k], (b1 & MAP1[k]) !== 0, (v) => {
          planes[1][i] = v ? planes[1][i]! | MAP1[k] : planes[1][i]! & ~MAP1[k] & 0xff;
        }))),
      h('p', { class: 'note' }, `plane 1 byte ${hex(b1)}`)));

    // ---- plane 2
    info.appendChild(section('Owner (plane 2)',
      h('div', { class: 'row wrap' },
        picker({ ...NATION, 15: '(none)' }, squareNation(planes[2][i]!) < 0 ? 15 : squareNation(planes[2][i]!),
          (v) => { planes[2][i] = setSquareNation(planes[2][i]!, v === 15 ? -1 : v); commit(); draw(); renderInfo(); })),
      h('p', { class: 'note' },
        `plane 2 byte ${hex(planes[2][i]!)}. Only the HIGH nibble is established as a nation index; `,
        'the low nibble is a separate field with no established reading and is left alone.')));

    // ---- plane 3
    info.appendChild(section('Explored by (plane 3)',
      h('div', { class: 'row wrap' }, ...[0, 1, 2, 3].map((n) =>
        flag(NATION[n]!, exploredBy(planes[3][i]!, n), (v) => { planes[3][i] = setExploredBy(planes[3][i]!, n, v); }))),
      h('p', { class: 'note' }, `plane 3 byte ${hex(planes[3][i]!)}`)));
  };

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * W);
    const y = Math.floor(((e.clientY - r.top) / r.height) * H);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    sel = { x, y };
    draw(); renderInfo();
  });

  const viewBtns = h('div', { class: 'seg' }, ...(['terrain', 'owner', 'explored', 'features'] as View[]).map((v) =>
    h('button', {
      class: `seg-b${v === view ? ' on' : ''}`,
      onclick: (e: Event) => {
        view = v;
        for (const b of Array.from(viewBtns.children)) b.classList.remove('on');
        (e.target as HTMLElement).classList.add('on');
        nationSel.style.display = v === 'explored' ? '' : 'none';
        draw();
      },
    }, v)));

  const nationSel = picker(NATION, exploredNation, (v) => { exploredNation = v; draw(); });
  nationSel.style.display = 'none';

  const zoom = h('input', {
    type: 'range', min: 4, max: 20, step: 1, value: String(scale),
    oninput: () => { scale = Number(zoom.value); draw(); },
  });

  /* The reveal-map action. reveal_around_colony is what the game uses; this is the same
   * bit, set everywhere at once. It is the single most-requested save edit there is. */
  const reveal = h('button', {
    class: 'btn',
    onclick: () => {
      const n = exploredNation;
      if (!confirm(`Mark every square explored by ${NATION[n]}? This sets one bit per square in plane 3.`)) return;
      for (let i = 0; i < planes[3].length; i++) planes[3][i] = setExploredBy(planes[3][i]!, n, true);
      commit(); view = 'explored'; draw(); renderInfo();
    },
  }, 'Reveal whole map');

  draw();
  renderInfo();

  return h('div', { class: 'panel map-panel' },
    h('div', { class: 'map-bar' }, viewBtns, nationSel, h('span', { class: 'spacer' }),
      h('label', { class: 'zoom' }, 'zoom', zoom), reveal),
    h('div', { class: 'map-split' },
      h('div', { class: 'map-wrap' }, canvas),
      h('div', { class: 'map-side' }, info)),
  );
}

const NATION_TINT: Record<number, string> = {
  0: 'rgba(220,60,60,.55)', 1: 'rgba(70,110,220,.55)', 2: 'rgba(230,190,60,.55)', 3: 'rgba(240,140,50,.55)',
  4: 'rgba(160,110,200,.5)', 5: 'rgba(200,110,160,.5)', 6: 'rgba(110,190,180,.5)', 7: 'rgba(150,170,90,.5)',
  8: 'rgba(190,150,110,.5)', 9: 'rgba(120,150,200,.5)', 10: 'rgba(200,170,200,.5)', 11: 'rgba(140,200,140,.5)',
};

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, colour: string, small = false): void {
  ctx.fillStyle = colour;
  const d = small ? s / 4 : s / 3;
  ctx.fillRect(x * s + (s - d) / 2, y * s + (s - d) / 2, d, d);
}
