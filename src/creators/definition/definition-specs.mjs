/* KELO-INDEX
 * area: CREATORS / DEFINITION ENGINE
 * owner: generic no-code Creator definition contracts
 * owns: schemas, defaults, prompt interpretation and draft validation for definition workspaces
 * does-not-own: DOM, persistence, gameplay runtime, publish authority or network transport
 * reuse: Parcel/Dungeon/Game Mode/NPC/Quest/Item/Crafting/Cinematic/Prefab/Environment/Audio
 */

const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const finite=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
const slug=value=>String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const field=(key,label,type='text',options={})=>Object.freeze({key,label,type,...options});
const option=(value,label=value,keywords=[])=>Object.freeze({value,label,keywords:Object.freeze([value,label,...keywords].map(slug).filter(Boolean))});

export const DEFINITION_SPECS=Object.freeze({
  PARCEL:Object.freeze({
    label:'Parcel',icon:'▦',category:'build',subtitle:'Define a buildable land parcel without code.',
    fields:Object.freeze([
      field('biome','Biome','select',{default:'plaza',options:[option('plaza','Plaza',['city','urbano']),option('forest','Forest',['bosque']),option('desert','Desert',['desierto']),option('snow','Snow',['nieve']),option('coast','Coast',['costa','playa'])]}),
      field('width','Width','number',{default:12,min:2,max:128,step:1,unit:'tiles',patterns:['width','ancho']}),
      field('height','Height','number',{default:12,min:2,max:128,step:1,unit:'tiles',patterns:['height','alto','altura']}),
      field('access','Access','select',{default:'private',options:[option('private','Private',['privado']),option('friends','Friends',['amigos']),option('public','Public',['publico']),option('guild','Guild',['clan','gremio'])]}),
      field('buildBudget','Build budget','number',{default:100,min:1,max:5000,step:1,patterns:['budget','presupuesto','objetos','objects']}),
      field('notes','Rules / notes','textarea',{default:'',placeholder:'What can be built here?'})
    ])
  }),
  DUNGEON:Object.freeze({
    label:'Dungeon',icon:'♜',category:'build',subtitle:'Shape a dungeon loop, rooms, boss and difficulty.',
    fields:Object.freeze([
      field('theme','Theme','select',{default:'ruins',options:[option('ruins','Ancient ruins',['ruinas']),option('crypt','Crypt',['cripta']),option('cave','Cave',['cueva']),option('fortress','Fortress',['fortaleza']),option('void','Void',['vacio','shadow','sombra'])]}),
      field('difficulty','Difficulty','select',{default:'normal',options:[option('easy','Easy',['facil']),option('normal','Normal'),option('hard','Hard',['dificil']),option('nightmare','Nightmare',['pesadilla'])]}),
      field('recommendedLevel','Recommended level','number',{default:10,min:1,max:999,step:1,patterns:['level','nivel']}),
      field('rooms','Rooms','number',{default:8,min:1,max:100,step:1,patterns:['rooms','habitaciones','salas']}),
      field('boss','Boss','text',{default:'',placeholder:'Boss name or concept'}),
      field('loop','Run loop','textarea',{default:'Explore → fight → reward → boss',placeholder:'Describe the player loop'})
    ])
  }),
  GAME_MODE:Object.freeze({
    label:'Game Mode',icon:'◆',category:'build',subtitle:'Define rules, teams, scoring and match pacing.',
    fields:Object.freeze([
      field('mode','Mode','select',{default:'pvp',options:[option('pvp','PvP',['arena']),option('pve','PvE'),option('coop','Co-op',['cooperative','cooperativo']),option('race','Race',['carrera']),option('survival','Survival',['supervivencia'])]}),
      field('objective','Objective','textarea',{default:'Defeat the opposing side.',placeholder:'What must players do to win?'}),
      field('maxPlayers','Max players','number',{default:8,min:1,max:500,step:1,patterns:['players','jugadores','player']}),
      field('durationMinutes','Duration','number',{default:10,min:1,max:180,step:1,unit:'min',patterns:['minutes','minutos','duration','duracion']}),
      field('scoring','Scoring','select',{default:'points',options:[option('points','Points',['puntos']),option('last_alive','Last alive',['ultimo vivo']),option('objective','Objective',['objetivo']),option('time','Best time',['tiempo'])]}),
      field('teams','Teams','number',{default:2,min:1,max:20,step:1,patterns:['teams','equipos']})
    ])
  }),
  NPC:Object.freeze({
    label:'NPC',icon:'♟',category:'gameplay',subtitle:'Create behavior, faction and dialogue from one prompt.',
    fields:Object.freeze([
      field('role','Role','select',{default:'villager',options:[option('villager','Villager',['aldeano']),option('merchant','Merchant',['comerciante','vendedor']),option('guard','Guard',['guardia']),option('enemy','Enemy',['enemigo','hostile','hostil']),option('quest_giver','Quest giver',['mision','quest'])]}),
      field('faction','Faction','text',{default:'neutral',placeholder:'neutral / city / guild / enemy'}),
      field('behavior','Behavior','select',{default:'idle',options:[option('idle','Idle',['quieto']),option('patrol','Patrol',['patrulla']),option('wander','Wander',['caminar','deambular']),option('follow','Follow',['seguir']),option('aggressive','Aggressive',['agresivo','attack','atacar'])]}),
      field('interactionRadius','Interaction radius','number',{default:96,min:16,max:1024,step:8,unit:'px',patterns:['radius','radio','distancia']}),
      field('dialogue','Opening dialogue','textarea',{default:'Hello, traveler.',placeholder:'First line the NPC says'}),
      field('shopOrReward','Shop / reward','text',{default:'',placeholder:'Optional shop, loot or reward'})
    ])
  }),
  QUEST:Object.freeze({
    label:'Quest / Dialogue',icon:'!',category:'gameplay',subtitle:'Define trigger, steps, reward and replay rules.',
    fields:Object.freeze([
      field('questType','Quest type','select',{default:'story',options:[option('story','Story',['historia']),option('daily','Daily',['diaria']),option('weekly','Weekly',['semanal']),option('event','Event',['evento']),option('tutorial','Tutorial')]}),
      field('objective','Objective','textarea',{default:'Complete the objective.',placeholder:'What must the player accomplish?'}),
      field('trigger','Trigger','text',{default:'talk_to_npc',placeholder:'talk_to_npc / enter_zone / item / event'}),
      field('steps','Steps','number',{default:3,min:1,max:50,step:1,patterns:['steps','pasos','etapas']}),
      field('reward','Reward','text',{default:'100 KC',placeholder:'KC, item, XP, unlock…'}),
      field('repeatable','Repeatable','toggle',{default:false,positive:['repeatable','repetible','daily','diaria'],negative:['one time','una vez','no repeat']})
    ])
  }),
  ITEM:Object.freeze({
    label:'Item',icon:'◇',category:'gameplay',subtitle:'Create inventory items, rarity, value and effects.',
    fields:Object.freeze([
      field('itemType','Item type','select',{default:'material',options:[option('material','Material',['recurso']),option('weapon','Weapon',['arma']),option('armor','Armor',['armadura']),option('consumable','Consumable',['consumible','pocion']),option('quest','Quest item',['mision'])]}),
      field('rarity','Rarity','select',{default:'common',options:[option('common','Common',['comun']),option('uncommon','Uncommon',['poco comun']),option('rare','Rare',['raro']),option('epic','Epic',['epico']),option('legendary','Legendary',['legendario'])]}),
      field('stackSize','Stack size','number',{default:20,min:1,max:9999,step:1,patterns:['stack','pila','cantidad']}),
      field('value','Base value','number',{default:10,min:0,max:100000000,step:1,unit:'KC',patterns:['value','valor','price','precio']}),
      field('effect','Effect','textarea',{default:'',placeholder:'Damage, heal, buff, key, crafting use…'}),
      field('tradable','Tradable','toggle',{default:true,positive:['tradable','trade','comerciable','vender'],negative:['soulbound','no trade','no comerciable']})
    ])
  }),
  CRAFTING:Object.freeze({
    label:'Crafting',icon:'⚒',category:'gameplay',subtitle:'Create recipes with station, ingredients and output.',
    fields:Object.freeze([
      field('station','Station','select',{default:'workbench',options:[option('workbench','Workbench',['mesa']),option('forge','Forge',['forja']),option('kitchen','Kitchen',['cocina']),option('alchemy','Alchemy',['alquimia']),option('field','Anywhere',['campo','anywhere'])]}),
      field('output','Output','text',{default:'',placeholder:'Item produced'}),
      field('outputAmount','Output amount','number',{default:1,min:1,max:9999,step:1,patterns:['output','produce','salida']}),
      field('ingredients','Ingredients','textarea',{default:'',placeholder:'iron: 3\nwood: 2'}),
      field('craftSeconds','Craft time','number',{default:3,min:0,max:86400,step:.5,unit:'s',patterns:['seconds','segundos','time','tiempo']}),
      field('successChance','Success chance','number',{default:100,min:1,max:100,step:1,unit:'%',patterns:['chance','probabilidad','success','exito']})
    ])
  }),
  CINEMATIC:Object.freeze({
    label:'Cinematic',icon:'▶',category:'visual',subtitle:'Block out camera pacing, trigger and skippability.',
    fields:Object.freeze([
      field('trigger','Trigger','text',{default:'enter_zone',placeholder:'enter_zone / quest / boss / login'}),
      field('durationSeconds','Duration','number',{default:8,min:.5,max:600,step:.5,unit:'s',patterns:['seconds','segundos','duration','duracion']}),
      field('cameraStyle','Camera style','select',{default:'follow',options:[option('follow','Follow',['seguir']),option('pan','Pan',['paneo']),option('orbit','Orbit',['orbita']),option('static','Static',['estatica']),option('sequence','Sequence',['secuencia'])]}),
      field('shots','Shots','number',{default:3,min:1,max:100,step:1,patterns:['shots','tomas','cameras','camaras']}),
      field('skippable','Skippable','toggle',{default:true,positive:['skippable','skip','saltar'],negative:['unskippable','no skip','no saltar']}),
      field('script','Beat sheet','textarea',{default:'Establish → reveal → action → return control',placeholder:'Describe each visual beat'})
    ])
  }),
  PREFAB:Object.freeze({
    label:'Prefab',icon:'▣',category:'content',subtitle:'Package reusable world compositions as data.',
    fields:Object.freeze([
      field('category','Category','select',{default:'architecture',options:[option('architecture','Architecture',['arquitectura']),option('nature','Nature',['naturaleza']),option('decor','Decor',['decoracion']),option('gameplay','Gameplay'),option('fx','FX',['efecto'])]}),
      field('width','Width','number',{default:64,min:1,max:4096,step:1,unit:'px',patterns:['width','ancho']}),
      field('height','Height','number',{default:64,min:1,max:4096,step:1,unit:'px',patterns:['height','alto','altura']}),
      field('anchor','Anchor','select',{default:'bottom_center',options:[option('bottom_center','Bottom center',['centro abajo']),option('center','Center',['centro']),option('top_left','Top left',['arriba izquierda'])]}),
      field('collision','Collision','select',{default:'auto',options:[option('auto','Auto'),option('none','None',['ninguna']),option('box','Box',['caja']),option('custom','Custom',['personalizada'])]}),
      field('tags','Tags','text',{default:'',placeholder:'market, city, shop…'})
    ])
  }),
  ENVIRONMENT:Object.freeze({
    label:'Environment',icon:'☼',category:'content',subtitle:'Tune biome mood, weather, time and ambient density.',
    fields:Object.freeze([
      field('biome','Biome','select',{default:'plaza',options:[option('plaza','Plaza',['city']),option('forest','Forest',['bosque']),option('swamp','Swamp',['pantano']),option('desert','Desert',['desierto']),option('snow','Snow',['nieve']),option('coast','Coast',['costa'])]}),
      field('weather','Weather','select',{default:'clear',options:[option('clear','Clear',['despejado']),option('rain','Rain',['lluvia']),option('fog','Fog',['niebla']),option('storm','Storm',['tormenta']),option('snow','Snow',['nieve'])]}),
      field('timeOfDay','Time of day','select',{default:'day',options:[option('dawn','Dawn',['amanecer']),option('day','Day',['dia']),option('sunset','Sunset',['atardecer']),option('night','Night',['noche'])]}),
      field('ambientDensity','Ambient density','number',{default:50,min:0,max:100,step:1,unit:'%',patterns:['density','densidad','ambient']}),
      field('musicMood','Music mood','text',{default:'calm',placeholder:'calm / tense / magical / urban…'}),
      field('notes','Visual direction','textarea',{default:'',placeholder:'Landmarks, palette, movement, atmosphere…'})
    ])
  }),
  AUDIO:Object.freeze({
    label:'Audio',icon:'♫',category:'content',subtitle:'Define music/SFX behavior and trigger rules.',
    fields:Object.freeze([
      field('audioType','Audio type','select',{default:'sfx',options:[option('sfx','SFX',['sound','sonido']),option('music','Music',['musica']),option('ambient','Ambient',['ambiente']),option('voice','Voice',['voz'])]}),
      field('trigger','Trigger','text',{default:'manual',placeholder:'impact / enter_zone / interact / manual'}),
      field('volume','Volume','number',{default:80,min:0,max:100,step:1,unit:'%',patterns:['volume','volumen']}),
      field('range','Range','number',{default:320,min:0,max:5000,step:16,unit:'px',patterns:['range','rango','distancia']}),
      field('loop','Loop','toggle',{default:false,positive:['loop','bucle','repetir'],negative:['one shot','una vez','no loop']}),
      field('source','Source / asset key','text',{default:'',placeholder:'asset key or URL'})
    ])
  })
});

