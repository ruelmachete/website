document.addEventListener('DOMContentLoaded', function() {

    const body = document.body;

    // ========================================================
    // ================ SIDEBAR COLLAPSE LOGIC ================
    // ========================================================
    const sidebarToggle = document.getElementById('sidebarToggle');
    
    // Function to apply the sidebar state
    const applySidebarState = (state) => {
        if (state === 'collapsed') {
            body.classList.add('sidebar-collapsed');
        } else {
            body.classList.remove('sidebar-collapsed');
        }
    };
    
    // On page load, check localStorage for a saved sidebar state
    const savedSidebarState = localStorage.getItem('sidebarState') || 'expanded';
    applySidebarState(savedSidebarState);

    // Add click listener for the toggle button
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            body.classList.toggle('sidebar-collapsed');
            // Save the new state to localStorage
            const newState = body.classList.contains('sidebar-collapsed') ? 'collapsed' : 'expanded';
            localStorage.setItem('sidebarState', newState);
        });
    }

    // ========================================================
    // ================== THEME & DISPLAY LOGIC ===============
    // ========================================================
    const darkModeSwitch = document.getElementById('darkModeSwitch');
    const applyTheme = (theme) => {
        body.classList.remove('light-mode', 'dark-mode');
        body.classList.add(theme === 'dark' ? 'dark-mode' : 'light-mode');
        if(darkModeSwitch) darkModeSwitch.checked = (theme === 'dark');
    };

    const textSizeSlider = document.getElementById('textSizeSlider');
    const applyTextSize = (size) => {
        body.classList.remove('text-size-90', 'text-size-100', 'text-size-110');
        body.classList.add(`text-size-${size}`);
        if(textSizeSlider) textSizeSlider.value = size;
    };

    const savedTheme = localStorage.getItem('theme') || 'light';
    const savedTextSize = localStorage.getItem('textSize') || '100';
    applyTheme(savedTheme);
    applyTextSize(savedTextSize);

    // ========================================================
    // =================== EVENT LISTENERS ====================
    // ========================================================
    if (darkModeSwitch) {
        darkModeSwitch.addEventListener('change', function() {
            const newTheme = this.checked ? 'dark' : 'light';
            applyTheme(newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    if (textSizeSlider) {
        textSizeSlider.addEventListener('input', function() {
            applyTextSize(this.value);
        });
    }

    const currentPath = window.location.pathname.split("/").pop();
    const navLinks = document.querySelectorAll('.sidebar .nav-link');
    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href').split("/").pop();
        if (currentPath === linkPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keyup', function() {
            const searchTerm = searchInput.value.toLowerCase();
            const allCards = document.querySelectorAll('.gesture-item-col');
            allCards.forEach(card => {
                const titleText = card.querySelector('.card-title').textContent.toLowerCase();
                card.style.display = titleText.includes(searchTerm) ? 'block' : 'none';
            });
        });
    }

    const imageModal = document.getElementById('imageModal');
    if (imageModal) {
        imageModal.addEventListener('show.bs.modal', function (event) {
            const card = event.relatedTarget.closest('.gesture-card');
            const imageSrc = card.querySelector('.card-img-top').src;
            const titleText = card.querySelector('.card-title').textContent;
            imageModal.querySelector('.modal-title').textContent = titleText;
            imageModal.querySelector('#modalImage').src = imageSrc;
        });
    }

    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        const signLanguageSelect = document.getElementById('signLanguageSelect');
        const sensitivitySlider = document.getElementById('sensitivitySlider');
        const saveConfirmation = document.getElementById('saveConfirmation');

        const savedLanguage = localStorage.getItem('signLanguage') || 'fsl';
        const savedSensitivity = localStorage.getItem('sensitivity') || '3';
        signLanguageSelect.value = savedLanguage;
        sensitivitySlider.value = savedSensitivity;

        saveSettingsBtn.addEventListener('click', function() {
            localStorage.setItem('textSize', textSizeSlider.value);
            localStorage.setItem('signLanguage', signLanguageSelect.value);
            localStorage.setItem('sensitivity', sensitivitySlider.value);

            saveConfirmation.textContent = 'Settings Saved!';
            saveConfirmation.style.opacity = 1;

            setTimeout(() => {
                saveConfirmation.style.opacity = 0;
            }, 2000);
        });
    }

    console.log("HandWave prototype scripts loaded successfully!");
});