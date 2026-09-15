#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fingerprintBugText, bugSimilarity } from './lib/bug-fingerprint.mjs';

const input=process.argv[2];
if(!input){console.error('Usage: npm run bug:scan -- <log-file>');process.exit(1);}
const raw=input==='-'?fs.readFileSync(0,'utf8'):fs.readFileSync(input,'utf8');
const {normalized:norm,fingerprint,tokens}=fingerprintBugText(raw);
const dir=path.join(process.cwd(),'bugs','registry');
const bugs=fs.readdirSync(dir).filter(n=>/^BUG-\d{4}\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8')));
const ranked=bugs.map(b=>({bug:b,score:bugSimilarity(tokens,b)})).sort((a,b)=>b.score-a.score);
const infra=/browserstack|playwright|runner|github actions|ci\b/.test(norm);
const external=/safari|webkit|ios|network|timeout|fetch|cdn/.test(norm);
console.log(`# BUG SCAN fingerprint=${fingerprint}`);
console.log(`Likely class: ${infra?'INFRA/TEST':external?'PRODUCT_OR_EXTERNAL_ENV':'PRODUCT_OR_UNKNOWN'}`);
console.log('Closest known bugs:');
for(const r of ranked.slice(0,5))console.log(`- ${r.bug.id} score=${r.score.toFixed(3)} [${r.bug.status}] ${r.bug.title}`);
if((ranked[0]?.score||0)<0.08)console.log('Suggestion: no strong known match; create/sanitize an incoming REPORT before creating a new canonical BUG.');
else console.log(`Suggestion: inspect ${ranked[0].bug.id} first and append evidence if symptom matches; do not create a duplicate.`);
