import * as THREE from "three";
import {
    makeRugTexture, makeWallTexture, makePanelTexture,
    makeSconceTexture
} from "./textures.js";
import { STACKS } from "./stacks.js";

// Dark-academia room shell: floor, runner rug, coffered ceiling, four walls
// with plaster upper / wood wainscot dado, baseboard, chair-rail, crown
// cornice, pilasters, plus framed pictures, brass sconces and a wall clock.
//
// Geometry roles inherited from the old buildRoomShell (floor with floorTex and
// its repeat/rotation logic, runner rug via makeRugTexture, ceiling, four
// walls) are preserved; everything else is the upgrade. Repeated elements
// (pilasters, panel frames, coffer beams, sconces) use InstancedMesh or merged
// runs to keep draw calls in the low dozens.
//
// Wall convention: the -z wall (bounds.zMin) is behind the stacks; the +z wall
// (bounds.zMax) is the entry wall and the only one that honours `doorway`.

const RAIL_Y = 1.12;
const BASE_H = 0.16;

function panelMaterial(tex) {
    return new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.72, metalness: 0.0
    });
}

// Merges an array of BoxGeometry-with-position specs into one mesh to keep the
// baseboard / rail / cornice runs cheap. Each spec: {w, h, d, x, y, z}.
function mergedTrim(specs, material) {
    const group = new THREE.Group();
    specs.forEach(function (s) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), material);
        box.position.set(s.x, s.y, s.z);
        group.add(box);
    });
    return group;
}

// Builds one wall surface (upper plaster plane + wainscot band) as a run along
// an axis. `axis` is "x" (wall faces ±z) or "z" (wall faces ±x). `segments` is
// a list of {start, end} spans along that axis (the doorway leaves a gap). The
// wall plane sits at fixed coordinate `at`; `inwardNormal` is +1 or -1 telling
// which way the visible face points.
function buildWallRun(parent, axis, at, segments, inwardNormal, wallMat, panelMat,
    trimMat) {
    const ceiling = STACKS.ceiling;
    const wainTop = 1.06;
    segments.forEach(function (seg) {
        const len = seg.end - seg.start;
        if (len <= 0.001) {
            return;
        }
        const mid = (seg.start + seg.end) / 2;

        const upper = new THREE.Mesh(
            new THREE.PlaneGeometry(len, ceiling - wainTop), wallMat);
        const wain = new THREE.Mesh(
            new THREE.PlaneGeometry(len, wainTop), panelMat);
        upper.material.map && (upper.material.map.repeat.x = Math.max(1, len / 3.2));
        [upper, wain].forEach(function (m) {
            if (axis === "x") {
                m.rotation.y = inwardNormal > 0 ? 0 : Math.PI;
                m.position.z = at;
                m.position.x = mid;
            } else {
                m.rotation.y = inwardNormal > 0 ? Math.PI / 2 : -Math.PI / 2;
                m.position.x = at;
                m.position.z = mid;
            }
        });
        upper.position.y = (wainTop + ceiling) / 2;
        wain.position.y = wainTop / 2;
        parent.add(upper);
        parent.add(wain);

        const push = inwardNormal * 0.03;
        const trimSpecs = [
            { pos: BASE_H / 2, h: BASE_H, d: 0.09 },
            { pos: wainTop, h: 0.07, d: 0.11 },
            { pos: RAIL_Y, h: 0.05, d: 0.07 },
            { pos: ceiling - 0.12, h: 0.24, d: 0.16 }
        ];
        trimSpecs.forEach(function (t) {
            const box = axis === "x"
                ? new THREE.Mesh(new THREE.BoxGeometry(len, t.h, t.d), trimMat)
                : new THREE.Mesh(new THREE.BoxGeometry(t.d, t.h, len), trimMat);
            if (axis === "x") {
                box.position.set(mid, t.pos, at + push);
            } else {
                box.position.set(at + push, t.pos, mid);
            }
            parent.add(box);
        });
    });
}

