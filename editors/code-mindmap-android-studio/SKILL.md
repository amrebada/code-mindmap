---
name: code-mindmap-android-studio
description: Code Mind Map preconfigured for Android Studio (JetBrains) — build a rule-of-7 mind map of a codebase (≤7 children per level, every leaf a function with a what/how explanation) and render an interactive HTML tree whose functions click straight open in Android Studio. Use when the user wants a project mind map and uses Android Studio (or another JetBrains IDE).
license: MIT
metadata:
  author: amrebada
  version: "1.0.0"
  variant_of: code-mindmap
  editor: android-studio
---

# Code Mind Map — Android Studio

This is the **Android Studio** variant of [`code-mindmap`](../../SKILL.md). Do everything exactly as the core skill describes — **scout → map (parallel Explore agents) → enrich every function with `explanation`+`steps` → validate → render** — with one thing fixed: the click-to-open links target Android Studio.

Android Studio is a **JetBrains** IDE (IntelliJ platform), so it does *not* use a `scheme://file` URL like the VS Code family. Instead it opens files through its **built-in web server** on `localhost:63342`:

```
http://localhost:63342/api/file/<absolute-path>:<line>
```

The same skill works for any JetBrains IDE — IntelliJ IDEA, PyCharm, WebStorm, GoLand — they all use the built-in server (set `editor` accordingly).

## The only difference: render for Android Studio

Pass `editor: "android-studio"` to the core build script so each function/path emits a built-in-server link:

```
node ../../scripts/build.mjs /path/to/config.json
# config.json:
# {
#   "rootPath":  "/abs/enriched-tree.json",   // or "root": <tree object>
#   "outPath":   "~/.agent/diagrams/<name>-mindmap.html",
#   "repoRoot":  "<git rev-parse --show-toplevel>",
#   "editor":    "android-studio",            // or "intellij" / "pycharm" / "webstorm" / "goland"
#   "idePort":   63342,                         // override only if you run several JetBrains IDEs
#   "title": "...", "subtitle": "...", "footer": "...", "date": "YYYY-MM-DD"
# }
```

## Make the links actually open (one-time setup — tell the user)

The built-in server is stricter than a URL scheme. For clicks to land:
1. **Android Studio must be running with the project open** (the project that contains `repoRoot`).
2. The built-in server is on by default at port **63342**. If you run more than one JetBrains IDE at once, the second takes **63343**, etc. — set `idePort` to match (find it under *Settings → Build, Execution, Deployment → Debugger → Built-in server*).
3. The first request usually shows an in-IDE confirmation popup ("Open file in IntelliJ IDEA / Android Studio?"). To skip it, enable *Settings → Build, Execution, Deployment → Debugger → Built-in server → **Allow unsigned requests**.*

Smoke-test before promising it works (IDE running, project open):
`curl -s "http://localhost:63342/api/file/$(pwd)/README.md:1" >/dev/null && echo ok` — README should jump to the front in the IDE.

> Fallback if the built-in server is blocked: the IDE also has a CLI launcher — `studio --line <n> <file>` (or `idea --line <n> <file>`) opens a file at a line. That isn't browser-clickable, but it's a reliable manual alternative.

Everything else (the rule-of-7 contract, the recursive node schema, the enrichment requirement, the quality gate) is in the core skill — follow it verbatim.
