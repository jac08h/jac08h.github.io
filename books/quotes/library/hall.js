import * as THREE from "three";
import {
    makeWoodTexture, makeFloorTexture, makeRugTexture, makePlaqueTexture,
    makeGlowTexture, mulberry32
} from "./textures.js";

// Hall layout constants (meters). A single wall of bookcases runs along +x
// at z = 0, facing the camera (+z). One bay per year, newest year leftmost;
// the camera strafes sideways along the wall.
export const HALL = {
    wallZ: 0,
    ceiling: 4.3,
    bayPitch: 5.5,
    caseWidth: 4.6,
    caseDepth: 0.36,
    rowBottoms: [0.52, 1.36, 2.2],
    caseTop: 3.6,
    friezeY: 3.32,
    cameraZ: 3.6,
    cameraY: 1.7
};

function woodMaterial(tex, tint = 0xffffff, roughness = 0.78) {
    return new THREE.MeshStandardMaterial({
        map: tex, color: tint, roughness: roughness, metalness: 0.0
    });
}

// One bookcase: plinth, sides, back panel, shelf planks, frieze, top trim.
// Local coords: +z faces the camera, x runs along the wall.
function buildCase(width, woodTex) {
    const group = new THREE.Group();
    const mat = woodMaterial(woodTex);
    const darkMat = new THREE.MeshStandardMaterial({
        color: 0x120a05, roughness: 0.95, metalness: 0.0
    });
    const d = HALL.caseDepth;

    const back = new THREE.Mesh(
        new THREE.PlaneGeometry(width, HALL.caseTop + 0.2), darkMat);
    back.position.set(0, (HALL.caseTop + 0.2) / 2, -d / 2 + 0.01);
    group.add(back);

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(width, 0.24, d + 0.06), mat);
    plinth.position.set(0, 0.12, 0.02);
    group.add(plinth);

    [-1, 1].forEach(function (s) {
        const side = new THREE.Mesh(
            new THREE.BoxGeometry(0.09, HALL.caseTop + 0.06, d), mat);
        side.position.set(s * (width / 2 - 0.045), (HALL.caseTop + 0.06) / 2, 0);
        group.add(side);
    });

    HALL.rowBottoms.forEach(function (y) {
        const plank = new THREE.Mesh(
            new THREE.BoxGeometry(width - 0.1, 0.05, d - 0.02), mat);
        plank.position.set(0, y - 0.026, 0);
        group.add(plank);
    });

    // Frieze board closing the case above the top row, carrying the plaque.
    const frieze = new THREE.Mesh(
        new THREE.BoxGeometry(width - 0.1, 0.56, d - 0.04), mat);
    frieze.position.set(0, HALL.caseTop - 0.32, 0);
    group.add(frieze);

    const top = new THREE.Mesh(new THREE.BoxGeometry(width + 0.14, 0.16, d + 0.1), mat);
    top.position.set(0, HALL.caseTop + 0.04, 0.02);
    group.add(top);

    return group;
}

function placeCase(scene, woodTex, xCenter, width) {
    const group = buildCase(width, woodTex);
    group.position.set(xCenter, 0, HALL.wallZ);
    scene.add(group);
    return group;
}

