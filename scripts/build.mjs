#!/usr/bin/env node
// Validate + render a code mind map. Usage: node build.mjs <config.json>
//
// config.json: {
//   "root":      <the assembled tree object>            (or "rootPath": path to a JSON file holding it)
//   "outPath":   "/abs/path/out.html",                  (required)
//   "repoRoot":  "/abs/path/to/repo",                   (required — for IDE deep-links; git rev-parse --show-toplevel)
//   "editor":    "vscode" | "cursor" | "antigravity-ide" | "android-studio" | "intellij" | ...,
//                                                        (preset; sets link mode/scheme/port — see EDITORS below)
//   "ideMode":   "vscode" | "jetbrains",                (override; default from editor, else "vscode")
//   "ideScheme": "antigravity-ide" | "vscode" | ...,    (override; vscode-mode URL scheme)
//   "idePort":   63342,                                  (override; JetBrains built-in server port)
//   "edges":     [ {from,to,kind?,label?}, ... ],        (optional — file relationships; or "edgesPath": JSON file)
//   "schema":    { tables:[...], enums?:[...] },          (optional — database schema; or "schemaPath": JSON file)
//   "tutorial":  { intro?, topics:[...] },                (optional — Guided Tour lessons; or "tutorialPath": JSON file)
//   "title", "eyebrow", "subtitle", "footer": strings,  (page chrome; sensible defaults)
//   "date":      "2026-06-28",                           (optional, shown in meta line)
//   "templatePath": "/abs/renderer.html"                 (default: ../templates/renderer.html next to this script)
// }
//
// The Relationships view (collapsible topic/file class-diagram) renders when "edges" is present;
// the Database view (ERD) renders when "schema.tables" is present; the Guided Tour view (progress-tracked
// lessons with per-lesson/topic/tour time estimates) renders when "tutorial.topics" is present.
// All three are optional add-ons to the tree.
//
// tutorial: { "intro"?: "", "topics": [ { "title", "summary"?, "lessons": [
//               { "title", "body", "aha"?, "minutes"?:num, "deep"?:bool, "code"?, "ref"?:"path:line" } ] } ] }
//           Lessons are short; "aha" is the one-line payoff; "minutes" defaults to 2 and rolls up to
//           per-topic and whole-tour time estimates + a completion progress bar (persisted in the browser).
//
// edges[]:  { "from": "<repo-relative file path>", "to": "<repo-relative file path>",
//             "kind": "import"|"call"|"extends"|"implements"|"uses"|..., "label"?: "" }
//           from/to match file nodes by their repo-relative ref (any :line suffix is ignored).
// schema:   { "tables": [ { "name", "ref"?, "summary"?, "columns": [
//               { "name", "type"?, "pk"?:bool, "fk"?:"table.column", "unique"?:bool, "nullable"?:bool } ] } ],
//             "enums"?: [ { "name", "values":[...] } ] }
//
// Link styles:
//   vscode mode    -> <scheme>://file/<abs>:<line>:<col>            (VS Code, Cursor, Windsurf, Antigravity IDE)
//   jetbrains mode -> http://localhost:<port>/api/file/<abs>:<line>  (Android Studio, IntelliJ — built-in server)
//
// Enforces the rule-of-7 contract: <=7 children per node, every function leaf has
// explanation + non-empty steps, no empty names. Refuses to render on any violation.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfgPath = process.argv[2];
if (!cfgPath) { console.error('usage: node build.mjs <config.json>'); process.exit(2); }
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));

// known editors -> link strategy. vscode-family forks share the scheme://file pattern;
// JetBrains IDEs (Android Studio, IntelliJ, …) open files through their built-in web server.
const EDITORS = {
  'vscode':          { mode:'vscode',    scheme:'vscode' },
  'vscode-insiders': { mode:'vscode',    scheme:'vscode-insiders' },
  'cursor':          { mode:'vscode',    scheme:'cursor' },
  'windsurf':        { mode:'vscode',    scheme:'windsurf' },
  'antigravity-ide': { mode:'vscode',    scheme:'antigravity-ide' },
  'android-studio':  { mode:'jetbrains', port:63342 },
  'intellij':        { mode:'jetbrains', port:63342 },
  'pycharm':         { mode:'jetbrains', port:63342 },
  'webstorm':        { mode:'jetbrains', port:63342 },
  'goland':          { mode:'jetbrains', port:63342 },
};

