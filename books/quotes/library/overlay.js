import { leatherFor, hsl } from "./textures.js";

// 2D reading overlay: an opened two-page book spread. The current quote is laid
// out as the "real" text on the page — highlighted with a marker sweep — while
// the rest of each page is filled with unreadable blurred filler so the spread
// reads as a genuine page from a book. Quote font-size auto-fits so everything
// stays visible without scrolling. The 3D layer triggers open() after its
// pull-out animation.

// A small bank of plausible-looking words to weave the illegible filler from.
// It never needs to be read, only to look like prose, so a fixed multilingual
// bank keeps it deterministic and cheap.
const FILLER_WORDS = (
    "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod " +
    "tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam " +
    "quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo " +
    "voluptate velit esse cillum fugiat nulla pariatur excepteur sint " +
    "occaecat cupidatat proident sunt culpa qui officia deserunt mollit anim " +
    "id est laborum přišla vyzvídala jestli chtěl řekl jedno stojí mohli něco " +
    "udělat miluju odpověděl vysvětlil takovém nezáleží přeje mužeme ostatně"
).split(" ");

// Deterministic PRNG so a given book always produces the same filler.
function makeRng(seed) {
    let s = seed >>> 0;
    return function () {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function fillerParagraph(rng, wordCount) {
    const words = [];
    for (let i = 0; i < wordCount; i++) {
        let w = FILLER_WORDS[Math.floor(rng() * FILLER_WORDS.length)];
        if (i === 0) {
            w = w.charAt(0).toUpperCase() + w.slice(1);
        }
        words.push(w);
    }
    let text = words.join(" ");
    if (rng() < 0.5) {
        text += ".";
    } else {
        text += ",";
    }
    return text;
}

export function createOverlay() {
    const stageEl = document.getElementById("stage");
    const bookEl = document.getElementById("book");
    const backdropEl = document.getElementById("backdrop");
    const closeBtn = document.getElementById("close-btn");
    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    const pageIndicatorEl = document.getElementById("page-indicator");
    const pageFlow = document.getElementById("page-flow");
    const headLeft = document.getElementById("head-left");
    const headRight = document.getElementById("head-right");
    const pagenoLeft = document.getElementById("pageno-left");
    const pagenoRight = document.getElementById("pageno-right");
    const captionTitle = document.getElementById("caption-title");
    const captionAuthor = document.getElementById("caption-author");

    let currentBook = null;
    let currentQuoteIndex = 0;
    let onClosed = null;

    // Build the flowing page content for the current quote: leading filler,
    // then the highlighted quote (possibly spilling onto the right page),
    // then trailing filler. Font-size is auto-fitted so nothing scrolls.
    function renderQuote() {
        if (!currentBook) {
            return;
        }
        const quote = currentBook.quotes[currentQuoteIndex];
        const seed = hashString(currentBook.id + "#" + currentQuoteIndex);
        const rng = makeRng(seed);

        layoutSpread(quote, rng);

        headLeft.textContent = currentBook.author;
        headRight.textContent = currentBook.title;

        const base = 12 + currentQuoteIndex * 2;
        pagenoLeft.textContent = base;
        pagenoRight.textContent = base + 1;

        if (currentBook.quotes.length > 1) {
            pageIndicatorEl.textContent =
                (currentQuoteIndex + 1) + " / " + currentBook.quotes.length;
            pageIndicatorEl.style.display = "";
            prevBtn.hidden = false;
            nextBtn.hidden = false;
            prevBtn.disabled = currentQuoteIndex === 0;
            nextBtn.disabled = currentQuoteIndex === currentBook.quotes.length - 1;
        } else {
            pageIndicatorEl.style.display = "none";
            prevBtn.hidden = true;
            nextBtn.hidden = true;
        }
    }

    // Fill the two-column flow with filler + highlighted quote, then shrink the
    // type until the whole spread fits with no overflow (no scrolling).
    function layoutSpread(quote, rng) {
        const len = quote.length;

        // Filler amount shrinks as the quote grows, so the quote stays the
        // centre of attention and the spread never overflows.
        let leadWords;
        let trailWords;
        if (len < 300) {
            leadWords = 34;
            trailWords = 46;
        } else if (len < 900) {
            leadWords = 18;
            trailWords = 26;
        } else if (len < 1800) {
            leadWords = 8;
            trailWords = 10;
        } else {
            leadWords = 3;
            trailWords = 0;
        }
        const lead = fillerParagraph(rng, leadWords);
        const trail = trailWords > 0 ? fillerParagraph(rng, trailWords) : "";

        const paras = quote.split(/\n+/).filter(function (p) {
            return p.trim().length > 0;
        });

        const html =
            '<span class="filler">' + escapeHtml(lead) + " </span>" +
            '<span class="quote">' +
            paras.map(function (p) {
                return '<span class="quote-line">' + escapeHtml(p) + "</span>";
            }).join(" ") +
            "</span>" +
            (trail ? '<span class="filler"> ' + escapeHtml(trail) + "</span>" : "");

        pageFlow.innerHTML = html;
        fitType();
    }

    // Binary-ish shrink: start at a length-based guess, step down until the
    // content height no longer exceeds the column height.
    function fitType() {
        const cap = pageFlow.clientHeight;
        if (cap <= 0) {
            return;
        }
        let size = 1.55;
        pageFlow.style.fontSize = size + "rem";
        // scrollHeight > clientHeight means the columns overflowed their box.
        let guard = 0;
        while (pageFlow.scrollHeight > cap + 1 && size > 0.6 && guard < 40) {
            size -= 0.05;
            pageFlow.style.fontSize = size + "rem";
            guard += 1;
        }
    }

    function escapeHtml(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function paginate(delta) {
        if (!currentBook) {
            return;
        }
        const next = currentQuoteIndex + delta;
        if (next < 0 || next >= currentBook.quotes.length) {
            return;
        }
        currentQuoteIndex = next;
        renderQuote();
    }

    function open(book, closedCallback) {
        currentBook = book;
        currentQuoteIndex = 0;
        onClosed = closedCallback || null;

        const c = leatherFor(book);
        bookEl.style.setProperty("--edge", hsl(c, -14));

        captionTitle.textContent = book.title;
        captionAuthor.textContent = book.author + " · " + book.year;

        renderQuote();

        stageEl.hidden = false;
        stageEl.setAttribute("aria-hidden", "false");
        backdropEl.hidden = false;

        requestAnimationFrame(function () {
            backdropEl.classList.add("visible");
            stageEl.classList.add("open");
            // Re-fit once the spread is at its final on-screen size.
            fitType();
        });

        closeBtn.focus();
    }

    function close() {
        if (!currentBook) {
            return;
        }
        stageEl.classList.remove("open");
        backdropEl.classList.remove("visible");

        window.setTimeout(function () {
            stageEl.hidden = true;
            stageEl.setAttribute("aria-hidden", "true");
            backdropEl.hidden = true;
            currentBook = null;
            if (onClosed) {
                const cb = onClosed;
                onClosed = null;
                cb();
            }
        }, 420);
    }

    prevBtn.addEventListener("click", function () {
        paginate(-1);
    });
    nextBtn.addEventListener("click", function () {
        paginate(1);
    });
    closeBtn.addEventListener("click", close);
    backdropEl.addEventListener("click", close);

    window.addEventListener("resize", function () {
        if (currentBook) {
            fitType();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (!currentBook) {
            return;
        }
        if (event.key === "Escape") {
            close();
        } else if (event.key === "ArrowLeft") {
            paginate(-1);
        } else if (event.key === "ArrowRight") {
            paginate(1);
        }
    });

    return {
        open: open,
        close: close,
        isOpen: function () {
            return currentBook !== null;
        }
    };
}
