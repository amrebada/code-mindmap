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

The page has a **view switcher** at the top with up to four views (extra tabs only appear when their data is present):
- **Mind Map** — the rule-of-7 tree (always present).
- **Guided Tour** — a self-paced **tutorial** that walks a newcomer through the codebase in short lessons, each ending in an **"aha"** moment, with a completion **progress bar** and time estimates **per lesson, per topic, and for the whole tour**. Rendered when you supply a `tutorial`. A call-to-action banner on the home page links straight into it.
- **Relationships** — a class-diagram-style view where each top-level topic is a **collapsible block**; open a block to see its files, then click a file to trace its relationships to other files **and to other topics** (drawn as live SVG connectors). Rendered when you supply an `edges` list.
- **Database** — a professional, modern **ERD**: table cards with typed columns, PK/FK/unique badges, and foreign-key connector lines. Rendered when you supply a `schema`.

All three extra views are **optional overlays** on the same tree — produce them only when they add value: a `tutorial` when the codebase is worth an onboarding walk-through, `edges` when there are file-to-file relationships worth showing, and/or a `schema` when there's a discoverable database.

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

## Optional views: Guided Tour (`tutorial`) + Relationships (`edges`) + Database (`schema`)

Three optional data blocks, passed alongside the tree in the same config, light up extra views. Omit any and its tab simply won't appear. All are **best-effort overlays** — `build.mjs` never refuses to render over them; it drops malformed entries with a warning and prints add-on stats.

### `tutorial` — the Guided Tour (onboarding) view
A structured, self-paced walk-through: **topics**, each holding a few short **lessons**. The renderer computes time estimates (per lesson → per topic → whole tour), shows a completion **progress bar**, tracks which lessons are done (persisted in the browser via `localStorage`), and renders a home-page CTA banner that links into it. This is the answer to "the map has everything but I still can't *understand* it" — the tour gives a reader a guided path with a payoff at each step, instead of a tree to explore cold.
```jsonc
tutorial: {
  "intro": "One or two sentences setting up the tour (optional).",
  "topics": [
    {
      "title": "Big Picture",
      "summary": "How a request flows through the app",   // optional, ≤ ~12 words
      "lessons": [
        {
          "title": "Three layers, one direction",
          "minutes": 2,                    // optional; est. reading time, defaults to 2, rolls up to topic + tour totals
          "body": "Short explanation. Blank lines separate paragraphs. Inline `code` and **bold** are supported.",
          "aha": "The single insight this lesson exists to deliver.",   // the payoff — keep it to one punchy sentence
          "deep": false,                   // optional; mark true for a deeper-dive lesson (shows a 'deep dive' badge)
          "code": "optional short snippet shown in a mono block",
          "ref": "src/api/handlers.ts:12"  // optional; adds an 'Open in IDE' deep-link
        }
      ]
    }
  ]
}
```
**Writing good lessons — this is the whole point of the view:**
- **Short.** A lesson is a few sentences to a short paragraph or two — something read in 2–4 minutes, not a wall of text. Set `minutes` honestly; it drives the per-lesson, per-topic, and whole-tour time estimates and the "time left" readout.
- **Every lesson earns its "aha".** The `aha` is the one thing the reader should *click into place* — a mental model, a "so *that's* why it's built this way", a pattern they'll now see everywhere. If a lesson has no genuine insight, merge it into a neighbour. Don't restate the title.
- **Not too deep by default; deep only when the topic demands it.** Explain each part at a get-the-gist level. When a piece is genuinely complex (a tricky algorithm, a subtle invariant, a non-obvious design trade-off), add a `"deep": true` lesson that goes further — but keep the ordinary lessons breezy.
- **Order for a newcomer.** Start with the big picture / how a request flows end to end, then go layer by layer or subsystem by subsystem. Keep topics to a handful of lessons each (the rule-of-7 spirit applies here too).
- **Link to code.** Give lessons a `ref` (`path:line`) so the reader can jump from the idea straight to the source — reuse the same refs already in the tree.
- Aim for a tour that finishes in roughly **5–20 minutes** total for a typical service; bigger systems can run longer but keep each lesson tight.

