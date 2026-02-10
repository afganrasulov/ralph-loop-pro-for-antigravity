(function () {
    const vscode = acquireVsCodeApi();

    // UI Elements
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const clearLogsBtn = document.getElementById('clearLogsBtn');

    const modeSelect = document.getElementById('modeSelect');
    const modelSelect = document.getElementById('modelSelect');
    const maxIterations = document.getElementById('maxIterations');

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
            case 'appendLog':
                appendLog(message.text, message.level);
                break;
        }
    });

    function updateUI(state) {
        isRunning = state.status === 'running';
        isPaused = state.status === 'paused';

        statusText.innerText = state.status.toUpperCase();
        statusBadge.className = `status-badge ${state.status}`;

        iterCount.innerText = `${state.currentIteration} / ${state.maxIterations}`;
        elapsedTime.innerText = state.elapsedTime || '00:00';
        cascadeId.innerText = state.cascadeId || 'None';

        // Button States
        startBtn.disabled = isRunning;
        pauseBtn.disabled = !isRunning && !isPaused;
        pauseBtn.innerText = isPaused ? '▶ Resume' : '⏸ Pause';
        stopBtn.disabled = !isRunning && !isPaused;

        // Config Inputs (only disable when running)
        modeSelect.disabled = isRunning || isPaused;
        modelSelect.disabled = isRunning || isPaused;
        maxIterations.disabled = isRunning || isPaused;

        // Sync values if they changed
        if (state.mode) modeSelect.value = state.mode;
        if (state.model) modelSelect.value = state.model;
        if (state.maxIterations) maxIterations.value = state.maxIterations;
    }

    function appendLog(text, level = 'info') {
        const entry = document.createElement('div');
        entry.className = 'log-entry';

        const time = new Date().toLocaleTimeString([], { hour12: false });
        entry.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-${level}">${text}</span>`;

        logContainer.appendChild(entry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    // Event Handlers
    startBtn.addEventListener('click', () => {
        vscode.postMessage({
            command: 'start',
            config: {
                mode: modeSelect.value,
                model: modelSelect.value,
                maxIterations: parseInt(maxIterations.value)
            }
        });
    });

    pauseBtn.addEventListener('click', () => {
        vscode.postMessage({ command: isPaused ? 'resume' : 'pause' });
    });

    stopBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'stop' });
    });

    clearLogsBtn.addEventListener('click', () => {
        logContainer.innerHTML = '';
    });

    // Notify extension dashboard is ready
    vscode.postMessage({ command: 'ready' });
})();
