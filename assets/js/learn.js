// -------- LEARNING MODULE SYSTEM --------

// All modules with ID and progress
const modules = [
    { id: 1, title: "Module 1: The Alphabet", progress: 0 },
    { id: 2, title: "Module 2: Basic Greetings", progress: 0 },
    { id: 3, title: "Module 3: Numbers 1-10", progress: 0 }
];

// Load progress from LocalStorage
function loadProgress() {
    const saved = localStorage.getItem("learning_progress");
    if (saved) return JSON.parse(saved);
    return modules;
}

// Save progress
function saveProgress(data) {
    localStorage.setItem("learning_progress", JSON.stringify(data));
}

// Update UI progress bar
function updateProgressBars() {
    const data = loadProgress();

    data.forEach(module => {
        const bar = document.querySelector(`#module-${module.id}-progress`);
        const label = document.querySelector(`#module-${module.id}-label`);

        if (bar) {
            bar.style.width = module.progress + "%";
            label.textContent = module.progress + "%";
        }
    });
}

// Simulate progress (for demo)
function startModule(id) {
    let data = loadProgress();
    let selected = data.find(m => m.id === id);

    if (!selected) return;

    // Increase progress (demo)
    if (selected.progress < 100) selected.progress += 25;

    saveProgress(data);
    updateProgressBars();

    alert(selected.title + " progress updated!");
}

// Execute when page loads
document.addEventListener("DOMContentLoaded", () => {
    updateProgressBars();

    // Add click listeners to buttons
    document.querySelectorAll("[data-module]").forEach(btn => {
        btn.addEventListener("click", () => {
            let moduleId = parseInt(btn.dataset.module);
            startModule(moduleId);
        });
    });
});
