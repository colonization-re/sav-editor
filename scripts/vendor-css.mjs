/**
 * Vendor `col.css` from a pinned web-ui release.
 *
 * The editor ships as ONE self-contained `dist-web/index.html`, so the stylesheet has to
 * be in the tree at build time -- a `<link>` to a release URL would make the page fetch
 * GitHub every time someone opens a save. But a file copied by hand has no version and no
 * provenance, so this script owns the copy instead:
 *
 *   web/vendor/col-css.json   the pin: tag, asset, sha256. The ONLY place a version lives.
 *   web/vendor/col.css        the vendored bytes, committed.
 *
 *   npm run vendor:css                  re-fetch the pinned tag and verify it
 *   npm run vendor:css -- v1.2.0        bump: fetch that tag, rewrite the pin
 *   npm run vendor:css -- --check       offline; does the committed file match the pin?
 *
 * `--check` runs as part of `npm run check`, so a hand-edited or half-updated vendor file
 * fails there rather than in someone's browser.
 *
 * Every release attaches SHA256SUMS.txt alongside the assets. We verify against it rather
 * than trusting the download, then record that hash in the pin -- which is what makes
 * `--check` mean something offline.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const VENDOR = join(HERE, '..', 'web', 'vendor');
const PIN = join(VENDOR, 'col-css.json');

const REPO = 'colonization-re/web-ui';
const ASSET = 'col.css';
const SUMS = 'SHA256SUMS.txt';

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const readPin = () => JSON.parse(readFileSync(PIN, 'utf8'));
const url = (tag, file) => `https://github.com/${REPO}/releases/download/${tag}/${file}`;

function die(msg) {
  console.error(`\n  ${msg}\n`);
  process.exit(1);
}

async function get(u) {
  const res = await fetch(u, { redirect: 'follow' });
  if (!res.ok) die(`GET ${u}\n  ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

/** The checksums file is `<sha256>  <name>` per line, as `sha256sum` writes it. */
function expectedHash(sums, name) {
  for (const line of sums.toString('utf8').split('\n')) {
    const m = line.trim().match(/^([0-9a-f]{64})\s+\*?(.+)$/);
    if (m && m[2] === name) return m[1];
  }
  die(`${SUMS} has no entry for ${name}`);
}

function check() {
  const pin = readPin();
  let bytes;
  try {
    bytes = readFileSync(join(VENDOR, ASSET));
  } catch {
    die(`web/vendor/${ASSET} is missing.\n  Run: npm run vendor:css`);
  }
  const got = sha256(bytes);
  if (got !== pin.sha256) {
    die(
      `web/vendor/${ASSET} does not match the pin.\n\n` +
      `    pinned   ${pin.tag}  ${pin.sha256}\n` +
      `    on disk            ${got}\n\n` +
      `  The vendored file was edited by hand, or a bump was left half-done.\n` +
      `  Never edit it: app-local rules belong in web/app.css.\n` +
      `  To restore it:  npm run vendor:css`,
    );
  }
  console.log(`  col.css  ${pin.tag}  sha256 ok`);
}

async function vendor(tag) {
  console.log(`  fetching ${ASSET} from ${REPO} ${tag}`);
  const [css, sums] = await Promise.all([get(url(tag, ASSET)), get(url(tag, SUMS))]);

  const want = expectedHash(sums, ASSET);
  const got = sha256(css);
  if (got !== want) {
    die(`checksum mismatch for ${ASSET} at ${tag}\n    expected  ${want}\n    got       ${got}`);
  }

  const before = readPin();
  writeFileSync(join(VENDOR, ASSET), css);
  writeFileSync(PIN, `${JSON.stringify({
    repo: REPO,
    tag,
    asset: ASSET,
    sha256: got,
    bytes: css.length,
    vendored: new Date().toISOString().slice(0, 10),
  }, null, 2)}\n`);

  const moved = before.tag !== tag;
  console.log(
    `\n  web/vendor/${ASSET}  ${(css.length / 1024).toFixed(0)} KB, sha256 verified` +
    `\n  ${moved ? `${before.tag} -> ${tag}` : `re-vendored ${tag}`}\n` +
    (moved
      ? '\n  This changes shipped CSS. Run `npm run check`, then look at the editor:\n' +
        '  test/ui.test.ts renders every panel but cannot see a layout regression.\n'
      : ''),
  );
}

const args = process.argv.slice(2);
if (args.includes('--check')) {
  check();
} else {
  const tag = args.find((a) => !a.startsWith('-')) ?? readPin().tag;
  if (!/^v\d+\.\d+\.\d+/.test(tag)) die(`not a release tag: ${tag}\n  Expected something like v1.1.0`);
  await vendor(tag);
}
