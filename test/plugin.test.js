import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {apply} from '../src/index.js';
import {RoomRuntime} from '../src/runtime.js';
const signal=()=>new AbortController().signal;
function fixture(t){
  const folder=mkdtempSync(join(tmpdir(),'dafeiyu-room-test-')),tools=new Map(),contexts=[],listeners={},cleanup=[];
  const agent={id:'existing-agent',status:'idle',inbox:{nextTurn:[],nextStep:[]},send(){}};
  const ctx={tools:{register(tool){tools.set(tool.name,tool);}},systemPrompt:{context(c){contexts.push(c);}},agents:{roots:()=>[agent],get:id=>id===agent.id?agent:undefined},logger:()=>({info(){},warn(){}}),
    on(event,fn){listeners[event]=fn;},inject(){},effect(fn){const dispose=fn();if(typeof dispose==='function')cleanup.push(dispose);}};
  apply(ctx,{statePath:join(folder,'room.json'),maxDailyDecisions:0});
  t.after(()=>{for(const fn of cleanup)fn();rmSync(folder,{recursive:true,force:true});});
  return {ctx,tools,contexts,listeners,agent,folder};
}
test('native defineTool registers body tools with the existing host and leaves persona untouched',async t=>{
  const f=fixture(t);assert.deepEqual([...f.tools.keys()],['room_observe','room_plan']);
  const exec={signal:signal(),agent:f.agent,callId:'host-call-1'};
  const environment=f.contexts[0].text({agent:f.agent});assert.match(environment,/你居住的小屋/);
  assert(!environment.includes('你叫')&&!environment.includes('你是洛'));
  const observation=JSON.parse(await f.tools.get('room_observe').execute({},exec));
  const ack=JSON.parse(await f.tools.get('room_plan').execute({revision:observation.revision,steps:[{action:'phone_bed'}]},exec));
  assert.equal(ack.status,'accepted');
  const current=JSON.parse(await f.tools.get('room_observe').execute({},exec));assert.equal(current.posture,'stand');assert.equal(current.intended_action,'phone_bed');
  assert.equal(f.contexts[0].text({agent:{id:'subagent'}}),'');
});
test('ordinary user messages retain the body plan; aborted and non-primary tools cannot change it',async t=>{
  const f=fixture(t),exec={signal:signal(),agent:f.agent,callId:'primary-call'};
  const obs=JSON.parse(await f.tools.get('room_observe').execute({},exec));
  await f.tools.get('room_plan').execute({revision:obs.revision,steps:[{action:'read_bed'}]},exec);
  f.listeners['agent/inbox/inserted']({agent:f.agent,message:{source:{kind:'user'}}});
  assert.equal(JSON.parse(await f.tools.get('room_observe').execute({},exec)).intended_action,'read_bed');
  await assert.rejects(()=>f.tools.get('room_plan').execute({revision:1,steps:[]},{...exec,agent:{id:'child'}}));
  const controller=new AbortController();controller.abort();
  await assert.rejects(()=>f.tools.get('room_observe').execute({},{...exec,signal:controller.signal}));
});
test('idle wake-up is bounded, persisted, and never creates its own model client',t=>{
  const folder=mkdtempSync(join(tmpdir(),'room-runtime-'));let now=1000000;
  const path=join(folder,'room.json'),runtime=new RoomRuntime({statePath:path,now:()=>now});
  t.after(()=>{runtime.close();rmSync(folder,{recursive:true,force:true});});
  runtime.userActivity('primary');const agent={id:'primary',status:'idle',inbox:{nextTurn:[],nextStep:[]}};
  assert.equal(runtime.claimWake(agent),false);now+=120001;assert.equal(runtime.claimWake(agent),true);assert.equal(runtime.claimWake(agent),false);
  assert.equal(JSON.parse(readFileSync(path)).usage.attempts,1);
  now+=600001;agent.status='running';assert.equal(runtime.claimWake(agent),false);
  agent.status='idle';agent.inbox.nextTurn.push({});assert.equal(runtime.claimWake(agent),false);
  assert.throws(()=>new RoomRuntime({statePath:path,now:()=>now}),/另一个宿主/);
});

test('native session tool events project real work; room tools and unrelated sessions do not',async t=>{
  const f=fixture(t),exec={signal:signal(),agent:f.agent,callId:'plan'};
  f.listeners['agent/inbox/inserted']({agent:f.agent,message:{id:'actual-user',source:{kind:'user'}}});
  const observe=async()=>JSON.parse(await f.tools.get('room_observe').execute({},exec));
  const event=f.listeners['session/event'];
  event(f.agent,{type:'tool/call',data:{name:'room_observe',callId:'observe'}});assert.equal((await observe()).life.work.status,'idle');
  event({id:'other'},{type:'tool/call',data:{name:'terminal_send',callId:'other'}});assert.equal((await observe()).life.work.status,'idle');
  event(f.agent,{type:'tool/call',data:{name:'terminal_open',callId:'terminal'}});assert.equal((await observe()).intended_action,'computer');
  event(f.agent,{type:'tool/result',data:{message:{toolCallId:'terminal',isError:true}}});
  event(f.agent,{type:'turn/end',data:{reason:{kind:'error',error:{message:'host failure'}}}});
  const result=await observe();assert.equal(result.life.work.status,'failed');assert.equal(result.life.work.failures,1);
  assert.equal(result.life.phone.unread,1);
  event(f.agent,{type:'assistant/message',data:{message:{content:[{type:'text',text:'回复'}]}}});assert.equal((await observe()).life.phone.unread,0);
});
