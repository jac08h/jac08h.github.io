(function () {
    "use strict";

    const fieldEl = document.getElementById("field");
    const loadingEl = document.getElementById("loading");
    const backdropEl = document.getElementById("backdrop");
    const focusedEl = document.getElementById("focused");
    const focusedTextEl = document.getElementById("focused-text");
    const focusedCaptionEl = document.getElementById("focused-caption");
    const closeBtn = document.getElementById("close-btn");

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    const ACTIVE_COUNT = isMobile ? 14 : 34;
    const PARALLAX = !isMobile && !reduceMotion;

    let pool = [];
    let queue = [];
    let queuePos = 0;
    let notes = [];
    let running = false;
    let mouseX = 0;
    let mouseY = 0;
    let focusedNote = null;

    fetch("../data/quotes.json")
        .then(function (resp) {
            if (!resp.ok) {
                throw new Error("Failed to load quotes.json: " + resp.status);
            }
            return resp.json();
        })
        .then(function (data) {
            buildPool(data.books);
            start();
        })
        .catch(function (err) {
            loadingEl.textContent = "Could not load quotes. " + err.message;
        });

    function buildPool(books) {
        books.forEach(function (book) {
            book.quotes.forEach(function (text) {
                pool.push({
                    text: text,
                    author: book.author,
                    title: book.title,
                    year: book.year
                });
            });
        });
        queue = shuffle(pool.slice());
    }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }
        return arr;
    }

    function nextQuote() {
        if (queuePos >= queue.length) {
            queue = shuffle(pool.slice());
            queuePos = 0;
        }
        const quote = queue[queuePos];
        queuePos += 1;
        return quote;
    }

    function start() {
        loadingEl.remove();
        for (let i = 0; i < ACTIVE_COUNT; i++) {
            notes.push(createNote(true));
        }
        running = true;
        if (!reduceMotion) {
            requestAnimationFrame(loop);
        } else {
            notes.forEach(writeStatic);
        }
    }

    function createNote(initial) {
        const el = document.createElement("div");
        el.className = "note";

        const textEl = document.createElement("p");
        textEl.className = "note-text";
        const captionEl = document.createElement("p");
        captionEl.className = "note-caption";
        el.appendChild(textEl);
        el.appendChild(captionEl);

        const note = {
            el: el,
            textEl: textEl,
            captionEl: captionEl,
            paused: false,
            data: null,
            x: 0,
            y: 0,
            baseX: 0,
            baseY: 0,
            z: 0,
            phase: 0,
            bobAmp: 0,
            rotAmp: 0,
            rotPhase: 0,
            speedY: 0,
            width: 220
        };

        assignQuote(note, initial);

        el.addEventListener("mouseenter", function () {
            if (focusedNote) {
                return;
            }
            note.paused = true;
            el.classList.add("paused");
            el.style.zIndex = "6";
            el.style.transform = "translate(" + note.baseX + "px," + note.baseY +
                "px) scale(" + (noteScale(note) * 1.08).toFixed(3) + ") rotate(0deg)";
        });
        el.addEventListener("mouseleave", function () {
            if (focusedNote === note) {
                return;
            }
            note.paused = false;
            el.classList.remove("paused");
            el.style.zIndex = "";
        });
        el.addEventListener("click", function () {
            focusNote(note);
        });

        fieldEl.appendChild(el);
        return note;
    }

    function assignQuote(note, initial) {
        const data = nextQuote();
        note.data = data;
        note.textEl.textContent = data.text;
        note.captionEl.textContent = data.author + " – " + data.title + ", " + data.year;

        const w = window.innerWidth;
        const h = window.innerHeight;
        note.width = isMobile ? 180 : 220;
        note.z = Math.random();
        note.baseX = Math.random() * Math.max(1, w - note.width - 40) + 20;
        if (initial) {
            note.baseY = Math.random() * Math.max(1, h - 220) + 20;
        } else {
            note.baseY = h + 40;
        }
        note.x = note.baseX;
        note.y = note.baseY;
        note.phase = Math.random() * Math.PI * 2;
        note.rotPhase = Math.random() * Math.PI * 2;
        note.bobAmp = 8 + note.z * 14;
        note.rotAmp = 2 + note.z * 2;
        note.speedY = (6 + note.z * 10) / 1000;

        applyDepth(note);
        note.el.classList.remove("fading");
        if (!initial) {
            note.el.style.opacity = "0";
            requestAnimationFrame(function () {
                note.el.classList.add("appear");
                note.el.style.opacity = note.targetOpacity.toFixed(2);
            });
        }
    }

    function applyDepth(note) {
        note.targetOpacity = 0.55 + note.z * 0.45;
        const blur = (1 - note.z) * 1.4;
        note.el.style.opacity = note.targetOpacity.toFixed(2);
        note.el.style.filter = blur > 0.15 ? "blur(" + blur.toFixed(2) + "px)" : "none";
    }

    function noteScale(note) {
        return 0.7 + note.z * 0.35;
    }

    function writeStatic(note) {
        const scale = noteScale(note);
        note.el.style.transform = "translate(" + note.baseX + "px," + note.baseY +
            "px) scale(" + scale.toFixed(3) + ") rotate(0deg)";
    }

    function loop(now) {
        if (!running) {
            return;
        }
        const t = now / 1000;
        const h = window.innerHeight;

        for (let i = 0; i < notes.length; i++) {
            const note = notes[i];
            if (note.paused || focusedNote === note) {
                continue;
            }

            note.baseY -= note.speedY * 16;
            const bob = Math.sin(t * 0.6 + note.phase) * note.bobAmp;
            const rot = Math.sin(t * 0.4 + note.rotPhase) * note.rotAmp;
            const drift = Math.sin(t * 0.15 + note.phase) * 12;

            let px = 0;
            let py = 0;
            if (PARALLAX) {
                px = mouseX * note.z * 0.02;
                py = mouseY * note.z * 0.02;
            }

            const scale = noteScale(note);
            note.x = note.baseX + drift + px;
            note.y = note.baseY + bob + py;

            note.el.style.transform = "translate(" + note.x.toFixed(1) + "px," +
                note.y.toFixed(1) + "px) scale(" + scale.toFixed(3) + ") rotate(" +
                rot.toFixed(2) + "deg)";

            if (note.baseY < -260) {
                recycle(note);
            }
        }

        requestAnimationFrame(loop);
    }

    function recycle(note) {
        note.el.classList.add("fading");
        window.setTimeout(function () {
            assignQuote(note, false);
        }, 400);
    }

    function focusNote(note) {
        focusedNote = note;
        focusedTextEl.textContent = note.data.text;
        focusedCaptionEl.textContent =
            note.data.author + " – " + note.data.title + ", " + note.data.year;

        backdropEl.hidden = false;
        focusedEl.hidden = false;
        requestAnimationFrame(function () {
            backdropEl.classList.add("visible");
            focusedEl.classList.add("visible");
        });
        closeBtn.focus();
    }

    function releaseFocus() {
        if (!focusedNote) {
            return;
        }
        backdropEl.classList.remove("visible");
        focusedEl.classList.remove("visible");
        window.setTimeout(function () {
            backdropEl.hidden = true;
            focusedEl.hidden = true;
        }, 350);
        const released = focusedNote;
        focusedNote = null;
        released.paused = false;
        released.el.classList.remove("paused");
        released.el.style.zIndex = "";
    }

    if (PARALLAX) {
        window.addEventListener("mousemove", function (event) {
            mouseX = event.clientX - window.innerWidth / 2;
            mouseY = event.clientY - window.innerHeight / 2;
        });
    }

    closeBtn.addEventListener("click", releaseFocus);
    backdropEl.addEventListener("click", releaseFocus);
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            releaseFocus();
        }
    });

    document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
            running = false;
        } else if (!reduceMotion) {
            if (!running) {
                running = true;
                requestAnimationFrame(loop);
            }
        }
    });
})();
