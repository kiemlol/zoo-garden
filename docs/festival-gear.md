# Festival outfits and ghost carriage

Two sets follow the supplied reference screenshots while fitting the game's existing toon explorer and animated body parts:

- **Pumpkin witch**: split black/orange long hair, braided headband, pumpkin ornaments and eye patch; white bow collar, pumpkin brooch, black corset, orange pleated skirt with cross details; black Mary Jane shoes with orange bows.
- **Flex**: swept golden spiky hair; independent black/teal sunglasses with gold frames; white jacket, dollar-chain pendant, navy cargo pants, gold waist chain and red bandana; red/white/black high-top sneakers.
- **Halloween ghost carriage**: red ribbed velvet bench, black frame and bat motif, large rear/small front cobweb wheels, cyan lanterns and a white ghost in the front harness. It is a placeable garden decoration.

Make the clothing at **Workshop → Festival outfits**; make the carriage under **Decorations**. The backpack's new **Glasses** slot allows sunglasses and hair to stay equipped together. Clothing, saves, remote avatars, try-on and friend gear retain the independent slot.

| Recipe | Energy | Materials |
| --- | ---: | --- |
| Pumpkin witch hair | 600 | Feather ×8, Moss Shell ×3 |
| Pumpkin witch dress | 1,500 | Leather ×12, Moss Shell ×5, Rainbow Slime ×8 |
| Pumpkin bow shoes | 800 | Leather ×6, Rainbow Slime ×10 |
| Flex golden hair | 600 | Feather ×8, Lava Scale ×3 |
| Flex gold sunglasses | 650 | Obsidian ×4, Lava Scale ×5 |
| Flex chain outfit | 1,800 | Leather ×14, Lava Scale ×12, Rolling Shell ×4 |
| Flex high-top sneakers | 900 | Leather ×6, Rainbow Slime ×8, Rolling Shell ×3 |
| Halloween ghost carriage | 3,000 | Bone ×20, Moss Shell ×8, Rolling Shell ×10, Lava Scale ×8, Rainbow Slime ×12 |

Every material requirement is checked by the shared gameplay action and consumed when crafting. Existing recipe indexes remain intact; these recipes append after the previous gameplay catalog. The existing premium outfitters offers remain an alternative at the game's normal premium price.

## Art reproduction

```sh
blender -b --factory-startup --python-exit-code 1 --python art/blender/kit/build_festival_gear.py
```

This writes `festival-gear.glb`, eight exact-mesh item icons, three previews and `art/festival-gear-manifest.json`. Wardrobe meshes use the existing `@head`, `@body`, `@arm-left/right` and `@leg-left/right` tags; clothing follows head and limb animation and is fitted to body styles by the existing gear transform. Geometry has no image textures or external art dependencies. The carriage is 5,458 triangles; the combined kit is about 366 KiB.

## Native mobile gestures

The viewport locks page scaling. The combat cluster and joystick use `touch-action: none`; the rest of the UI uses `manipulation` so single-finger dialog scrolling stays available. Page-wide callout and text-selection restrictions apply to the game UI. Capture listeners cancel native iOS gesture events, multi-touch scrolling, context menus and selection without stopping pointer/click propagation. The game's own camera gestures and long-press tooltips keep their existing handlers. Coarse-pointer form controls use at least 16 px text to avoid Safari's input-focus zoom.

Validation includes material consumption/refusal, save/equip/try-on, model parts and bounds, touch/hold routing, and a real Chromium touch-emulation test with rapid skill taps, a joystick hold plus a second finger, and fixed `visualViewport.scale`. Physical iOS Safari has not been exercised in this environment.

```sh
node --experimental-strip-types --test tests/festival-gear.test.ts tests/browser-gestures.test.ts tests/touch-routing.test.mjs
npm run build
```

The optional `tests/festival-browser.test.mjs` uses `HUD_LAYOUT_URL`, `PLAYWRIGHT_MODULE`, and optionally `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. It crafts all eight items through the ordinary UI, dresses both outfits, places the carriage, and checks touch behavior and browser errors.
