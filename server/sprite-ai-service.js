'use strict';

const DEFAULT_MODEL='gpt-image-2.5-sunburst';
const DEFAULT_SIZE='1024x2048';
const DEFAULT_DIRECTIONS=Object.freeze(['N','NE','E','SE','S','SW','W','NW']);
const ALLOWED_IMAGE_TYPES=new Set(['image/png','image/webp','image/jpeg']);

function clampInt(value,min,max,fallback){const n=Math.floor(Number(value));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function short(value,max=400){return String(value||'').trim().slice(0,max);}
function serviceError(code,status=500,detail=null){const error=new Error(code);error.code=code;error.status=status;if(detail)error.detail=detail;return error;}
function parseImageDataUrl(value,maxBytes){if(!value)return null;const match=/^data:(image\/(?:png|webp|jpeg));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(String(value));if(!match)throw serviceError('SPRITE_AI_INVALID_SOURCE_IMAGE',400);const bytes=Buffer.from(match[2].replace(/\s/g,''),'base64');if(!bytes.length)throw serviceError('SPRITE_AI_EMPTY_SOURCE_IMAGE',400);if(bytes.length>maxBytes)throw serviceError('SPRITE_AI_SOURCE_TOO_LARGE',413);if(!ALLOWED_IMAGE_TYPES.has(match[1]))throw serviceError('SPRITE_AI_UNSUPPORTED_SOURCE_IMAGE',415);const ext=match[1]==='image/jpeg'?'jpg':match[1].split('/')[1];return{mime:match[1],bytes,ext};}
function buildPrompt(input={}){
  const action=short(input.action||'walk',24).toLowerCase(),styleHint=short(input.styleHint,300),retryHint=short(input.retryHint,500),directions=Array.isArray(input.directions)&&input.directions.length===8?input.directions.map(x=>short(x,4)):DEFAULT_DIRECTIONS;
  return [
    'Create ONE production-ready 2D game character sprite sheet with a transparent background.',
    'The output MUST be a strict atlas: exactly 4 equal columns by 8 equal rows. No margins, no gutters, no grid lines, no labels, no text, no border, no scenery, no shadow outside each cell.',
    `Rows from top to bottom are exactly: ${directions.join(', ')}.`,
    `Every row shows the SAME character performing a looping ${action} cycle in exactly four chronological phases: contact, passing, opposite-contact, passing.`,
    'Keep identity, clothing, equipment, silhouette, body proportions, lighting and scale identical across all 32 cells. Only facing direction and animation phase may change.',
    'Center the feet on the same baseline inside every cell. Leave at least 8% transparent safety padding on all four sides of every cell so no sprite touches a cell edge.',
    'Use clean readable game-sprite rendering with crisp separated limbs and strong silhouette. Do not merge neighboring cells.',
    styleHint?`Art direction: ${styleHint}`:'Art direction: premium dark-fantasy MMORPG character, readable at small size, restrained gold accents.',
    retryHint?`Previous QA failed. Correct these exact issues: ${retryHint}`:'',
    'Return only the sprite sheet image.'
  ].filter(Boolean).join('\n');
}

function createSpriteAiService(options={}){
  const apiKey=String(options.apiKey??process.env.OPENAI_API_KEY??'').trim();
  const model=String(options.model??process.env.KELO_SPRITE_AI_MODEL??DEFAULT_MODEL).trim()||DEFAULT_MODEL;
  const quality=String(options.quality??process.env.KELO_SPRITE_AI_QUALITY??'low').trim()||'low';
  const size=String(options.size??process.env.KELO_SPRITE_AI_SIZE??DEFAULT_SIZE).trim()||DEFAULT_SIZE;
  const fetchImpl=options.fetchImpl||globalThis.fetch;
  const maxSourceBytes=clampInt(options.maxSourceBytes??process.env.KELO_SPRITE_AI_MAX_SOURCE_BYTES,256*1024,12*1024*1024,6*1024*1024);
  if(typeof fetchImpl!=='function')throw new Error('SPRITE_AI_FETCH_REQUIRED');
  const status=()=>Object.freeze({configured:Boolean(apiKey),provider:'openai',model,quality,size,outputFormat:'png',background:'transparent',directions:8,framesPerDirection:4,maxSourceBytes});
  async function parseResponse(res){
    const text=await res.text();let data=null;try{data=text?JSON.parse(text):null;}catch{}
    if(!res.ok){const upstreamCode=short(data?.error?.code||data?.error?.type||`HTTP_${res.status}`,80);throw serviceError('SPRITE_AI_UPSTREAM_ERROR',res.status===429?429:502,upstreamCode);}
    const b64=data?.data?.[0]?.b64_json;if(!b64||typeof b64!=='string')throw serviceError('SPRITE_AI_NO_IMAGE_RETURNED',502);
    return{imageDataUrl:`data:image/png;base64,${b64}`,usage:data?.usage||null};
  }
  async function generate(input={}){
    if(!apiKey)throw serviceError('SPRITE_AI_NOT_CONFIGURED',503);
    const source=parseImageDataUrl(input.sourceImageDataUrl,maxSourceBytes),prompt=buildPrompt(input),headers={Authorization:`Bearer ${apiKey}`};let res;
    if(source){
      const form=new FormData();form.append('model',model);form.append('prompt',prompt);form.append('size',size);form.append('quality',quality);form.append('background','transparent');form.append('output_format','png');form.append('image[]',new Blob([source.bytes],{type:source.mime}),`source.${source.ext}`);
      res=await fetchImpl('https://api.openai.com/v1/images/edits',{method:'POST',headers,body:form});
    }else{
      res=await fetchImpl('https://api.openai.com/v1/images/generations',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({model,prompt,size,quality,background:'transparent',output_format:'png'})});
    }
    const out=await parseResponse(res);return{ok:true,...out,provider:'openai',model,size,quality,sourceMode:source?'reference-edit':'text-generation',layout:{columns:4,rows:8,directions:DEFAULT_DIRECTIONS,framesPerDirection:4},generatedAt:Date.now()};
  }
  return Object.freeze({version:'kelo-sprite-ai-service-v1',status,generate,buildPrompt});
}

module.exports={createSpriteAiService,buildPrompt,parseImageDataUrl,serviceError,DEFAULT_DIRECTIONS};
