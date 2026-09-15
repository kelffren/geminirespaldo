/* KELO-INDEX
 * area: STUDIO / CREATOR WORKSPACE
 * owner: Kelo Studio Live Shell
 * keys: STUDIO UI MOBILE CREATOR ASSETS EXPLORER PROPERTIES DELETE TOOL STATUS
 * owns: responsive creator chrome, visual Assets browser, Explorer, Properties UI, premium control deck and compact mobile asset-paint flow
 * does-not-own: world input, rendering, authority or document mutation
 * public-api: createStudioLiveShell()
 * online: no; callbacks delegate all persistent work to Studio Kernel
 * mobile-flow: choose asset -> compact placement strip -> EDIT reopens workspace without clearing the active asset
 * mobile: reuse an already-painted #kelo-studio-live instead of wiping innerHTML; abort previous listeners so hydrate does not clone the tree
 */

import { virtualRange } from './virtual-list.mjs';

const SHELL_VERSION='studio-live-shell-v1.7.0';

const TOOL_LABELS=Object.freeze({
  select:'Selección',
  move:'Mover',
  camera:'Cámara',
  placement:'Colocar asset',
  prefab:'Colocar prefab',
  terrain:'Terreno',
  path:'Caminos',
  collision:'Colisión',
  play:'Playtest'
});

