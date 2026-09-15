#!/usr/bin/env node

/* KELO-INDEX
 * area: BUGS / AGENT BRIEF
 * owner: Bug Registry tooling
 * purpose: resume el expediente canónico y las investigaciones versionadas de apoyo para que un agente continúe sin repetir trabajo
 * public-api: npm run bug:brief -- BUG-NNNN
 * online: N/A
 */

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const registryDir = path.join(root, 'bugs', 'registry');
const investigationRoot = path.join(root, 'bugs', 'investigacion');
const arg = process.argv[2];

function listBugs() {
  if (!fs.existsSync(registryDir)) return [];
  return fs.readdirSync(registryDir)
    .filter((name) => /^BUG-\d{4}\.json$/i.test(name))
    .sort();
}

function normalizeId(value) {
  if (!value) return null;
  const raw = String(value).trim().toUpperCase().replace(/\.JSON$/, '');
  if (/^BUG-\d{4}$/.test(raw)) return raw;
  if (/^\d+$/.test(raw)) return `BUG-${raw.padStart(4, '0')}`;
  return raw;
}

function line(label, value) {
  if (value === null || value === undefined || value === '') return;
  console.log(`${label}: ${value}`);
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function bullets(items, formatter = (item) => String(item)) {
  if (!Array.isArray(items) || items.length === 0) {
    console.log('- (none recorded)');
    return;
  }
  for (const item of items) console.log(`- ${formatter(item)}`);
}

function envSummary(env = {}) {
  return [env.game_build, env.device, env.os, env.browser, env.surface]
    .filter(Boolean)
    .join(' | ');
}

function readMeta(text, label) {
  const prefix = `${label}:`;
  const row = String(text).split(/\r?\n/).find((line) => line.trimStart().startsWith(prefix));
  if (!row) return null;
  return row.slice(row.indexOf(prefix) + prefix.length).trim().replace(/^`|`$/g, '').trim() || null;
}

function parseInvestigationMeta(text, relativePath) {
  return {
    file: relativePath,
    bug: readMeta(text, 'BUG'),
    date: readMeta(text, 'FECHA'),
    version: readMeta(text, 'VERSION / BUILD'),
    commit: readMeta(text, 'COMMIT BASE'),
    environment: readMeta(text, 'ENTORNO'),
    status: readMeta(text, 'ESTADO')
  };
}

function listInvestigations(id) {
  const dir = path.join(investigationRoot, id);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.md'))
    .sort()
    .reverse()
    .map((name) => {
      const file = path.join(dir, name);
      const text = fs.readFileSync(file, 'utf8');
      return parseInvestigationMeta(text, path.relative(root, file));
    });
}

if (!arg) {
  console.error('Usage: npm run bug:brief -- BUG-0003');
  const bugs = listBugs();
  if (bugs.length) console.error(`Available: ${bugs.map((x) => x.replace('.json', '')).join(', ')}`);
  process.exitCode = 1;
} else {
  const id = normalizeId(arg);
  const file = path.join(registryDir, `${id}.json`);
  if (!fs.existsSync(file)) {
    console.error(`Bug not found: ${id}`);
    const bugs = listBugs();
    if (bugs.length) console.error(`Available: ${bugs.map((x) => x.replace('.json', '')).join(', ')}`);
    process.exitCode = 1;
  } else {
    const bug = JSON.parse(fs.readFileSync(file, 'utf8'));
    const research = bug.research || {};

    console.log(`# ${bug.id} — ${bug.title}`);
    line('STATUS', bug.status);
    line('SEVERITY', bug.severity);
    line('AREA', Array.isArray(bug.area) ? bug.area.join(', ') : bug.area);
    line('ENV', envSummary(bug.environment));
    line('UPDATED', bug.updated_at);
    line('RESEARCH', research.status || 'legacy/unstructured');

    section('INVESTIGACIONES DE APOYO');
    const investigations = listInvestigations(id);
    bullets(investigations, (item) => {
      const parts = [item.file];
      if (item.date) parts.push(`FECHA=${item.date}`);
      if (item.version) parts.push(`VERSION=${item.version}`);
      if (item.status) parts.push(`ESTADO=${item.status}`);
      if (item.environment) parts.push(`ENTORNO=${item.environment}`);
      return parts.join(' | ');
    });
    if (investigations.length) {
      console.log('READ FIRST: open the newest investigation whose VERSION / BUILD still applies to current HEAD/runtime.');
    }

    section('CURRENT OBSERVATION');
    console.log(bug.actual || '(not recorded)');

    section('EXPECTED');
    console.log(bug.expected || '(not recorded)');

    section('REPRODUCTION');
    bullets(bug.reproduction, (item) => item);

    section('KNOWN FACTS');
    bullets(research.known_facts, (f) => `${f.id || '?'}: ${f.statement || f} ${f.evidence?.length ? `[evidence: ${f.evidence.join('; ')}]` : ''}`.trim());

    section('ACTIVE HYPOTHESES');
    const hypotheses = Array.isArray(research.hypotheses) ? research.hypotheses : [];
    const activeHypotheses = hypotheses.filter((h) => h.status !== 'ruled_out');
    bullets(activeHypotheses, (h) => {
      const parts = [`${h.id || '?'} [${h.status || 'unverified'}/${h.confidence || 'unknown'}] ${h.theory || ''}`];
      if (h.test_next) parts.push(`NEXT TEST: ${h.test_next}`);
      if (h.evidence_against?.length) parts.push(`AGAINST: ${h.evidence_against.join('; ')}`);
      return parts.join(' | ');
    });

    section('RULED OUT / DO NOT CHASE');
    bullets(research.ruled_out, (r) => `${r.hypothesis_id || r.id || '?'}: ${r.theory || r.reason || r} ${r.reason && r.theory ? `— ${r.reason}` : ''}`.trim());

    section('ATTEMPT HISTORY');
    bullets(bug.attempt_history, (a) => {
      const result = a.validation?.result || a.result || 'UNKNOWN';
      const commits = a.change?.commits?.length ? ` commits=${a.change.commits.join(',')}` : '';
      const guard = a.do_not_repeat_without ? ` | DO NOT REPEAT WITHOUT: ${a.do_not_repeat_without}` : '';
      return `${a.id || '?'} [${result}] ${a.goal || a.summary || ''}${commits} | CONCLUSION: ${a.conclusion || '(none)'}${guard}`;
    });

    section('UNKNOWNS');
    bullets(research.unknowns, (u) => `${u.id || '?'}: ${u.question || u} ${u.quickest_test ? `| FASTEST TEST: ${u.quickest_test}` : ''}`.trim());

    section('NEXT BEST ACTIONS');
    const actions = Array.isArray(bug.next_best_actions) ? [...bug.next_best_actions] : [];
    actions.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
    bullets(actions, (a) => `P${a.priority ?? '?'} ${a.action || a} ${a.reason ? `| WHY: ${a.reason}` : ''} ${a.expected_signal ? `| SIGNAL: ${a.expected_signal}` : ''} ${a.stop_condition ? `| STOP: ${a.stop_condition}` : ''}`.trim());

    section('FIX STATE');
    line('fix.status', bug.fix?.status);
    line('fix.commits', bug.fix?.commits?.join(', '));
    line('fix.summary', bug.fix?.summary);

    section('VERIFICATION GATE');
    line('verification.status', bug.verification?.status);
    line('verification.method', bug.verification?.method);
    bullets(bug.verification?.evidence);

    section('BLOCKERS / RELATED');
    line('blocked_by', bug.blocked_by?.join(', ') || '(none)');
    line('related_bugs', bug.related_bugs?.join(', ') || '(none)');

    console.log('\nRULE: A failed attempt is knowledge. Do not repeat it unless new evidence invalidates its previous conclusion.');
  }
}
