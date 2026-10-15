import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync('index.html','utf8');
const cloud=readFileSync('cloud.js','utf8');
for(const js of [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1].trim()).filter(Boolean))
  new vm.Script(js,{filename:'index.inline.js'});
new vm.Script(cloud,{filename:'cloud.js'});
assert.match(html,/const DEFAULT_TASKS=\[\]/);
assert.match(html,/const STORY_PRESETS=\[\]/);
assert.doesNotMatch(html,/const CAREER_SPRINT_PACK|const PERSONAL_STARTER_PACK/);

const extract=(first,next)=>{
 const start=html.indexOf(first),end=html.indexOf(next,start+first.length);
 assert(start>=0&&end>start,'Missing code section: '+first);
 return html.slice(start,end);
};

const base={
 version:1,storylines:[],storylineWins:{},excusedDays:{},notes:[],events:[],milestones:{},
 questProgress:{},progressHistory:[],redemptions:[],rewards:[],rewardEconomyVersion:2,
 tasks:[{id:'original-task',packKey:'personal-alpha:step-1',title:'私人步骤',detail:'可验收',kind:'main',area:'learning',repeat:'daily',xp:25,coins:12,
   storylineId:null,chapterId:null,targetCount:3,sourceLabel:'任务包：私人样例',publishedAt:'2026-10-09T10:00:00Z'}],
 mainId:'original-task',privatePacksVersion:undefined,
};
const ctx=vm.createContext({
 DEFAULT:()=>({version:1,tasks:[],storylines:[],privatePacks:[],events:[],notes:[],
  milestoneWins:{},milestones:{},redemptions:[],rewards:[],rewardEconomyVersion:2}),
 DEFAULT_TASKS:[],DEFAULT_REWARDS:[],STORY_PRESETS:[],LEGACY_STORY_STEPS:{},
 structuredClone,AREAS:[['learning'],['career'],['social'],['health'],['finance'],['explore']],
});
vm.runInContext(extract('function recoverPrivatePacks(old)','function load()'),ctx);
const rebuilt=ctx.migrate(base);
assert.equal(rebuilt.tasks.length,1);
assert.equal(rebuilt.events.length,0);
assert.equal(rebuilt.privatePacksVersion,1);
assert.equal(rebuilt.privatePacks.length,1);
assert.equal(rebuilt.privatePacks[0].packId,'personal-alpha');
assert.equal(rebuilt.privatePacks[0].payload.quests[0].id,'step-1');
assert.equal(rebuilt.privatePacks[0].payload.quests[0].targetCount,3);
assert.equal(rebuilt.privatePacks[0].createdAt,'2026-10-09T10:00:00Z');
assert.equal(rebuilt.tasks[0].publishedAt,'2026-10-09T10:00:00Z');
const withoutPack={...rebuilt,privatePacks:[],privatePacksVersion:1};
assert.equal(ctx.migrate(withoutPack).privatePacks.length,0,'removal from library must persist across page reload');
const withXP={...rebuilt,events:[{id:'e1',taskId:'original-task',xp:25,coins:12,date:'2026-10-10'}],
  legacyCoinCredit:14,milestones:{old1:{xp:50,coins:25,date:'2026-10-09',at:'2026-10-09T10:00:00Z'}}};
const again=ctx.migrate(withXP);
assert.equal(again.events[0].xp,25);
assert.equal(again.legacyCoinCredit,14);
assert.equal(again.milestones.old1.coins,25);

const imported={format:'gaming-life.quest-pack',version:1,packId:'example-test',title:'私人范例',focusId:'step',
 quests:[{id:'step',title:'完成一项成果',detail:'有记录',kind:'main',area:'learning',repeat:'daily',xp:30,coins:15,chapterId:null,targetCount:2}],
 storyline:null};
let nextId=0;
const store={tasks:[],privatePacks:[],storylines:[],sideChoice:{},events:[],milestones:{},mainId:null,secondaryMainId:null};
const simulation=vm.createContext({
 state:store,PACK_FORMAT:'gaming-life.quest-pack',validatedPack:null,modal:'pack',packKey:(p,id)=>p+':'+id,
 storyFor:id=>store.storylines.find(a=>a.id===id),taskById:id=>store.tasks.find(t=>t.id===id), 
 uid:()=> 'generated-'+(++nextId),coinsForTask:q=>q.coins??15,areaInfo:()=>['learning','Learning','📘'],
 save:()=>true,navigate:()=>{},notify:()=>{},today:()=> '2026-10-15'
});
vm.runInContext(extract('function importPack(pack){','function privatePackById(packId)'),simulation);
simulation.importPack(imported);
assert.equal(store.privatePacks.length,1);
assert.equal(store.tasks.length,1);
const origAt=store.tasks[0].publishedAt;
store.events.push({id:'completed',taskId:store.tasks[0].id,xp:30,coins:15});
simulation.importPack({...imported,quests:[{...imported.quests[0],title:'更新后的行动'}]});
assert.equal(store.privatePacks.length,1);
assert.equal(store.tasks.length,1);
assert.equal(store.tasks[0].title,'更新后的行动');
assert.equal(store.tasks[0].publishedAt,origAt);
assert.equal(store.events.length,1,'importing a private pack must not create or remove completed events');
assert.equal(store.privatePacks[0].payload.quests[0].title,'更新后的行动');
store.privatePacks=[];
assert.equal(store.tasks.length,1,'forgetting pack definition must not delete tasks');
assert.equal(store.events.length,1,'forgetting pack definition must not delete XP history');

console.log('V1.8 privacy, task provenance, migration, idempotent private packs, no-loss: PASS');
