from playwright.sync_api import sync_playwright
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
h=(ROOT/'index.html').read_text().replace('<script src="./cloud.js"></script>', '<script>'+(ROOT/'cloud.js').read_text()+'</script>')
mock=(ROOT/'tests/browser_mock.js').read_text()

def page_run(browser,mobile=False,legacy=False,remote=None,seed=None):
 ctx=browser.new_context(viewport={'width':390 if mobile else 1200,'height':844 if mobile else 900},is_mobile=mobile,has_touch=mobile,accept_downloads=True)
 page=ctx.new_page();errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
 page.evaluate(mock)
 if legacy:
  page.evaluate("localStorage.setItem('gaming-life-v1-local',JSON.stringify({version:1,tasks:[],events:[{id:'prior1',taskId:'prior1',xp:24,date:'2026-10-13',at:'2026-10-13T12:00:00Z'}],notes:[]}));localStorage.setItem('gaming-life-v1-local_stamp','5000')")
 if seed:
  page.evaluate('(seed)=>{for(const [k,v] of Object.entries(seed))__db.set(k,v)}',seed)
 if remote:
  page.evaluate('(v)=>{__supa.row=v}',remote)
 page.set_content(h);page.wait_for_timeout(500)
 return ctx,page,errors

def signin(page):
 page.evaluate("async()=>{await GamingLifeCloud.configure('https://demo.supabase.co','sb_publishable_test-key-0123456789');await GamingLifeCloud.login('user@demo.test','pass12345')}")
 page.wait_for_timeout(100)

