import * as THREE from "three";

const SLIDE_TIME = 0.22;
const FLY_TIME = 0.4;
const RETURN_TIME = 0.65;
const SLIDE_DIST = 0.26;
// Start the overlay opening before the book fully arrives, so its fade
// overlaps the tail of the flight and the quote reads sooner after the click.
const OPEN_AT = 0.62;

function easeInOut(k) {
    const c = THREE.MathUtils.clamp(k, 0, 1);
    return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

// The grab interaction: slide the aimed book off its shelf, fly it to the
// face, hand over to the reading overlay, and return it to its slot on
// close. The book group is reparented to the scene while it travels; its
// original parent and local transform are stored so the return puts it back
// exactly.
export function createGrab(scene, camera, player, overlay, onReturned, siblingsFor) {
    let state = "idle";
    let t = 0;
    let record = null;
    let restore = null;
    let instant = false;
    let overlayOpened = false;

    const faceNormal = new THREE.Vector3();
    const slideStart = new THREE.Vector3();
    const flyStartPos = new THREE.Vector3();
    const flyStartQuat = new THREE.Quaternion();
    const returnStartPos = new THREE.Vector3();
    const returnStartQuat = new THREE.Quaternion();
    const homePos = new THREE.Vector3();
    const homeQuat = new THREE.Quaternion();
    const holdPos = new THREE.Vector3();
    const holdQuat = new THREE.Quaternion();
    const holdOffset = new THREE.Vector3(0.13, -0.11, -0.42);
    const holdTilt = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-0.12, 0.28, 0.06));

    function computeHoldPose() {
        camera.updateMatrixWorld(true);
        holdPos.copy(holdOffset).applyMatrix4(camera.matrixWorld);
        camera.getWorldQuaternion(holdQuat);
        holdQuat.multiply(holdTilt);
    }

    // `restPose`, when given, is the book's true shelf-local {position,
    // quaternion} (pre-detach local frame) to return to on close — used when
    // the book is mid- or fully popped at grab time, so the return animation
    // still targets the exact unpopped slot rather than wherever the pop
    // left it. The fly animation itself starts from the group's current
    // (possibly popped) transform, captured by the caller before this runs.
    function detach(restPose) {
        const group = record.group;
        group.updateMatrixWorld(true);
        restore = {
            parent: group.parent,
            position: restPose ? restPose.position.clone() : group.position.clone(),
            quaternion: restPose ? restPose.quaternion.clone() : group.quaternion.clone()
        };
        // Face normal for the initial slide-out is derived from the true
        // shelf rest pose (not the current, possibly tilted, popped pose)
        // so the slide direction matches what an ungrabbed book would use.
        const restWorldQuat = restPose
            ? group.parent.getWorldQuaternion(new THREE.Quaternion()).multiply(restPose.quaternion)
            : group.getWorldQuaternion(new THREE.Quaternion());
        faceNormal.set(0, 0, 1).applyQuaternion(restWorldQuat);
        scene.attach(group);
    }

    function reattach() {
        const group = record.group;
        restore.parent.add(group);
        group.position.copy(restore.position);
        group.quaternion.copy(restore.quaternion);
        restore = null;
    }

    function computeHomePose() {
        restore.parent.updateMatrixWorld(true);
        homePos.copy(restore.position)
            .applyMatrix4(restore.parent.matrixWorld);
        restore.parent.getWorldQuaternion(homeQuat)
            .multiply(restore.quaternion);
    }

    function finishReturn() {
        reattach();
        state = "idle";
        record = null;
        onReturned();
    }

    function onOverlayClosed() {
        if (instant) {
            finishReturn();
            return;
        }
        record.group.getWorldPosition(returnStartPos);
        record.group.getWorldQuaternion(returnStartQuat);
        computeHomePose();
        state = "returning";
        t = 0;
    }

    // Reveal the reading overlay and free the mouse. Called once, either
    // partway through the flight (so the fade overlaps arrival) or, for the
    // instant test path, immediately.
    function openOverlay() {
        if (overlayOpened) {
            return;
        }
        overlayOpened = true;
        const sibs = siblingsFor ? siblingsFor(record.book) : null;
        overlay.open(record.book, onOverlayClosed, sibs);
        player.unlock();
    }

    return {
        state: function () {
            return state;
        },

        isIdle: function () {
            return state === "idle";
        },

        // `restPose`: optional {position, quaternion} in the pre-detach
        // local frame — the true shelf slot to return to. Pass this when the
        // book may currently be sitting in a popped (or mid-retract) pose,
        // so the fly-out starts from wherever it visually is right now while
        // the close animation still lands it flush in its slot.
        begin: function (rec, restPose) {
            if (state !== "idle" || overlay.isOpen()) {
                return false;
            }
            record = rec;
            instant = false;
            overlayOpened = false;
            player.setEnabled(false);
            detach(restPose);
            slideStart.copy(record.group.position);
            state = "sliding";
            t = 0;
            return true;
        },

        // Test path: skip the animation, put the book straight into the
        // hold pose and open the overlay.
        openInstant: function (rec, restPose) {
            if (state !== "idle" || overlay.isOpen()) {
                return false;
            }
            record = rec;
            instant = true;
            overlayOpened = false;
            player.setEnabled(false);
            player.rigYaw.updateMatrixWorld(true);
            detach(restPose);
            computeHoldPose();
            record.group.position.copy(holdPos);
            record.group.quaternion.copy(holdQuat);
            state = "holding";
            openOverlay();
            return true;
        },

        update: function (dt) {
            if (state === "idle") {
                return;
            }
            t += dt;

            if (state === "sliding") {
                const k = easeInOut(t / SLIDE_TIME);
                record.group.position.copy(slideStart)
                    .addScaledVector(faceNormal, SLIDE_DIST * k);
                if (t >= SLIDE_TIME) {
                    flyStartPos.copy(record.group.position);
                    flyStartQuat.copy(record.group.quaternion);
                    state = "flying";
                    t = 0;
                }
            } else if (state === "flying") {
                const k = easeInOut(t / FLY_TIME);
                computeHoldPose();
                record.group.position.lerpVectors(flyStartPos, holdPos, k);
                record.group.quaternion.slerpQuaternions(
                    flyStartQuat, holdQuat, k);
                if (t / FLY_TIME >= OPEN_AT) {
                    openOverlay();
                }
                if (t >= FLY_TIME) {
                    state = "holding";
                }
            } else if (state === "holding") {
                computeHoldPose();
                record.group.position.copy(holdPos);
                record.group.quaternion.copy(holdQuat);
            } else if (state === "returning") {
                const k = easeInOut(t / RETURN_TIME);
                record.group.position.lerpVectors(returnStartPos, homePos, k);
                record.group.quaternion.slerpQuaternions(
                    returnStartQuat, homeQuat, k);
                if (t >= RETURN_TIME) {
                    finishReturn();
                }
            }
        }
    };
}
