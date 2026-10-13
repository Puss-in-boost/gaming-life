(()=>{
 const dbStorage=new Map();
 const db={objectStoreNames:{contains:n=>n==='records'},createObjectStore(n){return this},
  transaction(){const tx={objectStore(){return {get(key){const q={}; queueMicrotask(()=>{q.result=dbStorage.get(key);q.onsuccess?.()});return q},put(value,key){dbStorage.set(key,structuredClone(value));queueMicrotask(()=>{tx.oncomplete?.()})},getAllKeys(){const q={};queueMicrotask(()=>{q.result=Array.from(dbStorage.keys());q.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.())});return q},delete(key){dbStorage.delete(key);return {}}}}};return tx}};
 Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){const q={result:db};queueMicrotask(()=>{q.onupgradeneeded?.();q.onsuccess?.()});return q}}});
 const local=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{setItem:(k,v)=>local.set(k,String(v)),getItem:(k)=>local.get(k)??null,removeItem:(k)=>local.delete(k)}});
 window.__db=dbStorage;
 window.__supa={row:null,user:{id:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',email:'user@demo.test'},calls:[],fail:false};
 const okay=(data,status=200)=>new Response(data===null?'':JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 window.fetch=async (url,opts={})=>{
  const api=window.__supa,path=new URL(url).pathname;
  api.calls.push(path);
  if(api.fail)throw new TypeError('offline mock network');
  if(path==='/auth/v1/token')return okay({access_token:'example_access_token',refresh_token:'refresh_token_123',expires_in:3600,user:api.user});
  if(path==='/auth/v1/signup')return okay({access_token:'example_access_token',refresh_token:'refresh_token_123',expires_in:3600,user:api.user});
  if(path==='/auth/v1/user')return okay(api.user);
  if(path==='/auth/v1/logout')return okay(null,204);
  if(path==='/rest/v1/gaming_life_states')return okay(api.row?[{payload:api.row.payload,revision:api.row.revision,updated_at:new Date().toISOString()}]:[]);
  if(path==='/rest/v1/rpc/gaming_life_put_state'){
   const b=JSON.parse(opts.body||'{}');
   if(api.row){if(b.expected_revision!==api.row.revision)return okay({ok:false,revision:api.row.revision});api.row={revision:api.row.revision+1,payload:b.new_state};}
   else{if(b.expected_revision!==0)return okay({ok:false,revision:null});api.row={revision:1,payload:b.new_state}}
   return okay({ok:true,revision:api.row.revision});
  }
  throw Error('Unknown URL '+url);
 }
})();