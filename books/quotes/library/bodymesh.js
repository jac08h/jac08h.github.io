import * as THREE from "three";

// Geometry builders for the first-person body: skinned two-bone limb tubes,
// a trouser hip yoke, and a leather shoe. Pure construction — posing lives in
// body.js.

const JOINT_BLEND_HALF = 0.07;

// Elliptical cross-section profile lookup. Stations are {y, rx, rz, zOff}:
// rx = half-width (x), rz = half-depth (z), zOff = fore/aft shift of the
// centre so a quad can bulge forward and a calf backward. Linear between.
function sampleProfile(stations, y) {
    if (y >= stations[0].y) {
        return stations[0];
    }
    for (let i = 1; i < stations.length; i++) {
        if (y >= stations[i].y) {
            const a = stations[i - 1];
            const b = stations[i];
            const k = (y - a.y) / (b.y - a.y);
            return {
                rx: a.rx + (b.rx - a.rx) * k,
                rz: a.rz + (b.rz - a.rz) * k,
                zOff: a.zOff + (b.zOff - a.zOff) * k
            };
        }
    }
    return stations[stations.length - 1];
}

// One limb as a single SkinnedMesh tube along -y with a two-bone skeleton
// (upper at the origin, lower at jointY). Each ring is shaped to an elliptical
// cross-section with a fore/aft offset from the station profile; skin weights
// blend linearly across a zone around the joint so the knee bends without a
// seam or pinch.
export function skinnedLimb(stations, jointY, material) {
    const length = -stations[stations.length - 1].y;
    const geometry = new THREE.CylinderGeometry(1, 1, length, 18, 28, false);
    geometry.translate(0, -length / 2, 0);

    const pos = geometry.attributes.position;
    const skinIndices = [];
    const skinWeights = [];
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const p = sampleProfile(stations, y);
        pos.setX(i, pos.getX(i) * p.rx);
        pos.setZ(i, pos.getZ(i) * p.rz + p.zOff);
        const w = THREE.MathUtils.clamp(
            (jointY + JOINT_BLEND_HALF - y) / (2 * JOINT_BLEND_HALF), 0, 1);
        skinIndices.push(0, 1, 0, 0);
        skinWeights.push(1 - w, w, 0, 0);
    }
    geometry.setAttribute(
        "skinIndex", new THREE.Uint16BufferAttribute(skinIndices, 4));
    geometry.setAttribute(
        "skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));
    geometry.computeVertexNormals();

    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.frustumCulled = false;
    const upper = new THREE.Bone();
    const lower = new THREE.Bone();
    lower.position.y = jointY;
    upper.add(lower);
    mesh.add(upper);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton([upper, lower]));

    return { mesh: mesh, upper: upper, lower: lower };
}

// Trouser hip yoke / pelvis mass connecting the two thigh tops so the legs do
// not float and their flat tube caps stay hidden. A wide rounded pelvis
// bridges both thighs, a seat block adds depth behind, and a small crotch fill
// closes the inner gap; trouser material only — no torso above it. Origin at
// the hip anchor; top ends around the low waist.
export function buildHips(material, halfStance) {
    const group = new THREE.Group();

    // Pelvis mass: one rounded block wide enough to bridge both thigh tops and
    // deep enough to hide their flat caps front and back, tallest at the low
    // waist and rounding down over each hip. Trouser material only.
    const pelvis = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 22, 16), material);
    pelvis.frustumCulled = false;
    pelvis.scale.set(halfStance * 2 + 0.15, 0.14, 0.24);
    pelvis.position.set(0, -0.058, 0.01);
    group.add(pelvis);

    // Seat: a fuller rounded block at the back so the pelvis has depth behind
    // and the thigh tops do not show a gap from behind.
    const seat = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 18, 14), material);
    seat.frustumCulled = false;
    seat.scale.set(halfStance * 2 + 0.06, 0.14, 0.15);
    seat.position.set(0, -0.075, 0.055);
    group.add(seat);

    // Crotch fill so the inner thigh tops meet at the centre rather than
    // leaving daylight between the legs.
    const crotch = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 16, 12), material);
    crotch.frustumCulled = false;
    crotch.scale.set(halfStance * 1.4, 0.13, 0.15);
    crotch.position.set(0, -0.1, -0.01);
    group.add(crotch);

    return group;
}

// A shoe as a rigid group meant to hang off the calf bone at the ankle: sole
// slab with a low heel block, a long lasted vamp, a rounded toe box, and a
// heel counter rising toward the ankle under the trouser cuff. Overlapping
// primitives in one dark leather material read as a single shoe. Toe points
// local -z.
export function buildShoe(material) {
    const ankle = new THREE.Group();

    // Foot ~0.27 m long, toe toward -z. The shoe is one lasted body: a low
    // sole slab, a long domed upper (vamp) tapering to a rounded toe, and a
    // short heel counter rising at the back under the trouser cuff. Kept low
    // and smooth so it reads as a single leather shoe, not a bead of spheres.
    const SOLE_TOP = -0.07;
    const SOLE_BOT = -0.085;
    const FOOT_MID = -0.03;

    const sole = new THREE.Mesh(
        new THREE.BoxGeometry(0.082, SOLE_TOP - SOLE_BOT, 0.25), material);
    sole.frustumCulled = false;
    sole.position.set(0, (SOLE_TOP + SOLE_BOT) / 2, FOOT_MID);
    ankle.add(sole);

    const heelBlock = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.016, 0.055), material);
    heelBlock.frustumCulled = false;
    heelBlock.position.set(0, SOLE_BOT - 0.004, 0.068);
    ankle.add(heelBlock);

    // Main upper: one long low dome running the full foot length, tallest
    // over the midfoot and tapering down to the toe. A stretched sphere gives
    // a smooth continuous lasted top; toe and heel forms overlap it heavily so
    // the whole thing reads as one shoe rather than separate beads.
    const vamp = new THREE.Mesh(
        new THREE.SphereGeometry(1, 20, 14), material);
    vamp.frustumCulled = false;
    vamp.scale.set(0.046, 0.046, 0.16);
    vamp.position.set(0, SOLE_TOP - 0.006, -0.035);
    ankle.add(vamp);

    // Rounded toe cap, blended into the front of the vamp so the nose reads
    // as a full toe box rather than a point.
    const toe = new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 12), material);
    toe.frustumCulled = false;
    toe.scale.set(0.043, 0.033, 0.06);
    toe.position.set(0, SOLE_TOP - 0.006, -0.14);
    ankle.add(toe);

    // Heel counter: overlaps the back of the vamp and rises a little toward
    // the ankle so the trouser cuff overlaps its top; kept low so it does not
    // poke up as a separate ball.
    const heel = new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 12), material);
    heel.frustumCulled = false;
    heel.scale.set(0.045, 0.05, 0.06);
    heel.position.set(0, SOLE_TOP + 0.012, 0.05);
    ankle.add(heel);

    return ankle;
}
