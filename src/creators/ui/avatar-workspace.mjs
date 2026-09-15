/* KELO-INDEX
 * area: CREATORS / AVATAR UI
 * owner: Avatar Quick Import presentation
 * keys: UNIVERSAL SPRITE INGESTION UPLOAD PROGRESS HYPOTHESIS METRICS FRAME DOCTOR 1D 4D 8D
 * owns: zero-adjustment upload path, real animated runtime preview, explicit ambiguity choice and advanced review controls
 * does-not-own: pixel detection, normalization, persistence, renderer or auth rules
 */
import {analyzeUniversalAvatarAsset,compileUniversalAvatarRuntime} from '../avatar/kelo-universal-asset-compiler.mjs';

let active = null;
const css = `
#kelo-avatar-quick{position:fixed;inset:0;z-index:2147482700;background:#08090c;color:#f7f3e9;font-family:Inter,system-ui,-apple-system,sans-serif;overflow:auto}
.kaq-wrap{width:min(760px,100%);margin:auto;padding:14px 14px 54px;box-sizing:border-box}.kaq-head{display:flex;align-items:center;gap:10px;padding:7px 0 15px}.kaq-head b{letter-spacing:.08em}.kaq-x{margin-left:auto;border:1px solid #30333a;background:#15171c;color:#fff;border-radius:11px;padding:9px 12px;font-weight:900}
.kaq-title{text-align:center;margin:16px 0}.kaq-title small{color:#d1ae58;font-weight:900;letter-spacing:.12em}.kaq-title h1{font-size:clamp(28px,8vw,50px);margin:5px 0}.kaq-title p{color:#989ba3;line-height:1.45;margin:8px auto;max-width:620px}
.kaq-drop{display:grid;place-items:center;min-height:138px;border:1px dashed #5d626d;border-radius:22px;background:#101218;text-align:center;padding:22px;cursor:pointer}.kaq-drop.drag{border-color:#d1ae58;background:#17150f}.kaq-drop strong{font-size:20px}.kaq-drop span{display:block;color:#979aa2;margin-top:6px}.kaq-drop input{position:absolute;opacity:0;width:1px;height:1px}
.kaq-stage{margin:12px 0;border:1px solid #252932;border-radius:13px;background:#11141a;padding:11px 13px;color:#b9bcc3;font-size:13px;letter-spacing:.035em}.kaq-stage.good{color:#8ce0ad;border-color:#28553b}.kaq-stage.warn{color:#efcf7b;border-color:#66552a}.kaq-stage.bad{color:#ff9696;border-color:#713838}
.kaq-preview{margin:12px 0 8px;border:1px solid #282b32;background:linear-gradient(45deg,#17191e 25%,transparent 25%) 0 0/18px 18px,linear-gradient(45deg,transparent 75%,#17191e 75%) 0 0/18px 18px,linear-gradient(45deg,transparent 75%,#17191e 75%) 9px -9px/18px 18px,linear-gradient(45deg,#17191e 25%,#0d0f13 25%) 9px 9px/18px 18px;border-radius:22px;min-height:330px;display:grid;place-items:center;overflow:hidden}.kaq-preview canvas{width:min(88vw,440px);height:min(72vw,360px);display:block}
.kaq-controls{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:7px;margin:8px 0}.kaq-controls button,.kaq-direction{border:1px solid #3b414b;background:#12151b;color:#f5f5f5;border-radius:999px;padding:8px 12px;font-size:11px;font-weight:900}.kaq-controls button.on,.kaq-direction.on{border-color:#8e7739;color:#e7c978;background:#211d13}.kaq-directions{display:flex;justify-content:center;flex-wrap:wrap;gap:7px;margin:7px 0 12px}.kaq-direction{min-width:48px;font-size:15px}
.kaq-metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:10px 0}.kaq-metric{border:1px solid #2b2f37;border-radius:13px;background:#101218;padding:9px;text-align:center}.kaq-metric b{display:block;color:#8ce0ad;font-size:17px}.kaq-metric span{display:block;color:#90949c;font-size:9px;font-weight:850;margin-top:3px;letter-spacing:.04em}.kaq-metric.warn b{color:#efcf7b}
.kaq-chips{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0}.kaq-chip{border:1px solid #30343d;border-radius:999px;background:#11141a;color:#c6c9d0;padding:6px 9px;font-size:10px;font-weight:850}.kaq-chip.good{border-color:#28553b;color:#8ce0ad}.kaq-chip.warn{border-color:#66552a;color:#efcf7b}
.kaq-hypotheses{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin:10px 0}.kaq-hypothesis{border:1px solid #30343d;border-radius:13px;background:#101218;color:#d7d9dd;padding:10px;text-align:left}.kaq-hypothesis b,.kaq-hypothesis span{display:block}.kaq-hypothesis span{font-size:10px;color:#92969e;margin-top:4px}.kaq-hypothesis.on{border-color:#d1ae58;background:#1c1911}
.kaq-doctor{border:1px solid #282c33;background:#101218;border-radius:15px;padding:12px;margin:10px 0}.kaq-doctor h3{font-size:13px;margin:0 0 8px}.kaq-frame{border-top:1px solid #252932;padding:8px 0;font-size:11px;color:#c5c8ce}.kaq-frame b{color:#efcf7b}.kaq-frame.art b{color:#ff9696}
.kaq-repair{border-top:1px solid #252932;margin-top:10px;padding-top:10px}.kaq-repair button{border:1px solid #806c38;background:#211d13;color:#efcf7b;border-radius:10px;padding:8px;font-weight:850}.kaq-repair input{width:70px;margin:4px;border:1px solid #373b44;border-radius:8px;background:#090b0f;color:#fff;padding:7px}
.kaq-use{width:100%;border:0;border-radius:16px;background:#d1ae58;color:#111;padding:16px;font-size:17px;font-weight:950;margin-top:12px}.kaq-use:disabled{opacity:.38}.kaq-advanced{margin-top:12px;border:1px solid #262a31;border-radius:15px;background:#101218;padding:12px}.kaq-advanced summary{font-weight:850;cursor:pointer}.kaq-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.kaq-grid label{font-size:10px;color:#9da0a7}.kaq-grid input,.kaq-grid select{width:100%;box-sizing:border-box;margin-top:5px;border:1px solid #373b44;border-radius:10px;background:#090b0f;color:#fff;padding:10px}.kaq-check{display:flex;gap:8px;align-items:flex-start;margin-top:12px;color:#c9cbd0;font-size:12px;line-height:1.35}.kaq-note{color:#858991;font-size:10px;line-height:1.4;margin-top:9px}
@media(max-width:600px){.kaq-metrics{grid-template-columns:repeat(2,1fr)}.kaq-preview{min-height:300px}.kaq-grid{grid-template-columns:1fr}.kaq-wrap{padding-inline:10px}}
`;

