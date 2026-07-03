import * as THREE from "three";
import { STACKS } from "./stacks.js";

const WALK_SPEED = 2.0;
const RUN_SPEED = 3.4;
const LOOK_SENSITIVITY = 0.0022;
const PITCH_LIMIT = 1.48;

const KEY_DIRS = {
    KeyW: { f: 1, s: 0 }, ArrowUp: { f: 1, s: 0 },
    KeyS: { f: -1, s: 0 }, ArrowDown: { f: -1, s: 0 },
    KeyA: { f: 0, s: -1 }, ArrowLeft: { f: 0, s: -1 },
    KeyD: { f: 0, s: 1 }, ArrowRight: { f: 0, s: 1 }
};

// First-person controller: pointer-lock mouse look plus WASD movement with
// circle-vs-AABB collision on a flat floor. The camera hangs off a two-node
// rig (yaw group at the feet, pitch group at eye height) so the body can be
// attached to the yaw node and the arms to the pitch node.
export function createPlayer(scene, camera, canvas, colliders, reducedMotion) {
    const rigYaw = new THREE.Group();
    const rigPitch = new THREE.Group();
    rigPitch.position.y = STACKS.eyeHeight;
    rigYaw.add(rigPitch);
    rigPitch.add(camera);
    scene.add(rigYaw);

    const state = {
        yaw: 0,
        pitch: 0,
        locked: false,
        enabled: true,
        bobPhase: 0,
        speedFactor: 0
    };
    const vel = new THREE.Vector2();
    const keys = {};
    let lockHint = null;

    function applyLook() {
        rigYaw.rotation.y = state.yaw;
        rigPitch.rotation.x = state.pitch;
    }

    document.addEventListener("pointerlockchange", function () {
        state.locked = document.pointerLockElement === canvas;
        if (lockHint) {
            lockHint(state.locked);
        }
    });

    document.addEventListener("mousemove", function (event) {
        if (!state.locked || !state.enabled) {
            return;
        }
        state.yaw -= event.movementX * LOOK_SENSITIVITY;
        state.pitch = THREE.MathUtils.clamp(
            state.pitch - event.movementY * LOOK_SENSITIVITY,
            -PITCH_LIMIT, PITCH_LIMIT);
        applyLook();
    });

    document.addEventListener("keydown", function (event) {
        if (KEY_DIRS[event.code]) {
            keys[event.code] = true;
            if (state.locked) {
                event.preventDefault();
            }
        }
        if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
            keys.shift = true;
        }
    });

    document.addEventListener("keyup", function (event) {
        if (KEY_DIRS[event.code]) {
            keys[event.code] = false;
        }
        if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
            keys.shift = false;
        }
    });

    window.addEventListener("blur", function () {
        Object.keys(keys).forEach(function (k) {
            keys[k] = false;
        });
    });

    // Pushes (x, z) out of every collider it overlaps, treating the player
    // as a circle of STACKS.playerRadius. Two passes settle corner contacts.
    function resolveCollisions(pos) {
        const r = STACKS.playerRadius;
        for (let pass = 0; pass < 2; pass++) {
            colliders.forEach(function (box) {
                const cx = Math.max(box.minX, Math.min(pos.x, box.maxX));
                const cz = Math.max(box.minZ, Math.min(pos.z, box.maxZ));
                const dx = pos.x - cx;
                const dz = pos.z - cz;
                const distSq = dx * dx + dz * dz;
                if (distSq >= r * r) {
                    return;
                }
                if (distSq > 1e-9) {
                    const dist = Math.sqrt(distSq);
                    pos.x = cx + (dx / dist) * r;
                    pos.z = cz + (dz / dist) * r;
                } else {
                    // Centre is inside the box: push out along the axis of
                    // least penetration.
                    const outs = [
                        { d: pos.x - box.minX + r, x: box.minX - r, z: pos.z },
                        { d: box.maxX - pos.x + r, x: box.maxX + r, z: pos.z },
                        { d: pos.z - box.minZ + r, x: pos.x, z: box.minZ - r },
                        { d: box.maxZ - pos.z + r, x: pos.x, z: box.maxZ + r }
                    ];
                    outs.sort(function (a, b) {
                        return a.d - b.d;
                    });
                    pos.x = outs[0].x;
                    pos.z = outs[0].z;
                }
            });
        }
    }

    function step(dt, forward, strafe, running) {
        const target = new THREE.Vector2(strafe, -forward);
        if (target.lengthSq() > 1) {
            target.normalize();
        }
        target.multiplyScalar(running ? RUN_SPEED : WALK_SPEED);
        target.rotateAround(new THREE.Vector2(0, 0), -state.yaw);

        const k = 1 - Math.exp(-dt * 10);
        vel.x += (target.x - vel.x) * k;
        vel.y += (target.y - vel.y) * k;

        rigYaw.position.x += vel.x * dt;
        rigYaw.position.z += vel.y * dt;
        resolveCollisions(rigYaw.position);

        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
        state.speedFactor = Math.min(1, speed / WALK_SPEED);
        if (speed > 0.15 && !reducedMotion) {
            state.bobPhase += speed * dt * 2.6;
            rigPitch.position.y = STACKS.eyeHeight +
                Math.sin(state.bobPhase * 2) * 0.035 * state.speedFactor;
            rigPitch.position.x = Math.sin(state.bobPhase) * 0.02 * state.speedFactor;
        } else {
            rigPitch.position.y +=
                (STACKS.eyeHeight - rigPitch.position.y) * Math.min(1, dt * 8);
            rigPitch.position.x += (0 - rigPitch.position.x) * Math.min(1, dt * 8);
        }
    }

    return {
        rigYaw: rigYaw,
        rigPitch: rigPitch,
        state: state,
        keys: keys,

        update: function (dt) {
            if (!state.enabled) {
                state.speedFactor = 0;
                return;
            }
            let forward = 0;
            let strafe = 0;
            Object.keys(KEY_DIRS).forEach(function (code) {
                if (keys[code]) {
                    forward += KEY_DIRS[code].f;
                    strafe += KEY_DIRS[code].s;
                }
            });
            step(dt, forward, strafe, !!keys.shift);
        },

        teleport: function (x, z, yaw, pitch) {
            rigYaw.position.set(x, 0, z);
            resolveCollisions(rigYaw.position);
            if (yaw !== undefined) {
                state.yaw = yaw;
            }
            if (pitch !== undefined) {
                state.pitch = THREE.MathUtils.clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
            }
            vel.set(0, 0);
            applyLook();
        },

        // Applies a displacement through the collision solver, substepped so
        // large moves cannot tunnel through walls; the pointer-lock-free path
        // used by tests.
        nudge: function (dx, dz) {
            const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.1));
            for (let i = 0; i < steps; i++) {
                rigYaw.position.x += dx / steps;
                rigYaw.position.z += dz / steps;
                resolveCollisions(rigYaw.position);
            }
        },

        setEnabled: function (on) {
            state.enabled = on;
            if (!on) {
                vel.set(0, 0);
                state.speedFactor = 0;
            }
        },

        onLockChange: function (fn) {
            lockHint = fn;
        },

        lock: function () {
            if (state.locked) {
                return Promise.resolve();
            }
            let result;
            try {
                result = canvas.requestPointerLock({ unadjustedMovement: true });
            } catch (err) {
                result = canvas.requestPointerLock();
            }
            return Promise.resolve(result).catch(function () {
                return Promise.resolve(canvas.requestPointerLock()).catch(function () {});
            });
        },

        unlock: function () {
            if (state.locked) {
                document.exitPointerLock();
            }
        }
    };
}
