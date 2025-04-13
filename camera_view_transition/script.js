document.addEventListener("DOMContentLoaded", function() {
    const transitionBtn = document.getElementById("transition-btn");
    const comparisonBtn = document.getElementById("comparison-btn");
    const transitionContainer = document.getElementById("transition-container");
    const juxtaposeContainer = document.getElementById("juxtapose-container");
    const transitionVideo = document.getElementById("transition-video");
    const comparisonElement = document.getElementById("comparison");
    const matchSelector = document.getElementById("match-selector");

    const availableMatches = {
        "manchester_city_west_brom": "Manchester City vs West Brom",
        "chelsea_leicester": "Chelsea vs Leicester",
        "real_madrid_napoli": "Real Madrid vs Napoli",
        "atletico_barcelona": "Atletico vs Barcelona",
        "barcelona_atletico": "Barcelona vs Atletico",
        "barcelona_celta": "Barcelona vs Celta",
        "barcelona_villarreal": "Barcelona vs Villarreal",
        "bayern_schalke": "Bayern vs Schalke",
        "benfica_napoli": "Benfica vs Napoli",
        "celta_real_madrid": "Celta vs Real Madrid",
        "nantes_paris_sg": "Nantes vs Paris SG",
        "paris_sg_nice": "Paris SG vs Nice",
        "real_madrid_betis": "Real Madrid vs Betis",
        "roma_sassuolo": "Roma vs Sassuolo",
        "valencia_barcelona": "Valencia vs Barcelona"
    };

    // Initialize match selector dropdown
    if (matchSelector) {
        for (const [value, label] of Object.entries(availableMatches)) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            matchSelector.appendChild(option);
        }

        // Set initial match if not already selected
        if (!matchSelector.value) {
            matchSelector.value = "man_city_west_brom";
        }

        // Handle match selection change
        matchSelector.addEventListener("change", function() {
            updateMatchContent(matchSelector.value);
        });

        // Initialize with current selection
        updateMatchContent(matchSelector.value);
    } else {
        // If no match selector, initialize the comparison view with default
        initializeJuxtapose("man_city_west_brom");
    }

    if (transitionBtn && comparisonBtn) {
        transitionBtn.addEventListener("click", function() {
            transitionBtn.classList.add("active");
            comparisonBtn.classList.remove("active");
            transitionContainer.classList.remove("hidden");
            juxtaposeContainer.classList.add("hidden");

            // Ensure video plays when switching to transition view
            if (transitionVideo.paused) {
                transitionVideo.play().catch(e => {
                    console.log("Could not autoplay video: ", e);
                });
            }
        });

        comparisonBtn.addEventListener("click", function() {
            comparisonBtn.classList.add("active");
            transitionBtn.classList.remove("active");
            juxtaposeContainer.classList.remove("hidden");
            transitionContainer.classList.add("hidden");

            // Pause video when not visible
            transitionVideo.pause();

            // Reinitialize juxtapose to ensure proper sizing
            const currentMatch = matchSelector ? matchSelector.value : "man_city_west_brom";
            initializeJuxtapose(currentMatch);
        });
    }

    // Function to update content based on match selection
    function updateMatchContent(match) {
        // Update input images
        document.getElementById("input1").src = `files/${match}/frame_0.png`;
        document.getElementById("input2").src = `files/${match}/frame_1.png`;

        // Update video source
        const videoSource = document.querySelector("#transition-video source");
        videoSource.src = `files/${match}/transition.webm`;
        transitionVideo.load(); // Reload the video with new source

        // Initialize juxtapose with new match data
        initializeJuxtapose(match);
    }

    // Function to initialize or reinitialize juxtapose
    function initializeJuxtapose(match) {
        // Clear the juxtapose container first to avoid duplicate elements
        const juxtaposeContainer = document.getElementById("juxtapose-container");
        const comparisonTitle = juxtaposeContainer.querySelector(".image-title");

        // Remove all contents except the title
        while (juxtaposeContainer.lastChild) {
            juxtaposeContainer.removeChild(juxtaposeContainer.lastChild);
        }

        // Add the title back
        juxtaposeContainer.appendChild(comparisonTitle);

        // Create new comparison div
        const newComparison = document.createElement("div");
        newComparison.id = "comparison";
        newComparison.className = "juxtapose";
        newComparison.setAttribute("data-startingposition", "50%");
        newComparison.setAttribute("data-animate", "true");

        // Add the comparison div to the container
        juxtaposeContainer.appendChild(newComparison);

        // Initialize juxtapose on the new element
        new juxtapose.JXSlider("#comparison", [
            {
                src: `files/${match}/simulated_view.png`,
                label: "Simulated"
            },
            {
                src: `files/${match}/actual_frame.png`,
                label: "Actual"
            }
        ], {
            startingPosition: "50%",
            animate: true
        });
    }
});