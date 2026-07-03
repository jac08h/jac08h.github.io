import * as THREE from "three";

const UPPER_ARM = 0.28;
const FOREARM = 0.27;

const CLOTH_TROUSERS = 0x3d2e1d;
const CLOTH_JACKET = 0x2c2318;
const SKIN = 0x8f6f4f;
const SHOE = 0x0d0a07;

function limbMaterial(color) {
    return new THREE.MeshStandardMaterial({
        color: color, roughness: 0.85, metalness: 0.0
    });
}

function box(w, h, d, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.frustumCulled = false;
    return mesh;
}

// One leg: hip pivot group -> thigh box -> knee pivot group -> shin box +
// shoe. Pivots sit at the top of each segment so rotation.x swings them.
function buildLeg(side, trousers, shoes) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.11, 0, 0);

    const thigh = box(0.14, 0.46, 0.15, trousers);
    thigh.position.y = -0.23;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.46;
    hip.add(knee);

    const shin = box(0.12, 0.42, 0.13, trousers);
    shin.position.y = -0.21;
    knee.add(shin);

    const shoe = box(0.12, 0.09, 0.28, shoes);
    shoe.position.set(0, -0.44, -0.07);
    knee.add(shoe);

    return { hip: hip, knee: knee };
}

// One arm: shoulder pivot group -> upper-arm box -> elbow pivot group ->
// forearm box -> hand box. Local -y runs down the limb at rest.
function buildArm(side, jacket, skin) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.19, -0.2, -0.02);

    const upper = box(0.075, UPPER_ARM, 0.08, jacket);
    upper.position.y = -UPPER_ARM / 2;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -UPPER_ARM;
    shoulder.add(elbow);

    const forearm = box(0.065, FOREARM, 0.065, jacket);
    forearm.position.y = -FOREARM / 2;
    elbow.add(forearm);

    const hand = box(0.07, 0.1, 0.042, skin);
    hand.position.y = -FOREARM - 0.035;
    elbow.add(hand);

    return { shoulder: shoulder, elbow: elbow, hand: hand };
}

