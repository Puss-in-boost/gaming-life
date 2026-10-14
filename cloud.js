/* Gaming Life local-first persistence + Supabase Auth/REST adapter.
 * No secret key, no server, no third-party SDK. Never pushes on first login
 * without comparing local state with the remote revision.
 */
(function (root) {
  'use strict';
  const DB_NAME = 'gaming-life-data', DB_VERSION = 1;
  const STORE = 'records';
  let db = null, isPersistent = false, configured = null, session = null;
  // Per-device setting: 'cloud' holds the full state in memory only.
  let mode = 'local', hasCloudData = false;
  let info = {phase:'initializing', message:'正在读取本地存档', pending:null, userEmail:null, revision:null, persistent:false};
  let base = null, currentUser = null, onReplace = null, onUpdate = () => {}, getState = () => null;
  let remoteChoice = null, serial = Promise.resolve(), syncTimer = null, syncing = false, dirtyWhileSync = false;
  function note(phase, message, pending = null) {
    info = {...info,phase,message,pending,userEmail:session?.user?.email||null,persistent:isPersistent};
    onUpdate({...info});
  }
  function openDB() {return new Promise((resolve,reject)=>{
    if(!root.indexedDB)return reject(new Error('当前浏览器未提供 IndexedDB'));
    const req=root.indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};
    req.onerror=()=>reject(req.error||new Error('无法打开本地数据库'));
    req.onsuccess=()=>resolve(req.result);
  })}
  function get(key){return new Promise((resolve,reject)=>{
    if(!db)return resolve(null);const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).get(key);
    req.onsuccess=()=>resolve(req.result??null);req.onerror=()=>reject(req.error);
  })}
  function put(key,value){return new Promise((resolve,reject)=>{
    if(!db)return reject(new Error('IndexedDB 不可用'));
    const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,key);
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('本地持久化失败'));
    tx.onabort=()=>reject(tx.error||new Error('本地事务中断'));
  })}
  function write(key,value){serial=serial.catch(()=>{}).then(()=>put(key,value));return serial}
  function deleteStateRecords(){return new Promise((resolve,reject)=>{
    if(!db)return resolve();
    const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
    const req=store.getAllKeys();
    req.onsuccess=()=>{for(const key of req.result){if(key==='state'||key==='state_stamp'||String(key).startsWith('backup_'))store.delete(key)}};
    req.onerror=()=>reject(req.error||new Error('存档索引读取失败'));
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('云端模式清理失败'));tx.onabort=()=>reject(tx.error||new Error('清理事务已中止'));
  })}
  async function purgeFullLocalState(){
    await serial.catch(()=>{}); // Never let older queued local saves recreate a purged state.
    await deleteStateRecords();
    try{root.localStorage.removeItem('gaming-life-v1-local');root.localStorage.removeItem('gaming-life-v1-local_stamp')}catch(_){/* restricted browser */}
  }
  function mobileBrowser(){return !!root.matchMedia?.('(pointer: coarse) and (max-width: 768px)')?.matches}
  function canEdit(){return mode!=='cloud'||(hasCloudData&&!!session?.access_token&&info.phase==='synced'&&navigator.onLine&&!syncing&&!remoteChoice)}
  function hasUnsynced(){return mode==='cloud'&&hasCloudData&&!!base?.last&&JSON.stringify(getState())!==base.last}
  async function boot(initial,applyState,readState,onStatus){
    onReplace=applyState;getState=readState;onUpdate=onStatus||(()=>{});
    try{
      db=await openDB();isPersistent=true;
      const saved=await get('state'), savedStamp=Number(await get('state_stamp')||0);
      let mirrorStamp=0,hasMirror=false;
      try{mirrorStamp=Number(root.localStorage.getItem('gaming-life-v1-local_stamp')||0);hasMirror=!!root.localStorage.getItem('gaming-life-v1-local')}catch(_){/* restricted storage */}
      const selected=await get('storage_mode');
      // Fresh mobile installs default to cloud-only. Existing V1.5 saves remain
      // local-first until the owner explicitly switches and resolves differences.
      mode=selected==='cloud'?'cloud':selected==='local'?'local':mobileBrowser()&&!saved&&!hasMirror?'cloud':'local';
      if(mode==='cloud'){
        await write('storage_mode','cloud');
        await purgeFullLocalState();
        hasCloudData=false;
        initial=null; // Do not show default quests pretending they came from cloud.
      }else if(mirrorStamp>savedStamp){
        await write('state',JSON.parse(JSON.stringify(initial)));await write('state_stamp',mirrorStamp);
      }else if(saved?.version===1&&Array.isArray(saved.tasks))initial=saved;
      else{await write('state',JSON.parse(JSON.stringify(initial)));await write('state_stamp',mirrorStamp)}
      configured=await get('config');session=await get('session');base=await get('remote_base');
      if(mode==='cloud'){
        base=null;await write('remote_base',null); // Remove V1.5 full base.last snapshots.
        note('loading','云端优先：等待登录并读取云端存档');
      }else note('local','已由 IndexedDB 保存；尚未登录云端');
      if(configured?.url&&configured?.key&&session?.refresh_token){
        setTimeout(async()=>{try{await refresh();await reconcile(false)}catch(e){note('offline',mode==='cloud'?'云端无法读取；当前设备不会写入临时任务：'+e.message:'本地记录安全；云端暂不可用：'+e.message)}},100);
      }
    }catch(e){db=null;isPersistent=false;note('fallback','IndexedDB 不可用，云端账号信息无法持久保存：'+e.message)}
    return initial;
  }
  function persist(next,suppressSync=false,externalStamp=null){
    if(mode==='cloud'){
      if(suppressSync)return Promise.resolve(true);
      if(!canEdit())return Promise.resolve(false);
      note('saving','正在保存到 Supabase；保存成功前请勿关闭页面');
      schedule(0);
      return Promise.resolve(true);
    }
    if(!db)return Promise.resolve(false);
    const copy=JSON.parse(JSON.stringify(next));const stamp=externalStamp||Date.now();
    return write('state',copy).then(()=>write('state_stamp',stamp)).then(()=>{
      if(!suppressSync&&session?.access_token&&info.pending===null){if(syncing)dirtyWhileSync=true;schedule()}
      return true;
    }).catch(e=>{note('error','本地保存失败：'+e.message);return false});
  }
  function status(){return {...info,mode,hasCloudData,canEdit:canEdit(),configured:!!configured?.url,configUrl:configured?.url||'',signedIn:!!session?.access_token,remoteRevision:base?.revision??null}}
  function credentials(email,password){
    if(!email||!String(email).includes('@')||!password||String(password).length<6)throw new Error('请输入正确邮箱及至少6位的密码');
  }
  async function configure(url,key){
    url=String(url||'').trim().replace(/\/+$/,'');key=String(key||'').trim();
    if(!/^https:\/\/[^\s/]+(?:\/)?$/.test(url))throw new Error('请填写 HTTPS 的 Supabase Project URL');
    if(!key||key.startsWith('sb_secret_')||key.length<20)throw new Error('请填写 Supabase publishable/anon key，不要填写 secret/service_role key');
    if(key.split('.').length===3){try{const jwt=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(jwt.role==='service_role')throw new Error('禁止在网页配置 service_role 密钥')}catch(e){if(e.message?.includes('service_role'))throw e}}
    if(!db)throw new Error('IndexedDB 不可用，请先解除浏览器存储限制');
    if(configured?.url!==url||configured?.key!==key){session=null;base=null;currentUser=null;await write('session',null);await write('remote_base',null);if(mode==='cloud'){hasCloudData=false;await onReplace(null)}}
    configured={url,key};await write('config',configured);    note(mode==='cloud'?'loading':'local',mode==='cloud'?'云端模式已配置，请登录获取存档':'云端项目已配置，请登录或注册');return status();
  }
  async function request(path,options={}){
    if(!configured)throw new Error('请先配置 Supabase URL 和 Publishable Key');
    const headers={'apikey':configured.key,'Content-Type':'application/json',...options.headers};
    if(options.auth!==false){if(!session?.access_token)throw new Error('尚未登录');if(session.expires_at&&session.expires_at<Date.now()/1000+45)await refresh();headers.Authorization='Bearer '+session.access_token}
    const response=await fetch(configured.url+path,{method:options.method||'GET',headers,body:options.body===undefined?undefined:JSON.stringify(options.body),cache:'no-store'});
    const text=await response.text();let value=null;try{value=text?JSON.parse(text):null}catch(_){value=text}
    if(!response.ok)throw new Error(value?.msg||value?.message||value?.error_description||value?.error||'HTTP '+response.status);
    return value;
  }
  async function acceptSession(data){
    if(!data?.access_token||!data?.refresh_token)throw new Error('登录信息无效，请重新登录');
    session={...data,expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||3600)};
    await write('session',session);
    return session;
  }
  async function refresh(){
    if(!session?.refresh_token)throw new Error('登录已过期');
    const auth=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',auth:false,body:{refresh_token:session.refresh_token}});
    await acceptSession(auth);return session;
  }
  async function login(email,password,mode='signin'){
    credentials(email,password);if(!db)throw new Error('请先启用浏览器本地存储');
    if(!configured)throw new Error('请先配置 Supabase 项目');
    const auth=await request(mode==='signup'?'/auth/v1/signup':'/auth/v1/token?grant_type=password',{method:'POST',auth:false,body:{email,password}});
    if(!auth?.access_token){note('verify','账号创建请求已提交；请检查邮箱验证邮件，再返回登录');return}
    await acceptSession(auth);await reconcile(false);
  }
  async function logout(){
    try{if(session?.access_token)await request('/auth/v1/logout',{method:'POST'})}catch(_){/* local logout still works */}
    session=null;currentUser=null;base=null;remoteChoice=null;await write('session',null);await write('remote_base',null);
    if(mode==='cloud'){hasCloudData=false;await onReplace(null);note('loading','云端模式已退出；需再次登录才能查看任务')}
    else note('local','已退出云端账号。本地游戏存档仍保留');
  }
  async function fetchUser(){const u=await request('/auth/v1/user');if(!u?.id)throw new Error('无法确认用户身份');return u}
  async function fetchRemote(id){
    const results=await request('/rest/v1/gaming_life_states?select=payload,revision,updated_at&user_id=eq.'+encodeURIComponent(id),{headers:{Accept:'application/json'}});
    return Array.isArray(results)?results[0]||null:null;
  }
  async function casSave(payload,expected){
    const data=await request('/rest/v1/rpc/gaming_life_put_state',{method:'POST',body:{expected_revision:expected,new_state:payload}});
    if(!data||data.ok!==true)return {ok:false,revision:data?.revision??null};
    return {ok:true,revision:Number(data.revision)};
  }
  function same(a,b){return JSON.stringify(a)===JSON.stringify(b)}
  async function markSynced(userId,revision,payload){
    base={userId,revision,last:JSON.stringify(payload)};await write('remote_base',mode==='cloud'?{userId,revision}:base);
    info.revision=revision;currentUser=userId;remoteChoice=null;
    note('synced','已与云端同步 · 修订版 '+revision,null);
  }
  async function replaceWithRemote(remote){
    if(mode==='local')await write('backup_'+Date.now()+'_local',JSON.parse(JSON.stringify(getState())));
    await onReplace(remote.payload);
    if(mode==='local')await write('state',JSON.parse(JSON.stringify(remote.payload)));
    else hasCloudData=true;
    await markSynced(currentUser,remote.revision,remote.payload);
  }
  async function reconcile(manual=false){
    if(syncing)return;if(!session?.access_token||!configured)return;
    if(!navigator.onLine){note('offline',mode==='cloud'?'当前离线；云端模式暂停修改':'当前离线；本地照常保存，联网后再同步');return}
    syncing=true;
    try{
      const user=await fetchUser();
      const id=user.id;session.user=user;await write('session',session);
      const remote=await fetchRemote(id),local=JSON.parse(JSON.stringify(getState()));
      if(!remote){
        currentUser=id;
        if(mode==='cloud'){remoteChoice=null;note('empty','此账号尚无云端存档。请在电脑本地优先模式上传存档，或切换回本地模式');return}
        remoteChoice={kind:'upload',userId:id,remote:null};note('decision','云端暂无存档。请确认是否上传当前本地进度','upload');return;
      }
      if(mode==='cloud'&&currentUser&&currentUser!==id){hasCloudData=false;base=null;await onReplace(null)}
      currentUser=id;
      if(mode==='cloud'&&!hasCloudData){await replaceWithRemote(remote);return}
      if(base?.userId!==id){
        if(same(remote.payload,local)){await markSynced(id,remote.revision,remote.payload)}
        else {remoteChoice={kind:'choose',userId:id,remote};note('decision','云端已有存档。请手动决定保留哪一份','choose')}
        return;
      }
      const localUnchanged=JSON.stringify(local)===base.last;
      const remoteUnchanged=JSON.stringify(remote.payload)===base.last;
      if(localUnchanged&&remoteUnchanged){await markSynced(id,remote.revision,remote.payload)}
      else if(localUnchanged&&!remoteUnchanged){await replaceWithRemote(remote)}
      else if(!localUnchanged&&remoteUnchanged){
        const result=await casSave(local,remote.revision);
        if(result.ok)await markSynced(id,result.revision,local);
        else {remoteChoice={kind:'choose',userId:id,remote:await fetchRemote(id)};note('conflict','其他设备刚更新了云端，需手动处理冲突','choose')}
      }else if(same(local,remote.payload)){await markSynced(id,remote.revision,local)}
      else {remoteChoice={kind:'choose',userId:id,remote};note('conflict','本地与云端都有新进展，未自动覆盖任何记录','choose')}
    }catch(e){note('offline',mode==='cloud'?'云端保存失败：本次进展仅保留在当前页面内存中，请勿关闭；可重试同步或手动导出备份。'+e.message:'云端连接失败；本地记录保留：'+e.message)}finally{syncing=false;if(dirtyWhileSync){dirtyWhileSync=false;if(session?.access_token&&!remoteChoice&&navigator.onLine)schedule()}}
  }
  async function choose(where){
    if(!remoteChoice||!session?.access_token)throw new Error('当前没有待处理的同步决定');
    const latest=await fetchRemote(remoteChoice.userId);
    if(where==='cloud'){
      if(!latest)throw new Error('云端暂时没有可用存档');
      currentUser=remoteChoice.userId;await replaceWithRemote(latest);return;
    }
    if(where==='local'){
      const local=JSON.parse(JSON.stringify(getState()));
      if(mode==='cloud')throw new Error('云端模式不支持用本机覆盖云端；请先切回本地模式');
      if(latest?.payload)await write('backup_'+Date.now()+'_cloud',latest.payload);
      const result=await casSave(local,latest?.revision??0);
      if(!result.ok){remoteChoice={kind:'choose',userId:remoteChoice.userId,remote:await fetchRemote(remoteChoice.userId)};note('conflict','云端刚发生新的修改，请再次确认','choose');return}
      await markSynced(remoteChoice.userId,result.revision,local);return;
    }
    throw new Error('未知同步选项');
  }
  async function enterCloudMode(){
    if(!db||!configured||!session?.access_token)throw new Error('请先完成 Supabase 登录');
    if(!navigator.onLine)throw new Error('需要联网验证云端存档才能切换');
    const user=await fetchUser(),remote=await fetchRemote(user.id);
    if(!remote?.payload)throw new Error('云端暂无存档，请先使用电脑上传原始存档');
    // This action is explicit: callers must confirm local data will be replaced.
    clearTimeout(syncTimer);
    await write('storage_mode','cloud');mode='cloud';
    await purgeFullLocalState();
    base=null;await write('remote_base',null);currentUser=user.id;hasCloudData=false;
    await replaceWithRemote(remote);
    return status();
  }
  async function enterLocalMode(){
    if(!db||mode!=='cloud')throw new Error('当前无需切换本地模式');
    const snapshot=JSON.parse(JSON.stringify(getState()));
    await write('storage_mode','local');mode='local';
    await write('state',snapshot);await write('state_stamp',Date.now());
    await write('remote_base',base);
    await onReplace(snapshot); // Writes the compatibility mirror in local mode.
    note(hasCloudData?'synced':'local',hasCloudData?'已切回本地优先；已有云端记录也可离线使用':'已启用本地优先，可离线使用；首次云端上传需你确认');
    return status();
  }
  function schedule(delay=1700){clearTimeout(syncTimer);if(session?.access_token&&!remoteChoice)syncTimer=setTimeout(()=>reconcile().catch(()=>{}),delay)}
  async function cloudBackup(){
    if(!session?.access_token)throw new Error('请先登录');
    const user=await fetchUser(),remote=await fetchRemote(user.id);
    if(!remote)throw new Error('目前没有云端存档');
    return JSON.stringify({...remote.payload,exportedAt:new Date().toISOString(),backupSource:'supabase'},null,2);
  }
  function bindNetwork(){root.addEventListener('online',()=>schedule());root.addEventListener('focus',()=>{if(session?.access_token)schedule()})}
  bindNetwork();
  root.GamingLifeCloud={boot,persist,status,configure,login,logout,choose,reconcile,cloudBackup,enterCloudMode,enterLocalMode,hasUnsynced,waitForWrites:()=>serial,hasDB:()=>isPersistent,proposalUserId:()=>currentUser,proposalRequest:(path,opts)=>request(path,opts)};
})(window);