// Evenly spaced pilasters along a wall run, as a single InstancedMesh.
function buildPilasters(parent, axis, at, start, end, inwardNormal, mat, skip) {
    const ceiling = STACKS.ceiling;
    const usable = end - start;
    const spacing = 3.4;
    const count = Math.max(2, Math.round(usable / spacing));
    const positions = [];
    for (let i = 0; i <= count; i++) {
        const p = start + (usable * i) / count;
        if (skip && p > skip.min && p < skip.max) {
            continue;
        }
        positions.push(p);
    }
    if (positions.length === 0) {
        return;
    }
    const w = 0.34, depth = 0.12, h = ceiling - RAIL_Y - 0.24;
    const geo = axis === "x"
        ? new THREE.BoxGeometry(w, h, depth)
        : new THREE.BoxGeometry(depth, h, w);
    const inst = new THREE.InstancedMesh(geo, mat, positions.length);
    const m = new THREE.Matrix4();
    const y = RAIL_Y + h / 2;
    const push = inwardNormal * depth * 0.5;
    positions.forEach(function (p, i) {
        if (axis === "x") {
            m.setPosition(p, y, at + push);
        } else {
            m.setPosition(at + push, y, p);
        }
        inst.setMatrixAt(i, m);
    });
    inst.instanceMatrix.needsUpdate = true;
    parent.add(inst);
}

// Coffered ceiling: a dark base plane plus two InstancedMesh beam grids (along
// x and along z) forming shallow coffers. Beams sit just below STACKS.ceiling so
// they don't foul the pendant cords, which hang from bulbY ≈ 3.12 up to 4.3.
function buildCeiling(parent, bounds, beamMat) {
    const ceiling = STACKS.ceiling;
    const length = bounds.xMax - bounds.xMin;
    const depth = bounds.zMax - bounds.zMin;
    const xMid = (bounds.xMin + bounds.xMax) / 2;
    const zMid = (bounds.zMin + bounds.zMax) / 2;

    // PlaneGeometry(length, depth) has local +x = length, local +y = depth.
    // A plain rotation.x = PI/2 lays local-x along world-x and local-y along
    // world-z (normal facing -y, down into the room), matching `bounds`
    // exactly — see the matching comment on the floor above.
    const base = new THREE.Mesh(
        new THREE.PlaneGeometry(length, depth),
        new THREE.MeshStandardMaterial({
            color: 0x241a10, roughness: 0.96,
            emissive: 0x1c1206, emissiveIntensity: 1.0
        }));
    base.rotation.x = Math.PI / 2;
    base.position.set(xMid, ceiling, zMid);
    parent.add(base);

    const beamY = ceiling - 0.14;
    const beamDrop = 0.26;
    const beamW = 0.2;

    const zSpacing = 2.6;
    const zCount = Math.max(2, Math.round(depth / zSpacing));
    const xBeamGeo = new THREE.BoxGeometry(length, beamDrop, beamW);
    const xInst = new THREE.InstancedMesh(xBeamGeo, beamMat, zCount + 1);
    const m = new THREE.Matrix4();
    for (let i = 0; i <= zCount; i++) {
        const z = bounds.zMin + (depth * i) / zCount;
        m.setPosition(xMid, beamY, z);
        xInst.setMatrixAt(i, m);
    }
    xInst.instanceMatrix.needsUpdate = true;
    parent.add(xInst);

    const xSpacing = 3.1;
    const xCount = Math.max(2, Math.round(length / xSpacing));
    const zBeamGeo = new THREE.BoxGeometry(beamW, beamDrop, depth);
    const zInst = new THREE.InstancedMesh(zBeamGeo, beamMat, xCount + 1);
    for (let i = 0; i <= xCount; i++) {
        const x = bounds.xMin + (length * i) / xCount;
        m.setPosition(x, beamY, zMid);
        zInst.setMatrixAt(i, m);
    }
    zInst.instanceMatrix.needsUpdate = true;
    parent.add(zInst);
}

