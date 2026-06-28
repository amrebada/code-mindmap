# 🧠 Code Mind Map

> A [Claude](https://claude.com/claude-code) **agent skill** that turns any codebase into a navigable, rule-of-7 mind map — recursively split into at most **7** children per level, all the way down to **individual functions** — and renders it as a single self-contained, interactive HTML page.

Every function leaf gets a plain-English **"what it does"** and a step-by-step **"how it works"**, and **clicking it opens the exact file and line in your editor**.

![rule-of-7: chunks → groups → packages → files → functions](https://img.shields.io/badge/Miller's_rule-≤7_per_level-a78bfa) ![license](https://img.shields.io/badge/license-MIT-34d399) ![node](https://img.shields.io/badge/render-Node_≥18-38bdf8)

---

## What you get

A single HTML file (no build step, no server, just Google Fonts) with:

- **Rule-of-7 tree** — chunks → thematic groups → packages → files → functions. No node ever has more than 7 children, so it stays navigable instead of a flat dump.
- **Function detail panels** — click any function to read *what it does* + a numbered *how it works* walkthrough of the real control flow.
- **Click-to-open in your editor** — every function / file deep-links to its exact line (`vscode://`, `cursor://`, `antigravity-ide://`, or the JetBrains built-in server for Android Studio).
- **Live search** — matches names, summaries, refs, **and** the explanation/steps text; highlights hits and auto-expands their ancestors.
- **Expand/collapse all, depth buttons (L1–L4 / all)**, a KPI strip (functions, explained, packages, files, groups, depth), and built-in light + dark themes.

## The rule-of-7 contract

1. **Every node has ≤ 7 children**, at every depth.
2. If a real grouping exceeds 7, invent thematic **group** nodes ("Auth & Identity", "Render Pipeline", "Payment Adapters") and push items beneath them — recurse until each level is ≤ 7.
3. Decompose down to **functions** (`ref: "path:line"`). Collapse only generated/trivial code, and say so.
4. Prefer **balance** — 4–7 children per interior node beats 1–2. Depth is free; width is capped at 7.

## How it works

The skill is built for Claude Code's multi-agent **Workflow** tool:

1. **Scout** — measure the repo (dirs + LOC) and pick ≤ 7 top-level chunks by subsystem.
2. **Map** — fan out one read-only `Explore` agent per chunk; each returns a balanced ≤7-ary subtree down to functions (recursive structured output).
3. **Enrich** — one agent per source file reads the real code and writes each function's `explanation` + `steps`.
4. **Validate & render** — [`scripts/build.mjs`](scripts/build.mjs) enforces the contract (≤7 children, every function has explanation + steps + ref, no empty/starved nodes) and **refuses to render on any violation**, then injects the tree into [`templates/renderer.html`](templates/renderer.html).

## Editor variants

The core skill auto-detects your editor. For zero-friction, the [`editors/`](editors/) folder has preconfigured variants — each just presets the link target:

| Skill | Editor | Link style |
|---|---|---|
| [`code-mindmap`](SKILL.md) | any (detects / asks) | — |
| [`code-mindmap-vscode`](editors/code-mindmap-vscode/) | VS Code (+ Insiders) | `vscode://file/<abs>:<line>` |
| [`code-mindmap-cursor`](editors/code-mindmap-cursor/) | Cursor | `cursor://file/<abs>:<line>` |
| [`code-mindmap-antigravity`](editors/code-mindmap-antigravity/) | Antigravity IDE | `antigravity-ide://file/<abs>:<line>` |
| [`code-mindmap-android-studio`](editors/code-mindmap-android-studio/) | Android Studio / IntelliJ / PyCharm / WebStorm / GoLand | `http://localhost:63342/api/file/<abs>:<line>` (built-in server) |

> Also supported via config: `windsurf` (`windsurf://`). JetBrains links need the IDE running with the project open — see the [Android Studio variant](editors/code-mindmap-android-studio/SKILL.md) for the one-time setup.

## Install

**Via [skills.sh](https://skills.sh):** search for `code-mindmap` and install.

**Manually** (Claude Code personal skills):

```bash
git clone https://github.com/amrebada/code-mindmap.git ~/.claude/skills/code-mindmap
# the editor variants come along inside editors/
```

Then in Claude Code:

```
/code-mindmap            # auto-detect editor
/code-mindmap-cursor     # or a specific editor variant
```

…or just ask: *"give me a mind map of this project down to every function."*

## Render a tree yourself

Try the bundled example first (renders to `examples/sample-mindmap.html`):

```bash
node scripts/build.mjs examples/sample.config.json
```

If you already have an assembled tree JSON, skip the agents and render directly:

```bash
node scripts/build.mjs config.json
```

```jsonc
// config.json
{
  "rootPath": "./tree.json",                  // the assembled tree (or "root": <object>)
  "outPath":  "./mymap.html",
  "repoRoot": "/abs/path/to/repo",            // git rev-parse --show-toplevel
  "editor":   "cursor",                       // vscode | cursor | antigravity-ide | android-studio | ...
  "title":    "My Project — Code Mind Map",
  "date":     "2026-06-28"
}
```

`build.mjs` validates the rule-of-7 contract and exits non-zero (without writing) if anything is off.

## Node schema

```jsonc
{
  "name": "PromoteManifest",
  "kind": "function",                      // chunk | group | package | file | function
  "ref":  "shared/db/promote.go:293",      // path, or path:line for functions (drives the IDE link)
  "summary": "Promote manifest dev→test→prod",          // ≤10 words
  "explanation": "Transactionally promotes a manifest to the next environment…",   // function leaves
  "steps": ["Validate direction", "Clone source manifest", "Write audit row", "Publish"],
  "children": []
}
```

## Requirements

- **Node ≥ 18** to run `scripts/build.mjs` (used for rendering + validation).
- **Claude Code** with the `Workflow` / `Agent` tools for the automated multi-agent mapping (or supply your own tree JSON and just render).
- The renderer output is a plain `.html` file — opens in any browser; macOS `open` / Linux `xdg-open`.

## Repo layout

```
code-mindmap/
├── SKILL.md                     # the core skill (procedure + contract)
├── templates/renderer.html      # self-contained interactive HTML renderer
├── scripts/build.mjs            # validate-the-contract + render
└── editors/                     # preconfigured per-editor variants
    ├── code-mindmap-vscode/
    ├── code-mindmap-cursor/
    ├── code-mindmap-antigravity/
    └── code-mindmap-android-studio/
```

## License

MIT © [amrebada](https://github.com/amrebada)
