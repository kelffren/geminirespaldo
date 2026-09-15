/* KELO-INDEX
 * area: CREATORS / IMPORT
 * owner: Universal spreadsheet import planner
 * owns: spreadsheet rows -> validated content jobs + local file resolution
 * does-not-own: upload, Supabase writes, runtime registration or publish authority
 * reuse: accepts CSV/XLSX plus a FileList/array selected from phone Files/Drive
 */
import { importDefinitionFile } from './tabular-definition-importer.mjs';
import { normalizeTabularContentRow,validateContentDraft } from '../content/content-type-schemas.mjs';
const F=Object.freeze;
const base=v=>String(v||'').split('/').pop().trim().toLowerCase();
function indexFiles(files){const map=new Map(),duplicates=new Set();for(const file of Array.from(files||[])){const key=base(file?.name);if(!key)continue;if(map.has(key))duplicates.add(key);else map.set(key,file);}return{map,duplicates};}
export function planUniversalContentRows(rows,{files=[]}={}){
  const {map,duplicates}=indexFiles(files),jobs=[],errors=[],warnings=[];
  (rows||[]).forEach((row,index)=>{
    const draft=normalizeTabularContentRow(row,index),validation=validateContentDraft(draft),resolved=[],missing=[];
    for(const ref of draft.assetRefs||[]){const file=map.get(base(ref.file));if(file)resolved.push(F({role:ref.role,file,sourceName:ref.file}));else missing.push(ref.file);}
    const jobErrors=[...validation.errors];if(missing.length)jobErrors.push('FILES_NOT_SELECTED:'+missing.join('|'));
    const jobWarnings=[...validation.warnings];
    if(jobErrors.length)errors.push({row:draft.sourceRow,slug:draft.slug,errors:jobErrors});
    if(jobWarnings.length)warnings.push({row:draft.sourceRow,slug:draft.slug,warnings:jobWarnings});
    jobs.push(F({draft,resolvedAssets:F(resolved),missingFiles:F(missing),ok:jobErrors.length===0,errors:F(jobErrors),warnings:F(jobWarnings)}));
  });
  if(duplicates.size)errors.push({row:null,slug:null,errors:['DUPLICATE_SELECTED_FILENAMES:'+Array.from(duplicates).join('|')]});
  return F({jobs:F(jobs),validJobs:F(jobs.filter(j=>j.ok)),invalidJobs:F(jobs.filter(j=>!j.ok)),errors:F(errors),warnings:F(warnings),fileCount:map.size,rowCount:jobs.length,readyCount:jobs.filter(j=>j.ok).length});
}
export async function importUniversalContentSpreadsheet(spreadsheetFile,{assetFiles=[],root=globalThis,sheetName=null}={}){
  const parsed=await importDefinitionFile(spreadsheetFile,{root,sheetName});
  return F({format:parsed.format,sheet:parsed.sheet,sheetNames:parsed.sheetNames||[],...planUniversalContentRows(parsed.rows,{files:assetFiles})});
}
export function buildFilePickerAccept(){return '.png,.webp,.jpg,.jpeg,.csv,.xlsx,.xls,.json,.zip,.mp3,.ogg,.wav';}
