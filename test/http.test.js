import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {serveRoom,prefix} from '../src/http.js';
import {RoomRuntime} from '../src/runtime.js';
test('the camera serves only local observation, never chat or body commands',async t=>{
  const server=createServer((req,res)=>serveRoom({snapshot:()=>({schema:1,body:{action:'stand'}})},req,res));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.closeAllConnections();server.close();});
  const port=server.address().port;
  const get=(path,method='GET',headers={})=>new Promise((resolve,reject)=>{
    const req=request({host:'127.0.0.1',port,path,method,headers},res=>{
      let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));
    });req.on('error',reject);req.end();
  });
  const state=await get(prefix+'/state');assert.equal(state.status,200);assert.equal(JSON.parse(state.body).schema,1);
  assert.match(state.headers['content-security-policy'],/frame-ancestors 'self'/);
  const camera=await get(prefix+'/');assert.equal(camera.status,200);assert(!/<textarea|<input|<form/.test(camera.body));
  for(const [,asset] of camera.body.matchAll(/<script src="\.\/([^"]+)"/g)){
    const script=await get(prefix+'/'+asset);assert.equal(script.status,200,asset);assert.match(script.headers['content-type'],/javascript/);
  }
  assert.equal((await get(prefix+'/state','POST')).status,405);
  assert.equal((await get(prefix+'/state','GET',{Origin:'https://unrelated.example'})).status,403);
  assert.equal((await get(prefix+'/state','GET',{Host:'unrelated.example'})).status,403);
  for(const path of ['/chat','/api/chat',prefix+'/plan',prefix+'/../src/index.js',prefix+'/assets/../../LICENSE'])assert.equal((await get(path)).status,404);
});

test('settings accepts only city/timezone with a per-runtime token and rejects body or cross-origin writes',async t=>{
  const runtime=new RoomRuntime();runtime.refreshWeather=async()=>{};runtime.searchCities=async()=>[{name:'上海',latitude:31.2,longitude:121.5,timeZone:'Asia/Shanghai'}];
  const server=createServer((req,res)=>serveRoom(runtime,req,res));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.closeAllConnections();server.close();runtime.close();});
  const url='http://127.0.0.1:'+server.address().port+prefix;
  const settings=await(await fetch(url+'/settings')).json();assert.equal(settings.location.example,true);
  const send=(body,headers={})=>fetch(url+'/settings',{method:'POST',headers:{'Content-Type':'application/json','X-Room-Settings-Token':settings.csrfToken,...headers},body:JSON.stringify(body)});
  assert.equal((await send({timeZone:'UTC'},{'X-Room-Settings-Token':'bad'})).status,403);
  assert.equal((await send({timeZone:'UTC'},{Origin:'https://unrelated.example'})).status,403);
  assert.equal((await send({steps:[{action:'sleep'}]})).status,400);
  assert.equal((await send({timeZone:'Unknown/City'})).status,400);
  assert.equal((await send({timeZone:'x'.repeat(9000)})).status,413);
  const locations=await(await fetch(url+'/locations?q=上海')).json();
  assert.equal((await send({location:locations.locations[0],timeZone:'Asia/Shanghai'})).status,200);
  assert.equal(runtime.settings().location.name,'上海');assert.equal(runtime.settings().location.example,false);
  assert.equal(runtime.sim.state.revision,0);
});