const tree = cfg.root || JSON.parse(fs.readFileSync(cfg.rootPath, 'utf8'));
const edges = cfg.edges || (cfg.edgesPath ? JSON.parse(fs.readFileSync(cfg.edgesPath, 'utf8')) : null);
const schema = cfg.schema || (cfg.schemaPath ? JSON.parse(fs.readFileSync(cfg.schemaPath, 'utf8')) : null);
const tutorial = cfg.tutorial || (cfg.tutorialPath ? JSON.parse(fs.readFileSync(cfg.tutorialPath, 'utf8')) : null);
const outPath = cfg.outPath;
const repoRoot = (cfg.repoRoot || '').replace(/\/+$/, '');
const ed = (cfg.editor && EDITORS[cfg.editor]) || null;
if (cfg.editor && !ed) console.warn(`! unknown editor "${cfg.editor}" — falling back to vscode/${cfg.ideScheme || 'vscode'}`);
const ideMode   = cfg.ideMode   || (ed && ed.mode)   || 'vscode';
const ideScheme = cfg.ideScheme || (ed && ed.scheme) || 'vscode';
const idePort   = String(cfg.idePort || (ed && ed.port) || 63342);
const editorLabel = cfg.editor || (ideMode === 'jetbrains' ? `JetBrains (:${idePort})` : ideScheme);
const templatePath = cfg.templatePath || path.join(here, '..', 'templates', 'renderer.html');
if (!tree) { console.error('config needs "root" or "rootPath"'); process.exit(2); }
if (!outPath) { console.error('config needs "outPath"'); process.exit(2); }
if (!repoRoot) { console.error('config needs "repoRoot" (absolute repo path for IDE links)'); process.exit(2); }

// ---- normalize: decode HTML entities so the renderer's esc() doesn't double-escape ----
const ENT = { '&amp;':'&', '&lt;':'<', '&gt;':'>', '&quot;':'"', '&#39;':"'", '&#x27;':"'" };
const dec = s => typeof s === 'string' ? s.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&#x27;/g, m => ENT[m]) : s;
(function decodeWalk(n){ if(!n) return;
  n.name=dec(n.name); n.summary=dec(n.summary); n.ref=dec(n.ref); n.explanation=dec(n.explanation);
  if(Array.isArray(n.steps)) n.steps=n.steps.map(dec);
  (n.children||[]).forEach(decodeWalk); })(tree);

if(Array.isArray(edges)) edges.forEach(e=>{ if(!e) return;
  e.from=dec(e.from); e.to=dec(e.to); e.kind=dec(e.kind); e.label=dec(e.label); });
if(schema && Array.isArray(schema.tables)) schema.tables.forEach(t=>{ if(!t) return;
  t.name=dec(t.name); t.summary=dec(t.summary); t.ref=dec(t.ref);
  (t.columns||[]).forEach(c=>{ if(!c) return; c.name=dec(c.name); c.type=dec(c.type); c.fk=dec(c.fk); }); });
if(schema && Array.isArray(schema.enums)) schema.enums.forEach(en=>{ if(!en) return;
  en.name=dec(en.name); if(Array.isArray(en.values)) en.values=en.values.map(dec); });
if(tutorial){ tutorial.intro=dec(tutorial.intro);
  if(Array.isArray(tutorial.topics)) tutorial.topics.forEach(tp=>{ if(!tp) return;
    tp.title=dec(tp.title); tp.summary=dec(tp.summary);
    if(Array.isArray(tp.lessons)) tp.lessons.forEach(ls=>{ if(!ls) return;
      ls.title=dec(ls.title); ls.body=dec(ls.body); ls.aha=dec(ls.aha); ls.code=dec(ls.code); ls.ref=dec(ls.ref); }); }); }

// ---- stats + quality checks ----
const counts = { chunk:0, group:0, package:0, file:0, function:0 };
let maxDepth = 0, explained = 0;
const violations = [], fnNoDetail = [], fnNoRef = [], emptyNames = [], starved = [];
const fnsUnder = n => (n.children||[]).reduce((s,c)=>s+(c.kind==='function'?1:0)+fnsUnder(c),0);

