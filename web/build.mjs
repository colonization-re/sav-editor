/**
 * Build the editor.
 *
 * Two outputs, deliberately:
 *   web/dist/bundle.js  - for `npm run web:dev`, served next to index.html
 *   dist-web/index.html - ONE self-contained file, script and styles inlined
 *
 * The single file is the point. It opens from file://, works with no server, and can be
 * handed to someone as an attachment. No save ever leaves the browser because there is
 * nowhere for it to go.
 */
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const watch = process.argv.includes('--watch');

const common = {
  entryPoints: [join(HERE, 'src', 'main.ts')],
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  logLevel: 'info',
};

mkdirSync(join(HERE, 'dist'), { recursive: true });

if (watch) {
  const ctx = await (await import('esbuild')).context({
    ...common,
    outfile: join(HERE, 'dist', 'bundle.js'),
    sourcemap: true,
  });
  await ctx.watch();
  const { hosts, port } = await ctx.serve({ servedir: HERE, port: 5173 });
  console.log(`\n  editor:  http://${hosts[0] ?? 'localhost'}:${port}/index.html\n`);
} else {
  await build({ ...common, outfile: join(HERE, 'dist', 'bundle.js'), sourcemap: true });

  const { outputFiles } = await build({
    ...common, write: false, minify: true, outfile: 'bundle.js', sourcemap: false,
  });
  const js = outputFiles[0].text;
  const css = readFileSync(join(HERE, 'styles.css'), 'utf8');

  const html = readFileSync(join(HERE, 'index.html'), 'utf8')
    .replace(/<!--STYLE-->[\s\S]*?<!--\/STYLE-->/, `<style>\n${css}\n</style>`)
    // The bundle can contain "</script>" inside a string literal; split the tag so the
    // parser cannot end the block early.
    .replace(/<!--SCRIPT-->[\s\S]*?<!--\/SCRIPT-->/, `<script type="module">\n${js.replace(/<\/script>/gi, '<\\/script>')}\n</script>`);

  const out = join(ROOT, 'dist-web');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'index.html'), html);
  const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
  console.log(`\n  dist-web/index.html  ${kb} KB, self-contained\n`);
}
