import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {timingSafeEqual} from 'node:crypto';
import {allowed,web,prefix} from './http.js';

const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>value?.[key]!==undefined).map(key=>[key,value[key]]));
const bodyKeys=['schema','revision','position','direction','pose','action','fixture','prop','lastTick','resting'];
function phase(value){
  if(!value)return null;
  return {...pick(value,['kind','label','duration','to','startedAt','from','fromDirection','fromPose','toPose','exit','activity']),patch:pick(value.patch,['pose','action','fixture','prop','direction'])};
}
/** Only the data needed to animate a body, never host credentials or chat/task text. */
export function visualSnapshot(state){
  if(state?.schema!==1||state.body?.schema!==1||!Number.isFinite(state.serverTime))throw Error('Invalid camera state');
  const body=state.body,life=state.life||{};
  return {schema:1,pluginVersion:state.pluginVersion,serverTime:state.serverTime,connected:!!state.connected,activeAgent:!!state.activeAgent,error:state.error?'小屋活动暂停':null,
    body:{...pick(body,bodyKeys),phase:phase(body.phase),queue:(body.queue||[]).map(phase),completed:[],receipts:[],plan:body.plan?{id:'viewer',agentId:'viewer',index:body.plan.index,exit:body.plan.exit,steps:body.plan.steps.map(step=>pick(step,['action','duration_seconds','x','y']))}:null},
    life:{...pick(life,['clock','needs','items','room','alarmRangAt']),phone:pick(life.phone,['unread','lastReplyAt']),work:pick(life.work,['status','failures']),alarms:(life.alarms||[]).map(alarm=>pick(alarm,['scheduledAt']))},
    weather:pick(state.weather,['status','kind','code','label','city','temperature','example'])};
}

export function createMobileHandler({token,snapshot,authorities,publicOrigins=new Set(),apkPath=null}){
  if(!/^[\w-]{43}$/.test(token))throw Error('A 256-bit pairing token is required');
  const expected=Buffer.from('Bearer '+token);
  return async(req,res)=>{
    const host=req.headers.host;
    if(!authorities.has(host)){res.writeHead(403);res.end();return;}
    let url;try{url=new URL(req.url,'http://'+host);}catch{res.writeHead(400);res.end();return;}
    // A same-origin page may view; foreign browser origins cannot relay a token.
    if(req.headers.origin&&req.headers.origin!==url.origin&&!publicOrigins.has(req.headers.origin)){res.writeHead(403);res.end();return;}
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'");
    if(req.method!=='GET'){res.writeHead(405,{Allow:'GET'});res.end();return;}
    if(url.pathname==='/'){res.writeHead(302,{Location:prefix+'/mobile.html'});res.end();return;}
    if(!url.pathname.startsWith(prefix+'/')){res.writeHead(404);res.end();return;}
    const relative=url.pathname.slice(prefix.length+1)||'index.html';
    if(relative==='android-app.apk'){
      if(!apkPath){res.writeHead(404);res.end();return;}
      try{const bytes=readFileSync(apkPath);res.writeHead(200,{'Content-Type':'application/vnd.android.package-archive','Content-Disposition':'attachment; filename="dafeiyu-room.apk"'});res.end(bytes);}catch{res.writeHead(503);res.end();}return;
    }
    if(relative==='state'){
      const supplied=Buffer.from(String(req.headers.authorization||''));
      if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected)){res.writeHead(401,{'Content-Type':'application/json'});res.end('{"error":"需要完整的手机访问链接"}');return;}
      try{const state=visualSnapshot(await snapshot());res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(state));}
      catch{res.writeHead(503,{'Content-Type':'application/json; charset=utf-8'});res.end('{"error":"电脑上的小屋暂时未连接"}');}
      return;
    }
    if(!allowed.has(relative)){res.writeHead(404);res.end();return;}
    try{const bytes=readFileSync(join(web,relative));res.writeHead(200,{'Content-Type':relative.endsWith('.png')?'image/png':relative.endsWith('.html')?'text/html; charset=utf-8':relative.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'});res.end(bytes);}
    catch{res.writeHead(503);res.end();}
  };
}

/** Multiplex viewers onto one loopback source; never instantiate an agent or simulation. */
export function loopbackSource(source){
  const url=new URL(source);
  if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password||url.pathname!==prefix+'/state'||url.search||url.hash)throw Error('Source must be the local cabin state endpoint');
  let cached=null,at=0,pending=null;
  return async()=>{
    if(cached&&Date.now()-at<900)return cached;
    if(!pending)pending=(async()=>{
      const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(4000)});
      if(!response.ok)throw Error('Cabin offline');
      // Project before caching: task titles and session/call IDs stay local.
      cached=visualSnapshot(await response.json());at=Date.now();return cached;
    })().finally(()=>{pending=null;});
    return pending;
  };
}
