/* KELO-INDEX
 * area: WORLD EDIT
 * keys: REMOTE AUTHORITY SERVER API WEBSOCKET TRANSPORT PLUG PLAY
 * hace: adapter remoto del contrato KELO_WORLD_EDIT; hoy queda sin backend obligatorio
 * online: al conectar transport.send(op,payload), sustituye LocalWorldEditAuthority sin tocar World Builder UI
 */
(function(){
'use strict';
if(window.RemoteWorldEditAuthority)return;

const VERSION='remote-world-edit-authority-v1.0.0';
class RemoteWorldEditAuthority{
  constructor(transport=null){
    this.source='remote';
    this.transport=transport;
  }
  installTransport(transport){
    if(transport&&typeof transport.send!=='function')throw new Error('INVALID_WORLD_EDIT_TRANSPORT');
    this.transport=transport||null;return this;
  }
  async request(op,payload={}){
    if(!this.transport||typeof this.transport.send!=='function')throw new Error('REMOTE_AUTHORITY_NOT_CONFIGURED');
    const result=await this.transport.send(String(op),payload||{});
    if(!result||result.ok===false){
      const code=result?.error?.code||result?.error||'REMOTE_WORLD_EDIT_FAILED';
      throw new Error(String(code));
    }
    return result.data!==undefined?result.data:result;
  }
}
window.RemoteWorldEditAuthority=RemoteWorldEditAuthority;
window.KELO_REMOTE_WORLD_EDIT_AUTHORITY_AUDIT=Object.freeze({
  version:VERSION,
  source:'remote',
  transportReplaceable:true,
  backendRequiredNow:false,
  sameRequestContract:true
});
})();
