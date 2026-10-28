import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync('index.html','utf8');
const css=readFileSync('adventure.css','utf8');
const sw=readFileSync('sw.js','utf8');
assert.match(html,/<link rel="stylesheet" href="\.\/adventure\.css"/);
assert.match(html,/function hero\(\)/);
assert.match(html,/function dailyTrail\(\)/);
assert.match(html,/function todayView\(\)/);
assert.match(html,/function questCard\(t,main=false\)/);
assert.match(html,/id="adventure-quick-form"/);
assert.match(html,/data-action="adventure-begin"/);
assert.match(html,/saveProgress\(t,'doing',''\)/);
assert.match(html,/if\(e\.target\?\.id==='adventure-quick-form'\)/);
assert.match(css,/\.home-hero/);
assert.match(css,/\.adventure-quick/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(sw,/adventure\.css/);
assert.match(sw,/gaming-life-shell-v5/);
assert.match(html,/const DEFAULT_TASKS=\[\]/);
assert.doesNotMatch(html,/const PERSONAL_STARTER_PACK/);
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1].trim()).filter(Boolean);
for(const js of scripts)new vm.Script(js,{filename:'index.inline.js'});

// Render the home screen from simulated private state. No real user data is involved.
const extract=(a,b)=>{
 const begin=html.indexOf(a),end=html.indexOf(b,begin+a.length);
 assert(begin>=0&&end>begin,'missing section: '+a);
 return html.slice(begin,end);
};
const quests=[],events=[],state={
 tasks:quests,events,mainId:null,sideChoice:{},equippedTitle:'',
 storylines:[],milestones:{},redemptions:[],rewards:[],questProgress:{}
};
const ctx=vm.createContext({
 state, getMain:()=>quests.find(t=>t.kind==='main'&&!events.some(e=>e.taskId===t.id&&t.repeat==='once'))||null,
 currentSides:()=>quests.filter(t=>t.kind==='side').slice(0,2),
 secondaryMain:()=>null, dailyEvents:()=>events.filter(e=>e.date==='2026-10-27'),
 today:()=> '2026-10-27',dateOffset:d=>'2026-10-'+String(27+d).padStart(2,'0'),
 humanDate:s=>s, taskCompleted:t=>events.some(e=>e.taskId===t.id),
 progressFor:t=>state.questProgress[t.id]||{status:'todo',note:''},
 questStatus:t=>events.some(e=>e.taskId===t.id)?'done':(state.questProgress[t.id]?.status||'todo'),
 statusLabel:s=>({todo:'未开始',doing:'进行中',review:'待确认',done:'已完成'})[s],
 taskStory:()=>null, chapterFor:()=>null, missionCount:()=>0, missionGoal:()=>1,missionRatio:()=>0,
 coinsForTask:t=>t.coins??10,areaInfo:()=>[null,null,'📚'],
 levelInfo:()=>({level:1,earned:25,need:100,pct:25}),
 totalXP:()=>25,coinBalance:()=>12,safe:x=>String(x),rewardTeaser:()=>'<div class="reward-teaser">奖励</div>'
});
vm.runInContext(extract('function dailyTrail()','function getMain()'),ctx);
vm.runInContext(extract('function questCard(t,main=false)','function journeyView()'),ctx);
let home=ctx.todayView();
assert.match(home,/给自己发布一个小任务/);
assert.match(home,/adventure-quick-form/);
assert.match(home,/第一项任务/); // empty state should invite action
assert.equal(state.tasks.length,0,'render must not silently add private tasks');
quests.push({id:'quest-1',title:'测试任务',detail:'可验证',kind:'main',area:'learning',repeat:'once',xp:20,coins:10,active:true});
state.mainId='quest-1';
home=ctx.todayView();
assert.match(home,/测试任务/);
assert.match(home,/data-action="adventure-begin"/);
assert.match(home,/data-action="complete"/);
assert.doesNotMatch(home,/id="adventure-quick-form"/);
state.questProgress['quest-1']={status:'doing',note:'已经推进一小步'};
home=ctx.todayView();
assert.match(home,/更新进度/);
assert.match(home,/已经推进一小步/);
assert.equal(events.length,0,'starting or rendering never grants XP');
events.push({taskId:'quest-1',date:'2026-10-27',xp:20});
home=ctx.todayView();
assert.match(home,/冒险足迹/);
assert.equal(events.length,1,'render must not mutate completion events');
console.log('Gaming Life V1.9 playable home, onboarding, progress and offline shell: PASS');
