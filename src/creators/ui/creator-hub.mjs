/* KELO-INDEX
 * area: CREATORS / HUB UI
 * owner: Kelo Creator Hub
 * owns: creator project navigation shell only
 * does-not-own: global navigation, Studio implementation, project persistence, permissions or publish policy
 * lazy: imported only after explicit CREATORS action; active cards dispatch through workspace registry
 * mobile: World launch paints Studio chrome immediately; Hub stays parked until .ks-status exists without a loading flag and is restored if the editor never mounts
 */
import { bootKeloCreators } from '../creator-entry.mjs?v=world-bridge-20260915-22';

let active=null;

const CATALOG=Object.freeze([
  {category:'BUILD',items:[['world','World','active'],['map-forge','Map Forge','active'],['parcel','Parcel','active'],['dungeon','Dungeon','active'],['game-mode','Game Mode','active']]},
  {category:'GAMEPLAY',items:[['mount','Mount','active'],['ability','Ability','active'],['sprite-ability','Sprite Ability','active'],['npc','NPC','active'],['quest','Quest / Dialogue','active'],['item','Item','active'],['crafting','Crafting','active']]},
  {category:'VISUAL',items:[['avatar','Avatar','active'],['asset-sheet','Asset Sheet Studio','active'],['appearance','Appearance','active'],['animation','Animation','active'],['vfx','VFX','active'],['cinematic','Cinematic','active']]},
  {category:'CONTENT',items:[['content-studio','Content Studio','active'],['prefab','Prefab','active'],['environment','Environment','active'],['audio','Audio','active']]}
]);

const REPOSITORY_PROJECT_TYPES=Object.freeze({
  animation:'ANIMATION',vfx:'VFX',ability:'ABILITY','sprite-ability':'SPRITE_ABILITY',
  parcel:'PARCEL',dungeon:'DUNGEON','game-mode':'GAME_MODE',npc:'NPC',quest:'QUEST',
  item:'ITEM',crafting:'CRAFTING',cinematic:'CINEMATIC',prefab:'PREFAB',
  environment:'ENVIRONMENT',audio:'AUDIO'
});
const PROJECT_LABELS=Object.freeze({
  ANIMATION:'Animation',VFX:'VFX',ABILITY:'Ability',SPRITE_ABILITY:'Sprite Ability',
  PARCEL:'Parcel',DUNGEON:'Dungeon',GAME_MODE:'Game Mode',NPC:'NPC',
  QUEST:'Quest / Dialogue',ITEM:'Item',CRAFTING:'Crafting',CINEMATIC:'Cinematic',
  PREFAB:'Prefab',ENVIRONMENT:'Environment',AUDIO:'Audio'
});
const PROJECT_WORKSPACES=Object.freeze({
  SPRITE_ABILITY:'sprite-ability',PARCEL:'parcel',DUNGEON:'dungeon',
  GAME_MODE:'game-mode',NPC:'npc',QUEST:'quest',ITEM:'item',CRAFTING:'crafting',
  CINEMATIC:'cinematic',PREFAB:'prefab',ENVIRONMENT:'environment',AUDIO:'audio'
});

