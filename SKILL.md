---
name: code-mindmap
description: Decompose a codebase into a strict rule-of-7 mind map — recursively split the code into at most 7 chunks per level, each chunk into at most 7 sub-chunks, down to the smallest unit (an individual function), and render it as an interactive collapsible HTML tree opened in the browser. Use when the user wants a structural mind map / overview of an entire project or large subsystem where every function is a leaf.
license: MIT
metadata:
  author: amrebada
  version: "1.0.0"
---

# Code Mind Map

Turn any codebase into a **Miller's-rule mind map**: at every level, at most **7** children. Big chunks → ≤7 sub-chunks → … → leaves that are **individual functions**. The output is a single self-contained, interactive **collapsible HTML tree** (expand/collapse, depth controls, live search) written to `~/.agent/diagrams/` and opened in the browser.

The hard, valuable part is **grouping**: a real package may have 30 functions, far past 7. The skill's job is to invent clean thematic **group** nodes so no level ever exceeds 7 — that is what makes the map navigable instead of a flat dump.

## When to use
- "Give me a mind map of the whole project / this service, down to every function."
- "Split the code into chunks of max 7, recursively, until each leaf is a function."
- Onboarding to an unfamiliar large codebase; producing a navigable structural atlas.

## The rule-of-7 contract (non-negotiable)
1. **Every node has ≤ 7 children**, at every depth. No exceptions.
2. If a real grouping would exceed 7 items, insert intermediate **`group`** nodes with clear thematic names ("Auth & Identity", "Webhook Verification", "Payment Adapters") and push items beneath them, recursing until each level is ≤ 7.
3. Decompose down to **leaves that are functions/methods** containing real logic (`kind:"function"`, `ref:"path:line"`). Collapse only trivial/generated code (e.g. one `"…accessors"` node), and say so.
4. Prefer **balance**: 4–7 children per interior node beats 1–2. Merge thin siblings into a parent group. Depth is free; width is capped at 7.

## Node schema
Each node: `{ name, kind, ref?, summary?, explanation?, steps?, children? }`
- `kind`: `chunk` (top level) · `group` (synthetic thematic bucket) · `package` (real pkg/module dir) · `file` (source file) · `function` (leaf).
- `ref`: `path` for files, `path:line` for functions, a representative dir for groups. Relative to the repo root. **This is what the IDE deep-link is built from**, so a function's `ref` MUST be `path:line` (the exact start line) for click-to-open to land on the right line.
- `summary`: ≤ 10 words, present tense, behaviour-focused. Skip for obvious grouping nodes.
- `explanation` (**function leaves — required**): 1–3 plain sentences saying *what* the function does and *why* it exists (its role/contract), not how. No line-number references.
- `steps` (**function leaves — required**): an ordered array of short strings describing *how* it works, step by step — the real control flow (guard clauses, branches, loops, the key call it delegates to, what it returns/raises). Aim for 3–7 steps; merge trivial lines. This is the body of the on-click detail panel, so write it for a reader who can't see the code.

Group/package/file/chunk nodes don't need `explanation`/`steps` — only function leaves do.

## Workflow

### 1. Scout (inline, fast)
Discover the top-level structure and size before fanning out — never guess the chunk boundaries:
```
find . -type d -not -path '*/node_modules/*' -not -path '*/.git/*' -maxdepth 3 | sort
# LOC per candidate chunk so you can balance the fan-out:
for d in <candidate dirs>; do echo "$(find "$d" -name '*.<ext>' | xargs wc -l | tail -1) $d"; done | sort -rn
```
Pick **≤ 7 top-level chunks** by subsystem (services, shared libs, each app, etc.). Heavy subsystems (a 12k-LOC handler package) become their own chunk; tiny sibling dirs get merged into one chunk.

### 2. Map (parallel — one agent per chunk)
For projects of any real size, fan out with the **Workflow** tool: one agent per top-level chunk, each producing its full balanced ≤7-ary subtree down to functions. This is the right shape because the grouping judgment is per-chunk and independent. Use `agentType: 'Explore'` (read-only, good at enumerate-then-read).

Key implementation notes (learned the hard way):
- **Recursive structured-output schema** must have a **typed object root** — a bare `$ref` root is rejected by the tool-input validator (`input_schema.type: Field required`). Wrap it:
  ```js
  const NODE = {
    type:'object', additionalProperties:false,
    properties:{ node:{ $ref:'#/$defs/node' } }, required:['node'],
    $defs:{ node:{ type:'object', additionalProperties:false,
      properties:{ name:{type:'string'}, kind:{type:'string',enum:['chunk','group','package','file','function']},
        ref:{type:'string'}, summary:{type:'string'},
        explanation:{type:'string'}, steps:{type:'array', items:{type:'string'}},
        children:{type:'array', items:{ $ref:'#/$defs/node' }} },
      required:['name','kind'] } },
  }
  ```
  Each agent returns `{node: <chunkRoot>}`; unwrap `.node` when assembling.
- Give each agent: its source paths, **chunk-specific grouping hints** (the themes to bucket into), and the rule-of-7 contract verbatim.
- Tell agents to enumerate with line numbers first, e.g.
  `rg -n "^func |^func \(|^export function |^export const .*=>|^class " <path>`, then read for grouping.
- **Require an `explanation` + `steps` for every function leaf** (see Node schema). The agent must actually READ each function body — not guess from the name — and write the step-by-step from the real control flow. This is the expensive part and the whole point of the detail panel; tell agents not to stop at file level and not to leave function leaves bare. (If a chunk comes back with function leaves missing `explanation`/`steps`, or stuck at file level, re-run just that chunk with a stricter prompt.)
- Assemble all chunk roots under one synthetic root `{name, kind:'chunk', children:[...]}` and `return` it.