function node(document, tag, props = {}, children = []) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') element.className = value;
    else if (key === 'text') element.textContent = value;
    else element[key] = value;
  }
  for (const child of [].concat(children || [])) if (child) element.append(child);
  return element;
}

const pct = value => `${Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100)}%`;
const directionLabels = {n:'N ↑',ne:'NE ↗',e:'E →',se:'SE ↘',s:'S ↓',sw:'SW ↙',w:'W ←',nw:'NW ↖'};

export async function openAvatarQuickImport({root = globalThis, avatarQuick} = {}) {
  if (active) return active;
  if (!root.document || !avatarQuick) throw new Error('AVATAR_QUICK_UI_SERVICES_REQUIRED');
  const document = root.document;
  const style = node(document, 'style', {textContent: css});
  const shell = node(document, 'section', {id: 'kelo-avatar-quick'});
  const wrap = node(document, 'div', {class: 'kaq-wrap'});
  const close = node(document, 'button', {class: 'kaq-x', text: 'CLOSE'});
  wrap.append(
    node(document, 'div', {class: 'kaq-head'}, [node(document, 'b', {text: 'KELO AVATAR'}), close]),
    node(document, 'div', {class: 'kaq-title'}, [
      node(document, 'small', {text: 'UNIVERSAL SPRITE INGESTION V6'}),
      node(document, 'h1', {text: 'Sube. Kelo lo resuelve.'}),
      node(document, 'p', {text: 'Detecta objetos reales, compara varias estructuras, limpia, normaliza y valida el atlas que usará el juego. No necesitas conocer filas, padding ni coordenadas.'})
    ])
  );
  const input = node(document, 'input', {type: 'file', accept: 'image/png,image/webp,image/jpeg'});
  const drop = node(document, 'label', {class: 'kaq-drop'}, [node(document, 'div', {}, [node(document, 'strong', {text: '+ SUBIR SPRITE'}), node(document, 'span', {text: 'PNG / WebP / JPEG · grid o sheet irregular'})]), input]);
  const stage = node(document, 'div', {class: 'kaq-stage', text: 'Elige una imagen. Kelo hace el resto.'});
  const preview = node(document, 'div', {class: 'kaq-preview'});
  const canvas = node(document, 'canvas');
  canvas.width = 440;
  canvas.height = 360;
  preview.append(canvas);
  const controls = node(document, 'div', {class: 'kaq-controls'});
  const play = node(document, 'button', {class: 'on', text: '⏸ ANIMACIÓN REAL'});
  const reset = node(document, 'button', {text: 'CENTRAR'});
  controls.append(play, reset);
  const directions = node(document, 'div', {class: 'kaq-directions'});
  const chips = node(document, 'div', {class: 'kaq-chips'});
  const metrics = node(document, 'div', {class: 'kaq-metrics'});
  const hypotheses = node(document, 'div', {class: 'kaq-hypotheses'});
  const doctor = node(document, 'div', {class: 'kaq-doctor'});
  const repair = node(document, 'div', {class: 'kaq-repair', hidden: true});
  const use = node(document, 'button', {class: 'kaq-use', text: 'USAR COMO AVATAR', disabled: true});
  const advanced = node(document, 'details', {class: 'kaq-advanced'});
  const manual = node(document, 'input', {type: 'checkbox'});
  const columns = node(document, 'input', {type: 'number', min: 1, max: 16, value: 4});
  const rows = node(document, 'input', {type: 'number', min: 1, max: 12, value: 4});
  const rig = node(document, 'select');
  for (const [value, text] of [['','AUTO'],['1','1 DIRECCIÓN'],['4','4 DIRECCIONES'],['8','8 DIRECCIONES']]) rig.append(node(document, 'option', {value, text}));
  const order = node(document, 'input', {type: 'text', placeholder: 's,se,e,ne,n,nw,w,sw'});
  const confirm = node(document, 'input', {type: 'checkbox'});
  const advancedGrid = node(document, 'div', {class: 'kaq-grid'});
  advancedGrid.append(
    node(document, 'label', {text: 'COLUMNAS MANUALES'}, [columns]),
    node(document, 'label', {text: 'FILAS MANUALES'}, [rows]),
    node(document, 'label', {text: 'RIG'}, [rig]),
    node(document, 'label', {text: 'ORDEN DE DIRECCIONES'}, [order])
  );
  advanced.append(
    node(document, 'summary', {text: 'AJUSTES AVANZADOS · solo si Kelo pide revisión'}),
    node(document, 'label', {class: 'kaq-check'}, [manual, node(document, 'span', {text: 'Usar grid manual en vez de la detección visual'})]),
    advancedGrid,
    node(document, 'label', {class: 'kaq-check'}, [confirm, node(document, 'span', {text: 'He revisado la animación y confirmo esta interpretación'})]),
    node(document, 'p', {class: 'kaq-note', text: 'Los defectos de arte o clipping irreversible nunca se ocultan: Kelo señala el frame exacto que necesita regeneración.'})
  );
  wrap.append(drop, stage, preview, controls, directions, chips, metrics, hypotheses, doctor, repair, use, advanced);
  shell.append(wrap);
  document.head.append(style);
  document.body.append(shell);

  let file = null;
  let analysis = null;
  let compiled = null;
  let image = null;
  let imageUrl = null;
  let selectedLayoutSignature = null;
  let selectedDirection = 's';
  let busy = false;
  let selectedRepairIndex = null;
  const framePatches = {};
  let raf = 0;
  const motion = {playing: true, frame: 0, clock: 0, last: 0};

  function setStage(text, kind = '') {
    stage.textContent = text;
    stage.className = `kaq-stage ${kind}`.trim();
  }

  function config() {
    const directionOrder = order.value.split(',').map(value => value.trim()).filter(Boolean);
    const choseAlternative = !!selectedLayoutSignature && selectedLayoutSignature !== analysis?._layoutReport?.best?.signature;
    return {
      ...(analysis || {}),
      universalAuto: !manual.checked,
      detectionMode: manual.checked ? 'manual' : analysis?.detectionMode,
      columns: Math.max(1, Number(columns.value) || 1),
      rows: Math.max(1, Number(rows.value) || 1),
      selectedLayoutSignature,
      rigHint: rig.value ? Number(rig.value) : null,
      sourceDirectionOrder: directionOrder.length ? directionOrder : null,
      framePatches,
      userConfirmedInterpretation: confirm.checked || choseAlternative,
      frameMs: 140
    };
  }

  function resetMotion() {
    motion.frame = 0;
    motion.clock = 0;
    motion.last = 0;
  }

  function paintDirections() {
    directions.replaceChildren();
    const keys = compiled?.directionKeys || analysis?.directionKeys || ['s'];
    if (!keys.includes(selectedDirection)) selectedDirection = keys[0] || 's';
    for (const key of keys) {
      const button = node(document, 'button', {class: `kaq-direction ${key === selectedDirection ? 'on' : ''}`, text: directionLabels[key] || key.toUpperCase()});
      button.onclick = () => {
        selectedDirection = key;
        motion.frame = 0;
        paintDirections();
      };
      directions.append(button);
    }
  }

  function metric(label, value, good = .88) {
    return node(document, 'div', {class: `kaq-metric ${Number(value) < good ? 'warn' : ''}`}, [
      node(document, 'b', {text: pct(value)}),
      node(document, 'span', {text: label})
    ]);
  }

  function paintMetrics() {
    metrics.replaceChildren();
    const scores = compiled?.validation?.scores;
    if (!scores) return;
    metrics.append(
      metric('DETECTION', scores.detection),
      metric('ALIGNMENT', scores.alignment),
      metric('BACKGROUND', scores.background),
      metric('FRAME CONSISTENCY', scores.frameConsistency),
      metric('FINAL HEALTH', scores.finalHealth, .84)
    );
  }

  function paintChips() {
    chips.replaceChildren();
    if (!analysis) return;
    const values = [
      [`${analysis.detectedFrames} FRAMES`, true],
      [String(compiled?.strategy || analysis.strategy || '').toUpperCase(), true],
      [`RIG ${compiled?.directions || analysis.directions}D`, true],
      [`CONFIANZA ${pct(compiled?.confidenceScore ?? analysis.confidenceScore)}`, (compiled?.confidenceScore ?? analysis.confidenceScore) >= .78],
      [analysis.backgroundKind === 'transparent' ? 'TRANSPARENTE' : 'FONDO LIMPIADO', true]
    ];
    if (compiled?.selfHealed) values.push(['AUTO-REPARADO', true]);
    if (compiled) values.push([compiled.status, !compiled.reviewRequired]);
    for (const [text, good] of values) chips.append(node(document, 'span', {class: `kaq-chip ${good ? 'good' : 'warn'}`, text}));
  }

  function paintHypotheses() {
    hypotheses.replaceChildren();
    if (!analysis?.hypotheses?.length) return;
    const close = analysis.hypotheses.filter((candidate, index) => index < 3 && (index === 0 || analysis.hypotheses[0].score - candidate.score <= .09));
    if (close.length < 2 && !analysis.reviewRequired) return;
    for (const candidate of close) {
      const selected = (selectedLayoutSignature || analysis.hypotheses[0].signature) === candidate.signature;
      const button = node(document, 'button', {class: `kaq-hypothesis ${selected ? 'on' : ''}`}, [
        node(document, 'b', {text: `${candidate.mode} · ${candidate.frames} frames`}),
        node(document, 'span', {text: `${candidate.rows} grupos · ${candidate.frameCounts.join('/')} · ${pct(candidate.score)}`})
      ]);
      button.onclick = () => {
        selectedLayoutSignature = candidate.signature;
        paintHypotheses();
        void refreshPreview();
      };
      hypotheses.append(button);
    }
  }

  function paintDoctor() {
    doctor.replaceChildren();
    const report = compiled?.frameDoctor;
    if (!report) {
      doctor.hidden = true;
      return;
    }
    doctor.hidden = false;
    doctor.append(node(document, 'h3', {text: `${report.healthyCount} frames correctos · ${report.defectiveCount} sospechosos`}));
    if (!report.defective.length) doctor.append(node(document, 'div', {class: 'kaq-frame', text: 'Frame Doctor: ningún salto, clipping ni drift detectado.'}));
    for (const frame of report.defective.slice(0, 8)) {
      const frameDetails = [
        frame.verticalScaleDelta ? `vertical scale ${frame.verticalScaleDelta > 0 ? '+' : ''}${Math.round(frame.verticalScaleDelta * 100)}%` : null,
        frame.feetOffsetPx ? `feet offset ${Math.round(frame.feetOffsetPx)} px` : null,
        ...frame.reasons
      ].filter(Boolean).join(' · ');
      const row = node(document, 'div', {class: `kaq-frame ${frame.reasons.includes('clipped') ? 'art' : ''}`}, [
        node(document, 'b', {text: `${frame.direction} / WALK / FRAME ${frame.phase}`}),
        node(document, 'div', {text: frameDetails})
      ]);
      const edit = node(document, 'button', {text: 'AJUSTAR ESTE FRAME'});
      edit.onclick = () => openRepair(frame.index, frame.label);
      row.append(edit);
      doctor.append(row);
    }
    for (const defect of compiled.validation?.artDefects || []) doctor.append(node(document, 'div', {class: 'kaq-frame art'}, [
      node(document, 'b', {text: `${defect.direction} / FRAME ${defect.column + 1}`}),
      node(document, 'div', {text: 'ART DEFECT — REGENERATION REQUIRED'})
    ]));
  }

  function openRepair(index, label) {
    selectedRepairIndex = index;
    const patch = framePatches[index] || {};
    repair.replaceChildren(
      node(document, 'b', {text: `REPARAR · ${label}`}),
      node(document, 'div', {text: 'Ajuste mecánico local; los demás frames no se recompilan visualmente.'}),
    );
    const scale = node(document, 'input', {type: 'number', step: '.01', value: patch.scale || 1});
    const x = node(document, 'input', {type: 'number', step: '1', value: patch.x || 0});
    const y = node(document, 'input', {type: 'number', step: '1', value: patch.y || 0});
    const apply = node(document, 'button', {text: 'APLICAR PATCH'});
    const copy = node(document, 'button', {text: 'COPIAR FRAME ANTERIOR'});
    apply.onclick = () => { framePatches[index] = {scale: Number(scale.value) || 1, x: Number(x.value) || 0, y: Number(y.value) || 0}; void refreshPreview(); };
    copy.onclick = () => { if (index > 0) { framePatches[index] = {copyFrom: index - 1, scale: 1, x: 0, y: 0}; void refreshPreview(); } };
    repair.append(node(document, 'label', {text: 'ESCALA'}, [scale]), node(document, 'label', {text: 'X'}, [x]), node(document, 'label', {text: 'Y'}, [y]), apply, copy);
    repair.hidden = false;
  }

  function drawFrame() {
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!compiled || !image?.complete || !image.naturalWidth) return;
    const row = Math.max(0, Math.min(compiled.rows - 1, Number(compiled.rowMap?.[selectedDirection] ?? 0)));
    const count = compiled.frameCounts?.[row] || compiled.columns;
    const frame = motion.frame % Math.max(1, count);
    const sourceWidth = image.naturalWidth / compiled.columns;
    const sourceHeight = image.naturalHeight / compiled.rows;
    const scale = Math.min(270 / sourceWidth, 270 / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    context.drawImage(image, frame * sourceWidth, row * sourceHeight, sourceWidth, sourceHeight, (canvas.width - width) / 2, canvas.height * .84 - height, width, height);
  }

  function tick(now) {
    const current = Number(now) || Date.now();
    const delta = motion.last ? Math.min(50, current - motion.last) : 0;
    motion.last = current;
    if (compiled && motion.playing) {
      motion.clock += delta;
      const frameMs = Number(compiled.frameMs) || 140;
      if (motion.clock >= frameMs) {
        motion.frame += Math.floor(motion.clock / frameMs);
        motion.clock %= frameMs;
      }
    }
    drawFrame();
    raf = root.requestAnimationFrame(tick);
  }

  function exposeTestState() {
    root.__KELO_AVATAR_COMPILER_TEST__ = {
      ready: !!compiled,
      analysis: analysis ? {frames: analysis.detectedFrames, hypotheses: analysis.hypotheses, directions: analysis.directions, reviewRequired: analysis.reviewRequired} : null,
      compiled: compiled ? {columns: compiled.columns, rows: compiled.rows, frameCounts: compiled.frameCounts, directionKeys: compiled.directionKeys, status: compiled.status, scores: compiled.validation?.scores, doctor: {healthy: compiled.frameDoctor?.healthyCount, suspicious: compiled.frameDoctor?.defectiveCount}} : null
    };
  }

  async function refreshPreview() {
    if (!file || !analysis) return;
    use.disabled = true;
    setStage('NORMALIZANDO…');
    try {
      compiled = await compileUniversalAvatarRuntime(file, config(), {root, onProgress: event => event?.message && setStage(event.message)});
      if (imageUrl) root.URL.revokeObjectURL(imageUrl);
      imageUrl = root.URL.createObjectURL(compiled.blob);
      image = new root.Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = imageUrl;
      });
      resetMotion();
      paintDirections();
      paintMetrics();
      paintChips();
      paintHypotheses();
      paintDoctor();
      const artDefect = !!compiled.validation?.artDefects?.length;
      const acceptedReview = confirm.checked || config().userConfirmedInterpretation;
      use.disabled = artDefect || (compiled.reviewRequired && !acceptedReview);
      if (artDefect) setStage('ART DEFECT — REGENERATION REQUIRED · revisa el Frame Doctor', 'bad');
      else if (compiled.reviewRequired && !acceptedReview) {
        setStage(`REVIEW REQUIRED · ${compiled.reviewReasons.join(' · ')}`, 'warn');
        advanced.open = true;
      } else setStage(`VALIDADO · asset runtime ${compiled.columns}×${compiled.rows} · salud ${pct(compiled.validation.scores.finalHealth)}`, 'good');
      exposeTestState();
    } catch (error) {
      compiled = null;
      setStage(String(error?.message || error), 'bad');
      exposeTestState();
    }
  }

  async function analyze(selectedFile) {
    file = selectedFile;
    analysis = null;
    compiled = null;
    selectedLayoutSignature = null;
    confirm.checked = false;
    use.disabled = true;
    chips.replaceChildren();
    metrics.replaceChildren();
    hypotheses.replaceChildren();
    doctor.hidden = true;
    setStage('ANALIZANDO…');
    try {
      analysis = await analyzeUniversalAvatarAsset(file, {root, onProgress: event => event?.message && setStage(event.message)});
      columns.value = analysis.columns;
      rows.value = analysis.rows;
      selectedLayoutSignature = analysis.hypotheses[0]?.signature || null;
      paintChips();
      paintHypotheses();
      await refreshPreview();
    } catch (error) {
      setStage(String(error?.message || error), 'bad');
    }
  }

  input.onchange = () => {
    const selected = input.files?.[0];
    if (selected) void analyze(selected);
  };
  for (const eventName of ['dragenter', 'dragover']) drop.addEventListener(eventName, event => {
    event.preventDefault();
    drop.classList.add('drag');
  });
  for (const eventName of ['dragleave', 'drop']) drop.addEventListener(eventName, event => {
    event.preventDefault();
    drop.classList.remove('drag');
  });
  drop.addEventListener('drop', event => {
    const selected = event.dataTransfer?.files?.[0];
    if (selected) void analyze(selected);
  });
  play.onclick = () => {
    motion.playing = !motion.playing;
    play.classList.toggle('on', motion.playing);
    play.textContent = motion.playing ? '⏸ ANIMACIÓN REAL' : '▶ ANIMACIÓN REAL';
  };
  reset.onclick = resetMotion;
  for (const element of [manual, columns, rows, rig, order]) element.onchange = () => void refreshPreview();
  confirm.onchange = () => void refreshPreview();
  use.onclick = async () => {
    if (!file || !compiled || busy || use.disabled) return;
    busy = true;
    use.disabled = true;
    use.textContent = 'ACTIVANDO…';
    try {
      const result = await avatarQuick.importAndUse(file, config(), {displayName: file.name.replace(/\.[^.]+$/, ''), onProgress: event => setStage(event.message || event.stage)});
      setStage(`VALIDADO Y ACTIVO · ${result.manifest.displayName}`, 'good');
      use.textContent = 'AVATAR ACTIVO ✓';
    } catch (error) {
      setStage(String(error?.message || error), 'bad');
      use.textContent = 'REINTENTAR';
      use.disabled = false;
    } finally {
      busy = false;
    }
  };
  try { await avatarQuick.hydrateActive(); } catch {}
  function destroy() {
    if (active?.shell !== shell) return;
    active = null;
    root.cancelAnimationFrame(raf);
    if (imageUrl) root.URL.revokeObjectURL(imageUrl);
    shell.remove();
    style.remove();
  }
  close.onclick = destroy;
  raf = root.requestAnimationFrame(tick);
  active = F({version: 'kelo-avatar-quick-ui-v6.0.0-universal-ingestion', shell, close: destroy});
  return active;
}