// Brass wall sconce: a small cup + an emissive plate (MeshBasicMaterial, fog
// off) that bloom turns into a glow. No real PointLight.
function buildSconce(parent, x, z, faceYaw, sconceTex, brassMat) {
    const group = new THREE.Group();
    const back = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.22, 0.06), brassMat);
    group.add(back);
    const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.09, 0.12, 12, 1, true), brassMat);
    cup.position.set(0, 0.06, 0.08);
    group.add(cup);
    const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, 0.55),
        new THREE.MeshBasicMaterial({
            map: sconceTex, transparent: true, opacity: 0.9,
            blending: THREE.AdditiveBlending, depthWrite: false, fog: false
        }));
    glow.position.set(0, 0.12, 0.1);
    group.add(glow);
    group.position.set(x, 2.35, z);
    group.rotation.y = faceYaw;
    parent.add(group);
}

// Round brass wall clock for the entry wall. Hands pivot at the clock centre
// (each in its own group, with the hand box offset up by half its length) and
// are driven to the real local time; returns an `update` that re-points them so
// the clock stays live. 12 o'clock is up (+y); clockwise is -rotation.z.
function buildClock(parent, x, y, z, faceYaw, brassMat) {
    const group = new THREE.Group();
    const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.3, 0.035, 10, 28), brassMat);
    group.add(rim);
    const face = new THREE.Mesh(
        new THREE.CircleGeometry(0.29, 28),
        new THREE.MeshStandardMaterial({ color: 0x1a140d, roughness: 0.6 }));
    face.position.z = 0.01;
    group.add(face);

    // Hour tick marks around the dial.
    const tickMat = new THREE.MeshStandardMaterial({
        color: 0xb59a68, roughness: 0.5, metalness: 0.5
    });
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const tick = new THREE.Mesh(
            new THREE.BoxGeometry(0.012, i % 3 === 0 ? 0.05 : 0.03, 0.008), tickMat);
        const r = 0.245;
        tick.position.set(Math.sin(a) * r, Math.cos(a) * r, 0.02);
        tick.rotation.z = -a;
        group.add(tick);
    }

    const handMat = new THREE.MeshStandardMaterial({
        color: 0xd8bd7f, roughness: 0.4, metalness: 0.7
    });
    function makeHand(width, len, zoff) {
        const pivot = new THREE.Group();
        const bar = new THREE.Mesh(
            new THREE.BoxGeometry(width, len, 0.01), handMat);
        bar.position.set(0, len / 2, zoff);
        pivot.add(bar);
        group.add(pivot);
        return pivot;
    }
    const hourH = makeHand(0.022, 0.15, 0.03);
    const minH = makeHand(0.015, 0.22, 0.035);
    const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.02, 12), brassMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 0.045;
    group.add(hub);

    function update() {
        const now = new Date();
        const h = now.getHours() % 12;
        const m = now.getMinutes();
        const s = now.getSeconds();
        minH.rotation.z = -Math.PI * 2 * ((m + s / 60) / 60);
        hourH.rotation.z = -Math.PI * 2 * ((h + m / 60) / 12);
    }
    update();

    group.position.set(x, y, z);
    group.rotation.y = faceYaw;
    parent.add(group);
    return update;
}