### `edges` — the Relationships (class-diagram) view
A flat array of directed file-to-file relationships. Endpoints are matched to the tree's **file nodes by their repo-relative `ref`** (any `:line` suffix is ignored), and each file's **topic** is derived from its top-level chunk ancestor — so the renderer can draw file→file links within a topic and file→topic links across topics.
```jsonc
edges: [
  { "from": "src/api/handlers.ts", "to": "src/storage/todo-repo.ts", "kind": "import" },
  { "from": "src/api/handlers.ts", "to": "src/domain/validate.ts",   "kind": "import" },
  { "from": "src/storage/todo-repo.ts", "to": "src/storage/db.ts",   "kind": "uses"   }
]
```
- `from` / `to` (**required**): repo-relative source paths that should match a `file` node's `ref` in the tree. An endpoint that matches no file still renders — it's drawn to the owning topic block instead of a file row — but prefer endpoints that resolve to real file nodes.
- `kind` (optional): `import` · `call` · `extends` · `implements` · `uses` · … — free-form; used only for the legend/counts. Keep the vocabulary small and consistent.
- `label` (optional): short edge caption.
- Keep it to **meaningful structural links** (imports/uses/extends between real files). Don't dump every transitive reference — the value is a readable graph, not a hairball. Dedupe (one edge per from→to pair).

### `schema` — the Database (ERD) view
The database as tables + typed columns; foreign-key relations are **derived from column `fk` fields** (`"table.column"`), so there's no separate relations array.
```jsonc
schema: {
  "tables": [
    {
      "name": "todos",
      "ref": "migrations/002_todos.sql:1",        // optional — click-to-open in the IDE
      "summary": "Todo items owned by a user",      // optional, ≤ ~12 words
      "columns": [
        { "name": "id",      "type": "uuid",         "pk": true,  "nullable": false },
        { "name": "user_id", "type": "uuid",         "fk": "users.id", "nullable": false },
        { "name": "title",   "type": "varchar(200)", "nullable": false },
        { "name": "status",  "type": "todo_status",  "nullable": false }
      ]
    }
  ],
  "enums": [ { "name": "todo_status", "values": ["open","in_progress","done","archived"] } ]  // optional
}
```
- Column flags: `pk` (primary key), `fk` (`"targetTable.targetColumn"` — drives a connector line to that table), `unique`, `nullable`. `nullable:false` on a non-PK column shows an `NN` badge.
- `enums` is optional (Postgres/TS-style enums, or reference/lookup value sets) — rendered as compact value cards.
- Prefer real column **types** as written in the source (`varchar(255)`, `uuid`, `timestamptz`, `jsonb`, …); they show right-aligned and dim.

### Detecting the schema (and edges) — scout step
Only build these views if the signal exists. Look for:
- **SQL** — `*.sql`, `schema.sql`, `migrations/`, `db/migrate/` (`CREATE TABLE`, `ALTER TABLE … ADD FOREIGN KEY`, `REFERENCES`).
- **ORMs / model layers** — Prisma (`schema.prisma`), Drizzle (`*.schema.ts`), TypeORM/Sequelize/Mongoose entities, Django `models.py`, SQLAlchemy models, Rails `schema.rb` + `db/migrate`, Ecto schemas, GORM/`gorm:"..."` structs, `.dbml`.
- **Edges** — imports/`require`/`use`/`#include` between the files already in the tree; or an existing dependency graph if the repo has one.

A quick probe:
```
rg -l --iglob '*.{sql,prisma}' --iglob 'schema.rb' --iglob 'models.py' -e 'CREATE TABLE|@Entity|class .*\(models\.Model\)|model [A-Z]' . 2>/dev/null | head
```
If nothing turns up, **skip the Database view** — don't invent a schema. Likewise skip `edges` if the codebase has no meaningful cross-file structure. When mapping in parallel (below), a dedicated agent (or a per-file enrichment agent) can emit the file-relationship `edges` and a single agent can read the migrations/models to emit `schema` — assemble both next to the tree and hand all three to `build.mjs`.

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
- **Guided Tour (optional).** Once the tree is assembled, a single synthesis agent (or you, inline) can author the `tutorial` from it — it has the whole map to work from. Prompt it to write **big-picture-first**, short lessons, each with a genuine **`aha`**, honest per-lesson `minutes`, `deep:true` only where a topic truly needs depth, and `ref`s reused from the tree. This is the "I still can't understand it" fix: the map shows *what exists*, the tour teaches *how to think about it*. Do this when onboarding value is the point; skip it for a purely structural atlas.

For a **small** codebase (one package, a few files) skip the Workflow and build the tree (and, if useful, the tour) in one pass directly.

