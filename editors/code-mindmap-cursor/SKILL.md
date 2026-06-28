---
name: code-mindmap-cursor
description: Code Mind Map preconfigured for Cursor — build a rule-of-7 mind map of a codebase (≤7 children per level, every leaf a function with a what/how explanation) and render an interactive HTML tree whose functions click straight open in Cursor. Use when the user wants a project mind map and uses Cursor.
license: MIT
metadata:
  author: amrebada
  version: "1.0.0"
  variant_of: code-mindmap
  editor: cursor
---

# Code Mind Map — Cursor

This is the **Cursor** variant of [`code-mindmap`](../../SKILL.md). Do everything exactly as the core skill describes — **scout → map (parallel Explore agents) → enrich every function with `explanation`+`steps` → validate → render** — with one thing fixed: the click-to-open links target Cursor.

## The only difference: render for Cursor

Cursor is a VS Code fork and registers the `cursor://` URL scheme. When you render, pass `editor: "cursor"` so each function/path deep-links via `cursor://file/<abs>:<line>:<col>`:

```
node ../../scripts/build.mjs /path/to/config.json
# config.json:
# {
#   "rootPath":  "/abs/enriched-tree.json",   // or "root": <tree object>
#   "outPath":   "~/.agent/diagrams/<name>-mindmap.html",
#   "repoRoot":  "<git rev-parse --show-toplevel>",
#   "editor":    "cursor",
#   "title": "...", "subtitle": "...", "footer": "...", "date": "YYYY-MM-DD"
# }
```

Verify the scheme before promising it works: `open "cursor://file/$(pwd)/README.md:1"` (macOS) should focus Cursor. First click from a browser shows a one-time "Open Cursor?" prompt — that's expected.

Everything else (the rule-of-7 contract, the recursive node schema, the enrichment requirement, the quality gate) is in the core skill — follow it verbatim.