export function buildRoom(scene, floorTex, woodTex, bounds, doorway) {
    const root = new THREE.Group();
    scene.add(root);

    const length = bounds.xMax - bounds.xMin;
    const depth = bounds.zMax - bounds.zMin;
    const xMid = (bounds.xMin + bounds.xMax) / 2;
    const zMid = (bounds.zMin + bounds.zMax) / 2;
    const ceiling = STACKS.ceiling;

    const wallTex = makeWallTexture();
    const panelTex = makePanelTexture();
    const sconceTex = makeSconceTexture();
    const wallMat = new THREE.MeshStandardMaterial({
        map: wallTex, color: 0xa9855c, roughness: 0.92, metalness: 0.0,
        emissive: 0x1d0f06, emissiveIntensity: 1.0,
        side: THREE.FrontSide
    });
    const panelMat = panelMaterial(panelTex);
    panelMat.emissive = new THREE.Color(0x150c05);
    panelMat.emissiveIntensity = 1.0;
    const trimMat = new THREE.MeshStandardMaterial({
        map: woodTex, color: 0xb89a76, roughness: 0.6, metalness: 0.0
    });
    const beamMat = new THREE.MeshStandardMaterial({
        map: woodTex, color: 0xb08654, roughness: 0.78, metalness: 0.0,
        emissive: 0x2a1a0b, emissiveIntensity: 1.0
    });
    const brassMat = new THREE.MeshStandardMaterial({
        color: 0x8a6836, roughness: 0.4, metalness: 0.8
    });

    // Floor: PlaneGeometry(length, depth) has local +x = length, local +y =
    // depth. A plain rotation.x = -PI/2 lays local-x along world-x and
    // local-y along world-z, so the plane's extents line up with `bounds`
    // exactly. repeat.x tiles along local-x (world-x, extent `length`),
    // repeat.y along local-y (world-z, extent `depth`).
    floorTex.repeat.set(Math.round(length / 3.5), Math.round(depth / 2.6));
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(length, depth),
        new THREE.MeshStandardMaterial({
            map: floorTex, roughness: 0.32, metalness: 0.0
        }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(xMid, 0, zMid);
    root.add(floor);

    const rug = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, length - 2),
        new THREE.MeshStandardMaterial({
            map: makeRugTexture(), roughness: 0.94, metalness: 0.0
        }));
    rug.rotation.x = -Math.PI / 2;
    rug.rotation.z = Math.PI / 2;
    rug.position.set(xMid, 0.012, STACKS.walkwayDepth / 2 + 0.3);
    root.add(rug);

    buildCeiling(root, bounds, beamMat);

    // -z stack wall (behind the shelves): full run, inward normal +z.
    buildWallRun(root, "x", bounds.zMin, [{ start: bounds.xMin, end: bounds.xMax }],
        1, wallMat, panelMat, trimMat);
    buildPilasters(root, "x", bounds.zMin, bounds.xMin, bounds.xMax, 1, panelMat);

    // +z entry wall: honours the doorway. Inward normal -z.
    let entrySegments;
    let entryPilasterSkip = null;
    if (doorway) {
        const dLeft = doorway.x - doorway.width / 2;
        const dRight = doorway.x + doorway.width / 2;
        entrySegments = [
            { start: bounds.xMin, end: dLeft },
            { start: dRight, end: bounds.xMax }
        ];
        entryPilasterSkip = { min: dLeft - 0.4, max: dRight + 0.4 };
    } else {
        entrySegments = [{ start: bounds.xMin, end: bounds.xMax }];
    }
    buildWallRun(root, "x", bounds.zMax, entrySegments, -1, wallMat, panelMat,
        trimMat);
    buildPilasters(root, "x", bounds.zMax, bounds.xMin, bounds.xMax, -1, panelMat,
        entryPilasterSkip);

    // Lintel band above the doorway opening.
    if (doorway) {
        const lintel = new THREE.Mesh(
            new THREE.PlaneGeometry(doorway.width, ceiling - doorway.height),
            wallMat);
        lintel.rotation.y = Math.PI;
        lintel.position.set(
            doorway.x, (doorway.height + ceiling) / 2, bounds.zMax);
        root.add(lintel);
        const lintelTrim = new THREE.Mesh(
            new THREE.BoxGeometry(doorway.width + 0.24, 0.14, 0.14), trimMat);
        lintelTrim.position.set(doorway.x, doorway.height, bounds.zMax - 0.03);
        root.add(lintelTrim);
    }

    // Two end walls (±x). Inward normals +x (xMin) and -x (xMax).
    buildWallRun(root, "z", bounds.xMin, [{ start: bounds.zMin, end: bounds.zMax }],
        1, wallMat, panelMat, trimMat);
    buildPilasters(root, "z", bounds.xMin, bounds.zMin, bounds.zMax, 1, panelMat);
    buildWallRun(root, "z", bounds.xMax, [{ start: bounds.zMin, end: bounds.zMax }],
        -1, wallMat, panelMat, trimMat);
    buildPilasters(root, "z", bounds.xMax, bounds.zMin, bounds.zMax, -1, panelMat);

    // The entry-wall clock sits centred (offset if a doorway takes the centre);
    // sconces and pictures give it a clear berth.
    const clockX = doorway
        ? (Math.abs(xMid - doorway.x) < 2 ? doorway.x + doorway.width / 2 + 1.6 : xMid)
        : xMid;

    // Sconces along the two long walls, between pilasters, at 2.35 m. On the
    // entry wall, skip any that would land under the clock or over the doorway.
    const sconceSpacing = 5.0;
    const sconceCount = Math.max(2, Math.round(length / sconceSpacing));
    for (let i = 1; i < sconceCount; i++) {
        const x = bounds.xMin + (length * i) / sconceCount;
        buildSconce(root, x, bounds.zMin + 0.12, 0, sconceTex, brassMat);
        const overDoor = doorway && Math.abs(x - doorway.x) < doorway.width / 2 + 0.6;
        const underClock = Math.abs(x - clockX) < 1.3;
        if (!overDoor && !underClock) {
            buildSconce(root, x, bounds.zMax - 0.12, Math.PI, sconceTex, brassMat);
        }
    }

    // Sconces on the two short end walls flank the walkway, so those far walls
    // (seen straight down the room) read without spending a real light on each.
    [STACKS.walkwayDepth / 2, STACKS.walkwayDepth + 1.6].forEach(function (z) {
        buildSconce(root, bounds.xMin + 0.12, z, Math.PI / 2, sconceTex, brassMat);
        buildSconce(root, bounds.xMax - 0.12, z, -Math.PI / 2, sconceTex, brassMat);
    });


    const updateClock = buildClock(root, clockX, 2.9, bounds.zMax - 0.05, Math.PI,
        brassMat);

    // Warm fog + background: reduced density so walls read at room distances
    // while aisle depths still fade. Background warmed to sit under the plaster.
    scene.fog = new THREE.FogExp2(0x120c08, 0.028);
    scene.background = new THREE.Color(0x120c08);

    // Up to 3 real fill PointLights (budget: scene already runs ~8). The entry
    // half of this long room (z past the walkway) gets no pendant light, so one
    // washes the entry wall; the other two lift the far ±x end corners, which
    // the outermost aisle pendants do not reach. Emissive sconces carry the rest.
    const entryFill = new THREE.PointLight(0xffb885, 7.0, 12, 2);
    entryFill.position.set(xMid, 2.7, bounds.zMax - 1.6);
    root.add(entryFill);
    const endFill = new THREE.PointLight(0xffb27a, 4.6, 8, 2);
    endFill.position.set(bounds.xMin + 1.3, 2.4, STACKS.walkwayDepth / 2 + 0.3);
    const endFill2 = new THREE.PointLight(0xffb27a, 4.6, 8, 2);
    endFill2.position.set(bounds.xMax - 1.3, 2.4, STACKS.walkwayDepth / 2 + 0.3);
    root.add(endFill2);
    root.add(endFill);

    // Colliders for the four walls. Pilasters/baseboards protrude < 0.13 m, so
    // no per-decor colliders are needed (threshold ~0.10 m of walkable
    // intrusion; the wall AABBs already sit at the plane and the 0.5 m
    // thickness absorbs the shallow trim). The +z wall leaves the doorway gap.
    const wallThick = 0.5;
    const colliders = [
        { minX: bounds.xMin - wallThick, maxX: bounds.xMin,
            minZ: bounds.zMin - 1, maxZ: bounds.zMax + 1 },
        { minX: bounds.xMax, maxX: bounds.xMax + wallThick,
            minZ: bounds.zMin - 1, maxZ: bounds.zMax + 1 },
        { minX: bounds.xMin - 1, maxX: bounds.xMax + 1,
            minZ: bounds.zMin - wallThick, maxZ: bounds.zMin }
    ];
    if (doorway) {
        const dLeft = doorway.x - doorway.width / 2;
        const dRight = doorway.x + doorway.width / 2;
        colliders.push(
            { minX: bounds.xMin - 1, maxX: dLeft,
                minZ: bounds.zMax, maxZ: bounds.zMax + wallThick },
            { minX: dRight, maxX: bounds.xMax + 1,
                minZ: bounds.zMax, maxZ: bounds.zMax + wallThick });
    } else {
        colliders.push({ minX: bounds.xMin - 1, maxX: bounds.xMax + 1,
            minZ: bounds.zMax, maxZ: bounds.zMax + wallThick });
    }

    return { colliders: colliders, updateClock: updateClock };
}
