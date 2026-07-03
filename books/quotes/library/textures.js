import * as THREE from "three";

// Curated dark-academia leather palette. Raw JSON hues (0-359) are bucketed
// into these so spines read as aged leather rather than bright rainbow.
export const LEATHER_PALETTE = [
    { h: 355, s: 42, l: 26 }, // oxblood
    { h: 342, s: 34, l: 24 }, // burgundy
    { h: 18, s: 40, l: 24 },  // chestnut brown
    { h: 32, s: 44, l: 30 },  // aged tan / amber
    { h: 96, s: 22, l: 22 },  // forest green
    { h: 168, s: 24, l: 20 }, // deep teal-green
    { h: 214, s: 30, l: 24 }, // navy
    { h: 268, s: 20, l: 24 }  // dark plum
];

export function leatherFor(book) {
    const idx = book.hue % LEATHER_PALETTE.length;
    const base = LEATHER_PALETTE[idx];
    const jitter = Math.round(book.spine_seed * 6) - 3;
    return {
        h: base.h,
        s: base.s,
        l: Math.max(14, Math.min(38, base.l + jitter))
    };
}

export function hsl(c, dl = 0, ds = 0) {
    return "hsl(" + c.h + ", " + Math.max(0, c.s + ds) + "%, " +
        Math.max(2, Math.min(96, c.l + dl)) + "%)";
}

// Deterministic PRNG so shelf layouts are stable across loads (and tests).
export function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function makeCanvas(w, h) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    return canvas;
}

function grain(ctx, w, h, count, rng, alpha = 0.05) {
    for (let i = 0; i < count; i++) {
        const dark = rng() < 0.5;
        ctx.fillStyle = dark
            ? "rgba(0, 0, 0, " + alpha + ")"
            : "rgba(255, 235, 200, " + alpha * 0.7 + ")";
        ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 2, 1 + rng() * 2);
    }
}

function asTexture(canvas, repeatX = 1, repeatY = 1) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = 4;
    return tex;
}

// Dark case wood: vertical streaky grain.
export function makeWoodTexture() {
    const w = 256, h = 256;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext("2d");
    const rng = mulberry32(11);
    ctx.fillStyle = "#33200f";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
        const x = rng() * w;
        const light = 10 + rng() * 16;
        ctx.strokeStyle = "hsla(" + (22 + rng() * 10) + ", 42%, " + light + "%, " +
            (0.25 + rng() * 0.4) + ")";
        ctx.lineWidth = 1 + rng() * 3;
        ctx.beginPath();
        ctx.moveTo(x, -8);
        ctx.bezierCurveTo(
            x + (rng() - 0.5) * 14, h * 0.33,
            x + (rng() - 0.5) * 14, h * 0.66,
            x + (rng() - 0.5) * 10, h + 8);
        ctx.stroke();
    }
    grain(ctx, w, h, 500, rng, 0.05);
    return asTexture(canvas);
}

// Floor: dark polished planks running along the corridor (texture v axis).
export function makeFloorTexture() {
    const w = 512, h = 512;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext("2d");
    const rng = mulberry32(23);
    const boardW = 64;
    for (let bx = 0; bx < w; bx += boardW) {
        const l = 9 + rng() * 7;
        ctx.fillStyle = "hsl(" + (20 + rng() * 12) + ", 34%, " + l + "%)";
        ctx.fillRect(bx, 0, boardW, h);
        for (let i = 0; i < 26; i++) {
            ctx.strokeStyle = "hsla(" + (22 + rng() * 8) + ", 40%, " +
                (l + (rng() - 0.4) * 9) + "%, 0.35)";
            ctx.lineWidth = 1 + rng() * 2;
            const sx = bx + rng() * boardW;
            ctx.beginPath();
            ctx.moveTo(sx, -6);
            ctx.bezierCurveTo(sx + (rng() - 0.5) * 8, h * 0.4,
                sx + (rng() - 0.5) * 8, h * 0.7, sx + (rng() - 0.5) * 6, h + 6);
            ctx.stroke();
        }
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        ctx.fillRect(bx, 0, 2, h);
        const seamY = rng() * h;
        ctx.fillRect(bx, seamY, boardW, 2);
    }
    grain(ctx, w, h, 900, rng, 0.04);
    return asTexture(canvas, 3, 14);
}

// Runner rug tile: deep red field, gilt border stripes along the u edges.
export function makeRugTexture() {
    const w = 256, h = 256;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext("2d");
    const rng = mulberry32(37);
    ctx.fillStyle = "hsl(352, 34%, 12%)";
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 2200, rng, 0.06);
    const stripes = [
        { x: 10, w: 3, c: "rgba(198, 160, 92, 0.4)" },
        { x: 18, w: 8, c: "rgba(96, 32, 36, 0.9)" },
        { x: 30, w: 2, c: "rgba(198, 160, 92, 0.3)" }
    ];
    stripes.forEach(function (s) {
        ctx.fillStyle = s.c;
        ctx.fillRect(s.x, 0, s.w, h);
        ctx.fillRect(w - s.x - s.w, 0, s.w, h);
    });
    ctx.save();
    ctx.strokeStyle = "rgba(198, 160, 92, 0.14)";
    ctx.lineWidth = 2;
    for (let y = 32; y < h; y += 64) {
        ctx.beginPath();
        ctx.moveTo(w / 2, y - 18);
        ctx.lineTo(w / 2 + 22, y);
        ctx.lineTo(w / 2, y + 18);
        ctx.lineTo(w / 2 - 22, y);
        ctx.closePath();
        ctx.stroke();
    }
    ctx.restore();
    const tex = asTexture(canvas, 1, 10);
    return tex;
}

