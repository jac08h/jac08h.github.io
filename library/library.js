import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import { buildStacks, STACKS } from "./stacks.js";
import { buildBooks, BOOK_DEPTH } from "./books.js";
import { createOverlay } from "./overlay.js";
import { createPlayer } from "./player.js";
import { createGrab } from "./grab.js";
import { createTouchController } from "./touch.js";

const REACH = 2.0;

const canvas = document.getElementById("scene");
const introEl = document.getElementById("intro");
const pauseEl = document.getElementById("pause");
const fadeEl = document.getElementById("fade");
const bootEl = document.getElementById("boot");
const controlsHintEl = document.getElementById("controls-hint");
const reticleEl = document.getElementById("reticle");
const aimLabelEl = document.getElementById("aim-label");
const radarEl = document.getElementById("radar");
const radarCanvas = document.getElementById("radar-canvas");
const escHintEl = document.getElementById("esc-hint");
const musicEl = document.getElementById("bg-music");
const muteBtn = document.getElementById("mute-btn");
const pauseBtn = document.getElementById("pause-btn");
const joystickEl = document.getElementById("joystick");
const paperViewEl = document.getElementById("paper-view");
const paperTextEl = document.getElementById("paper-text");
const paperCloseEl = document.getElementById("paper-close");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const touchMode = new URLSearchParams(window.location.search).get("touch") === "1" ||
    !window.matchMedia("(any-pointer: fine)").matches ||
    !("requestPointerLock" in HTMLElement.prototype);

function showFallback(reason) {
    const el = document.getElementById("fallback");
    document.getElementById("fallback-reason").textContent = reason;
    el.hidden = false;
    introEl.classList.add("gone");
}

let renderer;
try {
    renderer = new THREE.WebGLRenderer({
        canvas: canvas, antialias: true, powerPreference: "high-performance"
    });
} catch (err) {
    showFallback("This view needs WebGL, which your browser could not provide.");
    throw err;
}

// Cap the render resolution below the display's full DPR: the scene + the
// multi-pass UnrealBloom blur are fragment-bound, so on a HiDPI panel rendering
// at 2× is the main source of frame lag. 1.5× keeps edges clean (antialias is
// on and bloom is a soft blur) while cutting fragment/bloom work by ~40%.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, touchMode ? 1.15 : 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    62, window.innerWidth / window.innerHeight, 0.05, 80);

const composer = touchMode ? null : new EffectComposer(renderer);
if (composer) {
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.5, 0.82);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
}

// --- Boot -------------------------------------------------------------------

const overlay = createOverlay();
let stacks = null;
let player = null;
let grab = null;
let records = [];
let raycastTargets = [];
let occluders = [];
let activeAisle = null;
let started = false;
let entered = false;
let touchController = null;
let frameEma = 0;

// Scripted walk-in sequence state. Phases: "beat" (short pause) → "doors"
// (ease open) → "walk" (scripted stride from spawn to insideSpawn), then done.
const ENTER_TIMING = { beat: 0.3, doors: 0.9, walk: 1.2 };
let enterSeq = null;
let doorsOpen = 0;

function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function startEnterSequence() {
    const spawn = stacks.entry.spawn;
    const target = stacks.entry.insideSpawn;
    player.teleport(spawn.x, spawn.z, spawn.yaw, 0);
    player.setEnabled(false);
    enterSeq = {
        phase: "beat", t: 0,
        fromX: spawn.x, fromZ: spawn.z,
        toX: target.x, toZ: target.z, yaw: target.yaw
    };
}

function finishEnterInstant() {
    const target = stacks.entry.insideSpawn;
    stacks.entry.setOpen(1);
    doorsOpen = 1;
    player.teleport(target.x, target.z, target.yaw, 0);
    player.setEnabled(true);
    enterSeq = null;
}

function updateEnterSequence(dt) {
    if (!enterSeq) {
        return;
    }
    enterSeq.t += dt;
    if (enterSeq.phase === "beat") {
        if (enterSeq.t >= ENTER_TIMING.beat) {
            enterSeq.t = 0;
            enterSeq.phase = "doors";
        }
        return;
    }
    if (enterSeq.phase === "doors") {
        const k = Math.min(1, enterSeq.t / ENTER_TIMING.doors);
        doorsOpen = easeInOut(k);
        stacks.entry.setOpen(doorsOpen);
        if (k >= 1) {
            doorsOpen = 1;
            stacks.entry.setOpen(1);
            enterSeq.t = 0;
            enterSeq.phase = "walk";
        }
        return;
    }
    if (enterSeq.phase === "walk") {
        const raw = Math.min(1, enterSeq.t / ENTER_TIMING.walk);
        const p = easeInOut(raw);
        const x = enterSeq.fromX + (enterSeq.toX - enterSeq.fromX) * p;
        const z = enterSeq.fromZ + (enterSeq.toZ - enterSeq.fromZ) * p;
        player.teleport(x, z, enterSeq.yaw, 0);
        // Drive the walk cycle: speedFactor ramps 0→1→0, bobPhase advances.
        player.state.speedFactor = Math.sin(raw * Math.PI);
        player.state.bobPhase += dt * 5 * player.state.speedFactor;
        if (raw >= 1) {
            player.state.speedFactor = 0;
            player.setEnabled(true);
            enterSeq = null;
        }
    }
}

fetch("/books/quotes/data/quotes.json")
    .then(function (resp) {
        if (!resp.ok) {
            throw new Error("Failed to load quotes.json: " + resp.status);
        }
        return resp.json();
    })
    .then(function (data) {
        start(data.books);
    })
    .catch(function (err) {
        showFallback("Could not load the library. " + err.message);
    });