### 3. Render (interactive HTML)
Read `./templates/renderer.html` and substitute the placeholders, then write to `~/.agent/diagrams/<name>-mindmap.html` and open it:
- `__TREE_DATA__` → `JSON.stringify(root)` (the assembled tree).
- `__EDGES_DATA__` → `JSON.stringify(edges)` (the file-relationship array) or `null`/`[]` to omit the Relationships view.
- `__SCHEMA_DATA__` → `JSON.stringify(schema)` (the database schema) or `null` to omit the Database view.
- `__TUTORIAL_DATA__` → `JSON.stringify(tutorial)` (the guided-tour lessons) or `null` to omit the Guided Tour view.
- `__TITLE__`, `__EYEBROW__`, `__SUBTITLE__`, `__META__`, `__FOOTER__` → page chrome.
- `__REPO_ROOT__` → the **absolute** path of the repo root (`git rev-parse --show-toplevel`). Turns repo-relative `ref`s into IDE deep-links.
- `__IDE_MODE__` → `vscode` or `jetbrains` (which link style to emit — see below).
- `__IDE_SCHEME__` → the vscode-family URL scheme (used when mode is `vscode`).
- `__IDE_PORT__` → the JetBrains built-in-server port (used when mode is `jetbrains`; default `63342`).

> Refs in the tree are repo-relative; safest to inject `__TREE_DATA__`, `__EDGES_DATA__`, `__SCHEMA_DATA__`, `__TUTORIAL_DATA__`, and the page-chrome strings with a function replacer (`.replace('__TREE_DATA__', () => JSON.stringify(root))`) so any `$` in the data isn't interpreted by `String.replace`. Decode HTML entities (`&amp;`→`&`, etc.) in `name`/`summary`/`explanation`/`steps`/`ref` — and in edge/schema/tutorial strings (table & column names/types, edge kinds/labels, lesson title/body/aha/code) — before injecting; the renderer re-escapes, so leaving them encoded would double-escape. **Prefer `build.mjs`** (below), which does all of this for you.

