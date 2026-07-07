// Procedural sound for the library: footsteps synced to the walk cycle plus
// an ambient room bed (low tone + periodic clock tick). Everything is
// synthesized with the WebAudio API so there are no asset files to ship.
//
// A single AudioContext is created lazily on the first user gesture (browsers
// block audio before one). Footsteps are short filtered-noise thuds with a
// little pitch/timing jitter; on the rug they are quieter and duller.

export function createAudio() {
    let ctx = null;
    let master = null;
    let noiseBuffer = null;
    let ambient = null;
    let enabled = false;

    function ensureContext() {
        if (ctx) {
            return;
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) {
            return;
        }
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.0;
        master.connect(ctx.destination);
        noiseBuffer = makeNoiseBuffer(ctx);
    }

    function makeNoiseBuffer(context) {
        const len = Math.floor(context.sampleRate * 0.3);
        const buffer = context.createBuffer(1, len, context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    // One footstep: a burst of noise through a lowpass, enveloped to a short
    // thud. `soft` (on the rug) drops the gain and the cutoff so it's muffled.
    function playStep(soft) {
        if (!ctx || !enabled) {
            return;
        }
        const now = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        src.playbackRate.value = 0.85 + Math.random() * 0.3;

        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = soft ? 520 : 1400;
        lp.Q.value = 0.7;

        const gain = ctx.createGain();
        const peak = (soft ? 0.16 : 0.34) * (0.85 + Math.random() * 0.3);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(peak, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + (soft ? 0.14 : 0.2));

        src.connect(lp);
        lp.connect(gain);
        gain.connect(master);
        src.start(now);
        src.stop(now + 0.3);
    }

    // Ambient bed: a very low sustained tone for room presence plus a dry
    // clock tick every second. Kept quiet — it sits under the footsteps.
    function startAmbient() {
        if (!ctx || ambient) {
            return;
        }
        const bed = ctx.createGain();
        bed.gain.value = 0.06;
        bed.connect(master);

        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = 54;
        const oscGain = ctx.createGain();
        oscGain.gain.value = 0.5;
        osc.connect(oscGain);
        oscGain.connect(bed);
        osc.start();

        const tickTimer = window.setInterval(function () {
            playTick();
        }, 1000);

        ambient = { bed: bed, osc: osc, tickTimer: tickTimer };
    }

    // A short high-passed click for the wall clock.
    function playTick() {
        if (!ctx || !enabled) {
            return;
        }
        const now = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 2600;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.05, now + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
        src.connect(hp);
        hp.connect(gain);
        gain.connect(master);
        src.start(now);
        src.stop(now + 0.06);
    }

    return {
        // Called from a user gesture (entering the library). Unlocks the
        // context, fades the master in and starts the ambient bed.
        enable: function () {
            ensureContext();
            if (!ctx) {
                return;
            }
            if (ctx.state === "suspended") {
                ctx.resume();
            }
            enabled = true;
            const now = ctx.currentTime;
            master.gain.cancelScheduledValues(now);
            master.gain.setValueAtTime(master.gain.value, now);
            master.gain.linearRampToValueAtTime(0.9, now + 0.6);
            startAmbient();
        },

        // Fade out and suspend (e.g. on pause / overlay open).
        setMuted: function (muted) {
            if (!ctx) {
                return;
            }
            const now = ctx.currentTime;
            master.gain.cancelScheduledValues(now);
            master.gain.setValueAtTime(master.gain.value, now);
            master.gain.linearRampToValueAtTime(muted ? 0.0 : 0.9, now + 0.25);
        },

        step: playStep
    };
}