// Stylized low-poly first-person body. Legs and torso hang off the yaw node
// (they turn with the player but not with the look pitch); arms hang off the
// pitch node so they follow the view like FPS hands. All meshes are excluded
// from raycasting by never being added to raycastTargets.
export function createBody(player) {
    const trousers = limbMaterial(CLOTH_TROUSERS);
    const jacket = limbMaterial(CLOTH_JACKET);
    const skin = limbMaterial(SKIN);
    const shoes = limbMaterial(SHOE);

    // Lower body, slightly behind the eye axis so it is visible when
    // pitching down without clipping the near plane.
    const hips = new THREE.Group();
    hips.position.set(0, 0.96, 0.14);
    player.rigYaw.add(hips);

    const pelvis = box(0.3, 0.16, 0.19, trousers);
    pelvis.position.y = 0.02;
    hips.add(pelvis);

    const chest = box(0.3, 0.3, 0.14, jacket);
    chest.position.set(0, 0.24, 0.08);
    hips.add(chest);

    const legs = [buildLeg(-1, trousers, shoes), buildLeg(1, trousers, shoes)];
    legs.forEach(function (leg) {
        hips.add(leg.hip);
    });

    const arms = [buildArm(-1, jacket, skin), buildArm(1, jacket, skin)];
    arms.forEach(function (arm) {
        player.rigPitch.add(arm.shoulder);
    });

    // Rest pose: arms forward-down, forearms raised so the hands sit low
    // in the view.
    const rest = {
        shoulderX: 0.7,
        shoulderZ: 0.12,
        elbowX: 1.35
    };

    // Per-arm IK override: null, or {target: Vector3 (rigPitch-local),
    // blend: 0..1} set by the grab animation.
    const ikState = [null, null];

    const tmpDir = new THREE.Vector3();
    const bendRef = new THREE.Vector3();
    const bendAxis = new THREE.Vector3();
    const bendDir = new THREE.Vector3();
    const elbowPos = new THREE.Vector3();
    const boneDir = new THREE.Vector3();
    const qShoulder = new THREE.Quaternion();
    const qForearm = new THREE.Quaternion();
    const yAxisNeg = new THREE.Vector3(0, -1, 0);

    // Analytic two-bone IK in rigPitch space. The elbow is placed
    // explicitly: on the shoulder-target line at the law-of-cosines
    // projection, offset perpendicular toward a down-and-out pole so the
    // bend looks natural; the forearm then points exactly at the target.
    function solveArm(arm, side, target) {
        const a = UPPER_ARM;
        const b = FOREARM + 0.07;
        const shoulderPos = arm.shoulder.position;
        tmpDir.copy(target).sub(shoulderPos);
        const d = THREE.MathUtils.clamp(tmpDir.length(), 0.1, a + b - 0.01);
        tmpDir.normalize();

        const proj = (a * a + d * d - b * b) / (2 * d);
        const height = Math.sqrt(Math.max(0, a * a - proj * proj));
        bendRef.set(side * 0.6, -1, 0.15);
        bendAxis.crossVectors(tmpDir, bendRef);
        if (bendAxis.lengthSq() < 1e-6) {
            bendAxis.set(1, 0, 0);
        }
        bendAxis.normalize();
        bendDir.crossVectors(bendAxis, tmpDir).normalize();
        elbowPos.copy(shoulderPos)
            .addScaledVector(tmpDir, proj)
            .addScaledVector(bendDir, height);

        boneDir.copy(elbowPos).sub(shoulderPos).normalize();
        qShoulder.setFromUnitVectors(yAxisNeg, boneDir);
        arm.shoulder.quaternion.copy(qShoulder);

        boneDir.copy(target).sub(elbowPos).normalize();
        qForearm.setFromUnitVectors(yAxisNeg, boneDir);
        arm.elbow.quaternion.copy(qShoulder).invert().multiply(qForearm);
    }

    function applyRest(arm, side, t, speedFactor) {
        const sway = Math.sin(t * 1.7 + side) * 0.02 +
            Math.sin(player.state.bobPhase + side * Math.PI) * 0.05 * speedFactor;
        arm.shoulder.rotation.set(
            rest.shoulderX + sway, 0, side * rest.shoulderZ);
        arm.elbow.rotation.set(rest.elbowX, 0, side * 0.06);
    }

    return {
        arms: arms,

        // side: 0 = left, 1 = right. target is rigPitch-local; blend 0..1.
        setArmIK: function (side, target, blend) {
            ikState[side] = blend > 0.001 ? { target: target, blend: blend } : null;
        },

        update: function (dt, t) {
            const speed = player.state.speedFactor;
            const phase = player.state.bobPhase;

            legs.forEach(function (leg, i) {
                const legPhase = phase + i * Math.PI;
                const swing = Math.sin(legPhase) * 0.55 * speed;
                leg.hip.rotation.x = swing;
                const lift = Math.max(0, Math.sin(legPhase + Math.PI * 0.55));
                leg.knee.rotation.x = -lift * 0.85 * speed;
            });

            arms.forEach(function (arm, i) {
                const side = i === 0 ? -1 : 1;
                const ik = ikState[i];
                if (ik && ik.blend >= 1) {
                    solveArm(arm, side, ik.target);
                } else if (ik) {
                    applyRest(arm, side, t, speed);
                    const restShoulder = arm.shoulder.quaternion.clone();
                    const restElbow = arm.elbow.quaternion.clone();
                    solveArm(arm, side, ik.target);
                    arm.shoulder.quaternion.slerpQuaternions(
                        restShoulder, arm.shoulder.quaternion, ik.blend);
                    arm.elbow.quaternion.slerpQuaternions(
                        restElbow, arm.elbow.quaternion, ik.blend);
                } else {
                    applyRest(arm, side, t, speed);
                }
            });
        }
    };
}