function buildRoomShell(scene, floorTex, woodTex, xMin, xMax) {
    const length = xMax - xMin;
    const xMid = (xMin + xMax) / 2;
    const depth = 9;
    const zMid = HALL.wallZ - 0.5 + depth / 2;

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(length, depth),
        new THREE.MeshStandardMaterial({
            map: floorTex, roughness: 0.32, metalness: 0.0
        }));
    floor.rotation.x = -Math.PI / 2;
    floor.rotation.z = Math.PI / 2;
    floor.position.set(xMid, 0, zMid);
    scene.add(floor);

    const rug = new THREE.Mesh(
        new THREE.PlaneGeometry(2.0, length - 2),
        new THREE.MeshStandardMaterial({
            map: makeRugTexture(), roughness: 0.94, metalness: 0.0
        }));
    rug.rotation.x = -Math.PI / 2;
    rug.rotation.z = Math.PI / 2;
    rug.position.set(xMid, 0.012, 2.1);
    scene.add(rug);

    const ceilMat = new THREE.MeshStandardMaterial({
        color: 0x140d07, roughness: 0.95
    });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(length, depth), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.rotation.z = Math.PI / 2;
    ceiling.position.set(xMid, HALL.ceiling, zMid);
    scene.add(ceiling);

    const wallMat = new THREE.MeshStandardMaterial({
        color: 0x1a110a, roughness: 0.9
    });
    const shelfWall = new THREE.Mesh(
        new THREE.PlaneGeometry(length, HALL.ceiling), wallMat);
    shelfWall.position.set(xMid, HALL.ceiling / 2, HALL.wallZ - 0.25);
    scene.add(shelfWall);

    // Wall behind the camera, with a wainscot rail.
    const backWall = new THREE.Mesh(
        new THREE.PlaneGeometry(length, HALL.ceiling), wallMat);
    backWall.position.set(xMid, HALL.ceiling / 2, HALL.wallZ + depth - 0.6);
    backWall.rotation.y = Math.PI;
    scene.add(backWall);
    const rail = new THREE.Mesh(
        new THREE.BoxGeometry(length, 0.1, 0.06), woodMaterial(woodTex));
    rail.position.set(xMid, 1.1, HALL.wallZ + depth - 0.64);
    scene.add(rail);

    [xMin, xMax].forEach(function (x) {
        const endWall = new THREE.Mesh(
            new THREE.PlaneGeometry(depth, HALL.ceiling), wallMat);
        endWall.position.set(x, HALL.ceiling / 2, zMid);
        endWall.rotation.y = x === xMin ? Math.PI / 2 : -Math.PI / 2;
        scene.add(endWall);
    });

    // Cornice running above the bookcases.
    const cornice = new THREE.Mesh(
        new THREE.BoxGeometry(length, 0.26, 0.4),
        woodMaterial(woodTex, 0xffffff, 0.85));
    cornice.position.set(xMid, HALL.ceiling - 0.35, HALL.wallZ + 0.12);
    scene.add(cornice);
}

function buildColumns(scene, woodTex, columnXs) {
    const mat = woodMaterial(woodTex, 0xd8c8b8, 0.8);
    const capMat = woodMaterial(woodTex, 0xb8a890, 0.8);
    columnXs.forEach(function (x) {
        const col = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, HALL.ceiling - 0.4, 0.42), mat);
        col.position.set(x, (HALL.ceiling - 0.4) / 2, HALL.wallZ + 0.12);
        scene.add(col);
        [0.15, HALL.ceiling - 0.52].forEach(function (y) {
            const cap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.54), capMat);
            cap.position.set(x, y + 0.07, HALL.wallZ + 0.12);
            scene.add(cap);
        });
    });
}

function buildPendants(scene, bayXs) {
    const lamps = [];
    const brass = new THREE.MeshStandardMaterial({
        color: 0x7a5c30, roughness: 0.35, metalness: 0.85
    });
    const cordMat = new THREE.MeshStandardMaterial({ color: 0x0a0705, roughness: 0.9 });
    const bulbMat = new THREE.MeshBasicMaterial({ fog: false });
    bulbMat.color.setRGB(3.2, 2.1, 1.15);
    const glowTex = makeGlowTexture(128);
    const bulbY = 3.12;
    const pendantZ = HALL.wallZ + 1.45;
    const cordGeo = new THREE.CylinderGeometry(
        0.012, 0.012, HALL.ceiling - bulbY - 0.2, 6);
    const shadeGeo = new THREE.CylinderGeometry(0.03, 0.19, 0.16, 20, 1, true);
    const bulbGeo = new THREE.SphereGeometry(0.05, 14, 10);

    bayXs.forEach(function (x) {
        const cord = new THREE.Mesh(cordGeo, cordMat);
        cord.position.set(x, (HALL.ceiling + bulbY) / 2 + 0.08, pendantZ);
        scene.add(cord);

        const shade = new THREE.Mesh(shadeGeo, brass);
        shade.position.set(x, bulbY + 0.16, pendantZ);
        scene.add(shade);

        const bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.set(x, bulbY, pendantZ);
        scene.add(bulb);

        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTex, color: 0xffcf96, transparent: true, opacity: 0.45,
            blending: THREE.AdditiveBlending, depthWrite: false, fog: false
        }));
        halo.scale.setScalar(0.8);
        halo.position.set(x, bulbY, pendantZ);
        scene.add(halo);

        const light = new THREE.PointLight(0xffb46a, 14, 10, 2);
        light.position.set(x, bulbY - 0.05, pendantZ - 0.3);
        scene.add(light);
        lamps.push(light);
    });
    return lamps;
}

