/* KELO-INDEX
 * area: CREATORS / SESSION TRANSPORT CONTRACT
 * owner: SessionTransport interface contract
 * owns: shape validation only
 * does-not-own: networking, peers, command sequencing, persistence or gameplay authority
 * reused-by: LoopbackSessionTransport and future remote transports
 */
const REQUIRED=Object.freeze(['connect','disconnect','sendReliable','sendEphemeral','onReliable','onEphemeral']);
export function assertSessionTransport(transport){
  if(!transport||typeof transport!=='object')throw new Error('CREATOR_SESSION_TRANSPORT_REQUIRED');
  for(const name of REQUIRED)if(typeof transport[name]!=='function')throw new Error(`CREATOR_SESSION_TRANSPORT_INVALID:${name}`);
  return transport;
}
export const CREATOR_TRANSPORT_SEMANTICS=Object.freeze({
  reliable:Object.freeze(['command','save','graph-mutation','timeline-mutation','terrain','properties']),
  ephemeral:Object.freeze(['cursor','selection','drag-ghost','camera','presence','preview-transform'])
});
