import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import { buildHall, HALL } from "./hall.js";
import { buildBooks } from "./books.js";
import { createOverlay } from "./overlay.js";

const canvas = document.getElementById("scene");
const introEl = document.getElementById("intro");
const railEl = document.getElementById("year-rail");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

let renderer;
try {
    renderer = new THREE.WebGLRenderer({
        canvas: canvas, antialias: true, powerPreference: "high-performance"
    });
} catch (err) {
    showFallback("This view needs WebGL, which your browser could not provide.");
    throw err;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarsePointer ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    55, window.innerWidth / window.innerHeight, 0.05, 80);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.5, 0.82);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

function showFallback(reason) {
    const el = document.getElementById("fallback");
    document.getElementById("fallback-reason").textContent = reason;
    el.hidden = false;
    introEl.classList.add("gone");
}

// --- Camera rig -------------------------------------------------------------
// The camera always faces the shelf wall head-on; only its x position (and a
// touch of parallax) changes. `viewX` is the target, `curX` the smoothed one.

let viewX = 0;
let curX = 0;
let minX = 0;
let maxX = 0;
let introZ = reducedMotion ? 0 : 2.6;

const pointer = { x: 0, y: 0, insideWindow: false };

// --- Boot -------------------------------------------------------------------

const overlay = createOverlay();
let hall = null;
let records = [];
let raycastTargets = [];
let activeBay = null;
let hovered = null;
let started = false;

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

    hall = buildHall(scene, years);
    const built = buildBooks(scene, hall.bays, hall.decorBays, booksData);
    records = built.records;
    raycastTargets = built.raycastTargets;

    minX = hall.bays[0].xCenter - 1.5;
    maxX = hall.bays[hall.bays.length - 1].xCenter + 1.5;
    viewX = hall.bays[0].xCenter;
    curX = viewX;
    activeBay = hall.bays[0];

    buildYearRail(years);
    updateRail();
    started = true;

    requestAnimationFrame(function () {
        introEl.classList.add("fading");
        window.setTimeout(function () {
            introEl.classList.add("gone");
        }, reducedMotion ? 400 : 2400);
    });
}

function buildYearRail(years) {
    years.forEach(function (year) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = year;
        btn.setAttribute("aria-label", "Go to shelf for " + year);
        btn.addEventListener("click", function () {
            gotoYear(year);
        });
        railEl.appendChild(btn);
    });
}

function updateRail() {
    const buttons = railEl.querySelectorAll("button");
    buttons.forEach(function (btn) {
        btn.classList.toggle("active",
            activeBay !== null && Number(btn.textContent) === activeBay.year);
    });
}

function nearestBay(x) {
    let best = hall.bays[0];
    hall.bays.forEach(function (bay) {
        if (Math.abs(bay.xCenter - x) < Math.abs(best.xCenter - x)) {
            best = bay;
        }
    });
    return best;
}

function gotoYear(year) {
    const bay = hall.bays.find(function (b) {
        return b.year === year;
    });
    if (bay) {
        viewX = bay.xCenter;
    }
}

function shiftYear(delta) {
    const bay = nearestBay(viewX);
    const next = hall.bays[THREE.MathUtils.clamp(
        bay.index + delta, 0, hall.bays.length - 1)];
    viewX = next.xCenter;
}

// --- Picking ----------------------------------------------------------------

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const previewEl = createPreview();

function createPreview() {
    const el = document.createElement("div");
    el.className = "spine-preview";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML =
        '<span class="preview-author"></span>' +
        '<span class="preview-title"></span>' +
        '<span class="preview-year"></span>';
    document.body.appendChild(el);
    return el;
}

function showPreviewFor(record) {
    if (overlay.isOpen()) {
        return;
    }
    previewEl.querySelector(".preview-author").textContent = record.book.author;
    previewEl.querySelector(".preview-title").textContent = record.book.title;
    previewEl.querySelector(".preview-year").textContent = record.book.year;
    previewEl.classList.add("visible");
    positionPreview(record);
}

function positionPreview(record) {
    const world = new THREE.Vector3();
    record.group.getWorldPosition(world);
    world.y += 0.28;
    world.project(camera);
    const sx = (world.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-world.y * 0.5 + 0.5) * window.innerHeight;

    const cardW = previewEl.offsetWidth;
    const cardH = previewEl.offsetHeight;
    const margin = 10;
    let left = sx - cardW / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - margin - cardW));
    let top = sy - cardH - 14;
    if (top < margin) {
        top = sy + 24;
    }
    previewEl.style.left = left + "px";
    previewEl.style.top = top + "px";
}

function hidePreview() {
    previewEl.classList.remove("visible");
}

