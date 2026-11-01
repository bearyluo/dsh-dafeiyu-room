import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RoomRuntime} from '../src/runtime.js';
import {IndoorLife} from '../src/life.js';
function fixture(t,persist=false){
  let now=Date.UTC(2026,9,31,14);const folder=mkdtempSync(join(tmpdir(),'room-life-'));
  const statePath=persist?join(folder,'room.json'):undefined;
  const room=new RoomRuntime({statePath,now:()=>now});room.userActivity('primary','message-1');
  t.after(()=>{room.close();rmSync(folder,{recursive:true,force:true});});
  let id=0;
  return {room,statePath,plan:steps=>room.plan(steps,{id:'test-'+(++id),agentId:'primary',revision:room.sim.state.revision}),
    advance:ms=>{now+=ms;room.advance();},untilHold:()=>{for(let i=0;i<100&&room.sim.state.phase?.kind!=='hold';i++){const p=room.sim.state.phase;assert(p);now=p.startedAt+p.duration;room.advance();}assert.equal(room.sim.state.phase?.kind,'hold');}};
}
test('indoor meals, dishes, cleaning and sleep have once-only effects after completion, and persist',t=>{
  const f=fixture(t,true),life=f.room.life.state;
  f.plan([{action:'cook',duration_seconds:30},{action:'eat',duration_seconds:30},{action:'drink',duration_seconds:30},{action:'tidy',duration_seconds:30},{action:'wash_dishes',duration_seconds:30},{action:'sleep',duration_seconds:7200}]);
  assert.deepEqual(life.items,{ingredients:6,meals:2,cleanCups:3,dirtyCups:0,dirtyDishes:0});
  life.needs.energy=20;f.advance(3*3600000);
  assert.deepEqual(life.items,{ingredients:5,meals:2,cleanCups:3,dirtyCups:0,dirtyDishes:0});
  assert.equal(life.room.tidy,100);assert(life.needs.energy>40&&life.needs.energy<50);
  assert.equal(f.room.sim.state.action,'lie_bed');assert.equal(f.room.sim.state.plan,null);
  f.room.save();const saved=JSON.parse(readFileSync(f.statePath));assert.equal(saved.life.processed.length,6);
  f.room.observe();f.room.observe();assert.equal(life.items.ingredients,5);
  const restored=new IndoorLife(saved.life,Date.UTC(2026,10,2));assert.equal(restored.state.needs.energy,saved.life.needs.energy);
});
test('interrupting eating does not consume a meal; duplicate successful calls do not eat twice',t=>{
  const f=fixture(t);f.plan([{action:'eat',duration_seconds:30}]);f.untilHold();f.advance(10000);f.plan([]);f.advance(20000);
  assert.equal(f.room.life.state.items.meals,2);
  const result=f.plan([{action:'eat',duration_seconds:30}]);f.advance(120000);
  assert.equal(f.room.life.state.items.meals,1);
  f.room.plan(result.steps,{id:result.id,agentId:'primary',revision:-1});f.advance(120000);
  assert.equal(f.room.life.state.items.meals,1);
  f.room.life.state.items.meals=0;const revision=f.room.sim.state.revision;
  assert.throws(()=>f.plan([{action:'eat'}]),/没有现成简餐/);assert.equal(f.room.sim.state.revision,revision);
  assert.doesNotThrow(()=>f.plan([{action:'cook',duration_seconds:30},{action:'eat',duration_seconds:30}]));
});
test('sleep suppresses idle decisions and incoming real messages only light the phone',t=>{
  const f=fixture(t);f.plan([{action:'sleep',duration_seconds:28800}]);f.untilHold();f.advance(3600000);
  const agent={id:'primary',status:'idle',inbox:{nextTurn:[],nextStep:[]}};
  assert.equal(f.room.claimWake(agent),false);
  const planId=f.room.sim.state.plan.id;f.room.userActivity('primary','night-message');f.room.userActivity('primary','night-message');
  assert.equal(f.room.sim.state.plan.id,planId);assert.equal(f.room.observe().life.phone.unread,2);
  f.room.life.reply(f.room.now());assert.equal(f.room.observe().life.phone.unread,0);
  f.plan([{action:'phone_bed',duration_seconds:30}]);f.untilHold();f.room.userActivity('primary','another-message');f.advance(1000);
  assert.equal(f.room.observe().life.phone.unread,0);
  assert(!JSON.stringify(f.room.life.state).includes('night-message text'));
});
test('real work interrupts life, renews during a long tool run and returns without claiming a finished task',t=>{
  const f=fixture(t);f.plan([{action:'read_bed',duration_seconds:600}]);f.untilHold();f.advance(50000);
  f.room.startWork('terminal-1');assert.equal(f.room.observe().intended_action,'computer');
  f.room.startWork('read-2');assert.equal(f.room.life.state.work.calls,2);
  f.advance(900000);assert.equal(f.room.sim.state.plan.steps[0].action,'computer');
  f.room.life.workResult('read-2',true);f.room.endWork({kind:'aborted'});
  assert.equal(f.room.life.state.work.status,'interrupted');assert.equal(f.room.life.state.work.failures,1);
  assert.equal(f.room.observe().intended_action,'read_bed');
  assert(f.room.sim.state.plan.steps[0].duration_seconds<=550);
  assert.equal(f.room.life.state.phone.replies,0);
});
test('alarm mirrors include only active tasks targeting the current session, without prompts',()=>{
  const life=new IndoorLife();life.setAlarms([
    {id:'a',title:'工作',prompt:'private task',status:'active',target:{kind:'session',sessionId:'primary'},scheduledAt:'2026-11-01T01:00:00Z'},
    {id:'b',title:'其他会话',status:'active',target:{kind:'session',sessionId:'other'}},
    {id:'c',title:'新会话',status:'active',target:{kind:'new'}},
    {id:'d',title:'已暂停',status:'paused',target:{kind:'session',sessionId:'primary'}}
  ],'primary');assert.equal(life.state.alarms.length,1);assert.equal(life.state.alarms[0].id,'a');assert(!JSON.stringify(life.state.alarms).includes('private'));
});
