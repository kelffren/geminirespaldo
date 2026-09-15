import fs from 'node:fs';
import assert from 'node:assert/strict';
import { alphaBoundsFromImageData,reorderItems } from '../src/creators/sprite-ability/sprite-ability-repair-studio.mjs';
import { pinchScale,pinchBrushSize,pinchMidpoint,brushScreenDiameter } from '../src/creators/sprite-ability/sprite-ability-repair-touch.mjs';

const rgba=new Uint8ClampedArray(6*5*4);
for(let y=1;y<=3;y++)for(let x=2;x<=4;x++)rgba[(y*6+x)*4+3]=255;
assert.deepEqual(alphaBoundsFromImageData(rgba,6,5),{x:2,y:1,width:3,height:3,empty:false});
assert.deepEqual(alphaBoundsFromImageData(new Uint8ClampedArray(3*2*4),3,2),{x:0,y:0,width:3,height:2,empty:true});
assert.deepEqual(reorderItems(['a','b','c','d'],0,2),['b','c','a','d']);
assert.deepEqual(reorderItems(['a','b','c'],2,0),['c','a','b']);
assert.equal(pinchScale(1,100,150),1.5);
assert.equal(pinchScale(2.4,100,200),2.5);
assert.equal(pinchScale(.3,100,10),.25);
assert.equal(pinchBrushSize(12,100,200),24);
assert.equal(pinchBrushSize(40,100,200),48);
assert.equal(pinchBrushSize(4,100,10),2);
assert.equal(Math.round(brushScreenDiameter(12,{stageCssWidth:320,stageLogicalWidth:640,frameWidth:128,frameHeight:128})),43);
assert.ok(brushScreenDiameter(24,{stageCssWidth:320,stageLogicalWidth:640,frameWidth:128,frameHeight:128})>brushScreenDiameter(12,{stageCssWidth:320,stageLogicalWidth:640,frameWidth:128,frameHeight:128}));
assert.deepEqual(pinchMidpoint({x:10,y:20},{x:30,y:60}),{x:20,y:40});

const source=fs.readFileSync(new URL('../src/creators/sprite-ability/sprite-ability-repair-studio.mjs',import.meta.url),'utf8');
for(const token of ['REPARAR SPRITE','DUPLICAR','ELIMINAR','REEMPLAZAR','CENTRAR','RECORTAR α','TRIM TODOS','USAR COMO REF','ALINEAR TODOS','ONION SKIN','✥ MOVER','⌖ PIVOT','✂ CROP','⌫ BORRAR','▶ PLAY','APLICAR REPARACIÓN','draggable=true'])assert.ok(source.includes(token),`missing ${token}`);
assert.ok(source.includes("globalCompositeOperation='destination-out'"),'eraser must remove pixels');
assert.ok(source.includes('state.frames=reorderItems'),'drag reorder must mutate frame order');
assert.ok(source.includes("setField(workspace,'.ksw-right','Impact Frame'"),'repair must restore impact frame');
assert.ok(source.includes("setField(workspace,'.ksw-right','Hitbox W'"),'repair must restore hitbox');

const touch=fs.readFileSync(new URL('../src/creators/sprite-ability/sprite-ability-repair-touch.mjs',import.meta.url),'utf8');
for(const token of ['pointerType','touch','srTouchGestures','srGesture','pinchScale','pinchBrushSize','brushScreenDiameter','sr-touch-brush-ring','pinch-scale','pinch-brush','MOVER: escala','BORRAR: tamaño'])assert.ok(touch.includes(token),`missing touch contract ${token}`);
assert.ok(touch.includes("dispatchEvent(new root.Event('input'"),'pinch must drive canonical range inputs');
assert.ok(touch.includes('stage.onpointermove?.'),'pinch centroid must reuse canonical move handler');

console.log('SPRITE REPAIR STUDIO CONTRACT: PASS');
