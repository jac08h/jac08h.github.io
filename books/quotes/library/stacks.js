import * as THREE from "three";
import {
    makeWoodTexture, makeFloorTexture, makeRugTexture, makePlaqueTexture,
    makeGlowTexture, mulberry32
} from "./textures.js";
import { buildRoom } from "./room.js";
import { buildEntry } from "./entry.js";

// Stack-room layout constants (meters). Double-sided shelf units run along -z,
// perpendicular to a main walkway at z ∈ [0, walkwayDepth]; each aisle holds
// two years, one per facing shelf face (left face and right face), so a unit
// is genuinely double-sided (one year on each of its two faces). An entry
// area with a reading table sits beyond the walkway at higher z.

export const STACKS = {
    unitLength: 4.6,
    unitThickness: 0.74,
    caseDepth: 0.36,
    aisleWidth: 2.0,
    pitch: 2.74,
    rowBottoms: [0.52, 1.36, 2.2],
    caseTop: 3.6,
    ceiling: 4.3,
    eyeHeight: 1.7,
    playerRadius: 0.3,
    walkwayDepth: 3.2,
    entryDepth: 5.0
};

function woodMaterial(tex, tint = 0xffffff, roughness = 0.78) {
    return new THREE.MeshStandardMaterial({
        map: tex, color: tint, roughness: roughness, metalness: 0.0
    });
}

// One bookcase face: plinth, sides, back panel, shelf planks, frieze, top
// trim. Local coords: +z faces the aisle, x runs along the shelf.
function buildCase(width, woodTex) {
    const group = new THREE.Group();
    const mat = woodMaterial(woodTex);
    const darkMat = new THREE.MeshStandardMaterial({
        color: 0x120a05, roughness: 0.95, metalness: 0.0
    });
    const d = STACKS.caseDepth;

    const back = new THREE.Mesh(
        new THREE.PlaneGeometry(width, STACKS.caseTop + 0.2), darkMat);
    back.position.set(0, (STACKS.caseTop + 0.2) / 2, -d / 2 + 0.01);
    group.add(back);

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(width, 0.24, d + 0.06), mat);
    plinth.position.set(0, 0.12, 0.02);
    group.add(plinth);

    [-1, 1].forEach(function (s) {
        const side = new THREE.Mesh(
            new THREE.BoxGeometry(0.09, STACKS.caseTop + 0.06, d), mat);
        side.position.set(s * (width / 2 - 0.045), (STACKS.caseTop + 0.06) / 2, 0);
        group.add(side);
    });

    STACKS.rowBottoms.forEach(function (y) {
        const plank = new THREE.Mesh(
            new THREE.BoxGeometry(width - 0.1, 0.05, d - 0.02), mat);
        plank.position.set(0, y - 0.026, 0);
        group.add(plank);
    });

    // Frieze board closing the case above the top row.
    const frieze = new THREE.Mesh(
        new THREE.BoxGeometry(width - 0.1, 0.56, d - 0.04), mat);
    frieze.position.set(0, STACKS.caseTop - 0.32, 0);
    group.add(frieze);

    const top = new THREE.Mesh(new THREE.BoxGeometry(width + 0.14, 0.16, d + 0.1), mat);
    top.position.set(0, STACKS.caseTop + 0.04, 0.02);
    group.add(top);

    return group;
}

// One double-sided stack unit centred on x = xCenter, spanning
// z ∈ [-unitLength, 0]: two cases back-to-back (one per aisle face) plus a
// walkway-facing end cap. Returns the two case groups keyed by face sign.
function buildUnit(scene, woodTex, xCenter) {
    const faceOffset = STACKS.unitThickness / 2 - STACKS.caseDepth / 2;
    const faces = {};

    [1, -1].forEach(function (sign) {
        const group = buildCase(STACKS.unitLength, woodTex);
        group.rotation.y = sign * Math.PI / 2;
        group.position.set(xCenter + sign * faceOffset, 0, -STACKS.unitLength / 2);
        scene.add(group);
        faces[sign] = group;
    });

    const capMat = woodMaterial(woodTex);
    const cap = new THREE.Mesh(
        new THREE.BoxGeometry(STACKS.unitThickness + 0.04, STACKS.caseTop + 0.2, 0.14),
        capMat);
    cap.position.set(xCenter, (STACKS.caseTop + 0.2) / 2, 0.02);
    scene.add(cap);
    const capTrim = new THREE.Mesh(
        new THREE.BoxGeometry(STACKS.unitThickness + 0.16, 0.16, 0.24), capMat);
    capTrim.position.set(xCenter, STACKS.caseTop + 0.04, 0.0);
    scene.add(capTrim);

    return faces;
}

