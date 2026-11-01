import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {RoomRuntime} from '../src/runtime.js';
import {createMobileHandler,visualSnapshot,loopbackSource} from '../src/mobile-viewer.js';
import {prefix} from '../src/http.js';
const {RoomSimulation}=createRequire(import.meta.url)('../web/simulation.cjs');

test('phone projection animates the same multi-step plan without session IDs, task text or settings',()=>{
  const runtime=new RoomRuntime({now:()=>100000});
  runtime.select('private-session');runtime.plan([{action:'sit_table',duration_seconds:30},{action:'computer',duration_seconds:30}],{id:'private-call',agentId:'private-session',revision:runtime.sim.state.revision});
  runtime.life.state.alarms=[{id:'private-alarm',title:'confidential task',scheduledAt:'2026-11-01T12:00:00Z'}];
  const full=runtime.snapshot(),view=visualSnapshot(full),text=JSON.stringify(view);
  for(const secret of ['private-session','private-call','private-alarm','confidential task','csrfToken','autonomy'])assert(!text.includes(secret));
  const actual=new RoomSimulation(full.body,full.serverTime),phone=new RoomSimulation(view.body,view.serverTime);
  for(const delta of [0,1000,10000,35000,55000,90000]){
    const a=actual.tick(full.serverTime+delta),b=phone.tick(full.serverTime+delta);
    assert.deepEqual(b.position,a.position);assert.equal(b.pose,a.pose);assert.equal(b.action,a.action);assert.equal(b.phase?.kind,a.phase?.kind);
  }
  runtime.close();
});

test('phone server requires its own token, rejects writes and foreign hosts, and omits settings',async t=>{
  const runtime=new RoomRuntime(),token=randomBytes(32).toString('base64url'),authorities=new Set();let online=true;
  const handler=createMobileHandler({token,authorities,snapshot:()=>{if(!online)throw Error('private local error');return runtime.snapshot();}});
  const server=createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.closeAllConnections();server.close();runtime.close();});
  const port=server.address().port;authorities.add('127.0.0.1:'+port);
  const get=(path,headers={},method='GET')=>new Promise((resolve,reject)=>{const req=request({host:'127.0.0.1',port,path,headers,method},res=>{let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,body,headers:res.headers}));});req.on('error',reject);req.end();});
  const auth={Authorization:'Bearer '+token};
  assert.equal((await get(prefix+'/state')).status,401);
  assert.equal((await get(prefix+'/state',{Authorization:'Bearer wrong'})).status,401);
  assert.equal((await get(prefix+'/state',auth)).status,200);
  assert.equal((await get(prefix+'/state',{...auth,Origin:'https://other.example'})).status,403);
  assert.equal((await get(prefix+'/state',{...auth,Host:'other.example'})).status,403);
  assert.equal((await get(prefix+'/state',auth,'POST')).status,405);
  for(const path of ['/settings','/locations','/plan','/../src/index.js'])assert.equal((await get(prefix+path,auth)).status,404);
  const page=await get(prefix+'/mobile.html');assert.equal(page.status,200);assert.match(page.body,/viewport-fit=cover/);assert(!page.body.includes(token));
  for(const asset of ['mobile.js','mobile.css','camera.js','assets/cabin-v2.png'])assert.equal((await get(prefix+'/'+asset)).status,200);
  online=false;const failed=await get(prefix+'/state',auth);assert.equal(failed.status,503);assert(!failed.body.includes('private local error'));
});

test('a phone relay cannot proxy an external host or arbitrary local service',()=>{
  for(const source of ['https://example.com'+prefix+'/state','http://127.0.0.1:8796/settings','http://127.0.0.1:8796'+prefix+'/state?token=secret','http://user:pass@localhost'+prefix+'/state'])assert.throws(()=>loopbackSource(source));
});

test('a configured tunnel origin can read only the same authenticated camera',async t=>{
  const runtime=new RoomRuntime(),token=randomBytes(32).toString('base64url'),authorities=new Set(),publicOrigins=new Set();
  const server=createServer(createMobileHandler({token,authorities,publicOrigins,snapshot:()=>runtime.snapshot()}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.closeAllConnections();server.close();runtime.close();});const port=server.address().port;authorities.add('127.0.0.1:'+port);
  const url='http://127.0.0.1:'+port+prefix,headers={Origin:'https://configured.trycloudflare.com',Authorization:'Bearer '+token};
  assert.equal((await fetch(url+'/state',{headers})).status,403);publicOrigins.add(headers.Origin);
  assert.equal((await fetch(url+'/state',{headers})).status,200);
  assert.equal((await fetch(url+'/state',{headers:{Origin:headers.Origin}})).status,401);
  assert.equal((await fetch(url+'/state',{headers:{...headers,Origin:'https://unconfigured.trycloudflare.com'}})).status,403);
  for(const path of ['/settings','/plan','/android-app.apk'])assert.equal((await fetch(url+path,{headers})).status,404);
  const setup=await fetch(url+'/android.html',{headers});assert.equal(setup.status,200);assert.match(await setup.text(),/打开安卓悬浮窗/);
});
