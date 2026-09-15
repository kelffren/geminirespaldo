/* KELO-INDEX
 * area: TEST / BUG REPORTING
 * owner: KeloBugReporter contract regression
 * purpose: comprobar que el reporter nace apagado, genera envelope estable y redacta secretos antes de persistir
 * online: N/A; el transporte real se inyecta por contrato
 */
import assert from 'node:assert/strict';
import {
  buildBugReportEnvelope,
  createBugReporter,
  sanitizeDiagnosticValue
} from '../src/bug-reporting/bug-reporter.mjs';

const sanitized = sanitizeDiagnosticValue({
  token: 'super-secret-token',
  nested: {
    message: 'Authorization: Bearer abc.def.ghi',
    password: 'do-not-store'
  }
});

assert.equal(sanitized.token, '[REDACTED]');
assert.equal(sanitized.nested.password, '[REDACTED]');
assert.match(sanitized.nested.message, /\[REDACTED\]/);
assert.doesNotMatch(JSON.stringify(sanitized), /super-secret-token|do-not-store/);

const envelope = buildBugReportEnvelope({
  description: 'World stays black after tapping the button',
  category: 'world',
  gameBuild: 'test-build',
  gameContext: { world: 'Imperial Plaza' },
  diagnostics: { authorization: 'Bearer hidden-value' }
});

assert.equal(envelope.schema_version, 1);
assert.equal(envelope.source, 'player');
assert.equal(envelope.category, 'world');
assert.equal(envelope.environment.game_build, 'test-build');
assert.equal(envelope.game_context.world, 'Imperial Plaza');
assert.equal(envelope.diagnostics.authorization, '[REDACTED]');
assert.equal(envelope.sanitized, true);
assert.match(envelope.client_report_id, /^LOCAL-/);

const reporter = createBugReporter();
assert.equal(reporter.isEnabled(), false);
assert.equal(reporter.open(), false);
assert.equal(reporter.enable(), true);
assert.equal(reporter.isEnabled(), true);
assert.equal(reporter.disable(), true);
assert.equal(reporter.isEnabled(), false);

console.log('bug-reporter-contract: PASS');
