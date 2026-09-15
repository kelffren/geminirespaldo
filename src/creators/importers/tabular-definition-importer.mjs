/* KELO-INDEX
 * area: CREATORS / IMPORT
 * owner: shared tabular definition importer
 * purpose: CSV/XLSX -> rows authoring; XLSX se carga solo bajo acción explícita
 * public-api: importDefinitionFile/parseCsv/loadSheetJs
 * consumes: File.arrayBuffer/TextDecoder; SheetJS lazy para .xlsx
 * state-owned: ninguno
 * online: N/A authoring local; nunca ejecuta contenido del spreadsheet
 * do-not: no incluir XLSX en index boot; no publicar sin validator del workspace
 */
const XLSX_CDN='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
export function parseCsv(text){
  const rows=[];let row=[],cell='',quoted=false;const s=String(text??'');
  for(let i=0;i<=s.length;i++){const ch=s[i]??'\n';if(quoted){if(ch==='"'&&s[i+1]==='"'){cell+='"';i++;}else if(ch==='"')quoted=false;else cell+=ch;continue;}if(ch==='"'){quoted=true;continue;}if(ch===','){row.push(cell);cell='';continue;}if(ch==='\n'||ch==='\r'&&s[i+1]!=='\n'){row.push(cell);cell='';if(row.some(v=>String(v).trim()!==''))rows.push(row);row=[];continue;}if(ch==='\r')continue;cell+=ch;}
  if(!rows.length)return[];const headers=rows.shift().map(v=>String(v).trim());return rows.map(cols=>Object.fromEntries(headers.map((h,i)=>[h,cols[i]??''])));
}
export async function loadSheetJs({root=globalThis,src=XLSX_CDN}={}){if(root.XLSX?.read&&root.XLSX?.utils?.sheet_to_json)return root.XLSX;if(!root.document)throw new Error('XLSX_BROWSER_LOADER_REQUIRED');await new Promise((resolve,reject)=>{const existing=root.document.querySelector('script[data-kelo-sheetjs]');if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',()=>reject(new Error('XLSX_LOAD_FAILED')),{once:true});return;}const script=root.document.createElement('script');script.src=src;script.async=true;script.dataset.keloSheetjs='1';script.onload=resolve;script.onerror=()=>reject(new Error('XLSX_LOAD_FAILED'));root.document.head.appendChild(script);});if(!root.XLSX?.read)throw new Error('XLSX_API_MISSING');return root.XLSX;}
function cleanRow(row){const out={};for(const [k,v] of Object.entries(row||{})){const key=String(k).trim();if(!key)continue;out[key]=typeof v==='string'?v.trim():v;}return out;}
export async function importDefinitionFile(file,{root=globalThis,sheetName=null}={}){if(!file)throw new Error('IMPORT_FILE_REQUIRED');const name=String(file.name||'').toLowerCase();if(name.endsWith('.csv')){const text=await file.text();return{format:'csv',sheet:'CSV',rows:parseCsv(text).map(cleanRow)};}if(name.endsWith('.xlsx')||name.endsWith('.xls')){const XLSX=await loadSheetJs({root}),buffer=await file.arrayBuffer(),book=XLSX.read(buffer,{type:'array',cellDates:false,cellFormula:false,cellHTML:false});const selected=sheetName&&book.Sheets[sheetName]?sheetName:book.SheetNames[0];if(!selected)throw new Error('XLSX_EMPTY_WORKBOOK');const rows=XLSX.utils.sheet_to_json(book.Sheets[selected],{defval:'',raw:false}).map(cleanRow);return{format:'xlsx',sheet:selected,rows,sheetNames:book.SheetNames.slice()};}throw new Error('IMPORT_FORMAT_UNSUPPORTED');}
export function mountRowsFromTabular(rows){return(rows||[]).map((r,index)=>({schemaVersion:1,id:String(r.id||'').trim(),displayName:String(r.displayName||r.name||'').trim(),speciesId:String(r.speciesId||'').trim(),rarity:String(r.rarity||'common').trim(),movementProfileId:String(r.movementProfileId||'').trim(),abilityIds:[r.ability1Id,r.ability2Id,r.ability3Id].map(v=>String(v||'').trim()),appearanceProfileId:String(r.appearanceProfileId||'').trim(),equipmentSlotProfileId:String(r.equipmentSlotProfileId||'').trim(),assetBundleId:String(r.assetBundleId||'').trim(),animationSetId:String(r.animationSetId||'').trim(),riderAnchorProfileId:String(r.riderAnchorProfileId||'').trim(),unlockRuleId:r.unlockRuleId?String(r.unlockRuleId).trim():null,tags:String(r.tags||'').split(/[|;]/).map(v=>v.trim()).filter(Boolean),__sourceRow:index+2}));}
