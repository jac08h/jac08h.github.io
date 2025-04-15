document.addEventListener("DOMContentLoaded", function() {
    const transitionBtn = document.getElementById("transition-btn");
    const comparisonBtn = document.getElementById("comparison-btn");
    const transitionContainer = document.getElementById("transition-container");
    const juxtaposeContainer = document.getElementById("juxtapose-container");
    const transitionVideo = document.getElementById("transition-video");
    const comparisonElement = document.getElementById("comparison");
    const matchSelector = document.getElementById("match-selector");
    const tabButtons = document.querySelectorAll(".tab-btn");

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

    // Current state tracking
    let currentMatch = "manchester_city_west_brom";
    let currentTransitionType = "baseline";

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
            matchSelector.value = "manchester_city_west_brom";
            currentMatch = "manchester_city_west_brom";
        }

        // Handle match selection change
        matchSelector.addEventListener("change", function() {
            currentMatch = matchSelector.value;
            updateMatchContent(currentMatch, currentTransitionType);
        });

        // Initialize with current selection
        updateMatchContent(currentMatch, currentTransitionType);
    } else {
        // If no match selector, initialize the comparison view with default
        initializeJuxtapose("manchester_city_west_brom");
    }

    // Initialize tab buttons
    if (tabButtons) {
        tabButtons.forEach(button => {
            button.addEventListener("click", function() {
                // Deactivate all buttons
                tabButtons.forEach(btn => btn.classList.remove("active"));

                // Activate clicked button
                this.classList.add("active");

                // Get transition type from data attribute
                currentTransitionType = this.dataset.transition;

                // Update video source based on selected transition
                updateVideoSource(currentMatch, currentTransitionType);
            });
        });
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
            initializeJuxtapose(currentMatch);
        });
    }

    // Function to update content based on match selection and transition type
    function updateMatchContent(match, transitionType) {
        // Update input images
        document.getElementById("input1").src = `files/${match}/frame_0.png`;
        document.getElementById("input2").src = `files/${match}/frame_1.png`;

        // Update video source
        updateVideoSource(match, transitionType);

        // Initialize juxtapose with new match data
        initializeJuxtapose(match);
    }

    // Function to update video source based on match and transition type
    function updateVideoSource(match, transitionType) {
        const videoSource = document.querySelector("#transition-video source");
        let videoFileName = "transition.webm"; // Default

        if (transitionType === "linear") {
            videoFileName = "transition_linear.webm";
        } else if (transitionType === "baseline") {
            videoFileName = "transition.webm";
        }

        videoSource.src = `files/${match}/${videoFileName}`;
        transitionVideo.load(); // Reload the video with new source

        // Try to play if the container is visible
        if (!transitionContainer.classList.contains("hidden")) {
            transitionVideo.play().catch(e => {
                console.log("Could not autoplay video: ", e);
            });
        }
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