function buildLadder(scene, woodTex, x) {
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
    group.position.set(x, 0, HALL.wallZ + 0.62);
    group.rotation.x = -0.18;
    scene.add(group);
}

function buildDust(scene, xMin, xMax) {
    const count = window.matchMedia("(pointer: coarse)").matches ? 110 : 300;
    const rng = mulberry32(51);
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
        positions[i * 3] = xMin + rng() * (xMax - xMin);
        positions[i * 3 + 1] = 0.2 + rng() * 3.8;
        positions[i * 3 + 2] = HALL.wallZ + 0.2 + rng() * 2.2;
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

// Builds the whole static hall. Returns bay descriptors for the book layer,
// the year plaque meshes (raycast targets) and the per-frame dust updater.
export function buildHall(scene, years) {
    const woodTex = makeWoodTexture();
    const floorTex = makeFloorTexture();

    scene.fog = new THREE.FogExp2(0x0a0605, 0.052);
    scene.background = new THREE.Color(0x0a0605);
    scene.add(new THREE.HemisphereLight(0x584736, 0x0e0906, 0.65));

    const bays = [];
    const plaques = [];
    years.forEach(function (year, i) {
        const xCenter = i * HALL.bayPitch;
        const group = placeCase(scene, woodTex, xCenter, HALL.caseWidth);

        const plaque = new THREE.Mesh(
            new THREE.PlaneGeometry(1.05, 0.38),
            new THREE.MeshStandardMaterial({
                map: makePlaqueTexture(year), roughness: 0.5, metalness: 0.3
            }));
        plaque.position.set(0, HALL.friezeY, HALL.caseDepth / 2 + 0.02);
        plaque.rotation.x = 0.16;
        plaque.userData.year = year;
        group.add(plaque);
        plaques.push(plaque);

        bays.push({
            year: year, index: i, xCenter: xCenter,
            group: group, width: HALL.caseWidth
        });
    });

    // Decorative all-filler cases just past both ends of the year run.
    const decorBays = [];
    [-HALL.bayPitch, years.length * HALL.bayPitch].forEach(function (x) {
        const group = placeCase(scene, woodTex, x, HALL.caseWidth);
        decorBays.push({
            year: null, xCenter: x, group: group, width: HALL.caseWidth
        });
    });

    const xMin = -HALL.bayPitch - 4;
    const xMax = years.length * HALL.bayPitch + 4;
    buildRoomShell(scene, floorTex, woodTex, xMin, xMax);

    const columnXs = [];
    for (let i = 0; i <= years.length; i++) {
        columnXs.push((i - 0.5) * HALL.bayPitch);
    }
    buildColumns(scene, woodTex, columnXs);
    buildLadder(scene, woodTex, columnXs[1] + 0.02);

    const lamps = buildPendants(scene, bays.map(function (b) { return b.xCenter; }));
    const updateDust = buildDust(scene, xMin, xMax);

    return { bays: bays, decorBays: decorBays, plaques: plaques,
        lamps: lamps, updateDust: updateDust };
}
