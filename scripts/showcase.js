/** Local, disposable animation acceptance. Never packaged or attached to an Agent. */
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {RoomRuntime} from '../src/runtime.js';
import {serveRoom} from '../src/http.js';
const {actions}=createRequire(import.meta.url)('../web/simulation.cjs');
const allOrder=['stand','walk','sit_bed','phone_bed','read_bed','tea_bed','lie_bed','sleep','window','curtains_close','curtains_open','fireplace','bookshelf','water','sit_table','cook','eat','drink','tea','phone_table','tidy','wash_dishes','sit_chair','computer','lamp_off','lamp_on'];
if(allOrder.length!==Object.keys(actions).length||allOrder.some(key=>!Object.hasOwn(actions,key)))throw Error('动作清单与房间引擎不一致');
const actionArg=process.argv.indexOf('--action');
const singleAction=actionArg>=0?process.argv[actionArg+1]:null;
if(actionArg>=0&&!Object.hasOwn(actions,singleAction))throw Error('未知验收动作');
const order=singleAction?[singleAction]:allOrder;
let singleExiting=false,singleRestUntil=null,singleCycles=0;
const port=Number(process.argv[process.argv.indexOf('--port')+1])||8798;
let pauseOnArrival=false,frameMarker='arrival',cueSequence=0;
let runtime,index=0,running=false,done=false,error=null,lastAt=Date.now(),virtualAt=lastAt,holding=null;
const makeRuntime=()=>new RoomRuntime({now:()=>virtualAt,maxDailyDecisions:0,weatherFetch:async()=>{throw Error('验收不请求天气');}});
function startCue(){
  const action=order[index];holding=null;frameMarker='arrival';
  runtime.life.state.work.status='idle';
  if(action==='computer')runtime.life.state.work={status:'working',source:'animation-demo',calls:0,failures:0};
  const steps=action==='walk'?[{x:40,y:45},{x:65,y:45},{x:65,y:60},{x:50,y:57}].map(point=>({action:'walk',duration_seconds:30,...point})):[{action,duration_seconds:['lamp_on','lamp_off','curtains_open','curtains_close'].includes(action)?3:30}];
  runtime.plan(steps,{id:'showcase:'+index+':'+(++cueSequence),agentId:'animation-acceptance',revision:runtime.sim.state.revision});
}
function reset(){singleExiting=false;singleRestUntil=null;singleCycles=0;runtime?.close();virtualAt=Date.now();lastAt=Date.now();runtime=makeRuntime();runtime.select('animation-acceptance');index=0;running=false;done=false;error=null;pauseOnArrival=false;startCue();}
reset();
const originalSnapshot=RoomRuntime.prototype.snapshot;
function snapshot(){
  const state=originalSnapshot.call(runtime);
  state.serverTime=Date.now();
  if(state.body.phase)state.body.phase.startedAt+=Date.now()-virtualAt;
  state.body.lastTick=Date.now();
  state.previewFrame=order[index]+'-'+frameMarker;state.preview=true;state.previewScenery=true;state.previewPaused=!running;
  state.life.clock={...state.life.clock,hour:21,time:'21:00',night:true,period:'夜晚'};
  state.weather={status:'live',kind:'clear',code:0,label:'晴夜演示',city:'动作验收',source:'动画演示',temperature:18,example:true};
  return state;
}
function status(){return {singleAction,index:index+1,total:order.length,action:order[index],label:actions[order[index]],stage:runtime.sim.state.phase?.label||'完成',running,done,error,items:order.map(action=>({action,label:actions[action]})),canFrame:runtime.sim.state.phase?.kind==='hold',canEntry:['sit_chair','sit_table','sit_bed','lie_bed','sleep'].includes(order[index]),computerDemo:order[index]==='computer'};}
function entryFrame(command){
  singleExiting=false;singleRestUntil=null;
  runtime.close();runtime=makeRuntime();runtime.select('animation-acceptance');done=false;error=null;startCue();
  for(let n=0;runtime.sim.state.phase?.kind!=='mount'&&n<2000;n++){virtualAt+=20;runtime.advance();}
  const phase=runtime.sim.state.phase;
  if(phase?.kind!=='mount')throw Error('此动作没有落座阶段');
  virtualAt=phase.startedAt+phase.duration*(command==='entry_start'?0:command==='entry_middle'?.5:1);
  runtime.advance();frameMarker=command;running=false;pauseOnArrival=false;lastAt=Date.now();
}
function advance(delta){
  if(running&&!done&&!error){
    virtualAt+=delta;
    try{
      const phase=runtime.sim.state.phase;
      if(phase?.kind==='hold'&&holding!==phase){holding=phase;phase.duration=(order[index]==='walk'?750:3000);}
      runtime.advance();
      if(pauseOnArrival&&runtime.sim.state.phase?.kind==='hold'){virtualAt+=1200;runtime.advance();running=false;pauseOnArrival=false;}
      if(!runtime.sim.state.plan&&!runtime.sim.state.phase){
        if(singleAction){
          if(!singleExiting){singleExiting=true;runtime.plan([],{id:'single-exit:'+cueSequence,agentId:'animation-acceptance',revision:runtime.sim.state.revision});}
          else if(singleRestUntil===null)singleRestUntil=virtualAt+1500;
          else if(virtualAt>=singleRestUntil){singleCycles++;singleExiting=false;singleRestUntil=null;if(process.argv.includes('--check')&&singleCycles>=2){done=true;running=false;}else startCue();}
        }else if(index===order.length-1){done=true;running=false;}else{index++;startCue();}
      }
    }catch(cause){error=cause.message;running=false;}
  }
}
if(process.argv.includes('--check')){
  running=true;let elapsed=0;
  for(;!done&&!error&&elapsed<1200000;elapsed+=50)advance(50);
  runtime.close();if(error||!done)throw Error(error||'播放未完成');
  console.log(JSON.stringify({completed:order.length,...(singleAction?{cycles:singleCycles}:{}),seconds:elapsed/1000,actions:order}));process.exit(0);
}
const timer=setInterval(()=>{const now=Date.now();advance(Math.min(now-lastAt,500));lastAt=now;},50);
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${singleAction?"小屋 · 单动作验收":"小屋 · 全动作验收"}</title><link rel="stylesheet" href="/showcase.css"><script src="/showcase-client.js" defer></script><main><header><div><strong>${singleAction?"单独播放 · "+actions[singleAction]:"小屋 · 全动作验收"}</strong><small>真实动作引擎 · 本地演示 · 不调用模型 / 不执行真实工作</small></div><nav><button id="toggle">开始完整播放</button><button id="restart">从头播放</button><button id="previous">上一项</button><button id="next">下一项</button><button id="entry-start" disabled>落座前</button><button id="entry-middle" disabled>落座中</button><button id="entry-end" disabled>落座后</button><button id="frame-start" disabled>起始帧</button><button id="frame-middle" disabled>中间帧</button><button id="frame-end" disabled>完成帧</button></nav></header><section><iframe title="小屋全部动作播放画面" src="/plugins/dsh-dafeiyu-room/"></iframe><aside><h1 id="current">准备播放</h1><p id="stage"></p><p id="hint">每个动作停留3秒，走路与起身保持原速。可随时暂停检查。</p><ol id="list"></ol></aside></section><footer>${singleAction?"仅循环演示这个动作：走近、落座、停留3秒、起身离开。":"仅此验收页提供播放控制，正式插件仍由模型自主活动。"}天气与时间为演示。</footer></main></html>`;
const css=`*{box-sizing:border-box}body{margin:0;background:#edf0ea;color:#28372d;font:14px system-ui,sans-serif}main{max-width:1450px;margin:auto;padding:16px}header{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}strong{font-size:20px}small{display:block;color:#647367;margin-top:5px}nav{display:flex;gap:8px;flex-wrap:wrap}button{border:1px solid #b4c2b3;border-radius:8px;padding:10px 16px;background:#fff;color:#344c37;cursor:pointer}button:first-child{background:#3c6549;color:#fff}section{display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:16px}iframe{width:100%;aspect-ratio:4/3;border:0;border-radius:10px;background:#284a3f}aside{background:#fff;border-radius:10px;padding:16px;max-height:calc(100vh - 140px);overflow:auto}h1{font-size:19px;margin:0 0 8px}p{line-height:1.6;color:#627266;margin:8px 0}ol{padding-left:30px;line-height:1.8}li{padding:2px 7px;border-radius:4px}li button{background:transparent!important;color:inherit!important;border:0;padding:0;text-align:left;font:inherit}li.active{background:#e5eddf;color:#294b32;font-weight:600}li.complete{color:#909b91}footer{font-size:12px;color:#778477;margin-top:12px}@media(max-width:800px){section{display:block}aside{max-height:270px;margin-top:12px}header{align-items:flex-start;flex-wrap:wrap}main{padding:8px}}`;
const client=readFileSync(new URL('./showcase-client.js',import.meta.url),'utf8');
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://'+req.headers.host);
  if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||(req.headers.origin&&req.headers.origin!==url.origin)){res.writeHead(403);res.end();return;}
  res.setHeader('Cache-Control','no-store');
  if(req.method==='GET'&&url.pathname==='/plugins/dsh-dafeiyu-room/camera.css'&&singleAction==='sit_table'){
    const source=readFileSync(new URL('../web/camera.css',import.meta.url),'utf8');
    res.writeHead(200,{'Content-Type':'text/css; charset=utf-8'});
    res.end(source+'\n.camera-shell{position:absolute;width:min(400vw,533.333dvh);left:calc(50% - min(400vw,533.333dvh)*.664);top:calc(50% - min(400vw,533.333dvh)*.52125)}');return;
  }
  if(req.method==='GET'&&url.pathname==='/plugins/dsh-dafeiyu-room/camera.js'){
    // The acceptance transport can freeze its local replay clock. Production is untouched.
    const source=readFileSync(new URL('../web/camera.js',import.meta.url),'utf8');
    if(source.split('connected=true;').length!==2)throw Error('验收暂停适配点已变化');
    res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end('let showcasePaused=false;\n'+source.replace('connected=true;','connected=true;showcasePaused=!!state.previewPaused;').replace('const at=connected?','const at=connected&&!showcasePaused?').replace('household=state.life||null;','household=state.life||null;scene.dataset.previewFrame=state.previewFrame;'));return;
  }
  if(req.method==='GET'&&['/','/showcase.css','/showcase-client.js','/showcase-state'].includes(url.pathname)){
    const type=url.pathname==='/'?'text/html':url.pathname.endsWith('.css')?'text/css':url.pathname.endsWith('.js')?'text/javascript':'application/json';
    res.writeHead(200,{'Content-Type':type+'; charset=utf-8','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; frame-src 'self'; base-uri 'none'; frame-ancestors 'self'"});
    res.end(url.pathname==='/'?html:url.pathname.endsWith('.css')?css:url.pathname.endsWith('.js')?client:JSON.stringify(status()));return;
  }
  if(url.pathname==='/showcase-control'&&req.method==='POST'){
    try{let body='';for await(const chunk of req){body+=chunk;if(body.length>256)throw Error('invalid');}const {command}=JSON.parse(body);if(command==='restart'){reset();running=true;}else if(command==='play'&&!done)running=true;else if(command==='pause')running=false;else if(['entry_start','entry_middle','entry_end'].includes(command)){entryFrame(command);}else if(['frame_start','frame_middle','frame_end'].includes(command)){const phase=runtime.sim.state.phase;if(phase?.kind!=='hold')throw Error('not holding');frameMarker=command.slice(6);phase.duration=3000;holding=phase;if(command==='frame_end'){virtualAt=phase.startedAt+phase.duration;runtime.advance();}else{phase.startedAt=virtualAt-(command==='frame_middle'?1500:0);}running=false;pauseOnArrival=false;}else if(command==='previous'||command==='next'){index=Math.max(0,Math.min(order.length-1,index+(command==='previous'?-1:1)));runtime.life.state.items={ingredients:6,meals:2,cleanCups:3,dirtyCups:1,dirtyDishes:1};done=false;error=null;startCue();pauseOnArrival=true;running=true;}else if(Number.isInteger(command)&&command>=0&&command<order.length){index=command;runtime.life.state.items={ingredients:6,meals:2,cleanCups:3,dirtyCups:1,dirtyDishes:1};done=false;error=null;startCue();pauseOnArrival=true;running=true;}else throw Error('invalid');lastAt=Date.now();res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(status()));}catch{res.writeHead(400);res.end();}return;
  }
  const facade=Object.create(runtime);facade.snapshot=snapshot;
  await serveRoom(facade,req,res);
});
server.listen(port,'127.0.0.1',()=>console.log('All-actions showcase: http://127.0.0.1:'+port+'/'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{clearInterval(timer);runtime.close();server.close();});
