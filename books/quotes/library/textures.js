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

// Brass year plaque. side (-1 left / +1 right, optional) adds a small
// triangle pointing at the shelf face the plaque belongs to.
export function makePlaqueTexture(year, side) {
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
    if (side) {
        const tipX = side < 0 ? 26 : w - 26;
        const baseX = side < 0 ? 44 : w - 44;
        ctx.beginPath();
        ctx.moveTo(tipX, h / 2);
        ctx.lineTo(baseX, h / 2 - 11);
        ctx.lineTo(baseX, h / 2 + 11);
        ctx.closePath();
        ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
}

// Trouser cloth: dark warm weave with fine diagonal thread streaks and a few
// soft vertical fold shadows. Tiled along the leg tube; muted so it never
// reads louder than the library wood.
export function makeTrouserTexture() {
    const w = 256, h = 256;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext("2d");
    const rng = mulberry32(71);
    ctx.fillStyle = "#8a7256";
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1;
    for (let i = 0; i < 340; i++) {
        const x = rng() * w;
        const y = rng() * h;
        const len = 6 + rng() * 10;
        const dark = rng() < 0.5;
        ctx.strokeStyle = dark
            ? "rgba(0, 0, 0, " + (0.06 + rng() * 0.07) + ")"
            : "rgba(200, 172, 130, " + (0.06 + rng() * 0.07) + ")";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len, y + len);
        ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
        const x = rng() * w;
        const grad = ctx.createLinearGradient(x - 12, 0, x + 12, 0);
        grad.addColorStop(0, "rgba(0, 0, 0, 0)");
        grad.addColorStop(0.5, "rgba(0, 0, 0, " + (0.1 + rng() * 0.12) + ")");
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(x - 12, 0, 24, h);
    }
    grain(ctx, w, h, 700, rng, 0.04);
    return asTexture(canvas, 1, 2);
}

// Shoe leather: near-black with a faint uneven sheen and creased toe streaks.
export function makeLeatherTexture() {
    const w = 128, h = 128;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext("2d");
    const rng = mulberry32(83);
    ctx.fillStyle = "#8f857a";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
        const x = rng() * w;
        const y = rng() * h;
        const r = 6 + rng() * 18;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, "rgba(220, 210, 200, " + (0.06 + rng() * 0.08) + ")");
        grad.addColorStop(1, "rgba(220, 210, 200, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 60; i++) {
        ctx.strokeStyle = "rgba(0, 0, 0, " + (0.1 + rng() * 0.15) + ")";
        ctx.beginPath();
        const x = rng() * w;
        const y = rng() * h;
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rng() - 0.5) * 14, y + (rng() - 0.5) * 6);
        ctx.stroke();
    }
    grain(ctx, w, h, 300, rng, 0.05);
    return asTexture(canvas, 1, 1);
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

// Upper-wall plaster: warm, aged, faintly mottled so the walls read as a
// surface (not a flat colour) at room distances under bloom.
export function makeWallTexture() {
    const w = 256, h = 256;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext("2d");
    const rng = mulberry32(61);
    ctx.fillStyle = "#5a4630";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 240; i++) {
        const r = 6 + rng() * 34;
        const l = 24 + rng() * 14;
        ctx.fillStyle = "hsla(" + (26 + rng() * 12) + ", 30%, " + l + "%, 0.06)";
        ctx.beginPath();
        ctx.arc(rng() * w, rng() * h, r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
        const x = rng() * w;
        ctx.beginPath();
        ctx.moveTo(x, rng() * h * 0.2);
        ctx.lineTo(x + (rng() - 0.5) * 30, h * (0.6 + rng() * 0.4));
        ctx.stroke();
    }
    grain(ctx, w, h, 700, rng, 0.05);
    return asTexture(canvas, 4, 2);
}

// Wainscot / panelling wood: horizontal-friendly darker grain for the lower
// wall dado. Distinct hue from the case wood so panelling reads as joinery.
export function makePanelTexture() {
    const w = 256, h = 256;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext("2d");
    const rng = mulberry32(43);
    ctx.fillStyle = "#2a1a0d";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) {
        const y = rng() * h;
        const light = 8 + rng() * 12;
        ctx.strokeStyle = "hsla(" + (24 + rng() * 10) + ", 40%, " + light + "%, " +
            (0.2 + rng() * 0.35) + ")";
        ctx.lineWidth = 1 + rng() * 2;
        ctx.beginPath();
        ctx.moveTo(-8, y);
        ctx.bezierCurveTo(
            w * 0.33, y + (rng() - 0.5) * 12,
            w * 0.66, y + (rng() - 0.5) * 12,
            w + 8, y + (rng() - 0.5) * 8);
        ctx.stroke();
    }
    grain(ctx, w, h, 500, rng, 0.05);
    return asTexture(canvas);
}

// Framed picture: an aged mezzotint-ish portrait/landscape suggestion inside a
// mount. Deliberately dim and low-contrast so it reads as decor, not signage.
export function makePictureTexture(seed) {
    const w = 200, h = 256;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext("2d");
    const rng = mulberry32(seed >>> 0);
    ctx.fillStyle = "#0d0a07";
    ctx.fillRect(0, 0, w, h);
    const grad = ctx.createRadialGradient(
        w / 2, h * 0.42, 8, w / 2, h * 0.42, h * 0.6);
    grad.addColorStop(0, "hsl(" + (28 + rng() * 14) + ", 28%, 20%)");
    grad.addColorStop(0.6, "hsl(" + (26 + rng() * 10) + ", 24%, 11%)");
    grad.addColorStop(1, "#0a0705");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    if (rng() < 0.5) {
        ctx.fillStyle = "rgba(20, 14, 9, 0.7)";
        ctx.beginPath();
        ctx.ellipse(w / 2, h * 0.5, w * 0.22, h * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "hsla(" + (30 + rng() * 12) + ", 22%, 24%, 0.5)";
        ctx.beginPath();
        ctx.ellipse(w / 2, h * 0.4, w * 0.11, h * 0.13, 0, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.strokeStyle = "hsla(30, 20%, 22%, 0.5)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            const y = h * (0.55 + i * 0.08);
            ctx.beginPath();
            ctx.moveTo(0, y);
            for (let x = 0; x <= w; x += 20) {
                ctx.lineTo(x, y - Math.sin(x * 0.05 + i) * 6 * rng());
            }
            ctx.stroke();
        }
    }
    grain(ctx, w, h, 900, rng, 0.06);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
}

// Sconce emissive plate: a warm glowing lozenge on a dark backing, used with
// MeshBasicMaterial (fog off) so bloom picks it up as a light fixture without a
// real PointLight.
export function makeSconceTexture() {
    const size = 128;
    const canvas = makeCanvas(size, size);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, size, size);
    const grad = ctx.createRadialGradient(
        size / 2, size * 0.44, 2, size / 2, size * 0.44, size * 0.5);
    grad.addColorStop(0, "rgba(255, 226, 170, 1)");
    grad.addColorStop(0.4, "rgba(255, 180, 110, 0.75)");
    grad.addColorStop(1, "rgba(60, 30, 10, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(size / 2, size * 0.44, size * 0.24, size * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}
