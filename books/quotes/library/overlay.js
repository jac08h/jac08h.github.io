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
    const bookNavEl = document.getElementById("book-nav");
    const bookPrevBtn = document.getElementById("book-prev-btn");
    const bookNextBtn = document.getElementById("book-next-btn");
    const bookPosEl = document.getElementById("book-position");
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
    // Same-year books the reader can flip between without leaving the overlay,
    // plus the current book's position within that list.
    let siblings = [];
    let siblingIndex = 0;

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

    // A run of blurred filler as an inline span.
    function fillerSpan(rng, words) {
        return '<span class="filler">' + escapeHtml(fillerParagraph(rng, words)) +
            " </span>";
    }

    // The highlighted quote as a span (each source paragraph its own line).
    function quoteSpan(quote) {
        const paras = quote.split(/\n+/).filter(function (p) {
            return p.trim().length > 0;
        });
        return '<span class="quote">' +
            paras.map(function (p) {
                return '<span class="quote-line">' + escapeHtml(p) + "</span>";
            }).join(" ") +
            "</span>";
    }

    // Lay out the two pages independently. Each page is filled with far more
    // filler than fits (overflow is clipped by .page-col) so no page ever
    // looks half-empty. The quote is dropped into a randomly chosen page — left,
    // right, or split across the gutter — at a random vertical position, so it
    // isn't always in the same spot. fitType then shrinks the type until the
    // quote itself is fully on screen.
    function layoutSpread(quote, rng) {
        // Enough words to overflow a page at the largest type size.
        const FILL = 150;
        const len = quote.length;
        const leftCol = document.createElement("div");
        const rightCol = document.createElement("div");
        leftCol.className = "page-col";
        rightCol.className = "page-col";

        // How far down the quote sits within its page: a random block of
        // leading filler, shrunk as the quote grows so long quotes still fit
        // below it. Trailing filler after the quote likewise shrinks with
        // length (it only fills the page tail).
        let leadMax;
        let trail;
        if (len < 300) {
            leadMax = 30; trail = FILL;
        } else if (len < 900) {
            leadMax = 16; trail = FILL;
        } else if (len < 1800) {
            leadMax = 6; trail = 20;
        } else {
            leadMax = 2; trail = 0;
        }
        const lead = 3 + Math.floor(rng() * leadMax);
        const trailAfter = function () {
            return trail > 0 ? fillerSpan(rng, trail) : "";
        };
        const roll = rng();

        if (roll < 0.42) {
            // Quote lives on the left page; right page is pure filler.
            leftCol.innerHTML =
                fillerSpan(rng, lead) + quoteSpan(quote) + trailAfter();
            rightCol.innerHTML = fillerSpan(rng, FILL);
        } else if (roll < 0.84) {
            // Quote lives on the right page; left page is pure filler.
            leftCol.innerHTML = fillerSpan(rng, FILL);
            rightCol.innerHTML =
                fillerSpan(rng, lead) + quoteSpan(quote) + trailAfter();
        } else {
            // Quote spans the gutter: it starts low on the left page and
            // continues onto the right. A single flow can't cross two divs, so
            // we let the left page carry the quote near its bottom and the
            // right page continue with more of the highlighted flow.
            const words = quote.split(/\s+/);
            const cut = Math.floor(words.length * (0.4 + rng() * 0.2));
            const part1 = words.slice(0, cut).join(" ");
            const part2 = words.slice(cut).join(" ");
            leftCol.innerHTML =
                fillerSpan(rng, 20 + Math.floor(rng() * 20)) + quoteSpan(part1);
            rightCol.innerHTML =
                quoteSpan(part2) + fillerSpan(rng, FILL);
        }

        pageFlow.innerHTML = "";
        pageFlow.appendChild(leftCol);
        pageFlow.appendChild(rightCol);
        fitType();
    }

    // Shrink the type until every highlighted quote line is fully within its
    // page (filler is allowed to overflow and clip). Measures each .quote span
    // against its page column's box.
    function fitType() {
        const cols = pageFlow.querySelectorAll(".page-col");
        if (!cols.length || cols[0].clientHeight <= 0) {
            return;
        }
        let size = 1.55;
        pageFlow.style.fontSize = size + "rem";
        let guard = 0;
        while (quoteOverflows(cols) && size > 0.6 && guard < 40) {
            size -= 0.05;
            pageFlow.style.fontSize = size + "rem";
            guard += 1;
        }
    }

    // True if any quote span extends past the bottom of its page column.
    function quoteOverflows(cols) {
        for (let i = 0; i < cols.length; i++) {
            const box = cols[i].getBoundingClientRect();
            const quotes = cols[i].querySelectorAll(".quote");
            for (let q = 0; q < quotes.length; q++) {
                const r = quotes[q].getBoundingClientRect();
                if (r.bottom > box.bottom + 1 || r.top < box.top - 1) {
                    return true;
                }
            }
        }
        return false;
    }

    function escapeHtml(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    // Briefly fade/slide the page while swapping its content, so quote and
    // book changes read as a page turn rather than an instant replace. The
    // `swap` callback runs at the midpoint, once the old page is hidden.
    let turning = false;
    function turnPage(swap) {
        if (turning) {
            swap();
            return;
        }
        turning = true;
        pageFlow.classList.add("turning");
        window.setTimeout(function () {
            swap();
            fitType();
            pageFlow.classList.remove("turning");
            turning = false;
        }, 180);
    }

    function paginate(delta) {
        if (!currentBook) {
            return;
        }
        const next = currentQuoteIndex + delta;
        if (next < 0 || next >= currentBook.quotes.length) {
            return;
        }
        turnPage(function () {
            currentQuoteIndex = next;
            renderQuote();
        });
    }

    // Point the overlay at `book` and refresh the whole spread (edge colour,
    // caption, running heads, first quote). Used both on open and when the
    // reader flips to a sibling book.
    function showBook(book) {
        currentBook = book;
        currentQuoteIndex = 0;

        const c = leatherFor(book);
        bookEl.style.setProperty("--edge", hsl(c, -14));

        captionTitle.textContent = book.title;
        captionAuthor.textContent = book.author + " · " + book.year;

        renderQuote();
        updateBookNav();
    }

    function open(book, closedCallback, siblingBooks) {
        siblings = Array.isArray(siblingBooks) && siblingBooks.length
            ? siblingBooks : [book];
        siblingIndex = Math.max(0, siblings.indexOf(book));
        onClosed = closedCallback || null;

        showBook(book);

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

    // Flip to the previous/next book of the same year, wrapping is disabled so
    // the reader can tell they've reached the ends. Resets to that book's
    // first quote.
    function flipBook(delta) {
        if (!currentBook || siblings.length < 2) {
            return;
        }
        const next = siblingIndex + delta;
        if (next < 0 || next >= siblings.length) {
            return;
        }
        siblingIndex = next;
        turnPage(function () {
            showBook(siblings[siblingIndex]);
        });
    }

    function updateBookNav() {
        if (siblings.length > 1) {
            bookNavEl.hidden = false;
            bookPrevBtn.disabled = siblingIndex === 0;
            bookNextBtn.disabled = siblingIndex === siblings.length - 1;
            bookPosEl.textContent =
                (siblingIndex + 1) + " / " + siblings.length + " · " + currentBook.year;
        } else {
            bookNavEl.hidden = true;
        }
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
    bookPrevBtn.addEventListener("click", function () {
        flipBook(-1);
    });
    bookNextBtn.addEventListener("click", function () {
        flipBook(1);
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
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            flipBook(-1);
        } else if (event.key === "ArrowDown") {
            event.preventDefault();
            flipBook(1);
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