export const DEFINITION_WORKSPACE_ROWS=Object.freeze([
  Object.freeze({id:'parcel',type:'PARCEL'}),Object.freeze({id:'dungeon',type:'DUNGEON'}),Object.freeze({id:'game-mode',type:'GAME_MODE'}),
  Object.freeze({id:'npc',type:'NPC'}),Object.freeze({id:'quest',type:'QUEST'}),Object.freeze({id:'item',type:'ITEM'}),Object.freeze({id:'crafting',type:'CRAFTING'}),
  Object.freeze({id:'cinematic',type:'CINEMATIC'}),Object.freeze({id:'prefab',type:'PREFAB'}),Object.freeze({id:'environment',type:'ENVIRONMENT'}),Object.freeze({id:'audio',type:'AUDIO'})
]);

export function getDefinitionSpec(type){const key=String(type||'').toUpperCase();const spec=DEFINITION_SPECS[key];if(!spec)throw new Error(`CREATOR_DEFINITION_TYPE_UNSUPPORTED:${key}`);return spec;}

export function createDefinitionDraft(type,input={}){
  const key=String(type||'').toUpperCase(),spec=getDefinitionSpec(key),rawFields=input?.fields&&typeof input.fields==='object'?input.fields:{};
  const fields={};
  for(const f of spec.fields){
    let value=rawFields[f.key];if(value==null)value=f.default;
    if(f.type==='number')value=clamp(finite(value,finite(f.default,0)),finite(f.min,-Number.MAX_SAFE_INTEGER),finite(f.max,Number.MAX_SAFE_INTEGER));
    else if(f.type==='toggle')value=!!value;
    else if(f.type==='select'){const allowed=new Set((f.options||[]).map(o=>o.value));value=allowed.has(String(value))?String(value):String(f.default??f.options?.[0]?.value??'');}
    else value=String(value??'');
    fields[f.key]=value;
  }
  return Object.freeze({
    version:'kelo-creator-definition-v1',type:key,name:String(input?.name||spec.label).trim()||spec.label,description:String(input?.description||''),prompt:String(input?.prompt||''),
    fields:Object.freeze(fields),referenceImage:typeof input?.referenceImage==='string'?input.referenceImage:'',referenceImageName:String(input?.referenceImageName||''),
    promptAppliedAt:Number(input?.promptAppliedAt)||0,updatedAt:Number(input?.updatedAt)||Date.now()
  });
}

