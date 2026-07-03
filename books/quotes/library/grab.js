import * as THREE from "three";

const REACH_TIME = 0.45;
const SLIDE_TIME = 0.28;
const FLY_TIME = 0.5;
const RETURN_TIME = 0.65;
const SLIDE_DIST = 0.26;

function easeInOut(k) {
    const c = THREE.MathUtils.clamp(k, 0, 1);
    return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

// The grab interaction: reach out with the right arm, slide the aimed book
// off its shelf, fly it to the face, hand over to the reading overlay, and
// return it to its slot on close. The book group is reparented to the scene
// while it travels; its original parent and local transform are stored so
// the return puts it back exactly.
export function createGrab(scene, camera, player, body, overlay, onReturned) {
    let state = "idle";
    let t = 0;
    let record = null;
    let restore = null;
    let instant = false;

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
    const ikTarget = new THREE.Vector3();
    const tmp = new THREE.Vector3();

    function computeHoldPose() {
        camera.updateMatrixWorld(true);
        holdPos.copy(holdOffset).applyMatrix4(camera.matrixWorld);
        camera.getWorldQuaternion(holdQuat);
        holdQuat.multiply(holdTilt);
    }

    function armToWorldPoint(worldPoint, blend) {
        ikTarget.copy(worldPoint);
        player.rigPitch.worldToLocal(ikTarget);
        body.setArmIK(1, ikTarget.clone(), blend);
    }

    function grabPointWorld(target) {
        record.group.getWorldPosition(target);
        return target.addScaledVector(faceNormal, 0.03);
    }

    function detach() {
        const group = record.group;
        group.updateMatrixWorld(true);
        restore = {
            parent: group.parent,
            position: group.position.clone(),
            quaternion: group.quaternion.clone()
        };
        faceNormal.set(0, 0, 1)
            .applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion()));
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
        body.setArmIK(1, null, 0);
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

    function openOverlay() {
        state = "holding";
        overlay.open(record.book, onOverlayClosed);
        player.unlock();
    }

    return {
        state: function () {
            return state;
        },

        isIdle: function () {
            return state === "idle";
        },

        begin: function (rec) {
            if (state !== "idle" || overlay.isOpen()) {
                return false;
            }
            record = rec;
            instant = false;
            state = "reaching";
            t = 0;
            player.setEnabled(false);
            return true;
        },

        // Test path: skip the animation, put the book straight into the
        // hold pose and open the overlay.
        openInstant: function (rec) {
            if (state !== "idle" || overlay.isOpen()) {
                return false;
            }
            record = rec;
            instant = true;
            player.setEnabled(false);
            player.rigYaw.updateMatrixWorld(true);
            detach();
            computeHoldPose();
            record.group.position.copy(holdPos);
            record.group.quaternion.copy(holdQuat);
            openOverlay();
            return true;
        },

        update: function (dt) {
            if (state === "idle") {
                return;
            }
            t += dt;

            if (state === "reaching") {
                const k = easeInOut(t / REACH_TIME);
                record.group.updateMatrixWorld(true);
                faceNormal.set(0, 0, 1).applyQuaternion(
                    record.group.getWorldQuaternion(new THREE.Quaternion()));
                armToWorldPoint(grabPointWorld(tmp), k);
                if (t >= REACH_TIME) {
                    detach();
                    slideStart.copy(record.group.position);
                    state = "sliding";
                    t = 0;
                }
            } else if (state === "sliding") {
                const k = easeInOut(t / SLIDE_TIME);
                record.group.position.copy(slideStart)
                    .addScaledVector(faceNormal, SLIDE_DIST * k);
                armToWorldPoint(grabPointWorld(tmp), 1);
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
                armToWorldPoint(record.group.position, 1);
                if (t >= FLY_TIME) {
                    openOverlay();
                }
            } else if (state === "holding") {
                computeHoldPose();
                record.group.position.copy(holdPos);
                record.group.quaternion.copy(holdQuat);
                armToWorldPoint(record.group.position, 1);
            } else if (state === "returning") {
                const k = easeInOut(t / RETURN_TIME);
                record.group.position.lerpVectors(returnStartPos, homePos, k);
                record.group.quaternion.slerpQuaternions(
                    returnStartQuat, homeQuat, k);
                armToWorldPoint(record.group.position, 1 - k);
                if (t >= RETURN_TIME) {
                    finishReturn();
                }
            }
        }
    };
}
