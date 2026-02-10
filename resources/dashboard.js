(function () {
    const vscode = acquireVsCodeApi();

    // UI Elements
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const clearLogsBtn = document.getElementById('clearLogsBtn');
    const settingsBtn = document.getElementById('settingsBtn');

    const modeSelect = document.getElementById('modeSelect');
    const modelSelect = document.getElementById('modelSelect');
    const promptFile = document.getElementById('promptFile');
    const taskFile = document.getElementById('taskFile');
    const progressFile = document.getElementById('progressFile');
    const maxIterations = document.getElementById('maxIterations');
    const stableThreshold = document.getElementById('stableThreshold');

    const pseudoRalph = document.getElementById('pseudoRalph');
    const useGit = document.getElementById('useGit');
    const createBranch = document.getElementById('createBranch');
    const branchOption = document.getElementById('branchOption');

    const statusText = document.getElementById('statusText');
    const statusBadge = document.getElementById('statusBadge');
    const iterCount = document.getElementById('iterCount');
    const elapsedTime = document.getElementById('elapsedTime');
    const cascadeId = document.getElementById('cascadeId');
    const logContainer = document.getElementById('logContainer');

    // State Tracking
    let isRunning = false;
    let isPaused = false;

    // Listen for messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'updateState':
                updateUI(message.state);
                break;
            case 'updateModels':
                updateModelOptions(message.models, message.currentModel);
                break;
            case 'appendLog':
                appendLog(message.text, message.level);
                break;
        }
    });

    function updateModelOptions(models, currentModel) {
        modelSelect.innerHTML = '';
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.text = model.name;
            modelSelect.appendChild(option);
        });
        if (currentModel) modelSelect.value = currentModel;
    }

    function updateUI(state) {
        isRunning = state.status === 'running';
        isPaused = state.status === 'paused';

        statusText.innerText = state.status.toUpperCase();
        statusBadge.className = `status-badge ${state.status}`;

        iterCount.innerText = `${state.currentIteration} / ${state.maxIterations || 50}`;
        elapsedTime.innerText = state.elapsedTime || '00:00';
        cascadeId.innerText = state.cascadeId || 'None';
        cascadeId.title = state.cascadeId || 'None';

        // Button States
        startBtn.disabled = isRunning;
        pauseBtn.disabled = !isRunning && !isPaused;
        pauseBtn.innerText = isPaused ? '▶ Resume' : '⏸ Pause';
        stopBtn.disabled = !isRunning && !isPaused;

        // Config Inputs (only disable when running)
        const inputs = [modeSelect, modelSelect, promptFile, taskFile, progressFile, maxIterations, stableThreshold, pseudoRalph, useGit, createBranch];
        inputs.forEach(input => input.disabled = isRunning);

        // Sync values if they changed and user is not currently typing
        if (state.mode && document.activeElement !== modeSelect) modeSelect.value = state.mode;
        if (state.model && document.activeElement !== modelSelect) modelSelect.value = state.model;
        if (state.promptFile !== undefined && document.activeElement !== promptFile) promptFile.value = state.promptFile;
        if (state.taskFile !== undefined && document.activeElement !== taskFile) taskFile.value = state.taskFile;
        if (state.progressFile !== undefined && document.activeElement !== progressFile) progressFile.value = state.progressFile;
        if (state.maxIterations !== undefined && document.activeElement !== maxIterations) maxIterations.value = state.maxIterations;
        if (state.stableThreshold !== undefined && document.activeElement !== stableThreshold) stableThreshold.value = state.stableThreshold;

        if (state.pseudoRalphMode !== undefined) pseudoRalph.checked = state.pseudoRalphMode;
        if (state.useGit !== undefined) useGit.checked = state.useGit;
        if (state.createBranchEverySession !== undefined) createBranch.checked = state.createBranchEverySession;

        // Conditional Visibility
        branchOption.style.display = useGit.checked ? 'block' : 'none';
    }

    function appendLog(text, level = 'info') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${level}`;

        const time = new Date().toLocaleTimeString([], { hour12: false });
        entry.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-${level}">${text}</span>`;

        logContainer.appendChild(entry);

        // Keep only last 200 logs for performance
        if (logContainer.childNodes.length > 200) {
            logContainer.removeChild(logContainer.firstChild);
        }

        // Smooth scroll to bottom
        requestAnimationFrame(() => {
            logContainer.scrollTo({
                top: logContainer.scrollHeight,
                behavior: 'smooth'
            });
        });
    }

    // Event Handlers
    startBtn.addEventListener('click', () => {
        vscode.postMessage({
            command: 'start',
            config: {
                mode: modeSelect.value,
                model: modelSelect.value,
                promptFile: promptFile.value,
                taskFile: taskFile.value,
                progressFile: progressFile.value,
                maxIterations: parseInt(maxIterations.value),
                stableThreshold: parseInt(stableThreshold.value),
                pseudoRalph: pseudoRalph.checked,
                useGit: useGit.checked,
                createBranch: createBranch.checked
            }
        });
    });

    pauseBtn.addEventListener('click', () => {
        vscode.postMessage({ command: isPaused ? 'resume' : 'pause' });
    });

    stopBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'stop' });
    });

    // Advanced Settings Toggle
    const advancedToggle = document.getElementById('advancedToggle');
    const advancedContent = document.getElementById('advancedContent');
    const advancedChevron = document.getElementById('advancedChevron');

    if (advancedToggle) {
        advancedToggle.addEventListener('click', () => {
            const isHidden = advancedContent.classList.contains('hidden');
            if (isHidden) {
                advancedContent.classList.remove('hidden');
                advancedChevron.classList.add('rotate');
                advancedChevron.innerText = '▼';
            } else {
                advancedContent.classList.add('hidden');
                advancedChevron.classList.remove('rotate');
                advancedChevron.innerText = '▶';
            }
        });
    }

    clearLogsBtn.addEventListener('click', () => {
        logContainer.innerHTML = '';
    });

    settingsBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'openSettings' });
    });

    // Auto-sync checkboxes and inputs back to extension
    const syncToExtension = () => {
        if (isRunning) return;
        vscode.postMessage({
            command: 'syncConfig',
            config: {
                mode: modeSelect.value,
                model: modelSelect.value,
                promptFile: promptFile.value,
                taskFile: taskFile.value,
                progressFile: progressFile.value,
                maxIterations: parseInt(maxIterations.value),
                stableThreshold: parseInt(stableThreshold.value),
                pseudoRalph: pseudoRalph.checked,
                useGit: useGit.checked,
                createBranch: createBranch.checked
            }
        });
    };

    [modeSelect, modelSelect, promptFile, taskFile, progressFile, maxIterations, stableThreshold, pseudoRalph, useGit, createBranch].forEach(el => {
        el.addEventListener('change', syncToExtension);
    });

    // Notify extension dashboard is ready
    vscode.postMessage({ command: 'ready' });
})();
