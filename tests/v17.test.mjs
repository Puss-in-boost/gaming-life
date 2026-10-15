import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html=readFileSync('index.html','utf8');
const cloud=readFileSync('cloud.js','utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1].trim()).filter(Boolean);
assert(scripts.length>=2,'application inline scripts must exist');
for(const js of scripts)new vm.Script(js,{filename:'index.html:inline-script'});
new vm.Script(cloud,{filename:'cloud.js'});

function extract(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert(a>=0&&b>a,'source section missing: '+start);
 return html.slice(a,b);
}

const state={
 storylines:[{id:'arc',title:'示例冒险',goal:'达成最终目标',chapters:[{id:'resume',title:'第一步',goal:''},{id:'apply',title:'第二步',goal:''}]}],
 storylineWins:{},excusedDays:{},
 tasks:[
  {id:'resume',kind:'main',repeat:'once',storylineId:'arc',chapterId:'resume',targetCount:1,active:true,publishedAt:null,sourceLabel:'旧版任务'},
  {id:'apply',kind:'main',repeat:'daily',storylineId:'arc',chapterId:'apply',targetCount:3,active:true,strictDaily:true,strictSince:'2026-10-13',publishedAt:'2026-10-15T08:30:00Z',sourceLabel:'任务包：样例'},
 ],
 events:[
  {id:'r1',taskId:'resume',date:'2026-10-13'},
  {id:'a1',taskId:'apply',date:'2026-10-13'},
  {id:'a2',taskId:'apply',date:'2026-10-15'}
 ]
};
const ctx=vm.createContext({state,today:()=> '2026-10-15',humanDate:x=>x,safe:x=>String(x)});
vm.runInContext(extract('function storyFor(id)','function stateSnapshot()'),ctx);
const arc=ctx.storyFor('arc');
assert(arc&&ctx.chapterFor(state.tasks[0]).id==='resume');
assert.equal(ctx.missionCount(state.tasks[1]),2);
assert.equal(ctx.missionGoal(state.tasks[1]),3);
assert(Math.abs(ctx.chapterStats(arc,arc.chapters[1]).rate-2/3)<1e-7);
assert(Math.abs(ctx.storylineStats(arc).stageRate-5/6)<1e-7);
assert.equal(ctx.storylineStats(arc).finalReached,false);
assert(ctx.storylineStats(arc).rate<1,'goal must not be silently completed');
assert.match(ctx.questOrigin(state.tasks[0]),/发布日期未知/);
assert.match(ctx.questOrigin(state.tasks[1]),/2026-10-15/);
assert.deepEqual(Array.from(ctx.missedContractDays(state.tasks[1])),['2026-10-14']);
assert.equal(ctx.honorStats().value,96);
state.excusedDays['apply|2026-10-14']={reason:'就医',at:'2026-10-15T00:00:00Z'};
assert.equal(ctx.honorStats().value,100,'excused days must not incur penalty');
delete state.excusedDays['apply|2026-10-14'];
state.events.push({id:'a3',taskId:'apply',date:'2026-10-14'});
assert.equal(ctx.honorStats().value,100,'completed contract is not missed');
assert.equal(ctx.storylineStats(arc).stageRate,1);
assert(ctx.storylineStats(arc).rate<1,'stages cleared != verified final outcome');
state.storylineWins.arc={at:'2026-10-15T07:00:00Z'};
assert.equal(ctx.storylineStats(arc).rate,1);
state.tasks[1].strictDaily=false;
assert.equal(ctx.honorStats().value,100,'disabled duty cannot penalize');
assert(!html.includes('发放 XP 作为每日漏做惩罚'));

const packContext=vm.createContext({
 PACK_FORMAT:'gaming-life.quest-pack',
 AREAS:[['career'],['health'],['explore'],['learning'],['finance'],['social']]
});
vm.runInContext(extract('function checkPack(raw)','function packKey('),packContext);
const testPack={
 format:'gaming-life.quest-pack',version:1,packId:'test-pack',title:'分章测试',
 focusId:'first',
 storyline:{id:'arc-test',title:'长期目标',goal:'可验证的成功',chapters:[{id:'first-chapter',title:'开始',goal:'达成初始里程碑'}]},
 quests:[{id:'first',kind:'main',area:'career',repeat:'daily',title:'每天行动',xp:30,coins:15,chapterId:'first-chapter',targetCount:12}]
};
let parsed=packContext.checkPack(JSON.stringify(testPack));
assert.equal(parsed.quests[0].targetCount,12);
assert.equal(parsed.storyline.chapters[0].id,'first-chapter');
const oldPack=structuredClone(testPack);
delete oldPack.storyline;delete oldPack.quests[0].chapterId;delete oldPack.quests[0].targetCount;
parsed=packContext.checkPack(JSON.stringify(oldPack));
assert.equal(parsed.storyline,null);
assert.equal(parsed.quests[0].targetCount,null,'legacy import must not reset previous count');
assert.throws(()=>{const v=structuredClone(testPack);v.quests[0].chapterId='unknown';packContext.checkPack(JSON.stringify(v));},/chapterId/);
assert.throws(()=>{const v=structuredClone(testPack);v.quests[0].targetCount=101;packContext.checkPack(JSON.stringify(v));},/targetCount/);

const migrateCtx=vm.createContext({
 DEFAULT:()=>({version:1,tasks:[],events:[],milestones:{},rewards:[],redemptions:[],rewardEconomyVersion:2}),
 DEFAULT_TASKS:[],DEFAULT_REWARDS:[],
 STORY_PRESETS:structuredClone(state.storylines),LEGACY_STORY_STEPS:{legacy:['arc','apply',12]},
 structuredClone
});
vm.runInContext(extract('function migrate(v)','function load()'),migrateCtx);
const old={version:1,rewardEconomyVersion:2,privatePacksVersion:1,privatePacks:[],tasks:[{id:'legacy',title:'旧任务',kind:'main',repeat:'daily',xp:50}],events:[],notes:[]};
const migrated=migrateCtx.migrate(old);
assert.equal(migrated.tasks[0].publishedAt,null);
assert.equal(migrated.tasks[0].targetCount,12);
assert.equal(migrated.tasks[0].sourceLabel,'历史任务 · 首发日期未记录');
assert.equal(migrated.storylines.length,1);
assert.equal(migrated.storylineWins.arc,undefined);
assert.equal(migrated.excusedDays['legacy|2026-10-14'],undefined);
console.log('Gaming Life V1.7 syntax, chapters, goal, provenance, opt-in honor, legacy migration and quest pack contract: PASS');