function start(booksData) {
    const years = Array.from(new Set(booksData.map(function (b) {
        return b.year;
    }))).sort(function (a, b) {
        return b - a;
    });

    stacks = buildStacks(scene, years);
    const built = buildBooks(scene, stacks.bays, stacks.decorBays, booksData);
    records = built.records;
    raycastTargets = built.raycastTargets;
    occluders = stacks.occluders || [];
    // The paper sheet on the reading table joins the pick targets so it can be
    // aimed like a book; picking it opens the plain-text note panel instead of
    // the blurred book overlay.
    if (stacks.paper) {
        raycastTargets.push(stacks.paper.pick);
    }

    player = createPlayer(scene, camera, canvas, stacks.colliders, reducedMotion);
    player.teleport(stacks.spawn.x, stacks.spawn.z, stacks.spawn.yaw, 0);
    player.onLockChange(onLockChange);
    grab = createGrab(scene, camera, player, overlay, onBookReturned, siblingsForBook);
    if (touchMode) {
        document.body.classList.add("touch-mode");
        const introText = introEl.querySelector(".intro-pill-text");
        if (introText) introText.textContent = "tap to enter";
        if (controlsHintEl) {
            controlsHintEl.textContent =
                "drag to look · left thumb to walk · tap a book to pick it up";
        }
    }
    // Hybrids remain in desktop mode, but their touch gestures still work once
    // pointer lock is engaged (useful on touch-screen laptops).
    if (joystickEl) {
        touchController = createTouchController(canvas, player, joystickEl, function () {
            if (started && entered && !overlay.isOpen() && !paperOpen && !enterSeq && aimed) {
                grabRecord(aimed);
            }
        });
    }

    activeAisle = stacks.aisles[0];
    // Radar HUD disabled for now — hidden via CSS and not drawn per frame. The
    // radar code is left in place so it can be switched back on later.
    started = true;
}

// --- Enter / pause flow -------------------------------------------------------

let hintTimer = null;

// Reveal the transient controls hint after entering, then auto-fade it.
function showControlsHint() {
    if (!controlsHintEl) {
        return;
    }
    controlsHintEl.classList.add("visible");
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(function () {
        controlsHintEl.classList.remove("visible");
    }, 4500);
}

// Background music. Autoplay-with-sound is blocked until a user gesture, so
// playback is kicked off from enter() (fired by the intro click). It follows
// the game's pause state and can be muted from the HUD; the choice is
// remembered across visits.
const MUSIC_VOLUME = 0.28;
let muted = window.localStorage.getItem("library-muted") === "1";

if (musicEl) {
    musicEl.volume = MUSIC_VOLUME;
    musicEl.muted = muted;
}

function syncMuteButton() {
    if (!muteBtn) {
        return;
    }
    muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
    muteBtn.setAttribute("aria-label", muted ? "Unmute music" : "Mute music");
    muteBtn.classList.toggle("muted", muted);
}

function playMusic() {
    if (musicEl) {
        musicEl.play().catch(function () {});
    }
}

function toggleMute() {
    muted = !muted;
    window.localStorage.setItem("library-muted", muted ? "1" : "0");
    if (musicEl) {
        musicEl.muted = muted;
    }
    syncMuteButton();
}

if (muteBtn) {
    syncMuteButton();
    muteBtn.addEventListener("click", function () {
        toggleMute();
        muteBtn.blur();
    });
}

// M toggles mute from anywhere in the walkable view (mirrors the HUD button).
document.addEventListener("keydown", function (event) {
    if (event.code === "KeyM" && !event.repeat) {
        toggleMute();
    }
});

function enter() {
    entered = true;
    playMusic();
    introEl.classList.add("fading");
    window.setTimeout(function () {
        introEl.classList.add("gone");
    }, 600);
    document.body.classList.add("playing");
    if (touchMode) {
        player.setEngaged(true);
    } else {
        player.lock();
    }
    showControlsHint();
    if (reducedMotion) {
        finishEnterInstant();
    } else {
        startEnterSequence();
    }
}

introEl.addEventListener("click", function () {
    if (started && !entered) {
        enter();
    }
});

function onLockChange(locked) {
    if (!entered) {
        return;
    }
    const paused = !locked && !overlay.isOpen() && !paperOpen;
    pauseEl.classList.toggle("visible", paused);
    if (musicEl) {
        if (paused) {
            musicEl.pause();
        } else {
            playMusic();
        }
    }
}

// Relock recovery. Chrome enforces a short cooldown after exiting pointer
// lock, during which a request is silently rejected — which would leave the
// veil up with a dead mouse. Retry once after the cooldown so a single click
// reliably resumes; the veil only hides once onLockChange sees a real lock.
function requestResume() {
    if (touchMode) {
        player.setEngaged(true);
        pauseEl.classList.remove("visible");
        playMusic();
        return;
    }
    player.lock().then(function () {
        if (!player.state.locked) {
            window.setTimeout(function () {
                if (!player.state.locked && !overlay.isOpen()) {
                    player.lock();
                }
            }, 1300);
        }
    });
}

pauseEl.addEventListener("click", requestResume);

if (pauseBtn) {
    pauseBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        if (touchMode && entered && !overlay.isOpen() && !paperOpen) {
            player.setEngaged(false);
            pauseEl.classList.add("visible");
            if (musicEl) musicEl.pause();
        }
    });
}

// The pause-screen "back to home" link must navigate rather than be swallowed
// by the pause veil's click-to-resume handler.
const pauseHomeEl = document.getElementById("pause-home");
if (pauseHomeEl) {
    pauseHomeEl.addEventListener("click", function (event) {
        event.stopPropagation();
    });
}

canvas.addEventListener("click", function () {
    if (!started || !entered || overlay.isOpen()) {
        return;
    }
    if (!player.state.engaged) {
        requestResume();
    }
});

