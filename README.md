# Poke2D Arena community build

An independently implemented browser arena inspired by [Poke2D Arena](https://poke2darena.com/), ready to host as a static GitHub Pages site. Local gameplay is an approximation built with original battle code and artwork. It does not reproduce the original proprietary source, exact combat rules, or story narrative.

The local game includes 1,025 species, three saved teams, six visual arenas, three CPU difficulties, and sixteen challenge stages. Keyboard, mouse, and touch controls are supported. Team choices, settings, and challenge progress save in the browser.

## Run locally

Node.js is required. The checks have been run with Node.js 24. Install the development test dependency before running the full test suite.

```sh
npm ci
npm start
```

Open the local address printed by the server. Serve the project over HTTP so the game can load its modules and roster data.

```sh
npm test
npm run check
npm run build
```

The build copies the deployable static site into `dist/`. The GitHub Pages workflow publishes that directory. In the repository’s **Settings → Pages**, select **GitHub Actions** as the build source. Relative links support hosting at a project path such as `https://username.github.io/repository/`.

The tests cover battle rules, lifecycle, save validation and menu flows using a simulated DOM and canvas. Visual browser verification was unavailable while this build was prepared because browser use was disabled in the workspace settings.

## Online play

The Online screen opens the official game at `https://poke2darena.com/play-online/` and can open a validated official invitation. The real multiplayer service returned HTTP 403 for requests from a tested GitHub Pages origin on November 11, 2026. Direct multiplayer from this build requires a server integration that the operator accepts. No complete multiplayer match has been verified through this build.

Local saves are separate from progress in the official game. Export and import in Settings move this build’s saves between browsers. Official save-code compatibility is not implemented.

## Controls

| Action | Input |
| --- | --- |
| Move | WASD or arrow keys |
| Aim | Mouse |
| Basic attack | Left click |
| Second skill | Right click |
| Dash | Space |
| Heavy attack | Q |
| Ultimate | E when charged |
| Switch | R or 1–3 |

Touch controls appear on phones. The [local guides page](guides/index.html) explains this build and links to official guides whose mechanics may differ.

## Project layout

- `index.html`, `styles.css`, and `site.js` provide the home page and shared navigation.
- `play-online/` contains the local game interface, battle simulation, and battle tests.
- `online.js` keeps the official-game handoff and invitation validation together.
- `data/roster.json` supplies species, types, and base stats.
- `assets/` contains sprites, fonts, and arena artwork.
- `guides/`, `release-date/`, and `about/` provide player help and credits.
- `scripts/` contains the local server, checks, and static build.

## Credits

- Poke2D Arena and its official servers are developed and maintained by alex at [poke2darena.com](https://poke2darena.com/about/).
- Species data comes from [Pokémon Showdown](https://github.com/smogon/pokemon-showdown).
- Pokemon sprites come from [PokéAPI’s sprite collection](https://github.com/PokeAPI/sprites).
- [Silkscreen](https://github.com/google/fonts/tree/main/ofl/silkscreen) is distributed under the SIL Open Font License.
- Arena artwork was created for this build. Pokemon names, characters, and artwork belong to their respective rights holders.