// Brass-plaque year sign hanging over an aisle mouth, facing the entry. One
// plaque per shelf face: shifted toward its face and drawn with a triangle
// (side -1 left / +1 right) pointing at the shelf it labels.
function buildAisleSign(scene, year, aisleX, side) {
    const x = aisleX + side * 0.5;
    const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(0.88, 0.32),
        new THREE.MeshStandardMaterial({
            map: makePlaqueTexture(year, side), roughness: 0.5, metalness: 0.3,
            side: THREE.DoubleSide
        }));
    sign.position.set(x, 2.86, 0.3);
    sign.userData.year = year;
    scene.add(sign);

    const cordMat = new THREE.MeshStandardMaterial({ color: 0x0a0705, roughness: 0.9 });
    const cordLen = STACKS.ceiling - 3.05;
    const cordGeo = new THREE.CylinderGeometry(0.008, 0.008, cordLen, 5);
    [-0.35, 0.35].forEach(function (dx) {
        const cord = new THREE.Mesh(cordGeo, cordMat);
        cord.position.set(x + dx, 3.05 + cordLen / 2, 0.3);
        scene.add(cord);
    });
    return sign;
}

// Reading table with a couple of stacked books and a small brass lamp.
function buildEntryFurniture(scene, woodTex, x, z) {
    const mat = woodMaterial(woodTex, 0xc8b498, 0.6);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 0.95), mat);
    top.position.set(x, 0.76, z);
    scene.add(top);
    [[-0.76, -0.38], [0.76, -0.38], [-0.76, 0.38], [0.76, 0.38]].forEach(function (o) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.73, 0.08), mat);
        leg.position.set(x + o[0], 0.365, z + o[1]);
        scene.add(leg);
    });

    const rng = mulberry32(77);
    let stackY = 0.795;
    for (let i = 0; i < 3; i++) {
        const bw = 0.34 - i * 0.03;
        const bh = 0.055;
        const book = new THREE.Mesh(
            new THREE.BoxGeometry(bw, bh, 0.24),
            new THREE.MeshStandardMaterial({ roughness: 0.8 }));
        book.material.color.setHSL(
            (10 + rng() * 30) / 360, 0.3 + rng() * 0.1, 0.14 + rng() * 0.08);
        book.position.set(x - 0.45 + (rng() - 0.5) * 0.06, stackY + bh / 2, z + 0.1);
        book.rotation.y = (rng() - 0.5) * 0.3;
        scene.add(book);
        stackY += bh;
    }

    const brass = new THREE.MeshStandardMaterial({
        color: 0x7a5c30, roughness: 0.35, metalness: 0.85
    });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 0.34, 10), brass);
    stem.position.set(x + 0.45, 0.795 + 0.17, z - 0.12);
    scene.add(stem);
    const shade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.16, 0.13, 16, 1, true),
        new THREE.MeshStandardMaterial({
            color: 0x2a4a2e, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide
        }));
    shade.position.set(x + 0.45, 0.795 + 0.36, z - 0.12);
    scene.add(shade);
    const lamp = new THREE.PointLight(0xffc588, 4, 5, 2);
    lamp.position.set(x + 0.45, 0.795 + 0.3, z - 0.12);
    scene.add(lamp);
    return lamp;
}

