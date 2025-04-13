document.addEventListener("DOMContentLoaded", function() {
    const transitionBtn = document.getElementById("transition-btn");
    const comparisonBtn = document.getElementById("comparison-btn");
    const transitionContainer = document.getElementById("transition-container");
    const juxtaposeContainer = document.getElementById("juxtapose-container");
    const transitionVideo = document.getElementById("transition-video");
    const comparisonElement = document.getElementById("comparison");

    if (comparisonElement) {
        // Wait for juxtapose to initialize
        setTimeout(() => {
            comparisonElement.classList.add("single-image");
        }, 500);
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

            // Make sure the comparison is in single image mode
            if (comparisonElement) {
                comparisonElement.classList.add("single-image");
            }
        });
    }
});