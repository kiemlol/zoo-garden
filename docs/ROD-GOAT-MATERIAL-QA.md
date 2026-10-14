# Lava rod icon/materials and goat attachment correction

2026-10-14. Follow-up to `SWAMP-GEAR-HUD-QA.md`.

## Causes and corrections

- The rod icon used a generic three-quarter camera, so the shaft pointed in the
  opposite diagonal and occupied a smaller projected area. Its generator now
  reuses `icon_matrix_weapon` and `icon_camera` from the existing weapon kit,
  with the same rod orientation, elevation 14 and margin 1.05. No in-game rod
  pose or fishing buff was changed.
- The rod lacked `ItemDef.price` and `materials`. The shop therefore treated it
  as an optional, energy-only special offer. It now uses the existing furnace
  recipe's price (1500 energy) and five ingredients as a normal shop recipe:
  1 steady rod, 8 magma, 12 obsidian, 6 slime tendrils and 10 jelly resin.
  Its original furnace recipe/index remains; the shop recipe appends. Both
  solo and server purchases consume the same ingredients and refuse missing
  materials. Shop ingredients use the existing quantity/missing-item chips.
- Goat legs ended below the torso at their actual x/z positions, even though
  the overall bounding boxes overlapped. The hip anchors now sit at torso-center
  height (.59 before kid scaling), with rounded hip geometry overlapping the
  torso and longer upper legs. Both adult and kid, plus loading stand-ins,
  retain the same rigid-part names, colors and instanced animation pipeline.
- The ink pearl is now a bundle of curled, slime-coated tendrils, including a
  new model, icon and localized name “Râu chất nhờn”. The ID `venom_ink`, sell
  value, drop rate, recipe usage and saved inventory keys remain unchanged.

## Executed verification

- Blender regenerated the two GLBs and relevant icons. Inspected icons and goat
  preview, plus real game captures at 390×844 and 844×390.
- All four rod icons are 160×160 with the exact same alpha >=128 bounds:
  `(4,8)-(156,152)`. The lava rod now points bottom-left to top-right like the
  bamboo, golden and steady rods.
- Targeted Node tests: 38 passed. Includes actual GLB raycasts through every
  adult/kid hip position, confirming anchors are inside the torso, plus shop
  purchases with/without materials, furnace crafting, farm animation/view and
  localization checks.
- Additional authoritative purchase test passed: energy-only request refused
  with no payment; prepared account charged 1500 and all five ingredient stacks
  consumed by the server.
- New browser regression passed: material chips visible in the shop, purchase
  refused when missing, successful purchase charges the displayed recipe,
  actual goat/kid farm rigs load and animate, and portrait/landscape both work.
  No page runtime exception. The standalone Vite API availability limitation
  remains; browser fixture explicitly plays offline.
- Final `npm run build`: TypeScript, Vite and offline cache passed. Existing
  large-chunk advisory remains.
- Final `npm test`: 1814 tests, 1752 passed, 55 skipped, 7 failed. The same
  preexisting air-switch (3), HUD markup (1) and keyboard-routing (3) assertions
  fail; no new failure.
- `git diff --check` clean. Asset comparison retained all root IDs; only goat/kid
  geometry changed in farm.glb, and only `venom_ink` geometry changed in the
  swamp kit. Other farm animals, hybrid monster, resin and rod meshes retain
  their geometry. No schema, deployment configuration or dependency change.

## Files

`src/content.ts`, `src/locales/vi-catalog.ts`, `src/farm-view.ts`;
`art/blender/kit/build_farm_goat.py`, `art/blender/kit/build_swamp_gear.py`,
`art/asset-manifest.json`, `art/swamp-gear-manifest.json`,
`art/previews/kit/goats.webp`;
`public/assets/models/farm.glb`, `public/assets/models/swamp-gear.glb`,
`public/assets/icons/items/rod_lava.webp`, `public/assets/icons/items/venom_ink.webp`;
`tests/swamp-gear.test.ts`, `tests/actions-authority.test.mjs`,
`tests/rod-shop-goat-browser.test.mjs`; this report.

Physical iOS Safari/Android devices and the deployed multiplayer environment
were not exercised. No FPS improvement is claimed for these corrections.
