# Ralph Loop Pro for Antigravity

> ⚠️ **ALPHA RELEASE** — This extension is under active development. Bugs are expected; updates and improvements will be shipped regularly.

An autonomous AI agent extension for Antigravity that automates multi-step coding tasks through intelligent loop execution, dynamic model selection, and real-time progress tracking.

## Overview

AI coding assistants are powerful, but they come with two fundamental limitations:

1. **Context decay** — Large Language Models lose track of important details as conversations grow longer.
2. **Manual babysitting** — Developers must constantly guide the AI, re-prompting after every completed step.

Ralph Loop Pro eliminates both problems. It externalizes the AI's memory into persistent files and orchestrates the agent in automated, iterative cycles. Each cycle gets a fresh context window, reads what's been done from disk, and picks up exactly where the last one left off — all without human intervention.

This extension brings that workflow into VS Code with an intuitive sidebar, real-time status tracking, and one-click loop control.

## Quick Start

1. **Install the extension** — via VSIX file or from the [Open VSX Registry](https://open-vsx.org/extension/afganrasulov/ralph-loop-pro-for-antigravity)
2. **Prepare your task file** — Write a PRD or specification document broken into discrete tasks (see [Task File Format](#task-file-format))
   - 💡 *Tip: Use Antigravity's **Planning mode** to generate a well-structured PRD automatically*
3. **Open the sidebar** — Click the Ralph Loop icon in the Activity Bar
4. **Configure your session:**
   - Pick your task file (default: `PRD.md`)
   - Set a progress file (default: `progress.txt`)
   - Choose a mode and AI model
   - Define the maximum number of iterations
5. **Hit play** — The loop starts, and the agent works autonomously through your tasks

> **💡 Recommended Workflow:**
> Start with **Planning mode** to draft and refine your task file.
> Then switch to **Fast mode** and let Ralph Loop execute the work automatically.

## File Structure

Ralph Loop uses a straightforward, file-based architecture — no databases, no hidden state:

| File | Role | Details |
|------|------|---------|
| `PRD.md` | Task Specification | Contains your requirements and task list. **Read-only** — the agent never modifies this file. |
| `progress.txt` | Progress Journal | The agent appends entries here after each step. Acts as the single source of truth for what's been completed. |
| `prompt.md` | Custom Instructions | Optional file for additional guidance or constraints you want the agent to follow. |

### Task File Format

Your task file should be a clear specification organized into **self-contained, actionable tasks**. The agent cross-references this file with `progress.txt` to determine what to work on next.

```markdown
# PRD: User Management System

## Overview
Build a user management system with authentication, profiles, and admin controls.

## Task 1: Authentication
Implement JWT-based authentication with login/logout endpoints.
- POST /api/auth/login
- POST /api/auth/logout
- Token refresh mechanism

## Task 2: User Profiles
Create user profile CRUD operations.
- GET/PUT /api/users/:id
- Profile picture upload
- Email verification

## Task 3: Admin Dashboard
Build admin interface for user management.
- List all users with pagination
- Suspend/activate accounts
- View user activity logs
```

**The golden rule:** Every `## Task N:` section should be small enough for the agent to complete in a single iteration, yet specific enough to produce meaningful output.

### Progress File Format

The agent logs its work automatically. Each entry creates a traceable record:

```bash
[2026-01-21 10:30] Started: Task 1 - User Authentication
[2026-01-21 10:45] Created auth module in src/auth/
[2026-01-21 11:00] Completed: Task 1 - User Authentication
[2026-01-21 11:05] Started: Task 2 - Database Migrations
```

## Features

### 🎛️ Dedicated Sidebar

Ralph Loop occupies its own panel in the Activity Bar, giving you full visibility and control:

- **Live Session Info** — See the current status, active mode, selected model, iteration count, and elapsed time at a glance
- **Quick Configuration** — Adjust any setting with a single click:
  - Mode (Fast / Planning)
  - AI Model
  - Max Iterations
  - Prompt, Task & Progress files

### 📊 Status Bar Integration

A persistent indicator in the VS Code status bar keeps you informed without switching views:

- Loop state: `Running` · `Paused` · `Stopped`
- Current iteration: `15/50`
- Elapsed time: `2m 34s`

### 📝 Output Channel

The **Ralph Loop** output channel streams everything happening under the hood:

- Real-time agent responses
- Iteration boundaries and phase markers
- Progress summaries per cycle

### 🔄 Smart Auto-Completion

When a loop begins, Ralph generates a unique completion marker (e.g., `ralph-done-a3x9k`). The agent appends this marker to the progress file once every task is finished.

Before each new iteration, Ralph scans the progress file for this marker. If found, the loop ends on its own — no manual intervention required.

- ✅ Loops stop automatically when all work is done
- ✅ Unique markers per session prevent false positives from previous runs
- ✅ Manual stop is always available as a fallback

## Commands

| Command | What It Does |
|---------|-------------|
| `Ralph: Start Ralph Loop` | Launch a new autonomous loop session |
| `Ralph: Stop Ralph Loop` | Gracefully stop after the current iteration finishes |
| `Ralph: Pause/Resume Ralph Loop` | Toggle between paused and running states |
| `Ralph: Emergency Stop Ralph Loop` | Immediately terminate the loop mid-iteration |

## Configuration

Customize Ralph Loop through VS Code Settings (`Preferences → Open Settings`):

| Setting | Default | Description |
|---------|---------|-------------|
| `ralphLoop.maxIterations` | `50` | Maximum number of iterations per loop |
| `ralphLoop.defaultMode` | `Fast` | Default operating mode |
| `ralphLoop.defaultModel` | `Gemini 3 Flash` | Default AI model for new sessions |
| `ralphLoop.promptFile` | `None` | Path to a custom prompt file |
| `ralphLoop.taskFile` | `PRD.md` | Path to your task specification |
| `ralphLoop.progressFile` | `progress.txt` | Path to the progress journal |

## How It Works

1. **Fresh Context Every Cycle** — Each iteration starts a brand-new Cascade session with a clean context window, referencing only your task and progress files.

2. **Structured Agent Instructions** — The agent receives explicit directives:
   - Read pending tasks from your task file
   - Check the progress journal for completed work
   - Execute exactly one task per iteration
   - Append results to the progress file (never delete previous entries)
   - Commit changes to version control

3. **Disk-Based Memory** — All state lives in `progress.txt` on your filesystem, not in the AI's volatile memory. Context is rebuilt from scratch every iteration, making the process resilient to token limits.

4. **Graceful Shutdown** — The stop command lets the current iteration finish before halting.

5. **Emergency Kill** — Instantly terminates the loop when something goes wrong.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| *"No task file selected"* | Choose a task file from the sidebar's Configuration panel |
| *"No workspace folder open"* | Open a project folder in VS Code before starting a loop |
| *Loop not responding* | Use `Ralph: Emergency Stop Ralph Loop` from the Command Palette |
| *Agent working in wrong directory* | The extension auto-opens your task file to anchor the workspace — ensure it's inside the correct project |

## Links

- 📦 [Open VSX Registry](https://open-vsx.org/extension/afganrasulov/ralph-loop-pro-for-antigravity)
- 🐙 [GitHub Repository](https://github.com/afganrasulov/ralph-loop-pro-for-antigravity)
- 🐛 [Report Issues](https://github.com/afganrasulov/ralph-loop-pro-for-antigravity/issues)

## License

MIT

---

*Transform Antigravity into a fully autonomous, self-driving coding agent.*
