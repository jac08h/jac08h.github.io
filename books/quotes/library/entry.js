import * as THREE from "three";
import { makeWoodTexture } from "./textures.js";
import { STACKS } from "./stacks.js";

// Double-door entry vestibule. The doorway is cut into the +z library wall at
// x = doorX, z = zWall. Two panels are hinged at the jambs and swing INTO the
// library (toward -z) when opened; the player starts in the vestibule (behind
// the wall, at higher z) and walks through into the stacks.
export const DOOR = { width: 1.8, height: 3.0, openAngle: 1.85 };

const VESTIBULE = { width: 3.0, depth: 2.4, ceiling: 3.4 };

function woodMaterial(tex, tint, roughness) {
    return new THREE.MeshStandardMaterial({
        map: tex, color: tint === undefined ? 0xffffff : tint,
        roughness: roughness === undefined ? 0.78 : roughness, metalness: 0.0
    });
}

// One door panel: a stile-and-rail slab with two recessed relief panels and a
// brass knob on both faces. Hinge edge sits at local x = 0; the slab extends
// away from the hinge toward the doorway centre (sign -hingeSign), pivoting
// about the origin. Height origin at the floor.
function buildPanel(woodTex, hingeSign) {
    const group = new THREE.Group();
    const mat = woodMaterial(woodTex, 0xb99a72, 0.7);
    const w = DOOR.width / 2;
    const h = DOOR.height;
    const thick = 0.08;
    const dir = -hingeSign;

    const slab = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, thick), mat);
    slab.position.set(dir * w / 2, h / 2, 0);
    group.add(slab);

    // Recessed relief panels, proud frame achieved by insetting darker fills.
    const reliefMat = woodMaterial(woodTex, 0x9c7f5c, 0.8);
    [-1, 1].forEach(function (vy) {
        const panel = new THREE.Mesh(
            new THREE.BoxGeometry(w - 0.22, h / 2 - 0.34, thick + 0.012),
            reliefMat);
        panel.position.set(dir * w / 2, h / 2 + vy * (h / 4 - 0.06), 0);
        group.add(panel);
    });

    const brass = new THREE.MeshStandardMaterial({
        color: 0x8a6a38, roughness: 0.3, metalness: 0.85
    });
    const knobEdge = dir * (w - 0.16);
    [thick / 2 + 0.03, -thick / 2 - 0.03].forEach(function (zoff) {
        const knob = new THREE.Mesh(
            new THREE.SphereGeometry(0.055, 14, 10), brass);
        knob.position.set(knobEdge, h * 0.46, zoff);
        group.add(knob);
    });

    return group;
}

