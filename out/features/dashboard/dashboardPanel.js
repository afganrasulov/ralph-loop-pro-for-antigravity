"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function (o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function () { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function (o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function (o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function (o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function (o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const modelRegistry = __importStar(require("../antigravity-client/modelRegistry"));

class DashboardPanel {
    constructor(panel, extensionUri) {
        this._disposables = [];
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Update the content based on view changes
        this._panel.onDidChangeViewState(() => {
            if (this._panel.visible) {
                this._update();
                this._sendInitialState();
            }
        }, null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'start':
                    await this._handleSyncConfig(message.config);
                    loopCommands.startRalphLoop(undefined);
                    break;
                case 'syncConfig':
                    await this._handleSyncConfig(message.config);
                    break;
                case 'stop':
                    loopCommands.stopRalphLoop();
                    break;
                case 'pause':
                    loopCommands.pauseRalphLoop();
                    break;
                case 'resume':
                    loopCommands.pauseRalphLoop();
                    break;
                case 'openSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'ralphLoop');
                    break;
                case 'ready':
                    this._sendModels();
                    this._sendInitialState();
                    break;
            }
        }, null, this._disposables);

        // Periodically update the UI with dynamic state (status, timer, iterations)
        this._updateInterval = setInterval(() => {
            this._sendInitialState();
        }, 1000);
    }

    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            DashboardPanel.viewType,
            "Ralph Loop Dashboard",
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(extensionUri.fsPath, 'resources')),
                    vscode.Uri.file(path.join(extensionUri.fsPath, 'out'))
                ]
            }
        );

        DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri);
    }

    dispose() {
        DashboardPanel.currentPanel = undefined;
        this._panel.dispose();
        if (this._updateInterval) clearInterval(this._updateInterval);
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) x.dispose();
        }
    }

    async _handleSyncConfig(config) {
        if (!config) return;
        const cfg = vscode.workspace.getConfiguration("ralphLoop");
        const workspaceState = state.extensionContext?.workspaceState;

        if (config.mode) await cfg.update("defaultMode", config.mode, vscode.ConfigurationTarget.Workspace);
        if (config.model) await cfg.update("defaultModel", config.model, vscode.ConfigurationTarget.Workspace);
        if (config.maxIterations !== undefined) await cfg.update("maxIterations", config.maxIterations, vscode.ConfigurationTarget.Workspace);
        if (config.promptFile !== undefined) await cfg.update("promptFile", config.promptFile, vscode.ConfigurationTarget.Workspace);
        if (config.taskFile !== undefined) await cfg.update("taskFile", config.taskFile, vscode.ConfigurationTarget.Workspace);
        if (config.progressFile !== undefined) await cfg.update("progressFile", config.progressFile, vscode.ConfigurationTarget.Workspace);
        if (config.stableThreshold !== undefined) await cfg.update("stableThreshold", config.stableThreshold, vscode.ConfigurationTarget.Workspace);

        if (workspaceState) {
            if (config.useGit !== undefined) await workspaceState.update("ralph.useGit", config.useGit);
            if (config.createBranch !== undefined) await workspaceState.update("ralph.createBranchEverySession", config.createBranch);
            if (config.pseudoRalph !== undefined) await workspaceState.update("ralph.pseudoRalphMode", config.pseudoRalph);
        }

        if (state.setPseudoRalphMode) state.setPseudoRalphMode(config.pseudoRalph);
    }

    _sendModels() {
        const models = modelRegistry.getModelList().map(name => ({
            name: name,
            id: name // We use name as ID for the selection usually
        }));
        this._panel.webview.postMessage({
            type: 'updateModels',
            models: models,
            currentModel: vscode.workspace.getConfiguration("ralphLoop").get("defaultModel")
        });
    }

    _sendInitialState() {
        const elapsedTime = state.startTime
            ? this._formatElapsedTime(new Date().getTime() - state.startTime.getTime())
            : "00:00";

        const workspaceState = state.extensionContext?.workspaceState;

        this._panel.webview.postMessage({
            type: 'updateState',
            state: {
                status: state.ralphLoopStatus,
                currentIteration: state.currentIteration,
                maxIterations: state.maxIterations,
                elapsedTime: elapsedTime,
                cascadeId: state.currentCascadeId,
                mode: config.get("defaultMode"),
                model: config.get("defaultModel"),
                promptFile: config.get("promptFile"),
                taskFile: config.get("taskFile"),
                progressFile: config.get("progressFile"),
                stableThreshold: config.get("stableThreshold"),
                pseudoRalphMode: workspaceState ? workspaceState.get("ralph.pseudoRalphMode", false) : state.pseudoRalphMode,
                useGit: workspaceState ? workspaceState.get("ralph.useGit", true) : true,
                createBranchEverySession: workspaceState ? workspaceState.get("ralph.createBranchEverySession", true) : true
            }
        });
    }

    _formatElapsedTime(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    _update() {
        const webview = this._panel.webview;
        this._panel.title = "Ralph Loop Dashboard";
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    _getHtmlForWebview(webview) {
        const resourcePath = path.join(this._extensionUri.fsPath, 'resources');
        const htmlPath = path.join(resourcePath, 'dashboard.html');
        let html = fs.readFileSync(htmlPath, 'utf8');

        const cssUri = webview.asWebviewUri(vscode.Uri.file(path.join(resourcePath, 'dashboard.css')));
        const jsUri = webview.asWebviewUri(vscode.Uri.file(path.join(resourcePath, 'dashboard.js')));
        const logoUri = webview.asWebviewUri(vscode.Uri.file(path.join(resourcePath, 'icons', 'logo.png')));

        html = html.replace('{cssUri}', cssUri.toString());
        html = html.replace('{jsUri}', jsUri.toString());
        html = html.replace('{logoUri}', logoUri.toString());

        return html;
    }
}
exports.DashboardPanel = DashboardPanel;
DashboardPanel.viewType = 'ralphLoopDashboard';
DashboardPanel.currentPanel = undefined;
