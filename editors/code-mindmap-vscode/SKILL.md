---
name: code-mindmap-vscode
description: Code Mind Map preconfigured for Visual Studio Code — build a rule-of-7 mind map of a codebase (≤7 children per level, every leaf a function with a what/how explanation) and render an interactive HTML tree whose functions click straight open in VS Code. Use when the user wants a project mind map and uses VS Code.
license: MIT
metadata:
  author: amrebada
  version: "1.0.0"
  variant_of: code-mindmap
  editor: vscode
---

# Code Mind Map — VS Code

This is the **Visual Studio Code** variant of [`code-mindmap`](../../SKILL.md). Do everything exactly as the core skill describes — **scout → map (parallel Explore agents) → enrich every function with `explanation`+`steps` → validate → render** — with one thing fixed: the click-to-open links target VS Code.

## The only difference: render for VS Code

When you render, pass `editor: "vscode"` to the core build script so each function/path deep-links via `vscode://file/<abs>:<line>:<col>`:

```
node ../../scripts/build.mjs /path/to/config.json
# config.json:
# {
#   "rootPath":  "/abs/enriched-tree.json",   // or "root": <tree object>
#   "outPath":   "~/.agent/diagrams/<name>-mindmap.html",
#   "repoRoot":  "<git rev-parse --show-toplevel>",
#   "editor":    "vscode",
#   "title": "...", "subtitle": "...", "footer": "...", "date": "YYYY-MM-DD"
# }
```

Use `"editor": "vscode-insiders"` for the Insiders build.

Verify the scheme is registered before promising it works: `open "vscode://file/$(pwd)/README.md:1"` (macOS) should focus VS Code. First click from a browser shows a one-time "Open Visual Studio Code?" prompt — that's expected.

Everything else (the rule-of-7 contract, the recursive node schema, the enrichment requirement, the quality gate) is in the core skill — follow it verbatim.
