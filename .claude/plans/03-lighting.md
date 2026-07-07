# Plan 3 — Add lighting (it's too dark)

## Problem

The scene renders near-black in most of the room. Confirmed by screenshots: floor,
legs, and open aisle are almost fully crushed; only shelves near point lights are
lit. Even bumping the hemisphere light to 3.5 barely helped — ACES tone mapping +
`FogExp2(0.05)` + a dim ambient are crushing everything away from the shelf lamps.

## Current lighting (audited)

- `library.js` L50–51: `ACESFilmicToneMapping`, `toneMappingExposure = 1.3`.
- `stacks.js` L301: `HemisphereLight(0x584736, 0x0e0906, 0.65)` — the only global
  fill, and it's dim + warm-dark.
- `stacks.js` L178: per-lamp `PointLight(0xffc588, 4, 5, 2)`.
- `stacks.js` L220: `PointLight(0xffb46a, 14, 10, 2)`.
- `room.js` L419–424: up to 3 fill `PointLight`s (entry ~7.0, two ends ~4.6).
- `stacks.js` L299: `FogExp2(0x0a0605, 0.05)` + matching background — aggressive at
  distance.

## Diagnosis

Not a lack of lights near shelves — it's a lack of **ambient/floor fill** and an
over-aggressive fog + tone curve away from the point sources. The player's immediate
surroundings (floor, own legs, aisle) get almost no light.

## Approach (cheap → impactful, in order)

1. **Raise the hemisphere fill** from 0.65 to ~1.5–2.5 and lighten its colors (sky
   toward cool-neutral, ground less black) so the floor and legs are readable
   everywhere. This is the single biggest lever.
2. **Nudge `toneMappingExposure`** up (1.3 → ~1.6–1.8) if still dark after the fill —
   but prefer real light over exposure so highlights near lamps don't blow out with
   bloom.
3. **Soften fog** slightly (0.05 → ~0.035–0.04) so mid-distance isn't crushed; keep
   enough for depth/atmosphere.
4. Optionally add one **low ambient/soft directional** downward fill so the player's
   own legs (Plan 1) are lit when looking down — currently the biggest dark spot is
   right under the camera.

## Constraints

- Keep the warm, library/candlelit mood — don't flatten it into a bright showroom.
  The point lights + bloom give the character; this plan lifts the *floor* of
  brightness, not the ceiling.
- Watch the bloom pass (`UnrealBloomPass` threshold 0.82) — raising exposure can make
  more of the scene bloom. Re-check lamp glow after changes.
- Perf budget: `room.js` notes the scene already runs ~8 real lights. Prefer tuning
  existing lights + hemisphere + tone/fog over adding many new point lights.

## Steps

- `stacks.js` L301: bump hemisphere intensity + recolor.
- `stacks.js` L299: soften fog density.
- `library.js` L51: adjust exposure if needed after the above.
- Optionally add a subtle downward fill for the legs.
- Re-tune in a rodney loop (screenshots) until floor/legs/aisle are readable AND the
  mood is preserved AND lamps/bloom still look good.

## Verify

- rodney: screenshot (a) looking down at the floor/legs, (b) down an aisle, (c) a
  shelf face near a lamp. All three should be readable; the shelf shot must not be
  blown out by bloom.
- Do this **before/alongside Plan 1** so the new legs asset is actually visible when
  evaluated.
