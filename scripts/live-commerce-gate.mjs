const live=process.env.LIVE_URL||'https://kelffren.github.io/gemini/';
const sourceUrl=new URL('src/ui/commerce-ui.js',live);
let ready=false;
let last='';
for(let attempt=1;attempt<=36;attempt++){
  try{
    sourceUrl.searchParams.set('commerceDeployProbe',String(Date.now()));
    const res=await fetch(sourceUrl,{cache:'no-store'});
    const text=await res.text();
    const hasNewInventory=text.includes('return slots.map(')&&!text.includes('slots.slice(0,12)');
    if(res.ok&&hasNewInventory){
      console.log(`LIVE_COMMERCE_SOURCE_READY attempt=${attempt}`);
      ready=true;
      break;
    }
    last=`status=${res.status} newInventory=${hasNewInventory}`;
  }catch(err){last=String(err?.message||err);}
  await new Promise(r=>setTimeout(r,5000));
}
if(!ready)throw new Error(`LIVE_COMMERCE_SOURCE_NOT_DEPLOYED: ${last}`);
await import('./live-commerce-audit.mjs');