function pick(clientX, clientY) {
    ndc.set(
        (clientX / window.innerWidth) * 2 - 1,
        -(clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const targets = raycastTargets.concat(hall ? hall.plaques : []);
    const hits = raycaster.intersectObjects(targets, false);
    return hits.length > 0 ? hits[0].object : null;
}

function setHovered(record) {
    if (hovered === record) {
        return;
    }
    hovered = record;
    if (record) {
        showPreviewFor(record);
    } else {
        hidePreview();
    }
}

function openRecord(record) {
    if (overlay.isOpen()) {
        return;
    }
    setHovered(null);
    hidePreview();
    overlay.open(record.book, function () {
        canvas.focus({ preventScroll: true });
    });
}

// --- Input ------------------------------------------------------------------

let downX = 0;
let downY = 0;
let dragging = false;
let dragLastX = 0;

canvas.addEventListener("pointerdown", function (event) {
    downX = event.clientX;
    downY = event.clientY;
    dragging = true;
    dragLastX = event.clientX;
    canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointerup", function (event) {
    dragging = false;
    canvas.classList.remove("grabbing");
    if (Math.abs(event.clientX - downX) > 7 || Math.abs(event.clientY - downY) > 7) {
        return;
    }
    if (overlay.isOpen() || !started) {
        return;
    }
    const hit = pick(event.clientX, event.clientY);
    if (!hit) {
        return;
    }
    if (hit.userData.record) {
        openRecord(hit.userData.record);
    } else if (hit.userData.year) {
        gotoYear(hit.userData.year);
    }
});

canvas.addEventListener("pointercancel", function () {
    dragging = false;
    canvas.classList.remove("grabbing");
});

canvas.addEventListener("pointermove", function (event) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    pointer.insideWindow = true;

    if (dragging && started && !overlay.isOpen()) {
        const dx = event.clientX - dragLastX;
        dragLastX = event.clientX;
        if (Math.abs(event.clientX - downX) > 7) {
            canvas.classList.add("grabbing");
            viewX = THREE.MathUtils.clamp(viewX - dx * 0.006, minX, maxX);
        }
        return;
    }
    if (!started || overlay.isOpen() || coarsePointer) {
        return;
    }
    const hit = pick(event.clientX, event.clientY);
    setHovered(hit && hit.userData.record ? hit.userData.record : null);
    canvas.classList.toggle("pickable", hit !== null);
});

canvas.addEventListener("pointerleave", function () {
    pointer.insideWindow = false;
    setHovered(null);
});

window.addEventListener("wheel", function (event) {
    if (!started || overlay.isOpen()) {
        return;
    }
    const delta = (Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY) * 0.004;
    viewX = THREE.MathUtils.clamp(viewX + delta, minX, maxX);
}, { passive: true });

document.addEventListener("keydown", function (event) {
    if (!started || overlay.isOpen()) {
        return;
    }
    if (document.activeElement && document.activeElement.tagName === "BUTTON") {
        return;
    }
    if (event.key === "ArrowLeft") {
        shiftYear(-1);
        event.preventDefault();
    } else if (event.key === "ArrowRight") {
        shiftYear(1);
        event.preventDefault();
    }
});

window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// --- Frame loop -------------------------------------------------------------

let lastFrameTime = performance.now();
let elapsedTime = 0;
let introStart = null;
const lookTarget = new THREE.Vector3();
let readyFlagged = false;

function animate() {
    window.__frames = (window.__frames || 0) + 1;
    const now = performance.now();
    const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;
    elapsedTime += dt;
    const t = elapsedTime;

    if (started) {
        hall.updateDust(dt, t);

        const bay = nearestBay(curX);
        if (bay !== activeBay) {
            activeBay = bay;
            updateRail();
        }
    }

    // Smooth-damp the strafe, ease the intro dolly, layer parallax on top.
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 2.8);
    curX += (viewX - curX) * k;
    if (started && introStart === null) {
        introStart = t;
    }
    if (introZ > 0.001 && introStart !== null) {
        const ki = Math.min(1, (t - introStart) / 3.2);
        introZ = 2.6 * (1 - (ki < 0.5 ? 4 * ki * ki * ki
            : 1 - Math.pow(-2 * ki + 2, 3) / 2));
    }

    let panX = 0;
    let panY = 0;
    if (!reducedMotion) {
        const drift = Math.sin(t * 0.14) * 0.04;
        const bob = Math.cos(t * 0.11) * 0.02;
        const mx = pointer.insideWindow ? pointer.x : 0;
        const my = pointer.insideWindow ? pointer.y : 0;
        panX = mx * 0.16 + drift;
        panY = -my * 0.09 + bob;
    }

    camera.position.set(
        curX + panX, HALL.cameraY + panY, HALL.cameraZ + introZ);
    lookTarget.set(
        curX + panX * 1.35, HALL.cameraY + 0.06 + panY * 1.3, HALL.wallZ);
    camera.lookAt(lookTarget);

    if (hovered && !overlay.isOpen()) {
        positionPreview(hovered);
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

window.__library = {
    gotoYear: gotoYear,
    state: function () {
        return {
            ready: readyFlagged,
            books: records.length,
            activeYear: activeBay ? activeBay.year : null,
            overlayOpen: overlay.isOpen(),
            camera: {
                x: Number(camera.position.x.toFixed(2)),
                y: Number(camera.position.y.toFixed(2)),
                z: Number(camera.position.z.toFixed(2))
            }
        };
    },
    setViewRaw: function (x) {
        viewX = x;
        curX = x;
        introZ = 0;
    },
    snapToYear: function (year) {
        gotoYear(year);
        curX = viewX;
        introZ = 0;
    },
    openBookById: function (id) {
        const record = records.find(function (r) {
            return r.book.id === id;
        });
        if (record) {
            this.snapToYear(record.book.year);
            openRecord(record);
        }
        return !!record;
    },
    openFirstBookOfYear: function (year) {
        const record = records.find(function (r) {
            return r.book.year === year;
        });
        if (record) {
            this.snapToYear(year);
            openRecord(record);
        }
        return !!record;
    },
    hoverBookByIndex: function (i) {
        const record = records[i];
        if (record) {
            this.snapToYear(record.book.year);
            setHovered(record);
        }
        return !!record;
    },
    closeBook: function () {
        overlay.close();
    },
    screenPointFor: function (id) {
        const record = records.find(function (r) {
            return r.book.id === id;
        });
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
