# Plan 2 — Remove the welcome screen

## Goal

Drop the current "click to enter" intro overlay. WASD + mouse-look is intuitive
enough that an explanatory splash isn't needed. Show controls in a nicer,
non-blocking way instead.

## Current state

- `index.html` L25–31: `#intro` overlay with title, subtitle, and a hint line
  ("click to enter · walk with WASD · aim at a book · Esc frees the mouse").
- `library.js`:
  - `introEl` (L17), clicked to call `enter()` (L204–208).
  - `enter()` (L189–202) hides intro (`fading` → `gone`), sets `body.playing`, calls
    `player.lock()`, then runs the scripted vestibule walk-in.
  - The test hook `__library.enter()` (L479–484) already hides the intro instantly
    and teleports in — the real entry path is the only place the splash matters.
- Pointer lock **must** be initiated by a user gesture (browser requirement), so we
  can't fully auto-enter without *some* first click. The splash's real job is that
  first gesture.

## Approach

Keep a minimal first-click gesture (unavoidable for pointer lock) but replace the
full-screen splash with something lighter:

**Option chosen for the plan (revisit with user if desired):** a small, unobtrusive
prompt instead of a full veil.

1. **Replace `#intro`** full-screen overlay with a compact centered pill/hint:
   e.g. "click to look around" — no big title, no wall of text. It still captures the
   first click → `enter()`.
2. **Move controls into a transient HUD hint** shown for a few seconds after entering
   (auto-fade), or a small persistent "WASD · click book · Esc" line in a corner of
   the HUD. Non-blocking.
3. Keep the existing `#pause` veil ("paused · click to resume") — that's the relock
   recovery path and still needed.

## Steps

- `index.html`: slim down `#intro` markup (drop title/sub, keep one short line) OR
  replace with a corner hint element. Add a small controls-hint element to the HUD.
- `library.css`: restyle from full-screen veil to a small centered/corner element;
  add a fade-out-after-delay animation for the post-entry hint.
- `library.js`:
  - Keep `enter()` and the `introEl` click wiring (still the pointer-lock gesture).
  - After entry, reveal the transient controls hint; auto-hide after ~4 s.
  - No change to the scripted walk-in or `__library.enter()` test hook.
- Update `library/CLAUDE.md` (`index.html` line item mentions the intro gate).

## Open question for user

- Fully auto-immerse vs. keep one click: browser pointer lock **requires** a user
  gesture, so a zero-click entry isn't possible. The plan keeps one minimal click.
  If the user wants *no* overlay at all, the fallback is: no splash, and the first
  click anywhere on the canvas locks + enters (canvas already has a click→lock
  handler at `library.js` L222). That's viable and even simpler — decide which.

## Verify

- rodney: load → confirm no full-screen splash; confirm first canvas click enters +
  locks (or the minimal pill does). Confirm the controls hint appears then fades.
- Confirm fallback (coarse pointer / no pointer lock) still shows `#fallback`
  unchanged.