// --- Radar (top-down mini-map, replaces the old year rail) --------------------

function nearestAisle() {
    const x = player.rigYaw.position.x;
    let best = stacks.aisles[0];
    stacks.aisles.forEach(function (aisle) {
        if (Math.abs(aisle.x - x) < Math.abs(best.x - x)) {
            best = aisle;
        }
    });
    return best;
}

// The year of the shelf FACE the player is nearest to: nearest aisle, then
// its left face (years[0]) if the player is on the low-x side, else its right
// face (years[1]); single-year aisles fall back to years[0].
function nearestFaceYear() {
    const aisle = nearestAisle();
    if (aisle.years.length > 1 && player.rigYaw.position.x > aisle.x) {
        return aisle.years[1];
    }
    return aisle.years[0];
}

function teleportToYear(year, withFade) {
    const aisle = stacks.aisles.find(function (a) {
        return a.years.indexOf(year) !== -1;
    });
    if (!aisle) {
        return false;
    }
    const jump = function () {
        player.teleport(aisle.x, aisle.mouthZ, 0, 0);
    };
    if (withFade && !reducedMotion) {
        fadeEl.classList.add("visible");
        window.setTimeout(function () {
            jump();
            fadeEl.classList.remove("visible");
        }, 260);
    } else {
        jump();
    }
    return true;
}

// Radar state: circular scope, world (x, z) → canvas px, fixed north-up
// (room-fixed, never rotates with the player). "Up the screen" is world -z,
// which is also the direction you walk facing the stacks at yaw 0 (see
// entry.js), so walking up the screen matches walking forward toward the
// shelves. World x maps straight across (no mirroring). While the pointer is
// locked the scope is player-centred and zoomed close — the circular clip
// crops whatever falls outside the face — and when unlocked (paused / not
// yet entered) it eases out to frame the whole room so every year label is
// visible as a click-to-teleport target.
const radarCtx = radarCanvas ? radarCanvas.getContext("2d") : null;
let radarLastDraw = 0;
const RADAR_INTERVAL = 1 / 12;
// World units from scope centre to rim in the walking (zoomed) framing.
const RADAR_WALK_RADIUS = 5.4;
// Eased view transform: world-space centre + canvas px per world unit.
const radarView = { x: 0, z: 0, scale: 1, set: false };
// Hit targets (canvas px, radius) for the interactive (pointer-unlocked)
// year-label click-to-teleport, rebuilt each draw.
let radarHitTargets = [];

function radarClamp(v, lo, hi) {
    if (lo > hi) {
        return (lo + hi) / 2;
    }
    return Math.min(hi, Math.max(lo, v));
}

// Paused framing: fit the room's WIDTH across the scope (that's where the
// year labels line up), centred; the room's far corners crop at the rim,
// which is what the circular face is for.
function radarFitView() {
    const b = stacks.bounds;
    const R = radarCanvas.width / 2;
    return {
        x: (b.xMin + b.xMax) / 2,
        z: (b.zMin + b.zMax) / 2,
        scale: (2 * R - 36) / (b.xMax - b.xMin)
    };
}

// Walking framing: player-centred close zoom, with the centre clamped so
// the scope never shows more than a sliver beyond the room walls.
function radarWalkView() {
    const b = stacks.bounds;
    const R = radarCanvas.width / 2;
    const margin = RADAR_WALK_RADIUS - 1.5;
    return {
        x: radarClamp(player.rigYaw.position.x, b.xMin + margin, b.xMax - margin),
        z: radarClamp(player.rigYaw.position.z, b.zMin + margin, b.zMax - margin),
        scale: (R - 14) / RADAR_WALK_RADIUS
    };
}

function initRadar() {
    if (!radarCtx) {
        return;
    }
    const v = radarFitView();
    radarView.x = v.x;
    radarView.z = v.z;
    radarView.scale = v.scale;
    radarView.set = true;
    drawRadar(true);
}

function radarX(worldX) {
    return radarCanvas.width / 2 + (worldX - radarView.x) * radarView.scale;
}

function radarY(worldZ) {
    return radarCanvas.height / 2 + (worldZ - radarView.z) * radarView.scale;
}

function radarRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, r);
    } else {
        ctx.rect(x, y, w, h);
    }
}