(function walk(n, depth, p){
  if(!n){ violations.push(`null node at ${p}`); return; }
  counts[n.kind] = (counts[n.kind]||0)+1;
  maxDepth = Math.max(maxDepth, depth);
  const kids = n.children||[];
  if(kids.length > 7) violations.push(`${p}/${n.name} has ${kids.length} children (>7)`);
  if(!n.name) emptyNames.push(p);
  if(n.kind==='function'){
    if(!n.ref) fnNoRef.push(`${p}/${n.name}`);
    const ok = n.explanation && Array.isArray(n.steps) && n.steps.length;
    if(ok) explained++; else fnNoDetail.push(`${p}/${n.name}`);
  }
  kids.forEach(c => walk(c, depth+1, `${p}/${n.name}`));
})(tree, 0, '');

(tree.children||[]).forEach(c => { if(fnsUnder(c)===0) starved.push(c.name); });
const totalNodes = Object.values(counts).reduce((a,b)=>a+b,0);

console.log('=== STATS ===');
console.log(JSON.stringify(counts), '| maxDepth', maxDepth, '| nodes', totalNodes, '| explained', explained + '/' + counts.function);
console.log('=== QUALITY ===');
console.log('rule-of-7 violations:', violations.length); violations.forEach(v=>console.log('  ✗', v));
console.log('function leaves missing explanation/steps:', fnNoDetail.length); fnNoDetail.slice(0,30).forEach(v=>console.log('  ✗', v));
console.log('function leaves missing ref:', fnNoRef.length); fnNoRef.slice(0,30).forEach(v=>console.log('  ✗', v));
console.log('empty names:', emptyNames.length, '| chunks with no functions:', starved.length, starved.join(', '));

if(violations.length || fnNoDetail.length || fnNoRef.length || emptyNames.length || starved.length){
  console.error('\n!! REFUSING TO RENDER — fix the issues above (re-run the offending chunk).');
  process.exit(1);
}

// ---- optional add-ons: edges (Relationships view) + schema (Database view) ----
// These are best-effort overlays: malformed entries are dropped with a warning, never a hard fail.
const normRef = r => String(r || '').replace(/:\d+.*$/, '').replace(/^\/+/, '');
const fileRefs = new Set();
(function collectRefs(n){ if(!n) return; if(n.kind==='file' && n.ref) fileRefs.add(normRef(n.ref)); (n.children||[]).forEach(collectRefs); })(tree);

let edgesOut = null;
if(Array.isArray(edges)){
  const dropped = [], unmatched = [];
  edgesOut = edges.filter(e => {
    if(!e || !e.from || !e.to){ dropped.push(JSON.stringify(e)); return false; }
    const a = normRef(e.from), b = normRef(e.to);
    if(!fileRefs.has(a)) unmatched.push(e.from);
    if(!fileRefs.has(b)) unmatched.push(e.to);
    return true;
  });
  console.log('=== RELATIONSHIPS ===');
  console.log('edges:', edgesOut.length, '| dropped (missing from/to):', dropped.length,
    '| endpoints not matching a tree file:', unmatched.length);
  if(unmatched.length) console.log('  ! unmatched (drawn to the topic, not a file row):', [...new Set(unmatched)].slice(0,12).join(', '));
}

let schemaOut = null;
if(schema && Array.isArray(schema.tables)){
  const tableNames = new Set(schema.tables.map(t => (t.name||'').toLowerCase()));
  const tIssuesNoName = [], cIssuesNoName = [], fkUnknown = [];
  let colTotal = 0, fkTotal = 0;
  schema.tables.forEach(t => {
    if(!t.name) tIssuesNoName.push(JSON.stringify(t).slice(0,60));
    (t.columns||[]).forEach(c => {
      colTotal++;
      if(!c.name) cIssuesNoName.push(t.name);
      if(c.fk){ fkTotal++;
        const target = String(c.fk).split('.')[0].toLowerCase();
        if(!tableNames.has(target)) fkUnknown.push(`${t.name}.${c.name} -> ${c.fk}`); }
    });
  });
  schemaOut = schema;
  console.log('=== DATABASE ===');
  console.log('tables:', schema.tables.length, '| columns:', colTotal, '| foreign keys:', fkTotal,
    '| enums:', (schema.enums||[]).length);
  if(tIssuesNoName.length) console.log('  ! tables missing name:', tIssuesNoName.length);
  if(cIssuesNoName.length) console.log('  ! columns missing name in:', [...new Set(cIssuesNoName)].join(', '));
  if(fkUnknown.length) console.log('  ! FK -> unknown table:', fkUnknown.slice(0,12).join(', '));
}

