import { cp, mkdir, readdir, lstat, rm, writeFile } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
if (dirname(output) !== resolve(root)) throw new Error('Build output must stay inside this project.');
try {
  const existing = await lstat(output);
  if (existing.isSymbolicLink()) throw new Error('Build output cannot be a symbolic link.');
  await rm(output, { recursive: true });
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await mkdir(output, { recursive: true });
const entries = ['index.html', 'styles.css', 'site.js', 'pages.css', 'online.js', 'play-online', 'guides', 'release-date', 'about', 'assets', 'data'];
for (const entry of entries) {
  await cp(resolve(root, entry), resolve(output, entry), {
    recursive: true,
    filter: (source) => !source.endsWith('.test.js') && !['.py', '.webp'].includes(extname(source)),
  });
}
await writeFile(resolve(output, '.nojekyll'), '');
let count = 0;
async function countFiles(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (item.isDirectory()) await countFiles(resolve(directory,item.name));
    else count++;
  }
}
await countFiles(output);
console.log(`Built ${count} static files in ${output}`);