export function buildEntry(scene, woodTex, doorX, zWall, colliders) {
    const tex = woodTex || makeWoodTexture();
    const halfW = DOOR.width / 2;
    const doorwayHeight = DOOR.height;

    const jambMat = woodMaterial(tex, 0xa9895f, 0.7);
    const darkMat = new THREE.MeshStandardMaterial({
        color: 0x0c0805, roughness: 0.95, metalness: 0.0
    });

    // --- Vestibule shell (behind the wall, z from zWall to zWall + depth) ----
    const zBack = zWall + VESTIBULE.depth;
    const vxMin = doorX - VESTIBULE.width / 2;
    const vxMax = doorX + VESTIBULE.width / 2;

    const vestFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(VESTIBULE.width, VESTIBULE.depth),
        new THREE.MeshStandardMaterial({ color: 0x140d07, roughness: 0.9 }));
    vestFloor.rotation.x = -Math.PI / 2;
    vestFloor.position.set(doorX, 0.006, zWall + VESTIBULE.depth / 2);
    scene.add(vestFloor);

    const vestCeil = new THREE.Mesh(
        new THREE.PlaneGeometry(VESTIBULE.width, VESTIBULE.depth),
        new THREE.MeshStandardMaterial({ color: 0x0e0906, roughness: 0.95 }));
    vestCeil.rotation.x = Math.PI / 2;
    vestCeil.position.set(doorX, VESTIBULE.ceiling, zWall + VESTIBULE.depth / 2);
    scene.add(vestCeil);

    const vestWallMat = new THREE.MeshStandardMaterial({
        color: 0x160f08, roughness: 0.9
    });

    // Back wall of the vestibule (faces -z, toward the doors).
    const backWall = new THREE.Mesh(
        new THREE.PlaneGeometry(VESTIBULE.width, VESTIBULE.ceiling), vestWallMat);
    backWall.position.set(doorX, VESTIBULE.ceiling / 2, zBack);
    backWall.rotation.y = Math.PI;
    scene.add(backWall);

    // Vestibule side walls (face inward).
    [vxMin, vxMax].forEach(function (x) {
        const side = new THREE.Mesh(
            new THREE.PlaneGeometry(VESTIBULE.depth, VESTIBULE.ceiling), vestWallMat);
        side.position.set(x, VESTIBULE.ceiling / 2, zWall + VESTIBULE.depth / 2);
        side.rotation.y = x === vxMin ? Math.PI / 2 : -Math.PI / 2;
        scene.add(side);
    });

    // Vestibule side of the entry wall: the library wall is single-sided, so
    // the vestibule needs its own wall planes flanking the doorway plus a
    // lintel band, all facing +z into the vestibule.
    const wingW = (VESTIBULE.width - DOOR.width) / 2;
    [-1, 1].forEach(function (s) {
        const wing = new THREE.Mesh(
            new THREE.PlaneGeometry(wingW, VESTIBULE.ceiling), vestWallMat);
        wing.position.set(
            doorX + s * (halfW + wingW / 2), VESTIBULE.ceiling / 2, zWall + 0.001);
        scene.add(wing);
    });
    const vestLintel = new THREE.Mesh(
        new THREE.PlaneGeometry(DOOR.width, VESTIBULE.ceiling - doorwayHeight),
        vestWallMat);
    vestLintel.position.set(
        doorX, (VESTIBULE.ceiling + doorwayHeight) / 2, zWall + 0.001);
    scene.add(vestLintel);

    // --- Door frame proud of the wall (jambs + lintel), both sides ----------
    const jambDepth = 0.24;
    [-1, 1].forEach(function (s) {
        const jamb = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, doorwayHeight + 0.12, jambDepth), jambMat);
        jamb.position.set(doorX + s * (halfW + 0.06), (doorwayHeight + 0.12) / 2, zWall);
        scene.add(jamb);
    });
    const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(DOOR.width + 0.3, 0.16, jambDepth), jambMat);
    lintel.position.set(doorX, doorwayHeight + 0.06, zWall);
    scene.add(lintel);

    // --- Door panels, hinged at the jambs, swinging toward -z (into library) -
    const doorGroups = [];
    [-1, 1].forEach(function (hingeSign) {
        const pivot = new THREE.Group();
        pivot.position.set(doorX + hingeSign * halfW, 0, zWall);
        const panel = buildPanel(tex, hingeSign);
        pivot.add(panel);
        scene.add(pivot);
        doorGroups.push({ pivot: pivot, hingeSign: hingeSign });
    });

    // Warm lantern so the closed doors read clearly before opening, plus a
    // low fill point light right at the doors to lift them out of pure black.
    const vestLight = new THREE.PointLight(0xffc07a, 24, 7, 2);
    vestLight.position.set(doorX, 2.55, zWall + VESTIBULE.depth * 0.5);
    scene.add(vestLight);
    const doorFill = new THREE.PointLight(0xffcaa0, 8, 3.2, 2);
    doorFill.position.set(doorX, 1.4, zWall + 0.6);
    scene.add(doorFill);

    // --- Colliders ----------------------------------------------------------
    const wallThick = 0.4;
    // Vestibule side walls and back wall.
    colliders.push(
        { minX: vxMin - wallThick, maxX: vxMin,
            minZ: zWall - 0.1, maxZ: zBack + wallThick },
        { minX: vxMax, maxX: vxMax + wallThick,
            minZ: zWall - 0.1, maxZ: zBack + wallThick },
        { minX: vxMin - wallThick, maxX: vxMax + wallThick,
            minZ: zBack, maxZ: zBack + wallThick });

    // Closed-door barrier across the opening (swapped out on first open).
    const closedCollider = {
        minX: doorX - halfW, maxX: doorX + halfW,
        minZ: zWall - 0.08, maxZ: zWall + 0.08
    };
    colliders.push(closedCollider);

    let swapped = false;
    function swapToOpen() {
        const i = colliders.indexOf(closedCollider);
        if (i !== -1) {
            colliders.splice(i, 1);
        }
        // Open panels rest swung into the library along the jambs, each panel
        // lying roughly parallel to z. Register a thin AABB where each panel
        // comes to rest so the player cannot pass through them.
        [-1, 1].forEach(function (hingeSign) {
            const hingeX = doorX + hingeSign * halfW;
            const restAngle = -hingeSign * DOOR.openAngle;
            // Closed slab tip sits at (-hingeSign * width/2) along x; rotating
            // that point about y by restAngle gives its open resting position.
            const r = -hingeSign * (DOOR.width / 2);
            const tipX = hingeX + r * Math.cos(restAngle);
            const tipZ = zWall - r * Math.sin(restAngle);
            const pad = 0.09;
            colliders.push({
                minX: Math.min(hingeX, tipX) - pad,
                maxX: Math.max(hingeX, tipX) + pad,
                minZ: Math.min(zWall, tipZ) - pad,
                maxZ: Math.max(zWall, tipZ) + pad
            });
        });
    }

    function setOpen(k) {
        const kc = Math.max(0, Math.min(1, k));
        const angle = kc * DOOR.openAngle;
        doorGroups.forEach(function (d) {
            // Slab extends toward centre (sign -hingeSign); rotating the pivot
            // by that same sign swings the free edge into the library (-z).
            d.pivot.rotation.y = -d.hingeSign * angle;
        });
        if (kc >= 1 && !swapped) {
            swapped = true;
            swapToOpen();
        }
    }

    setOpen(0);

    // Spawn deep in the vestibule facing the doors (-z), insideSpawn a few
    // steps into the library past the doorway. yaw 0 faces -z in this engine.
    const spawn = { x: doorX, z: zWall + VESTIBULE.depth - 0.55, yaw: 0 };
    const insideSpawn = { x: doorX, z: zWall - 1.9, yaw: 0 };

    return {
        doorway: { x: doorX, width: DOOR.width, height: DOOR.height },
        setOpen: setOpen,
        spawn: spawn,
        insideSpawn: insideSpawn
    };
}
