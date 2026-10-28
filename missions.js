/* Gaming Life V2: deterministic client-side mission helpers.
 * There is no LLM or access to conversations here; only explicitly submitted text is parsed.
 * All personal text remains in the user's existing local / Supabase save.
 */
(function(root){
 'use strict';
 const DAYS={'日':0,'天':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6};
 const iso = d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 const dateOf=s=>new Date(s+'T12:00:00');
 function offset(day,n){const d=dateOf(day);d.setDate(d.getDate()+n);return iso(d)}
 function targetDay(phrase,day){
  if(phrase==='今天')return day;
  if(phrase==='明天')return offset(day,1);
  if(phrase==='后天')return offset(day,2);
  if(/^\d{4}-\d{2}-\d{2}$/.test(phrase)){
   const d=dateOf(phrase);return !Number.isNaN(d.getTime())&&iso(d)===phrase?phrase:null;
  }
  const month=phrase.match(/^(\d{1,2})月(\d{1,2})日$/);
  if(month){
   const base=dateOf(day),year=base.getFullYear();let d=new Date(year,Number(month[1])-1,Number(month[2]),12);
   if(d.getMonth()!==Number(month[1])-1||d.getDate()!==Number(month[2]))return null;
   if(iso(d)<day)d=new Date(year+1,Number(month[1])-1,Number(month[2]),12);
   return iso(d);
  }
  const week=phrase.match(/^(下周|周)([一二三四五六日天])$/);
  if(week){
   const n=DAYS[week[2]],from=dateOf(day).getDay();
   let ahead=(n-from+7)%7;
   if(week[1]==='下周')ahead+=ahead===0?7:7; // always next occurrence + seven days
   return offset(day,ahead);
  }
  return null;
 }
 const WHEN='(今天|明天|后天|下周[一二三四五六日天]|周[一二三四五六日天]|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}月\\d{1,2}日)';
 function parseDraft(text,day){
  const raw=String(text||'').trim().slice(0,160);
  if(!raw)throw Error('请输入一句要做的事');
  const readyRe=new RegExp(WHEN+'\\s*(开始|起|后再做)');
  const dueRe=new RegExp(WHEN+'\\s*(前|之前|截止|到期)');
  const ready=raw.match(readyRe),due=raw.match(dueRe);
  const triggerDate=ready?targetDay(ready[1],day):null;
  const dueDate=due?targetDay(due[1],day):null;
  let title=raw;
  if(ready&&triggerDate)title=title.replace(ready[0],'');
  if(due&&dueDate)title=title.replace(due[0],'');
  title=title.replace(/^[，,；;\s]+|[，,；;\s]+$/g,'').trim();
  if(!title)title=raw;
  title=title.slice(0,65);
  const area=/(健身|跑步|排球|训练|运动|睡眠|饮食|走路|拉伸)/.test(title)?'health':
    /(书|阅读|课程|学习|练习|英语|考试)/.test(title)?'learning':
    /(消费|记账|储蓄|预算|投资)/.test(title)?'finance':
    /(联系|聚会|约会|沟通|家人|朋友)/.test(title)?'social':
    /(电影|旅游|旅行|探索|游戏|展览|美食)/.test(title)?'explore':'career';
  return {title,area,triggerDate,dueDate,sourceText:raw};
 }
 function activation(task,tasks,events,day){
  if(task.triggerDate&&task.triggerDate>day)return {ready:false,reason:'⏳ '+task.triggerDate+' 解锁'};
  if(task.requiresTaskId){
   const dep=tasks.find(x=>x.id===task.requiresTaskId);
   if(!dep)return {ready:false,reason:'🔒 前置任务已不存在，请修改触发条件'};
   if(!events.some(e=>e.taskId===dep.id))return {ready:false,reason:'🔒 完成「'+dep.title+'」后解锁'};
  }
  return {ready:true,reason:task.dueDate?(task.dueDate<day?'⚠️ 已超过预定日期：':'🗓️ 目标日期：')+task.dueDate:'⚡ 随时可开始'};
 }
 function percent(task,progress,completed){
  if(completed)return 100;
  const n=Number(progress?.percent);
  return Number.isFinite(n)?Math.max(0,Math.min(99,Math.round(n))):0;
 }
 function dedupeKey(s){return String(s||'').replace(/[\s，。,.!?！？:：;；\-]/g,'').toLowerCase()}
 root.GamingLifeMissions={offset,targetDay,parseDraft,activation,percent,dedupeKey};
})(typeof window==='undefined'?globalThis:window);