**Choosing the editor link style.** Two families:
- **VS Code family** (`__IDE_MODE__=vscode`) — clickable `scheme://file/<abs>:<line>:<col>`. Schemes: `vscode`, `vscode-insiders`, `cursor`, `windsurf`, `antigravity-ide`. (Note: Antigravity's editor app registers `antigravity-ide`; the separate `Antigravity.app` uses `antigravity` and is **not** the editor.)
- **JetBrains family** (`__IDE_MODE__=jetbrains`) — Android Studio / IntelliJ / PyCharm / WebStorm / GoLand open files via their **built-in web server**: `http://localhost:63342/api/file/<abs>:<line>`. The IDE must be running with the project open; it may show a one-time confirmation, or enable *Settings → Build, Execution, Deployment → Debugger → "Allow unsigned requests"*. Port increments (63343…) if several JetBrains IDEs run at once.

Pick by what the user uses — **prefer the preconfigured variants in [`editors/`](editors/)** (`code-mindmap-vscode`, `-cursor`, `-antigravity`, `-android-studio`), which just preset `editor` for `build.mjs`. To auto-detect on macOS: `for a in /Applications/*.app; do plutil -extract CFBundleURLTypes.0.CFBundleURLSchemes.0 raw "$a/Contents/Info.plist" 2>/dev/null; done` (or read `…/Contents/Resources/app/product.json`'s `urlProtocol`). Verify a scheme with `lsregister -dump | grep -i '<scheme>:'` and smoke-test `open "<scheme>://file/<abs>/<some>.go:10"`. Default to `vscode` if unsure.

The renderer is self-contained (Google Fonts only) and provides: KPI strip (function/explained/package/file counts, plus relations/tables/columns and lessons/tour-time when supplied, max depth), a **view switcher** (Mind Map / Guided Tour / Relationships / Database — extra tabs auto-hidden when their data is absent), and per-view sticky toolbars.
- **Mind Map** — **live search** (matches name, summary, ref, **and the explanation/steps text** — highlights matches, auto-expands their ancestors), **expand/collapse all**, **depth buttons (L1–L4 / all)**, kind-colored legend, connector-railed collapsible tree. Function leaves with detail show a caret; clicking opens an inline panel ("what it does" + numbered "how it works"). Clicking a leaf with no detail, or any node's `ref ↗`, deep-links the file/line into the editor.
- **Guided Tour** — a two-pane tutorial: a topic/lesson sidebar (per-topic progress ring + minute counts) and a reading pane (crumb, time & "deep dive" badges, formatted body, an "Aha" callout, optional code + IDE deep-link). A top progress bar tracks completion and "~N min to finish"; **prev / mark-done-&-continue** navigation; progress is saved in the browser (`localStorage`) and a **reset** button clears it. A home-page CTA banner links straight in.
- **Relationships** — each top-level topic is a **collapsible card**; open it to see its files (grouped by their sub-path). Click a file to trace its links — connected files in expanded topics highlight and get SVG connectors; connected files in collapsed topics draw a line to that **topic** card. "Show all links", expand/collapse all, per-topic search, and a per-file "open in IDE" affordance.
- **Database** — an ERD board (dotted grid) of **table cards**: gradient header with row count, columns with monospace names, right-aligned types, and PK/FK/UQ/NN badges; PK rows tinted. Foreign keys draw as faint connector lines that brighten on table hover (dimming the rest). Optional enum cards. Table/column search; each table deep-links to its `ref`.

It auto-computes all stats from the data — you only inject the tree, the optional edges/schema, and the IDE placeholders. Light + dark themes built in; connectors are drawn from live element positions and redraw on view-switch, expand/collapse, and resize.

Open with `open ~/.agent/diagrams/<name>-mindmap.html` (macOS) / `xdg-open` (Linux). Tell the user the path.

## Quality checks
- **No level exceeds 7 children** — spot-check the widest interior nodes; if any > 7, the mapping agent failed its contract and the subtree must be regrouped.
- **Leaves are functions**, with `path:line` refs, not vague nouns.
- **Every function leaf has `explanation` + non-empty `steps`** — count them; a chunk that returns function leaves with no detail (or that stopped at file level) must be re-run. Skipped only for collapsed generated/trivial nodes, and note it.
- **Balanced** — few lonely single-child chains; thin siblings merged.
- **Exhaustive on meaningful functions** — collapsing should be limited to generated/trivial code and noted in a summary.
- Search a known function name; its row should highlight and its ancestors expand. Search a phrase from a function's behaviour; the explanation/steps text should match too.
- **IDE links resolve** — all `__…__` placeholders substituted (none left in the output); a sampled `ref ↗` opens the right file/line in the editor.
- **Relationships (if `edges`)** — most edge endpoints resolve to real file nodes (check the `endpoints not matching a tree file` warning is low); the Relationships tab appears; clicking a file draws connectors. Don't ship a hairball — prune to meaningful, deduped links.
- **Database (if `schema`)** — the Database tab appears; every `fk` points at an existing table (check the `FK -> unknown table` warning is empty); types and PK/FK badges look right; don't invent tables that aren't in the source.
- **Guided Tour (if `tutorial`)** — the Guided Tour tab + home CTA appear; every lesson has a real **`aha`** (check the `lessons with no "aha"` warning) and a `body`; lessons are short and ordered big-picture-first; time estimates read sensibly; `deep` is reserved for genuinely complex topics; sampled `ref`s deep-link correctly.

### Validate + render in one step

`./scripts/build.mjs` does all of the above — entity-decode (tree **and** edges/schema/tutorial), the full tree quality gate (≤7 children, every function leaf has `explanation`+`steps`+`ref`, no empty names, no starved chunks), edges/schema/tutorial validation, placeholder substitution, and write — refusing to render on any tree violation. Write a small config and run it:

```
node ./scripts/build.mjs /path/to/config.json
# config.json: { root, outPath, repoRoot, editor, title, eyebrow, subtitle, footer, date,
#                edges?, schema?, tutorial? }
# editor: "vscode" | "cursor" | "windsurf" | "antigravity-ide" | "android-studio" | "intellij" | ...
#         (or override directly with ideMode / ideScheme / idePort)
# root     = the assembled tree;   or rootPath     = a JSON file holding it
# edges    = the relationships[];  or edgesPath    = a JSON file holding it   (optional → Relationships view)
# schema   = the DB schema object; or schemaPath   = a JSON file holding it   (optional → Database view)
# tutorial = the tour object;      or tutorialPath = a JSON file holding it   (optional → Guided Tour view)
```

It resolves `editor` → link mode/scheme/port via a built-in registry and auto-builds the `__META__` line from the computed stats (adding `· N relations` / `· N tables` / `· N-lesson tour` when present). `edges`/`schema`/`tutorial` are **best-effort overlays**: malformed entries are dropped with a warning (never a hard fail), and it prints `=== RELATIONSHIPS ===` / `=== DATABASE ===` / `=== TUTORIAL ===` stats blocks — check the unmatched-endpoint, unknown-FK, and missing-"aha" counts there. Prefer this over hand-rolling the substitution so the contract is always enforced. See [`examples/`](examples/) for a full `edges` + `schema` + `tutorial` sample (`node scripts/build.mjs examples/sample.config.json`).
