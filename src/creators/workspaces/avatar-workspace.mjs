/* KELO-INDEX
 * area: CREATORS / AVATAR WORKSPACE
 * owner: Avatar workspace manifest only
 * owns: lazy route into authoritative Frame Surgery, then optional 4x4 authoring extension
 * does-not-own: rendering, upload transport, compiler authority or character persistence
 */
export function createAvatarWorkspaceManifest({loader=()=>import('../ui/avatar-frame-surgery-workspace.mjs'),authoringLoader=()=>import('../ui/avatar-authoring-workspace.mjs')}={}){return Object.freeze({id:'avatar',label:'Avatar',category:'visual',projectTypes:['CHARACTER'],capability:null,availability:'active',isSessionAlive(session,{root=globalThis}={}){const shell=session?.shell;return !!(shell?.isConnected&&root.document?.getElementById?.('kelo-avatar-quick')===shell);},async open(context={}){const mod=await loader();if(typeof mod.openAvatarQuickImport!=='function')throw new Error('CREATOR_AVATAR_ENTRY_MISSING');const session=await mod.openAvatarQuickImport(context);try{const authoring=await authoringLoader();return typeof authoring.attachFrameBuilderToSurgery==='function'?authoring.attachFrameBuilderToSurgery({...context,session}):session;}catch(error){context?.root?.console?.warn?.('AVATAR_FRAME_BUILDER_EXTENSION_UNAVAILABLE',error);return session;}}});}
export function registerAvatarWorkspace(registry,options={}){return registry.register(createAvatarWorkspaceManifest(options));}