function css(){return `
[data-kelo-creators-ui]{box-sizing:border-box;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f5f3ea}
#kelo-creators-hub{position:fixed;inset:0;z-index:2147482100;background:radial-gradient(circle at 50% -10%,rgba(198,164,92,.16),transparent 34%),rgba(7,8,10,.96);display:grid;grid-template-rows:auto 1fr;overflow:hidden}
body.kelo-studio-active #kelo-creators-hub{display:none!important;pointer-events:none}
.kc-head{display:flex;align-items:center;gap:14px;padding:18px 22px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(10,11,14,.9)}
.kc-mark{width:34px;height:34px;border:1px solid rgba(215,183,111,.65);display:grid;place-items:center;transform:rotate(45deg);border-radius:8px}.kc-mark span{transform:rotate(-45deg);font-size:11px;font-weight:900;letter-spacing:.08em}
.kc-title{min-width:0}.kc-title strong{display:block;font-size:17px;letter-spacing:.08em}.kc-title small{display:block;color:#9d9d9d;margin-top:2px}.kc-close{margin-left:auto;border:1px solid rgba(255,255,255,.13);background:#14161b;color:#fff;border-radius:12px;padding:9px 12px;font-weight:800;cursor:pointer}
.kc-layout{display:grid;grid-template-columns:220px minmax(0,1fr);min-height:0}.kc-nav{padding:16px 12px;border-right:1px solid rgba(255,255,255,.08);overflow:auto}.kc-nav button{display:block;width:100%;text-align:left;border:0;background:transparent;color:#a7a7aa;border-radius:10px;padding:11px 12px;margin:2px 0;font-weight:750;cursor:pointer}.kc-nav button[aria-selected="true"]{color:#fff;background:rgba(255,255,255,.07)}.kc-nav button[hidden]{display:none}
.kc-main{overflow:auto;padding:24px clamp(16px,4vw,42px) 50px}.kc-main h1{font-size:clamp(26px,4vw,44px);margin:0 0 6px}.kc-lead{color:#a8a8ab;margin:0 0 28px}.kc-section{margin:28px 0}.kc-section h2{font-size:12px;letter-spacing:.18em;color:#cbb477;margin:0 0 12px}.kc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}.kc-card{min-height:118px;border:1px solid rgba(255,255,255,.09);background:linear-gradient(145deg,rgba(255,255,255,.065),rgba(255,255,255,.025));border-radius:16px;padding:16px;text-align:left;color:#fff;display:flex;flex-direction:column;justify-content:space-between;transition:transform .16s ease,border-color .16s ease,opacity .16s ease}.kc-card.active{cursor:pointer;border-color:rgba(214,179,99,.42)}.kc-card.active:active{transform:scale(.985)}.kc-card:disabled{opacity:.58}.kc-card[aria-busy="true"]{opacity:.88;cursor:progress;transform:none}.kc-card strong{font-size:17px}.kc-card small{color:#8f9095}.kc-pill{align-self:flex-start;font-size:10px;letter-spacing:.12em;border-radius:999px;padding:5px 8px;background:rgba(210,179,107,.12);color:#d5b976}.kc-empty{border:1px dashed rgba(255,255,255,.12);border-radius:16px;padding:28px;color:#9fa0a4}.kc-launch-error{margin:0 0 14px;border:1px solid rgba(255,133,104,.34);border-radius:12px;padding:11px 13px;background:rgba(126,45,31,.15);color:#ffd5c9;font-size:12px;font-weight:750}.kc-project{display:flex;align-items:center;gap:12px;border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:14px;margin:9px 0}.kc-project>div{min-width:0}.kc-project .kc-lead{margin:3px 0 0;font-size:11px}.kc-project button{margin-left:auto;border:1px solid rgba(214,179,99,.4);background:rgba(214,179,99,.1);color:#f7e2ad;border-radius:10px;padding:8px 11px;font-weight:800;cursor:pointer}
@media(max-width:700px){#kelo-creators-hub{grid-template-rows:auto auto minmax(0,1fr)}.kc-head{padding:12px 14px}.kc-layout{display:contents}.kc-nav{display:flex;gap:5px;overflow-x:auto;border-right:0;border-bottom:1px solid rgba(255,255,255,.08);padding:8px 10px}.kc-nav button{width:auto;white-space:nowrap;padding:9px 10px}.kc-main{padding:18px 14px 34px}.kc-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.kc-card{min-height:106px;padding:13px}.kc-title small{display:none}}
@media(max-width:380px){.kc-grid{grid-template-columns:1fr}}
`;}

function make(tag,props={},children=[]){
  const el=document.createElement(tag);
  for(const [k,v] of Object.entries(props)){
    if(k==='class')el.className=v;
    else if(k==='text')el.textContent=v;
    else if(k.startsWith('aria-'))el.setAttribute(k,v);
    else el[k]=v;
  }
  for(const child of [].concat(children||[]))if(child)el.append(child);
  return el;
}

