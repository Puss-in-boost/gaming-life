import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const html=readFileSync('index.html','utf8'),cloud=readFileSync('cloud.js','utf8');
for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)){if(m[1].trim())new vm.Script(m[1])}
new vm.Script(cloud);
assert.match(html,/function domainGrowth/);assert.match(html,/function idleStats/);assert.match(html,/已保存公开密钥/);
assert.match(cloud,/hasPublicKey/);assert.match(cloud,/if\(!key&&configured\?\.url===url\)/);
const extract=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+a.length));
const context=vm.createContext({state:{adventureIdle:{enabled:true,lastActionOn:'2026-10-20'},tasks:[{id:'t'}]},today:()=> '2026-10-28'});
vm.runInContext(extract('function idleStats(','function honorStats()'),context);
assert.equal(context.idleStats().energy,80);
assert.equal(context.idleStats('2026-10-22').energy,100);
context.state.adventureIdle.lastActionOn='2026-10-01';assert.equal(context.idleStats().energy,60);
context.state.adventureIdle.enabled=false;assert.equal(context.idleStats().energy,100);
vm.runInContext(extract('function domainGrowth(','function historyView()'),context);
assert.equal(context.domainGrowth(0).percent,0);
assert.equal(context.domainGrowth(120).level,1);
assert(context.domainGrowth(120).percent<10);
assert.equal(context.domainGrowth(20000).percent,100);
console.log('V1.10 regression PASS');