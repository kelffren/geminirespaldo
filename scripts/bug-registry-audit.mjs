#!/usr/bin/env node

/* KELO-INDEX
 * area: BUGS / REGISTRY AUDIT
 * owner: Bug Registry tooling
 * purpose: valida expedientes canónicos e investigaciones de apoyo, incluyendo BUG + FECHA + VERSION obligatorios
 * public-api: npm run audit:bugs
 * online: N/A
 */

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const registryDir = path.join(root, 'bugs', 'registry');
const investigationRoot = path.join(root, 'bugs', 'investigacion');
const allowedStatuses = new Set(['OPEN','TRIAGED','CLAIMED','FIXED_PENDING_VERIFY','VERIFIED','CLOSED','BLOCKED','REOPENED','WONT_FIX']);
const hypothesisStatuses = new Set(['unverified','supported','weakened','ruled_out','confirmed']);
const attemptResults = new Set(['PASS','FAIL','PARTIAL','NOT_RUN','BLOCKED']);
const researchStatuses = new Set(['not_started','in_progress','sufficient','blocked']);
const investigationStatuses = new Set(['vigente','parcialmente_superada','superada','historica']);
const errors = [];
const warnings = [];

function pushError(file, message) { errors.push(`${file}: ${message}`); }
function pushWarning(file, message) { warnings.push(`${file}: ${message}`); }
function uniqueIds(items = []) {
  const ids = items.map((x) => x?.id).filter(Boolean);
  return ids.length === new Set(ids).size;
}
function readMeta(text, label) {
  const prefix = `${label}:`;
  const row = String(text).split(/\r?\n/).find((line) => line.trimStart().startsWith(prefix));
  if (!row) return null;
  return row.slice(row.indexOf(prefix) + prefix.length).trim().replace(/^`|`$/g, '').trim() || null;
}
function walkMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMarkdown(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md') && entry.name !== 'README.md') out.push(full);
  }
  return out;
}

if (!fs.existsSync(registryDir)) {
  console.error('bugs/registry not found');
  process.exit(1);
}

