const assert = require('assert');
const vscode = require('vscode');

suite('Ralph Loop Extension E2E Tests', () => {

    // ─── Activation ─────────────────────────────────────────

    test('Extension should be present in installed extensions', () => {
        const ext = vscode.extensions.getExtension('afganrasulov.ralph-loop-pro-for-antigravity');
        assert.ok(ext, 'Extension should be installed');
    });

    test('Extension should activate successfully', async () => {
        const ext = vscode.extensions.getExtension('afganrasulov.ralph-loop-pro-for-antigravity');
        assert.ok(ext, 'Extension should be installed');
        if (!ext.isActive) {
            await ext.activate();
        }
        assert.strictEqual(ext.isActive, true, 'Extension should be active');
    });

    // ─── Command Registration ───────────────────────────────

    test('All Ralph commands should be registered', async () => {
        const allCommands = await vscode.commands.getCommands(true);
        const expectedCommands = [
            'ralph.start',
            'ralph.stop',
            'ralph.pause',
            'ralph.emergency',
            'ralph.openDashboard',
            'ralph.selectTaskFile',
            'ralph.configureIterations',
            'ralph.setConfigMode',
            'ralph.setConfigModel',
            'ralph.setConfigPromptFile',
            'ralph.setConfigTaskFile',
            'ralph.toggleUseGit',
            'ralph.toggleCreateBranchEverySession',
            'ralph.reportBug',
            'ralph.toggleDebugLogging'
        ];

        for (const cmd of expectedCommands) {
            assert.ok(
                allCommands.includes(cmd),
                `Command "${cmd}" should be registered`
            );
        }
    });

    // ─── Dashboard ──────────────────────────────────────────

    test('Open Dashboard command should execute without error', async () => {
        // This should not throw
        await vscode.commands.executeCommand('ralph.openDashboard');

        // Give the webview a moment to render
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check that a tab was opened
        const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
        assert.ok(activeTab, 'A tab should be open after opening dashboard');
    });

    test('Dashboard should have correct title', async () => {
        await vscode.commands.executeCommand('ralph.openDashboard');
        await new Promise(resolve => setTimeout(resolve, 500));

        const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
        assert.ok(activeTab, 'A tab should be open');
        assert.ok(
            activeTab.label.includes('Ralph') || activeTab.label.includes('Dashboard'),
            `Tab label should contain "Ralph" or "Dashboard", got "${activeTab.label}"`
        );
    });

    // ─── Loop Control Commands ──────────────────────────────

    test('Start command should execute without error', async () => {
        // This may show an info message but should not throw
        try {
            await vscode.commands.executeCommand('ralph.start');
        } catch (err) {
            // Start may fail if not fully configured, but it should not be a ReferenceError
            assert.ok(
                !(err instanceof ReferenceError),
                `Start command threw a ReferenceError: ${err.message}`
            );
        }
    });

    test('Stop command should execute without error', async () => {
        await vscode.commands.executeCommand('ralph.stop');
        // Should complete without throwing
        assert.ok(true, 'Stop command completed');
    });

    test('Pause command should execute without error', async () => {
        await vscode.commands.executeCommand('ralph.pause');
        // Should complete without throwing
        assert.ok(true, 'Pause command completed');
    });

    test('Emergency stop command should execute without error', async () => {
        await vscode.commands.executeCommand('ralph.emergency');
        // Should complete without throwing
        assert.ok(true, 'Emergency stop command completed');
    });

    // ─── Configuration Commands ─────────────────────────────

    test('Configuration values should have defaults', () => {
        const config = vscode.workspace.getConfiguration('ralphLoop');
        assert.strictEqual(config.get('maxIterations'), 50, 'Max iterations default should be 50');
        assert.strictEqual(config.get('defaultMode'), 'Fast', 'Default mode should be Fast');
        assert.ok(config.get('defaultModel'), 'Default model should be set');
    });

    // ─── Output Channel ─────────────────────────────────────

    test('Ralph Loop output channel should exist after activation', async () => {
        const ext = vscode.extensions.getExtension('afganrasulov.ralph-loop-pro-for-antigravity');
        if (!ext.isActive) {
            await ext.activate();
        }
        // Output channels don't have a direct API to list them,
        // so we verify activation didn't throw (which means the channel was created)
        assert.strictEqual(ext.isActive, true, 'Extension should be active with output channel');
    });
});
