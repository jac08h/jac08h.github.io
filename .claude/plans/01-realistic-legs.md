# Plan 1 — Realistic legs (asset-based)

## Problem

The current legs (`body.js` + `bodymesh.js`) are hand-authored procedural geometry:
elliptical cross-section profiles (`LEG_STATIONS`) swept into skinned tubes, a
two-bone skeleton, and a sine-driven walk cycle. They read as "leg-shaped tubes",
not real clothed human legs. Three failure modes:

1. Geometry is a parametric guess, not anatomy — no fabric folds, no real knee/
   ankle break, no muscle volume.
2. Material is flat procedural canvas cloth — no normal/AO map, so it looks plastic
   under grazing light.
3. Animation is an analytic pose (`Math.sin(legPhase)`) — mechanical, symmetric, no
   weight shift, feet skate.

**The framework is not the bottleneck.** three.js r185 renders AAA skinned characters
fine. The fix is to replace hand-built geometry with a **real rigged, textured glTF
asset** driven by a **mocap walk clip**.

## Decision (locked with user)

- **Source:** Mixamo character, trimmed to legs-only.
- **Constraint:** maximize realism, accept a few MB of asset + textures and a
  `GLTFLoader` dependency. Stay no-build / static ES modules.

## Steps

### A. Acquire asset (user-driven — cannot be scripted; Mixamo API is auth-gated)

1. Sign into mixamo.com (free Adobe account).
2. Pick a realistic **clothed** character with trousers + shoes (e.g. Leonard,
   Sophie, Remy, Ch14/Ch15 business).
3. Add animation **"Walking"**, tick **In Place** (engine drives position; clip must
   not translate).
4. Download as **glTF Binary (.glb)**, With Skin, 30 fps, no keyframe reduction.
   (If only FBX offered → drop the .fbx and convert FBX→glTF locally.)
5. Land at `books/quotes/library/assets/legs_raw.glb`.

### B. Loader scaffolding

- Create `books/quotes/library/assets/`.
- Confirm `GLTFLoader` exists in `vendor/addons/` (add via the same `git add -f`
  vendor path if missing). Add an import-map entry if needed.
- New module `bodyasset.js` (replaces `body.js`/`bodymesh.js` role): load the .glb,
  return `{ update(dt) }` with the same interface `createBody(player)` exposes today
  so `library.js` line 178/403 wiring is unchanged.

### C. Trim to legs

- Traverse the loaded skeleton; identify pelvis + leg/foot bones (Mixamo naming:
  `mixamorig:Hips`, `mixamorig:LeftUpLeg/LeftLeg/LeftFoot/LeftToeBase`, same Right).
- Hide/cull everything above the pelvis (spine, arms, head) — either skip those
  bones' influenced mesh or clip the mesh, whichever is cleaner once real bone names
  are known.
- Reparent the kept model under `player.rigYaw`, match the current hip anchor
  (`hips.position.set(0, 0.92, 0.16)` in `body.js`), scale to fit, tune so the down-
  view sees legs receding (same intent as the current IDLE pose).

### D. Drive the walk clip

- `AnimationMixer` on the model; play the Mixamo "Walking" clip.
- Blend clip weight / `timeScale` by `player.state.speedFactor` (idle ↔ walk) so it
  plugs into the existing walk signal. Advance mixer by `dt` in `update`.
- Idle: either a still pose (weight→0) or a subtle idle; keep it from
  T-posing at speed 0.

### E. Swap in & clean up

- `library.js`: replace `import { createBody } from "./body.js"` with the new module.
- Delete/retire `body.js`, `bodymesh.js`, and the now-unused trouser/leather
  procedural textures in `textures.js` (only if nothing else uses them — check).
- Update `library/CLAUDE.md` `body.js`/`bodymesh.js` entries to describe the asset
  path.

## Verify

- rodney: boot, `enter()`, teleport + look down at legs → screenshot both a still and
  a walking pose (drive `setKeys` or the enter walk sequence). Compare against the
  old procedural shots.
- Confirm no perf regression (asset is GPU-skinned; should be cheaper than 11-ring
  hand skinning).
- Check the entry walk-in sequence (`updateEnterSequence`) still animates legs —
  it sets `speedFactor`/`bobPhase`, so the new blend must respond to those.

## Risks / notes

- Depends on lighting (Plan 3) to actually be visible — legs are near-black now. Do
  Plan 3 first or in parallel so this is evaluable.
- Mixamo mesh may be higher-poly than needed; fine given "maximize realism", but
  watch page weight.
- Foot-skating: "In Place" clip + engine translation should match if the clip's
  stride cadence roughly tracks `speedFactor`. If it skates, scale mixer `timeScale`
  by speed.
