/* KELO-INDEX
 * area: VISUAL / AVATAR SUPPORT
 * owner: KeloArmorAura; avatar composition owned by KeloAvatar
 * keys: ARMOR AURA AVATAR BACK FRONT MIDDLEWARE FOUNDATION
 * purpose: dibuja aura de armadura alrededor del avatar sin envolver renderAvatar
 * public-api: KeloArmorAura
 * consumes: KeloAvatar, KeloEquipment, KELO_AVATAR_PRESENTATION, ctx
 * state-owned: ninguno; presentación derivada del armor score/rank del actor
 * extension-points: KeloAvatar.use middleware exterior a appearance/base
 * reuse: efectos persistentes ligados al actor que deban respetar composición Avatar
 * legacy: conserva renderBack/renderFront públicos para consumidores existentes
 * do-not: NO envolver renderAvatar ni decidir gameplay
 */
(function(){
'use strict';
const VERSION='armor-aura-v1.2-foundation';
const THRESHOLDS=[0,330,475,750,950,1350,1720,2225,3860,5250];
const PARTICLES=[0,0,2,4,5,6,8,10,12,16];
let avatarHookId=null;
function rankFromScore(score){score=Math.max(0,Math.floor(Number(score)||0));let r=0;for(let i=1;i<THRESHOLDS.length;i++)if(score>=THRESHOLDS[i])r=i;return r;}
function rankOf(player){if(!player)return 0;if(Number.isFinite(player.auraRank))return Math.max(0,Math.min(9,Math.floor(player.auraRank)));if(window.KeloEquipment){const score=player===localPlayer?window.KeloEquipment.getArmorScore():Number(player.armorScore)||0;return window.KeloEquipment.getAuraRank(score);}return rankFromScore(player.armorScore||0);}
function phase(player,salt){const id=String(player&&player.id||'p');let h=0;for(let i=0;i<id.length;i++)h=(h*31+id.charCodeAt(i))>>>0;return (performance.now()*0.001+(h%97)*0.07+(salt||0));}
function presentationOf(p){try{if(p&&window.KELO_AVATAR_PRESENTATION&&typeof window.KELO_AVATAR_PRESENTATION.get==='function')return window.KELO_AVATAR_PRESENTATION.get(p,p._face||'down');}catch(e){}return null;}
function visualMetrics(p){const physicsRadius=(p&&p.radius)||20,layout=presentationOf(p),visualScale=layout&&Number.isFinite(layout.visualScale)?layout.visualScale:1;return{physicsRadius,visualScale,effectRadius:physicsRadius*visualScale,footRootY:layout&&Number.isFinite(layout.footRootY)?layout.footRootY:(p?p.y:0),visualWidth:layout&&Number.isFinite(layout.visualWidth)?layout.visualWidth:null,visualHeight:layout&&Number.isFinite(layout.visualHeight)?layout.visualHeight:null};}
function drawRing(ctx,p,rank,front){if(rank<=0)return;const m=visualMetrics(p),t=phase(p,rank),pulse=1+Math.sin(t*2.2)*(.025+rank*.004),rx=m.effectRadius*(1.05+rank*.075)*pulse,ry=rx*.38;ctx.save();ctx.globalAlpha=Math.min(.16+rank*.045,.58);ctx.strokeStyle=rank>=8?'#ffe69a':'#d8b75b';ctx.lineWidth=rank>=7?2.2:1.4;ctx.beginPath();ctx.ellipse(p.x,p.y+m.physicsRadius*.72,rx,ry,0,front?0:Math.PI,front?Math.PI:Math.PI*2);ctx.stroke();if(rank>=7){ctx.globalAlpha*=.58;ctx.beginPath();ctx.ellipse(p.x,p.y+m.physicsRadius*.72,rx*1.2,ry*1.35,0,front?0:Math.PI,front?Math.PI:Math.PI*2);ctx.stroke();}ctx.restore();}
function drawBodyGlow(ctx,p,rank){if(rank<3)return;const m=visualMetrics(p),t=phase(p,2),r=m.effectRadius*(1.35+rank*.07+Math.sin(t*1.7)*.025);ctx.save();ctx.globalAlpha=.035+rank*.012;ctx.fillStyle=rank>=8?'#fff0b3':'#e7c56a';ctx.beginPath();ctx.arc(p.x,p.y-m.physicsRadius*.2,r,0,Math.PI*2);ctx.fill();ctx.restore();}
function drawParticles(ctx,p,rank,front){if(rank<5)return;const m=visualMetrics(p),count=PARTICLES[rank]||0,t=phase(p,5),rad=m.effectRadius*(1.1+rank*.06);ctx.save();ctx.fillStyle=rank>=8?'#ffeaa0':'#e7c56a';for(let i=0;i<count;i++){if((i%2===0)!==front)continue;const a=(i/count)*Math.PI*2+t*(.16+(i%3)*.025),rise=((t*.35+i*.137)%1),x=p.x+Math.cos(a)*rad*(.45+.55*rise),y=p.y+m.physicsRadius*.6-rise*m.effectRadius*2.3;const s=rank>=9&&i%5===0?2.1:1.15;ctx.globalAlpha=.12+.42*(1-rise);ctx.fillRect(Math.round(x-s/2),Math.round(y-s/2),s,s);}ctx.restore();}
function drawSpark(ctx,p,rank){if(rank<9)return;const m=visualMetrics(p),t=phase(p,9);ctx.save();ctx.strokeStyle='#fff2ba';ctx.globalAlpha=.45+.22*Math.sin(t*3);ctx.lineWidth=1;for(let i=0;i<3;i++){const a=t*.55+i*Math.PI*2/3,r=m.effectRadius*1.45,x=p.x+Math.cos(a)*r,y=p.y-m.physicsRadius*.25+Math.sin(a)*r*.55;ctx.beginPath();ctx.moveTo(x-3,y);ctx.lineTo(x+3,y);ctx.moveTo(x,y-3);ctx.lineTo(x,y+3);ctx.stroke();}ctx.restore();}
function renderBack(ctx,p){const rank=rankOf(p);if(!rank)return;drawRing(ctx,p,rank,false);drawBodyGlow(ctx,p,rank);drawParticles(ctx,p,rank,false);}
function renderFront(ctx,p){const rank=rankOf(p);if(!rank)return;drawRing(ctx,p,rank,true);drawParticles(ctx,p,rank,true);drawSpark(ctx,p,rank);}
function middleware(p,isSelf,next){if(!p||typeof ctx==='undefined')return next();renderBack(ctx,p);const out=next();renderFront(ctx,p);return out;}
function install(){if(avatarHookId)return true;if(!window.KeloAvatar||typeof window.KeloAvatar.use!=='function')return false;avatarHookId=window.KeloAvatar.use('armor-aura:actor-shell',middleware,300);return true;}
install();
window.KeloArmorAura=Object.freeze({version:VERSION,thresholds:THRESHOLDS.slice(),particleBudget:PARTICLES.slice(),getAuraRank:rankFromScore,rankOf,visualMetrics,renderBack,renderFront,install});
window.KELO_ARMOR_AURA_AUDIT={version:VERSION,ready:true,maxRank:9,maxParticles:16,canvasOnly:true,usesAvatarPresentation:true,visualScaleFallback:1,thresholds:THRESHOLDS.slice(),avatarOwner:'KeloAvatar',avatarHook:'armor-aura:actor-shell',avatarPriority:300,directRenderAvatarWrapper:false};
})();