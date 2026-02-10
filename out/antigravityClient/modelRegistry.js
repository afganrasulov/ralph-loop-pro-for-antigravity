"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialize = initialize;
exports.getModelList = getModelList;
exports.getModelId = getModelId;
exports.getDefaultModel = getDefaultModel;
exports.refreshModels = refreshModels;

const vscode = require("vscode");
const path = require("path");
const fs = require("fs");

// Hardcoded fallback — used when both remote fetch and local file fail
const FALLBACK_MODELS = [
    { name: "Gemini 3 Flash", id: 1018 },
    { name: "Gemini 3 Pro (Low)", id: 1007 },
    { name: "Gemini 3 Pro (High)", id: 1008 },
    { name: "Claude Sonnet 4.5", id: 333 },
    { name: "Claude Sonnet 4.5 (Thinking)", id: 334 },
    { name: "Claude Opus 4.6", id: 1012 },
    { name: "Claude Opus 4.6 (Thinking)", id: 1012 },
    { name: "GPT-OSS-120B (Medium)", id: 342 },
];
const FALLBACK_DEFAULT = "Gemini 3 Flash";

// Default remote URL (GitHub Gist raw URL — will be set after creating the Gist)
const DEFAULT_REGISTRY_URL = "https://raw.githubusercontent.com/afganrasulov/ralph-loop-models/main/models.json";
// Cache TTL: 1 hour
const CACHE_TTL_MS = 60 * 60 * 1000;

let cachedModels = null;
let cachedDefault = FALLBACK_DEFAULT;
let lastFetchTime = 0;
let extensionContext = null;
let outputChannel = null;

/**
 * Initialize the model registry. Call this during extension activation.
 * @param {vscode.ExtensionContext} context
 * @param {vscode.OutputChannel} channel
 */
async function initialize(context, channel) {
    extensionContext = context;
    outputChannel = channel;
    // Load from cache first (instant startup)
    const cached = context.globalState.get("ralph.modelRegistry");
    if (cached && cached.models && Array.isArray(cached.models)) {
        cachedModels = cached.models;
        cachedDefault = cached.default || FALLBACK_DEFAULT;
        lastFetchTime = cached.fetchTime || 0;
        log(`Loaded ${cachedModels.length} models from cache`);
    }
    // Try to refresh from remote (non-blocking)
    refreshModels().catch((err) => {
        log(`Background model refresh failed: ${err.message}`);
    });
}

/**
 * Refresh models from remote registry or local file.
 */
async function refreshModels() {
    const config = vscode.workspace.getConfiguration("ralphLoop");
    const registryUrl = config.get("modelRegistryUrl", DEFAULT_REGISTRY_URL);
    // Try remote first
    if (registryUrl) {
        try {
            const data = await fetchRemoteModels(registryUrl);
            if (data && data.models && data.models.length > 0) {
                cachedModels = data.models;
                cachedDefault = data.default || FALLBACK_DEFAULT;
                lastFetchTime = Date.now();
                // Persist to global state
                if (extensionContext) {
                    await extensionContext.globalState.update("ralph.modelRegistry", {
                        models: cachedModels,
                        default: cachedDefault,
                        fetchTime: lastFetchTime,
                        version: data.version,
                    });
                }
                log(`Fetched ${cachedModels.length} models from remote registry (v${data.version})`);
                return;
            }
        }
        catch (err) {
            log(`Remote fetch failed: ${err.message}, trying local file...`);
        }
    }
    // Fallback: load from bundled models.json
    try {
        const localModels = loadLocalModels();
        if (localModels && localModels.models && localModels.models.length > 0) {
            cachedModels = localModels.models;
            cachedDefault = localModels.default || FALLBACK_DEFAULT;
            log(`Loaded ${cachedModels.length} models from local models.json`);
            return;
        }
    }
    catch (err) {
        log(`Local models.json load failed: ${err.message}`);
    }
    // Ultimate fallback: hardcoded
    if (!cachedModels) {
        cachedModels = FALLBACK_MODELS;
        cachedDefault = FALLBACK_DEFAULT;
        log(`Using hardcoded fallback models (${cachedModels.length} models)`);
    }
}

/**
 * Fetch models from a remote URL.
 */
async function fetchRemoteModels(url) {
    // Use native https module for VS Code extension compatibility
    const https = require("https");
    const http = require("http");
    const mod = url.startsWith("https") ? https : http;
    return new Promise((resolve, reject) => {
        const req = mod.get(url, { timeout: 5000 }, (res) => {
            // Follow redirects (GitHub Gist raw URLs may redirect)
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchRemoteModels(res.headers.location).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => {
                try {
                    resolve(JSON.parse(data));
                }
                catch (e) {
                    reject(new Error(`Invalid JSON: ${e.message}`));
                }
            });
        });
        req.on("error", reject);
        req.on("timeout", () => {
            req.destroy();
            reject(new Error("Request timeout"));
        });
    });
}

/**
 * Load models from the bundled models.json file.
 */
function loadLocalModels() {
    // Try multiple possible paths
    const possiblePaths = [
        path.join(__dirname, "..", "..", "models.json"),
        path.join(__dirname, "..", "models.json"),
    ];
    for (const p of possiblePaths) {
        try {
            if (fs.existsSync(p)) {
                const content = fs.readFileSync(p, "utf8");
                return JSON.parse(content);
            }
        }
        catch (e) {
            // Continue to next path
        }
    }
    return null;
}

/**
 * Get the list of model names for QuickPick.
 * @returns {string[]}
 */
function getModelList() {
    if (!cachedModels) {
        return FALLBACK_MODELS.map((m) => m.name);
    }
    return cachedModels.map((m) => m.name);
}

/**
 * Get the model ID for a given model name.
 * @param {string} modelName
 * @returns {number}
 */
function getModelId(modelName) {
    const models = cachedModels || FALLBACK_MODELS;
    const model = models.find((m) => m.name === modelName);
    if (model) {
        return model.id;
    }
    // Fallback to default model's ID
    const defaultModel = models.find((m) => m.name === (cachedDefault || FALLBACK_DEFAULT));
    return defaultModel ? defaultModel.id : 1018; // Ultimate fallback: Gemini 3 Flash
}

/**
 * Get the default model name.
 * @returns {string}
 */
function getDefaultModel() {
    return cachedDefault || FALLBACK_DEFAULT;
}

function log(message) {
    if (outputChannel) {
        outputChannel.appendLine(`[ModelRegistry] ${message}`);
    }
}
//# sourceMappingURL=modelRegistry.js.map