function extractNumber(text,patterns=[]){
  for(const raw of patterns){const p=slug(raw).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const a=new RegExp(`${p}\\s*(?:de|of|=|:)?\\s*(\\d+(?:[.,]\\d+)?)`,'i').exec(text),b=new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:${p})`,'i').exec(text),m=a||b;if(m)return Number(String(m[1]).replace(',','.'));}
  return null;
}
function extractQuotedName(prompt){const m=/(?:called|named|nombre|llamad[oa])\s*["“']([^"”']{2,80})["”']/i.exec(prompt)||/["“']([^"”']{2,80})["”']/.exec(prompt);return m?.[1]?.trim()||'';}

export function interpretDefinitionPrompt(type,prompt,current={}){
  const key=String(type||'').toUpperCase(),spec=getDefinitionSpec(key),base=createDefinitionDraft(key,current),raw=String(prompt||'').trim(),text=slug(raw),next={...base,fields:{...base.fields},prompt:raw,promptAppliedAt:Date.now(),updatedAt:Date.now()};
  const quoted=extractQuotedName(raw);if(quoted)next.name=quoted;
  for(const f of spec.fields){
    if(f.type==='select'){
      let best=null,bestLen=-1;for(const o of f.options||[])for(const kw of o.keywords||[]){if(kw&&text.includes(kw)&&kw.length>bestLen){best=o.value;bestLen=kw.length;}}if(best!=null)next.fields[f.key]=best;
    }else if(f.type==='toggle'){
      const positive=(f.positive||[]).map(slug).some(k=>k&&text.includes(k)),negative=(f.negative||[]).map(slug).some(k=>k&&text.includes(k));if(positive&&!negative)next.fields[f.key]=true;else if(negative)next.fields[f.key]=false;
    }else if(f.type==='number'){
      const n=extractNumber(text,[...(f.patterns||[]),f.label,f.key]);if(n!=null&&Number.isFinite(n))next.fields[f.key]=clamp(n,finite(f.min,-Number.MAX_SAFE_INTEGER),finite(f.max,Number.MAX_SAFE_INTEGER));
    }
  }
  if(key==='NPC'){
    const q=/(?:dice|says|dialogue|dialogo)\s*[:=-]\s*["“']?([^"”'\n]{2,180})/i.exec(raw);if(q)next.fields.dialogue=q[1].trim();
  }else if(key==='ITEM'){
    const effect=/(?:effect|efecto)\s*[:=-]\s*([^\n]{2,180})/i.exec(raw);if(effect)next.fields.effect=effect[1].trim();
  }else if(key==='QUEST'){
    const reward=/(?:reward|recompensa)\s*[:=-]\s*([^,;\n]{1,100})/i.exec(raw);if(reward)next.fields.reward=reward[1].trim();
  }else if(key==='CRAFTING'){
    const output=/(?:create|creates|produce|produces|crear|crea|produce)\s+([^,;\n]{2,80})/i.exec(raw);if(output)next.fields.output=output[1].trim();
  }else if(key==='DUNGEON'){
    const boss=/(?:boss|jefe)\s*[:=-]?\s*["“']?([^,"”'\n]{2,80})/i.exec(raw);if(boss)next.fields.boss=boss[1].trim();
  }
  if(raw&&!next.description)next.description=raw.slice(0,240);
  return createDefinitionDraft(key,next);
}

export function validateDefinitionDraft(type,draft={}){
  const key=String(type||draft?.type||'').toUpperCase(),spec=getDefinitionSpec(key),value=createDefinitionDraft(key,draft),errors=[],warnings=[];
  if(!value.name.trim())errors.push('Name is required.');
  for(const f of spec.fields){const v=value.fields[f.key];if(f.required&&(v==null||String(v).trim()===''))errors.push(`${f.label} is required.`);if(f.type==='number'&&!Number.isFinite(Number(v)))errors.push(`${f.label} must be a number.`);}
  if(!value.prompt.trim())warnings.push('Add a prompt if you want one-click intent parsing.');
  if(!value.referenceImage)warnings.push('Reference image is optional but helps communicate visual intent.');
  return Object.freeze({ok:errors.length===0,errors:Object.freeze(errors),warnings:Object.freeze(warnings),draft:value});
}

export function summarizeDefinitionDraft(type,draft={}){
  const spec=getDefinitionSpec(type),value=createDefinitionDraft(type,draft),summary=[];
  for(const f of spec.fields.slice(0,5)){let v=value.fields[f.key];if(f.type==='select')v=f.options?.find(o=>o.value===v)?.label||v;if(f.type==='toggle')v=v?'Yes':'No';summary.push(Object.freeze({key:f.key,label:f.label,value:`${v}${f.unit||''}`}));}
  return Object.freeze(summary);
}
