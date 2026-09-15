import puppeteer from 'puppeteer-core';
const url='http://127.0.0.1:4173/?guest=1&mapEditor=1&creators=1&freezeLab=1';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const browser=await puppeteer.launch({
  executablePath:'/usr/bin/google-chrome', headless:'new',
  protocolTimeout:90000,
  args:['--no-sandbox','--disable-dev-shm-usage','--window-size=390,844']
});
const page=await browser.newPage();
await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
const report={stages:[],errors:[]};
page.on('pageerror',e=>report.errors.push(String(e)));
const mark=(s,extra={})=>{report.stages.push({s,...extra}); console.log('STAGE',s,JSON.stringify(extra));};
try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.KELO_ADMIN_KEYS?.can?.('world.edit'),{timeout:15000});
  await page.evaluate(async()=>{
    const {bootKeloCreators}=await import('./src/creators/creator-entry.mjs');
    await bootKeloCreators({root:window});
  });
  await page.waitForFunction(()=>!!window.KeloInputLocks?.acquire,{timeout:10000});
  mark('ready');
  const worldOpen=await page.evaluate(async()=>{
    const {createWorldWorkspaceManifest}=await import('./src/creators/workspaces/world-workspace.mjs');
    const session=await Promise.race([
      createWorldWorkspaceManifest().open({root:window}),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('OPEN_TIMEOUT')),25000))
    ]);
    return {ok:true,version:session?.version,mode:session?.mode};
  });
  mark('open',worldOpen);
  let frozen=false;
  const heavyAt=new Set([1000,3000,6000]);
  const checkpoints=[1000,3000,6000,12000,20000,28000];
  let prev=0;
  for(const ms of checkpoints){
    await sleep(ms-prev); prev=ms;
    const wantHeavy=heavyAt.has(ms);
    const snap=await Promise.race([
      page.evaluate((heavy)=>{
        const el=document.getElementById('kelo-studio-live');
        const base={
          exists:!!el,hasTop:!!el?.querySelector?.('.ks-top'),
          status:String(el?.querySelector?.('.ks-status')?.textContent||'').slice(0,100),
          assets:el?.querySelectorAll?.('[data-asset]')?.length||0,
          sheetOpen:el?.dataset?.sheetOpen||'',
          modes:[...(el?.querySelectorAll?.('[data-mode]')||[])].map(b=>b.dataset.mode),
          acts:[...(el?.querySelectorAll?.('[data-act="play"],[data-act="save"]')||[])].map(b=>b.dataset.act)
        };
        if(!heavy)return base;
        const canvases=[...(el?.querySelectorAll?.('[data-asset] canvas, .ks-compact-asset canvas')||[])];
        let previewInk=0;
        for(const c of canvases.slice(0,8)){
          try{
            const ctx=c.getContext('2d');
            if(!ctx||!c.width||!c.height)continue;
            const {data}=ctx.getImageData(0,0,Math.min(c.width,16),Math.min(c.height,16));
            for(let i=3;i<data.length;i+=4){if(data[i]>8){previewInk++;break;}}
          }catch{}
        }
        return {...base,previewCanvases:canvases.length,previewInk};
      }, wantHeavy),
      sleep(wantHeavy?8000:4000).then(()=>({timeout:true}))
    ]);
    mark('t'+ms,snap);
    if(snap.timeout){frozen=true;report.frozenAt=ms;break;}
  }
  if(!frozen){
    const place=await page.evaluate(async()=>{
      const el=document.getElementById('kelo-studio-live');
      const btn=[...(el?.querySelectorAll?.('[data-asset]')||[])].find(b=>/tree|arbol|oak|pine|roble|pino/i.test(`${b.dataset.asset} ${b.textContent}`))
        || el?.querySelector?.('[data-asset]');
      if(!btn)return {ok:false,reason:'no-asset'};
      btn.click();
      const bridge=await import('./src/studio/integration/world-studio-bridge.mjs?v=world-bridge-20260915-22');
      const session=bridge.getKeloStudioLive?.();
      const preview=!!(session?.studio?.tools?.placement?.getPreview?.()||session?.studio?.tools?.prefabStamp?.getPreview?.());
      return {ok:!!(session&& (session.mode==='placement'||session.mode==='prefab'||preview)),asset:btn.dataset.asset,mode:session?.mode||null,preview,hasSession:!!session};
    });
    mark('place',place);
    report.treeReady=!!place.ok;
    await page.evaluate(async()=>{
      const bridge=await import('./src/studio/integration/world-studio-bridge.mjs');
      await bridge.closeKeloStudioLive({root:window});
    });
    await sleep(500);
    const reopen=await page.evaluate(async()=>{
      const {createWorldWorkspaceManifest}=await import('./src/creators/workspaces/world-workspace.mjs');
      const session=await createWorldWorkspaceManifest().open({root:window});
      const el=document.getElementById('kelo-studio-live');
      return {ok:!!session,hasTop:!!el?.querySelector?.('.ks-top'),status:String(el?.querySelector?.('.ks-status')?.textContent||'').slice(0,80)};
    });
    mark('reopen',reopen);
    const early=report.stages.find(s=>s.s==='t1000');
    const mid=report.stages.find(s=>s.s==='t3000');
    const late=report.stages.find(s=>s.s==='t20000')||report.stages.find(s=>s.s==='t12000');
    report.previewOk=!!((early?.assets||0)>0 && ((early?.previewInk||0)>0 || (mid?.previewInk||0)>0));
    report.survivedLate=!!(late&&!late.timeout&&late.exists&&late.hasTop);
    report.ok=!!(worldOpen.ok && mid?.exists && mid?.hasTop && report.previewOk && report.treeReady && reopen.ok && report.survivedLate);
  }else report.ok=false;
}catch(e){report.fatal=String(e?.message||e);report.ok=false;}
await browser.close();
console.log(JSON.stringify(report,null,2));
process.exit(report.ok?0:2);
