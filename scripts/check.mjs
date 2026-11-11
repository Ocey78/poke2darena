import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = [];
async function walk(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules','dist','.git'].includes(item.name)) continue;
    const path = resolve(directory, item.name);
    if (item.isDirectory()) await walk(path);
    else files.push(path);
  }
}
await walk(root);
const errors = [];
for (const file of files.filter(file => ['.html','.css','.js','.mjs'].includes(extname(file)))) {
  const source = await readFile(file, 'utf8');
  if (['.js','.mjs'].includes(extname(file))) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) errors.push(result.stderr);
  }
  const links = extname(file) === '.html' ? [...source.matchAll(/(?:href|src)="([^"#]+)"/g)].map(match => match[1]) :
    extname(file) === '.css' ? [...source.matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g)].map(match => match[1]) : [];
  for (const link of links) {
    if (/^(https?:|data:|mailto:|#)/.test(link)) continue;
    const path = resolve(dirname(file), link.split(/[?#]/)[0]);
    try { await stat(path); } catch { errors.push(`Missing local target in ${file}: ${link}`); }
  }
}
const roster = JSON.parse(await readFile(resolve(root, 'data/roster.json')));
if (roster.length !== 1025 || new Set(roster.map(pokemon => pokemon.id)).size !== 1025) errors.push('Roster must contain 1025 unique species.');
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Checked JavaScript syntax, local page links, styles and ${roster.length} Pokémon.`);
