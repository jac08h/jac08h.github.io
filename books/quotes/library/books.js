import * as THREE from "three";
import { leatherFor, makeSpineTexture, mulberry32 } from "./textures.js";
import { HALL } from "./hall.js";

const BOOK_DEPTH = 0.235;

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitPlane = new THREE.PlaneGeometry(1, 1);
const coverMaterials = new Map();

function coverMaterialFor(colors) {
    const key = colors.h + "/" + colors.s + "/" + colors.l;
    if (!coverMaterials.has(key)) {
        const mat = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.0 });
        mat.color.setHSL(colors.h / 360, colors.s / 100, colors.l / 100);
        coverMaterials.set(key, mat);
    }
    return coverMaterials.get(key);
}

function realBookDims(book) {
    return {
        th: 0.046 + book.spine_seed * 0.028,
        ht: 0.30 + book.spine_seed * 0.16
    };
}

// Splits n books into per-row chunks, balanced across the shelf rows.
function rowCounts(n, rows) {
    const base = Math.floor(n / rows);
    const extra = n % rows;
    const counts = [];
    for (let r = 0; r < rows; r++) {
        counts.push(base + (r < extra ? 1 : 0));
    }
    return counts;
}

function makeRealBook(book, dims) {
    const colors = leatherFor(book);
    const group = new THREE.Group();

    const body = new THREE.Mesh(unitBox, coverMaterialFor(colors));
    body.scale.set(dims.th, dims.ht, BOOK_DEPTH);
    body.position.z = -BOOK_DEPTH / 2;
    group.add(body);

    const spine = new THREE.Mesh(unitPlane, new THREE.MeshStandardMaterial({
        map: makeSpineTexture(book, colors), roughness: 0.55, metalness: 0.0
    }));
    spine.scale.set(dims.th * 0.985, dims.ht * 0.985, 1);
    spine.position.z = 0.002;
    group.add(spine);

    return group;
}

// Fills one shelf row: interleaves this row's real books among fillers with
// occasional gaps and leaning fillers. Returns any real books that did not
// fit, for overflow placement on the next row.
function fillRow(innerW, reals, rng, onReal, onFiller) {
    const xEnd = innerW / 2 - 0.05;
    let cursor = -innerW / 2 + 0.05;
    let realIdx = 0;
    let leanNext = 0;

    while (cursor < xEnd - 0.08) {
        const remainingSlots = Math.max(1, (xEnd - cursor) / 0.08);
        const remainingReals = reals.length - realIdx;
        const takeReal = remainingReals > 0 &&
            rng() < remainingReals / remainingSlots;

        if (takeReal) {
            const book = reals[realIdx++];
            const dims = realBookDims(book);
            if (cursor + dims.th > xEnd) {
                break;
            }
            onReal(book, dims, cursor + dims.th / 2);
            cursor += dims.th + 0.004;
            leanNext = 0;
        } else {
            const th = 0.04 + rng() * 0.03;
            const ht = 0.27 + rng() * 0.18;
            if (cursor + th > xEnd) {
                break;
            }
            onFiller(th, ht, cursor + th / 2, leanNext);
            cursor += th + 0.004 + Math.abs(leanNext) * ht * 0.9;
            leanNext = 0;
        }

        if (rng() < 0.035) {
            const gap = 0.025 + rng() * 0.075;
            cursor += gap;
            if (rng() < 0.55) {
                leanNext = -(0.06 + rng() * 0.09);
            }
        }
    }
    return reals.slice(realIdx);
}

// Places all real and filler books into the bays. Returns interactive book
// records (ordered by bay, then shelf row, then position) and the meshes to
// raycast against.
export function buildBooks(scene, bays, decorBays, booksData) {
    const byYear = {};
    booksData.forEach(function (book) {
        (byYear[book.year] = byYear[book.year] || []).push(book);
    });

    const records = [];
    const raycastTargets = [];
    const fillers = [];
    const rng = mulberry32(2017);
    const bookFrontZ = HALL.caseDepth / 2 - 0.03;

    function placeBay(bay, reals) {
        const innerW = bay.width - 0.3;
        const counts = rowCounts(reals.length, HALL.rowBottoms.length);
        let offset = 0;
        let overflow = [];

        HALL.rowBottoms.forEach(function (rowY, r) {
            let rowReals = reals.slice(offset, offset + counts[r]);
            offset += counts[r];
            rowReals = overflow.concat(rowReals);
            overflow = fillRow(innerW, rowReals, rng,
                function onReal(book, dims, x) {
                    const group = makeRealBook(book, dims);
                    group.position.set(x, rowY + dims.ht / 2, bookFrontZ);
                    bay.group.add(group);
                    const record = { book: book, bay: bay, group: group };
                    group.traverse(function (child) {
                        child.userData.record = record;
                    });
                    records.push(record);
                    raycastTargets.push(group.children[0]);
                },
                function onFiller(th, ht, x, lean) {
                    fillers.push({
                        bay: bay, th: th, ht: ht, x: x,
                        y: rowY + ht / 2 + Math.abs(lean) * th * 0.4,
                        z: bookFrontZ - 0.01 - rng() * 0.02,
                        lean: lean
                    });
                });
        });
        return overflow;
    }

    let leftover = [];
    bays.forEach(function (bay) {
        leftover = leftover.concat(placeBay(bay, byYear[bay.year] || []));
    });
    if (leftover.length > 0) {
        console.warn("Library: " + leftover.length + " books did not fit shelves");
    }

    decorBays.forEach(function (bay) {
        placeBay(bay, []);
    });

    // All fillers in one InstancedMesh, world-space transforms. Fillers are
    // near-black so the real, colored books carry the shelves.
    const fillerMat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.0 });
    const instanced = new THREE.InstancedMesh(unitBox, fillerMat, fillers.length);
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const leanQuat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    const zAxis = new THREE.Vector3(0, 0, 1);

    fillers.forEach(function (f, i) {
        f.bay.group.updateMatrixWorld(true);
        pos.set(f.x, f.y, f.z - 0.11);
        f.bay.group.localToWorld(pos);
        quat.copy(f.bay.group.quaternion);
        if (f.lean !== 0) {
            leanQuat.setFromAxisAngle(zAxis, f.lean);
            quat.multiply(leanQuat);
        }
        scale.set(f.th, f.ht, 0.21 + rng() * 0.025);
        matrix.compose(pos, quat, scale);
        instanced.setMatrixAt(i, matrix);

        color.setHSL((20 + rng() * 20) / 360, 0.05 + rng() * 0.05,
            0.012 + rng() * 0.022);
        instanced.setColorAt(i, color);
    });
    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) {
        instanced.instanceColor.needsUpdate = true;
    }
    scene.add(instanced);

    return { records: records, raycastTargets: raycastTargets };
}
