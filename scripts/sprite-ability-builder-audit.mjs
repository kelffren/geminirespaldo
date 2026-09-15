/* KELO-INDEX
 * area: QA / CREATORS
 * keys: SPRITE ABILITY BUILDER SPRITESHEET AUTO FIT IMPACT GENERATE ANIMATION ABILITY
 * purpose: valida auto-detección de hoja irregular y contrato authoring → Animation + Ability sin ejecutar combate
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeSpriteAbilityDocument,frameRect,spriteAbilityTiming,validateSpriteAbilityDocument,buildGeneratedDrafts } from '../src/creators/sprite-ability/sprite-ability-document.mjs';
import { buildForegroundMask,detectSpritesheetGrid,normalizedGridSize } from '../src/creators/sprite-ability/spritesheet-auto-fit.mjs';
import { normalizeCreatorProject } from '../src/creators/core/creator-project.mjs';
import { normalizeAnimationDocument,validateAnimationDocument } from '../src/creators/animation/animation-document.mjs';
import { normalizeAbilityDocument,validateAbilityDocument } from '../src/creators/ability/ability-document.mjs';

function syntheticSheet(width,height,{cols=8,rows=4,solidBackground=false}={}){
  const data=new Uint8ClampedArray(width*height*4);
  for(let p=0;p<width*height;p++){const i=p*4;if(solidBackground){data[i]=3;data[i+1]=4;data[i+2]=6;data[i+3]=255;}}
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const x0=Math.floor(c*width/cols),x1=Math.floor((c+1)*width/cols),y0=Math.floor(r*height/rows),y1=Math.floor((r+1)*height/rows);
    const bw=Math.max(2,Math.floor((x1-x0)*.52)),bh=Math.max(2,Math.floor((y1-y0)*.55)),cx=Math.floor((x0+x1)/2),cy=Math.floor((y0+y1)/2);
    for(let y=Math.max(y0,cy-Math.floor(bh/2));y<Math.min(y1,cy+Math.ceil(bh/2));y++)for(let x=Math.max(x0,cx-Math.floor(bw/2));x<Math.min(x1,cx+Math.ceil(bw/2));x++){
      const i=(y*width+x)*4;data[i]=30+c*12;data[i+1]=120+r*18;data[i+2]=240;data[i+3]=255;
    }
  }
  return{data};
}

const irregular=syntheticSheet(199,79);
const detected=detectSpritesheetGrid(irregular,199,79);
assert.equal(detected.cols,8,'irregular sheet columns should auto-detect');
assert.equal(detected.rows,4,'irregular sheet rows should auto-detect');
assert(detected.confidence>.5,'auto-fit confidence unexpectedly low');
const fitted=normalizedGridSize(199,79,detected.cols,detected.rows);
assert.equal(fitted.width%8,0);assert.equal(fitted.height%4,0);assert.equal(fitted.width,fitted.cellWidth*8);assert.equal(fitted.height,fitted.cellHeight*4);
const opaque=syntheticSheet(199,79,{solidBackground:true});
const fg=buildForegroundMask(opaque,199,79);assert.equal(fg.backgroundMode,'solid-corner','solid corner background should be recognized');
const detectedOpaque=detectSpritesheetGrid(opaque,199,79);assert.equal(detectedOpaque.cols,8);assert.equal(detectedOpaque.rows,4);

const dataUrl='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
const source=normalizeSpriteAbilityDocument({name:'Sword Burst',sheet:{assetId:'sword_burst_sheet',fileName:'sword.png',dataUrl,imageWidth:512,imageHeight:768,frameWidth:128,frameHeight:192,columns:4,rows:4,startFrame:0,endFrame:5,fps:16,autoFit:{applied:true,sourceWidth:511,sourceHeight:769,confidence:.91,score:.88,backgroundMode:'alpha',backgroundRemoved:false}},combat:{key:'sword_burst',name:'Sword Burst',impactFrame:2,damage:31,range:146,arcDeg:100,knockback:24,hitstopMs:52,cooldownMs:420,lunge:18,recoveryMs:190,cancelWindowMs:70,movementScale:.76,deliveryType:'instant'}});
const report=validateSpriteAbilityDocument(source);assert.equal(report.ok,true,report.errors.join(','));assert.equal(source.sheet.autoFit.applied,true);assert.equal(source.sheet.autoFit.sourceWidth,511);
const rect=frameRect(source,5);assert.deepEqual(rect,{sx:128,sy:192,sw:128,sh:192});
const timing=spriteAbilityTiming(source);assert.equal(timing.frameMs,62.5);assert.equal(timing.impactMs,125);assert(timing.totalMs>=315);
const built=buildGeneratedDrafts(source,{animationProjectId:'anim-project',abilityProjectId:'ability-project'});
assert.equal(built.animation.assetSource.dataUrl,dataUrl);assert.deepEqual(built.animation.clip.frameSequence,[0,1,2,3,4,5]);assert.equal(built.animation.clip.markers.impact,.125);assert.equal(built.animation.authoring.autoFit.applied,true);assert.equal(built.ability.links.animationProjectId,'anim-project');assert.equal(built.ability.definition.effects[0].amount,31);assert.equal(built.ability.definition.targeting.range,146);assert.equal(built.ability.definition.action.movementScale,.76);assert.equal(built.ability.authoring.spriteAutoFit.confidence,.91);
const anim=normalizeAnimationDocument(built.animation);assert.equal(anim.assetSource.dataUrl,dataUrl);assert.equal(validateAnimationDocument(anim,{assetRegistry:{get:()=>null}}).ok,true,'embedded sheet should satisfy animation asset validation');
const ability=normalizeAbilityDocument(built.ability);assert.equal(validateAbilityDocument(ability,{supportedDeliveryTypes:['instant','dash','self_aoe','projectile']}).ok,true);assert.equal(ability.links.animationProjectId,'anim-project');
const project=normalizeCreatorProject({type:'SPRITE_ABILITY',name:'Sword Burst Builder',ownerId:'tester'});assert.equal(project.type,'SPRITE_ABILITY');
const entry=fs.readFileSync(new URL('../src/creators/creator-entry.mjs',import.meta.url),'utf8'),hub=fs.readFileSync(new URL('../src/creators/ui/creator-hub.mjs',import.meta.url),'utf8'),controller=fs.readFileSync(new URL('../src/creators/sprite-ability/sprite-ability-live-controller.mjs',import.meta.url),'utf8');
assert(entry.includes('registerSpriteAbilityWorkspace'));assert(hub.includes("['sprite-ability','Sprite Ability','active']"));for(const token of ['image/png,image/webp','analyzeAndNormalizeSpritesheet','AUTO-FIT','SHEET','ABILITY','DUMMY','Impact Frame','Hitstop ms','⚡ GENERATE','OPEN ABILITY','EXPORT JSON'])assert(controller.includes(token),`missing UI contract: ${token}`);
console.log('PASS Sprite Ability Builder auto-fit contract audit');
console.log(JSON.stringify({autoFit:{detected:`${detected.cols}x${detected.rows}`,confidence:detected.confidence,normalized:`${fitted.width}x${fitted.height}`,solidBackgroundDetected:fg.backgroundMode},frameRect:rect,timing,animationProjectId:built.ability.links.animationProjectId,damage:built.ability.definition.effects[0].amount,embeddedAsset:true},null,2));
