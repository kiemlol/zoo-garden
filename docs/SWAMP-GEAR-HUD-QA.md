# Swamp creature, farm art and combat HUD verification

Date: 2026-10-14. Repository: kiemlol/zoo-garden. Target branch: main.

## Changes and causes

- The Colossus announcement previously checked only `world.planet === 'home'`.
  Forest, meadow, swamp and canyon belong to that same planet. It now also uses
  the existing `zoneAt(position) === 'home'` village boundary (radius 18), and
  hides indoors. Existing event schedule and tutorial visibility rules remain.
- Landscape strips previously reserved map/dock space but omitted the Home
  button to the left of the map. `initHudLayout` measures that button and reserves
  an additional 8 px; resize work stays coalesced into one scheduled frame.
  Boss health uses the full available strip when the announcement is hidden.
  If both appear, the boss receives 62% instead of 50%. Skill positions are unchanged.
- The target panel had only an 8 px joystick gap. It now sits 24 px above the
  actual movement pad, including safe areas and resized controls.
- As clarified by the user, the new creature is ONE octopus/slime hybrid:
  `swamp_octo` / Bạch Tuộc Thạch Độc. Eight spawn in the swamp at level 7,
  with the existing zone health/damage scaling. Their IDs append at
  `home:enemy:157` through `164`; existing enemy identities remain unchanged.
  They use the current shooter AI, windup and projectile synchronization.
- Poison is a shared non-stacking four-second simulation. Each second causes
  15% of the accepted projectile damage. Shields/blocking prevent infection;
  poison-proof gear clears it, as do combat resets, death and safe-zone entry.
  Online infection and health changes are server-owned; no packet/schema changes.
  The solo frame hook returns immediately when no poison is active.
- New loot: jelly resin (guaranteed 1–2) and venom ink pearl (65%, one).
  Both have original GLB meshes, Blender icons, real ground models and shared
  catalog/loot definitions used by solo and authoritative rewards.
- New lava rod: quality 1.10, steady line (10% snap chance), +8 defense and
  +2 regeneration when equipped, through existing fishing/equipment stats.
  Recipe at the existing ancient furnace: 1 steady rod, 8 magma, 12 obsidian,
  6 venom ink, 10 jelly resin and 1500 energy. Recipe appends after old indexes.
- Goat and kid now have rounded heads, expressive eyes, broad ears, swept
  horns/nubs, a chunky torso and cloven hooves. Heights are approximately
  1.25 m and 0.79 m. Hinges and breed-color material names remain compatible
  with current instanced farm animation. Loading stand-ins were updated too.

## Files

Runtime and content:
`src/colossus.ts`, `src/hud-layout.ts`, `src/hud-ours.css`,
`src/enemy-types.ts`, `src/enemy-roster.ts`, `src/world.ts`,
`src/venom.ts`, `src/main.ts`, `server/combat-authority.mjs`,
`src/content.ts`, `src/locales/vi-catalog.ts`, `src/assets.ts`,
`src/creature-art.ts`, `src/late-art.ts`, `src/drops-view.ts`, `src/farm-view.ts`.

Art:
`art/blender/kit/build_farm_goat.py`, `art/blender/kit/build_swamp_gear.py`,
`art/asset-manifest.json`, `art/swamp-gear-manifest.json`,
`art/previews/kit/goats.webp`, `art/previews/kit/swamp-octo.webp`,
`public/assets/models/farm.glb`, `public/assets/models/swamp-gear.glb`,
`public/assets/icons/items/{venom_ink,jelly_resin,rod_lava}.webp`.

Tests:
`tests/swamp-gear.test.ts`, `tests/swamp-art-browser.test.mjs`,
`tests/biomes-bag-hud-browser.test.mjs`, `tests/combat-authority.test.mjs`,
`tests/creature-art.test.ts`, `tests/world.test.ts`,
`tests/static-host.test.mjs`, `tests/vi-embedded-tables.test.ts`.
Existing asset/population/localization checks now include the added content.

## Executed checks

- `npm run build`: passed TypeScript, Vite and offline-cache build.
  Vite still reports its existing large-chunk advisory.
- Targeted Node tests: 108/108 passed, covering creature art, server combat,
  poison/immunity/reset, loot, actual crafting and rod buffs, farm view, world
  populations, model sizes, localization and deployment-prefix URLs.
- After the inactive-poison fast path: another 36/36 combat/content tests,
  the gameplay browser test and build passed.
- Final `npm test`: 1810 tests, 1749 passed, 54 skipped, 7 failed.
  The seven failures are the previously documented baseline: 3 air-switch
  markup/key assertions, 1 hud-ours markup assertion, 3 keyboard-routing
  assertions. No new failing test remains. One earlier targeted run hit the
  existing randomized magma-turtle damage assertion; subsequent targeted/full
  runs passed it without changing that test or its combat logic.
- Chromium with SwiftShader, real game: revised bag/HUD test passed at
  844×390, 667×320 and 1280×720, including safe-area emulation. Verified village
  announcement and hiding in all four outside regions and on other planets;
  no Home overlap, boss bar fits, and target/joystick gap is at least 20 px.
- Camera browser regression passed: defaults, manual Settings, wheel,
  two-finger zoom and orientation/interior transitions are retained.
- New gameplay browser test passed: actual hybrid GLB loaded; real shooter AI
  projectile reached player and poison ticked; lava rod automatically held by
  a pond with its `rod-tip`; both real loot meshes appeared, followed orientation
  change to 390×844, and were removed when drops cleared. No page runtime error.
  The client-only Vite session endpoint returns its expected unavailable API
  response; these browser fixtures explicitly use offline play.
- Blender generated all assets; inspected previews and actual game captures.
  New kit: 82,504 bytes, no textures; hybrid 1674 triangles, each loot 300,
  rod 912. Goat/kid 1416/1332 triangles, below the existing 2600 limit.
  All 31 farm roots retained. Comparing old/new primitive triangle counts and
  position bounds found changes ONLY to goat and kid.
- `git diff --check`: clean. No database/config migration or dependency added.

## Limits

Physical iOS Safari/Android touch devices and a live deployed multiplayer room
were not available. Server combat is tested locally; real-device visual quality,
long sessions and deployment integration still need manual verification.
No before/after device FPS benchmark was run or claimed for this content update.