function drawRadar(force) {
    if (!radarCtx || !stacks) {
        return;
    }
    const now = elapsedTime;
    if (!force && now - radarLastDraw < RADAR_INTERVAL) {
        return;
    }
    const dtDraw = Math.min(Math.max(now - radarLastDraw, 0), 0.2);
    radarLastDraw = now;

    // Ease the view toward the framing the current mode wants.
    const walking = started && player && player.state.engaged;
    const target = walking && player ? radarWalkView() : radarFitView();
    const k = radarView.set ? 1 - Math.exp(-4.5 * dtDraw) : 1;
    radarView.x += (target.x - radarView.x) * k;
    radarView.z += (target.z - radarView.z) * k;
    radarView.scale += (target.scale - radarView.scale) * k;
    radarView.set = true;

    const ctx = radarCtx;
    const W = radarCanvas.width;
    const H = radarCanvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = W / 2;
    const s = radarView.scale;
    ctx.clearRect(0, 0, W, H);

    // Clip everything to the circular scope face.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R - 3, 0, Math.PI * 2);
    ctx.clip();

    // Faint world-aligned grid (every 2 world units) so the scope visibly
    // tracks motion even over open floor.
    const gridStep = 2 * s;
    ctx.strokeStyle = "rgba(198, 160, 92, 0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = radarX(Math.floor((radarView.x - R / s) / 2) * 2);
        gx < W; gx += gridStep) {
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, H);
    }
    for (let gy = radarY(Math.floor((radarView.z - R / s) / 2) * 2);
        gy < H; gy += gridStep) {
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
    }
    ctx.stroke();

    // Room floor + walls, with a gap in the +z wall for the entry doorway
    // and two ticks for the door leaves (they swing open into the library).
    const b = stacks.bounds;
    const rx0 = radarX(b.xMin);
    const rx1 = radarX(b.xMax);
    const ry0 = radarY(b.zMin);
    const ry1 = radarY(b.zMax);
    ctx.fillStyle = "rgba(198, 160, 92, 0.06)";
    ctx.fillRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
    const door = stacks.entry.doorway;
    const dx0 = radarX(door.x - door.width / 2);
    const dx1 = radarX(door.x + door.width / 2);
    ctx.strokeStyle = "rgba(198, 160, 92, 0.55)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(dx0, ry1);
    ctx.lineTo(rx0, ry1);
    ctx.lineTo(rx0, ry0);
    ctx.lineTo(rx1, ry0);
    ctx.lineTo(rx1, ry1);
    ctx.lineTo(dx1, ry1);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(dx0, ry1);
    ctx.lineTo(dx0 - 5, ry1 - 10);
    ctx.moveTo(dx1, ry1);
    ctx.lineTo(dx1 + 5, ry1 - 10);
    ctx.stroke();

    // Carpet runner rug (drawn UNDER the shelf bars): a deep-red strip laid
    // along world x, matching room.js's rug — plane 1.8 (z) × (length-2) (x),
    // centred at (xMid, walkwayDepth/2 + 0.3). Subtle and low-opacity so it
    // reads as a rug without dominating.
    const roomLength = b.xMax - b.xMin;
    const roomXMid = (b.xMin + b.xMax) / 2;
    const rugXLen = roomLength - 2;
    const rugZ = STACKS.walkwayDepth / 2 + 0.3;
    const rugX0 = radarX(roomXMid - rugXLen / 2);
    const rugX1 = radarX(roomXMid + rugXLen / 2);
    const rugY0 = radarY(rugZ - 0.9);
    const rugY1 = radarY(rugZ + 0.9);
    ctx.fillStyle = "rgba(122, 30, 26, 0.34)";
    radarRoundRect(ctx, rugX0, rugY0, rugX1 - rugX0, rugY1 - rugY0,
        Math.min((rugY1 - rugY0) / 2, 8));
    ctx.fill();

    // Shelf units as rounded bars: each spans unitThickness wide (x) by
    // unitLength deep (z ∈ [-unitLength, 0]), centred at x = i * pitch. All
    // units are drawn uniformly; no "active" shelf is emphasised.
    const unitCount = stacks.aisles.length + 1;
    for (let i = 0; i < unitCount; i++) {
        const ux = i * STACKS.pitch;
        const bx = radarX(ux - STACKS.unitThickness / 2);
        const bw = STACKS.unitThickness * s;
        const by = radarY(-STACKS.unitLength);
        const bh = STACKS.unitLength * s;
        ctx.fillStyle = "rgba(198, 160, 92, 0.42)";
        radarRoundRect(ctx, bx, by, bw, bh, Math.min(bw / 2, 6));
        ctx.fill();
    }

    // Reading table: a solid brown block at (xMid, tableZ), top 1.7 (x) ×
    // 0.95 (z), drawn on top of the rug so it reads as furniture.
    const tableZ = STACKS.walkwayDepth + 2.6;
    const tblX0 = radarX(roomXMid - 0.85);
    const tblX1 = radarX(roomXMid + 0.85);
    const tblY0 = radarY(tableZ - 0.475);
    const tblY1 = radarY(tableZ + 0.475);
    ctx.save();
    ctx.fillStyle = "rgba(120, 82, 44, 0.92)";
    radarRoundRect(ctx, tblX0, tblY0, tblX1 - tblX0, tblY1 - tblY0, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(60, 40, 20, 0.8)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    // Year labels: horizontal pills inside each aisle, the left face's year
    // above mid-depth and the right face's below, each with a small nib
    // pointing at the shelf face it labels. Font shrinks with the zoom so
    // neighbouring pills never collide (pill ≈ 3.3 × font for four digits).
    radarHitTargets = [];
    const fontPx = Math.min(22, (STACKS.pitch * s - 8) / 3.3);
    ctx.font = "600 " + fontPx.toFixed(1) + "px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    stacks.aisles.forEach(function (aisle) {
        const ax = radarX(aisle.x);
        aisle.years.forEach(function (year, faceIdx) {
            const side = faceIdx === 0 ? -1 : 1;
            const ay = radarY(-STACKS.unitLength / 2 + side * 0.95);
            const text = String(year);
            const pw = ctx.measureText(text).width + fontPx * 1.05;
            const ph = fontPx + 9;
            ctx.fillStyle = "rgba(12, 8, 5, 0.7)";
            radarRoundRect(ctx, ax - pw / 2, ay - ph / 2, pw, ph, ph / 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(198, 160, 92, 0.32)";
            ctx.lineWidth = 1;
            ctx.stroke();
            const nibX = ax + side * (pw / 2);
            ctx.fillStyle = "rgba(198, 160, 92, 0.55)";
            ctx.beginPath();
            ctx.moveTo(nibX + side * 8, ay);
            ctx.lineTo(nibX - side * 2, ay - 6);
            ctx.lineTo(nibX - side * 2, ay + 6);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "rgba(214, 192, 162, 0.85)";
            ctx.fillText(text, ax, ay + 1);
            radarHitTargets.push({
                x: ax, y: ay, r: Math.max(22, pw / 2 + 6), year: year
            });
        });
    });

    // Player: soft view cone + glowing dot. Forward at yaw y is
    // (-sin y, -cos y) in (x, z) — see entry.js's "yaw 0 faces -z"
    // convention — and radarX/radarY map x/z straight across/down, so the
    // screen-space heading is atan2(fz, fx) directly.
    if (player) {
        const px = radarX(player.rigYaw.position.x);
        const py = radarY(player.rigYaw.position.z);
        const yaw = player.state.yaw;
        const ang = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
        const coneLen = 62;
        const spread = 0.46;
        const cone = ctx.createRadialGradient(px, py, 2, px, py, coneLen);
        cone.addColorStop(0, "rgba(240, 205, 130, 0.5)");
        cone.addColorStop(1, "rgba(240, 205, 130, 0)");
        ctx.fillStyle = cone;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.arc(px, py, coneLen, ang - spread, ang + spread);
        ctx.closePath();
        ctx.fill();

        ctx.save();
        ctx.shadowColor = "rgba(246, 236, 217, 0.9)";
        ctx.shadowBlur = 14;
        ctx.fillStyle = "#f6ecd9";
        ctx.beginPath();
        ctx.arc(px, py, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = "rgba(20, 12, 6, 0.8)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, 6.5, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Vignette so the scope face darkens toward the rim.
    const vignette = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.55)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    ctx.restore();

    // Bezel details drawn outside the clip: an inner ring plus instrument
    // tick marks (fine every 7.5°, long every 45°).
    ctx.strokeStyle = "rgba(230, 190, 120, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R - 3, 0, Math.PI * 2);
    ctx.stroke();
    for (let pass = 0; pass < 2; pass++) {
        const major = pass === 1;
        ctx.strokeStyle = major
            ? "rgba(230, 190, 120, 0.45)" : "rgba(230, 190, 120, 0.18)";
        ctx.lineWidth = major ? 2.5 : 1.5;
        ctx.beginPath();
        const step = major ? 8 : 48;
        for (let i = 0; i < step; i++) {
            const a = (i / step) * Math.PI * 2;
            if (!major && i % 6 === 0) {
                continue;
            }
            const len = major ? 14 : 7;
            ctx.moveTo(cx + Math.cos(a) * (R - 5), cy + Math.sin(a) * (R - 5));
            ctx.lineTo(
                cx + Math.cos(a) * (R - 5 - len),
                cy + Math.sin(a) * (R - 5 - len));
        }
        ctx.stroke();
    }
}

