---
name: code-mindmap-antigravity
description: Code Mind Map preconfigured for Antigravity IDE — build a rule-of-7 mind map of a codebase (≤7 children per level, every leaf a function with a what/how explanation) and render an interactive HTML tree whose functions click straight open in Antigravity IDE. Use when the user wants a project mind map and uses Antigravity IDE.
license: MIT
metadata:
  author: amrebada
  version: "1.0.0"
  variant_of: code-mindmap
  editor: antigravity-ide
---

# Code Mind Map — Antigravity IDE

This is the **Antigravity IDE** variant of [`code-mindmap`](../../SKILL.md). Do everything exactly as the core skill describes — **scout → map (parallel Explore agents) → enrich every function with `explanation`+`steps` → validate → render** — with one thing fixed: the click-to-open links target Antigravity IDE.

## The only difference: render for Antigravity IDE

Antigravity IDE is a VS Code fork; its editor app (`Antigravity IDE.app`) registers the `antigravity-ide` URL scheme. **Heads-up:** there is also a separate `Antigravity.app` that uses the scheme `antigravity` and is *not* the editor — use `antigravity-ide`.

When you render, pass `editor: "antigravity-ide"` so each function/path deep-links via `antigravity-ide://file/<abs>:<line>:<col>`:

```
node ../../scripts/build.mjs /path/to/config.json
# config.json:
# {
#   "rootPath":  "/abs/enriched-tree.json",   // or "root": <tree object>
#   "outPath":   "~/.agent/diagrams/<name>-mindmap.html",
#   "repoRoot":  "<git rev-parse --show-toplevel>",
#   "editor":    "antigravity-ide",
#   "title": "...", "subtitle": "...", "footer": "...", "date": "YYYY-MM-DD"
# }
```

Verify the scheme before promising it works: `open "antigravity-ide://file/$(pwd)/README.md:1"` (macOS) should focus Antigravity IDE. First click from a browser shows a one-time "Open Antigravity IDE?" prompt — that's expected.

Everything else (the rule-of-7 contract, the recursive node schema, the enrichment requirement, the quality gate) is in the core skill — follow it verbatim.