function buildPendants(scene, positions) {
    const lamps = [];
    const brass = new THREE.MeshStandardMaterial({
        color: 0x7a5c30, roughness: 0.35, metalness: 0.85
    });
    const cordMat = new THREE.MeshStandardMaterial({ color: 0x0a0705, roughness: 0.9 });
    const bulbMat = new THREE.MeshBasicMaterial({ fog: false });
    bulbMat.color.setRGB(3.2, 2.1, 1.15);
    const glowTex = makeGlowTexture(128);
    const bulbY = 3.12;
    const cordGeo = new THREE.CylinderGeometry(
        0.012, 0.012, STACKS.ceiling - bulbY - 0.2, 6);
    const shadeGeo = new THREE.CylinderGeometry(0.03, 0.19, 0.16, 20, 1, true);
    const bulbGeo = new THREE.SphereGeometry(0.05, 14, 10);

    positions.forEach(function (p) {
        const cord = new THREE.Mesh(cordGeo, cordMat);
        cord.position.set(p.x, (STACKS.ceiling + bulbY) / 2 + 0.08, p.z);
        scene.add(cord);

        const shade = new THREE.Mesh(shadeGeo, brass);
        shade.position.set(p.x, bulbY + 0.16, p.z);
        scene.add(shade);

        const bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.set(p.x, bulbY, p.z);
        scene.add(bulb);

        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTex, color: 0xffcf96, transparent: true, opacity: 0.45,
            blending: THREE.AdditiveBlending, depthWrite: false, fog: false
        }));
        halo.scale.setScalar(0.8);
        halo.position.set(p.x, bulbY, p.z);
        scene.add(halo);

        const light = new THREE.PointLight(0xffb46a, 14, 10, 2);
        light.position.set(p.x, bulbY - 0.05, p.z);
        scene.add(light);
        lamps.push(light);
    });
    return lamps;
}

function buildLadder(scene, woodTex, x, z) {
    const group = new THREE.Group();
    const mat = woodMaterial(woodTex, 0xc0a888, 0.7);
    [-1, 1].forEach(function (s) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.055, 3.5, 0.04), mat);
        rail.position.set(s * 0.24, 1.75, 0);
        group.add(rail);
    });
    const rungGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.46, 8);
    for (let y = 0.3; y < 3.3; y += 0.34) {
        const rung = new THREE.Mesh(rungGeo, mat);
        rung.rotation.z = Math.PI / 2;
        rung.position.set(0, y, 0);
        group.add(rung);
    }
    group.position.set(x, 0, z);
    group.rotation.x = -0.18;
    scene.add(group);
}

function buildDust(scene, bounds) {
    const count = window.matchMedia("(pointer: coarse)").matches ? 110 : 340;
    const rng = mulberry32(51);
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
        positions[i * 3] = bounds.xMin + rng() * (bounds.xMax - bounds.xMin);
        positions[i * 3 + 1] = 0.2 + rng() * 3.8;
        positions[i * 3 + 2] = bounds.zMin + rng() * (bounds.zMax - bounds.zMin);
        velocities.push({
            x: (rng() - 0.5) * 0.035,
            y: 0.008 + rng() * 0.03,
            z: (rng() - 0.5) * 0.02,
            phase: rng() * Math.PI * 2
        });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
        map: makeGlowTexture(64), color: 0xffdcb0, size: 0.028,
        transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending,
        depthWrite: false, sizeAttenuation: true
    }));
    points.renderOrder = 6;
    scene.add(points);

    return function updateDust(dt, t) {
        const pos = geo.attributes.position.array;
        for (let i = 0; i < count; i++) {
            const v = velocities[i];
            pos[i * 3] += (v.x + Math.sin(t * 0.4 + v.phase) * 0.01) * dt;
            pos[i * 3 + 1] += v.y * dt;
            pos[i * 3 + 2] += v.z * dt;
            if (pos[i * 3 + 1] > 4.1) {
                pos[i * 3 + 1] = 0.15;
            }
        }
        geo.attributes.position.needsUpdate = true;
    };
}