// Book spine: leather gradient + grain + gilt bands + vertical title/author.
export function makeSpineTexture(book, colors) {
    const w = 96, h = 384;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext("2d");
    const rng = mulberry32(Math.round(book.spine_seed * 100000) + 7);

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, hsl(colors, -12));
    grad.addColorStop(0.22, hsl(colors, 0));
    grad.addColorStop(0.5, hsl(colors, 9, 4));
    grad.addColorStop(0.78, hsl(colors, 0));
    grad.addColorStop(1, hsl(colors, -12));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 500, rng, 0.06);

    // Raised hub ridges, classic hand-bound spine.
    if (book.spine_seed > 0.45) {
        for (let i = 1; i <= 3; i++) {
            const y = h * (0.2 + i * 0.16);
            ctx.fillStyle = "rgba(255, 230, 190, 0.10)";
            ctx.fillRect(0, y - 3, w, 3);
            ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
            ctx.fillRect(0, y, w, 3);
        }
    }

    // Twin gilt band pairs near head and tail.
    const gilt = "rgba(216, 184, 120, 0.85)";
    [[26, 3], [34, 2], [h - 40, 2], [h - 32, 3]].forEach(function (band) {
        ctx.fillStyle = gilt;
        ctx.fillRect(6, band[0], w - 12, band[1]);
    });

    // Vertical text: title from the head, author right-aligned at the tail.
    ctx.fillStyle = "#e6cd9c";
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    ctx.textBaseline = "middle";

    ctx.save();
    ctx.translate(w * 0.56, 52);
    ctx.rotate(Math.PI / 2);
    ctx.font = "bold 27px Georgia, serif";
    ctx.textAlign = "left";
    const authorFont = "italic 19px Georgia, serif";
    ctx.save();
    ctx.font = authorFont;
    const authorW = ctx.measureText(book.author).width;
    ctx.restore();
    const titleMax = (h - 52 - 56) - authorW - 26;
    let title = book.title;
    while (title.length > 1 && ctx.measureText(title).width > titleMax) {
        title = title.slice(0, -1);
    }
    if (title !== book.title) {
        title = title.replace(/\s+$/, "") + "…";
    }
    ctx.fillText(title, 0, 0);
    ctx.font = authorFont;
    ctx.textAlign = "right";
    ctx.globalAlpha = 0.85;
    ctx.fillText(book.author, h - 52 - 56, 0);
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
}

// Brass year plaque.
export function makePlaqueTexture(year) {
    const w = 256, h = 96;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext("2d");
    const rng = mulberry32(year);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#241509");
    grad.addColorStop(0.5, "#160c05");
    grad.addColorStop(1, "#1e1208");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 260, rng, 0.05);
    ctx.strokeStyle = "rgba(216, 184, 120, 0.9)";
    ctx.lineWidth = 3;
    ctx.strokeRect(7, 7, w - 14, h - 14);
    ctx.strokeStyle = "rgba(216, 184, 120, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = "#e6cd9c";
    ctx.font = "44px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(255, 200, 120, 0.5)";
    ctx.shadowBlur = 10;
    ctx.fillText(String(year).split("").join(" "), w / 2, h / 2 + 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
}

// Soft radial sprite (lamp halos, dust motes).
export function makeGlowTexture(size = 128, inner = "rgba(255, 220, 170, 1)") {
    const canvas = makeCanvas(size, size);
    const ctx = canvas.getContext("2d");
    const grad = ctx.createRadialGradient(
        size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, inner);
    grad.addColorStop(0.35, "rgba(255, 210, 150, 0.35)");
    grad.addColorStop(1, "rgba(255, 200, 130, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// Vertical light-shaft gradient for fake god-ray planes: bright at the top,
// dissolving downward, soft at the horizontal edges.
export function makeRayTexture() {
    const w = 128, h = 256;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext("2d");
    const down = ctx.createLinearGradient(0, 0, 0, h);
    down.addColorStop(0, "rgba(190, 210, 255, 0.9)");
    down.addColorStop(0.55, "rgba(190, 210, 255, 0.25)");
    down.addColorStop(1, "rgba(190, 210, 255, 0)");
    ctx.fillStyle = down;
    ctx.fillRect(0, 0, w, h);
    const across = ctx.createLinearGradient(0, 0, w, 0);
    across.addColorStop(0, "rgba(0, 0, 0, 1)");
    across.addColorStop(0.25, "rgba(0, 0, 0, 0)");
    across.addColorStop(0.75, "rgba(0, 0, 0, 0)");
    across.addColorStop(1, "rgba(0, 0, 0, 1)");
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = across;
    ctx.fillRect(0, 0, w, h);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}