// Teleport-to-year click-through: only reachable when the pointer is NOT
// locked (paused / not-yet-entered veil state), since pointer lock consumes
// clicks while walking. Reuses the same teleportToYear() the old rail used.
function radarPointToYear(clientX, clientY) {
    const rect = radarCanvas.getBoundingClientRect();
    const scaleX = radarCanvas.width / rect.width;
    const scaleY = radarCanvas.height / rect.height;
    const px = (clientX - rect.left) * scaleX;
    const py = (clientY - rect.top) * scaleY;
    let best = null;
    let bestDist = Infinity;
    radarHitTargets.forEach(function (t) {
        const d = Math.hypot(t.x - px, t.y - py);
        if (d <= t.r && d < bestDist) {
            best = t;
            bestDist = d;
        }
    });
    return best ? best.year : null;
}

if (radarCanvas) {
    radarCanvas.addEventListener("click", function (event) {
        if (!started || (player && player.state.engaged)) {
            return;
        }
        const year = radarPointToYear(event.clientX, event.clientY);
        if (year !== null) {
            teleportToYear(year, true);
        }
    });
}

function updateRadarInteractivity() {
    if (!radarEl) {
        return;
    }
    const interactive = started && player && !player.state.engaged;
    radarEl.classList.toggle("interactive", interactive);
}

// --- Reticle picking ----------------------------------------------------------

const raycaster = new THREE.Raycaster();
raycaster.far = REACH;
const centerNdc = new THREE.Vector2(0, 0);
const aimAssistNdc = [
    new THREE.Vector2(-0.035, 0), new THREE.Vector2(0.035, 0),
    new THREE.Vector2(0, -0.035), new THREE.Vector2(0, 0.035)
];
let aimed = null;

function pickCenter() {
    if (!started) {
        return null;
    }
    player.rigYaw.updateMatrixWorld(true);
    const intersect = function (ndc) {
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObjects(raycastTargets.concat(occluders), false);
        return hits.length ? hits[0].object.userData.record || null : null;
    };
    // Raycast against pick proxies AND the solid shelf occluders in one pass,
    // then only accept the nearest hit if it is a pickable target (carries a
    // record). If the closest thing along the aim ray is shelf wood, the book
    // behind it is hidden and must not be pickable.
    const direct = intersect(centerNdc);
    if (direct || !touchMode) {
        return direct;
    }
    for (let i = 0; i < aimAssistNdc.length; i++) {
        const assisted = intersect(aimAssistNdc[i]);
        if (assisted) return assisted;
    }
    return null;
}

