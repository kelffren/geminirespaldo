/* KELO-INDEX
  area: UI / SOCIAL CHAT INTEGRATION
  owner: KeloChatIntegrationBridge
  keys: CHAT INPUT LOCK LUXE PREMIUM STATE
  purpose: sincroniza el bottom-sheet premium con el open/close del chat Luxe existente sin duplicar transporte
*/
(function(root){
'use strict';
if(root.__KELO_CHAT_INTEGRATION_BRIDGE_V2__)return;
root.__KELO_CHAT_INTEGRATION_BRIDGE_V2__=true;

var drawer=null;
var observer=null;
var bridgeLock=null;
var syncing=false;

function locks(){return root.KeloInputLocks||null;}
function acquire(){
  if(bridgeLock)return;
  var api=locks();
  if(api&&typeof api.acquire==='function')bridgeLock=api.acquire('kelo-chat-premium',{surface:'chat',source:'premium-bottom-sheet'});
}
function release(){
  var token=bridgeLock;
  bridgeLock=null;
  var api=locks();
  if(token&&api&&typeof api.release==='function')api.release(token);
}
function releaseExistingLuxeChatLock(){
  var luxe=root.KELO_LUXE;
  if(luxe&&typeof luxe.closeChat==='function')luxe.closeChat();
}
function syncFromDrawer(){
  if(syncing||!drawer||!root.KeloChatUI)return;
  var domOpen=drawer.classList.contains('open');
  var apiOpen=typeof root.KeloChatUI.isOpen==='function'?root.KeloChatUI.isOpen():domOpen;
  syncing=true;
  try{
    if(domOpen){
      acquire();
      if(!apiOpen&&typeof root.KeloChatUI.open==='function')root.KeloChatUI.open();
    }else{
      release();
      if(apiOpen&&typeof root.KeloChatUI.close==='function')root.KeloChatUI.close();
      // If Luxe opened the same real drawer, its original input-lock token must
      // also be released when the player collapses the sheet by drag/tap.
      releaseExistingLuxeChatLock();
    }
  }finally{syncing=false;}
}
function mount(){
  drawer=document.getElementById('lx-chat-drawer');
  if(!drawer||!root.KeloChatUI)return false;
  if(observer)observer.disconnect();
  observer=new MutationObserver(syncFromDrawer);
  observer.observe(drawer,{attributes:true,attributeFilter:['class']});
  syncFromDrawer();
  root.addEventListener('pagehide',function(){if(observer)observer.disconnect();release();releaseExistingLuxeChatLock();},{once:true});
  root.KeloChatIntegrationBridge=Object.freeze({sync:syncFromDrawer,version:'2.0.0'});
  return true;
}
function boot(){
  if(mount())return;
  var tries=0;
  var timer=setInterval(function(){tries+=1;if(mount()||tries>=80)clearInterval(timer);},100);
}
root.addEventListener('kelo:chat-ui-ready',function(){mount();},{once:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
