/* KELO-INDEX
 * area: TEST / MAP FORGE / VISUAL COMPOSITION
 * owner: Map Forge visual convergence CI
 * purpose: prevent regression of the approved central-fountain breathing room across later champion revisions
 * public-api: Playwright test
 * consumes: effective Map Forge recipe data
 * state-owned: none
 * do-not: no runtime mutation or alternate generator
 */
const {test,expect}=require('@playwright/test');

test('Royal Capital keeps the central fountain as a readable focal point',async()=>{
  const {getMapForgeRecipe}=await import('../src/world/map-forge/map-forge-recipes.mjs');
  const recipe=getMapForgeRecipe('KELO_ROYAL_CAPITAL_V1');
  const fountain=recipe.landmarks.find(item=>item.id==='fountain');
  expect(recipe.version).toMatch(/-evo\.\d+$/);
  expect(fountain).toBeTruthy();
  expect(fountain.keepClearRadius).toBe(210);
  expect(fountain.keepClearRadius).toBeGreaterThan(fountain.footprint.w/2);
});
