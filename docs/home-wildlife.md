# Home wildlife

The existing home enemy IDs are retained. Their spawn positions and zone difficulty now follow these habitats; new creatures append after the octopus entries. Returning, chasing, rolling, knockback, projectiles and summoned movement respect the sector boundary, including the server's accepted positions and damage checks.

| Region | Creatures | Boss |
| --- | --- | --- |
| Mushroom Forest | Wild Boar, Grumpy Mushroom, Mosslug | Mushroom King |
| Blue Lake Meadow | Grey Wolf, Meadow Eagle, Cross Wasp | Ancient Treant |
| Chomper Swamp | Snapping Flower, Venom Jelly Octopus, Poison Frog | Crocodile King (unchanged) |
| Redrock Canyon | Stone Crab, Prickly Cactus, Rolling Pangolin | King Bear (unchanged) |

The existing canyon Titan and daily Colossus remain in their original region.

Mosslug / **Ốc Sên Rêu** crawls at 0.85 m/s. Its slime lasts 7 seconds; stepping on it causes sliding and swaying, and a 40% chance for an ordinary attack to miss. A heavy hit (at least 8% of max HP) makes it retract for 2.8 seconds, with a 7-second cooldown. Its shell blocks attacks until it emerges; Root Quake opens the shell immediately. It drops 1–2 Rainbow Slime / **Nhớt Cầu Vồng**, and has a 55% chance to drop a Moss Shell / **Mai Rêu**, before normal loot modifiers.

Rolling Pangolin / **Tê Tê Lăn** swipes twice, 0.65 seconds apart. Its sand roll has an 8-second cooldown, a 1-second upright dusty warning, a 10 m/s roll lasting up to 1.8 seconds, and a 3-second recovery. Colliding with scenery bounces it and redirects the remaining roll towards an eligible nearby target when the path is clear. A roll hit deals 1.3× its normal damage and stuns the explorer for 2 seconds; frontal ordinary hits are blocked while rolling, while the rear and skills remain vulnerable. It drops 1–2 Lava Scale / **Vảy Nham Thạch**, and has a 55% chance to drop a Rolling Shell / **Vỏ Cuộn**.

The four drops are registered crafting materials with individual 3D ground models and exact-mesh backpack icons. Their descriptions identify the intended crafting uses; this update does not add new equipment recipes.

## Rebuild art

```sh
blender -b --factory-startup --python-exit-code 1 --python art/blender/kit/build_wild_creatures.py
```

The generator writes `public/assets/models/wild-creatures.glb`, four item icons, two previews and `art/wild-creatures-manifest.json`. It uses the existing palette/material/export utilities, with separate rigid head, shell, leg and rolled-body parts; no image textures, skeleton or external artwork are required. Mosslug has 1,974 triangles and pangolin 2,178 including the hidden rolling form, below the game's 2,500-triangle common-creature budget.

```sh
node --experimental-strip-types --test tests/wild-creatures.test.ts tests/combat-authority.test.mjs tests/creature-art.test.ts tests/forest-hunting.test.ts
npm run build
npm test
```

The opt-in `tests/wild-creatures-browser.test.mjs` exercises live rendering and combat states. Set `HUD_LAYOUT_URL` to a running dev server and `PLAYWRIGHT_MODULE` to an installed Playwright module; `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing Chromium binary.