export async function openCreatorHub({root=globalThis}={}){
  if(active)return active;
  if(!root.document)throw new Error('CREATOR_HUB_DOM_REQUIRED');

  const platform=await bootKeloCreators({root}),doc=root.document;
  const style=make('style',{'data-kelo-creators-ui':'',textContent:css()});
  style.setAttribute('data-kelo-creators-ui','');
  doc.head.append(style);

  const hub=make('section',{id:'kelo-creators-hub'});
  hub.setAttribute('data-kelo-creators-ui','');
  hub.setAttribute('role','dialog');
  hub.setAttribute('aria-modal','true');
  hub.setAttribute('aria-label','Kelo Creators');

  const mark=make('div',{class:'kc-mark'},make('span',{text:'KC'}));
  const title=make('div',{class:'kc-title'},[
    make('strong',{text:'KELO CREATORS'}),
    make('small',{text:'One studio. Many workspaces.'})
  ]);
  const close=make('button',{class:'kc-close',text:'CLOSE','aria-label':'Cerrar Kelo Creators'});
  const head=make('header',{class:'kc-head'},[mark,title,close]);
  const nav=make('nav',{class:'kc-nav','aria-label':'Creator sections'});
  const main=make('main',{class:'kc-main'});
  const layout=make('div',{class:'kc-layout'},[nav,main]);
  hub.append(head,layout);
  doc.body.append(hub);

  const sections=[['create','CREATE'],['projects','MY PROJECTS'],['assets','MY ASSETS'],['shared','SHARED WITH ME'],['invites','TEST INVITES'],['reviews','REVIEWS'],['published','PUBLISHED']];
  const buttons=new Map(),opening=new Set();
  let current='create';

  const nextPaint=()=>new Promise(resolve=>{
    const wait=typeof root.setTimeout==='function'?root.setTimeout.bind(root):setTimeout;
    wait(resolve,0);
  });

  async function requireSpriteAbilityMount(session){
    for(let attempt=0;attempt<4;attempt++){
      const candidate=session?.root?.isConnected?session.root:doc.getElementById('kelo-studio-workspace');
      const titleText=String(candidate?.querySelector?.('.ksw-title')?.textContent||'').toUpperCase();
      if(candidate?.isConnected&&titleText.includes('SPRITE ABILITY'))return candidate;
      await nextPaint();
    }
    throw new Error('SPRITE_ABILITY_WORKSPACE_MOUNT_FAILED');
  }

  function setOpeningUi(id,busy){
    for(const control of hub.querySelectorAll('[data-workspace]')){
      const isTarget=control.dataset.workspace===id;
      if(isTarget){
        control.setAttribute('aria-busy',String(busy));
        const pill=control.querySelector('.kc-pill');
        const detail=control.querySelector('small');
        if(busy){
          if(!control.dataset.keloIdlePill){
            control.dataset.keloIdlePill=pill?.textContent||'';
            control.dataset.keloIdleDetail=detail?.textContent||'';
          }
          if(pill)pill.textContent='ABRIENDO';
          if(detail)detail.textContent=id==='world'?'Cargando el editor…':'Cargando herramientas…';
        }else{
          if(pill&&control.dataset.keloIdlePill)pill.textContent=control.dataset.keloIdlePill;
          if(detail&&control.dataset.keloIdleDetail)detail.textContent=control.dataset.keloIdleDetail;
        }
      }
      if(opening.size)control.setAttribute('aria-disabled','true');
      else control.removeAttribute('aria-disabled');
    }
  }

  function friendlyLaunchError(id,error){
    const code=String(error?.message||error||'');
    if(id==='world'||/WORLD_EDITOR|CREATOR_WORLD_STUDIO/.test(code))return 'World Editor no abrió. Toca World de nuevo para reintentar.';
    if(typeof root.showToast==='function'||!code)return error?.message||`No se pudo abrir ${id}`;
    return code;
  }

  function showLaunchError(id,error){
    console.error(`[Kelo Creators → ${id}]`,error);
    const message=friendlyLaunchError(id,error);
    if(typeof root.showToast==='function'){
      root.showToast(message);
      return;
    }
    main.querySelector('.kc-launch-error')?.remove();
    const label=id==='sprite-ability'?'Sprite Ability':id==='world'?'World Editor':id;
    main.prepend(make('div',{class:'kc-launch-error',text:`${label} no terminó de abrir. El Hub sigue activo; toca de nuevo para reintentar.`}));
  }

  function parkHub(){
    hub.dataset.keloWorldLaunch='1';
    hub.style.zIndex='1';
    hub.style.pointerEvents='none';
    hub.style.backdropFilter='none';
    hub.style.webkitBackdropFilter='none';
  }

  function restoreHub(){
    delete hub.dataset.keloWorldLaunch;
    hub.style.zIndex='';
    hub.style.pointerEvents='';
    hub.style.backdropFilter='';
    hub.style.webkitBackdropFilter='';
  }

  async function openWorkspace(id,{projectId=null}={}){
    if(opening.size)return;
    opening.add(id);
    setOpeningUi(id,true);
    if(id!=='world'){
      await nextPaint();
      await nextPaint();
    }
    try{
      // Sprite Ability owns project bootstrap. Keep the Hub alive until its real Studio shell
      // is confirmed in the DOM; a rejected/partial launch must never strand mobile users.
      if(id==='sprite-ability'&&!projectId){
        const session=await platform.openWorkspace(id,{});
        await requireSpriteAbilityMount(session);
        destroy();
        return session;
      }

      let resolvedProjectId=projectId;
      const projectType=REPOSITORY_PROJECT_TYPES[id]||null;
      if(projectType&&!resolvedProjectId){
        const ownerId=platform.permission.actorId();
        const existing=await platform.projects.list({ownerId,type:projectType});
        const label=PROJECT_LABELS[projectType]||projectType;
        const project=await platform.projects.create({type:projectType,name:`${label} ${existing.length+1}`,ownerId});
        resolvedProjectId=project.projectId;
      }
      if(id==='world'){
        parkHub();
        const paint=platform.workspaces.resolve('world')?.paintLaunch;
        if(typeof paint==='function')paint(root);
        if(!doc.getElementById('kelo-studio-live'))throw new Error('WORLD_EDITOR_MOUNT_FAILED');
        hub.style.display='none';
        const pending=platform.openWorkspace(id,resolvedProjectId?{projectId:resolvedProjectId}:{});
        const abortWorldLaunch=()=>{
          const live=doc.getElementById('kelo-studio-live');
          const ready=live?.isConnected&&live.dataset?.keloWorldLoading!=='1'&&live.querySelector?.('.ks-status');
          if(!ready){
            try{live?.remove();}catch{}
            try{doc.getElementById('kelo-world-launch-curtain')?.remove();}catch{}
            try{doc.querySelector('canvas.kelo-studio-overlay')?.remove();}catch{}
            try{doc.body.classList.remove('kelo-studio-active');}catch{}
          }
          restoreHub();
          hub.style.display='';
        };
        pending.then(()=>{
          const live=doc.getElementById('kelo-studio-live');
          const ready=live?.isConnected&&live.dataset?.keloWorldLoading!=='1'&&live.querySelector?.('.ks-status');
          if(ready){
            setTimeout(()=>{try{destroy();}catch{}},250);
            return;
          }
          abortWorldLaunch();
          showLaunchError(id,new Error('WORLD_EDITOR_OPEN_TIMEOUT'));
        }).catch(error=>{
          abortWorldLaunch();
          showLaunchError(id,error);
        });
        return null;
      }
      const session=await platform.openWorkspace(id,resolvedProjectId?{projectId:resolvedProjectId}:{});
      destroy();
      return session;
    }catch(error){
      if(id==='world'&&doc.getElementById('kelo-studio-live')?.querySelector?.('.ks-status')&&doc.getElementById('kelo-studio-live')?.dataset?.keloWorldLoading!=='1'){
        destroy();
        return null;
      }
      restoreHub();
      hub.style.display='';
      showLaunchError(id,error);
      return null;
    }finally{
      opening.delete(id);
      if(hub.isConnected)setOpeningUi(id,false);
    }
  }

  async function renderCreate(){
    main.replaceChildren(
      make('h1',{text:'Create'}),
      make('p',{class:'kc-lead',text:'Choose a workspace. Every active Creator reuses shared Kelo Studio infrastructure and its runtime owner.'})
    );
    for(const group of CATALOG){
      const sec=make('section',{class:'kc-section'},[make('h2',{text:group.category})]);
      const grid=make('div',{class:'kc-grid'});
      for(const [wid,label,state] of group.items){
        const manifest=platform.workspaces.resolve(wid);
        const implemented=state==='active'&&manifest?.availability==='active';
        const permitted=implemented&&(!manifest.capability||platform.permission.can(manifest.capability,platform.permission.actorId()));
        const status=implemented?(permitted?'ACTIVE':'NO ACCESS'):'COMING SOON';
        let detail='Shared Studio core · private/local draft';
        if(wid==='avatar')detail='Subir → preview → usar';
        if(wid==='content-studio')detail='Spreadsheet · phone · Supabase · instant runtime';
        if(wid==='asset-sheet')detail='Detect · classify · gallery · OPEN IN WORLD';
        if(wid==='sprite-ability')detail='SUBIR → VER → PROBAR → AJUSTAR → GUARDAR';
        const card=make('button',{
          class:`kc-card ${permitted?'active':''}`,
          disabled:!permitted,
          'aria-label':permitted?`Abrir ${label}`:`${label} ${status.toLowerCase()}`
        },[
          make('span',{class:'kc-pill',text:status}),
          make('strong',{text:label}),
          make('small',{text:implemented?(permitted?detail:'Your key does not grant this workspace'):'Workspace not implemented yet'})
        ]);
        card.dataset.workspace=wid;
        if(permitted){
          if(wid==='world'){
            card.addEventListener('pointerup',event=>{
              if(event.button!=null&&event.button!==0)return;
              event.preventDefault();
              event.stopPropagation();
              void openWorkspace(wid);
            });
          }else card.onclick=()=>void openWorkspace(wid);
        }
        grid.append(card);
      }
      sec.append(grid);
      main.append(sec);
    }
  }

  async function renderProjects(){
    main.replaceChildren(
      make('h1',{text:'My Projects'}),
      make('p',{class:'kc-lead',text:'Projects available through the repository boundary.'})
    );
    const rows=await platform.projects.list({ownerId:platform.permission.actorId()});
    if(!rows.length)return main.append(make('div',{class:'kc-empty',text:'No projects yet.'}));
    for(const p of rows){
      const row=make('div',{class:'kc-project'},[
        make('div',{},[
          make('strong',{text:p.name}),
          make('div',{class:'kc-lead',text:`${p.type} · ${p.status}`})
        ])
      ]);
      const workspace=PROJECT_WORKSPACES[p.type]||String(p.type||'').toLowerCase();
      const manifest=platform.workspaces.resolve(workspace);
      const permitted=!!manifest&&(!manifest.capability||platform.permission.can(manifest.capability,platform.permission.actorId(),p.projectId));
      if(permitted){
        const b=make('button',{text:'OPEN'});
        b.dataset.workspace=workspace;
        b.onclick=()=>void openWorkspace(workspace,{projectId:p.projectId});
        row.append(b);
      }
      main.append(row);
    }
  }

  async function renderAssets(){
    main.replaceChildren(
      make('h1',{text:'My Assets'}),
      make('p',{class:'kc-lead',text:'Treat raw sprite sheets locally, test galleries in World, then use the existing online content pipeline for durable publication.'})
    );
    const sheetCard=make('button',{class:'kc-card active','aria-label':'Abrir Asset Sheet Studio'},[
      make('span',{class:'kc-pill',text:'LOCAL + BRIDGE'}),
      make('strong',{text:'ASSET SHEET STUDIO'}),
      make('small',{text:'Raw image → detect → classify → gallery → World'})
    ]);
    sheetCard.dataset.workspace='asset-sheet';
    sheetCard.onclick=()=>void openWorkspace('asset-sheet');
    const contentCard=make('button',{class:'kc-card active','aria-label':'Abrir Content Studio'},[
      make('span',{class:'kc-pill',text:'ONLINE'}),
      make('strong',{text:'CONTENT STUDIO'}),
      make('small',{text:'CSV/XLSX + images → Supabase → runtime'})
    ]);
    contentCard.dataset.workspace='content-studio';
    contentCard.onclick=()=>void openWorkspace('content-studio');
    main.append(make('div',{class:'kc-grid'},[sheetCard,contentCard]));
  }

  function renderEmpty(label,detail){
    main.replaceChildren(
      make('h1',{text:label}),
      make('p',{class:'kc-lead',text:detail}),
      make('div',{class:'kc-empty',text:'Nothing here yet. This surface is ready for its future repository/service adapter.'})
    );
  }

  async function render(id){
    current=id;
    for(const [key,b] of buttons)b.setAttribute('aria-selected',String(key===id));
    if(id==='create')return renderCreate();
    if(id==='projects')return renderProjects();
    if(id==='assets')return renderAssets();
    if(id==='shared')return renderEmpty('Shared With Me','Shared projects will plug into the project repository later.');
    if(id==='invites')return renderEmpty('Test Invites','Private test invitations will arrive through a future invite service.');
    if(id==='reviews')return renderEmpty('Reviews','Approval remains capability-gated and authority-owned.');
    if(id==='published')return renderEmpty('Published','Only immutable approved revisions will appear here.');
  }

  for(const [id,label] of sections){
    const b=make('button',{text:label,'aria-selected':'false'});
    if(id==='reviews'&&!platform.permission.can('review.approve'))b.hidden=true;
    b.onclick=()=>void render(id);
    buttons.set(id,b);
    nav.append(b);
  }

  function destroy(){
    if(active?.hub!==hub)return;
    active=null;
    hub.remove();
    style.remove();
    doc.removeEventListener('keydown',onKey,true);
  }

  const onKey=e=>{
    if(e.key==='Escape'){
      e.preventDefault();
      destroy();
    }
  };
  close.onclick=destroy;
  doc.addEventListener('keydown',onKey,true);

  active=Object.freeze({
    version:'kelo-creator-hub-v1.19.0-world-bridge',
    hub,platform,
    get section(){return current;},
    show:render,
    close:destroy
  });
  await render('create');
  return active;
}

export function closeCreatorHub(){active?.close?.();}
export function getCreatorHub(){return active;}