// Relative luminance (sRGB) of an HSL leather color, used to pick a readable
// ink color for the aim bubble's text against its book-colored background.
function relativeLuminance(h, s, l) {
    const color = new THREE.Color().setHSL(h / 360, s / 100, l / 100);
    const channel = function (c) {
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

function setAimed(record) {
    if (aimed === record) {
        return;
    }
    aimed = record;
    if (record && record.isPaper) {
        aimLabelEl.textContent = "a note";
        aimLabelEl.style.background = "rgba(10, 6, 3, 0.72)";
        aimLabelEl.style.color = "#f6ecd9";
        reticleEl.classList.add("aiming");
        aimLabelEl.classList.add("visible");
    } else if (record) {
        aimLabelEl.textContent = record.book.author + " — " + record.book.title;
        if (record.colors) {
            const c = record.colors;
            aimLabelEl.style.background =
                "hsl(" + c.h + ", " + c.s + "%, " + c.l + "%)";
            aimLabelEl.style.color =
                relativeLuminance(c.h, c.s, c.l) > 0.4 ? "#241a10" : "#f6ecd9";
        }
        reticleEl.classList.add("aiming");
        aimLabelEl.classList.add("visible");
    } else {
        reticleEl.classList.remove("aiming");
        aimLabelEl.classList.remove("visible");
    }
}

// --- Hover pull-out ("librarian's finger-tip") --------------------------------
// The aimed spine eases out of the shelf along its local +z (the direction it
// slides during a grab) and tilts about its bottom-back edge so the spine
// leans toward the camera. Un-aiming (ray miss, or overlay/grab taking over)
// eases the book back down into the shelf rather than snapping it, so a book
// can be mid-retract while a different book pops — both animate independently
// via a shared PopEntry, tracked in `pops` (the aimed one, plus any retracting
// stragglers). A short grace period on ray misses avoids pop/retract flicker
// at grazing aim angles without delaying retraction when the user genuinely
// looks away.
const POP_OUT = 0.085;
const POP_TILT = THREE.MathUtils.degToRad(13);
const POP_TIME = 0.15;
const POP_EMISSIVE_BOOST = 1.15;
const NEIGHBOR_DIM = 0.45;
const MISS_GRACE = 0.08;

// Live pop/retract animations, one per record currently easing in or out.
// { record, k, goal, restPos, restQuat, spineMat, baseEmissive, neighbors }
const pops = [];
let missTimer = 0;
const popTiltQuat = new THREE.Quaternion();
const popAxis = new THREE.Vector3(1, 0, 0);
const popTranslation = new THREE.Vector3();
const pivot = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const localOutZ = new THREE.Vector3(0, 0, 1);

function neighborSpineMat(record) {
    return record && record.group.children[1] ? record.group.children[1].material : null;
}

function findPop(record) {
    return pops.find(function (p) {
        return p.record === record;
    }) || null;
}

// Current world-frame rest pose a grab should return this record to: the
// entry's stored rest pose if it's mid-pop/retract, else its live transform
// (already at rest when there's no entry).
function restPoseFor(record) {
    const entry = findPop(record);
    return {
        position: entry ? entry.restPos.clone() : record.group.position.clone(),
        quaternion: entry ? entry.restQuat.clone() : record.group.quaternion.clone()
    };
}

function beginPopEntry(record) {
    let entry = findPop(record);
    if (entry) {
        entry.goal = 1;
        return;
    }
    const spine = record.group.children[1];
    const spineMat = spine ? spine.material : null;
    const neighbors = [];
    [record.prevOnShelf, record.nextOnShelf].forEach(function (n) {
        const mat = neighborSpineMat(n);
        if (mat) {
            neighbors.push({ mat: mat, base: mat.emissiveIntensity, baseColor: mat.color.clone() });
        }
    });
    entry = {
        record: record, k: 0, goal: 1,
        restPos: record.group.position.clone(),
        restQuat: record.group.quaternion.clone(),
        spineMat: spineMat,
        baseEmissive: spineMat ? spineMat.emissiveIntensity : 0,
        neighbors: neighbors
    };
    pops.push(entry);
}

// Mark a record's entry (if any) to ease back to rest instead of popped.
function beginRetract(record) {
    const entry = findPop(record);
    if (entry) {
        entry.goal = 0;
    }
}

// Remove a pop entry immediately, snapping its record fully back to rest and
// clearing emissive/neighbor-dim state. Used when a grab takes over a record
// that's mid-pop/retract — the grab owns the visual transform from here on,
// and already captured the true rest pose via restPoseFor() beforehand.
function dropPopEntry(record) {
    const idx = pops.findIndex(function (p) {
        return p.record === record;
    });
    if (idx === -1) {
        return;
    }
    const entry = pops[idx];
    if (entry.spineMat) {
        entry.spineMat.emissiveIntensity = entry.baseEmissive;
    }
    entry.neighbors.forEach(function (n) {
        n.mat.emissiveIntensity = n.base;
        n.mat.color.copy(n.baseColor);
    });
    pops.splice(idx, 1);
}

// Advance one pop entry's easing toward its goal, applying offset/tilt/
// emissive to the record and its neighbors. Returns false once it has fully
// settled back to rest and should be dropped.
function updatePopEntry(entry, dt) {
    const k = 1 - Math.exp(-dt / Math.max(POP_TIME / 3, 0.001));
    entry.k += (entry.goal - entry.k) * k;
    if (entry.goal === 0 && entry.k < 0.002) {
        entry.record.group.position.copy(entry.restPos);
        entry.record.group.quaternion.copy(entry.restQuat);
        if (entry.spineMat) {
            entry.spineMat.emissiveIntensity = entry.baseEmissive;
        }
        entry.neighbors.forEach(function (n) {
            n.mat.emissiveIntensity = n.base;
            n.mat.color.copy(n.baseColor);
        });
        return false;
    }

    // Tilt about the bottom-back edge: pivot at local (0, -ht/2, -depth), i.e.
    // the bottom of the book at the shelf-facing back plane, so the spine
    // (at local z ≈ 0, top at +ht/2) swings toward the camera.
    const ht = entry.record.dims ? entry.record.dims.ht : 0.3;
    pivot.set(0, -ht / 2, -BOOK_DEPTH);
    popTiltQuat.setFromAxisAngle(popAxis, POP_TILT * entry.k);
    popTranslation.copy(pivot).applyQuaternion(popTiltQuat).sub(pivot);

    entry.record.group.position.copy(entry.restPos)
        .add(popTranslation)
        .addScaledVector(localOutZ, POP_OUT * entry.k);
    tmpQuat.copy(entry.restQuat).multiply(popTiltQuat);
    entry.record.group.quaternion.copy(tmpQuat);

    if (entry.spineMat) {
        entry.spineMat.emissiveIntensity =
            entry.baseEmissive + (POP_EMISSIVE_BOOST - entry.baseEmissive) * entry.k;
    }
    entry.neighbors.forEach(function (n) {
        n.mat.emissiveIntensity = n.base * (1 - (1 - NEIGHBOR_DIM) * entry.k);
        n.mat.color.copy(n.baseColor).multiplyScalar(1 - (1 - NEIGHBOR_DIM) * entry.k);
    });

    return true;
}

function updateAnticipation(dt) {
    const rawTarget = (aimed && grab.isIdle() && !overlay.isOpen()) ? aimed : null;

    if (rawTarget) {
        missTimer = 0;
        // A hit on a different real book is a definite switch: pop the new
        // target immediately and let the old one (if any) start retracting
        // right away, no grace period needed — this isn't an ambiguous miss.
        pops.forEach(function (p) {
            if (p.record !== rawTarget) {
                beginRetract(p.record);
            }
        });
        beginPopEntry(rawTarget);
    } else {
        // Ray miss: grazing angles can flicker the pick briefly, so only
        // start retracting the currently-popped (goal===1) entries after a
        // short run of consecutive misses.
        missTimer += dt;
        if (missTimer >= MISS_GRACE) {
            pops.forEach(function (p) {
                beginRetract(p.record);
            });
        }
    }

    for (let i = pops.length - 1; i >= 0; i--) {
        if (!updatePopEntry(pops[i], dt)) {
            pops.splice(i, 1);
        }
    }
}

function grabRecord(record) {
    if (record && record.isPaper) {
        dropPopEntry(record);
        setAimed(null);
        openPaper();
        return;
    }
    const restPose = restPoseFor(record);
    dropPopEntry(record);
    if (grab.begin(record, restPose)) {
        setAimed(null);
    }
}

function onBookReturned() {
    player.setEnabled(true);
    canvas.focus({ preventScroll: true });
    if (entered && !touchMode) {
        player.lock();
    }
}

// --- Paper note (plain-text pickup, no blurred overlay) -----------------------
// Picking up the table's paper sheet opens a simple full-screen reading card
// with the note's plain, fully legible text — bypassing overlay.js's blurred
// book layout entirely. Open/close mirror the book overlay's feel (backdrop
// blur, fade) and free / re-lock the pointer the same way.

let paperOpen = false;

function openPaper() {
    if (paperOpen || !stacks || !stacks.paper) {
        return;
    }
    paperOpen = true;
    if (paperTextEl) {
        paperTextEl.textContent = stacks.paper.record.book.quotes[0];
    }
    player.setEnabled(false);
    if (!touchMode) player.unlock();
    if (paperViewEl) {
        paperViewEl.hidden = false;
        paperViewEl.setAttribute("aria-hidden", "false");
        // Force a reflow so the .open transition runs from the hidden state.
        void paperViewEl.offsetWidth;
        paperViewEl.classList.add("open");
    }
}

function closePaper() {
    if (!paperOpen) {
        return;
    }
    paperOpen = false;
    if (paperViewEl) {
        paperViewEl.classList.remove("open");
        paperViewEl.setAttribute("aria-hidden", "true");
        window.setTimeout(function () {
            if (!paperOpen) {
                paperViewEl.hidden = true;
            }
        }, 420);
    }
    player.setEnabled(true);
    canvas.focus({ preventScroll: true });
    if (entered && !touchMode) {
        player.lock();
    }
}

if (paperCloseEl) {
    paperCloseEl.addEventListener("click", function (event) {
        event.stopPropagation();
        closePaper();
    });
}

if (paperViewEl) {
    paperViewEl.addEventListener("click", closePaper);
}

document.addEventListener("keydown", function (event) {
    if (event.code !== "Escape") {
        return;
    }
    if (paperOpen) {
        closePaper();
    } else if (pauseEl.classList.contains("visible")) {
        requestResume();
    }
});

canvas.addEventListener("mousedown", function (event) {
    if (!started || overlay.isOpen() || !player.state.engaged || enterSeq) {
        return;
    }
    if (event.button === 0 && aimed) {
        grabRecord(aimed);
    }
});

document.addEventListener("keydown", function (event) {
    if (!started || overlay.isOpen() || enterSeq) {
        return;
    }
    if (event.code === "KeyE" && aimed && player.state.engaged) {
        grabRecord(aimed);
    }
});

window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
});

