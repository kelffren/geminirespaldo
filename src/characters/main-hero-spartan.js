/* KELO-INDEX
 * area: CHARACTERS / HERO
 * owner: KeloAvatar middleware
 * keys: HERO SPARTAN SPRITESHEET PLAYER AVATAR WALK FACE ANIMATION
 * purpose: usa assets/hero-spartan-spritesheet.png como apariencia principal del jugador local
 * online: visual local; no cambia autoridad, colision, HP, input ni posicion del actor
 * consumes: KeloAvatar.use + localPlayer/_visualMotion
 * do-not: no renderizar bots con este override; no mutar gameplay
 */
(function(root){
  'use strict';

  const VERSION='main-hero-spartan-v1.0.0';
  const SOURCE='assets/hero-spartan-spritesheet.png';
  const COLUMNS=4;
  const ROWS=4;
  const SOURCE_WIDTH=1233;
  const SOURCE_HEIGHT=1275;
  const CELL_W=SOURCE_WIDTH/COLUMNS;
  const CELL_H=SOURCE_HEIGHT/ROWS;
  const FACE_ROWS=Object.freeze({down:0,left:1,right:2,up:3});
  const METRICS=Object.freeze({
    down:Object.freeze({bodyHeight:284,footX:Object.freeze([202.5,184.5,118.5,110.5]),footY:Object.freeze([297,297,297,297])}),
    left:Object.freeze({bodyHeight:319,footX:Object.freeze([202.5,165,130,107.5]),footY:Object.freeze([318,318,318,318])}),
    right:Object.freeze({bodyHeight:318,footX:Object.freeze([203,164.5,125.5,98]),footY:Object.freeze([317,317,317,317])}),
    up:Object.freeze({bodyHeight:282,footX:Object.freeze([215.5,152.5,119.5,86.5]),footY:Object.freeze([281,281,281,281])})
  });

  const audit=root.KELO_MAIN_HERO_SPRITE_AUDIT={
    version:VERSION,
    source:SOURCE,
    installed:false,
    loaded:false,
    loadError:null,
    dimensions:null,
    expectedDimensions:[SOURCE_WIDTH,SOURCE_HEIGHT],
    columns:COLUMNS,
    rows:ROWS,
    drawCount:0,
    fallbackCount:0,
    lastDraw:null
  };

  if(!root.KeloAvatar || typeof root.KeloAvatar.use!=='function'){
    audit.loadError='KELO_AVATAR_UNAVAILABLE';
    return;
  }

  const image=new Image();
  image.decoding='async';
  image.onload=function(){
    const w=image.naturalWidth||image.width;
    const h=image.naturalHeight||image.height;
    audit.dimensions=[w,h];
    if(w!==SOURCE_WIDTH || h!==SOURCE_HEIGHT){
      audit.loadError='DIMENSION_MISMATCH_'+w+'x'+h;
      return;
    }
    audit.loaded=true;
  };
  image.onerror=function(){ audit.loadError='LOAD_FAILED'; };
  image.src=SOURCE+'?hero=spartan-v1';

  function motionOf(actor){
    const visual=actor && actor._visualMotion;
    if(visual){
      return {
        moving:!!visual.on,
        face:FACE_ROWS[visual.face]==null?(FACE_ROWS[actor._face]==null?'down':actor._face):visual.face,
        frame:Number.isFinite(visual.frame)?Math.abs(Math.floor(visual.frame))%COLUMNS:null
      };
    }
    const vx=Number(actor&&actor.vx)||0;
    const vy=Number(actor&&actor.vy)||0;
    const moving=Math.hypot(vx,vy)>12;
    let face=FACE_ROWS[actor&&actor._face]==null?'down':actor._face;
    if(moving){
      if(Math.abs(vx)*1.15>=Math.abs(vy)) face=vx>=0?'right':'left';
      else face=vy>=0?'down':'up';
    }
    return {moving:moving,face:face,frame:null};
  }

  function frameColumn(actor,motion){
    if(motion.frame!=null)return motion.frame;
    if(!motion.moving)return 0;
    const phase=actor&&actor.id?Array.from(String(actor.id)).reduce(function(sum,ch){return sum+ch.charCodeAt(0);},0):0;
    return Math.floor((performance.now()+phase*19)/135)%COLUMNS;
  }

  function presentationOf(actor){
    if(root.KELO_AVATAR_PRESENTATION && typeof root.KELO_AVATAR_PRESENTATION.get==='function'){
      try{return root.KELO_AVATAR_PRESENTATION.get(actor)||null;}catch(_){/* fallback below */}
    }
    return null;
  }

  function renderHero(actor,isSelf,next){
    if(!isSelf || !actor)return next();
    if(!audit.loaded || audit.loadError){ audit.fallbackCount+=1; return next(); }

    const motion=motionOf(actor);
    const face=FACE_ROWS[motion.face]==null?'down':motion.face;
    const row=FACE_ROWS[face];
    const col=frameColumn(actor,motion);
    const metrics=METRICS[face]||METRICS.down;
    const layout=presentationOf(actor);
    const footRootX=layout&&Number.isFinite(layout.footRootX)?layout.footRootX:actor.x;
    const footRootY=layout&&Number.isFinite(layout.footRootY)?layout.footRootY:actor.y+10;
    const requestedHeight=layout&&Number.isFinite(layout.visualHeight)?layout.visualHeight:96;
    const targetBodyHeight=Math.max(100,requestedHeight);
    const scale=targetBodyHeight/metrics.bodyHeight;

    const sx=col*CELL_W;
    const sy=row*CELL_H;
    const sw=CELL_W;
    const sh=CELL_H;
    const anchorX=metrics.footX[col];
    const anchorY=metrics.footY[col];
    const dx=footRootX-anchorX*scale;
    const dy=footRootY-anchorY*scale;
    const dw=sw*scale;
    const dh=sh*scale;

    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(actor.x,footRootY+2,Math.max(20,actor.radius*1.2),Math.max(7,actor.radius*0.42),0,0,Math.PI*2);
    ctx.fill();
    const previousSmoothing=ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled=true;
    ctx.drawImage(image,sx,sy,sw,sh,dx,dy,dw,dh);
    ctx.imageSmoothingEnabled=previousSmoothing;
    if(actor.activeShield){
      ctx.strokeStyle='#ffd166';
      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.arc(actor.x,actor.y,Math.max(actor.radius+8,30),0,Math.PI*2);
      ctx.stroke();
    }
    ctx.fillStyle='#e7c56a';
    ctx.font='bold 11px sans-serif';
    ctx.textAlign='center';
    const labelY=layout&&Number.isFinite(layout.nameplateAnchorY)?layout.nameplateAnchorY:dy-5;
    ctx.fillText(actor.name||'Kelo',Math.round(actor.x),Math.round(labelY));
    ctx.restore();

    audit.drawCount+=1;
    audit.lastDraw={actorId:actor.id||null,face:face,frame:col,sourceRect:[sx,sy,sw,sh],destinationRect:[dx,dy,dw,dh]};
    return true;
  }

  root.KeloAvatar.use('main-hero-spartan',renderHero,1000);
  audit.installed=true;
})(typeof globalThis!=='undefined'?globalThis:window);
