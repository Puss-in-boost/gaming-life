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

 // A private, manually pasted inbox. This parser never reaches ChatGPT or any external API.
 const VALID_AREAS=['career','learning','finance','social','health','explore'];
 function parseInbox(raw,day,tasks=[]){
  const value=String(raw||'').trim();
  if(!value||value.length>24000)throw Error('请粘贴1–16条建议，文本不能超过24KB');
  let source;
  if(value.startsWith('{')){
   let doc;try{doc=JSON.parse(value)}catch(e){throw Error('建议 JSON 格式不正确')}
   if(!doc||doc.format!=='gaming-life.proposals'||doc.version!==1||!Array.isArray(doc.proposals))throw Error('请使用 gaming-life.proposals v1 格式');
   source=doc.proposals;
  }else{
   source=value.split(/\r?\n/).map(x=>x.replace(/^\s*(?:[-*]|\d+[.)、])\s*/, '').trim()).filter(Boolean).map(x=>{
    const parsed=parseDraft(x,day);
    return {type:'task',...parsed};
   });
  }
  if(!source.length||source.length>16)throw Error('每次只能审核1–16条建议');
  return source.map((p,i)=>{
   if(!p||typeof p!=='object'||Array.isArray(p))throw Error('第'+(i+1)+'条建议格式不正确');
   if(p.type==='progress'){
    const label=String(p.taskTitle||'').trim(),id=String(p.taskId||'').trim();
    if(!label&&!id)throw Error('进度建议必须指定任务标题或任务ID');
    const matches=tasks.filter(t=>t.active!==false&&(id?t.id===id:dedupeKey(t.title)===dedupeKey(label)));
    if(matches.length!==1)throw Error('进度建议未能唯一匹配现有任务：'+(label||id).slice(0,65));
    if(!Number.isInteger(p.percent)||p.percent<0||p.percent>99)throw Error('进度只能是0–99%；真实完成请在游戏内单独确认');
    if(typeof p.note!=='string'||!p.note.trim()||p.note.length>240)throw Error('进度建议必须提供不超过240字的真实推进记录');
    return {type:'progress',taskId:matches[0].id,taskTitle:matches[0].title,percent:p.percent,note:p.note.trim()};
   }
   if(p.type!=='task')throw Error('仅支持 task 或 progress 类型');
   const title=String(p.title||'').trim();
   if(!title||title.length>65)throw Error('第'+(i+1)+'项任务名称应为1–65字');
   const detail=String(p.detail||'').trim();
   if(detail.length>250)throw Error('任务说明最长250字');
   const kind=p.kind??'side',repeat=p.repeat??'once',area=p.area??parseDraft(title,day).area;
   if(!['main','side'].includes(kind)||!['once','daily','weekly'].includes(repeat)||!VALID_AREAS.includes(area))throw Error('任务类型、周期或成长方向不合法');
   for(const date of [p.triggerDate,p.dueDate]){
    if(date!==undefined&&date!==null&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(new Date(date+'T12:00:00').getTime())||iso(new Date(date+'T12:00:00'))!==date))throw Error('触发或截止日期必须为有效的 YYYY-MM-DD');
   }
   return {type:'task',title,detail,kind,repeat,area,triggerDate:p.triggerDate||null,dueDate:p.dueDate||null};
  });
 }
 root.GamingLifeMissions={offset,targetDay,parseDraft,parseInbox,activation,percent,dedupeKey};
})(typeof window==='undefined'?globalThis:window);
