const LOOK_SENSITIVITY = 0.003;
const TAP_DISTANCE = 10;
const TAP_DURATION = 300;
const STICK_RADIUS = 56;

// Touch input is deliberately separate from the player controller: it turns
// pointer gestures into the same look and movement values used by desktop.
export function createTouchController(canvas, player, joystickEl, onTap) {
    const base = joystickEl.querySelector(".joystick-base");
    const thumb = joystickEl.querySelector(".joystick-thumb");
    let look = null;
    let stick = null;
    let stickVector = { x: 0, y: 0 };

    function inStickZone(event) {
        return event.clientX < window.innerWidth * 0.5 &&
            event.clientY > window.innerHeight * 0.45;
    }

    function setStick(dx, dy) {
        const length = Math.hypot(dx, dy);
        const scale = length > STICK_RADIUS ? STICK_RADIUS / length : 1;
        const x = dx * scale;
        const y = dy * scale;
        thumb.style.transform = "translate(" + x + "px, " + y + "px)";
        player.injectMove(x / STICK_RADIUS, -y / STICK_RADIUS);
        stickVector = { x: x / STICK_RADIUS, y: -y / STICK_RADIUS };
    }

    function resetStick() {
        stick = null;
        player.injectMove(0, 0);
        stickVector = { x: 0, y: 0 };
        joystickEl.classList.remove("visible");
        thumb.style.transform = "translate(0, 0)";
    }

    function onDown(event) {
        if (!player.state.engaged || event.pointerType === "mouse") {
            return;
        }
        event.preventDefault();
        canvas.setPointerCapture(event.pointerId);
        if (!stick && inStickZone(event)) {
            stick = { id: event.pointerId, x: event.clientX, y: event.clientY };
            base.style.left = event.clientX + "px";
            base.style.top = event.clientY + "px";
            joystickEl.classList.add("visible");
            setStick(0, 0);
        } else if (!look) {
            look = {
                id: event.pointerId, x: event.clientX, y: event.clientY,
                startX: event.clientX, startY: event.clientY, time: performance.now()
            };
        }
    }

    function onMove(event) {
        if (stick && event.pointerId === stick.id) {
            event.preventDefault();
            setStick(event.clientX - stick.x, event.clientY - stick.y);
        } else if (look && event.pointerId === look.id) {
            event.preventDefault();
            player.injectLook(
                -(event.clientX - look.x) * LOOK_SENSITIVITY,
                -(event.clientY - look.y) * LOOK_SENSITIVITY);
            look.x = event.clientX;
            look.y = event.clientY;
        }
    }

    function onUp(event) {
        if (stick && event.pointerId === stick.id) {
            resetStick();
        } else if (look && event.pointerId === look.id) {
            const distance = Math.hypot(event.clientX - look.startX, event.clientY - look.startY);
            if (distance < TAP_DISTANCE && performance.now() - look.time < TAP_DURATION) {
                onTap(event.clientX, event.clientY);
            }
            look = null;
        }
    }

    canvas.addEventListener("pointerdown", onDown, { passive: false });
    canvas.addEventListener("pointermove", onMove, { passive: false });
    canvas.addEventListener("pointerup", onUp, { passive: false });
    canvas.addEventListener("pointercancel", onUp, { passive: false });

    return {
        state: function () {
            return { x: Number(stickVector.x.toFixed(2)), y: Number(stickVector.y.toFixed(2)) };
        },
        destroy: function () {
            canvas.removeEventListener("pointerdown", onDown);
            canvas.removeEventListener("pointermove", onMove);
            canvas.removeEventListener("pointerup", onUp);
            canvas.removeEventListener("pointercancel", onUp);
        }
    };
}