let liveShellAbort=null;
export function createStudioLiveShell({
  host=globalThis.document?.body,assets=[],reuse=false,onMode,onAsset,onUndo,onRedo,onRotate,onScale,onErase,onSave,onClose,
  onSelectEntity,onDuplicate,onDelete,onPropertyChange,onPlay,onBrushSize,onFocus,renderAssetPreview
}={}){
  try{liveShellAbort?.abort();}catch{}
  liveShellAbort=new AbortController();
  const signal=liveShellAbort.signal;
  const document=host?.ownerDocument||globalThis.document;
  if(!document||!host)throw new Error('STUDIO_LIVE_SHELL_HOST_REQUIRED');
  const view=document.defaultView||globalThis;

  let root=document.getElementById('kelo-studio-live');
  if(root?.isConnected===false)root=null;
  const canReuse=!!reuse&&!!root?.querySelector?.('.ks-top')&&root.dataset?.shellVersion===SHELL_VERSION;
  let style=canReuse?document.querySelector('style[data-kelo-studio-ui="1"]'):null;
  if(!style){
  style=document.createElement('style');
  style.dataset.keloStudioUi='1';
  style.textContent=`
  #kelo-studio-live{
    position:fixed;inset:0;z-index:2147482200;pointer-events:none;color:#edf4ef;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    --ks-gold:#e7c56a;--ks-gold-2:#f4dd8d;--ks-bg:rgba(5,12,14,.965);
    --ks-panel:rgba(10,24,25,.94);--ks-panel-soft:rgba(15,31,31,.88);
    --ks-line:rgba(231,197,106,.22);--ks-line-soft:rgba(255,255,255,.08);
    --ks-muted:#88a096;--ks-text:#eef4ef;--ks-green:#264b3c;--ks-danger:#ff7a70;
  }
  #kelo-studio-live *{box-sizing:border-box}
  @media (pointer:coarse),(max-width:900px){
    #kelo-studio-live,#kelo-studio-live *{
      backdrop-filter:none!important;-webkit-backdrop-filter:none!important;
    }
  }
  #kelo-studio-live button,#kelo-studio-live select,#kelo-studio-live input{font:inherit}
  #kelo-studio-live button{cursor:pointer;-webkit-tap-highlight-color:transparent}
  #kelo-studio-live button:disabled{opacity:.35;cursor:not-allowed;filter:saturate(.55)}

  .ks-top{
    position:absolute;left:12px;right:12px;top:max(8px,env(safe-area-inset-top));
    min-height:58px;display:flex;align-items:center;gap:9px;padding:8px 10px;
    border:1px solid rgba(231,197,106,.48);border-radius:18px;
    background:linear-gradient(180deg,rgba(8,18,20,.985),rgba(5,12,14,.965));
    box-shadow:0 16px 46px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.035);
    pointer-events:auto
  }
  .ks-brand{display:flex;align-items:center;gap:9px;min-width:0}
  .ks-brand-mark{
    width:36px;height:36px;border:1px solid rgba(231,197,106,.48);border-radius:11px;
    display:grid;place-items:center;color:var(--ks-gold-2);
    background:radial-gradient(circle at 40% 28%,rgba(231,197,106,.18),rgba(11,27,25,.9) 64%);
    box-shadow:inset 0 0 18px rgba(231,197,106,.07);font-size:18px
  }
  .ks-brand-copy{min-width:0;line-height:1}
  .ks-title{font-family:Georgia,"Times New Roman",serif;font-size:13px;font-weight:800;letter-spacing:.13em;color:var(--ks-gold-2);white-space:nowrap}
  .ks-subtitle{margin-top:5px;font-size:6.5px;font-weight:850;letter-spacing:.24em;color:#9bb7ad;white-space:nowrap}
  .ks-spacer{flex:1}
  .ks-top button,.ks-mini,.ks-deck button,.ks-tabs button,.ks-compact-bar button{
    border:1px solid rgba(231,197,106,.22);border-radius:11px;background:#0f1b1d;color:#dce6e0;
    font-size:7px;font-weight:900;min-height:36px;padding:0 11px;letter-spacing:.035em;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.025)
  }
  .ks-top button:hover,.ks-deck button:hover,.ks-tabs button:hover{border-color:rgba(231,197,106,.48)}
  .ks-top button.on,.ks-deck button.on,.ks-tabs button.on,.ks-compact-bar button.on{
    border-color:var(--ks-gold);background:linear-gradient(180deg,#29493c,#1d372f);color:#fff2bc;
    box-shadow:0 0 0 1px rgba(231,197,106,.08),inset 0 1px 0 rgba(255,255,255,.05)
  }
  .ks-top .primary,.ks-compact-bar .primary{
    border-color:rgba(231,197,106,.68);background:linear-gradient(180deg,#3e6b53,#2a4f40);color:#fff0b2;
    box-shadow:0 0 18px rgba(231,197,106,.13),inset 0 1px 0 rgba(255,255,255,.08)
  }
  .ks-top [data-act="save"]{min-width:72px}
  .ks-x{font-size:18px!important;min-width:40px;padding:0!important}
  .ks-ico{display:inline-grid;place-items:center;min-width:14px;margin-right:5px;font-size:12px;line-height:1}

  .ks-left,.ks-right{
    position:absolute;top:78px;bottom:92px;width:290px;border:1px solid rgba(231,197,106,.28);
    border-radius:17px;background:var(--ks-bg);box-shadow:0 18px 48px rgba(0,0,0,.42);
    overflow:hidden;pointer-events:auto
  }
  .ks-left{left:12px}.ks-right{right:12px;width:300px}
  .ks-panel-head{
    height:42px;display:flex;align-items:center;padding:0 11px;border-bottom:1px solid var(--ks-line-soft);
    font-size:8px;font-weight:950;letter-spacing:.15em;color:#e8cf7d
  }
  .ks-search{
    width:calc(100% - 16px);height:36px;margin:7px 8px;border:1px solid rgba(255,255,255,.1);
    border-radius:10px;background:#0e191b;color:#fff;padding:0 10px;outline:none
  }
  .ks-search:focus{border-color:rgba(231,197,106,.55);box-shadow:0 0 0 2px rgba(231,197,106,.07)}
  .ks-assets,.ks-explorer{position:relative;overflow:auto;height:calc(100% - 84px)}
  .ks-inner,.ks-explorer-inner{position:relative;width:100%}
  .ks-row,.ks-tree-row{
    position:absolute;left:7px;right:7px;border:1px solid var(--ks-line-soft);border-radius:11px;
    background:rgba(13,23,25,.94);color:#e8efea;text-align:left;font-size:9px;font-weight:850
  }
  .ks-row{height:64px;padding:5px;display:grid;grid-template-columns:54px 1fr;align-items:center;gap:8px}
  .ks-tree-row{height:42px;padding:6px 9px}
  .ks-row canvas{
    width:54px;height:54px;border-radius:9px;background:linear-gradient(135deg,#121d20,#081012);
    border:1px solid rgba(255,255,255,.06);image-rendering:pixelated
  }
  .ks-row .ks-asset-copy{min-width:0}
  .ks-row small,.ks-tree-row small{display:block;color:#7f968c;font-size:7px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ks-row.on,.ks-tree-row.on{border-color:var(--ks-gold);background:#172720}
  .ks-row.on canvas{border-color:rgba(231,197,106,.55);box-shadow:0 0 0 1px rgba(231,197,106,.12)}
  .ks-right-body{height:100%;display:grid;grid-template-rows:minmax(180px,1fr) minmax(220px,1.1fr)}
  .ks-pane{min-height:0;border-bottom:1px solid var(--ks-line-soft)}
  .ks-explorer{height:calc(100% - 42px)}
  .ks-properties{padding:8px;overflow:auto;height:calc(100% - 42px)}
  .ks-empty{font-size:8px;color:#789085;padding:12px;line-height:1.6}
  .ks-field{display:grid;grid-template-columns:74px 1fr;align-items:center;gap:8px;margin-bottom:7px}
  .ks-field label{font-size:7px;color:#91a79d;font-weight:800}
  .ks-field input{height:32px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#0d1719;color:#fff;padding:0 8px;font-size:9px}
  .ks-meta{font-size:7px;color:#799087;line-height:1.55;margin:5px 0 9px;word-break:break-word}
  .ks-prop-actions{display:flex;gap:6px;flex-wrap:wrap}.ks-prop-actions button{flex:1;min-width:72px}

  .ks-bottom{
    position:absolute;left:50%;bottom:max(8px,env(safe-area-inset-bottom));transform:translateX(-50%);
    width:min(940px,calc(100vw - 24px));max-height:min(44vh,390px);overflow:auto;
    padding:9px;border:1px solid rgba(231,197,106,.45);border-radius:18px;
    background:linear-gradient(180deg,rgba(5,14,16,.975),rgba(6,17,18,.965));
    box-shadow:0 20px 58px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.035);
    pointer-events:auto
  }
  .ks-deck{display:block}
  .ks-deck-head{
    min-height:48px;display:flex;align-items:center;gap:10px;padding:2px 3px 8px;
    border-bottom:1px solid rgba(231,197,106,.14)
  }
  .ks-deck-emblem{
    width:38px;height:38px;flex:0 0 38px;display:grid;place-items:center;border-radius:11px;
    border:1px solid rgba(231,197,106,.46);color:var(--ks-gold-2);font-size:18px;
    background:linear-gradient(145deg,rgba(231,197,106,.12),rgba(18,38,35,.9))
  }
  .ks-deck-brand{min-width:0}
  .ks-deck-brand strong{display:block;font-family:Georgia,"Times New Roman",serif;color:#f1d77e;font-size:10px;letter-spacing:.12em}
  .ks-deck-brand small{display:block;color:#9db4aa;font-size:6.5px;letter-spacing:.16em;margin-top:3px}
  .ks-active-tool{
    margin-left:auto;min-width:180px;max-width:280px;display:flex;align-items:center;gap:7px;
    padding:7px 10px;border:1px solid rgba(231,197,106,.26);border-radius:12px;background:rgba(16,31,31,.72)
  }
  .ks-active-tool-icon{color:var(--ks-gold-2);font-size:14px}
  .ks-active-tool-copy{min-width:0}
  .ks-active-tool-copy small{display:block;color:#89a49a;font-size:6px}
  .ks-active-tool-copy strong{display:block;color:#f2d77d;font-size:8px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ks-selection-badge{margin-left:4px;font-size:6px;color:#91a89f;white-space:nowrap}

  .ks-deck-body{display:grid;grid-template-columns:1.2fr .9fr 1.2fr;gap:7px;padding-top:8px}
  .ks-deck-section{
    min-width:0;border:1px solid rgba(231,197,106,.18);border-radius:13px;
    background:linear-gradient(180deg,rgba(12,26,27,.78),rgba(9,19,21,.78));padding:7px
  }
  .ks-edit-section{grid-column:1/4}
  .ks-section-title{font-size:6px;font-weight:950;letter-spacing:.18em;color:#86a7a0;margin:0 0 6px 2px}
  .ks-edit-primary,.ks-history-actions,.ks-mode-actions{display:flex;gap:5px;align-items:center;min-width:0}
  .ks-edit-primary{overflow-x:auto;padding-bottom:1px}
  .ks-edit-primary button,.ks-history-actions button,.ks-mode-actions button{white-space:nowrap}
  .ks-edit-primary [data-act="delete"],.ks-compact-bar [data-act="delete"],.ks-prop-actions [data-act="delete"]{
    border-color:rgba(255,122,112,.38);color:#ffd4cf;background:rgba(65,24,24,.36)
  }
  .ks-edit-primary [data-act="delete"]:not(:disabled):hover,.ks-compact-bar [data-act="delete"]:not(:disabled):hover{
    border-color:rgba(255,122,112,.72);background:rgba(96,30,30,.48)
  }
  .ks-edit-primary [data-mode="select"].on{box-shadow:0 0 18px rgba(231,197,106,.14)}
  .ks-productivity-edit-slot{display:inline-flex;gap:5px}
  .ks-productivity-map-slot,.ks-productivity-view-slot{min-width:0}
  .ks-mode-section{grid-column:1/4}
  .ks-mode-line{display:flex;align-items:center;gap:6px;min-width:0}
  .ks-mode-actions{overflow-x:auto;flex:1;padding-bottom:1px}
  .ks-terrain-controls{display:flex;gap:5px;align-items:center;flex:0 0 auto}
  .ks-brush{display:flex;align-items:center;gap:4px}
  .ks-brush span{font-size:6px;color:#8ea49a;font-weight:850}
  .ks-brush select{
    height:36px;border:1px solid rgba(231,197,106,.22);border-radius:9px;background:#0d1719;color:#fff;font-size:7px;padding:0 7px
  }
  .ks-status{
    margin-top:7px;padding:7px 9px;border:1px solid rgba(255,255,255,.055);border-radius:10px;
    background:rgba(7,15,17,.72);font-size:6.5px;color:#8ea49a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis
  }
  .ks-tabs{display:none}
  .ks-mobile-sheet{display:none}
  .ks-compact-bar{display:none}
  .ks-compact-asset{min-width:0;flex:1;display:grid;grid-template-columns:38px minmax(0,1fr);align-items:center;gap:7px}
  .ks-compact-asset canvas{
    width:38px;height:38px;border-radius:10px;border:1px solid rgba(231,197,106,.35);
    background:#0b1416;image-rendering:pixelated
  }
  .ks-compact-copy{min-width:0}
  .ks-compact-copy small{display:block;color:#789085;font-size:6px;font-weight:900;letter-spacing:.08em}
  .ks-compact-copy strong{display:block;color:#fff1b8;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
  .ks-scale-hud{position:absolute;left:50%;bottom:max(76px,calc(env(safe-area-inset-bottom) + 70px));transform:translateX(-50%);display:none;align-items:center;gap:5px;padding:5px 6px;border:1px solid rgba(231,197,106,.58);border-radius:14px;background:rgba(5,14,16,.97);box-shadow:0 12px 34px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.05);pointer-events:auto;z-index:3}
  .ks-scale-hud.on{display:flex}.ks-scale-hud.gesture{border-color:#f4dd8d;box-shadow:0 0 0 2px rgba(231,197,106,.12),0 12px 34px rgba(0,0,0,.55)}
  .ks-scale-hud small{font-size:5.5px;line-height:1.15;font-weight:950;letter-spacing:.1em;color:#8fa89f;text-align:center}.ks-scale-hud small span{color:#e7c56a}
  .ks-scale-hud button{width:42px;height:40px;padding:0;border:1px solid rgba(231,197,106,.3);border-radius:11px;background:#102022;color:#fff0b2;font-size:21px;font-weight:850;line-height:1}
  .ks-scale-hud .ks-scale-reset{font-size:15px}.ks-scale-value{min-width:58px;text-align:center;color:#fff2bc;font-size:13px;font-weight:950;font-variant-numeric:tabular-nums}

  @media(max-width:760px){
    .ks-top{left:8px;right:8px;min-height:52px;padding:7px 8px;border-radius:16px}
    .ks-brand-mark{width:31px;height:31px;font-size:15px}
    .ks-title{font-size:10px}.ks-subtitle{font-size:5.5px;margin-top:4px}
    .ks-top [data-act="save"],.ks-top [data-act="play"]{min-width:52px;padding:0 8px}
    .ks-top [data-act="play"]{font-size:6.5px}.ks-top [data-act="save"]{font-size:6.5px}
    .ks-left,.ks-right{display:none}
    .ks-bottom{
      left:8px;right:8px;width:auto;transform:none;bottom:max(6px,env(safe-area-inset-bottom));
      max-height:min(39vh,332px);padding:7px;border-radius:17px
    }
    .ks-deck-head{min-height:45px;padding-bottom:7px}
    .ks-deck-emblem{width:34px;height:34px;flex-basis:34px;font-size:15px}
    .ks-deck-brand strong{font-size:8.5px}.ks-deck-brand small{font-size:5.5px}
    .ks-active-tool{min-width:0;max-width:46%;padding:6px 8px}
    .ks-active-tool-icon{display:none}.ks-active-tool-copy small{font-size:5.5px}.ks-active-tool-copy strong{font-size:7px}
    .ks-selection-badge{display:none}
    .ks-deck-body{grid-template-columns:1fr 1.2fr;gap:6px;padding-top:6px}
    .ks-edit-section{grid-column:1/3}
    .ks-mode-section{grid-column:1/3}
    .ks-deck-section{padding:6px;border-radius:12px}
    .ks-section-title{font-size:5.5px;margin-bottom:5px}
    .ks-deck button,.ks-mini,.ks-tabs button{min-height:38px;padding:0 8px;font-size:6.2px}
    .ks-ico{font-size:11px;margin-right:4px}
    .ks-edit-primary,.ks-history-actions,.ks-mode-actions{gap:4px}
    .ks-edit-primary{overflow-x:auto}
    .ks-mode-line{display:block}
    .ks-terrain-controls{margin-top:5px}
    .ks-brush{margin-left:auto}
    .ks-tabs{display:flex;gap:4px;margin-top:6px}
    .ks-tabs button{flex:1;min-height:32px}
    .ks-mobile-sheet{
      max-height:32vh;overflow:hidden;border-top:1px solid var(--ks-line-soft);margin-top:5px;
      border-radius:11px;background:rgba(4,11,13,.66)
    }
    #kelo-studio-live[data-sheet-open="1"] .ks-mobile-sheet{display:block}
    .ks-mobile-pane{display:none;height:24vh}.ks-mobile-pane.on{display:block}
    .ks-mobile-pane .ks-assets,.ks-mobile-pane .ks-explorer{height:100%}
    .ks-mobile-pane .ks-properties{height:100%}
    .ks-mobile-pane .ks-search{height:30px;margin:5px 7px}
    .ks-mobile-pane.assets-pane{height:27vh}
    .ks-mobile-pane.assets-pane .ks-assets{height:calc(100% - 40px)}
    .ks-status{font-size:5.8px;margin-top:5px;padding:5px 7px}
    .ks-bottom.ks-compact{max-height:none;overflow:visible;padding:6px 7px}
    .ks-bottom.ks-compact>.ks-deck,.ks-bottom.ks-compact>.ks-status,.ks-bottom.ks-compact>.ks-tabs,.ks-bottom.ks-compact>.ks-mobile-sheet{display:none}
    .ks-bottom.ks-compact>.ks-compact-bar{display:flex;align-items:center;gap:5px}
    .ks-bottom.ks-compact .ks-compact-bar button{min-height:40px;padding:0 8px;font-size:6.2px;white-space:nowrap}
    .ks-bottom.ks-compact .ks-compact-bar [data-mode="select"]{padding:0 7px}
  }

  @media(max-width:430px){
    .ks-top{gap:5px}
    .ks-brand-mark{display:none}
    .ks-title{font-size:9px}.ks-subtitle{letter-spacing:.15em}
    .ks-top [data-act="play"],.ks-top [data-act="save"]{min-width:48px;padding:0 6px}
    .ks-x{min-width:36px}
    .ks-bottom{max-height:min(40vh,318px)}
    .ks-active-tool{max-width:43%}
    .ks-deck-body{grid-template-columns:1fr 1fr}
    .ks-edit-primary button{min-width:62px}
    .ks-history-actions{overflow-x:auto}
    .ks-bottom.ks-compact>.ks-compact-bar{
      display:grid;grid-template-columns:minmax(70px,1.4fr) repeat(5,minmax(0,1fr));
      gap:3px;width:100%;min-width:0
    }
    .ks-compact-bar .ks-compact-asset{min-width:0}
    .ks-bottom.ks-compact .ks-compact-bar button{min-width:0;width:100%;padding:0 2px;font-size:5.6px}
  }
  `;
  document.head.appendChild(style);
  }

  if(!root)root=document.createElement('section');
  root.id='kelo-studio-live';
  if(root.dataset)delete root.dataset.keloWorldLoading;
  root.dataset.keloStudioUi='1';
  root.dataset.shellVersion=SHELL_VERSION;
  root.dataset.compact='full';
  root.dataset.sheetOpen='0';
  root.dataset.selectionCount='0';
  if(!canReuse) root.innerHTML=`
    <div class="ks-top">
      <div class="ks-brand">
        <div class="ks-brand-mark" aria-hidden="true">♛</div>
        <div class="ks-brand-copy">
          <div class="ks-title">KELO STUDIO</div>
          <div class="ks-subtitle">MODO CREADOR</div>
        </div>
      </div>
      <div class="ks-spacer"></div>
      <button data-act="play"><span class="ks-ico">▶</span>PLAY</button>
      <button class="primary" data-act="save"><span class="ks-ico">▣</span>SAVE</button>
      <button class="ks-x" data-act="close" aria-label="Cerrar Kelo Studio">×</button>
    </div>

    <aside class="ks-left">
      <div class="ks-panel-head">ASSETS · VISUAL</div>
      <input class="ks-search ks-asset-search" placeholder="Buscar asset…" autocomplete="off">
      <div class="ks-assets"><div class="ks-inner"></div></div>
    </aside>

    <aside class="ks-right">
      <div class="ks-right-body">
        <section class="ks-pane">
          <div class="ks-panel-head">EXPLORER</div>
          <div class="ks-explorer"><div class="ks-explorer-inner"></div></div>
        </section>
        <section class="ks-pane">
          <div class="ks-panel-head">PROPERTIES</div>
          <div class="ks-properties"></div>
        </section>
      </div>
    </aside>

    <div class="ks-scale-hud" aria-label="Escala del objeto seleccionado">
      <small>ESCALA<br><span>2 DEDOS</span></small>
      <button data-act="scale-down" aria-label="Reducir objeto">−</button>
      <strong class="ks-scale-value">100%</strong>
      <button data-act="scale-up" aria-label="Agrandar objeto">＋</button>
      <button class="ks-scale-reset" data-act="scale-reset" aria-label="Restablecer escala a 100%">↺</button>
    </div>

    <div class="ks-bottom">
      <div class="ks-compact-bar">
        <div class="ks-compact-asset">
          <canvas class="ks-active-asset-preview" width="38" height="38" aria-hidden="true"></canvas>
          <div class="ks-compact-copy"><small>ASSET ACTIVO</small><strong class="ks-active-asset-label">—</strong></div>
        </div>
        <button data-act="rotate" aria-label="Rotar">⟳</button>
        <button data-act="undo">UNDO</button>
        <button data-act="delete">BORRAR</button>
        <button data-mode="select">SELECT</button>
        <button class="primary" data-act="edit-assets">EDIT</button>
      </div>

      <div class="ks-deck">
        <div class="ks-deck-head">
          <div class="ks-deck-emblem" aria-hidden="true">◇</div>
          <div class="ks-deck-brand">
            <strong>KELO STUDIO</strong>
            <small>MODO CREADOR · EDITOR DE MUNDO</small>
          </div>
          <div class="ks-active-tool">
            <span class="ks-active-tool-icon" aria-hidden="true">⌖</span>
            <div class="ks-active-tool-copy">
              <small>Herramienta activa</small>
              <strong class="ks-active-tool-value">Selección</strong>
            </div>
            <span class="ks-selection-badge">0 seleccionados</span>
          </div>
        </div>

        <div class="ks-deck-body">
          <section class="ks-deck-section ks-edit-section">
            <div class="ks-section-title">EDICIÓN</div>
            <div class="ks-edit-primary">
              <button class="on" data-mode="select"><span class="ks-ico">↖</span>SELECT</button>
              <button data-act="edit-assets"><span class="ks-ico">✎</span>EDIT</button>
              <button data-act="delete"><span class="ks-ico">⌫</span>BORRAR</button>
              <div class="ks-productivity-edit-slot"></div>
            </div>
          </section>

          <section class="ks-deck-section ks-history-section">
            <div class="ks-section-title">HISTORIAL / TRANSFORMAR</div>
            <div class="ks-history-actions">
              <button data-act="undo"><span class="ks-ico">↶</span>UNDO</button>
              <button data-act="redo"><span class="ks-ico">↷</span>REDO</button>
              <button data-act="rotate"><span class="ks-ico">⟳</span>ROTAR</button>
              <button data-act="scale-down"><span class="ks-ico">−</span>ESCALA</button>
              <button data-act="scale-reset">100%</button>
              <button data-act="scale-up"><span class="ks-ico">＋</span>ESCALA</button>
              <button data-act="duplicate"><span class="ks-ico">⧉</span>DUPLICAR</button>
            </div>
          </section>

          <section class="ks-deck-section ks-map-section">
            <div class="ks-section-title">MAPA / HERRAMIENTAS</div>
            <div class="ks-productivity-map-slot"></div>
          </section>

          <section class="ks-deck-section ks-mode-section">
            <div class="ks-section-title">MODO / VISTA</div>
            <div class="ks-mode-line">
              <div class="ks-mode-actions">
                <button data-mode="move"><span class="ks-ico">✥</span>MOVE</button>
                <button data-mode="terrain"><span class="ks-ico">▦</span>GROUND</button>
                <button data-mode="path"><span class="ks-ico">⌁</span>ROAD</button>
                <button data-mode="collision"><span class="ks-ico">◇</span>COLLISION</button>
              </div>
              <div class="ks-productivity-view-slot"></div>
              <div class="ks-terrain-controls">
                <button data-act="erase">ERASE</button>
                <div class="ks-brush"><span>BRUSH</span><select data-act="brush-size"><option>1</option><option>2</option><option>3</option><option>5</option></select></div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div class="ks-status">Preparando Studio…</div>

      <div class="ks-tabs">
        <button class="on" data-tab="assets">ASSETS</button>
        <button data-tab="explorer">EXPLORER</button>
        <button data-tab="properties">PROPERTIES</button>
      </div>

      <div class="ks-mobile-sheet">
        <div class="ks-mobile-pane assets-pane on" data-pane="assets">
          <input class="ks-search ks-asset-search-mobile" placeholder="Buscar asset…">
          <div class="ks-assets"><div class="ks-inner ks-inner-mobile"></div></div>
        </div>
        <div class="ks-mobile-pane" data-pane="explorer">
          <div class="ks-explorer"><div class="ks-explorer-inner ks-explorer-inner-mobile"></div></div>
        </div>
        <div class="ks-mobile-pane" data-pane="properties">
          <div class="ks-properties ks-properties-mobile"></div>
        </div>
      </div>
    </div>
  `;
  if(!root.isConnected)host.appendChild(root);

  const bottom=root.querySelector('.ks-bottom');
  const desktopAssetViewport=root.querySelector('.ks-left .ks-assets');
  const desktopAssetInner=root.querySelector('.ks-left .ks-inner');
  const mobileAssetViewport=root.querySelector('[data-pane="assets"] .ks-assets');
  const mobileAssetInner=root.querySelector('.ks-inner-mobile');
  const desktopExplorer=root.querySelector('.ks-right .ks-explorer');
  const desktopExplorerInner=root.querySelector('.ks-right .ks-explorer-inner');
  const mobileExplorer=root.querySelector('[data-pane="explorer"] .ks-explorer');
  const mobileExplorerInner=root.querySelector('.ks-explorer-inner-mobile');
  const properties=root.querySelector('.ks-right .ks-properties');
  const mobileProperties=root.querySelector('.ks-properties-mobile');
  const status=root.querySelector('.ks-status');
  const eraseButton=root.querySelector('[data-act="erase"]');
  const compactCanvas=root.querySelector('.ks-active-asset-preview');
  const compactLabel=root.querySelector('.ks-active-asset-label');
  const activeToolValue=root.querySelector('.ks-active-tool-value');
  const selectionBadge=root.querySelector('.ks-selection-badge');
  const scaleHud=root.querySelector('.ks-scale-hud');
  const scaleValue=root.querySelector('.ks-scale-value');
  const searches=[root.querySelector('.ks-asset-search'),root.querySelector('.ks-asset-search-mobile')].filter(Boolean);

  let rows=assets.slice(),selectedAsset=null,mode='select',erase=false,entities=[],selection=[],brushSize=1;
  const assetRowHeight=68,treeRowHeight=46;

  const isMobile=()=>typeof view.matchMedia==='function'
    ?view.matchMedia('(max-width:760px)').matches
    :Number(view.innerWidth||0)<=760;
  const query=()=>String(searches.find(x=>x===document.activeElement)?.value??searches[0]?.value??'').trim().toLowerCase();
  const filteredAssets=()=>{
    const q=query();
    return q?rows.filter(x=>`${x.label||''} ${x.id||''} ${x.category||''}`.toLowerCase().includes(q)):rows;
  };

  function renderVirtual(viewport,inner,list,rowHeight,renderer){
    if(!viewport||!inner)return;
    const range=virtualRange({count:list.length,rowHeight,scrollTop:viewport.scrollTop,viewportHeight:viewport.clientHeight||220,overscan:4});
    inner.style.height=`${range.totalHeight}px`;
    inner.replaceChildren();
    for(let i=range.start;i<range.end;i++)inner.appendChild(renderer(list[i],i));
  }

  function assetRow(a,i){
    const b=document.createElement('button');
    b.className='ks-row'+(selectedAsset===a.id?' on':'');
    b.style.top=`${i*assetRowHeight+2}px`;
    b.dataset.asset=a.id;
    const canvas=document.createElement('canvas');
    canvas.width=54;canvas.height=54;canvas.setAttribute('aria-hidden','true');
    const copy=document.createElement('span');
    copy.className='ks-asset-copy';
    const title=document.createElement('span');
    title.textContent=a.label||a.id;
    const small=document.createElement('small');
    small.textContent=`${a.category||'general'} · ${Math.round(a.width||a.bounds?.w||32)}×${Math.round(a.height||a.bounds?.h||32)}`;
    copy.append(title,small);b.append(canvas,copy);
    Promise.resolve(renderAssetPreview?.(canvas,a)).catch(()=>{});
    return b;
  }

  function explorerRow(e,i){
    const b=document.createElement('button');
    b.className='ks-tree-row'+(selection.includes(e.id)?' on':'');
    b.style.top=`${i*treeRowHeight+2}px`;
    b.dataset.entity=e.id;
    const title=document.createElement('span');
    title.textContent=e.label||e.name||e.prefabId||e.id;
    const small=document.createElement('small');
    small.textContent=`${e.prefabId||'entity'} · ${e.id}`;
    b.append(title,small);
    return b;
  }

  function renderAssets(){
    const list=filteredAssets();
    renderVirtual(desktopAssetViewport,desktopAssetInner,list,assetRowHeight,assetRow);
    renderVirtual(mobileAssetViewport,mobileAssetInner,list,assetRowHeight,assetRow);
  }

  function renderExplorer(){
    renderVirtual(desktopExplorer,desktopExplorerInner,entities,treeRowHeight,explorerRow);
    renderVirtual(mobileExplorer,mobileExplorerInner,entities,treeRowHeight,explorerRow);
  }

  function renderPropsInto(hostEl){
    if(!hostEl)return;
    hostEl.replaceChildren();
    const selected=selection.map(id=>entities.find(e=>e.id===id)).filter(Boolean);
    if(!selected.length){
      const e=document.createElement('div');
      e.className='ks-empty';
      e.textContent='Selecciona un objeto para editarlo. En desktop también puedes arrastrar una caja para seleccionar varios.';
      hostEl.appendChild(e);
      return;
    }
    if(selected.length>1){
      const e=document.createElement('div');
      e.className='ks-empty';
      e.textContent=`${selected.length} objetos seleccionados. MOVE, ROTAR, ESCALA, DUPLICAR y BORRAR mantienen una sola acción de Undo por operación.`;
      hostEl.appendChild(e);
      const a=document.createElement('div');
      a.className='ks-prop-actions';
      for(const [act,text] of [['focus','ENFOCAR'],['rotate','↻ ROTAR'],['scale-down','− ESCALA'],['scale-reset','100%'],['scale-up','＋ ESCALA'],['duplicate','DUPLICAR'],['delete','BORRAR']]){
        const b=document.createElement('button');b.className='ks-mini';b.dataset.act=act;b.textContent=text;a.appendChild(b);
      }
      hostEl.appendChild(a);
      return;
    }
    const entity=selected[0],t=entity.transform||{};
    const meta=document.createElement('div');
    meta.className='ks-meta';
    meta.textContent=`${entity.prefabId||'Entity'}\n${entity.id}`;
    hostEl.appendChild(meta);
    for(const [name,label,value] of [['x','X',t.x],['y','Y',t.y],['rotation','ROTATION',t.rotation||0]]){
      const row=document.createElement('div');
      row.className='ks-field';
      const l=document.createElement('label');l.textContent=label;
      const input=document.createElement('input');input.type='number';input.value=Number(value)||0;input.dataset.prop=name;
      row.append(l,input);hostEl.appendChild(row);
    }
    const scaleRow=document.createElement('div');scaleRow.className='ks-field';const scaleLabel=document.createElement('label');scaleLabel.textContent='ESCALA %';const scaleInput=document.createElement('input');scaleInput.type='number';scaleInput.min='10';scaleInput.max='800';scaleInput.step='5';scaleInput.value=String(Math.round((Number(t.scale)||1)*100));scaleInput.dataset.prop='scalePercent';scaleRow.append(scaleLabel,scaleInput);hostEl.appendChild(scaleRow);
    const actions=document.createElement('div');
    actions.className='ks-prop-actions';
    for(const [act,text] of [['focus','ENFOCAR'],['rotate','↻ ROTAR'],['scale-down','− ESCALA'],['scale-reset','100%'],['scale-up','＋ ESCALA'],['duplicate','DUPLICAR'],['delete','BORRAR']]){
      const b=document.createElement('button');b.className='ks-mini';b.dataset.act=act;b.textContent=text;actions.appendChild(b);
    }
    hostEl.appendChild(actions);
  }

  const renderProperties=()=>{renderPropsInto(properties);renderPropsInto(mobileProperties);};
  const renderScene=()=>{renderExplorer();renderProperties();};

  function syncCompactAsset(){
    const asset=rows.find(x=>String(x.id)===String(selectedAsset));
    root.dataset.activeAsset=selectedAsset||'';
    compactLabel.textContent=asset?.label||asset?.id||selectedAsset||'—';
    if(compactCanvas){
      const ctx=compactCanvas.getContext('2d');
      ctx?.clearRect(0,0,compactCanvas.width,compactCanvas.height);
      if(asset)Promise.resolve(renderAssetPreview?.(compactCanvas,asset)).catch(()=>{});
    }
    syncContextActions();
  }

  function syncScaleHud({forcedScale=null,active=false}={}){const entity=selection.length===1?entities.find(e=>String(e.id)===String(selection[0])):null,scale=forcedScale==null?Math.max(.1,Math.min(8,Number(entity?.transform?.scale)||1)):Math.max(.1,Math.min(8,Number(forcedScale)||1)),show=!!entity&&isMobile()&&root.dataset.sheetOpen!=='1';if(scaleValue)scaleValue.textContent=`${Math.round(scale*100)}%`;scaleHud?.classList.toggle('on',show);scaleHud?.classList.toggle('gesture',show&&!!active);}

  function syncContextActions(){
    const hasSelection=selection.length>0;
    root.dataset.selectionCount=String(selection.length);
    if(selectionBadge)selectionBadge.textContent=`${selection.length} seleccionado${selection.length===1?'':'s'}`;
    root.querySelectorAll('[data-act="delete"],[data-act="duplicate"],[data-act="focus"]').forEach(button=>{
      if(button.matches('[data-act="delete"]')&&button.closest('.ks-compact-bar')&&selectedAsset){
        button.disabled=!hasSelection;
        return;
      }
      button.disabled=!hasSelection;
    });
    root.querySelectorAll('[data-act="rotate"]').forEach(button=>{button.disabled=!hasSelection&&!selectedAsset;});
    root.querySelectorAll('[data-act="scale-down"],[data-act="scale-reset"],[data-act="scale-up"]').forEach(button=>{button.disabled=!hasSelection;});
    syncScaleHud();
  }

  function setCompact(next){
    const compact=!!next&&!!selectedAsset&&isMobile();
    bottom?.classList.toggle('ks-compact',compact);
    root.dataset.compact=compact?'asset':'full';
    if(compact){root.dataset.sheetOpen='0';document.activeElement?.blur?.();}
    syncScaleHud();
    return compact;
  }

  function openAssets(){
    setCompact(false);
    root.dataset.sheetOpen='1';
    syncScaleHud();
    const tab=root.querySelector('[data-tab="assets"]');
    root.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('on',b===tab));
    root.querySelectorAll('[data-pane]').forEach(p=>p.classList.toggle('on',p.dataset.pane==='assets'));
    renderAssets();
    if(isMobile())setTimeout(()=>root.querySelector('.ks-asset-search-mobile')?.focus?.(),0);
  }

  const eraseAllowed=()=>mode==='terrain'||mode==='path';
  function syncErase(){
    const allowed=eraseAllowed();
    if(!allowed)erase=false;
    eraseButton.disabled=!allowed;
    eraseButton.classList.toggle('on',allowed&&erase);
  }

  function setToolLabel(next){
    const key=String(next||'select').toLowerCase();
    if(activeToolValue)activeToolValue.textContent=TOOL_LABELS[key]||key;
    root.dataset.activeTool=key;
  }

  function setMode(next){
    mode=next;
    root.dataset.sheetOpen='0';
    root.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mode===mode));
    setToolLabel(mode);
    syncErase();
    onMode?.(mode);
  }

  function setErase(next){
    erase=eraseAllowed()&&!!next;
    syncErase();
  }

  function syncToolFromStatus(text){
    const first=String(text||'').split('·')[0].trim().toLowerCase();
    if(first==='play')setToolLabel('play');
    else if(TOOL_LABELS[first])setToolLabel(first);
  }

  for(const search of searches)search.addEventListener('input',()=>{
    for(const other of searches)if(other!==search)other.value=search.value;
    desktopAssetViewport.scrollTop=0;
    mobileAssetViewport.scrollTop=0;
    renderAssets();
  },{signal});
  desktopAssetViewport.addEventListener('scroll',renderAssets,{passive:true,signal});
  mobileAssetViewport.addEventListener('scroll',renderAssets,{passive:true,signal});
  desktopExplorer.addEventListener('scroll',renderExplorer,{passive:true,signal});
  mobileExplorer.addEventListener('scroll',renderExplorer,{passive:true,signal});

  root.addEventListener('change',e=>{
    if(e.target.matches('[data-act="brush-size"]')){
      brushSize=Math.max(1,Number(e.target.value)||1);
      onBrushSize?.(brushSize);
      return;
    }
    if(e.target.matches('[data-prop]')){const prop=e.target.dataset.prop,value=Number(e.target.value)||0;if(prop==='scalePercent')onPropertyChange?.('scale',Math.max(10,Math.min(800,value))/100);else onPropertyChange?.(prop,value);}
  },{signal});

  root.addEventListener('click',e=>{
    const asset=e.target.closest('[data-asset]');
    if(asset){
      selectedAsset=asset.dataset.asset;
      setToolLabel('placement');
      setErase(false);
      onAsset?.(selectedAsset);
      syncCompactAsset();
      renderAssets();
      setCompact(true);
      return;
    }

    const entity=e.target.closest('[data-entity]');
    if(entity){
      onSelectEntity?.(entity.dataset.entity,{append:!!(e.shiftKey||e.metaKey||e.ctrlKey)});
      return;
    }

    const tab=e.target.closest('[data-tab]');
    if(tab){
      root.dataset.sheetOpen='1';
      syncScaleHud();
      root.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('on',b===tab));
      root.querySelectorAll('[data-pane]').forEach(p=>p.classList.toggle('on',p.dataset.pane===tab.dataset.tab));
      return;
    }

    const m=e.target.closest('[data-mode]');
    if(m){
      selectedAsset=null;
      syncCompactAsset();
      setCompact(false);
      setErase(false);
      setMode(m.dataset.mode);
      renderAssets();
      return;
    }

    const a=e.target.closest('[data-act]')?.dataset.act;
    if(a==='edit-assets'){openAssets();return;}
    if(a==='undo')onUndo?.();
    else if(a==='redo')onRedo?.();
    else if(a==='rotate')onRotate?.();
    else if(a==='duplicate')onDuplicate?.();
    else if(a==='scale-down')onScale?.('down');
    else if(a==='scale-reset')onScale?.('reset');
    else if(a==='scale-up')onScale?.('up');
    else if(a==='delete')onDelete?.();
    else if(a==='focus')onFocus?.();
    else if(a==='erase'){setErase(!erase);onErase?.(erase);}
    else if(a==='save')onSave?.();
    else if(a==='play')onPlay?.();
    else if(a==='close')onClose?.();
  },{signal});

  syncErase();
  syncCompactAsset();
  if(!canReuse){renderAssets();renderScene();}
  syncContextActions();

  return Object.freeze({
    root,
    version:SHELL_VERSION,
    setStatus(text){
      const value=String(text||'');
      status.textContent=value;
      syncToolFromStatus(value);
    },
    setHistory({canUndo,canRedo}={}){
      root.querySelectorAll('[data-act="undo"]').forEach(b=>b.disabled=!canUndo);
      root.querySelectorAll('[data-act="redo"]').forEach(b=>b.disabled=!canRedo);
    },
    setMode,
    setErase,
    setCompact,
    openAssets,
    setActiveTool:setToolLabel,
    setScaleGesture(scale,{active=false}={}){syncScaleHud({forcedScale:scale,active});},
    setSelectedAsset(id,{compact=false}={}){
      selectedAsset=id==null?null:String(id);
      syncCompactAsset();
      renderAssets();
      setCompact(compact);
    },
    setAssets(next){
      rows=Array.isArray(next)?next.slice():[];
      syncCompactAsset();
      renderAssets();
    },
    setScene({entities:nextEntities=[],selection:nextSelection=[]}={}){
      entities=Array.isArray(nextEntities)?nextEntities.slice():[];
      selection=Array.isArray(nextSelection)?nextSelection.map(String):[];
      renderScene();
      syncContextActions();
    },
    setBrushSize(next){
      brushSize=Math.max(1,Number(next)||1);
      const s=root.querySelector('[data-act="brush-size"]');
      if(s)s.value=String(brushSize);
    },
    get mode(){return mode;},
    get erase(){return erase;},
    get selectedAsset(){return selectedAsset;},
    get compact(){return root.dataset.compact==='asset';},
    destroy(){try{liveShellAbort?.abort();}catch{}root.remove();style?.remove?.();}
  });
}
