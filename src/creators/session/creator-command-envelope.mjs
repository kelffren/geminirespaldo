/* KELO-INDEX
 * area: CREATORS / COMMAND ENVELOPE
 * owner: serializable Creator command transport envelope
 * owns: envelope normalization + data-only validation
 * does-not-own: CommandBus execution, workspace commands, networking or conflict policy
 */
const clone=v=>v==null?v:(typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v)));
export function isCreatorDataOnly(value,seen=new Set()){
  if(value==null||['string','number','boolean'].includes(typeof value))return true;
  if(typeof value==='function'||typeof value==='symbol'||typeof value==='bigint'||typeof value!=='object'||seen.has(value))return false;
  seen.add(value);
  return Array.isArray(value)?value.every(v=>isCreatorDataOnly(v,seen)):Object.values(value).every(v=>isCreatorDataOnly(v,seen));
}
export function assertCreatorDataMessage(value){if(!isCreatorDataOnly(value))throw new Error('CREATOR_TRANSPORT_DATA_ONLY');return value;}
export function createCreatorCommandEnvelope(input={}, {now=Date.now()}={}){
  for(const key of ['commandId','sessionId','actorId','type'])if(!String(input[key]||'').trim())throw new Error(`CREATOR_COMMAND_ENVELOPE_REQUIRED:${key}`);
  const sequence=Number(input.sequence);if(!Number.isInteger(sequence)||sequence<0)throw new Error('CREATOR_COMMAND_ENVELOPE_SEQUENCE_INVALID');
  assertCreatorDataMessage(input.payload??{});
  return Object.freeze({commandId:String(input.commandId),sessionId:String(input.sessionId),actorId:String(input.actorId),sequence,type:String(input.type),payload:clone(input.payload??{}),baseRevision:input.baseRevision==null?null:String(input.baseRevision),timestamp:Number(input.timestamp)||now});
}
