import fs from 'node:fs';
const src=fs.readFileSync(new URL('../src/studio/input/studio-quick-actions-controller.mjs',import.meta.url),'utf8');
const required=[
'undo','redo','duplicate','focus','save','play','grid','assets','search','explorer','properties','rotate','scaleDown','scaleReset','scaleUp','select','move','terrain','path','collision','erase','clear','delete','all','invert','prev','next','snap1','snap8','snap16','snap32','snap64','zoomOut','zoomReset','zoomIn','camera','minimize','copy','paste','prefab','check','brush1','brush2','brush3','brush5','close','clearSearch','assetsTop','explorerTop','more'
];
const misses=required.filter(id=>!src.includes(`${id}:`));
if(misses.length)throw new Error(`Missing mobile actions: ${misses.join(', ')}`);
if(required.length!==50)throw new Error(`Expected 50 actions, got ${required.length}`);
for(const token of ['studio-quick-actions-v3.1.0-context-state','min-height:48px','env(safe-area-inset-bottom)','overscroll-behavior:contain','orientation:landscape','navigator?.vibrate','deleteArmedUntil','data-armed','snap(64)','brush(5)','[data-ext="copy"]','[data-ext="check"]','[data-ext="zoom-in"]'])if(!src.includes(token))throw new Error(`Missing mobile safeguard/feature: ${token}`);
for(const token of ['CANONICAL','syncMobileState','aria-pressed','button:disabled','button.active','data-active-tool','data-selection-count','kernel.selection.onChange','stateObserver.observe','stateObserver?.disconnect','unsubscribeSelection()'])if(!src.includes(token))throw new Error(`Missing contextual-state contract: ${token}`);
for(const id of ['clear','delete','duplicate','focus','rotate','scaleDown','scaleReset','scaleUp','copy','prefab'])if(!src.includes(`'${id}'`))throw new Error(`Selection-sensitive action missing from context sync: ${id}`);
if(!src.includes("setButtonState('all',{disabled:total===0||count===total})"))throw new Error('Select-all availability must reflect empty/full selection');
if(!src.includes("setButtonState('prev',{disabled:total<2})")||!src.includes("setButtonState('next',{disabled:total<2})"))throw new Error('Selection cycling must disable when fewer than two entities exist');
if(src.includes('KELO_WORLD_EDIT')||src.includes('kernel.execute('))throw new Error('Quick actions must not bypass canonical Studio controls');
console.log(`studio-mobile-50 audit OK: ${required.length} actions + contextual availability/active-state sync`);
