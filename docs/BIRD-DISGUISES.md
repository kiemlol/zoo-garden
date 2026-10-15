# Bird disguises

`dz_penguin` (Snow Penguin) and `dz_explorer_duck` (Black Explorer Duck) are available in Outfitters → Disguises for **1 energy** each. This is a temporary testing price. Neither has a crafting recipe. `explorer_lantern` and `explorer_dagger` are visual skill props only; they have no inventory or shop entries.

Equipping a disguise replaces all four combat move slots. Select an enemy or a ground destination to aim the fish, grapple and lantern; without a selected point they use a nearby enemy or the facing direction. The belly slide always travels forward. Changing disguise, dying or travelling cancels pending casts and persistent fields; changing disguise does not reset server cooldowns.

| Slot | Snow Penguin | Black Explorer Duck |
| --- | --- | --- |
| Strike | Five rapid beak hits, final hit launches | Five dagger hits, final hit applies +20% incoming damage for 4 s |
| Rush | Forward belly slide, path knockback; ice slows movement 50% for 3 s | Grapple to aim point, aerial pull with path knockback |
| Quake | Moving blizzard for 4 s, four damage ticks, 50% slower enemy attacks | Stationary net for 6 s; each entering enemy takes damage and is rooted 2.5 s |
| Lob | Three arcing frozen fish, AoE and 1.5 s stun | Arcing oil lantern, fixed fire zone with four damage ticks over 4 s |

Balance constants and English skill text live in `src/bird-skills.ts`. The shared combat simulation runs both offline and on the server; status damage amplification is settled at the real damage receiver, including attacks from teammates. Dedicated visual rendering uses instanced snow/fire, short trail sections, bounded active groups and shared GLB prop resources.

## Art

Regenerate the four models, two shop icons, previews and manifest:

```sh
blender -b --factory-startup --python-exit-code 1 --python art/blender/kit/build_bird_disguises.py
```

Output: `public/assets/models/bird-disguises.glb`. Both disguises use all six existing `@part` wearable tags. They are complete models with their own faces and bodies: the original explorer render meshes are hidden while the rig and hand anchors remain active. Their authored proportions stay fixed across mirror body/height choices, and taking the disguise off restores the original look. Hidden meshes are excluded from both remote-player and friend merging. Blender Z-up / -Y-facing is converted to the game's Y-up / +Z-facing format on export. The lantern retains translucent glass and emissive blue-violet flames; the dagger has raised violet runes, a curved steel guard and skull pommel.

## Verification

```sh
npm run build
npm test
```

`tests/bird-disguises.test.ts` checks shop costs, GLB structure, all eight skills, exact tick/control durations, pause/reset, air scaling, movement/attack slows and visual lifetimes. `tests/combat-authority.test.mjs` also checks canonical compass damage, grapple aim/cooldowns, cancellation and rooted snapshot movement.