// --- Frame loop -----------------------------------------------------------

let lastFrameTime = performance.now();
let elapsedTime = 0;
let lastClockUpdate = -1;
let readyFlagged = false;
function animate() {
    window.__frames = (window.__frames || 0) + 1;
    const now = performance.now();
    const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;
    elapsedTime += dt;
    frameEma = frameEma ? frameEma * 0.92 + dt * 1000 * 0.08 : dt * 1000;

    if (started) {
        player.update(dt);
        updateEnterSequence(dt);
        grab.update(dt);
        stacks.updateDust(dt, elapsedTime);
        updateAnticipation(dt);

        if (!overlay.isOpen() && grab.isIdle() && !enterSeq && !paperOpen) {
            setAimed(pickCenter());
        } else if (paperOpen && aimed) {
            setAimed(null);
        }
        if (escHintEl) {
            escHintEl.classList.toggle("visible", player.state.engaged && !touchMode);
        }

        const aisle = nearestAisle();
        if (aisle !== activeAisle) {
            activeAisle = aisle;
        }

        // Keep the wall clock on real time (once a second is plenty).
        if (stacks.updateClock && elapsedTime - lastClockUpdate >= 1) {
            lastClockUpdate = elapsedTime;
            stacks.updateClock();
        }
    }

    if (composer) composer.render(); else renderer.render(scene, camera);

    if (started && !readyFlagged) {
        readyFlagged = true;
        window.__LIBRARY_READY = true;
        // Fade the boot veil off the first real frame.
        if (bootEl) {
            bootEl.classList.add("gone");
        }
    }
    requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

// --- Test hooks -------------------------------------------------------------
// None of these may depend on pointer lock being engaged: headless Chrome
// can refuse it, so tests drive the player through teleport/nudge instead.

function findRecord(id) {
    return records.find(function (r) {
        return r.book.id === id;
    }) || null;
}

// The books sharing a year with `book`, in shelf order (records are ordered
// by bay/row/position). Lets the overlay flip between same-year books.
function siblingsForBook(book) {
    return records
        .filter(function (r) {
            return r.book.year === book.year;
        })
        .map(function (r) {
            return r.book;
        });
}

function aimAtRecord(record) {
    const bookPos = new THREE.Vector3();
    record.group.updateMatrixWorld(true);
    record.group.getWorldPosition(bookPos);
    const normal = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(record.group.getWorldQuaternion(new THREE.Quaternion()));

    const standX = bookPos.x + normal.x * 1.05;
    const standZ = bookPos.z + normal.z * 1.05;
    const eye = new THREE.Vector3(standX, STACKS.eyeHeight, standZ);
    const dir = bookPos.clone().sub(eye);
    const yaw = Math.atan2(-dir.x, -dir.z);
    const pitch = Math.asin(dir.y / dir.length());

    player.teleport(standX, standZ, yaw, pitch);
    setAimed(pickCenter());
    return aimed === record;
}

window.__library = {
    state: function () {
        const pos = player ? player.rigYaw.position : { x: 0, z: 0 };
        return {
            ready: readyFlagged,
            books: records.length,
            entered: entered,
            locked: player ? player.state.locked : false,
            engaged: player ? player.state.engaged : false,
            touchMode: touchMode,
            joystick: touchController ? touchController.state() : { x: 0, y: 0 },
            frameTime: Number(frameEma.toFixed(1)),
            player: player ? {
                x: Number(pos.x.toFixed(3)),
                z: Number(pos.z.toFixed(3)),
                yaw: Number(player.state.yaw.toFixed(3)),
                pitch: Number(player.state.pitch.toFixed(3))
            } : null,
            activeYear: player && stacks ? nearestFaceYear() : null,
            aimedBookId: aimed ? aimed.book.id : null,
            grabState: grab ? grab.state() : "idle",
            overlayOpen: overlay.isOpen(),
            doorsOpen: doorsOpen,
            entering: enterSeq !== null
        };
    },
    enter: function () {
        entered = true;
        introEl.classList.add("gone");
        document.body.classList.add("playing");
        player.setEngaged(true);
        finishEnterInstant();
    },
    enterAnimated: function () {
        entered = true;
        introEl.classList.add("gone");
        document.body.classList.add("playing");
        player.setEngaged(true);
        if (reducedMotion) {
            finishEnterInstant();
        } else {
            startEnterSequence();
        }
    },
    gotoYear: function (year) {
        return teleportToYear(year, false);
    },
    teleportTo: function (x, z, yaw, pitch) {
        player.teleport(x, z, yaw, pitch);
    },
    nudge: function (dx, dz) {
        player.nudge(dx, dz);
    },
    setLocked: function (on) {
        player.state.locked = !!on;
        player.setEngaged(on);
    },
    setKeys: function (map) {
        Object.keys(map).forEach(function (code) {
            player.keys[code] = map[code];
        });
    },
    setTouchMode: function () {
        return touchMode;
    },
    injectLook: function (dx, dy) {
        player.injectLook(dx, dy);
    },
    injectMove: function (x, y) {
        player.injectMove(x, y);
    },
    tap: function () {
        if (aimed && player.state.engaged) grabRecord(aimed);
    },
    colliders: function () {
        return stacks ? stacks.colliders : [];
    },
    aimAtBook: function (id) {
        const record = findRecord(id);
        return record ? aimAtRecord(record) : false;
    },
    openBookById: function (id) {
        const record = findRecord(id);
        if (record) {
            aimAtRecord(record);
            setAimed(null);
            const restPose = restPoseFor(record);
            dropPopEntry(record);
            grab.openInstant(record, restPose);
        }
        return !!record;
    },
    openFirstBookOfYear: function (year) {
        const record = records.find(function (r) {
            return r.book.year === year;
        });
        if (record) {
            aimAtRecord(record);
            setAimed(null);
            const restPose = restPoseFor(record);
            dropPopEntry(record);
            grab.openInstant(record, restPose);
        }
        return !!record;
    },
    grabBookById: function (id) {
        const record = findRecord(id);
        if (record) {
            aimAtRecord(record);
            setAimed(null);
            const restPose = restPoseFor(record);
            dropPopEntry(record);
            grab.begin(record, restPose);
        }
        return !!record;
    },
    closeBook: function () {
        overlay.close();
    },
    aimAtPaper: function () {
        if (!stacks || !stacks.paper) {
            return false;
        }
        aimAtRecord(stacks.paper.record);
        return aimed === stacks.paper.record;
    },
    openPaper: function () {
        if (stacks && stacks.paper) {
            openPaper();
            return true;
        }
        return false;
    },
    closePaper: function () {
        closePaper();
    },
    paperOpen: function () {
        return paperOpen;
    },
    screenPointFor: function (id) {
        const record = findRecord(id);
        if (!record) {
            return null;
        }
        const world = new THREE.Vector3();
        record.group.getWorldPosition(world);
        world.project(camera);
        return {
            x: (world.x * 0.5 + 0.5) * window.innerWidth,
            y: (-world.y * 0.5 + 0.5) * window.innerHeight
        };
    }
};