const files = fs.readdirSync(registryDir).filter((name) => /^BUG-\d{4}\.json$/.test(name)).sort();
const knownBugIds = new Set(files.map((name) => name.replace('.json', '')));
for (const file of files) {
  const fullPath = path.join(registryDir, file);
  let bug;
  try {
    bug = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    pushError(file, `invalid JSON: ${error.message}`);
    continue;
  }

  if (bug.id !== file.replace('.json', '')) pushError(file, `id ${bug.id} does not match filename`);
  if (!allowedStatuses.has(bug.status)) pushError(file, `invalid status ${bug.status}`);
  if ((bug.schema_version ?? 0) < 2) pushError(file, 'schema_version must be >= 2; migrate research dossier fields');

  const research = bug.research;
  if (!research || typeof research !== 'object') {
    pushError(file, 'missing research object');
  } else {
    if (!researchStatuses.has(research.status)) pushError(file, `invalid research.status ${research.status}`);
    if (!Array.isArray(research.known_facts)) pushError(file, 'research.known_facts must be an array');
    if (!Array.isArray(research.hypotheses)) pushError(file, 'research.hypotheses must be an array');
    if (!Array.isArray(research.ruled_out)) pushError(file, 'research.ruled_out must be an array');
    if (!Array.isArray(research.unknowns)) pushError(file, 'research.unknowns must be an array');
    if (!Array.isArray(research.external_references)) pushError(file, 'research.external_references must be an array');
    if (!uniqueIds(research.known_facts)) pushError(file, 'duplicate known_fact IDs');
    if (!uniqueIds(research.hypotheses)) pushError(file, 'duplicate hypothesis IDs');
    if (!uniqueIds(research.unknowns)) pushError(file, 'duplicate unknown IDs');
    for (const h of research.hypotheses || []) {
      if (!h.id || !/^H\d+$/.test(h.id)) pushError(file, `invalid hypothesis id ${h.id}`);
      if (!hypothesisStatuses.has(h.status)) pushError(file, `${h.id || 'hypothesis'} has invalid status ${h.status}`);
      if (!h.theory) pushError(file, `${h.id || 'hypothesis'} missing theory`);
      if (!h.test_next && h.status !== 'ruled_out' && h.status !== 'confirmed') pushWarning(file, `${h.id} has no test_next`);
    }
  }

  if (!Array.isArray(bug.attempt_history)) {
    pushError(file, 'attempt_history must be an array');
  } else {
    if (!uniqueIds(bug.attempt_history)) pushError(file, 'duplicate attempt IDs');
    for (const a of bug.attempt_history) {
      if (!a.id || !/^A\d+$/.test(a.id)) pushError(file, `invalid attempt id ${a.id}`);
      const result = a.validation?.result;
      if (!attemptResults.has(result)) pushError(file, `${a.id || 'attempt'} has invalid validation.result ${result}`);
      if (!a.goal) pushError(file, `${a.id || 'attempt'} missing goal`);
      if (!a.conclusion) pushError(file, `${a.id || 'attempt'} missing conclusion`);
      if (result === 'FAIL' && !a.do_not_repeat_without) pushError(file, `${a.id} FAIL must define do_not_repeat_without`);
    }
  }

  if (!Array.isArray(bug.next_best_actions)) pushError(file, 'next_best_actions must be an array');
  else if (!bug.next_best_actions.length && !['VERIFIED','CLOSED','WONT_FIX'].includes(bug.status)) pushWarning(file, 'active bug has no next_best_actions');

  if (bug.status === 'FIXED_PENDING_VERIFY' && !(bug.fix?.commits?.length || bug.fix?.files?.length)) {
    pushError(file, 'FIXED_PENDING_VERIFY requires identifiable fix commits/files');
  }
  if (['VERIFIED','CLOSED'].includes(bug.status) && bug.verification?.status !== 'PASS') {
    pushError(file, `${bug.status} requires verification.status PASS`);
  }
}

const investigationFiles = walkMarkdown(investigationRoot);
for (const fullPath of investigationFiles) {
  const rel = path.relative(root, fullPath);
  const text = fs.readFileSync(fullPath, 'utf8');
  const bugId = readMeta(text, 'BUG');
  const date = readMeta(text, 'FECHA');
  const version = readMeta(text, 'VERSION / BUILD');
  const status = readMeta(text, 'ESTADO');
  const parentBug = path.basename(path.dirname(fullPath)).toUpperCase();

  if (!bugId) pushError(rel, 'missing required BUG metadata');
  else {
    if (!/^BUG-\d{4}$/.test(bugId)) pushError(rel, `invalid BUG metadata ${bugId}`);
    if (!knownBugIds.has(bugId)) pushError(rel, `references unknown bug ${bugId}`);
    if (/^BUG-\d{4}$/.test(parentBug) && parentBug !== bugId) pushError(rel, `BUG metadata ${bugId} does not match parent folder ${parentBug}`);
  }
  if (!date) pushError(rel, 'missing required FECHA metadata');
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) pushError(rel, `FECHA must use YYYY-MM-DD, got ${date}`);
  if (!version) pushError(rel, 'missing required VERSION / BUILD metadata');
  if (!status) pushError(rel, 'missing required ESTADO metadata');
  else if (!investigationStatuses.has(status)) pushError(rel, `invalid ESTADO ${status}`);
}

if (warnings.length) {
  console.log('BUG REGISTRY WARNINGS');
  for (const warning of warnings) console.log(`- ${warning}`);
}

if (errors.length) {
  console.error('BUG REGISTRY AUDIT FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`BUG REGISTRY AUDIT PASS — ${files.length} bug(s), ${investigationFiles.length} investigation(s) checked${warnings.length ? `, ${warnings.length} warning(s)` : ''}.`);
