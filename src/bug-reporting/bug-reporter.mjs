/* KELO-INDEX
 * area: BUG REPORTING
 * owner: KeloBugReporter
 * purpose: recoger reportes sanitizados de jugadores con descripción, contexto y screenshot opcional sin imponer transporte/backend
 * public-api: createBugReporter, sanitizeDiagnosticValue, buildBugReportEnvelope
 * consumes: DOM opcional, Canvas opcional, callbacks submitReport/getGameContext/getDiagnostics
 * state-owned: UI temporal del formulario y draft local no persistente
 * extension-points: submitReport transport adapter, context provider, diagnostics provider, screenshot target
 * reuse: activar desde una superficie UI existente e inyectar transporte; no crear otro reporter paralelo
 * online: el backend asigna REPORT-NNNNNN y persiste metadata/storage; el cliente solo solicita submit
 * do-not: NO persistir tokens/cookies/JWT, NO guardar screenshots grandes en Git, NO asumir que un submit local equivale a bug canónico
 */

const DEFAULT_CATEGORIES = ['gameplay', 'world', 'ui', 'login', 'inventory', 'combat', 'network', 'other'];
const SECRET_KEY = /(token|jwt|password|passwd|secret|access[_-]?key|service[_-]?role|authorization|cookie)/i;
const SECRET_VALUE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /eyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}/g,
  /(access_token|refresh_token|service_role|api[_-]?key|password)=([^&\s]+)/gi
];

function redactString(value) {
  let out = String(value ?? '');
  for (const pattern of SECRET_VALUE_PATTERNS) out = out.replace(pattern, match => {
    const eq = match.indexOf('=');
    return eq >= 0 ? `${match.slice(0, eq + 1)}[REDACTED]` : '[REDACTED]';
  });
  return out.slice(0, 12000);
}

export function sanitizeDiagnosticValue(value, depth = 0) {
  if (depth > 6) return '[TRUNCATED_DEPTH]';
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.slice(0, 100).map(item => sanitizeDiagnosticValue(item, depth + 1));
  if (typeof value === 'object') {
    const clean = {};
    for (const [key, nested] of Object.entries(value).slice(0, 100)) {
      clean[key] = SECRET_KEY.test(key) ? '[REDACTED]' : sanitizeDiagnosticValue(nested, depth + 1);
    }
    return clean;
  }
  return redactString(value);
}

function nowIso() {
  return new Date().toISOString();
}

