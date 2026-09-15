import crypto from 'node:crypto';

export function sanitizeBugText(input=''){
  return String(input)
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s]+/gi,'$1<redacted>')
    .replace(/(cookie\s*[:=]\s*)[^\n]+/gi,'$1<redacted>')
    .replace(/([?&](?:token|access_token|refresh_token|apikey|api_key|key|secret|password)=)[^&\s]+/gi,'$1<redacted>')
    .replace(/\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g,'<jwt>')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'<email>')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g,'<ip>');
}

export function normalizeBugText(input=''){
  return sanitizeBugText(input).toLowerCase()
    .replace(/https?:\/\/\S+/g,'<url>')
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi,'<uuid>')
    .replace(/\b[0-9a-f]{12,}\b/gi,'<hex>')
    .replace(/\b\d{4}-\d\d-\d\d[t ][\d:.+-z]+\b/gi,'<time>')
    .replace(/:\d+:\d+/g,':<line>')
    .replace(/\b\d{3,}\b/g,'<n>')
    .replace(/\s+/g,' ').trim();
}

export function fingerprintBugText(input=''){
  const normalized=normalizeBugText(input);
  return {
    normalized,
    fingerprint:crypto.createHash('sha256').update(normalized).digest('hex').slice(0,16),
    tokens:tokenizeBugText(normalized)
  };
}

export function tokenizeBugText(input=''){
  return new Set(String(input).toLowerCase().split(/[^a-z0-9_.-]+/).filter(x=>x.length>=4));
}

export function bugSimilarity(tokens,bug){
  const text=[bug.title,bug.actual,bug.expected,...(bug.evidence||[]),...(bug.area||[]),bug.research?.summary].filter(Boolean).join(' ').toLowerCase();
  const other=tokenizeBugText(text);
  let hit=0;
  for(const token of tokens)if(other.has(token))hit++;
  return tokens.size?hit/Math.sqrt(tokens.size*Math.max(1,other.size)):0;
}
