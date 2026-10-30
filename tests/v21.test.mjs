import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync('index.html','utf8'),js=readFileSync('missions.js','utf8');
const ctx={};vm.runInNewContext(js,ctx);
const m=ctx.GamingLifeMissions;
const items=m.parseInbox('明天开始核对报告\n周五前提交测试结果','2026-10-30',[]);
assert.equal(items.length,2);
assert.equal(items[0].triggerDate,'2026-10-31');
assert.equal(items[0].kind,'side');
assert.equal(items[1].type,'task');
const one=[{id:'abc',title:'检查冷站模型',active:true}];
const json=JSON.stringify({format:'gaming-life.proposals',version:1,proposals:[
 {type:'task',title:'完成图表核验',kind:'side',area:'career',repeat:'once'},
 {type:'progress',taskTitle:'检查冷站模型',percent:40,note:'已经核对关键结果'}
]});
const out=m.parseInbox(json,'2026-10-30',one);
assert.equal(out.length,2);
assert.equal(out[1].taskId,'abc');
assert.equal(out[1].percent,40);
assert.throws(()=>m.parseInbox(JSON.stringify({format:'gaming-life.proposals',version:1,proposals:[{type:'progress',taskTitle:'检查冷站模型',percent:100,note:'完成'}]}),'2026-10-30',one),/0–99/);
assert.throws(()=>m.parseInbox(JSON.stringify({format:'gaming-life.proposals',version:1,proposals:[{type:'progress',taskTitle:'不存在',percent:10,note:'未匹配'}]}),'2026-10-30',one),/唯一匹配/);
assert.throws(()=>m.parseInbox(Array.from({length:17},(_,i)=>'任务'+i).join('\n'),'2026-10-30',[]),/任务名称|条建议/);
assert.match(html,/proposalInbox/);
assert.match(html,/private-inbox-form/);
assert.match(html,/inbox-approve/);
assert.match(html,/inbox-reject/);
assert.match(html,/saveProgress\(t,'doing',p.note,p.percent\)/);
assert.match(html,/function reentryView/);
for(const v of [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).filter(Boolean))new vm.Script(v);
new vm.Script(js);
console.log('V2.1 private inbox parser and UI PASS');
