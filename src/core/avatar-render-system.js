/* KELO-INDEX
 * area: CORE / AVATAR
 * owner: KeloAvatar
 * keys: AVATAR RENDER BASE MIDDLEWARE FALLBACK FOUNDATION HERO BASE ZOO 8-DIRECTION FACING
 * purpose: owner único de la composición renderAvatar y del sprite principal visual del jugador
 * public-api: KeloAvatar.setBase/use/unregister/snapshot
 * consumes: renderAvatar vigente de engine-c como fallback + assets/base-zoo/Idle/rotations/*.png + _face/_visualMotion/velocity
 * state-owned: renderer base actual + middleware ordenado + estado de carga del sprite principal
 * extension-points: setBase para reemplazos históricos; use para fallbacks/overrides condicionales
 * reuse: renderer hero, apariencias y futuras capas de composición de actor
 * legacy: engine-c mantiene el renderer físico como fallback si el sprite principal no carga
 * do-not: NO envolver renderAvatar fuera de este archivo; NO decidir gameplay
 */
(function(root){
  'use strict';
  if(root.KeloAvatar)return;
  const VERSION='kelo-avatar-render-v1.2.0-base-zoo';
  if(typeof renderAvatar!=='function'){
    root.KELO_AVATAR_RENDER_AUDIT=Object.freeze({version:VERSION,installed:false,reason:'renderAvatar-missing'});
    return;
  }

  let baseRenderer=renderAvatar;
  let baseOwner='engine-c:legacy-base';
  let baseRevision=0;
  let sequence=1;
  const middleware=[];

  // KELO-INDEX AVATAR/HERO Base Zoo oficial: 8 PNG Idle independientes, 152x152, una vista por dirección.
  const HERO_ROOT='assets/base-zoo/Idle/rotations/';
  const HERO_DIRECTION_SOURCES=Object.freeze({
    down:HERO_ROOT+'south.png?v=20260912-base-zoo-v1',
    'down-right':HERO_ROOT+'south-east.png?v=20260912-base-zoo-v1',
    right:HERO_ROOT+'east.png?v=20260912-base-zoo-v1',
    'up-right':HERO_ROOT+'north-east.png?v=20260912-base-zoo-v1',
    up:HERO_ROOT+'north.png?v=20260912-base-zoo-v1',
    'up-left':HERO_ROOT+'north-west.png?v=20260912-base-zoo-v1',
    left:HERO_ROOT+'west.png?v=20260912-base-zoo-v1',
    'down-left':HERO_ROOT+'south-west.png?v=20260912-base-zoo-v1'
  });
  const HERO_FACES=Object.freeze(['down','down-right','right','up-right','up','up-left','left','down-left']);
  const heroSpriteState={
    version:'main-hero-base-zoo-v1',
    source:HERO_ROOT,
    state:'Idle',
    directionMode:8,
    frameWidth:152,
    frameHeight:152,
    ready:false,
    complete:false,
    readyCount:0,
    failedCount:0,
    error:null,
    drawCount:0,
    lastFace:'down',
    lastFrame:0,
    middlewareId:null
  };
  const HeroImage=root.Image || (typeof Image==='function'?Image:null);
  const heroImages=Object.create(null);
  const heroLoaded=Object.create(null);
  const heroFailed=Object.create(null);

  function updateHeroLoadState(){
    heroSpriteState.readyCount=HERO_FACES.reduce(function(total,face){return total+(heroLoaded[face]?1:0);},0);
    heroSpriteState.failedCount=HERO_FACES.reduce(function(total,face){return total+(heroFailed[face]?1:0);},0);
    heroSpriteState.ready=heroSpriteState.readyCount>0;
    heroSpriteState.complete=heroSpriteState.readyCount===HERO_FACES.length;
    heroSpriteState.error=heroSpriteState.failedCount?(heroSpriteState.complete?null:'partial-load-failed'):null;
  }

  if(HeroImage){
    HERO_FACES.forEach(function(face){
      const image=new HeroImage();
      heroImages[face]=image;
      image.decoding='async';
      image.onload=function(){
        if(image.naturalWidth>0&&image.naturalHeight>0){
          heroLoaded[face]=true;
          delete heroFailed[face];
        }else{
          heroFailed[face]=true;
          delete heroLoaded[face];
        }
        updateHeroLoadState();
      };
      image.onerror=function(){
        heroFailed[face]=true;
        delete heroLoaded[face];
        updateHeroLoadState();
        if(root.console&&typeof root.console.warn==='function')root.console.warn('[KeloAvatar] Base Zoo direction failed to load:',face);
      };
      image.src=HERO_DIRECTION_SOURCES[face];
    });
  }else{
    heroSpriteState.error='image-constructor-unavailable';
  }
  root.KELO_MAIN_HERO_SPRITE_AUDIT=heroSpriteState;

  function normalizeOwner(owner){return String(owner||'anonymous');}

  function setBase(owner,fn){
    if(typeof fn!=='function')throw new TypeError('avatar base renderer must be a function');
    baseRenderer=fn;
    baseOwner=normalizeOwner(owner);
    baseRevision+=1;
    return baseRevision;
  }

  function use(owner,fn,priority){
    if(typeof fn!=='function')throw new TypeError('avatar middleware must be a function');
    const entry={id:'avatar-mw-'+sequence++,owner:normalizeOwner(owner),fn:fn,priority:Number(priority)||0};
    middleware.push(entry);
    // Mayor prioridad = capa más externa, reproduciendo el orden histórico de wrappers tardíos.
    middleware.sort(function(a,b){return b.priority-a.priority||a.id.localeCompare(b.id);});
    return entry.id;
  }

  function unregister(id){
    const i=middleware.findIndex(function(entry){return entry.id===id;});
    if(i<0)return false;
    middleware.splice(i,1);
    return true;
  }

  function normalizeFace(value){
    const face=String(value||'').trim().toLowerCase().replace(/_/g,'-');
    const aliases={
      south:'down',southeast:'down-right','south-east':'down-right',
      east:'right',northeast:'up-right','north-east':'up-right',
      north:'up',northwest:'up-left','north-west':'up-left',
      west:'left',southwest:'down-left','south-west':'down-left'
    };
    const normalized=aliases[face]||face;
    return HERO_FACES.indexOf(normalized)>=0?normalized:'';
  }

  function vectorToFace(x,y){
    const vx=Number(x)||0;
    const vy=Number(y)||0;
    if(Math.hypot(vx,vy)<=0.01)return '';
    const octant=Math.round(Math.atan2(vy,vx)/(Math.PI/4));
    const byOctant={
      '-4':'left','-3':'up-left','-2':'up','-1':'up-right',
      '0':'right','1':'down-right','2':'down','3':'down-left','4':'left'
    };
    return byOctant[String(octant)]||'';
  }

  function directionalFace(actor){
    const visual=actor&&actor._visualMotion||null;
    if(visual){
      const visualVector=vectorToFace(visual.dx,visual.dy);
      if(visualVector)return visualVector;
    }
    const velocityFace=vectorToFace(actor&&actor.vx,actor&&actor.vy);
    if(velocityFace)return velocityFace;
    const visualFace=normalizeFace(visual&&visual.face);
    if(visualFace)return visualFace;
    const directFace=normalizeFace(actor&&actor._face);
    if(directFace)return directFace;
    return heroSpriteState.lastFace||'down';
  }

  function heroImageFor(face){
    if(heroLoaded[face]&&heroImages[face])return heroImages[face];
    if(heroLoaded[heroSpriteState.lastFace]&&heroImages[heroSpriteState.lastFace])return heroImages[heroSpriteState.lastFace];
    if(heroLoaded.down&&heroImages.down)return heroImages.down;
    for(let i=0;i<HERO_FACES.length;i+=1){
      const candidate=HERO_FACES[i];
      if(heroLoaded[candidate]&&heroImages[candidate])return heroImages[candidate];
    }
    return null;
  }

  function drawHeroName(actor,topY){
    if(!actor||!actor.name||typeof ctx==='undefined'||!ctx)return;
    ctx.save();
    ctx.font='10px sans-serif';
    ctx.textAlign='center';
    ctx.lineWidth=3;
    ctx.strokeStyle='rgba(0,0,0,.72)';
    ctx.fillStyle='#00d2ff';
    ctx.strokeText(actor.name,actor.x,topY-7);
    ctx.fillText(actor.name,actor.x,topY-7);
    ctx.restore();
  }

  function drawHeroShield(actor){
    if(!actor||!actor.activeShield||typeof ctx==='undefined'||!ctx)return;
    const radius=Math.max(Number(actor.radius)||20,28)+7;
    ctx.save();
    ctx.strokeStyle='#ffd166';
    ctx.lineWidth=3;
    ctx.beginPath();
    ctx.arc(actor.x,actor.y,radius,0,Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  // KELO-INDEX AVATAR/HERO reemplaza solo el cuerpo visual del jugador local; gameplay/collider no cambian.
  function renderMainHeroSprite(actor,isSelf,next){
    if(!isSelf||!actor||!heroSpriteState.ready||typeof ctx==='undefined'||!ctx)return next();

    const face=directionalFace(actor);
    const heroImage=heroImageFor(face);
    if(!heroImage||!heroImage.naturalWidth||!heroImage.naturalHeight)return next();

    const radius=Math.max(1,Number(actor.radius)||20);
    const drawH=Math.max(92,radius*4.8);
    const drawW=drawH*(heroImage.naturalWidth/heroImage.naturalHeight);
    const feetY=actor.y+Math.max(14,radius*0.9);
    const drawX=actor.x-drawW/2;
    const drawY=feetY-drawH;

    // Sombra de contacto: conserva el anclaje físico del collider aunque el arte sea más grande.
    ctx.save();
    ctx.globalAlpha=.28;
    ctx.fillStyle='#000';
    ctx.beginPath();
    ctx.ellipse(actor.x,actor.y+14,Math.max(radius*.9,drawW*.22),Math.max(6,radius*.4),0,0,Math.PI*2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    const oldSmoothing=ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled=true;
    if(Math.hypot(Number(actor.vx)||0,Number(actor.vy)||0)>10){
      const squashX=Number(actor.squashX)||1;
      const squashY=Number(actor.squashY)||1;
      ctx.translate(actor.x,feetY);
      ctx.scale(squashX,squashY);
      ctx.translate(-actor.x,-feetY);
    }
    ctx.drawImage(heroImage,drawX,drawY,drawW,drawH);
    ctx.imageSmoothingEnabled=oldSmoothing;
    ctx.restore();

    drawHeroShield(actor);
    drawHeroName(actor,drawY);

    heroSpriteState.drawCount+=1;
    heroSpriteState.lastFace=face;
    heroSpriteState.lastFrame=0;
    return undefined;
  }

  function dispatch(index,actor,isSelf){
    if(index>=middleware.length)return baseRenderer(actor,isSelf);
    const entry=middleware[index];
    let called=false;
    let result;
    function next(nextActor,nextIsSelf){
      if(called)return result;
      called=true;
      result=dispatch(
        index+1,
        nextActor===undefined?actor:nextActor,
        nextIsSelf===undefined?isSelf:!!nextIsSelf
      );
      return result;
    }
    return entry.fn(actor,isSelf,next,Object.freeze({owner:entry.owner,priority:entry.priority,baseOwner:baseOwner}));
  }

  function snapshot(){
    return Object.freeze({
      version:VERSION,
      baseOwner:baseOwner,
      baseRevision:baseRevision,
      mainHero:Object.freeze({
        source:heroSpriteState.source,
        ready:heroSpriteState.ready,
        complete:heroSpriteState.complete,
        readyCount:heroSpriteState.readyCount,
        error:heroSpriteState.error,
        lastFace:heroSpriteState.lastFace,
        middlewareId:heroSpriteState.middlewareId
      }),
      middleware:Object.freeze(middleware.map(function(entry){
        return Object.freeze({id:entry.id,owner:entry.owner,priority:entry.priority});
      }))
    });
  }

  // El sprite principal vive dentro del owner y debajo de character-customization (priority 250),
  // para conservar capas back/front de ropa/equipo sin volver a dibujar el cuerpo legacy.
  heroSpriteState.middlewareId=use('main-hero:base-zoo',renderMainHeroSprite,100);

  // FOUNDATION-ALLOW: único wrapper autorizado de renderAvatar después de engine-c.
  renderAvatar=function(actor,isSelf){
    return dispatch(0,actor,!!isSelf);
  };

  root.KeloAvatar=Object.freeze({
    version:VERSION,
    setBase:setBase,
    use:use,
    unregister:unregister,
    snapshot:snapshot
  });
  root.KELO_AVATAR_RENDER_AUDIT=Object.freeze({
    version:VERSION,
    installed:true,
    singleLegacyWrapper:true,
    baseReplacement:true,
    middlewareFallback:true,
    middlewareOrder:'priority-desc',
    mainHeroSprite:true,
    mainHeroSpriteSource:HERO_ROOT,
    mainHeroSpriteGrid:'8-direction-files',
    mainHeroFaceRows:'down,down-right,right,up-right,up,up-left,left,down-left',
    mainHeroState:'Idle',
    gameplayAuthority:false,
    legacyTarget:'renderAvatar'
  });
})(typeof globalThis!=='undefined'?globalThis:window);
