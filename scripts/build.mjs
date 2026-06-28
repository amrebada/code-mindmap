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
//   "title", "eyebrow", "subtitle", "footer": strings,  (page chrome; sensible defaults)
//   "date":      "2026-06-28",                           (optional, shown in meta line)
//   "templatePath": "/abs/renderer.html"                 (default: ../templates/renderer.html next to this script)
// }
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

// ---- render ----
let tpl = fs.readFileSync(templatePath, 'utf8');
const meta = cfg.meta ||
  `${counts.function} functions (${explained} explained) · ${counts.package} packages · ${counts.file} files · ` +
  `${counts.group} groups · max depth ${maxDepth} · ${totalNodes} nodes · click-to-open in ${editorLabel}` +
  (cfg.date ? ` · generated ${cfg.date}` : '');

const html = tpl
  .replace('__TREE_DATA__', () => JSON.stringify(tree))
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
