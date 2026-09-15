/* KELO-INDEX
 * area: PROPERTY
 * keys: PARCEL ACL RIGHTS BLOCK PUBLIC ENTER BUILD ONLINE
 * hace: permisos de acceso/edición por parcela; UI local; request() respeta el ACL
 * online: mismo shape (owner, rights[], blocked[], public) para el adapter remoto
 */
(function(){
  'use strict';
  if(window.KELO_PARCEL_ACL)return;
  const STORE='kelo-parcel-acl-v1';
  const LEVELS=Object.freeze({OWNER:'owner',RIGHTS:'rights',VISITOR:'visitor',BLOCKED:'blocked'});
  let db={};
  try{db=JSON.parse(localStorage.getItem(STORE)||'{}')||{};}catch(e){db={};}
  function save(){try{localStorage.setItem(STORE,JSON.stringify(db));}catch(e){}}
  function toast(m){if(typeof showToast==='function')showToast(m);}
  function me(){return String(window.keloNet?.playerKey||window.KELO_ADMIN_KEYS?.playerId?.()||window.localPlayer?.id||'local_pioneer');}
  function pid(){return window.KELO_BUILDER_UX?.parcelId||null;}
  function row(id){
    const k=id||pid();if(!k)return null;
    if(!db[k])db[k]={parcelId:k,ownerId:me(),rights:[],blocked:[],public:true,guestsCanBuild:false};
    if(!db[k].ownerId)db[k].ownerId=me();
    return db[k];
  }
  function level(id,actor){
    const r=row(id);if(!r)return LEVELS.VISITOR;
    const a=String(actor||me());
    if(r.blocked.includes(a))return LEVELS.BLOCKED;
    if(a===r.ownerId)return LEVELS.OWNER;
    if(r.rights.includes(a))return LEVELS.RIGHTS;
    return LEVELS.VISITOR;
  }
  function canEnter(id,actor){
    const lv=level(id,actor);
    if(lv===LEVELS.BLOCKED)return false;
    if(lv===LEVELS.OWNER||lv===LEVELS.RIGHTS)return true;
    return !!row(id)?.public;
  }
  function canBuild(id,actor){
    const lv=level(id,actor);
    if(lv===LEVELS.OWNER||lv===LEVELS.RIGHTS)return true;
    return !!(row(id)?.guestsCanBuild&&lv===LEVELS.VISITOR&&canEnter(id,actor));
  }
  function addRights(playerId){
    const r=row();if(!r)return toast('Sin parcela');
    if(me()!==r.ownerId)return toast('Solo el dueño da rights');
    const a=String(playerId||'').trim();if(!a)return;
    r.blocked=r.blocked.filter(x=>x!==a);
    if(!r.rights.includes(a)&&a!==r.ownerId)r.rights.push(a);
    save();render();toast('Rights: '+a);
  }
  function removeRights(playerId){
    const r=row();if(!r||me()!==r.ownerId)return;
    r.rights=r.rights.filter(x=>x!==String(playerId));save();render();
  }
  function block(playerId){
    const r=row();if(!r||me()!==r.ownerId)return;
    const a=String(playerId||'').trim();if(!a||a===r.ownerId)return;
    r.rights=r.rights.filter(x=>x!==a);
    if(!r.blocked.includes(a))r.blocked.push(a);save();render();toast('Bloqueado: '+a);
  }
  function unblock(playerId){
    const r=row();if(!r||me()!==r.ownerId)return;
    r.blocked=r.blocked.filter(x=>x!==String(playerId));save();render();
  }
  function setPublic(on){const r=row();if(!r||me()!==r.ownerId)return;r.public=!!on;save();render();}
  function setGuestsBuild(on){const r=row();if(!r||me()!==r.ownerId)return;r.guestsCanBuild=!!on;save();render();}

  function inject(){
    const host=document.getElementById('kelo-world-builder');
    if(!host||document.getElementById('kelo-parcel-acl'))return;
    const box=document.createElement('div');box.id='kelo-parcel-acl';
    box.innerHTML='<div class="acl-row"><label><input type="checkbox" id="kelo-acl-public"> PÚBLICA</label><label><input type="checkbox" id="kelo-acl-build"> VISITAS CONSTRUYEN</label></div><div class="acl-row"><input id="kelo-acl-id" placeholder="playerId"><button id="kelo-acl-add">RIGHTS</button><button id="kelo-acl-ban">BLOQUEAR</button></div><div id="kelo-acl-list" class="acl-list"></div>';
    host.appendChild(box);
    document.getElementById('kelo-acl-public').onchange=e=>setPublic(e.target.checked);
    document.getElementById('kelo-acl-build').onchange=e=>setGuestsBuild(e.target.checked);
    document.getElementById('kelo-acl-add').onclick=()=>addRights(document.getElementById('kelo-acl-id').value);
    document.getElementById('kelo-acl-ban').onclick=()=>block(document.getElementById('kelo-acl-id').value);
    if(!document.getElementById('kelo-parcel-acl-css')){
      const s=document.createElement('style');s.id='kelo-parcel-acl-css';
      s.textContent='#kelo-parcel-acl{padding:6px 10px;border-top:1px solid rgba(255,255,255,.06);font-size:9px;color:#9db0a9}#kelo-parcel-acl .acl-row{display:flex;gap:6px;align-items:center;margin-bottom:6px}#kelo-parcel-acl input[type=text],#kelo-acl-id{flex:1;min-width:0;background:#0f191c;color:#e7ece9;border:1px solid rgba(231,197,106,.25);border-radius:8px;padding:7px}#kelo-parcel-acl button{background:#111e20;color:#e9d38d;border:1px solid rgba(231,197,106,.25);border-radius:8px;padding:7px;font-weight:900;font-size:8px}.acl-list{display:grid;gap:3px;max-height:72px;overflow:auto}.acl-chip{display:flex;gap:6px;align-items:center}.acl-chip b{flex:1;color:#e7ece9}';
      document.head.appendChild(s);
    }
    render();
  }
  function render(){
    const r=row();const list=document.getElementById('kelo-acl-list');
    const pub=document.getElementById('kelo-acl-public');
    const gb=document.getElementById('kelo-acl-build');
    if(!r||!list)return;
    if(pub)pub.checked=!!r.public;
    if(gb)gb.checked=!!r.guestsCanBuild;
    list.innerHTML='';
    const add=(id,tag,fn)=>{
      const d=document.createElement('div');d.className='acl-chip';
      d.innerHTML='<b>'+id+'</b><span>'+tag+'</span>';
      const b=document.createElement('button');b.textContent='x';b.onclick=fn;d.appendChild(b);list.appendChild(d);
    };
    add(r.ownerId,'DUEÑO',()=>{});
    r.rights.forEach(id=>add(id,'RIGHTS',()=>removeRights(id)));
    r.blocked.forEach(id=>add(id,'BAN',()=>unblock(id)));
  }

  function wrapEdit(){
    const E=window.KELO_WORLD_EDIT;if(!E?.request||E.__acl)return;
    const raw=E.request.bind(E);
    async function request(op,payload){
      const data=payload||{};
      const id=pid();
      if(id&&window.KELO_BUILDER_UX?.scope==='parcel'&&/^world:placement:/.test(op)&&!canBuild(id,me()))throw new Error('SIN_PERMISO_DE_CONSTRUIR');
      return raw(op,data);
    }
    window.KELO_WORLD_EDIT=Object.assign({},E,{request,__acl:true});
  }
  function wrapProp(){
    const S=window.KELO_PROPERTY_SYSTEM;if(!S?.request||S.__acl)return;
    const raw=S.request.bind(S);
    async function request(op,payload){
      const data=payload||{};
      const id=data.parcelId||pid();
      if(id&&['place','move','rotate','remove'].includes(op)&&window.KELO_BUILDER_UX?.scope==='parcel'&&!canBuild(id,me()))throw new Error('SIN_PERMISO_DE_CONSTRUIR');
      return raw(op,data);
    }
    window.KELO_PROPERTY_SYSTEM=Object.assign({},S,{request,__acl:true});
  }

  document.addEventListener('click',e=>{
    if(e.target&&e.target.id==='kelo-scope-parcel'){
      const id=pid();
      setTimeout(()=>{
        if(id&&!canEnter(id,me())){toast('NO_PUEDES_ENTRAR');window.KELO_BUILDER_UX?.setScope?.('world');}
      },60);
    }
  },true);

  const iv=setInterval(()=>{inject();render();wrapEdit();wrapProp();},280);
  setTimeout(()=>clearInterval(iv),25000);
  window.KELO_PARCEL_ACL=Object.freeze({
    version:'parcel-acl-v1.0.0',LEVELS,level,canEnter,canBuild,addRights,removeRights,block,unblock,setPublic,setGuestsBuild,
    get snapshot(){return row()?JSON.parse(JSON.stringify(row())):null;}
  });
})();
