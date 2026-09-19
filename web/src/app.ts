/** The shell: open a file, pick a tab, download the result. */
import { clear, h, qs } from './dom.js';
import { download, store } from './state.js';
import { overviewPanel } from './panels/overview.js';
import { coloniesPanel, nationsPanel, settlementsPanel, tribesPanel, unitsPanel } from './panels/records.js';
import { mapPanel } from './panels/map.js';
import { rawPanel } from './panels/raw.js';

const TABS = [
  { id: 'overview', label: 'Overview', render: overviewPanel },
  { id: 'nations', label: 'Nations', render: nationsPanel },
  { id: 'colonies', label: 'Colonies', render: coloniesPanel },
  { id: 'units', label: 'Units', render: unitsPanel },
  { id: 'natives', label: 'Natives', render: settlementsPanel },
  { id: 'tribes', label: 'Tribes', render: tribesPanel },
  { id: 'map', label: 'Map', render: mapPanel },
  { id: 'raw', label: 'Raw fields', render: rawPanel },
] as const;

let active: string = 'overview';

export function start(): void {
  const file = qs<HTMLInputElement>('#file');
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (f) await openFile(f);
    file.value = '';
  });

  const drop = qs('#app');
  for (const ev of ['dragover', 'dragenter'] as const) {
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-dragging'); });
  }
  for (const ev of ['dragleave', 'drop'] as const) {
    drop.addEventListener(ev, () => drop.classList.remove('is-dragging'));
  }
  drop.addEventListener('drop', async (e) => {
    e.preventDefault();
    const f = (e as DragEvent).dataTransfer?.files?.[0];
    if (f) await openFile(f);
  });

  qs('#save').addEventListener('click', () => {
    if (!store.save) return;
    try {
      const { bytes } = store.build();
      download(store.save.name.replace(/\.sav$/i, '') + '-edited.SAV', bytes, 'application/octet-stream');
    } catch (err) { alert(`Could not build the save:\n\n${(err as Error).message}`); }
  });

  qs('#json').addEventListener('click', () => {
    if (!store.save) return;
    download(store.save.name + '.json', JSON.stringify(store.save.doc, null, 2), 'application/json');
  });

  qs('#revert').addEventListener('click', () => {
    if (store.save && confirm('Discard all changes and reload the file as opened?')) store.revert();
  });

  store.subscribe(render);
  render();
}

async function openFile(f: File): Promise<void> {
  try {
    store.open(f.name, new Uint8Array(await f.arrayBuffer()));
  } catch (err) {
    alert(`Could not read ${f.name}:\n\n${(err as Error).message}`);
  }
}

function render(): void {
  const empty = qs('#empty');
  const main = qs('#main');
  const bar = qs('#status');

  if (!store.save) {
    empty.style.display = '';
    main.style.display = 'none';
    bar.textContent = '';
    qs<HTMLButtonElement>('#save').disabled = true;
    qs<HTMLButtonElement>('#json').disabled = true;
    qs<HTMLButtonElement>('#revert').disabled = true;
    return;
  }

  empty.style.display = 'none';
  main.style.display = '';
  qs<HTMLButtonElement>('#save').disabled = false;
  qs<HTMLButtonElement>('#json').disabled = false;
  qs<HTMLButtonElement>('#revert').disabled = !store.dirty;

  let changed = 0;
  let error = '';
  try { changed = store.build().changed; } catch (e) { error = (e as Error).message; }

  bar.className = error ? 'sav-status sav-status--error' : 'sav-status';
  bar.textContent = error
    ? `cannot build: ${error}`
    : store.dirty
      ? `${store.save.name} - ${changed} byte${changed === 1 ? '' : 's'} changed`
      : `${store.save.name} - ${store.save.original.length.toLocaleString()} bytes, unmodified`;

  const tabs = qs('#tabs');
  clear(tabs);
  for (const t of TABS) {
    tabs.appendChild(h('button', {
      class: `col-tab${t.id === active ? ' is-active' : ''}`,
      'aria-selected': String(t.id === active),
      onclick: () => { active = t.id; render(); },
    }, t.label));
  }

  const body = qs('#body');
  clear(body);
  const tab = TABS.find((t) => t.id === active) ?? TABS[0];
  try {
    body.appendChild(tab.render());
  } catch (err) {
    body.appendChild(h('p', { class: 'col-hint col-hint--error' }, `panel failed: ${(err as Error).message}`));
  }
}
