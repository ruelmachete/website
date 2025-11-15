/**
 * translator.js
 * Full, self-contained module:
 * - Loads MediaPipe Tasks Vision HandLandmarker
 * - Optional: loads TFJS FSL classifier if available at ./assets/models/fsl_model_js/model.json
 * - Handles camera start/stop, mirroring, canvas drawing
 * - Extracts landmarks and (if classifier loaded) predicts sign letter
 * - Integrates copy + speak UI
 *
 * Place this file at: assets/js/translator.js
 */

import {
  HandLandmarker,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js";

document.addEventListener("DOMContentLoaded", async () => {
  // UI elements
  const startBtn = document.getElementById("startBtn");
  const videoContainer = document.getElementById("video-container");
  const translationText = document.getElementById("translationText");
  const speakBtn = document.getElementById("speakBtn");
  const copyBtn = document.getElementById("copyBtn");

  // State variables
  let handLandmarker = null;
  let webcamRunning = false;
  let stream = null;
  let video = null;
  let canvas = null;
  let canvasCtx = null;
  let lastVideoTime = -1;

  // Optional TFJS classifier (for FSL model)
  let fslModel = null;
  let labelMap = null; // array of labels in order the model outputs
  const FSL_MODEL_PATH = "./assets/model/fsl_model_js/model.json"; // change if your path differs
  const LABELS_JSON = "./assets/model/fsl_model_js/labels.json"; // optional mapping file

  // --- Helper: load optional TFJS classifier if present ---
  async function tryLoadFSLModel() {
    if (typeof tf === "undefined") {
      console.warn("TFJS not loaded; skipping FSL classifier load.");
      return;
    }

    try {
      // attempt to fetch model JSON
      const resp = await fetch(FSL_MODEL_PATH, { method: "HEAD" });
      if (!resp.ok) {
        console.info("No TFJS model found at", FSL_MODEL_PATH);
        return;
      }
    } catch (err) {
      // HEAD request failed (likely file not present)
      console.info("FSL model not found (HEAD check); skipping.", err);
      return;
    }

    try {
      translationText.innerText = "Loading FSL classifier...";
      fslModel = await tf.loadLayersModel(FSL_MODEL_PATH);
      console.log("FSL classifier loaded:", fslModel);

      // try to load labels.json if available
      try {
        const r = await fetch(LABELS_JSON);
        if (r.ok) {
          labelMap = await r.json();
          console.log("Label map loaded:", labelMap);
        } else {
          labelMap = null;
        }
      } catch (e) {
        labelMap = null;
      }

      // fallback: if no labels.json and number of outputs is known, create A-Z or generic indices
      if (!labelMap && fslModel && fslModel.outputs && fslModel.outputs.length === 1) {
        // attempt to infer number of classes from model output shape (only works if available)
        const outShape = fslModel.outputs[0].shape; // e.g. [null, 26]
        const classes = (outShape && outShape.length >= 2) ? outShape[1] : null;
        if (classes) {
          labelMap = Array.from({ length: classes }, (_, i) => String.fromCharCode(65 + i)); // A,B,C...
        }
      }

      translationText.innerText = "...";
    } catch (err) {
      console.warn("Failed to load TFJS FSL model:", err);
      fslModel = null;
      labelMap = null;
    }
  }

  // --- Create and load MediaPipe HandLandmarker ---
  async function createHandLandmarker() {
    try {
      translationText.innerText = "Loading hand model...";
      // For vision tasks, we must point to the WASM files root
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2
      });

      console.log("HandLandmarker loaded.");
      translationText.innerText = "...";
      startBtn.disabled = false;
      startBtn.innerHTML = `<i class="fas fa-play-circle me-2"></i> Start Translation`;
    } catch (err) {
      console.error("Failed to create HandLandmarker:", err);
      translationText.innerText = "Hand model failed to load.";
      startBtn.disabled = true;
      startBtn.innerHTML = `Model Error`;
    }
  }

  // Kick off async loads in parallel
  startBtn.disabled = true;
  startBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i> Loading Model...`;
  await Promise.all([createHandLandmarker(), tryLoadFSLModel()]);

  // --- Camera enable/disable ---
  async function enableCam() {
    if (!handLandmarker) {
      console.log("Model not ready.");
      return;
    }

    if (webcamRunning) {
      // stop
      webcamRunning = false;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      // remove video/canvas and restore placeholder
      videoContainer.innerHTML = `
        <div class="placeholder-inner text-center">
          <i class="fas fa-video fa-3x mb-3"></i>
          <p>Camera feed will appear here.</p>
          <small class="text-muted">Click Start Translation to begin.</small>
        </div>
      `;
      startBtn.innerHTML = `<i class="fas fa-play-circle me-2"></i> Start Translation`;
      translationText.innerText = "...";
      video = null;
      canvas = null;
      canvasCtx = null;
      stream = null;
      lastVideoTime = -1;
      return;
    }

    // start
    webcamRunning = true;
    startBtn.innerHTML = `<i class="fas fa-stop-circle me-2"></i> Stop Translation`;

    // create elements
    video = document.createElement("video");
    video.setAttribute("playsinline", "true");
    video.autoplay = true;
    video.className = "video-view mirrored-video";

    canvas = document.createElement("canvas");
    canvas.className = "canvas-view";

    // clear container and append
    videoContainer.innerHTML = "";
    videoContainer.appendChild(video);
    videoContainer.appendChild(canvas);
    canvasCtx = canvas.getContext("2d");

    // start webcam
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      video.srcObject = stream;

      // wait until video is ready
      video.addEventListener("loadeddata", () => {
        // match canvas size
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        // start prediction loop
        predictWebcam();
      });
    } catch (err) {
      console.error("Camera access error:", err);
      alert("Camera access blocked or unavailable!");
      webcamRunning = false;
      startBtn.innerHTML = `<i class="fas fa-play-circle me-2"></i> Start Translation`;
    }
  }

  // --- Prediction loop using detectForVideo ---
  async function predictWebcam() {
    if (!webcamRunning || !video || video.readyState < 2) return;

    // match canvas to video pixel size
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
    }

    const startTimeMs = performance.now();

    // only run detect when frame advanced
    if (lastVideoTime !== video.currentTime) {
      lastVideoTime = video.currentTime;
      try {
        const results = await handLandmarker.detectForVideo(video, startTimeMs);

        // clear and draw overlay
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        if (results && results.landmarks && results.landmarks.length > 0) {
          // draw connectors + landmarks for each detected hand
          const drawingUtils = new DrawingUtils(canvasCtx);
          for (const landmarks of results.landmarks) {
            // drawing utils expect landmarks as array of {x,y,z} normalized
            drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#ffffff", lineWidth: 4 });
            drawingUtils.drawLandmarks(landmarks, { color: "#4F46E5", lineWidth: 2 });
          }

          // If we have a TFJS classifier loaded, prepare input and run prediction
          if (fslModel && labelMap) {
            // Use first detected hand for single-letter detection
            const first = results.landmarks[0]; // array of 21 {x,y,z}
            const inputVector = [];

            // Flatten normalized x,y,z into a 63-length vector (21 * 3)
            for (let i = 0; i < first.length; i++) {
              const lm = first[i];
              // Use x,y,z normalized coordinates directly
              inputVector.push(lm.x);
              inputVector.push(lm.y);
              inputVector.push(lm.z);
            }

            // Predict with tf.tidy to avoid memory leaks
            const pred = await tf.tidy(() => {
              // model expects shape [1, N] where N==inputVector.length
              const t = tf.tensor2d([inputVector]);
              const out = fslModel.predict(t);
              // either get logits or probabilities
              let probs = out;
              if (Array.isArray(out)) probs = out[0];
              return probs.array();
            });

            // pred is [[p0, p1, ...]]
            if (pred && pred[0]) {
              const probsArray = pred[0];
              let bestIdx = 0;
              let bestVal = probsArray[0];
              for (let i = 1; i < probsArray.length; i++) {
                if (probsArray[i] > bestVal) {
                  bestVal = probsArray[i];
                  bestIdx = i;
                }
              }

              const label = labelMap[bestIdx] || `Class ${bestIdx}`;
              const confidence = (bestVal * 100).toFixed(1);
              translationText.innerText = `${label} (${confidence}%)`;
            } else {
              translationText.innerText = "Prediction failed";
            }
          } else {
            // If classifier not available, show simple status
            translationText.innerText = "Hand Detected!";
          }
        } else {
          translationText.innerText = "No hand detected...";
        }

        canvasCtx.restore();
      } catch (err) {
        console.error("Hand detection error:", err);
        translationText.innerText = "Detection failed!";
      }
    }

    // loop
    if (webcamRunning) {
      window.requestAnimationFrame(predictWebcam);
    }
  }

  // --- Button handlers ---
  startBtn.addEventListener("click", enableCam);

  speakBtn.addEventListener("click", () => {
    const text = translationText.innerText;
    if (!text || text === "..." || text === "No hand detected...") return;
    const ut = new SpeechSynthesisUtterance(text.replace(/\s*\(\d+(\.\d+)?%\)$/, "")); // remove confidence in speech
    speechSynthesis.speak(ut);
  });

  copyBtn.addEventListener("click", async () => {
    const text = translationText.innerText;
    if (!text || text === "..." || text === "No hand detected...") return;
    try {
      await navigator.clipboard.writeText(text);
      // optional small toast: simple alert or you can wire a nicer UI
      const prev = translationText.innerText;
      translationText.innerText = "Copied!";
      setTimeout(() => (translationText.innerText = prev), 900);
    } catch (err) {
      console.error("Copy failed", err);
    }
  });

  // Optional: clicking suggestions fills translation text (and can feed to speak/copy)
  document.querySelectorAll(".suggestion").forEach(el => {
    el.addEventListener("click", () => {
      translationText.innerText = el.innerText;
    });
  });

  // Done
  console.log("translator.js loaded and initialized.");
});
