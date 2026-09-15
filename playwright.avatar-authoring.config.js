/* KELO-INDEX
 * area: QA / AVATAR AUTHORING 159+155
 * owner: mobile browser test configuration for unified Frame Surgery + 4x4 builder
 * keys: PLAYWRIGHT AVATAR WEBKIT CHROMIUM MOBILE
 */
const {defineConfig,devices}=require('@playwright/test');
module.exports=defineConfig({
  testDir:'./tests',
  testMatch:'avatar-authoring-159-155.spec.js',
  timeout:60000,
  retries:0,
  reporter:[['list'],['json',{outputFile:'playwright-avatar-authoring-report.json'}]],
  use:{trace:'retain-on-failure',screenshot:'only-on-failure',video:'off'},
  projects:[
    {name:'chromium-mobile',use:{...devices['Pixel 7']}},
    {name:'webkit-iphone',use:{...devices['iPhone 13']}}
  ]
});
