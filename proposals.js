/* Gaming Life V1.7 · AI proposal inbox. No automated ChatGPT transcript access.
 * All proposals are opt-in and all approvals require an explicit user action.
 * Only Supabase stores proposals. A reviewed proposal is applied atomically by SQL RPC.
 */
(function(root){
'use strict';
const EXAMPLE={
  format:'gaming-life.proposal',version:1,
  dedupeKey:'company-chiller-fixed-speed-model-20261014',
  kind:'create',title:'定频离心式冷水机性能公式研究',
  source:'2026-10-14 公司新项目对话 · 用户主动申请',
  payload:{
    title:'定频离心式冷水机性能公式研究',
    detail:'完成文献调研，核查现有PLR/COP公式口径，筛选非线性候选模型并形成第一版研究路线与数据需求；本阶段不开展TRNSYS仿真。',
    kind:'main',area:'career',repeat:'once',xp:50,coins:25
  }
};
const AREAS=['career','learning','finance','social','health','explore'];
const STATUS={pending:'待审核',approved:'已批准',rejected:'已拒绝'};
let items=[],phase='idle',message='',pendingJson=null;
let busy=false;
const cloud=()=>root.GamingLifeCloud;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function changed(){root.dispatchEvent(new Event('gaming-life-proposals-change'))}
function available(){const c=cloud()?.status();return !!(c?.signedIn&&c?.phase==='synced'&&c?.remoteRevision!==null&&navigator.onLine)}
function assertReady(){if(!available())throw Error('请先在「设置」登录 Supabase，确认云端状态为「已云端同步」并保持联网')}
function validate(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||input.format!=='gaming-life.proposal'||input.version!==1)throw Error('必须是 gaming-life.proposal / version 1 格式');
 const key=input.dedupeKey,kind=input.kind,title=input.title,source=input.source||'ChatGPT（用户主动提交）';
 if(typeof key!=='string'||! /^[a-zA-Z0-9_-]{3,100}$/.test(key))throw Error('dedupeKey 无效：只允许3–100个英文字符、数字、横线或下划线');
 if(!['create','progress'].includes(kind))throw Error('kind 只能是 create 或 progress');
 if(typeof title!=='string'||!title.trim()||title.length>90||typeof source!=='string'||!source.trim()||source.length>160)throw Error('申请标题或来源无效');
 const p=input.payload;
 if(!p||typeof p!=='object'||Array.isArray(p))throw Error('payload 必须是对象');
 if(kind==='create'){
  if(typeof p.title!=='string'||!p.title.trim()||p.title.length>65||typeof p.detail!=='string'||p.detail.length>250)throw Error('新任务标题或说明过长');
  if(!['main','side'].includes(p.kind)||!AREAS.includes(p.area)||!['once','daily','weekly'].includes(p.repeat))throw Error('新任务类别、领域或周期无效');
  if(!Number.isInteger(p.xp)||p.xp<5||p.xp>80||!Number.isInteger(p.coins)||p.coins<0||p.coins>80)throw Error('新任务奖励数值无效');
 }else{
  if(typeof p.targetTaskId!=='string'||!p.targetTaskId||p.targetTaskId.length>100||!['doing','review'].includes(p.status)||typeof p.note!=='string'||p.note.length>240)throw Error('进度更新需要有效任务ID、状态与说明');
 }
 return {format:'gaming-life.proposal',version:1,dedupeKey:key,kind,title:title.trim(),source:source.trim(),payload:p};
}
function hash(text){let h=2166136261;for(const c of text){h=Math.imul(h^c.charCodeAt(0),16777619)}return (h>>>0).toString(36)}
function toRow(p){return {user_id:cloud().proposalUserId(),dedupe_key:p.dedupeKey,kind:p.kind,title:p.title,source:p.source,payload:p.payload}}
async function refresh(){
 const c=cloud()?.status();
 if(!c?.signedIn){items=[];phase='idle';message='请先在设置中登录账号';changed();return}
 if(busy)return;
 busy=true;phase='loading';changed();
 try{
  const data=await cloud().proposalRequest('/rest/v1/gaming_life_task_proposals?select=id,dedupe_key,kind,title,source,payload,status,created_at,resolution&order=created_at.desc&limit=100',{headers:{Accept:'application/json'}});
  items=Array.isArray(data)?data:[];phase='ready';message='';
 }catch(e){phase='error';message='读取申请箱失败。请先按 docs/AI_PROPOSALS.md 执行 V1.7 SQL 迁移；若已迁移，请检查网络及登录状态。详情：'+e.message}
 finally{busy=false;changed()}
}
async function submitProposal(raw){
 assertReady();
 const p=validate(raw);
 if(busy)throw Error('申请箱正在操作，请稍后');
 if(items.some(x=>x.dedupe_key===p.dedupeKey))throw Error('该任务已有申请记录（含已审核记录），已阻止重复提交');
 busy=true;
 try{
  await cloud().proposalRequest('/rest/v1/gaming_life_task_proposals',{method:'POST',
   headers:{Prefer:'return=representation'},body:toRow(p)});
  message='申请已提交，尚未加入正式任务；请在下方审核';
 }catch(e){
  if(/23505|duplicate|409|unique/i.test(String(e.message))){
   message='发现相同去重键的历史申请，未重复创建';return;
  }
  throw e;
 }finally{busy=false}
 await refresh();
}
async function decide(id,action,resolution){
 assertReady();
 if(busy)throw Error('有其他申请操作尚未完成');
 const p=items.find(x=>x.id===id&&x.status==='pending');
 if(!p)throw Error('申请已处理或不存在，请刷新');
 const expected=cloud().status().remoteRevision;
 busy=true;changed();
 try{
  const result=await cloud().proposalRequest('/rest/v1/rpc/gaming_life_review_proposal',{
   method:'POST',body:{p_id:id,p_action:action,p_resolution:resolution,p_expected_revision:expected}});
  if(!result?.ok){
   const reason={stale_revision:'游戏存档已被其他设备更新，请先在「设置」同步，再重新审核',
    already_decided:'申请已被其他设备处理',target_missing:'目标任务不存在',already_completed:'该周期任务已经完成',
    target_inactive:'目标任务已停用',missing_game_state:'云端存档不存在，请先同步电脑存档',
    not_found:'未找到本人名下的申请'}[result?.reason]||('申请审核未成功：'+(result?.reason||'未知原因'));
   message=reason;
  }else{
   message=action==='reject'?'申请已拒绝':('申请已批准并写入云端存档（修订版 '+result.revision+'）。未自动发放任何 XP 或金币');
   if(action==='approve'){
    await cloud().reconcile(true);
    if(cloud().status().phase!=='synced')message+='；本设备尚有同步冲突，请在「设置」处理';
   }
  }
 }finally{busy=false;changed()}
 await refresh();
}
function selectedTask(state,id){return (state.tasks||[]).find(t=>t.id===id)}
function options(state,selected=''){
 const tasks=(state.tasks||[]).filter(t=>t.active!==false);
 return tasks.map(t=>'<option value="'+escape(t.id)+'" '+(t.id===selected?'selected':'')+'>'+escape(t.title)+' · '+escape(t.id)+'</option>').join('');
}
function reviewForm(p,state){
 if(p.kind==='create'){
  const q=p.payload||{};
  return '<form class="proposal-review" data-proposal-id="'+escape(p.id)+'" id="proposal-review-'+escape(p.id)+'">'+
   '<div class="field"><label>任务名称</label><input name="title" required maxlength="65" value="'+escape(q.title||p.title)+'"></div>'+
   '<div class="field"><label>完成标准</label><textarea name="detail" maxlength="250">'+escape(q.detail||'')+'</textarea></div>'+
   '<div class="grid2"><div class="field"><label>任务类别</label><select name="kind"><option value="main" '+(q.kind==='main'?'selected':'')+'>主线</option><option value="side" '+(q.kind==='side'?'selected':'')+'>支线</option></select></div>'+
   '<div class="field"><label>重复周期</label><select name="repeat">'+['once','daily','weekly'].map(v=>'<option value="'+v+'" '+(q.repeat===v?'selected':'')+'>'+({once:'一次性',daily:'每日',weekly:'每周'}[v])+'</option>').join('')+'</select></div></div>'+
   '<div class="grid2"><div class="field"><label>方向</label><select name="area">'+AREAS.map(v=>'<option value="'+v+'" '+(q.area===v?'selected':'')+'>'+({career:'工作/职业',learning:'学习',finance:'财务',social:'社交',health:'健康',explore:'探索'}[v])+'</option>').join('')+'</select></div>'+
   '<div class="field"><label>XP / 金币</label><div class="data-actions"><input name="xp" type="number" min="5" max="80" required value="'+Number(q.xp||50)+'" style="width:90px"><input name="coins" type="number" min="0" max="80" required value="'+Number(q.coins??25)+'" style="width:90px"></div></div></div>'+
   '<p class="hint">批准仅加入任务库，不发放奖励，不覆盖旧主线。</p>'+
   '<div class="data-actions"><button class="btn btn-primary" type="submit">✓ 批准并加入任务</button><button class="btn btn-ghost" type="button" data-action="proposal-reject" data-id="'+escape(p.id)+'">拒绝申请</button></div></form>';
 }
 const q=p.payload||{};
 return '<form class="proposal-review" data-proposal-id="'+escape(p.id)+'" id="proposal-review-'+escape(p.id)+'">'+
  '<div class="field"><label>目标任务</label><select name="targetTaskId" required>'+options(state,q.targetTaskId)+'</select></div>'+
  '<div class="field"><label>更新状态</label><select name="status"><option value="doing" '+(q.status==='doing'?'selected':'')+'>进行中</option><option value="review" '+(q.status==='review'?'selected':'')+'>待确认</option></select></div>'+
  '<div class="field"><label>真实进展记录</label><textarea name="note" maxlength="240" required>'+escape(q.note||'')+'</textarea></div>'+
  '<p class="hint">批准只更新进度，不视为完成，不发放 XP 或金币。会检查目标是否已完成。</p>'+
  '<div class="data-actions"><button class="btn btn-primary" type="submit">✓ 批准进度更新</button><button class="btn btn-ghost" type="button" data-action="proposal-reject" data-id="'+escape(p.id)+'">拒绝申请</button></div></form>';
}
function view(state,c){
 const pending=items.filter(x=>x.status==='pending');
 return '<div class="eyebrow">AI QUEST REQUESTS</div><h1 class="title">📮 任务申请箱</h1>'+
  '<p class="lead">ChatGPT 可从你主动提供的对话里建议任务；每条申请都需要你亲自批准。系统不能自动读取其他 ChatGPT 对话窗口。</p>'+
  '<div class="panel"><div class="section-head" style="margin:0 0 10px"><h2>候选任务</h2><button class="btn btn-small" data-action="proposal-refresh">↻ 刷新</button></div>'+
  '<p class="hint">申请与正式存档分库存储。新任务和进度必须在审批后才生效；审核采用云端修订版检查，防止多端覆盖。</p>'+
  '<div class="data-actions"><button class="btn btn-primary" data-action="proposal-example" '+(!available()?'disabled':'')+'>＋ 提交今天的公司项目</button></div>'+
  '<p class="hint">示例不自动提交；点击才会创建待审申请。相同申请键不会重复建立任务。</p>'+
  (phase==='loading'?'<p class="hint">正在读取云端申请……</p>':'')+
  (phase==='error'?'<div class="cloud-warning"><strong>尚未启用申请箱</strong><p>'+escape(message)+'</p></div>':'')+
  (message&&phase!=='error'?'<p class="hint" role="status">'+escape(message)+'</p>':'')+
  (phase==='ready'&&!pending.length?'<p class="hint">暂无待审申请。你可以点击上方示例，或从 ChatGPT 复制申请 JSON。</p>':'')+
  pending.map(p=>'<article class="proposal-item" style="border-top:1px solid var(--stroke);padding:18px 0">'+
    '<div class="meta"><span class="chip">'+(p.kind==='create'?'新任务':'进度更新')+'</span> <span class="muted-tag">待审核</span></div>'+
    '<h3>'+escape(p.title)+'</h3><p class="hint">来源：'+escape(p.source)+' · '+escape(p.dedupe_key)+'</p>'+
    '<details><summary>审核及修改申请</summary>'+reviewForm(p,state)+'</details>'+
    '</article>').join('')+
  '<details class="compact-log"><summary>已处理申请（'+items.filter(p=>p.status!=='pending').length+'）</summary>'+
    items.filter(p=>p.status!=='pending').map(p=>'<div class="activity"><div class="activity-main"><strong>'+escape(p.title)+'</strong><small>'+escape(STATUS[p.status]||p.status)+' · '+escape(p.source)+'</small></div></div>').join('')+
  '</details></div>'+
  '<div class="panel" style="margin-top:15px"><h3>从 ChatGPT 申请任务</h3><p class="hint">在聊天里让我生成 gaming-life.proposal / version 1 JSON，复制到下面，经格式核验后提交到待审箱。</p>'+
  '<form id="proposal-json-form"><div class="field"><label for="proposal-json">任务申请 JSON</label><textarea id="proposal-json" name="json" rows="5" maxlength="10000" placeholder="粘贴 ChatGPT 输出的 JSON" required></textarea></div>'+
  '<button class="btn btn-primary" type="submit" '+(!available()?'disabled':'')+'>校验并提交待审</button></form>'+
  '<p class="hint">建议只分享必要的任务摘要，不要复制完整私人对话。申请被批准前，不会改变游戏任务或奖励。</p></div>'+
  '<div class="panel" style="margin-top:15px"><h3>创建进度更新申请</h3><form id="proposal-progress-form">'+
  '<div class="field"><label>目标任务</label><select name="targetTaskId" required>'+options(state)+'</select></div>'+
  '<div class="field"><label>状态</label><select name="status"><option value="doing">进行中</option><option value="review">待确认</option></select></div>'+
  '<div class="field"><label>今天推进了什么？</label><textarea name="note" maxlength="240" required></textarea></div>'+
  '<button class="btn" type="submit" '+(!available()?'disabled':'')+'>申请更新进度（不发奖励）</button></form></div>'+
  '<p class="footnote">当前模式：'+(c?.mode==='cloud'?'手机云端优先':'电脑本地优先')+'。待审申请必须联网；离线正式游戏存档仍遵守 V1.6 规则。</p>';
}
async function action(a,id){
 try{
  if(a==='proposal-refresh')return await refresh();
  if(a==='proposal-example')return await submitProposal(EXAMPLE);
  if(a==='proposal-reject'){
   if(!root.confirm('拒绝这条申请？拒绝后不会修改游戏存档，且相同去重键不能重复提交。'))return;
   return await decide(id,'reject',{});
  }
 }catch(e){message=e.message||String(e);changed()}
}
async function submit(form,state){
 try{
  if(form.id==='proposal-json-form'){
   const raw=String(new FormData(form).get('json')||'');
   if(raw.length>10000)throw Error('申请 JSON 过长');
   const p=validate(JSON.parse(raw));
   if(!root.confirm('提交「'+p.title+'」到待审箱？不会直接加入正式任务。'))return;
   await submitProposal(p);return;
  }
  if(form.id==='proposal-progress-form'){
   const f=new FormData(form),id=String(f.get('targetTaskId')||''),task=selectedTask(state,id),note=String(f.get('note')||'').trim();
   if(!task||!note)throw Error('请选择真实任务并填写进度');
   const status=String(f.get('status'));
   const p={format:'gaming-life.proposal',version:1,kind:'progress',title:'更新进度：'+task.title,source:'Gaming Life · 用户主动填写',
     dedupeKey:'progress-'+hash(id)+'-'+hash(status+':'+note),payload:{targetTaskId:id,status,note}};
   await submitProposal(p);return;
  }
  if(form.id.startsWith('proposal-review-')){
   const p=items.find(x=>x.id===form.dataset.proposalId);
   if(!p)throw Error('找不到待审记录');
   const f=new FormData(form);
   let resolution;
   if(p.kind==='create'){
    resolution={title:String(f.get('title')||'').trim(),detail:String(f.get('detail')||'').trim(),
      kind:String(f.get('kind')||''),area:String(f.get('area')||''),repeat:String(f.get('repeat')||''),
      xp:Number(f.get('xp')),coins:Number(f.get('coins'))};
   }else{
    resolution={targetTaskId:String(f.get('targetTaskId')||''),status:String(f.get('status')||''),
      note:String(f.get('note')||'').trim()};
   }
   validate({...EXAMPLE,dedupeKey:p.dedupe_key,kind:p.kind,title:p.title,source:p.source,payload:resolution});
   if(!root.confirm('确认批准「'+p.title+'」？这会直接修改 Supabase 游戏存档，但不会发放任务奖励。'))return;
   await decide(p.id,'approve',resolution);
  }
 }catch(e){message='操作失败：'+(e?.message||String(e));changed()}
}
root.GamingLifeProposals={view,refresh,action,submit,example:EXAMPLE,validate};
})(window);