For a **small** codebase (one package, a few files) skip the Workflow and build the tree in one pass directly.

### 3. Render (interactive HTML)
Read `./templates/renderer.html` and substitute the placeholders, then write to `~/.agent/diagrams/<name>-mindmap.html` and open it:
- `__TREE_DATA__` → `JSON.stringify(root)` (the assembled tree).
- `__TITLE__`, `__EYEBROW__`, `__SUBTITLE__`, `__META__`, `__FOOTER__` → page chrome.
- `__REPO_ROOT__` → the **absolute** path of the repo root (`git rev-parse --show-toplevel`). Turns repo-relative `ref`s into IDE deep-links.
- `__IDE_MODE__` → `vscode` or `jetbrains` (which link style to emit — see below).
- `__IDE_SCHEME__` → the vscode-family URL scheme (used when mode is `vscode`).
- `__IDE_PORT__` → the JetBrains built-in-server port (used when mode is `jetbrains`; default `63342`).

> Refs in the tree are repo-relative; safest to inject `__TREE_DATA__` and the page-chrome strings with a function replacer (`.replace('__TREE_DATA__', () => JSON.stringify(root))`) so any `$` in the data isn't interpreted by `String.replace`. Decode HTML entities (`&amp;`→`&`, etc.) in `name`/`summary`/`explanation`/`steps`/`ref` before injecting — the renderer re-escapes, so leaving them encoded would double-escape.

**Choosing the editor link style.** Two families:
- **VS Code family** (`__IDE_MODE__=vscode`) — clickable `scheme://file/<abs>:<line>:<col>`. Schemes: `vscode`, `vscode-insiders`, `cursor`, `windsurf`, `antigravity-ide`. (Note: Antigravity's editor app registers `antigravity-ide`; the separate `Antigravity.app` uses `antigravity` and is **not** the editor.)
- **JetBrains family** (`__IDE_MODE__=jetbrains`) — Android Studio / IntelliJ / PyCharm / WebStorm / GoLand open files via their **built-in web server**: `http://localhost:63342/api/file/<abs>:<line>`. The IDE must be running with the project open; it may show a one-time confirmation, or enable *Settings → Build, Execution, Deployment → Debugger → "Allow unsigned requests"*. Port increments (63343…) if several JetBrains IDEs run at once.

Pick by what the user uses — **prefer the preconfigured variants in [`editors/`](editors/)** (`code-mindmap-vscode`, `-cursor`, `-antigravity`, `-android-studio`), which just preset `editor` for `build.mjs`. To auto-detect on macOS: `for a in /Applications/*.app; do plutil -extract CFBundleURLTypes.0.CFBundleURLSchemes.0 raw "$a/Contents/Info.plist" 2>/dev/null; done` (or read `…/Contents/Resources/app/product.json`'s `urlProtocol`). Verify a scheme with `lsregister -dump | grep -i '<scheme>:'` and smoke-test `open "<scheme>://file/<abs>/<some>.go:10"`. Default to `vscode` if unsure.

The renderer is self-contained (Google Fonts only) and provides: KPI strip (function/explained/package/file/group counts, max depth), sticky toolbar with **live search** (matches name, summary, ref, **and the explanation/steps text** — highlights matches, auto-expands their ancestors), **expand/collapse all**, **depth buttons (L1–L4 / all)**, kind-colored legend, and a connector-railed collapsible tree. **Function leaves with an `explanation`/`steps` show a caret; clicking the row opens an inline detail panel ("what it does" + numbered "how it works"). Clicking a leaf with no detail, or clicking any node's `ref ↗`, deep-links the file/line into the editor.** It auto-computes all stats from the data — you only inject the tree + the IDE placeholders. Light + dark themes built in.

Open with `open ~/.agent/diagrams/<name>-mindmap.html` (macOS) / `xdg-open` (Linux). Tell the user the path.

## Quality checks
- **No level exceeds 7 children** — spot-check the widest interior nodes; if any > 7, the mapping agent failed its contract and the subtree must be regrouped.
- **Leaves are functions**, with `path:line` refs, not vague nouns.
- **Every function leaf has `explanation` + non-empty `steps`** — count them; a chunk that returns function leaves with no detail (or that stopped at file level) must be re-run. Skipped only for collapsed generated/trivial nodes, and note it.
- **Balanced** — few lonely single-child chains; thin siblings merged.
- **Exhaustive on meaningful functions** — collapsing should be limited to generated/trivial code and noted in a summary.
- Search a known function name; its row should highlight and its ancestors expand. Search a phrase from a function's behaviour; the explanation/steps text should match too.
- **IDE links resolve** — all `__…__` placeholders substituted (none left in the output); a sampled `ref ↗` opens the right file/line in the editor.

### Validate + render in one step

`./scripts/build.mjs` does all of the above — entity-decode, the full quality gate (≤7 children, every function leaf has `explanation`+`steps`+`ref`, no empty names, no starved chunks), placeholder substitution, and write — refusing to render on any violation. Write a small config and run it:

```
node ./scripts/build.mjs /path/to/config.json
# config.json: { root, outPath, repoRoot, editor, title, eyebrow, subtitle, footer, date }
# editor: "vscode" | "cursor" | "windsurf" | "antigravity-ide" | "android-studio" | "intellij" | ...
#         (or override directly with ideMode / ideScheme / idePort)
# root = the assembled tree; or rootPath = a JSON file holding it
```

It resolves `editor` → link mode/scheme/port via a built-in registry and auto-builds the `__META__` line from the computed stats. Prefer this over hand-rolling the substitution so the contract is always enforced.
