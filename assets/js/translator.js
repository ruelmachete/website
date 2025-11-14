let stream = null;
const startBtn = document.getElementById("startBtn");
const cameraContainer = document.getElementById("cameraContainer");

startBtn.addEventListener("click", async () => {
    // STOP CAMERA
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;

        cameraContainer.innerHTML = `
            <i class="fas fa-video fa-3x mb-3"></i>
            <p>Camera feed will appear here.</p>
            <small class="text-muted">Detection is currently inactive in this prototype.</small>
        `;

        startBtn.innerHTML = `<i class="fas fa-play-circle me-2"></i> Start Translation`;
        return;
    }

    // START CAMERA
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });

        cameraContainer.innerHTML = "";
        const video = document.createElement("video");
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.borderRadius = "0.75rem";
        video.autoplay = true;
        video.srcObject = stream;

        cameraContainer.appendChild(video);

        startBtn.innerHTML = `<i class="fas fa-stop-circle me-2"></i> Stop Translation`;

    } catch (error) {
        alert("Camera access blocked or unavailable!");
        console.error("Camera Error:", error);
    }
});
