/* KELO-INDEX
 * area: CREATORS / AVATAR / RAW IMAGE
 * owner: explicit user-intent review gate for full-canvas single-frame images
 * keys: RAW IMAGE SINGLE FRAME CONFIRM REVIEW CLIPPING BACKGROUND
 * purpose: allow a user-confirmed full image to remain full-bleed without weakening normal sprite validation
 * public-api: acceptConfirmedRawImageRuntime
 * do-not: bypass art defects, affect normal sprite ingestion, or auto-confirm risky imports
 */
const F=Object.freeze;
const RAW_ONLY_REASONS=new Set(['CLIPPING_RISK','COMPLEX_BACKGROUND','BACKGROUND_RESIDUAL','OUTPUT_CLIPPING','SUSPICIOUS_FRAMES','HEALTH_BELOW_RELEASE_GATE','SOURCE_SCALE_OUTLIER','COMPLEX_BACKGROUND_TEXTURE']);
const unique=v=>[...new Set((v||[]).filter(Boolean))];
export function acceptConfirmedRawImageRuntime(compiled,config={}){
  if(!config?.intentionalRawFrame||!config?.userConfirmedInterpretation)return compiled;
  if(compiled?.validation?.artDefects?.length)return compiled;
  const before=unique(compiled?.validation?.reviewReasons||compiled?.reviewReasons||[]),remaining=before.filter(reason=>!RAW_ONLY_REASONS.has(reason));
  const validation=F({...compiled.validation,reviewReasons:F(remaining),reviewRequired:remaining.length>0,status:remaining.length?'REVIEW_REQUIRED':'VALIDATED',rawIntentAcknowledged:true,rawIntentSuppressedReasons:F(before.filter(reason=>RAW_ONLY_REASONS.has(reason)))});
  return F({...compiled,validation,reviewReasons:F(remaining),reviewRequired:remaining.length>0,status:remaining.length?'REVIEW_REQUIRED':'VALIDATED',rawIntent:F({singleFrame:true,confirmed:true,suppressedReasons:validation.rawIntentSuppressedReasons}),audit:F({...compiled.audit,rawIntent:F({singleFrame:true,confirmed:true,suppressedReasons:validation.rawIntentSuppressedReasons})})});
}
export const __rawIntentInternals=F({RAW_ONLY_REASONS});
