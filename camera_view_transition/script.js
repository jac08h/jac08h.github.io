document.addEventListener("DOMContentLoaded", function() {
    // Core elements
    const transitionBtn = document.getElementById("transition-btn");
    const comparisonBtn = document.getElementById("comparison-btn");
    const transitionContainer = document.getElementById("transition-container");
    const juxtaposeContainer = document.getElementById("juxtapose-container");
    const transitionVideo = document.getElementById("transition-video");
    const comparisonElement = document.getElementById("comparison");
    const matchSelector = document.getElementById("match-selector");
    const tabButtons = document.querySelectorAll(".tab-btn");
    const transitionDescription = document.getElementById("transition-description");
    const viewDescription = document.getElementById("view-description");

    // Available matches data
    const availableMatches = {
        "atletico_barcelona": "Atletico vs Barcelona",
        "barcelona_atletico": "Barcelona vs Atletico",
        "barcelona_celta": "Barcelona vs Celta",
        "barcelona_villarreal": "Barcelona vs Villarreal",
        "bayern_schalke": "Bayern vs Schalke",
        "benfica_napoli": "Benfica vs Napoli",
        "celta_real_madrid": "Celta vs Real Madrid",
        "chelsea_leicester": "Chelsea vs Leicester",
        "manchester_city_west_brom": "Manchester City vs West Brom",
        "nantes_paris_sg": "Nantes vs Paris SG",
        "paris_sg_nice": "Paris SG vs Nice",
        "real_madrid_betis": "Real Madrid vs Betis",
        "real_madrid_napoli": "Real Madrid vs Napoli",
        "roma_sassuolo": "Roma vs Sassuolo",
        "valencia_barcelona": "Valencia vs Barcelona"
    };

    // Current state tracking
    let currentMatch = "manchester_city_west_brom";
    let currentTransitionType = "baseline";

    // Initialize match selector dropdown with smooth animation
    if (matchSelector) {
        for (const [value, label] of Object.entries(availableMatches)) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            matchSelector.appendChild(option);
        }

        // Set initial match
        matchSelector.value = "manchester_city_west_brom";
        currentMatch = "manchester_city_west_brom";

        // Handle match selection change with smooth transition
        matchSelector.addEventListener("change", function() {
            const oldMatch = currentMatch;
            currentMatch = matchSelector.value;

            // Fade transition for content change
            fadeElementOut(document.querySelector(".input-row"), function() {
                updateMatchContent(currentMatch, currentTransitionType);
                fadeElementIn(document.querySelector(".input-row"));
            });
        });

        // Initialize with current selection
        updateMatchContent(currentMatch, currentTransitionType);
    } else {
        // If no match selector, initialize the comparison view with default
        initializeJuxtapose("manchester_city_west_brom");
    }

    // Descriptions for each transition type
    const transitionDescriptions = {
        "baseline": "Default configuration: Focus-point guided interpolation which is faster during middle of the transition. The missing areas are filled with inpainting, and the player textures are blended. Player segmentation and camera calibration is done manually.",
        "linear": "Same as the default, but with linear interpolation and without inpainting.",
        "constant_speed": "Same as the default, but with constant speed during the transition.",
        "slower_in_the_middle": "Same as the default, but with slower speed during the middle of the transition.",
        "without_inpainting": "Same as the default, but without inpainting.",
        "without_player_blending": "Same as the default, but without player blending.",
        "yolo_masks": "Same as the default, but with automatic player segmentation using YOLO11x-seg instead of manual annotation.",
    };

    // Set the initial description
    if (transitionDescription) {
        transitionDescription.textContent = transitionDescriptions["baseline"];
    }

    // Initialize tab buttons with smoother transitions
    if (tabButtons) {
        tabButtons.forEach(button => {
            button.addEventListener("click", function() {
                // Deactivate all buttons
                tabButtons.forEach(btn => btn.classList.remove("active"));

                // Activate clicked button with animation
                this.classList.add("active");

                // Get transition type from data attribute
                currentTransitionType = this.dataset.transition;

                // Update video source based on selected transition
                updateVideoSource(currentMatch, currentTransitionType);

                // Update the description text with fade effect
                if (transitionDescription) {
                    fadeElementOut(transitionDescription, function() {
                        transitionDescription.textContent = transitionDescriptions[currentTransitionType] || "";
                        fadeElementIn(transitionDescription);
                    });
                }
            });
        });
    }

    // View descriptions
    const viewDescriptions = {
        "transition": "Video transition between the two input frames.",
        "comparison": "Comparison of the simulated frame and the actual frame."
    };

    // Set initial view description
    if (viewDescription) {
        viewDescription.textContent = viewDescriptions["transition"];
    }

    if (transitionBtn && comparisonBtn) {
        transitionBtn.addEventListener("click", function() {
            transitionBtn.classList.add("active");
            comparisonBtn.classList.remove("active");

            // Switch views with smooth transition
            fadeElementOut(juxtaposeContainer, function() {
                juxtaposeContainer.classList.add("hidden");
                transitionContainer.classList.remove("hidden");
                fadeElementIn(transitionContainer);

                // Update view description with fade effect
                fadeElementOut(viewDescription, function() {
                    viewDescription.textContent = viewDescriptions["transition"];
                    fadeElementIn(viewDescription);
                });

                // Ensure video plays when switching to transition view
                if (transitionVideo.paused) {
                    transitionVideo.play().catch(e => {
                        console.log("Could not autoplay video: ", e);
                    });
                }
            });
        });

        comparisonBtn.addEventListener("click", function(e) {
            // Prevent default behavior that might cause page to scroll
            e.preventDefault();

            // Store current scroll position
            const scrollPos = window.scrollY;

            comparisonBtn.classList.add("active");
            transitionBtn.classList.remove("active");

            // Switch views with smooth transition
            fadeElementOut(transitionContainer, function() {
                transitionContainer.classList.add("hidden");
                juxtaposeContainer.classList.remove("hidden");
                fadeElementIn(juxtaposeContainer);

                // Update view description with fade effect
                fadeElementOut(viewDescription, function() {
                    viewDescription.textContent = viewDescriptions["comparison"];
                    fadeElementIn(viewDescription);
                });

                // Pause video when not visible
                transitionVideo.pause();

                // Reinitialize juxtapose to ensure proper sizing
                initializeJuxtapose(currentMatch);

                // Restore scroll position
                window.scrollTo(0, scrollPos);
            });
        });
    }

    // Helper function for fading elements out
    function fadeElementOut(element, callback) {
        if (!element) return;
        element.style.transition = "opacity 0.3s ease";
        element.style.opacity = "0";
        setTimeout(function() {
            if (callback) callback();
        }, 300);
    }

    // Helper function for fading elements in
    function fadeElementIn(element) {
        if (!element) return;
        element.style.transition = "opacity 0.3s ease";
        setTimeout(function() {
            element.style.opacity = "1";
        }, 50);
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

        // Map transition types to file names
        const transitionFileNames = {
            "baseline": "transition.webm",
            "linear": "transition_linear.webm",
            "without_inpainting": "transition_without_inpainting.webm",
            "without_player_blending": "transition_without_player_blending.webm",
            "constant_speed": "transition_constant_speed.webm",
            "slower_in_the_middle": "transition_slower_in_the_middle.webm",
            "yolo_masks": "transition_yolo_masks.webm",
        };

        // Get the file name for the selected transition type
        if (transitionFileNames[transitionType]) {
            videoFileName = transitionFileNames[transitionType];
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

        // Remove all contents
        while (juxtaposeContainer.lastChild) {
            juxtaposeContainer.removeChild(juxtaposeContainer.lastChild);
        }

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