// ---- optional add-on: tutorial (Guided Tour view) ----
// Best-effort overlay like edges/schema: malformed topics/lessons are dropped with a warning, never a hard fail.
let tutorialOut = null;
if(tutorial && Array.isArray(tutorial.topics)){
  const droppedTopics = [], droppedLessons = [], noAha = [], badRef = [];
  const topics = tutorial.topics.map(tp => {
    if(!tp || !tp.title || !Array.isArray(tp.lessons)){ droppedTopics.push(JSON.stringify(tp).slice(0,60)); return null; }
    const lessons = tp.lessons.filter(ls => {
      if(!ls || !ls.title || !ls.body){ droppedLessons.push(`${tp.title}/${ls && ls.title || '?'}`); return false; }
      if(!ls.aha) noAha.push(`${tp.title}/${ls.title}`);
      if(ls.ref && !/^[^:]+(:\d+)?/.test(String(ls.ref))) badRef.push(`${tp.title}/${ls.title}`);
      return true;
    });
    if(!lessons.length){ droppedTopics.push(tp.title); return null; }
    return { ...tp, lessons };
  }).filter(Boolean);

  if(topics.length){
    tutorialOut = { ...tutorial, topics };
    const lessonCount = topics.reduce((s,t)=>s+t.lessons.length,0);
    const min = ls => (typeof ls.minutes==='number' && ls.minutes>0) ? ls.minutes : 2;
    const totalMin = topics.reduce((s,t)=>s+t.lessons.reduce((a,l)=>a+min(l),0),0);
    const deep = topics.reduce((s,t)=>s+t.lessons.filter(l=>l.deep).length,0);
    console.log('=== TUTORIAL ===');
    console.log('topics:', topics.length, '| lessons:', lessonCount, '| deep dives:', deep, '| est. time: ~'+totalMin+' min');
    if(droppedTopics.length) console.log('  ! dropped topics (missing title/lessons):', droppedTopics.length);
    if(droppedLessons.length) console.log('  ! dropped lessons (missing title/body):', droppedLessons.slice(0,12).join(', '));
    if(noAha.length) console.log('  ! lessons with no "aha" (recommended):', noAha.slice(0,12).join(', '));
    if(badRef.length) console.log('  ! lessons with a malformed ref:', badRef.slice(0,12).join(', '));
  } else {
    console.log('=== TUTORIAL ===');
    console.log('  ! no valid topics after validation — Guided Tour view omitted');
  }
}

// ---- render ----
let tpl = fs.readFileSync(templatePath, 'utf8');
const meta = cfg.meta ||
  `${counts.function} functions (${explained} explained) · ${counts.package} packages · ${counts.file} files · ` +
  `${counts.group} groups · max depth ${maxDepth} · ${totalNodes} nodes` +
  (edgesOut && edgesOut.length ? ` · ${edgesOut.length} relations` : '') +
  (schemaOut && schemaOut.tables.length ? ` · ${schemaOut.tables.length} tables` : '') +
  (tutorialOut ? ` · ${tutorialOut.topics.reduce((s,t)=>s+t.lessons.length,0)}-lesson tour` : '') +
  ` · click-to-open in ${editorLabel}` +
  (cfg.date ? ` · generated ${cfg.date}` : '');

const html = tpl
  .replace('__TREE_DATA__', () => JSON.stringify(tree))
  .replace('__EDGES_DATA__', () => JSON.stringify(edgesOut || null))
  .replace('__SCHEMA_DATA__', () => JSON.stringify(schemaOut || null))
  .replace('__TUTORIAL_DATA__', () => JSON.stringify(tutorialOut || null))
  .replace(/__REPO_ROOT__/g, () => repoRoot)
  .replace(/__IDE_MODE__/g, () => ideMode)
  .replace(/__IDE_SCHEME__/g, () => ideScheme)
  .replace(/__IDE_PORT__/g, () => idePort)
  .replace(/__TITLE__/g, () => cfg.title || 'Code Mind Map')
  .replace('__EYEBROW__', () => cfg.eyebrow || 'Rule-of-7 structural atlas')
  .replace('__SUBTITLE__', () => cfg.subtitle || 'Every node has at most 7 children; leaves are individual functions. Click a function to read what it does and how, or its path to open it in your IDE.')
  .replace('__META__', () => meta)
  .replace('__FOOTER__', () => cfg.footer || 'Generated by the code-mindmap skill.');

fs.writeFileSync(outPath, html);
console.log('\n✓ Wrote', outPath, `(${html.length} bytes)`);