def state(page):return page.evaluate('GamingLifeCloud.status()')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 dc,d,de=page_run(b);assert state(d)['mode']=='local',state(d)
 signin(d);assert state(d)['pending']=='upload',state(d)
 d.evaluate("async()=>await GamingLifeCloud.choose('local')")
 remote=d.evaluate('__supa.row')
 assert remote['revision']==1
 assert len(d.evaluate('__db.get("state").tasks'))>0
 print('DESKTOP',state(d)['mode'],remote['revision'])

 mc,m,me=page_run(b,mobile=True,remote=remote)
 print('MOBILE BEFORE',state(m))
 assert state(m)['mode']=='cloud',state(m)
 assert 'state' not in m.evaluate('Array.from(__db.keys())')
 assert m.evaluate("localStorage.getItem('gaming-life-v1-local')") is None
 assert '云端冒险尚未就绪' in m.locator('#app').inner_text()
 signin(m)
 assert state(m)['phase']=='synced' and state(m)['canEdit'] and state(m)['hasCloudData'],state(m)
 assert 'state' not in m.evaluate('Array.from(__db.keys())')
 assert 'last' not in m.evaluate('__db.get("remote_base")')
 assert m.evaluate("localStorage.getItem('gaming-life-v1-local')") is None
 print('MOBILE CLOUD LOADED',state(m)['remoteRevision'],m.evaluate('Array.from(__db.keys())'))

 # Act on one reward: should sync; no full snapshot persisted.
 m.locator('button[data-action="complete"]').first.click();m.wait_for_timeout(300)
 remote2=m.evaluate('__supa.row')
 assert remote2['revision']==2,remote2
 assert len(remote2['payload']['events'])==1
 assert 'state' not in m.evaluate('Array.from(__db.keys())')
 assert m.evaluate("localStorage.getItem('gaming-life-v1-local')") is None
 assert state(m)['phase']=='synced'
 print('MOBILE CLOUD WRITES',remote2['revision'])
 # Freshly reopened mobile recovers exclusively from Supabase using metadata.
 saved_meta=m.evaluate('Object.fromEntries(__db.entries())')
 rc,re,rer=page_run(b,mobile=True,remote=remote2,seed=saved_meta)
 re.wait_for_function("GamingLifeCloud.status().phase==='synced'",timeout=4000)
 assert state(re)['mode']=='cloud' and state(re)['remoteRevision']==2 and state(re)['hasCloudData']
 assert not any(k in re.evaluate('Array.from(__db.keys())') for k in ('state','state_stamp'))
 print('MOBILE RELOAD',state(re)['remoteRevision'])

 # Genuine browser-offline flag blocks edits before state changes.
 m.evaluate("Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false})")
 prev_text=m.locator('#app').inner_text()
 m.locator('button[data-action="complete"]').nth(1).click()
 assert m.locator('#app').inner_text()==prev_text
 assert not state(m)['canEdit']
 m.evaluate("Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true})")

 # Network failure while uploading leaves a volatile unsynced change in memory.
 # Network failure blocks subsequent changes; the user must retry or export.

 m.evaluate('__supa.fail=true');m.locator('button[data-action="complete"]').nth(1).click();m.wait_for_timeout(100)
 assert m.evaluate('__supa.row.revision')==2
 assert m.evaluate('__supa.row.payload.events.length')==1
 assert m.evaluate('GamingLifeCloud.hasUnsynced()')
 assert state(m)['phase']=='offline' and not state(m)['canEdit']
 print('CLOUD FAILURE RETAINS MEMORY',state(m)['phase'])
 m.evaluate('__supa.fail=false')
 m.evaluate('async()=>await GamingLifeCloud.reconcile(true)')
 assert m.evaluate('__supa.row.revision')==3
 assert state(m)['phase']=='synced' and not m.evaluate('GamingLifeCloud.hasUnsynced()')
 print('CLOUD RETRY',state(m)['remoteRevision'])

 # Simulate a second device modifying the remote while this page also changes.
 m.evaluate("__supa.row={revision:__supa.row.revision+1,payload:{...__supa.row.payload,notes:[...__supa.row.payload.notes,{id:'remote-note',text:'another device',date:'2026-10-13',at:new Date().toISOString()}]}}")
 m.locator('button[data-action="complete"]').nth(2).click();m.wait_for_timeout(250)
 assert state(m)['pending']=='choose' and not state(m)['canEdit']
 assert m.evaluate('GamingLifeCloud.hasUnsynced()')
 assert not any(k in m.evaluate('Array.from(__db.keys())') for k in ('state','state_stamp'))
 m.evaluate("async()=>await GamingLifeCloud.choose('cloud')")
 assert state(m)['phase']=='synced' and not m.evaluate('GamingLifeCloud.hasUnsynced()')
 print('CLOUD CAS CONFLICT + MANUAL RESOLVE',state(m)['remoteRevision'])

 # Back to local mode materializes state.
 m.evaluate('__supa.fail=false')
 m.evaluate('async()=>await GamingLifeCloud.enterLocalMode()')
 assert state(m)['mode']=='local'
 assert 'state' in m.evaluate('Array.from(__db.keys())')
 assert m.evaluate("localStorage.getItem('gaming-life-v1-local')") is not None
 print('BACK TO LOCAL',len(m.evaluate('__db.get("state").events')))

 # Existing phone local records must remain until explicit switch.
 lc,l,le=page_run(b,mobile=True,legacy=True,remote=remote2)
 assert state(l)['mode']=='local',state(l)
 assert l.evaluate('__db.get("state").events.length')==1
 signin(l)
 assert state(l)['pending']=='choose',state(l)
 assert l.evaluate('__db.get("state").events.length')==1
 l.evaluate('async()=>await GamingLifeCloud.enterCloudMode()')
 assert state(l)['mode']=='cloud' and state(l)['phase']=='synced',state(l)
 assert not any(x=='state' or x=='state_stamp' or x.startswith('backup_') for x in l.evaluate('Array.from(__db.keys())'))
 assert l.evaluate("localStorage.getItem('gaming-life-v1-local')") is None
 assert 'last' not in l.evaluate('__db.get("remote_base")')
 assert l.evaluate('__supa.row.revision')==2
 print('EXISTING MOBILE SWITCHED CLOUD',l.evaluate('Array.from(__db.keys())'))
 print('JS ERRORS',de,me,le,rer)
 assert not(de or me or le or rer)
 b.close()