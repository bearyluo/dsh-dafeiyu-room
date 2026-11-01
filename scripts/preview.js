/** Observer-only development server: no chat, model credentials, or mutation API. */
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {RoomRuntime} from '../src/runtime.js';
import {prefix,serveRoom} from '../src/http.js';
const args=process.argv.slice(2),arg=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];};
const data=resolve(arg('--data','data/room-camera-preview')),port=Number(arg('--port','8793'));
mkdirSync(data,{recursive:true});
const runtime=new RoomRuntime({statePath:join(data,'room.json')});
const control=join(data,'control.json');let runId=null,scenery=null;
const timer=setInterval(()=>{
  runtime.advance();
  if(existsSync(control))try{
    const fixture=JSON.parse(readFileSync(control,'utf8'));
    if(fixture.runId&&fixture.runId!==runId){
      if(fixture.scenery&&(!Number.isInteger(fixture.scenery.hour)||fixture.scenery.hour<0||fixture.scenery.hour>23||!['clear','cloudy','rain','snow','fog','thunder','unknown'].includes(fixture.scenery.weather)))throw Error('场景验收参数无效');
      runtime.select('acceptance-fixture');runtime.plan(fixture.steps||[],{id:fixture.runId,agentId:'acceptance-fixture',revision:runtime.sim.state.revision});runId=fixture.runId;scenery=fixture.scenery||null;
    }
  }catch(error){runtime.error=error.message;}
},100);
const snapshot=runtime.snapshot.bind(runtime);runtime.snapshot=()=>{
  const state={...snapshot(),preview:runId!==null,previewScenery:!!scenery};
  if(scenery){
    const hour=scenery.hour;state.life.clock={...state.life.clock,hour,time:String(hour).padStart(2,'0')+':00',night:hour<6||hour>=18,period:hour<6?'深夜':hour<10?'早晨':hour<17?'白天':hour<19?'傍晚':'夜晚'};
    state.weather={status:scenery.weather==='unknown'?'unavailable':'live',kind:scenery.weather,code:scenery.weather==='cloudy'?3:undefined,label:'演示天气',city:'场景验收',source:'验收演示',temperature:18,example:true};
  }
  return state;
};
const server=createServer((req,res)=>{
  if(req.url==='/'){res.writeHead(302,{Location:prefix+'/'});res.end();return;}
  serveRoom(runtime,req,res);
});
server.listen(port,'127.0.0.1',()=>console.log('Camera preview: http://127.0.0.1:'+port+prefix+'/'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{clearInterval(timer);runtime.save();runtime.close();server.close();});