// Builds the whole static stack room. Each shelf FACE holds exactly one year:
// aisle i has years[2i] on its left face and years[2i+1] (if present) on its
// right face, so a unit is genuinely double-sided. Returns bay descriptors
// (one per assigned year-face), decorative filler-only bays, the year signs
// (raycastable, userData.year), collision AABBs, aisle descriptors and the
// player spawn.
export function buildStacks(scene, years) {
    const woodTex = makeWoodTexture();
    const floorTex = makeFloorTexture();

    scene.fog = new THREE.FogExp2(0x0a0605, 0.05);
    scene.background = new THREE.Color(0x0a0605);
    scene.add(new THREE.HemisphereLight(0x584736, 0x0e0906, 0.65));

    const aisleCount = Math.ceil(years.length / 2);
    const unitCount = aisleCount + 1;
    const lastUnitX = (unitCount - 1) * STACKS.pitch;
    const bounds = {
        xMin: -(STACKS.unitThickness / 2 + STACKS.aisleWidth),
        xMax: lastUnitX + STACKS.unitThickness / 2 + STACKS.aisleWidth,
        zMin: -STACKS.unitLength - 0.2,
        zMax: STACKS.walkwayDepth + STACKS.entryDepth
    };
    const xMid = (bounds.xMin + bounds.xMax) / 2;

    const unitFaces = [];
    const colliders = [];
    for (let i = 0; i < unitCount; i++) {
        const ux = i * STACKS.pitch;
        unitFaces.push(buildUnit(scene, woodTex, ux));
        colliders.push({
            minX: ux - STACKS.unitThickness / 2,
            maxX: ux + STACKS.unitThickness / 2,
            minZ: -STACKS.unitLength - 0.05,
            maxZ: 0.12
        });
    }

    const bays = [];
    const plaques = [];
    const aisles = [];
    const decorBays = [
        // Outer faces of the two end units hold decorative filler only.
        { year: null, group: unitFaces[0][-1], width: STACKS.unitLength },
        { year: null, group: unitFaces[unitCount - 1][1], width: STACKS.unitLength }
    ];

    for (let i = 0; i < aisleCount; i++) {
        const aisleX = i * STACKS.pitch + STACKS.pitch / 2;
        // Left face: unit i facing +x. Right face: unit i+1 facing -x.
        const leftGroup = unitFaces[i][1];
        const rightGroup = unitFaces[i + 1][-1];
        const leftYear = years[2 * i];
        const rightYear = years[2 * i + 1];

        bays.push({
            year: leftYear, group: leftGroup,
            width: STACKS.unitLength, aisleX: aisleX
        });
        plaques.push(buildAisleSign(scene, leftYear, aisleX, -1));

        const aisle = { years: [leftYear], x: aisleX, mouthZ: 1.2 };
        if (rightYear !== undefined) {
            bays.push({
                year: rightYear, group: rightGroup,
                width: STACKS.unitLength, aisleX: aisleX
            });
            plaques.push(buildAisleSign(scene, rightYear, aisleX, 1));
            aisle.years.push(rightYear);
        } else {
            // Odd year count: the last aisle's right face is decorative.
            decorBays.push({
                year: null, group: rightGroup, width: STACKS.unitLength
            });
        }
        aisles.push(aisle);
    }

    const doorX = aisles[Math.min(1, aisles.length - 1)].x;
    const entry = buildEntry(scene, woodTex, doorX, bounds.zMax, colliders);
    const room = buildRoom(scene, floorTex, woodTex, bounds, entry.doorway);
    room.colliders.forEach(function (c) {
        colliders.push(c);
    });

    const tableZ = STACKS.walkwayDepth + 2.6;
    const tableLamp = buildEntryFurniture(scene, woodTex, xMid, tableZ);
    colliders.push({
        minX: xMid - 0.95, maxX: xMid + 0.95,
        minZ: tableZ - 0.58, maxZ: tableZ + 0.58
    });

    buildLadder(scene, woodTex, 2 * STACKS.pitch, 0.62);
    colliders.push({
        minX: 2 * STACKS.pitch - 0.35, maxX: 2 * STACKS.pitch + 0.35,
        minZ: 0.1, maxZ: 0.9
    });

    const pendantPositions = aisles.map(function (a) {
        return { x: a.x, z: -STACKS.unitLength / 2 };
    });
    const span = bounds.xMax - bounds.xMin;
    [0.28, 0.72].forEach(function (f) {
        pendantPositions.push({
            x: bounds.xMin + span * f, z: STACKS.walkwayDepth / 2 + 0.4
        });
    });
    const lamps = buildPendants(scene, pendantPositions);
    lamps.push(tableLamp);

    const updateDust = buildDust(scene, bounds);

    return {
        bays: bays, decorBays: decorBays, plaques: plaques, lamps: lamps,
        updateDust: updateDust, colliders: colliders, aisles: aisles,
        spawn: entry.spawn, bounds: bounds, entry: entry
    };
}
