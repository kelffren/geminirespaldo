/* KELO-INDEX
 * area: CREATORS / SESSION TRANSPORT
 * owner: local loopback implementation of SessionTransport
 * owns: local reliable/ephemeral delivery semantics, command dedupe and revision guard
 * does-not-own: projects, gameplay simulation, WebRTC/WebSocket or LIVE authority
 * online: replace with WebRTCSessionTransport/remote transport without workspace changes
 */
import { assertSessionTransport } from './session-transport.mjs';
import { assertCreatorDataMessage } from './creator-command-envelope.mjs';
const clone=v=>v==null?v:(typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v)));
export function createLoopbackSessionTransport({peerId='local',currentRevision=null}={}){
  let connected=false,revision=currentRevision==null?null:String(currentRevision);const reliable=new Set(),ephemeral=new Set(),seenCommands=new Set();
  const requireConnected=()=>{if(!connected)throw new Error('CREATOR_TRANSPORT_NOT_CONNECTED');};
  function emit(listeners,message){const row=clone(message);for(const fn of [...listeners])fn(clone(row));}
  const transport={
    async connect(){connected=true;return {peerId:String(peerId)};},async disconnect(){connected=false;},
    async sendReliable(message){requireConnected();assertCreatorDataMessage(message);const id=message?.commandId==null?null:String(message.commandId);if(id&&seenCommands.has(id))return {delivered:false,duplicate:true};if(message?.baseRevision!=null&&revision!=null&&String(message.baseRevision)!==revision)throw new Error(`CREATOR_STALE_REVISION:${message.baseRevision}->${revision}`);if(id)seenCommands.add(id);emit(reliable,message);return {delivered:true,duplicate:false};},
    async sendEphemeral(message){requireConnected();assertCreatorDataMessage(message);emit(ephemeral,message);return {delivered:true};},
    onReliable(fn){reliable.add(fn);return()=>reliable.delete(fn);},onEphemeral(fn){ephemeral.add(fn);return()=>ephemeral.delete(fn);},
    setCurrentRevision(value){revision=value==null?null:String(value);},get currentRevision(){return revision;},get connected(){return connected;},get peers(){return connected?[String(peerId)]:[];}
  };
  return Object.freeze(assertSessionTransport(transport));
}