function clientReportId() {
  try {
    if (globalThis.crypto?.randomUUID) return `LOCAL-${globalThis.crypto.randomUUID()}`;
  } catch (_) {}
  return `LOCAL-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultEnvironment() {
  const nav = globalThis.navigator;
  const scr = globalThis.screen;
  return sanitizeDiagnosticValue({
    userAgent: nav?.userAgent || null,
    language: nav?.language || null,
    viewport: typeof innerWidth === 'number' && typeof innerHeight === 'number' ? `${innerWidth}x${innerHeight}` : null,
    screen: scr ? `${scr.width}x${scr.height}` : null,
    online: typeof nav?.onLine === 'boolean' ? nav.onLine : null,
    url: globalThis.location ? `${location.origin}${location.pathname}` : null
  });
}

export function buildBugReportEnvelope({ description, category = 'other', gameContext = {}, diagnostics = {}, gameBuild = null } = {}) {
  return {
    schema_version: 1,
    id: null,
    client_report_id: clientReportId(),
    created_at: nowIso(),
    source: 'player',
    player_description: redactString(description || '').trim().slice(0, 4000),
    category: DEFAULT_CATEGORIES.includes(category) ? category : 'other',
    screenshot_ref: null,
    environment: {
      game_build: gameBuild || null,
      ...defaultEnvironment()
    },
    game_context: sanitizeDiagnosticValue(gameContext || {}),
    diagnostics: sanitizeDiagnosticValue(diagnostics || {}),
    sanitized: true,
    triage: {
      status: 'UNTRIAGED',
      bug_id: null,
      duplicate_report: false,
      notes: []
    }
  };
}

async function canvasToBlob(canvas) {
  if (!canvas || typeof canvas.toBlob !== 'function') return null;
  return new Promise(resolve => {
    try {
      canvas.toBlob(blob => resolve(blob || null), 'image/webp', 0.86);
    } catch (_) {
      resolve(null);
    }
  });
}

function ensureStyles(doc) {
  if (doc.getElementById('kelo-bug-reporter-style')) return;
  const style = doc.createElement('style');
  style.id = 'kelo-bug-reporter-style';
  style.textContent = `
#kelo-bug-reporter{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:rgba(0,0,0,.72);padding:16px;font-family:system-ui,sans-serif}
#kelo-bug-reporter[hidden]{display:none!important}
#kelo-bug-reporter .kbr-card{width:min(560px,100%);max-height:min(760px,92vh);overflow:auto;background:#111827;color:#f9fafb;border:1px solid rgba(255,255,255,.16);border-radius:18px;padding:18px;box-sizing:border-box}
#kelo-bug-reporter h2{margin:0 0 6px;font-size:20px}
#kelo-bug-reporter p{margin:0 0 14px;font-size:13px;opacity:.78}
#kelo-bug-reporter label{display:block;font-size:13px;margin:12px 0 6px}
#kelo-bug-reporter textarea,#kelo-bug-reporter select,#kelo-bug-reporter input{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.18);border-radius:12px;background:#0b1220;color:#fff;padding:12px;font:inherit}
#kelo-bug-reporter textarea{min-height:120px;resize:vertical}
#kelo-bug-reporter .kbr-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
#kelo-bug-reporter button{border:0;border-radius:12px;padding:11px 14px;font-weight:700;cursor:pointer}
#kelo-bug-reporter .kbr-primary{background:#fff;color:#111827}
#kelo-bug-reporter .kbr-secondary{background:#243047;color:#fff}
#kelo-bug-reporter .kbr-preview{max-width:100%;max-height:220px;border-radius:12px;margin-top:10px;display:none}
#kelo-bug-reporter .kbr-status{min-height:20px;font-size:12px;margin-top:10px;opacity:.85}
`;
  (doc.head || doc.documentElement).appendChild(style);
}

export function createBugReporter(options = {}) {
  let enabled = options.enabled === true;
  let screenshotBlob = null;
  let screenshotObjectUrl = null;
  let root = null;

  const doc = options.document || globalThis.document || null;
  const getGameContext = typeof options.getGameContext === 'function' ? options.getGameContext : async () => ({});
  const getDiagnostics = typeof options.getDiagnostics === 'function' ? options.getDiagnostics : async () => ({});
  const submitReport = typeof options.submitReport === 'function' ? options.submitReport : null;
  const gameBuild = options.gameBuild || null;

  function cleanupPreview() {
    if (screenshotObjectUrl) {
      try { URL.revokeObjectURL(screenshotObjectUrl); } catch (_) {}
    }
    screenshotObjectUrl = null;
    screenshotBlob = null;
  }

  function close() {
    if (root) root.hidden = true;
  }

  async function captureGameScreenshot() {
    if (!doc) return null;
    const target = typeof options.getScreenshotTarget === 'function'
      ? await options.getScreenshotTarget()
      : doc.querySelector('canvas');
    screenshotBlob = await canvasToBlob(target);
    return screenshotBlob;
  }

  async function send({ description, category }) {
    if (!enabled) throw new Error('KeloBugReporter is disabled');
    if (!String(description || '').trim()) throw new Error('Describe what happened before sending the report.');

    const [gameContext, diagnostics] = await Promise.all([
      Promise.resolve(getGameContext()).catch(error => ({ provider_error: String(error) })),
      Promise.resolve(getDiagnostics()).catch(error => ({ provider_error: String(error) }))
    ]);

    const envelope = buildBugReportEnvelope({ description, category, gameContext, diagnostics, gameBuild });
    if (!submitReport) {
      try {
        globalThis.dispatchEvent?.(new CustomEvent('kelo:bug-report-submit-requested', {
          detail: { envelope, screenshotBlob }
        }));
      } catch (_) {}
      return { accepted: false, reason: 'NO_TRANSPORT', envelope };
    }

    const result = await submitReport({ envelope, screenshotBlob });
    return { accepted: true, envelope, result: result || null };
  }

  function render() {
    if (!doc) throw new Error('KeloBugReporter requires a DOM to render its UI.');
    if (root) return root;
    ensureStyles(doc);

    root = doc.createElement('div');
    root.id = 'kelo-bug-reporter';
    root.hidden = true;
    root.innerHTML = `
      <section class="kbr-card" role="dialog" aria-modal="true" aria-labelledby="kbr-title">
        <h2 id="kbr-title">Reportar un problema</h2>
        <p>Cuéntanos qué pasó. Puedes adjuntar una foto o capturar el juego. No incluyas contraseñas ni información privada.</p>
        <label for="kbr-category">Categoría</label>
        <select id="kbr-category">${DEFAULT_CATEGORIES.map(value => `<option value="${value}">${value}</option>`).join('')}</select>
        <label for="kbr-description">¿Qué pasó?</label>
        <textarea id="kbr-description" maxlength="4000" placeholder="Ejemplo: abrí Create, toqué World y la pantalla se quedó negra."></textarea>
        <label for="kbr-file">Foto opcional</label>
        <input id="kbr-file" type="file" accept="image/*" />
        <img class="kbr-preview" alt="Vista previa del reporte" />
        <div class="kbr-actions">
          <button type="button" class="kbr-secondary" data-kbr-capture>Capturar juego</button>
          <button type="button" class="kbr-primary" data-kbr-send>Enviar reporte</button>
          <button type="button" class="kbr-secondary" data-kbr-close>Cancelar</button>
        </div>
        <div class="kbr-status" aria-live="polite"></div>
      </section>`;

    const preview = root.querySelector('.kbr-preview');
    const file = root.querySelector('#kbr-file');
    const status = root.querySelector('.kbr-status');

    function showPreview(blob) {
      if (!blob) { preview.style.display = 'none'; preview.removeAttribute('src'); return; }
      if (screenshotObjectUrl) try { URL.revokeObjectURL(screenshotObjectUrl); } catch (_) {}
      screenshotObjectUrl = URL.createObjectURL(blob);
      preview.src = screenshotObjectUrl;
      preview.style.display = 'block';
    }

    file.addEventListener('change', () => {
      const chosen = file.files?.[0] || null;
      if (chosen && chosen.type.startsWith('image/')) {
        screenshotBlob = chosen;
        showPreview(chosen);
      }
    });

    root.querySelector('[data-kbr-capture]').addEventListener('click', async () => {
      status.textContent = 'Capturando…';
      const blob = await captureGameScreenshot();
      if (blob) {
        showPreview(blob);
        status.textContent = 'Captura lista.';
      } else {
        status.textContent = 'No se pudo capturar automáticamente. Puedes adjuntar una foto.';
      }
    });

    root.querySelector('[data-kbr-close]').addEventListener('click', close);
    root.querySelector('[data-kbr-send]').addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      status.textContent = 'Enviando…';
      try {
        const result = await send({
          description: root.querySelector('#kbr-description').value,
          category: root.querySelector('#kbr-category').value
        });
        if (!result.accepted) {
          status.textContent = 'El formulario está listo, pero todavía no hay transporte de reportes conectado.';
          return;
        }
        status.textContent = result.result?.id ? `Reporte ${result.result.id} enviado.` : 'Reporte enviado.';
        root.querySelector('#kbr-description').value = '';
        file.value = '';
        cleanupPreview();
        preview.style.display = 'none';
        preview.removeAttribute('src');
        setTimeout(close, 500);
      } catch (error) {
        status.textContent = `No se pudo enviar: ${String(error?.message || error)}`;
      } finally {
        button.disabled = false;
      }
    });

    (doc.body || doc.documentElement).appendChild(root);
    return root;
  }

  return Object.freeze({
    enable() { enabled = true; return true; },
    disable() { enabled = false; close(); return true; },
    isEnabled() { return enabled; },
    open() { if (!enabled) return false; render().hidden = false; return true; },
    close,
    render,
    send,
    captureGameScreenshot,
    destroy() { cleanupPreview(); root?.remove(); root = null; },
    contract: Object.freeze({ version: 1, categories: [...DEFAULT_CATEGORIES] })
  });
}
