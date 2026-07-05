import * as THREE from "three";
import { skinnedLimb, buildShoe, buildHips } from "./bodymesh.js";
import { makeTrouserTexture, makeLeatherTexture } from "./textures.js";

const THIGH = 0.46;
const CALF = 0.42;
const HALF_STANCE = 0.125;

const CLOTH_TROUSERS = 0x4a3927;
const SHOE = 0x100c08;

// Elliptical cross-section profile down one leg (y down from the hip).
// {y, rx, rz, zOff}: rx half-width, rz half-depth, zOff fore/aft centre shift
// of the ring (toe points -z, so negative zOff = forward, positive = back).
// The thigh is the most massive with a forward quad bulge (negative zOff); the
// calf muscle bulges at the upper-back of the shin (positive zOff); everything
// tapers to a slim ankle, then flares into a trouser cuff that overlaps the
// shoe top. Muscle shapes are softened for trouser drape.
const LEG_STATIONS = [
    { y: 0, rx: 0.058, rz: 0.06, zOff: 0.0 },
    { y: -0.05, rx: 0.066, rz: 0.069, zOff: -0.004 },
    { y: -0.18, rx: 0.073, rz: 0.079, zOff: -0.01 },
    { y: -THIGH + 0.05, rx: 0.07, rz: 0.075, zOff: -0.008 },
    { y: -THIGH, rx: 0.064, rz: 0.07, zOff: 0.0 },
    { y: -THIGH - 0.04, rx: 0.062, rz: 0.07, zOff: 0.006 },
    { y: -THIGH - 0.15, rx: 0.06, rz: 0.075, zOff: 0.014 },
    { y: -THIGH - CALF + 0.14, rx: 0.05, rz: 0.055, zOff: 0.006 },
    { y: -THIGH - CALF + 0.05, rx: 0.043, rz: 0.047, zOff: 0.0 },
    { y: -THIGH - CALF + 0.01, rx: 0.054, rz: 0.059, zOff: -0.006 },
    { y: -THIGH - CALF, rx: 0.056, rz: 0.061, zOff: -0.008 }
];

function trouserMaterial() {
    const tex = makeTrouserTexture();
    return new THREE.MeshStandardMaterial({
        color: CLOTH_TROUSERS, roughness: 0.96, metalness: 0.0, map: tex
    });
}

function shoeMaterial() {
    const tex = makeLeatherTexture();
    return new THREE.MeshStandardMaterial({
        color: SHOE, roughness: 0.52, metalness: 0.0, map: tex
    });
}

// One leg: skinned thigh+calf tube with hip (upper) and knee (lower) bones,
// a rigid shoe on an ankle group at the calf end. Rotation.x on the bones
// swings them exactly like the old pivot groups.
function buildLeg(side, trousers, shoes) {
    const root = new THREE.Group();
    root.position.set(side * HALF_STANCE, 0, 0);

    const limb = skinnedLimb(LEG_STATIONS, -THIGH, trousers);
    root.add(limb.mesh);

    const ankle = buildShoe(shoes);
    ankle.position.y = -CALF;
    limb.lower.add(ankle);

    return { root: root, hip: limb.upper, knee: limb.lower, ankle: ankle };
}

// Stylized first-person body, CS-style: legs only, no torso or arms. They
// hang off the yaw node (they turn with the player but not with the look
// pitch) and are visible when looking down; a trouser hip yoke connects the
// thigh tops so nothing floats. Walk cycle with foot roll and hip sway. All
// meshes are frustumCulled = false and are never added to raycastTargets.
export function createBody(player) {
    const trousers = trouserMaterial();
    const shoes = shoeMaterial();

    // Hip anchor, behind the eye axis so the legs read as receding forward
    // when pitching down without clipping the near plane. Kept low so the
    // thigh tops sit well below the near cone.
    const hips = new THREE.Group();
    hips.position.set(0, 0.92, 0.16);
    player.rigYaw.add(hips);

    const yoke = buildHips(trousers, HALF_STANCE);
    hips.add(yoke);

    const legs = [buildLeg(-1, trousers, shoes), buildLeg(1, trousers, shoes)];
    legs.forEach(function (leg) {
        hips.add(leg.root);
    });

    // Idle stance: thighs lean slightly forward with a soft knee bend so the
    // first-person down-view sees the legs receding rather than the thigh
    // caps; a few degrees of out-toe and stance splay reads as natural.
    const IDLE_HIP = 0.19;
    const IDLE_KNEE = -0.13;
    legs.forEach(function (leg, i) {
        const side = i === 0 ? -1 : 1;
        leg.root.rotation.z = side * 0.02;
        leg.baseYaw = side * 0.06;
        leg.root.rotation.y = leg.baseYaw;
        leg.hip.rotation.x = IDLE_HIP;
        leg.knee.rotation.x = IDLE_KNEE;
    });

    return {
        update: function () {
            const speed = player.state.speedFactor;
            const phase = player.state.bobPhase;

            hips.rotation.z = Math.sin(phase) * 0.04 * speed;
            // While walking the pelvis rides a touch higher so the trailing
            // foot clears the floor on toe-off, then bobs twice per stride:
            // up when a leg is planted under it, down as the legs spread.
            hips.position.y = 0.92 + 0.02 * speed -
                (0.5 + 0.5 * Math.cos(phase * 2)) * 0.03 * speed;

            legs.forEach(function (leg, i) {
                const legPhase = phase + i * Math.PI;
                const s = Math.sin(legPhase);
                const swing = s * 0.36 * speed;
                // Blend the relaxed idle bend out as the stride ramps up.
                const idleHip = IDLE_HIP * (1 - speed);
                leg.hip.rotation.x = idleHip + swing;

                // Knee flexes as the leg passes behind and lifts into the
                // forward swing; a small floor of bend prevents a locked,
                // hyperextended stance leg.
                const lift = Math.max(0, Math.sin(legPhase + Math.PI * 0.35));
                const kneeRot = IDLE_KNEE * (1 - speed) -
                    (lift * 0.7 + 0.06) * speed;
                leg.knee.rotation.x = kneeRot;

                // Ankle: mostly counter the hip+knee so the sole stays level,
                // with a toe-off push as the leg trails (leg back, s<0) and a
                // slight dorsiflex for heel-strike as it swings forward.
                const toeOff = Math.max(0, -s);
                const heelStrike = Math.max(0, s);
                leg.ankle.rotation.x = -(idleHip + swing + kneeRot) * 0.7 -
                    toeOff * 0.16 * speed + heelStrike * 0.14 * speed;
            });
        }
    };
}
