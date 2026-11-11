import { mkdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const response = await fetch('https://play.pokemonshowdown.com/data/pokedex.json');
if (!response.ok) throw new Error(`Roster download failed (${response.status})`);
const pokedex = await response.json();
const species = new Map();
for (const pokemon of Object.values(pokedex)) {
  if (pokemon.num < 1 || pokemon.num > 1025 || pokemon.forme) continue;
  species.set(pokemon.num, {
    id: pokemon.num, name: pokemon.name, types: pokemon.types,
    stats: pokemon.baseStats,
  });
}
const roster = [...species.values()].sort((a, b) => a.id - b.id);
if (roster.length !== 1025) throw new Error(`Expected 1025 species, found ${roster.length}`);
await mkdir(new URL('data/', root), { recursive: true });
await writeFile(new URL('data/roster.json', root), JSON.stringify(roster));
await mkdir(new URL('assets/sprites/', root), { recursive: true });
const starters = [3, 6, 9, 25, 65, 68, 94, 123, 143, 149, 212, 448];
for (const id of starters) {
  const image = await fetch(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`);
  if (!image.ok) throw new Error(`Sprite ${id} download failed`);
  await writeFile(new URL(`assets/sprites/${id}.png`, root), Buffer.from(await image.arrayBuffer()));
}
await mkdir(new URL('assets/fonts/', root), { recursive: true });
for (const name of ['Silkscreen-Regular.ttf', 'Silkscreen-Bold.ttf', 'OFL.txt']) {
  const font = await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/silkscreen/${name}`);
  if (!font.ok) throw new Error(`Font download failed (${name})`);
  await writeFile(new URL(`assets/fonts/${name}`, root), Buffer.from(await font.arrayBuffer()));
}
console.log(`Saved ${roster.length} species, ${starters.length} sprites and fonts.`);
