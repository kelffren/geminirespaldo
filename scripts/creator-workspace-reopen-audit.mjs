// Focused regression: stale Creator sessions must never make the Hub disappear into a blank screen.
import assert from 'node:assert/strict';
import {createCreatorWorkspaceRegistry} from '../src/creators/core/workspace-registry.mjs';
import {createAvatarWorkspaceManifest} from '../src/creators/workspaces/avatar-workspace.mjs';
import {createSpriteAbilityWorkspaceManifest} from '../src/creators/workspaces/sprite-ability-workspace.mjs';

const registry=createCreatorWorkspaceRegistry();
let calls=0,closed=0;
registry.register({id:'test',label:'Test',category:'qa',projectTypes:['TEST'],availability:'active',isSessionAlive:s=>!!s?.root?.isConnected,async open(){calls++;return calls===1?{root:{isConnected:false},close(){closed++;}}:{root:{isConnected:true},close(){closed++;}};}});
const session=await registry.open('test');
assert.equal(calls,2,'stale session must reopen exactly once');
assert.equal(closed,1,'stale session must close before retry');
assert.equal(session.root.isConnected,true,'retry must return mounted session');

const avatarShell={isConnected:true};
const avatarRoot={document:{getElementById:id=>id==='kelo-avatar-quick'?avatarShell:null}};
const avatar=createAvatarWorkspaceManifest({loader:async()=>({openAvatarQuickImport:async()=>({shell:avatarShell})})});
assert.equal(avatar.isSessionAlive({shell:avatarShell},{root:avatarRoot}),true);
assert.equal(avatar.isSessionAlive({shell:{isConnected:false}},{root:avatarRoot}),false);

const title={textContent:'SPRITE ABILITY · Test'};
const spriteShell={isConnected:true,querySelector:sel=>sel==='.ksw-title'?title:null};
const spriteRoot={document:{getElementById:id=>id==='kelo-studio-workspace'?spriteShell:null}};
const sprite=createSpriteAbilityWorkspaceManifest({loader:async()=>({openSpriteAbilityBuilder:async()=>({projectId:'p1'})})});
assert.equal(sprite.isSessionAlive({projectId:'p1'},{root:spriteRoot}),true);
assert.equal(sprite.isSessionAlive({projectId:'p1'},{root:{document:{getElementById:()=>null}}}),false);

const broken=createCreatorWorkspaceRegistry();let brokenCalls=0;
broken.register({id:'broken',label:'Broken',category:'qa',projectTypes:['TEST'],availability:'active',isSessionAlive:()=>false,async open(){brokenCalls++;return{close(){}};}});
await assert.rejects(()=>broken.open('broken'),/CREATOR_WORKSPACE_MOUNT_FAILED:broken/);
assert.equal(brokenCalls,2,'permanent mount failure must retry once only');
console.log('CREATOR_WORKSPACE_REOPEN_AUDIT: PASS');
