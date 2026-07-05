import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import { buildStacks, STACKS } from "./stacks.js";
import { buildBooks } from "./books.js";
import { createOverlay } from "./overlay.js";
import { createPlayer } from "./player.js";
import { createBody } from "./body.js";
import { createGrab } from "./grab.js";

const REACH = 2.0;

const canvas = document.getElementById("scene");
const introEl = document.getElementById("intro");
const pauseEl = document.getElementById("pause");
const fadeEl = document.getElementById("fade");
const reticleEl = document.getElementById("reticle");
const aimLabelEl = document.getElementById("aim-label");
const railEl = document.getElementById("year-rail");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

function showFallback(reason) {
    const el = document.getElementById("fallback");
    document.getElementById("fallback-reason").textContent = reason;
    el.hidden = false;
    introEl.classList.add("gone");
}

if (coarsePointer || !("requestPointerLock" in HTMLElement.prototype)) {
    showFallback("This walkable library needs a keyboard and mouse.");
    throw new Error("First-person library: unsupported input device");
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

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    62, window.innerWidth / window.innerHeight, 0.05, 80);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.5, 0.82);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// --- Boot -------------------------------------------------------------------

const overlay = createOverlay();
let stacks = null;
let player = null;
let body = null;
let grab = null;
let records = [];
let raycastTargets = [];
let activeAisle = null;
let started = false;
let entered = false;

// Scripted walk-in sequence state. Phases: "beat" (short pause) → "doors"
// (ease open) → "walk" (scripted stride from spawn to insideSpawn), then done.
const ENTER_TIMING = { beat: 0.3, doors: 1.4, walk: 1.9 };
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

fetch("../data/quotes.json")
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

    player = createPlayer(scene, camera, canvas, stacks.colliders, reducedMotion);
    player.teleport(stacks.spawn.x, stacks.spawn.z, stacks.spawn.yaw, 0);
    player.onLockChange(onLockChange);
    body = createBody(player);
    grab = createGrab(scene, camera, player, overlay, onBookReturned);

    activeAisle = stacks.aisles[0];
    buildYearRail(years);
    updateRail();
    started = true;
}

// --- Enter / pause flow -------------------------------------------------------

function enter() {
    entered = true;
    introEl.classList.add("fading");
    window.setTimeout(function () {
        introEl.classList.add("gone");
    }, 900);
    document.body.classList.add("playing");
    player.lock();
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
    const paused = !locked && !overlay.isOpen();
    pauseEl.classList.toggle("visible", paused);
}

pauseEl.addEventListener("click", function () {
    player.lock();
});

canvas.addEventListener("click", function () {
    if (!started || !entered || overlay.isOpen()) {
        return;
    }
    if (!player.state.locked) {
        player.lock();
    }
});

// --- Year rail ----------------------------------------------------------------

function buildYearRail(years) {
    years.forEach(function (year) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = year;
        btn.setAttribute("aria-label", "Teleport to the " + year + " aisle");
        btn.addEventListener("click", function () {
            teleportToYear(year, true);
        });
        railEl.appendChild(btn);
    });
}

function updateRail() {
    const buttons = railEl.querySelectorAll("button");
    buttons.forEach(function (btn) {
        btn.classList.toggle("active",
            activeAisle !== null &&
                activeAisle.years.indexOf(Number(btn.textContent)) !== -1);
    });
}

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

// --- Reticle picking ----------------------------------------------------------

const raycaster = new THREE.Raycaster();
raycaster.far = REACH;
const centerNdc = new THREE.Vector2(0, 0);
let aimed = null;

const halo = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({
        color: 0xffc37a, transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, depthWrite: false
    }));
halo.visible = false;
scene.add(halo);

function pickCenter() {
    if (!started) {
        return null;
    }
    player.rigYaw.updateMatrixWorld(true);
    raycaster.setFromCamera(centerNdc, camera);
    const hits = raycaster.intersectObjects(raycastTargets, false);
    return hits.length > 0 ? hits[0].object.userData.record : null;
}

function setAimed(record) {
    if (aimed === record) {
        return;
    }
    aimed = record;
    if (record) {
        const body = record.group.children[0];
        body.getWorldPosition(halo.position);
        halo.quaternion.copy(record.group.getWorldQuaternion(new THREE.Quaternion()));
        halo.scale.copy(body.scale).multiplyScalar(1.12);
        halo.scale.z *= 1.05;
        halo.visible = true;
        aimLabelEl.textContent = record.book.author + " — " + record.book.title;
        reticleEl.classList.add("aiming");
        aimLabelEl.classList.add("visible");
    } else {
        halo.visible = false;
        reticleEl.classList.remove("aiming");
        aimLabelEl.classList.remove("visible");
    }
}

function grabRecord(record) {
    if (grab.begin(record)) {
        setAimed(null);
    }
}

function onBookReturned() {
    player.setEnabled(true);
    canvas.focus({ preventScroll: true });
    if (entered) {
        player.lock();
    }
}

canvas.addEventListener("mousedown", function (event) {
    if (!started || overlay.isOpen() || !player.state.locked || enterSeq) {
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
    if (event.code === "KeyE" && aimed && player.state.locked) {
        grabRecord(aimed);
    }
});

window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// --- Frame loop -----------------------------------------------------------

let lastFrameTime = performance.now();
let elapsedTime = 0;
let readyFlagged = false;

function animate() {
    window.__frames = (window.__frames || 0) + 1;
    const now = performance.now();
    const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;
    elapsedTime += dt;

    if (started) {
        player.update(dt);
        updateEnterSequence(dt);
        grab.update(dt);
        body.update(dt, elapsedTime);
        stacks.updateDust(dt, elapsedTime);

        if (!overlay.isOpen() && grab.isIdle() && !enterSeq) {
            setAimed(pickCenter());
        }

        const aisle = nearestAisle();
        if (aisle !== activeAisle) {
            activeAisle = aisle;
            updateRail();
        }
    }

    composer.render();

    if (started && !readyFlagged) {
        readyFlagged = true;
        window.__LIBRARY_READY = true;
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
        finishEnterInstant();
    },
    enterAnimated: function () {
        entered = true;
        introEl.classList.add("gone");
        document.body.classList.add("playing");
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
    setKeys: function (map) {
        Object.keys(map).forEach(function (code) {
            player.keys[code] = map[code];
        });
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
            grab.openInstant(record);
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
            grab.openInstant(record);
        }
        return !!record;
    },
    grabBookById: function (id) {
        const record = findRecord(id);
        if (record) {
            aimAtRecord(record);
            setAimed(null);
            grab.begin(record);
        }
        return !!record;
    },
    closeBook: function () {
        overlay.close();
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
